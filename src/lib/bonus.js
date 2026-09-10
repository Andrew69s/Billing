import { supabase, rtChannel } from "./supabase.js";

/* Облік руху бонусів (лояльність): щоденне введення СМ —
   Нараховано / Списано / Нараховано БН (безготівка). */

export const BONUS_FIELDS = [
  { key: "accrued", label: "Нараховано", short: "Нарах." },
  { key: "writeoff", label: "Списано", short: "Спис." },
  { key: "accrued_bn", label: "Нараховано БН", short: "БН" },
];

export const bDaysInYm = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
export const bDateOf = (ym, day) => `${ym}-${String(day).padStart(2, "0")}`;

/* нетто дня/періоду: (Нараховано + БН) − Списано.
   Мінус = роздали клієнтам більше бонусів, ніж набрали. */
export const bonusNet = (r) =>
  (Number(r?.accrued) || 0) + (Number(r?.accrued_bn) || 0) - (Number(r?.writeoff) || 0);

export async function listBonusMoves({ from, to, salonKey } = {}) {
  let q = supabase.from("bonus_moves").select("*");
  if (from) q = q.gte("work_date", from);
  if (to) q = q.lte("work_date", to);
  if (salonKey) q = q.eq("salon_key", salonKey);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export const listBonusYear = (year) =>
  listBonusMoves({ from: `${year}-01-01`, to: `${year}-12-31` });

export async function saveBonusDay(salonKey, workDate, patch, by) {
  // передаємо лише змінені поля: upsert на конфлікті оновить тільки їх,
  // решта колонок лишиться без змін (при вставці — дефолт 0). Без read-modify-write,
  // тож паралельні збереження різних полів не перетирають одне одного.
  const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
  const row = { salon_key: salonKey, work_date: workDate, updated_by: by || "", updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) row[k] = num(v);
  const { error } = await supabase
    .from("bonus_moves")
    .upsert(row, { onConflict: "salon_key,work_date" });
  if (error) throw error;
}

export function subscribeBonus(onChange) {
  const ch = rtChannel("bonus-moves-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "bonus_moves" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "bonus_monthly" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* ---- зафіксована помісячна аналітика по СМ -------------------------------- */
const bnum = (v) => (v === "" || v == null ? 0 : Number(v) || 0);

export async function listBonusMonthly(year) {
  const { data, error } = await supabase
    .from("bonus_monthly").select("*")
    .gte("ym", `${year}-01`).lte("ym", `${year}-12`);
  if (error) throw error;
  return data || [];
}
/* карта { [salonKey]: [12] { net, accrued, writeoff, accrued_bn, frozen } | null } */
export function bonusMonthlyMap(rows, salonKeys) {
  const set = new Set(salonKeys);
  const out = {};
  for (const k of salonKeys) out[k] = Array(12).fill(null);
  for (const r of rows || []) {
    if (!set.has(r.salon_key)) continue;
    const mi = Number(r.ym.slice(5, 7)) - 1;
    if (mi >= 0 && mi < 12) out[r.salon_key][mi] = {
      net: Number(r.net) || 0,
      accrued: Number(r.accrued) || 0,
      writeoff: Number(r.writeoff) || 0,
      accrued_bn: Number(r.accrued_bn) || 0,
      frozen: r.frozen !== false,
    };
  }
  return out;
}
export async function upsertBonusMonthly(rows, by) {
  if (!rows.length) return;
  const payload = rows.map((r) => ({
    salon_key: r.salon_key, ym: r.ym,
    net: bnum(r.net), accrued: bnum(r.accrued), writeoff: bnum(r.writeoff), accrued_bn: bnum(r.accrued_bn),
    frozen: r.frozen !== false, updated_by: by || "", updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("bonus_monthly").upsert(payload, { onConflict: "salon_key,ym" });
  if (error) throw error;
}
export async function deleteBonusMonthly(salonKey, ym) {
  const { error } = await supabase.from("bonus_monthly").delete().eq("salon_key", salonKey).eq("ym", ym);
  if (error) throw error;
}

/* агрегати за рік: { [salonKey]: { months: number[12], year, sums:{accrued,writeoff,accrued_bn} } } */
export function bonusYearAgg(rows, salonKeys) {
  const set = new Set(salonKeys);
  const out = {};
  for (const k of salonKeys) out[k] = { months: Array(12).fill(null), year: 0, sums: { accrued: 0, writeoff: 0, accrued_bn: 0 }, has: Array(12).fill(false) };
  for (const r of rows) {
    if (!set.has(r.salon_key)) continue;
    const mi = Number(r.work_date.slice(5, 7)) - 1;
    const o = out[r.salon_key];
    o.months[mi] = (o.months[mi] || 0) + bonusNet(r);
    o.has[mi] = true;
    o.year += bonusNet(r);
    o.sums.accrued += Number(r.accrued) || 0;
    o.sums.writeoff += Number(r.writeoff) || 0;
    o.sums.accrued_bn += Number(r.accrued_bn) || 0;
  }
  return out;
}
