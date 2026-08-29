/* =========================================================
   ОРГ-СТРУКТУРА + ДОСТУПИ + АДМІНІСТРУВАННЯ
   Дані та авторизація — Supabase (див. src/lib/supabase.js, supabase/schema.sql)
========================================================= */
import { supabase } from "./lib/supabase.js";

export const MANAGER = { key: "manager", name: "Кавецький Віктор Васильович", role: "Керівник" };
export const ACCOUNTANT = { key: "accountant", name: "Бухгалтер Юлія", role: "Зведення · виплати" };

export const OFFICE = [
  ACCOUNTANT,
  { key: "maryana", name: "Мар'яна", role: "Офіс" },
  { key: "olha", name: "Ольга", role: "Офіс" },
];

export const TMS = [
  { key: "andriy", name: "Шах Андрій", role: "Територіальний менеджер" },
  { key: "ivan", name: "Паньків Іван", role: "Територіальний менеджер" },
];

/* area: "місто" → норма 10 вихідних; "область" → норма 9 вихідних.
   Поле tm — БАЗОВЕ підпорядкування; фактичне залежить від перепризначень (див. нижче). */
export const SALONS = [
  { key: "gorodok-peremyshlska", tm: "andriy", city: "Городок",  addr: "вул. Перемишльська, 3-А", area: "область" },
  { key: "mostyska-rynok",       tm: "andriy", city: "Мостиська", addr: "пл. Ринок, 10-А",        area: "область" },
  { key: "turka-sheptytskoho",   tm: "andriy", city: "Турка",    addr: "вул. Шептицького, 3-Б",  area: "область" },
  { key: "lviv-lypynskoho",      tm: "ivan",   city: "Львів",    addr: "вул. Липинського, 36",      area: "місто" },
  { key: "lviv-shyretska",       tm: "ivan",   city: "Львів",    addr: "вул. Щирецька, 36-А",       area: "місто" },
  { key: "lviv-shevchenka",      tm: "ivan",   city: "Львів",    addr: "вул. Шевченка, 19",         area: "місто" },
  { key: "lviv-kavaleridze",     tm: "ivan",   city: "Львів",    addr: "вул. Івана Кавалерідзе, 1", area: "місто" },
  { key: "lviv-vashyngtona",     tm: "ivan",   city: "Львів",    addr: "вул. Джорджа Вашингтона, 1", area: "місто" },
];

export const salonLabel = (s) => `${s.city}, ${s.addr}`;
export const salonByKey = (k) => SALONS.find((s) => s.key === k);
export const tmByKey = (k) => TMS.find((t) => t.key === k);

const nowYm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/* =========================================================
   ПЕРЕПРИЗНАЧЕННЯ МАГАЗИНІВ МІЖ ТМ
   Запис: { id, salonKey, toTm, fromYm }.  Діє від місяця fromYm і далі.
   Кеш вантажиться один раз при старті (salonsOfTm — синхронна).
========================================================= */
const REASSIGN_KEY = "reassign:list";
let _reassign = [];

export async function loadReassignCache() {
  _reassign = await listReassignments();
  return _reassign;
}
export async function listReassignments() {
  try { return JSON.parse((await window.storage.get(REASSIGN_KEY)).value) || []; }
  catch { return []; }
}
export async function addReassignment({ salonKey, toTm, fromYm }) {
  const list = await listReassignments();
  list.push({ id: Date.now(), salonKey, toTm, fromYm, at: new Date().toISOString() });
  await window.storage.set(REASSIGN_KEY, JSON.stringify(list));
  await loadReassignCache();
  await logAction("reassign", { salonKey, toTm, fromYm });
}
export async function removeReassignment(id) {
  const list = (await listReassignments()).filter((x) => x.id !== id);
  await window.storage.set(REASSIGN_KEY, JSON.stringify(list));
  await loadReassignCache();
}

/* Який ТМ володіє магазином у місяці ym (за замовч. — поточний) */
export function salonTmOn(salonKey, ym) {
  const base = salonByKey(salonKey);
  if (!base) return null;
  const m = ym || nowYm();
  const applicable = _reassign
    .filter((r) => r.salonKey === salonKey && r.fromYm <= m)
    .sort((a, b) => (a.fromYm < b.fromYm ? -1 : a.fromYm > b.fromYm ? 1 : a.id - b.id));
  return applicable.length ? applicable[applicable.length - 1].toTm : base.tm;
}
export const salonsOfTm = (tmKey, ym) => SALONS.filter((s) => salonTmOn(s.key, ym) === tmKey);

/* =========================================================
   ДОСТУПИ — Supabase Auth
   Кожен кабінет = один користувач (email <login>@dnipro-m.local).
   Правила доступу до даних — RLS у базі (supabase/schema.sql).
========================================================= */
const EMAIL_DOMAIN = "dnipro-m.local";
export const LOGIN_BY_CAB = {
  manager: "kavetskyy", accountant: "yulia", maryana: "maryana", olha: "olha",
  andriy: "shah", ivan: "pankiv",
  "gorodok-peremyshlska": "gorodok-peremyshlska", "mostyska-rynok": "mostyska-rynok",
  "turka-sheptytskoho": "turka-sheptytskoho", "lviv-lypynskoho": "lviv-lypynskoho",
  "lviv-shyretska": "lviv-shyretska", "lviv-shevchenka": "lviv-shevchenka",
  "lviv-kavaleridze": "lviv-kavaleridze", "lviv-vashyngtona": "lviv-vashyngtona",
};
export const ALL_CAB_KEYS = Object.keys(LOGIN_BY_CAB);
export const getLogin = (cabKey) => LOGIN_BY_CAB[cabKey] || "";

export const ADMIN_KEY = "andriy";
export const ADMIN_NAME = "Шах Андрій";
export const isAdminCab = (cabKey) => cabKey === ADMIN_KEY;

/* вхід: логін + пароль → сесія Supabase. Логін має відповідати кабінету. */
export async function verifyLogin(cabKey, login, password) {
  const email = `${String(login).trim().toLowerCase()}@${EMAIL_DOMAIN}`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return false;
  if ((data.user.user_metadata || {}).cabinet_key !== cabKey) {
    await supabase.auth.signOut();
    return false;
  }
  await loadReassignCache();
  return true;
}

/* поточний кабінет із активної сесії Supabase (або null) */
export async function currentCabinet() {
  const { data } = await supabase.auth.getSession();
  const u = data?.session?.user;
  const m = u?.user_metadata || {};
  if (!m.cabinet_key) return null;
  return { key: m.cabinet_key, type: m.cabinet_type, tmKey: m.tm_key || null, label: cabName(m.cabinet_key) };
}
export async function signOutCab() { await supabase.auth.signOut(); }
export function onAuthChange(cb) { return supabase.auth.onAuthStateChange((_e, s) => cb(s)); }
export async function initAfterAuth() { await loadReassignCache(); }

/* самостійна зміна свого паролю (коли залогінений) */
export async function changeOwnPassword(newPassword) {
  if (String(newPassword || "").length < 6) return { ok: false, error: "Пароль — не менше 6 символів" };
  const { error } = await supabase.auth.updateUser({ password: String(newPassword) });
  if (!error) await logAction("password_changed", {});
  return error ? { ok: false, error: error.message } : { ok: true };
}

/* =========================================================
   ВІДНОВЛЕННЯ / АДМІН-СКИДАННЯ ПАРОЛЮ
   Тимчасово: потребує серверної функції (Edge Function). Далі підключимо.
========================================================= */
const REC_KEY = (k) => `recovery:${k}`;
export async function requestRecovery(cabKey) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await window.storage.set(REC_KEY(cabKey), JSON.stringify({ code, at: new Date().toISOString() }));
  await logAction("recovery_request", { cabKey });
  return code;
}
export async function getRecovery(cabKey) {
  try { return JSON.parse((await window.storage.get(REC_KEY(cabKey))).value); } catch { return null; }
}
export async function clearRecovery(cabKey) {
  try { await window.storage.delete(REC_KEY(cabKey)); } catch (e) { console.error(e); }
}
export async function listRecoveryRequests() {
  try {
    const r = await window.storage.list("recovery:");
    const out = [];
    for (const key of r?.keys || []) {
      const cabKey = key.replace("recovery:", "");
      const rec = await getRecovery(cabKey);
      if (rec) out.push({ cabKey, ...rec });
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  } catch { return []; }
}
const NEEDS_SERVER = { ok: false, error: "Зміну паролю переносимо на сервер — тимчасово недоступно. Зверніться до адміністратора." };
export async function confirmRecovery() { return NEEDS_SERVER; }
export async function adminSetPassword() { return NEEDS_SERVER; }

/* =========================================================
   ПРАВА КОРИСТУВАЧІВ  (надає адміністратор)
========================================================= */
export const CAPABILITIES = [
  { key: "view_consolidation", label: "Перегляд зведення ЗП (усі кабінети)" },
  { key: "manage_payments", label: "Позначати статус виплат" },
  { key: "manage_tasks", label: "Керування задачами" },
  { key: "manage_docs", label: "Керування документами й стандартами" },
  { key: "manage_schedule", label: "Керування графіком змін" },
  { key: "full_admin", label: "Повний доступ до адміністрування" },
];
export async function getCapabilities(cabKey) {
  try { return JSON.parse((await window.storage.get(`caps:${cabKey}`)).value) || []; }
  catch { return []; }
}
export async function setCapabilities(cabKey, caps) {
  await window.storage.set(`caps:${cabKey}`, JSON.stringify(caps));
  await logAction("caps", { cabKey, caps });
}

/* =========================================================
   ЖУРНАЛ ДІЙ
========================================================= */
const LOG_KEY = "auditlog";
export async function logAction(action, detail) {
  try {
    let list = [];
    try { list = JSON.parse((await window.storage.get(LOG_KEY)).value) || []; } catch { list = []; }
    list.unshift({ action, detail: detail || {}, at: new Date().toISOString() });
    await window.storage.set(LOG_KEY, JSON.stringify(list.slice(0, 200)));
  } catch (e) { console.error(e); }
}
export async function listLog() {
  try { return JSON.parse((await window.storage.get(LOG_KEY)).value) || []; }
  catch { return []; }
}

export function cabName(key) {
  if (key === "manager") return MANAGER.name;
  const o = OFFICE.find((x) => x.key === key);
  if (o) return o.name;
  const t = tmByKey(key);
  if (t) return `ТМ ${t.name}`;
  const s = salonByKey(key);
  if (s) return salonLabel(s);
  return key;
}
