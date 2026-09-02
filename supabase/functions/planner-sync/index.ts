// =========================================================
//  planner-sync — тягне денні показники салонів з зовнішнього планера
//  (Supabase проєкт nkyopctxbzhodrsiubqr, таблиця kv) у нашу
//  public.territory_metrics. Пише лише поле planner; ручні корективи
//  (manual) не чіпає.
//
//  Виклик: POST { months?: ["YYYY-MM", ...] }  (типово — поточний місяць)
//  Авторизація: будь-який валідний ключ проєкту (anon достатньо) —
//  функція пише лише публічні дані планера через RPC tmet_apply_planner.
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// зовнішній планер (ключ публічний — він у бандлі планера)
const PLANNER_URL = "https://nkyopctxbzhodrsiubqr.supabase.co";
const PLANNER_KEY = "sb_publishable_b7J7GEJhz5gb4yNsQ78UAw_Zbj4QoN8";
const PLANNER_TERRITORY = "Боровик";

// планерна назва точки -> наш salon_key
const STORE_MAP: Record<string, string> = {
  "Городок ФФМ вул. Перемишльська,": "gorodok-peremyshlska",
  "Мостиська пл. Ринок, 10-А": "mostyska-rynok",
  "Турка ФФМ вул. Шептицького, 3Б": "turka-sheptytskoho",
  "Львів ФФМ вул. Липинського, 36": "lviv-lypynskoho",
  "Львів ФФМ вул. Щирецька, 36А": "lviv-shyretska",
  "Львів ФФМ вул. Шевченка, 19": "lviv-shevchenka",
  "Львів ФФМ вул. Дж. Вашингтона": "lviv-vashyngtona",
  "Львів, ФФМ вул. Кавалерідзе": "lviv-kavaleridze",
};

// базові плани (fallback, якщо в plans:Боровик немає точки)
const BASE_PLAN: Record<string, any> = {
  "gorodok-peremyshlska": { assort: 1400000, ez: 112000, cheky: 630, bn: 400000, dzvinky: 1000 },
  "mostyska-rynok": { assort: 900000, ez: 72000, cheky: 350, bn: 10000, dzvinky: 400 },
  "turka-sheptytskoho": { assort: 900000, ez: 72000, cheky: 444, bn: 100000, dzvinky: 500 },
  "lviv-lypynskoho": { assort: 1500000, ez: 120000, cheky: 660, bn: 200000, dzvinky: 750 },
  "lviv-shyretska": { assort: 1400000, ez: 112000, cheky: 608, bn: 100000, dzvinky: 810 },
  "lviv-shevchenka": { assort: 800000, ez: 64000, cheky: 400, bn: 100000, dzvinky: 400 },
  "lviv-vashyngtona": { assort: 900000, ez: 72000, cheky: 400, bn: 100000, dzvinky: 500 },
  "lviv-kavaleridze": { assort: 800000, ez: 64000, cheky: 345, bn: 30000, dzvinky: 500 },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const CP = ["12", "15", "18", "20"];
/* максимум по чекпойнтах дня. Планер бере останній заповнений (_lastCP),
   але накопичувальний підсумок не може падати — якщо пізніший чекпойнт
   введено меншим за раніший (помилка введення), беремо найбільший. */
function maxCP(v: any, m: string): number {
  let mx = 0;
  for (const cp of CP) { const x = Number(v[`${m}_${cp}`]) || 0; if (x > mx) mx = x; }
  return mx;
}
function dayFact(v: any) {
  // оборот = ТО осн.асортименту + LiqPay − повернення (як dayFactValue у планері)
  const assort = maxCP(v, "assort") + maxCP(v, "liqpay") - (Number(v.retOS) || 0);
  const ez = maxCP(v, "ez") - (Number(v.retEZ) || 0);
  const cheky = (v.cheky_20 != null || v.cheky_12 != null) ? maxCP(v, "cheky") : (Number(v.cheky) || 0);
  const dzvinky = (v.dzvinky_20 != null || v.dzvinky_12 != null) ? maxCP(v, "dzvinky") : (Number(v.dzvinky) || 0);
  return {
    assort: Math.round(assort),
    ez: Math.round(ez),
    cheky: Math.round(cheky),
    bn: Math.round(Number(v.bn) || 0),
    dzvinky: Math.round(dzvinky),
  };
}
const isEmpty = (f: ReturnType<typeof dayFact>) =>
  !f.assort && !f.ez && !f.cheky && !f.bn && !f.dzvinky;

// проста заслінка від частих викликів
let lastRun = 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!req.headers.get("Authorization") && !req.headers.get("apikey")) return json({ error: "no auth" }, 401);

  const now = Date.now();
  if (now - lastRun < 15000) return json({ error: "throttled", retryInMs: 15000 - (now - lastRun) }, 429);
  lastRun = now;

  let body: any = {};
  try { body = await req.json(); } catch { /* default */ }
  const months: string[] = Array.isArray(body.months) && body.months.length
    ? body.months.filter((m: string) => /^\d{4}-\d{2}$/.test(m))
    : [new Date().toISOString().slice(0, 7)];

  const svc = createClient(SUPABASE_URL, SERVICE_KEY);
  const perMonth: Record<string, number> = {};
  let total = 0;

  // --- плани салонів: plans:Боровик (override) з fallback на BASE_PLAN ---
  let plansApplied = 0;
  try {
    const pr = await fetch(
      `${PLANNER_URL}/rest/v1/kv?select=value&key=eq.${encodeURIComponent(`plans:${PLANNER_TERRITORY}`)}`,
      { headers: { apikey: PLANNER_KEY, Authorization: `Bearer ${PLANNER_KEY}` } },
    );
    let ov: any = (await pr.json())?.[0]?.value ?? {};
    if (typeof ov === "string") { try { ov = JSON.parse(ov); } catch { ov = {}; } }
    const nameToKey: Record<string, string> = STORE_MAP;
    const planRows = Object.keys(BASE_PLAN).map((salonKey) => {
      const storeName = Object.keys(nameToKey).find((n) => nameToKey[n] === salonKey);
      const o = storeName && ov[storeName] ? ov[storeName] : null;
      const src = o || BASE_PLAN[salonKey];
      return {
        salon_key: salonKey,
        plan: {
          assort: Math.round(Number(src.assort) || 0),
          ez: Math.round(Number(src.ez) || 0),
          cheky: Math.round(Number(src.cheky) || 0),
          bn: Math.round(Number(src.bn) || 0),
          dzvinky: Math.round(Number(src.dzvinky) || 0),
        },
      };
    });
    const { data: pn } = await svc.rpc("tplan_apply", { rows: planRows });
    plansApplied = Number(pn) || planRows.length;
  } catch { /* плани не критичні */ }

  for (const ym of months) {
    const [y, m] = ym.split("-").map(Number);
    const plannerKey = `entries:${PLANNER_TERRITORY}:${y}-${m}`; // місяць без нуля
    const url = `${PLANNER_URL}/rest/v1/kv?select=value&key=eq.${encodeURIComponent(plannerKey)}`;
    let value: any = null;
    try {
      const r = await fetch(url, { headers: { apikey: PLANNER_KEY, Authorization: `Bearer ${PLANNER_KEY}` } });
      if (r.ok) {
        const arr = await r.json();
        value = arr?.[0]?.value ?? null;
        if (typeof value === "string") { try { value = JSON.parse(value); } catch { /* */ } }
      }
    } catch {
      perMonth[ym] = -1;
      continue;
    }
    if (!value || typeof value !== "object") { perMonth[ym] = 0; continue; }

    const rows: any[] = [];
    for (const [storeName, days] of Object.entries<any>(value)) {
      const salonKey = STORE_MAP[storeName];
      if (!salonKey || !days || typeof days !== "object") continue;
      for (const [dayStr, dv] of Object.entries<any>(days)) {
        const day = Number(dayStr);
        if (!day || day < 1 || day > 31) continue;
        const f = dayFact(dv || {});
        if (isEmpty(f)) continue;
        rows.push({
          salon_key: salonKey,
          work_date: `${ym}-${String(day).padStart(2, "0")}`,
          planner: f,
        });
      }
    }
    if (rows.length) {
      const { error } = await svc.rpc("tmet_apply_planner", { rows });
      if (error) { perMonth[ym] = -2; continue; }
      perMonth[ym] = rows.length;
      total += rows.length;
    } else {
      perMonth[ym] = 0;
    }
  }

  // діагностика планів планера (тимчасово, для розбору «плани за червень»)
  let plansDump: any = null;
  if (body.dump) {
    const keys = [`plans:${PLANNER_TERRITORY}`, ...months.map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      return `dayplan:${PLANNER_TERRITORY}:${y}-${m}`;
    })];
    plansDump = {};
    for (const k of keys) {
      try {
        const r = await fetch(`${PLANNER_URL}/rest/v1/kv?select=value&key=eq.${encodeURIComponent(k)}`,
          { headers: { apikey: PLANNER_KEY, Authorization: `Bearer ${PLANNER_KEY}` } });
        const arr = await r.json();
        plansDump[k] = arr?.[0]?.value ?? null;
      } catch (e) { plansDump[k] = "err"; }
    }
  }

  return json({ ok: true, months, rows: total, perMonth, plansApplied, plansDump });
});
