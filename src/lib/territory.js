import { supabase, rtChannel } from "./supabase.js";

/* Показники території: денні дані салонів (planner з зовнішнього планера
   + ручні корективи ТМ). Ефективне значення = { ...planner, ...manual }. */

export const TM_METRICS = [
  { key: "assort", label: "Оборот", short: "Оборот", money: true },
  { key: "ez", label: "ЕЗ", short: "ЕЗ", money: true },
  { key: "cheky", label: "Чеки", short: "Чеки", money: false },
  { key: "bn", label: "БН", short: "БН", money: true },
  { key: "dzvinky", label: "Дзвінки", short: "Дзв.", money: false },
];

/* місячні плани салонів — базовий fallback (актуальні тягнуться з планера
   у таблицю territory_plans через planner-sync) */
export const SALON_MONTH_PLAN = {
  "gorodok-peremyshlska": { assort: 1400000, ez: 112000, cheky: 630, bn: 400000, dzvinky: 1000 },
  "mostyska-rynok": { assort: 900000, ez: 72000, cheky: 350, bn: 10000, dzvinky: 400 },
  "turka-sheptytskoho": { assort: 900000, ez: 72000, cheky: 444, bn: 100000, dzvinky: 500 },
  "lviv-lypynskoho": { assort: 1500000, ez: 120000, cheky: 660, bn: 200000, dzvinky: 750 },
  "lviv-shyretska": { assort: 1400000, ez: 112000, cheky: 608, bn: 100000, dzvinky: 810 },
  "lviv-shevchenka": { assort: 800000, ez: 64000, cheky: 400, bn: 100000, dzvinky: 400 },
  "lviv-vashyngtona": { assort: 900000, ez: 72000, cheky: 400, bn: 100000, dzvinky: 500 },
  "lviv-kavaleridze": { assort: 800000, ez: 64000, cheky: 345, bn: 30000, dzvinky: 500 },
};

export const daysInYm = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
export const dateOf = (ym, day) => `${ym}-${String(day).padStart(2, "0")}`;

/* усі рядки за місяць (RLS сама обмежує видимі салони) */
export async function listMetrics(ym) {
  const from = `${ym}-01`;
  const to = dateOf(ym, daysInYm(ym));
  const { data, error } = await supabase
    .from("territory_metrics")
    .select("*")
    .gte("work_date", from)
    .lte("work_date", to);
  if (error) throw error;
  return data || [];
}

/* актуальні місячні плани салонів (territory_plans); fallback — SALON_MONTH_PLAN */
export async function listPlans() {
  const { data, error } = await supabase.from("territory_plans").select("salon_key,plan");
  if (error) throw error;
  const out = { ...SALON_MONTH_PLAN };
  for (const r of data || []) out[r.salon_key] = r.plan || SALON_MONTH_PLAN[r.salon_key] || {};
  return out;
}
export const planOf = (plans, salonKey) => (plans && plans[salonKey]) || SALON_MONTH_PLAN[salonKey] || {};

/* ефективні значення дня: planner перекривається manual по ключах */
export function effective(row) {
  const p = row?.planner || {};
  const m = row?.manual || {};
  const out = {};
  for (const { key } of TM_METRICS) {
    const has = Object.prototype.hasOwnProperty.call(m, key) && m[key] != null && m[key] !== "";
    out[key] = has ? Number(m[key]) || 0 : Number(p[key]) || 0;
    out[`${key}__edited`] = has;
    out[`${key}__planner`] = p[key] == null ? null : Number(p[key]) || 0;
  }
  return out;
}

/* зберегти ручну корективу за день (patch: { assort?: number|null, ... }) */
export async function saveManual(salonKey, workDate, patch, by) {
  const { data: cur } = await supabase
    .from("territory_metrics").select("manual").eq("salon_key", salonKey).eq("work_date", workDate).maybeSingle();
  const manual = { ...(cur?.manual || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "" || v === undefined) delete manual[k];
    else manual[k] = Number(v) || 0;
  }
  const { error } = await supabase
    .from("territory_metrics")
    .upsert(
      { salon_key: salonKey, work_date: workDate, manual, updated_by: by || "", updated_at: new Date().toISOString() },
      { onConflict: "salon_key,work_date" },
    );
  if (error) throw error;
}

/* прибрати всі ручні корективи за день (повернути до планера) */
export async function resetManual(salonKey, workDate) {
  const { error } = await supabase
    .from("territory_metrics")
    .upsert(
      { salon_key: salonKey, work_date: workDate, manual: {}, updated_at: new Date().toISOString() },
      { onConflict: "salon_key,work_date" },
    );
  if (error) throw error;
}

/* оновити дані з планера (Edge Function) */
export async function syncFromPlanner(months) {
  const { data, error } = await supabase.functions.invoke("planner-sync", {
    body: months && months.length ? { months } : {},
  });
  if (error) {
    let msg = error.message || "sync error";
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  return data;
}

export function subscribeMetrics(onChange) {
  const ch = rtChannel("territory-metrics-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "territory_metrics" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "territory_plans" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* агрегат за місяць по набору салонів: сума кожного показника + к-ть днів */
export function monthAgg(rows, salonKeys) {
  const set = new Set(salonKeys);
  const sum = { assort: 0, ez: 0, cheky: 0, bn: 0, dzvinky: 0 };
  const daysBySalon = {};
  for (const r of rows) {
    if (!set.has(r.salon_key)) continue;
    const e = effective(r);
    let any = false;
    for (const { key } of TM_METRICS) { sum[key] += e[key]; if (e[key]) any = true; }
    if (any) daysBySalon[r.salon_key] = (daysBySalon[r.salon_key] || 0) + 1;
  }
  return { sum, daysBySalon };
}

/* план за набором салонів (місячний). plans — мапа з listPlans() (опц.) */
export function planAgg(salonKeys, plans) {
  const sum = { assort: 0, ez: 0, cheky: 0, bn: 0, dzvinky: 0 };
  for (const k of salonKeys) {
    const p = planOf(plans, k);
    for (const { key } of TM_METRICS) sum[key] += p[key] || 0;
  }
  return sum;
}
