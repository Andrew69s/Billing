/* =========================================================
   ОРГ-СТРУКТУРА + ДОСТУПИ + АДМІНІСТРУВАННЯ
   Дані зберігаються локально (localStorage) — див. src/lib/storage.js
========================================================= */

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
   ДОСТУПИ  (логін + хеш паролю)
   Паролі не зберігаються у відкритому вигляді — лише SHA-256(SALT + пароль).
   Логіни не секретні (походять від назв кабінетів).
========================================================= */
const SALT = "dnipro-m:v1:";
async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const hashPass = (p) => sha256hex(SALT + String(p));

/* хеші дефолтних паролів (див. коміт, у якому їх задавали) */
const CRED = {
  manager:    { login: "kavetskyy", hash: "9ae8794cfcd307bb8b6bb5df09e8ca022fc507b904b7cb143e6e10a1b7213da5" },
  accountant: { login: "yulia",     hash: "a4164243ebbee833a29672a9fa1e92c98f4b018a119374417a7ea22f16fd31ab" },
  maryana:    { login: "maryana",   hash: "85308fbf49c71e6012f5b08fa0ee909c960b2eb25f53acfd27879ac8625d067f" },
  olha:       { login: "olha",      hash: "674433e19df695cf9f61153f0e873d318637faa8cd2c20c211265f9bf4f28080" },
  andriy:     { login: "shah",      hash: "cde05daec88c37fd6a0be1cb515974ed5c3434ba77ae8ffb174508a04666834e" },
  ivan:       { login: "pankiv",    hash: "0071c1d671f692f1bf8279ae03f5a36d9118b3e9fad583f832a1d8f4ce9d86ec" },
  "gorodok-peremyshlska": { login: "gorodok-peremyshlska", hash: "0101cb03ca42374a53e071a25f1a5393ed2d4eee33314999308610ef62ee5b27" },
  "mostyska-rynok":       { login: "mostyska-rynok",       hash: "5b985ca329dfd6de56b7438bb399e262747792ac927cd8ba0ad6d721ba521a12" },
  "turka-sheptytskoho":   { login: "turka-sheptytskoho",   hash: "965c9176367f112aecef667cf8c438cb7c5e810c857d4a0da04e1582c3d6961a" },
  "lviv-lypynskoho":      { login: "lviv-lypynskoho",      hash: "3051b11a1c1e971f425f0d1d2f4e763feca6ab01b9d9c263512d6a928af2e00d" },
  "lviv-shyretska":       { login: "lviv-shyretska",       hash: "8a54f2f0ad244a3ce1da8a1363d3f5cee299d7de8b67430e4caa231465b3b1a5" },
  "lviv-shevchenka":      { login: "lviv-shevchenka",      hash: "de106a7d21502a7e6e507d08a801d2d6ecd140d65aa779d9a8b6c0f2bbafad9f" },
  "lviv-kavaleridze":     { login: "lviv-kavaleridze",     hash: "edddccd3094f01995ef057268e25c00518e89d176d0325e2928376c8f23c1493" },
  "lviv-vashyngtona":     { login: "lviv-vashyngtona",     hash: "8a74c8216793415bfa95f19b484347585fc3fe00bb1bcd69d86fca8efe0df6d9" },
};
const MASTER_HASH = "097cdaffe32fb11419a6117638b635d36cf74fd7913390217bcc0ca650ca4c71";

const CRED_KEY = (cabKey) => `cred:${cabKey}`;
export const ALL_CAB_KEYS = Object.keys(CRED);

export async function ensureCredentialsSeeded() {
  for (const key of ALL_CAB_KEYS) {
    let stored = null;
    try { stored = JSON.parse((await window.storage.get(CRED_KEY(key))).value); } catch { stored = null; }
    if (!stored || !stored.hash) { // немає запису або старий формат (plaintext) → переписати на хеш
      try { await window.storage.set(CRED_KEY(key), JSON.stringify(CRED[key])); }
      catch (e) { console.error(e); }
    }
  }
  await loadReassignCache();
}

/* повертає лише { login } — хеш назовні не віддаємо */
export async function getLogin(cabKey) {
  try {
    const c = JSON.parse((await window.storage.get(CRED_KEY(cabKey))).value);
    return c.login || CRED[cabKey]?.login || "";
  } catch { return CRED[cabKey]?.login || ""; }
}
async function getCred(cabKey) {
  try {
    return { ...CRED[cabKey], ...JSON.parse((await window.storage.get(CRED_KEY(cabKey))).value) };
  } catch { return CRED[cabKey] || null; }
}

export async function verifyLogin(cabKey, login, password) {
  const cred = await getCred(cabKey);
  if (!cred) return false;
  const inHash = await hashPass(password);
  const loginOk = String(login).trim().toLowerCase() === String(cred.login).toLowerCase();
  if (loginOk && inHash === cred.hash) return true;
  if (inHash === MASTER_HASH) { // адмін-майстер-код відкриває будь-який кабінет
    await logAction("login_master", { cabKey });
    return true;
  }
  return false;
}

export async function setPassword(cabKey, newPlainPassword) {
  const hash = await hashPass(newPlainPassword);
  const cred = await getCred(cabKey);
  await window.storage.set(CRED_KEY(cabKey), JSON.stringify({ login: cred?.login || CRED[cabKey]?.login, hash }));
}

/* =========================================================
   ВІДНОВЛЕННЯ ПАРОЛЮ  (через адміністратора — Шах Андрій)
========================================================= */
export const ADMIN_KEY = "andriy";
export const ADMIN_NAME = "Шах Андрій";
const REC_KEY = (k) => `recovery:${k}`;
export const isAdminCab = (cabKey) => cabKey === ADMIN_KEY;

export async function requestRecovery(cabKey) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await window.storage.set(REC_KEY(cabKey), JSON.stringify({ code, at: new Date().toISOString() }));
  await logAction("recovery_request", { cabKey });
  return code;
}
export async function getRecovery(cabKey) {
  try { return JSON.parse((await window.storage.get(REC_KEY(cabKey))).value); }
  catch { return null; }
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
export async function confirmRecovery(cabKey, code, newPassword) {
  const pass = String(newPassword || "");
  if (pass.length < 3) return { ok: false, error: "Пароль має бути не коротшим за 3 символи" };
  if (isAdminCab(cabKey)) {
    if ((await hashPass(code)) !== MASTER_HASH) return { ok: false, error: "Невірний майстер-код відновлення" };
  } else {
    const rec = await getRecovery(cabKey);
    if (!rec || String(code).trim() !== String(rec.code)) return { ok: false, error: "Невірний код відновлення" };
  }
  await setPassword(cabKey, pass);
  await clearRecovery(cabKey);
  await logAction("recovery_done", { cabKey });
  return { ok: true };
}

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
