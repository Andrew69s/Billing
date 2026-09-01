import { supabase } from "./supabase.js";

/* Облік готівки по СМ по днях.
   СМ вносить наторговане за день; незабрані дні сумуються у «до видачі». */

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const yesterdayISO = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* усі дні готівки (RLS обмежує видимі салони). Опційно за період. */
export async function listCashDays({ from, to, salonKey } = {}) {
  let q = supabase.from("cash_days").select("*");
  if (from) q = q.gte("work_date", from);
  if (to) q = q.lte("work_date", to);
  if (salonKey) q = q.eq("salon_key", salonKey);
  const { data, error } = await q.order("work_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* незабрана готівка по салону (одразу з БД) */
export async function outstandingBySalon() {
  const { data, error } = await supabase.from("cash_days").select("salon_key,amount,work_date,updated_at").eq("collected", false);
  if (error) throw error;
  const map = {};
  for (const r of data || []) {
    const m = map[r.salon_key] || (map[r.salon_key] = { total: 0, days: 0, oldest: null, lastReport: null });
    m.total += Number(r.amount) || 0;
    m.days += 1;
    if (!m.oldest || r.work_date < m.oldest) m.oldest = r.work_date;
    if (!m.lastReport || r.updated_at > m.lastReport) m.lastReport = r.updated_at;
  }
  return map;
}

/* внести/оновити наторговане за день */
export async function setCashDay(salonKey, workDate, amount, by) {
  const { error } = await supabase
    .from("cash_days")
    .upsert(
      { salon_key: salonKey, work_date: workDate, amount: Number(amount) || 0, updated_by: by || "", updated_at: new Date().toISOString() },
      { onConflict: "salon_key,work_date" },
    );
  if (error) throw error;
}

/* видача: позначити всі незабрані дні як забрані + журнал. Повертає суму. */
export async function cashHandover(salonKey, by, note) {
  const { data, error } = await supabase.rpc("cash_handover", { p_salon: salonKey, p_by: by || "", p_note: note || "" });
  if (error) throw error;
  return Number(data) || 0;
}

export async function listHandovers({ salonKey, limit = 60 } = {}) {
  let q = supabase.from("cash_handovers").select("*").order("happened_at", { ascending: false }).limit(limit);
  if (salonKey) q = q.eq("salon_key", salonKey);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export function subscribeCash(onChange) {
  const ch = supabase.channel(`cash-rt-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "cash_days" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "cash_handovers" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
