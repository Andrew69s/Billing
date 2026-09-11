/* Читання «сирих» погодинних чек-пойнтів дня напряму з зовнішнього
   планера (той самий Supabase-проєкт, з якого тягне supabase/functions/
   planner-sync — ключ публічний, він у бандлі самого планера).
   Використовується для «провалу» в денний звіт СМ (як у планері), а не
   в наш власний TerritoryModule. */
const PLANNER_URL = "https://nkyopctxbzhodrsiubqr.supabase.co";
const PLANNER_KEY = "sb_publishable_b7J7GEJhz5gb4yNsQ78UAw_Zbj4QoN8";
const PLANNER_TERRITORY = "Боровик";

const STORE_MAP = {
  "Городок ФФМ вул. Перемишльська,": "gorodok-peremyshlska",
  "Мостиська пл. Ринок, 10-А": "mostyska-rynok",
  "Турка ФФМ вул. Шептицького, 3Б": "turka-sheptytskoho",
  "Львів ФФМ вул. Липинського, 36": "lviv-lypynskoho",
  "Львів ФФМ вул. Щирецька, 36А": "lviv-shyretska",
  "Львів ФФМ вул. Шевченка, 19": "lviv-shevchenka",
  "Львів ФФМ вул. Дж. Вашингтона": "lviv-vashyngtona",
  "Львів, ФФМ вул. Кавалерідзе": "lviv-kavaleridze",
};
const STORE_NAME_BY_SALON = Object.fromEntries(Object.entries(STORE_MAP).map(([n, k]) => [k, n]));
export const CHECKPOINTS = ["12", "15", "18", "20"];

export async function fetchPlannerDay(salonKey, dateISO) {
  const storeName = STORE_NAME_BY_SALON[salonKey];
  if (!storeName) throw new Error("Для цього салону немає точки в планері");
  const [y, m, d] = dateISO.split("-").map(Number);
  const key = `entries:${PLANNER_TERRITORY}:${y}-${m}`;
  const url = `${PLANNER_URL}/rest/v1/kv?select=value&key=eq.${encodeURIComponent(key)}`;
  let r;
  try { r = await fetch(url, { headers: { apikey: PLANNER_KEY, Authorization: `Bearer ${PLANNER_KEY}` } }); }
  catch { throw new Error("Немає звʼязку з планером"); }
  if (!r.ok) throw new Error("Планер не відповів");
  const arr = await r.json();
  let value = arr?.[0]?.value ?? null;
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { value = null; } }
  const dv = value?.[storeName]?.[String(d)];
  if (!dv) return null;

  const checkpoints = CHECKPOINTS.map((cp) => ({
    cp,
    assort: Number(dv[`assort_${cp}`]) || 0,
    ez: Number(dv[`ez_${cp}`]) || 0,
    cheky: Number(dv[`cheky_${cp}`]) || 0,
    dzvinky: Number(dv[`dzvinky_${cp}`]) || 0,
  }));
  const focusFactList = Array.isArray(dv.focusFactList) ? dv.focusFactList.filter((f) => f?.text) : [];

  return {
    checkpoints,
    bn: Number(dv.bn) || 0,
    liqpay: Number(dv.liqpay) || 0,
    installment: Number(dv.installment) || 0,
    retOS: Number(dv.retOS) || 0,
    retEZ: Number(dv.retEZ) || 0,
    note: dv.note || "",
    reason: dv.reason || "",
    smComment: dv.smComment || "",
    focusFactList,
  };
}
