/* Продажі ЕЗ (генератори/електроінструмент) по магазину:
   СМ вносить продаж → ТМ опрацьовує (вхідна ціна, затрати) → рахується чистий прибуток. */
import { supabase, rtChannel } from "./supabase.js";
import { refreshTurnoverEz } from "./turnover.js";

export const EZ_PAYMENT_METHODS = { cash: "Готівка", card: "Картка", transfer: "Перерахунок", installment: "ОЧ", combined: "Комбінована" };

export async function listEzSales({ salonKey, salonKeys, ym } = {}) {
  let q = supabase.from("ez_sales").select("*").order("created_at", { ascending: false });
  if (salonKey) q = q.eq("salon_key", salonKey);
  else if (salonKeys?.length) q = q.in("salon_key", salonKeys);
  if (ym) q = q.eq("ym", ym);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* paymentBreakdown — {cash,card,transfer,installment} при paymentMethod==="combined";
   сума продажу тоді рахується як сума всіх непорожніх складових. */
function ezCoreFields({ nomenclature, article, orderNo, amount, paymentMethod, paymentBreakdown, npDeliveryPaid, soldOn }) {
  const combined = paymentMethod === "combined";
  const breakdown = combined
    ? Object.fromEntries(Object.entries(paymentBreakdown || {}).map(([k, v]) => [k, Number(v) || 0]).filter(([, v]) => v > 0))
    : null;
  const totalAmount = combined ? Object.values(breakdown).reduce((s, v) => s + v, 0) : Number(amount) || 0;
  return {
    nomenclature: (nomenclature || "").trim(), article: (article || "").trim(), order_no: (orderNo || "").trim(),
    amount: totalAmount, payment_method: paymentMethod, payment_breakdown: breakdown,
    np_delivery_paid: !!npDeliveryPaid,
    ...(soldOn ? { sold_on: soldOn } : {}),
  };
}

export async function createEzSale({ salonKey, ym, createdBy, ...core }) {
  const row = { salon_key: salonKey, ym, created_by: createdBy || "", ...ezCoreFields(core) };
  const { error } = await supabase.from("ez_sales").insert(row);
  if (error) throw error;
}

/* СМ редагує власний продаж (номенклатура/сума/спосіб оплати тощо). Якщо продаж
   уже був підтверджений і сума/спосіб оплати змінились — база сама поверне
   статус «на опрацюванні» (тригер ez_sales_guard), бо стара собівартість ТМ
   більше не відповідає новій сумі. */
export async function updateEzSale(id, core) {
  const { error } = await supabase.from("ez_sales").update(ezCoreFields(core)).eq("id", id);
  if (error) throw error;
}

export async function processEzSale(sale, { costPrice, costNp, costAcquiring, costVat }, by) {
  const cost = Number(costPrice) || 0;
  const np = Number(costNp) || 0;
  const acquiring = Number(costAcquiring) || 0;
  const vat = Number(costVat) || 0;
  const extra = np + acquiring + vat;
  const netProfit = Math.max(0, Number(sale.amount) - cost - extra);
  const { error } = await supabase.from("ez_sales").update({
    cost_price: cost, cost_np: np, cost_acquiring: acquiring, cost_vat: vat, extra_costs: extra, net_profit: netProfit,
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

/* перерахунок суми ЕЗ в історії обороту — УСІ продажі незалежно від статусу
   (так само, як factAdjusted), не лише підтверджені. Викликати після будь-якої
   зміни списку продажів (створення, опрацювання, редагування, видалення). */
export async function recomputeTurnoverEz(salonKey, ym) {
  await refreshTurnoverEz(salonKey, ym);
}

export function subscribeEzSales(onChange) {
  const ch = rtChannel("ez-sales-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "ez_sales" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
