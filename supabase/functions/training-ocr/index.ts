// =========================================================
//  WorkSpace — Edge Function «training-ocr»
//  Розпізнає скріншот призначеного тестування (LMS / таблиця / лист)
//  через Claude Vision. Повертає { title, assigned_on, deadline }.
//  Дати — у форматі YYYY-MM-DD (або "" якщо не видно).
//  Секрет: ANTHROPIC_API_KEY (+ опц. ANTHROPIC_WORKSPACE_ID).
//  Деплой: supabase functions deploy training-ocr --project-ref taiqrxlehnfkuvokgwqu
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const ANTHROPIC_WORKSPACE_ID = Deno.env.get("ANTHROPIC_WORKSPACE_ID") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: ures } = await userClient.auth.getUser();
  if (!ures?.user) return json({ error: "unauthorized" }, 401);
  const { data: ctype } = await userClient.rpc("my_cabinet_type");
  const { data: isAdmin } = await userClient.rpc("is_manager_or_admin");
  if (!isAdmin && ctype !== "tm" && ctype !== "manager") return json({ error: "forbidden" }, 403);

  if (!ANTHROPIC_KEY) return json({ error: "AI не налаштовано (немає ключа)" }, 501);

  let image = "";
  try {
    const b = await req.json();
    image = b.image || "";
  } catch { return json({ error: "bad json" }, 400); }
  if (!image.startsWith("data:image/")) return json({ error: "bad image" }, 400);

  const [meta, b64] = image.split(",");
  const mediaType = meta.match(/data:(image\/[a-z]+)/)?.[1] || "image/jpeg";
  const today = new Date().toISOString().slice(0, 10);

  const prompt =
    "Це скріншот картки/списку призначеного співробітникам тестування або навчання (українською чи російською). " +
    "Витягни:\n" +
    "• title — назва тестування (коротко, без слів «Тест:», «Курс:»);\n" +
    "• assigned_on — дата призначення у форматі YYYY-MM-DD (якщо видно лише день/місяць — додай поточний рік; якщо не видно — \"\");\n" +
    "• deadline — кінцева дата проходження у форматі YYYY-MM-DD (те саме правило; якщо не видно — \"\").\n" +
    `Сьогодні ${today}. ` +
    'Поверни СТРОГО JSON без markdown і пояснень: {"title":"","assigned_on":"","deadline":""}.';

  let resp: Response;
  try {
    const headers: Record<string, string> = {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    if (ANTHROPIC_WORKSPACE_ID) headers["anthropic-workspace-id"] = ANTHROPIC_WORKSPACE_ID;
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });
  } catch (e) {
    return json({ error: "запит до AI не пройшов: " + (e as Error).message }, 502);
  }

  const j = await resp.json();
  if (!resp.ok) return json({ error: j.error?.message || "anthropic error" }, 502);

  const text = j.content?.[0]?.text || "";
  const m = text.match(/\{[\s\S]*\}/);
  let out: { title: string; assigned_on: string; deadline: string } = { title: "", assigned_on: "", deadline: "" };
  try {
    const p = JSON.parse(m ? m[0] : text);
    const day = (v: unknown) => {
      const s = String(v ?? "").trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
    };
    out = { title: String(p.title ?? "").trim().slice(0, 200), assigned_on: day(p.assigned_on), deadline: day(p.deadline) };
  } catch { /* ignore */ }
  return json(out);
});
