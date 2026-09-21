import { supabase } from "./supabase.js";

/* Глобальні прапори застосунку (технічна перерва тощо). */

export async function getFlag(key) {
  const { data, error } = await supabase.from("app_flags").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value || null;
}

export async function setFlag(key, value, by) {
  const { error } = await supabase
    .from("app_flags")
    .upsert({ key, value, updated_by: by || "", updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export function subscribeFlags(onChange) {
  const ch = supabase.channel(`app-flags-rt-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "app_flags" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* зручні обгортки для «технічної перерви» */
export const getMaintenance = () => getFlag("maintenance").catch(() => null);
export const setMaintenance = (on, message, by) =>
  setFlag("maintenance", { on: !!on, message: message || "", since: on ? new Date().toISOString() : null }, by);

/* замок «Розрахунок ЗП» у кабінеті СМ: { on, open:[salonKey…] } — on закриває всім, open — винятки (магазини, де відкрито).
   Немає запису → замкнено всім (безпечне значення за замовчуванням) */
export const getSmSalaryLock = () =>
  getFlag("sm_salary_lock")
    .then((f) => ({ on: f ? !!f.on : true, open: Array.isArray(f?.open) ? f.open : [] }))
    .catch(() => ({ on: true, open: [] }));
export const smSalaryLockedFor = (st, salonKey) => !!st.on && !st.open.includes(salonKey);
export const setSmSalaryLock = (st, by) => setFlag("sm_salary_lock", { on: !!st.on, open: st.open || [] }, by);
