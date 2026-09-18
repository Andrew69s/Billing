/* Історія реального обороту магазинів (без ЕЗ) — для авто-категоризації.
   Запис лише через RPC-функції в базі (не пряма таблиця) — вони самі перевіряють права. */
import { supabase, rtChannel } from "./supabase.js";

export async function upsertTurnoverMonthFact(salonKey, ym, monthFact) {
  const { error } = await supabase.rpc("upsert_turnover_month_fact", {
    p_salon_key: salonKey, p_ym: ym, p_month_fact: Number(monthFact) || 0,
  });
  if (error) throw error;
}

export async function upsertTurnoverEzSum(salonKey, ym, ezSum) {
  const { error } = await supabase.rpc("upsert_turnover_ez_sum", {
    p_salon_key: salonKey, p_ym: ym, p_ez_sum: Number(ezSum) || 0,
  });
  if (error) throw error;
}

export async function listTurnoverHistory(salonKey, months) {
  const { data, error } = await supabase.from("store_turnover_history").select("*")
    .eq("salon_key", salonKey).in("ym", months);
  if (error) throw error;
  return data || [];
}

export function subscribeTurnoverHistory(onChange) {
  const ch = rtChannel("turnover-history-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "store_turnover_history" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
