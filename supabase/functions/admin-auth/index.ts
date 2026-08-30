// =========================================================
//  Dnipro-M — Edge Function «admin-auth»
//  Майстер-код: вхід у будь-який кабінет + скидання паролю.
//  Секрет: ADMIN_MASTER_CODE.
//  Деплой: supabase functions deploy admin-auth --project-ref taiqrxlehnfkuvokgwqu
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MASTER_CODE = Deno.env.get("ADMIN_MASTER_CODE") || "";
const ADMIN_KEY = "andriy";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function userForCabinet(svc: any, cabinetKey: string) {
  const { data: cm } = await svc.from("cab_map").select("user_id").eq("cabinet_key", cabinetKey).maybeSingle();
  if (!cm?.user_id) return null;
  const { data: u } = await svc.auth.admin.getUserById(cm.user_id);
  return u?.user || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const svc = createClient(SUPABASE_URL, SERVICE);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const op = body.op;
  const cabinetKey = String(body.cabinet_key || "");
  const codeOk = !!MASTER_CODE && String(body.code || "") === MASTER_CODE;

  // ---- вхід у кабінет за майстер-кодом ----
  if (op === "master-login") {
    if (!codeOk) return json({ error: "Невірний код" }, 403);
    const u = await userForCabinet(svc, cabinetKey);
    if (!u?.email) return json({ error: "Кабінет не знайдено" }, 404);
    const { data, error } = await svc.auth.admin.generateLink({ type: "magiclink", email: u.email });
    if (error || !data?.properties?.hashed_token) return json({ error: error?.message || "link error" }, 502);
    return json({ token_hash: data.properties.hashed_token, email: u.email });
  }

  // ---- скидання паролю ----
  if (op === "set-password") {
    const newPassword = String(body.new_password || "");
    if (newPassword.length < 6) return json({ error: "Пароль — не менше 6 символів" }, 400);

    let authorized = codeOk;
    if (!authorized) {
      // авторизований адмін (за JWT → cab_map)
      const authHeader = req.headers.get("Authorization") || "";
      const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
      const { data: ures } = await userClient.auth.getUser();
      if (ures?.user) {
        const { data: me } = await userClient.from("cab_map").select("cabinet_key,cabinet_type").maybeSingle();
        authorized = !!me && (me.cabinet_key === ADMIN_KEY || me.cabinet_type === "manager");
      }
    }
    if (!authorized) return json({ error: "Немає прав" }, 403);

    const u = await userForCabinet(svc, cabinetKey);
    if (!u?.id) return json({ error: "Кабінет не знайдено" }, 404);
    const { error } = await svc.auth.admin.updateUserById(u.id, { password: newPassword });
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  return json({ error: "unknown op" }, 400);
});
