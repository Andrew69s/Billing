import { supabase, rtChannel } from "./supabase.js";

/* Склад господарських потреб. Рух товару — через RPC supply_act; залишки
   й акти читаються з таблиць (RLS обмежує видиме). */

export const SUPPLY_CATEGORIES = ["напої", "гігієна", "канцелярія", "прибирання", "пакування", "інше"];
export const SUPPLY_UNITS = ["шт", "уп", "кг", "л"];
export const CENTRAL = "central";

export const ACT_KIND = {
  receipt: "Прихід",
  writeoff: "Списання",
  shipment: "Відправлення",
  receive: "Отримання",
  adjust: "Коригування (інвентаризація)",
};

/* Статті списань. Вбудовані не видаляються; `expense: true` → сума
   тягнеться у «Витрати по СМ». Кастомні статті адмін додає у kv. */
export const WRITEOFF_ARTICLES_BUILTIN = [
  { key: "store", label: "Витрати на магазин", expense: true, builtin: true },
  { key: "defect", label: "Брак товару", expense: false, builtin: true },
  { key: "office", label: "Витрати Офіс", expense: false, builtin: true },
  { key: "viktor", label: "Потреба Віктора", expense: false, builtin: true },
];
const ARTICLES_KEY = "supply:articles";
export async function listWriteoffArticles() {
  let custom = [];
  try {
    const { data } = await supabase.from("kv").select("value").eq("key", ARTICLES_KEY).maybeSingle();
    if (Array.isArray(data?.value)) custom = data.value;
  } catch { /* ignore */ }
  const builtinKeys = new Set(WRITEOFF_ARTICLES_BUILTIN.map((a) => a.key));
  const extra = custom
    .filter((a) => a && a.key && !builtinKeys.has(a.key))
    .map((a) => ({ key: String(a.key), label: String(a.label || a.key), expense: !!a.expense, builtin: false }));
  return [...WRITEOFF_ARTICLES_BUILTIN, ...extra];
}
export async function saveWriteoffArticles(customList) {
  const builtinKeys = new Set(WRITEOFF_ARTICLES_BUILTIN.map((a) => a.key));
  const clean = (customList || [])
    .filter((a) => a && a.key && !builtinKeys.has(a.key))
    .map((a) => ({ key: String(a.key), label: String(a.label || a.key), expense: !!a.expense }));
  const { error } = await supabase.from("kv").upsert({ key: ARTICLES_KEY, value: clean }, { onConflict: "key" });
  if (error) throw error;
}
export const articleLabel = (articles, key) =>
  (articles || WRITEOFF_ARTICLES_BUILTIN).find((a) => a.key === key)?.label || key || "—";

export const uahN = (n) => Math.round(Number(n) || 0).toLocaleString("uk-UA");
export const uah = (n) => uahN(n) + " ₴";

/* ---------- довідник ---------- */
export async function listItems({ includeArchived = false } = {}) {
  let q = supabase.from("supply_items").select("*").order("sort").order("name");
  if (!includeArchived) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function upsertItem(patch) {
  const row = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("supply_items").upsert(row).select().maybeSingle();
  if (error) throw error;
  return data;
}
/* видалити (якщо позиція ніде не фігурує) або заархівувати позицію */
export async function deleteItem(itemId) {
  const { data, error } = await supabase.rpc("supply_delete_item", { p_item: itemId });
  if (error) throw error;
  return data; // 'deleted' | 'archived'
}
export async function setPrice(itemId, unitCost) {
  const { error } = await supabase.rpc("supply_set_price", { p_item: itemId, p_cost: Number(unitCost) || 0 });
  if (error) throw error;
}
export async function priceLog(itemId) {
  const { data, error } = await supabase
    .from("supply_price_log").select("*").eq("item_id", itemId).order("at", { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}

/* ---------- залишки ---------- */
export async function listStock(warehouse) {
  let q = supabase.from("supply_stock").select("*");
  if (warehouse) q = q.eq("warehouse", warehouse);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
/* мапа item_id -> qty для складу */
export function stockMap(rows, warehouse) {
  const m = {};
  for (const r of rows) if (!warehouse || r.warehouse === warehouse) m[r.item_id] = Number(r.qty) || 0;
  return m;
}
/* рядок стану залишку відносно мін-рівня */
export function stockState(qty, min) {
  if (min <= 0) return "ok";
  if (qty < min) return qty <= 0 ? "lo" : "lo";
  if (qty < min * 1.25) return "mid";
  return "ok";
}

/* ---------- акти (журнал) ---------- */
export async function listActs({ warehouse, kind, from, to, limit = 200 } = {}) {
  let q = supabase.from("supply_acts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (warehouse) q = q.eq("warehouse", warehouse);
  if (kind) q = q.eq("kind", kind);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function actLines(actId) {
  const { data, error } = await supabase.from("supply_act_lines").select("*").eq("act_id", actId);
  if (error) throw error;
  return data || [];
}
/* якому магазину «належить» акт списання (для витрат):
   свій склад → його ключ; списання з основного складу → хто списав (created_by).
   Липинського списує госп.потреби прямо з основного складу. */
export const actSalon = (act) =>
  (act && act.warehouse && act.warehouse !== CENTRAL ? act.warehouse : (act?.created_by || null));

/* усі рядки актів списання за період (+ стаття) */
export async function writeoffLines({ from, to, salonKey, articles } = {}) {
  let aq = supabase.from("supply_acts")
    .select("id,warehouse,kind,article,created_at,reason,created_by").eq("kind", "writeoff");
  if (from) aq = aq.gte("created_at", from);
  if (to) aq = aq.lte("created_at", to);
  if (salonKey) aq = aq.or(`warehouse.eq.${salonKey},and(warehouse.eq.${CENTRAL},created_by.eq.${salonKey})`);
  if (Array.isArray(articles) && articles.length) aq = aq.in("article", articles);
  const { data: acts, error } = await aq;
  if (error) throw error;
  if (!acts?.length) return [];
  const ids = acts.map((a) => a.id);
  const { data: lines, error: e2 } = await supabase.from("supply_act_lines").select("*").in("act_id", ids);
  if (e2) throw e2;
  const byAct = Object.fromEntries(acts.map((a) => [a.id, ({ ...a, article: a.article || "store" })]));
  return (lines || []).map((l) => ({ ...l, act: byAct[l.act_id] }));
}

/* Витрати магазину на госп.потреби = ФАКТИЧНИЙ РОЗХІД (акти списання)
   лише за статтями з expense:true (за замовч. — «Витрати на магазин»).
   Прийшло 4 тис., списали 2 → витрата 2 тис. Собівартість — на момент списання. */
export async function salonSupplyExpenseLines({ from, to, salonKey } = {}) {
  const arts = await listWriteoffArticles();
  const expenseKeys = arts.filter((a) => a.expense).map((a) => a.key);
  if (!expenseKeys.length) return [];
  return writeoffLines({ from, to, salonKey, articles: expenseKeys });
}

/* ---------- рух товару (RPC) ---------- */
export async function doAct(payload) {
  const { data, error } = await supabase.rpc("supply_act", { payload });
  if (error) {
    let msg = error.message || "помилка";
    if (/forbidden/i.test(msg)) msg = "Немає прав на цю дію";
    else if (/negative_adjust/.test(msg)) msg = "Кількість при інвентаризації не може бути відʼємною";
    else {
      const m = msg.match(/not_enough:(.+?):([\d.]+):([\d.]+)/);
      if (m) msg = `«${m[1]}»: на складі лише ${(+m[2]).toLocaleString("uk-UA")}, а операція на ${(+m[3]).toLocaleString("uk-UA")}`;
    }
    throw new Error(msg);
  }
  // supply_act повертає { act_id, total, price_changes: [{name, old, new}] }
  return data || {};
}
export const receipt = (warehouse, counterparty, lines) =>
  doAct({ kind: "receipt", warehouse, counterparty, lines });
export const writeoff = (warehouse, article, note, lines) =>
  doAct({ kind: "writeoff", warehouse, article, reason: note, lines });
export const adjust = (warehouse, reason, lines) =>
  doAct({ kind: "adjust", warehouse, reason, lines });
export const shipOrder = (orderId, warehouseFromCentral, lines) =>
  doAct({ kind: "shipment", warehouse: CENTRAL, counterparty: warehouseFromCentral, order_id: orderId, lines });
export const receiveOrder = (orderId, salonKey, lines) =>
  doAct({ kind: "receive", warehouse: salonKey, counterparty: CENTRAL, order_id: orderId, lines });

/* ---------- замовлення салону ---------- */
export async function listOrders({ salonKey, status } = {}) {
  let q = supabase.from("supply_orders").select("*").order("created_at", { ascending: false });
  if (salonKey) q = q.eq("salon_key", salonKey);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function orderLines(orderId) {
  const { data, error } = await supabase.from("supply_order_lines").select("*").eq("order_id", orderId);
  if (error) throw error;
  return data || [];
}
export async function createOrder(salonKey, by, lines) {
  const { data: o, error } = await supabase
    .from("supply_orders")
    .insert({ salon_key: salonKey, created_by: by || "", status: "draft" })
    .select().single();
  if (error) throw error;
  if (lines?.length) {
    const { error: e2 } = await supabase.from("supply_order_lines")
      .insert(lines.map((l) => ({ order_id: o.id, item_id: l.item_id, qty_req: Number(l.qty) || 0 })));
    if (e2) throw e2;
  }
  return o;
}
export async function saveOrderLines(orderId, lines) {
  await supabase.from("supply_order_lines").delete().eq("order_id", orderId);
  if (lines.length) {
    const { error } = await supabase.from("supply_order_lines")
      .insert(lines.map((l) => ({ order_id: orderId, item_id: l.item_id, qty_req: Number(l.qty) || 0 })));
    if (error) throw error;
  }
}
export async function submitOrder(orderId) {
  const { error } = await supabase.from("supply_orders")
    .update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw error;
}
export async function deleteOrder(orderId) {
  const { error } = await supabase.from("supply_orders").delete().eq("id", orderId);
  if (error) throw error;
}

export function subscribeSupply(onChange) {
  const ch = rtChannel("supply-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "supply_stock" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "supply_acts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "supply_orders" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "supply_items" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
