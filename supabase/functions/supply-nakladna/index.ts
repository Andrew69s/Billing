// =========================================================
//  Dnipro-M — Edge Function «supply-nakladna»
//  Розпізнає фото видаткової накладної на господарські товари через
//  Claude Vision. Повертає позиції {name, qty, unit_price}.
//  Використовується ЛИШЕ для прийомки на Основний склад (Липинського).
//  Секрет: ANTHROPIC_API_KEY.
//  Деплой: supabase functions deploy supply-nakladna --project-ref taiqrxlehnfkuvokgwqu
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
  // лише склад-менеджери (Липинського / Оля / керівник)
  const { data: mgr } = await userClient.rpc("supply_wh_manage");
  if (!mgr) return json({ error: "forbidden" }, 403);

  if (!ANTHROPIC_KEY) return json({ error: "AI не налаштовано (немає ключа)" }, 501);

  let image = "";
  let names: string[] = [];
  try {
    const b = await req.json();
    image = b.image || "";
    names = Array.isArray(b.names) ? b.names.slice(0, 200).map((n: any) => String(n)) : [];
  } catch { return json({ error: "bad json" }, 400); }
  if (!image.startsWith("data:image/")) return json({ error: "bad image" }, 400);

  const [meta, b64] = image.split(",");
  const mediaType = meta.match(/data:(image\/[a-z]+)/)?.[1] || "image/jpeg";

  const catalog = names.length
    ? "\nДовідник наших позицій (по можливості вибирай назву звідси дослівно):\n- " + names.join("\n- ") + "\n"
    : "";

  const prompt =
    "Це фото або скан видаткової накладної / рахунку на господарські товари (українською або російською). " +
    "Витягни ТІЛЬКИ позиції товарів з таблиці. Для кожної: \n" +
    "• name — найменування товару (без коду, артикула, одиниць виміру в дужках якщо є — можна лишити);\n" +
    "• qty — кількість (тільки число);\n" +
    "• unit_price — ціна за одиницю без ПДВ (тільки число; якщо у накладній лише сума рядка — поділи на кількість; якщо не видно — 0).\n" +
    catalog +
    'Поверни СТРОГО JSON без пояснень і markdown: {"items":[{"name":"","qty":0,"unit_price":0}]}. Максимум 40 позицій. ' +
    "Рядки «Разом», «ПДВ», «Всього», підсумки — ІГНОРУЙ.";

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
        max_tokens: 2000,
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
  let out: any = { items: [] };
  try { out = { ...out, ...JSON.parse(m ? m[0] : text) }; } catch { /* ignore */ }
  const num = (v: any) => Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
  out.items = Array.isArray(out.items)
    ? out.items.slice(0, 40)
        .map((it: any) => ({ name: String(it?.name ?? "").trim(), qty: num(it?.qty), unit_price: num(it?.unit_price) }))
        .filter((it: any) => it.name && it.qty > 0)
    : [];
  return json(out);
});
