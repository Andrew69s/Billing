/* =========================================================
   ОРГ-СТРУКТУРА + ДОСТУПИ
   Ієрархія 12 кабінетів:
     Керівник (Кавецький) ─┬─ ТМ Шах Андрій ──── 3 салони майстерності
                           ├─ ТМ Паньків Іван ── 5 салонів майстерності
                           └─ Бухгалтер Юлія (зведення / виплати)
   Дані зберігаються локально (localStorage) — див. src/lib/storage.js
========================================================= */

export const MANAGER = {
  key: "manager",
  name: "Кавецький Віктор Васильович",
  role: "Керівник",
};

export const ACCOUNTANT = {
  key: "accountant",
  name: "Бухгалтер Юлія",
  role: "Зведення · виплати",
};

/* Блок «Офіс» — бухгалтер + офісні співробітники.
   Мар'яна / Ольга: вміст кабінетів визначимо згодом. */
export const OFFICE = [
  ACCOUNTANT,
  { key: "maryana", name: "Мар'яна", role: "Офіс" },
  { key: "olha", name: "Ольга", role: "Офіс" },
];

export const TMS = [
  { key: "andriy", name: "Шах Андрій", role: "Територіальний менеджер" },
  { key: "ivan", name: "Паньків Іван", role: "Територіальний менеджер" },
];

/* area: "місто" → норма 10 вихідних; "область" → норма 9 вихідних */
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
export const salonsOfTm = (tmKey) => SALONS.filter((s) => s.tm === tmKey);
export const tmByKey = (k) => TMS.find((t) => t.key === k);

/* Кабінети, які бачить керівник у зведенні (усі ТМ + усі салони) */
export const ALL_SUBMITTERS = [
  ...TMS.map((t) => ({ kind: "tm", key: t.key, name: t.name })),
  ...SALONS.map((s) => ({ kind: "sm", key: s.key, name: salonLabel(s), tm: s.tm })),
];

/* =========================================================
   ДОСТУПИ  (логін + пароль)
   Логіни салонів = «місто + вулиця». Паролі — тимчасові прості коди,
   змінюватимемо згодом (зберігаються в localStorage після першого запуску).
========================================================= */
export const CREDENTIAL_DEFAULTS = {
  manager:    { login: "kavetskyy", password: "4739" },
  accountant: { login: "yulia",     password: "2025" },
  maryana:    { login: "maryana",   password: "3001" },
  olha:       { login: "olha",      password: "3002" },
  andriy:     { login: "shah",      password: "5417" },
  ivan:       { login: "pankiv",    password: "8206" },

  "gorodok-peremyshlska": { login: "gorodok-peremyshlska", password: "1101" },
  "mostyska-rynok":       { login: "mostyska-rynok",       password: "1102" },
  "turka-sheptytskoho":   { login: "turka-sheptytskoho",   password: "1103" },
  "lviv-lypynskoho":      { login: "lviv-lypynskoho",      password: "1201" },
  "lviv-shyretska":       { login: "lviv-shyretska",       password: "1202" },
  "lviv-shevchenka":      { login: "lviv-shevchenka",      password: "1203" },
  "lviv-kavaleridze":     { login: "lviv-kavaleridze",     password: "1204" },
  "lviv-vashyngtona":     { login: "lviv-vashyngtona",     password: "1205" },
};

const CRED_KEY = (cabKey) => `cred:${cabKey}`;

export async function ensureCredentialsSeeded() {
  for (const key of Object.keys(CREDENTIAL_DEFAULTS)) {
    try {
      await window.storage.get(CRED_KEY(key));
    } catch {
      try {
        await window.storage.set(CRED_KEY(key), JSON.stringify(CREDENTIAL_DEFAULTS[key]));
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export async function getCredential(cabKey) {
  try {
    const r = await window.storage.get(CRED_KEY(cabKey));
    return { ...CREDENTIAL_DEFAULTS[cabKey], ...JSON.parse(r.value) };
  } catch {
    return CREDENTIAL_DEFAULTS[cabKey] || null;
  }
}

export async function verifyLogin(cabKey, login, password) {
  const cred = await getCredential(cabKey);
  if (!cred) return false;
  return (
    String(login).trim().toLowerCase() === String(cred.login).toLowerCase() &&
    String(password) === String(cred.password)
  );
}

export async function setCredential(cabKey, next) {
  const cur = await getCredential(cabKey);
  await window.storage.set(CRED_KEY(cabKey), JSON.stringify({ ...cur, ...next }));
}

/* =========================================================
   ВІДНОВЛЕННЯ ПАРОЛЮ
   Адміністратор — Шах Андрій. Коли хтось запитує відновлення, генерується
   код, який зʼявляється в кабінеті адміністратора. Адмін передає код особі,
   вона вводить його разом із новим паролем.
   Сам адмін відновлює свій пароль єдиним майстер-кодом.
========================================================= */
export const ADMIN_KEY = "andriy";
export const ADMIN_NAME = "Шах Андрій";
const ADMIN_MASTER_CODE = "100%23022002100%";
const REC_KEY = (k) => `recovery:${k}`;

export const isAdminCab = (cabKey) => cabKey === ADMIN_KEY;

export async function requestRecovery(cabKey) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await window.storage.set(REC_KEY(cabKey), JSON.stringify({ code, at: new Date().toISOString() }));
  return code;
}

export async function getRecovery(cabKey) {
  try {
    const r = await window.storage.get(REC_KEY(cabKey));
    return JSON.parse(r.value);
  } catch { return null; }
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
    if (String(code) !== ADMIN_MASTER_CODE) return { ok: false, error: "Невірний майстер-код відновлення" };
  } else {
    const rec = await getRecovery(cabKey);
    if (!rec || String(code).trim() !== String(rec.code)) return { ok: false, error: "Невірний код відновлення" };
  }
  await setCredential(cabKey, { password: pass });
  await clearRecovery(cabKey);
  return { ok: true };
}
