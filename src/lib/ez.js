/* Продажі ЕЗ (генератори/електроінструмент) по магазину:
   СМ вносить продаж → ТМ опрацьовує (вхідна ціна, затрати) → рахується чистий прибуток. */
import { supabase, rtChannel } from "./supabase.js";

export const EZ_PAYMENT_METHODS = { cash: "Готівка", card: "Картка", transfer: "Перерахунок", installment: "ОЧ" };

export async function listEzSales({ salonKey, salonKeys, ym } = {}) {
  let q = supabase.from("ez_sales").select("*").order("created_at", { ascending: false });
  if (salonKey) q = q.eq("salon_key", salonKey);
  else if (salonKeys?.length) q = q.in("salon_key", salonKeys);
  if (ym) q = q.eq("ym", ym);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createEzSale({ salonKey, ym, nomenclature, article, orderNo, amount, paymentMethod, npDeliveryPaid, createdBy }) {
  const row = {
    salon_key: salonKey, ym,
    nomenclature: (nomenclature || "").trim(), article: (article || "").trim(), order_no: (orderNo || "").trim(),
    amount: Number(amount) || 0, payment_method: paymentMethod, np_delivery_paid: !!npDeliveryPaid,
    created_by: createdBy || "",
  };
  const { error } = await supabase.from("ez_sales").insert(row);
  if (error) throw error;
}

export async function processEzSale(sale, { costPrice, extraCosts }, by) {
  const cost = Number(costPrice) || 0;
  const extra = Number(extraCosts) || 0;
  const netProfit = Math.max(0, Number(sale.amount) - cost - extra);
  const { error } = await supabase.from("ez_sales").update({
    cost_price: cost, extra_costs: extra, net_profit: netProfit,
    status: "confirmed", processed_by: by || "", processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", sale.id);
  if (error) throw error;
  return netProfit;
}

export async function deleteEzSale(id) {
  const { error } = await supabase.from("ez_sales").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeEzSales(onChange) {
  const ch = rtChannel("ez-sales-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "ez_sales" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
