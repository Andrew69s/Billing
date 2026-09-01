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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const CP = ["12", "15", "18", "20"];
function lastCP(v: any, m: string): number {
  for (let i = CP.length - 1; i >= 0; i--) {
    const x = v[`${m}_${CP[i]}`];
    if (x != null && x !== 0) return Number(x) || 0;
  }
  return Number(v[`${m}_20`]) || 0;
}
function dayFact(v: any) {
  return {
    assort: Math.round(lastCP(v, "assort") - (Number(v.retOS) || 0)),
    ez: Math.round(lastCP(v, "ez") - (Number(v.retEZ) || 0)),
    cheky: (v.cheky_20 != null || v.cheky_12 != null) ? Math.round(lastCP(v, "cheky")) : Math.round(Number(v.cheky) || 0),
    bn: Math.round(Number(v.bn) || 0),
    dzvinky: (v.dzvinky_20 != null || v.dzvinky_12 != null) ? Math.round(lastCP(v, "dzvinky")) : Math.round(Number(v.dzvinky) || 0),
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

  return json({ ok: true, months, rows: total, perMonth });
});
