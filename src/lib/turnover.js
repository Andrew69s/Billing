/* Історія реального обороту магазинів (без ЕЗ) — для авто-категоризації.
   Запис лише через RPC-функції в базі (не пряма таблиця) — вони самі перевіряють права. */
import { supabase, rtChannel } from "./supabase.js";

// ЕЗ (усі продажі, без фільтра по статусу) рахує сама SQL-функція з ez_sales —
// клієнт передає лише сирий оборот і відрахування Віктора/НРТ.
export async function upsertTurnoverFact(salonKey, ym, monthFact, viktorChecks = 0, lowMarginChecks = 0) {
  const { error } = await supabase.rpc("upsert_turnover_fact", {
    p_salon_key: salonKey, p_ym: ym,
    p_month_fact: Number(monthFact) || 0,
    p_viktor_checks: Number(viktorChecks) || 0,
    p_low_margin_checks: Number(lowMarginChecks) || 0,
  });
  if (error) throw error;
}

// освіжити лише суму ЕЗ на вже існуючому рядку історії — після підтвердження/
// редагування/видалення продажу ЕЗ (рахує всі продажі незалежно від статусу)
export async function refreshTurnoverEz(salonKey, ym) {
  const { error } = await supabase.rpc("refresh_turnover_ez", { p_salon_key: salonKey, p_ym: ym });
  if (error) throw error;
}

export async function listTurnoverHistory(salonKey, months) {
  const { data, error } = await supabase.from("store_turnover_history").select("*")
    .eq("salon_key", salonKey).in("ym", months);
  if (error) throw error;
  return data || [];
}

export async function listTurnoverHistoryForSalons(salonKeys, months) {
  if (!salonKeys.length) return {};
  const { data, error } = await supabase.from("store_turnover_history").select("*")
    .in("salon_key", salonKeys).in("ym", months);
  if (error) throw error;
  const out = {};
  for (const row of data || []) {
    if (!out[row.salon_key]) out[row.salon_key] = {};
    out[row.salon_key][row.ym] = row;
  }
  return out;
}

export function subscribeTurnoverHistory(onChange) {
  const ch = rtChannel("turnover-history-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "store_turnover_history" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
