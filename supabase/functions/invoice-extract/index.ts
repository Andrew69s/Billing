// =========================================================
//  Dnipro-M — Edge Function «invoice-extract»
//  Розпізнає скріншот рахунку з 1С через Claude Vision.
//  Секрет: ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
//
//  Деплой: supabase functions deploy invoice-extract --project-ref taiqrxlehnfkuvokgwqu
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

  if (!ANTHROPIC_KEY) return json({ error: "AI не налаштовано (немає ключа)" }, 501);

  let image = "";
  try { image = (await req.json()).image || ""; } catch { return json({ error: "bad json" }, 400); }
  if (!image.startsWith("data:image/")) return json({ error: "bad image" }, 400);

  const [meta, b64] = image.split(",");
  const mediaType = meta.match(/data:(image\/[a-z]+)/)?.[1] || "image/jpeg";

  const prompt =
    "Це скріншот рахунку на оплату (1С, українською). Рахунок виставив магазин мережі «Дніпро-М» " +
    "клієнту для безготівкової оплати. Витягни:\n" +
    "1) buyer — ПОКУПЦЯ з рядка «Покупець»/«Покупатель» (це клієнт, кому виставлено рахунок); " +
    "лише назву організації/ФОП, без ЄДРПОУ, адреси, банківських реквізитів;\n" +
    "2) issuer — ПОСТАЧАЛЬНИКА/ПРОДАВЦЯ з рядка «Постачальник»/«Продавець» (це юр-особа Дніпро-М — " +
    "напр. «ТОВ Будвік» або «ФОП Прізвище»); лише назву, без ЄДРПОУ й реквізитів;\n" +
    "3) amount — загальну суму до сплати (тільки число);\n" +
    "4) invoice_no — номер рахунку;\n" +
    "5) vat — true, якщо в рахунку фігурує ПДВ («в т.ч. ПДВ», «ПДВ 20%», «з ПДВ»), інакше false;\n" +
    "6) items — позиції таблиці: масив {code, name, qty} (код/артикул, найменування, кількість), максимум 20.\n" +
    'Поверни СТРОГО JSON без пояснень і markdown: ' +
    '{"buyer":"","issuer":"","amount":0,"invoice_no":"","vat":false,"items":[]}. ' +
    "Якщо поле не видно — порожній рядок / 0 / false / [].";

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
        max_tokens: 1200,
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
  let out: any = { buyer: "", issuer: "", amount: 0, invoice_no: "", vat: false, items: [] };
  try { out = { ...out, ...JSON.parse(m ? m[0] : text) }; } catch { /* ignore */ }
  out.amount = Number(String(out.amount).replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
  out.buyer = String(out.buyer || "").trim();
  out.issuer = String(out.issuer || "").trim();
  out.invoice_no = String(out.invoice_no || "").trim();
  out.vat = !!out.vat;
  out.items = Array.isArray(out.items)
    ? out.items.slice(0, 20).map((it: any) => ({
        code: String(it?.code ?? "").trim(),
        name: String(it?.name ?? "").trim(),
        qty: String(it?.qty ?? "").trim(),
      })).filter((it: any) => it.name || it.code)
    : [];
  return json(out);
});
