/* План ТМ на місяць по магазину: оборот + пороги середнього чека/довжини чека.
   Раніше ці цифри вписував собі сам СМ у формі ЗП — тепер джерело єдине, від ТМ. */
import { supabase, rtChannel } from "./supabase.js";

export const emptyPlan = () => ({
  turnover_plan: 0,
  ez_plan: 0,
  avg_check_t1: 0, avg_check_t2: 0, avg_check_t3: 0,
  check_len_t1: 0, check_len_t2: 0, check_len_t3: 0,
  locked: false,
});

export async function getSmPlan(salonKey, ym) {
  const { data, error } = await supabase.from("sm_plans").select("*")
    .eq("salon_key", salonKey).eq("ym", ym).maybeSingle();
  if (error) throw error;
  return data ? { ...emptyPlan(), ...data } : emptyPlan();
}

export async function listSmPlansForSalon(salonKey, months) {
  const { data, error } = await supabase.from("sm_plans").select("*")
    .eq("salon_key", salonKey).in("ym", months);
  if (error) throw error;
  const out = {};
  for (const row of data || []) out[row.ym] = row;
  return out;
}

export async function listSmPlansForSalons(salonKeys, months) {
  if (!salonKeys.length) return {};
  const { data, error } = await supabase.from("sm_plans").select("*")
    .in("salon_key", salonKeys).in("ym", months);
  if (error) throw error;
  const out = {};
  for (const row of data || []) {
    if (!out[row.salon_key]) out[row.salon_key] = {};
    out[row.salon_key][row.ym] = row;
  }
  return out;
}

export async function listSmPlans(salonKeys, ym) {
  if (!salonKeys.length) return {};
  const { data, error } = await supabase.from("sm_plans").select("*")
    .in("salon_key", salonKeys).eq("ym", ym);
  if (error) throw error;
  const out = {};
  for (const row of data || []) out[row.salon_key] = row;
  return out;
}

export async function saveSmPlan(salonKey, ym, plan, by) {
  const row = {
    salon_key: salonKey, ym,
    turnover_plan: Number(plan.turnover_plan) || 0,
    ez_plan: Number(plan.ez_plan) || 0,
    avg_check_t1: Number(plan.avg_check_t1) || 0, avg_check_t2: Number(plan.avg_check_t2) || 0, avg_check_t3: Number(plan.avg_check_t3) || 0,
    check_len_t1: Number(plan.check_len_t1) || 0, check_len_t2: Number(plan.check_len_t2) || 0, check_len_t3: Number(plan.check_len_t3) || 0,
    updated_by: by || "",
  };
  const { error } = await supabase.from("sm_plans").upsert(row, { onConflict: "salon_key,ym" });
  if (error) throw error;
}

export async function setPlanLock(salonKey, ym, locked, by) {
  const { error } = await supabase.from("sm_plans")
    .upsert({ salon_key: salonKey, ym, locked, updated_by: by || "" }, { onConflict: "salon_key,ym" });
  if (error) throw error;
}

export function subscribePlans(onChange) {
  const ch = rtChannel("sm-plans-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "sm_plans" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
