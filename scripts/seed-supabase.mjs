/* =========================================================
   Одноразовий сід: створює 14 користувачів Supabase Auth
   (по одному на кабінет) + рядки в public.cab_map.
   Запуск:
     SUPABASE_URL=https://xxxxx.supabase.co \
     SUPABASE_SERVICE_ROLE=<service_role ключ> \
     node scripts/seed-supabase.mjs
   service_role ключ: Supabase → Project Settings → API → service_role (secret).
   НЕ комітити його. Після сіду можна забути.
========================================================= */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !service) {
  console.error("Потрібні env: SUPABASE_URL і SUPABASE_SERVICE_ROLE");
  process.exit(1);
}
const sb = createClient(url, service, { auth: { persistSession: false } });
const EMAIL = (login) => `${login}@dnipro-m.local`;

const CABS = [
  { key: "manager",    login: "kavetskyy", type: "manager",    tm: null,     pw: "4739" },
  { key: "accountant", login: "yulia",     type: "accountant", tm: null,     pw: "2025" },
  { key: "maryana",    login: "maryana",   type: "office",     tm: null,     pw: "3001" },
  { key: "olha",       login: "olha",      type: "office",     tm: null,     pw: "3002" },
  { key: "andriy",     login: "shah",      type: "tm",         tm: "andriy", pw: "5417" },
  { key: "ivan",       login: "pankiv",    type: "tm",         tm: "ivan",   pw: "8206" },
  { key: "gorodok-peremyshlska", login: "gorodok-peremyshlska", type: "sm", tm: "andriy", pw: "1101" },
  { key: "mostyska-rynok",       login: "mostyska-rynok",       type: "sm", tm: "andriy", pw: "1102" },
  { key: "turka-sheptytskoho",   login: "turka-sheptytskoho",   type: "sm", tm: "andriy", pw: "1103" },
  { key: "lviv-lypynskoho",      login: "lviv-lypynskoho",      type: "sm", tm: "ivan",   pw: "1201" },
  { key: "lviv-shyretska",       login: "lviv-shyretska",       type: "sm", tm: "ivan",   pw: "1202" },
  { key: "lviv-shevchenka",      login: "lviv-shevchenka",      type: "sm", tm: "ivan",   pw: "1203" },
  { key: "lviv-kavaleridze",     login: "lviv-kavaleridze",     type: "sm", tm: "ivan",   pw: "1204" },
  { key: "lviv-vashyngtona",     login: "lviv-vashyngtona",     type: "sm", tm: "ivan",   pw: "1205" },
];

const { data: existing } = await sb.auth.admin.listUsers({ perPage: 200 });
const byEmail = new Map((existing?.users || []).map((u) => [u.email, u.id]));

for (const c of CABS) {
  let userId = byEmail.get(EMAIL(c.login));
  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: EMAIL(c.login),
      password: c.pw,
      email_confirm: true,
      user_metadata: { cabinet_key: c.key, cabinet_type: c.type, tm_key: c.tm, login: c.login },
    });
    if (error) { console.error(c.key, "createUser:", error.message); continue; }
    userId = data.user.id;
  }
  const { error: e2 } = await sb.from("cab_map").upsert(
    { user_id: userId, cabinet_key: c.key, cabinet_type: c.type, tm_key: c.tm },
    { onConflict: "user_id" },
  );
  console.log(c.key.padEnd(24), e2 ? "ERR " + e2.message : "ok");
}
console.log("\nГотово.");
