import { supabase, rtChannel } from "./supabase.js";

export const INVOICE_STATUS = {
  issued: "Виставлено",
  paid: "Оплачено",
  shipped: "Відвантажено",
  documented: "Пропечатано",
  cancelled: "Скасовано",
};
/* нормальний рух статусу вперед */
export const INVOICE_FLOW = ["issued", "paid", "shipped", "documented"];
export const nextStatus = (s) => {
  const i = INVOICE_FLOW.indexOf(s);
  return i >= 0 && i < INVOICE_FLOW.length - 1 ? INVOICE_FLOW[i + 1] : null;
};

export async function listInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createInvoice({ counterparty, issuer, vat, items, amount, invoice_no, screenshot, comment, created_by }) {
  const row = {
    created_by,
    counterparty: (counterparty || "").trim(),
    issuer: (issuer || "").trim(),
    vat: !!vat,
    items: Array.isArray(items) ? items : [],
    amount: Number(amount) || 0,
    invoice_no: (invoice_no || "").trim(),
    screenshot: screenshot || "",
    comment: (comment || "").trim(),
    status: "issued",
    history: [{ status: "issued", at: new Date().toISOString(), by: created_by }],
  };
  const { data, error } = await supabase.from("invoices").insert(row).select().single();
  if (error) throw error;
  return data;
}

/* Будвік → з ПДВ, ФОП → без ПДВ; інакше — що прочитав AI */
export function deriveVat(issuer, aiVat) {
  const s = (issuer || "").toLowerCase();
  if (s.includes("фоп")) return false;
  if (s.includes("будвік") || s.includes("будвик") || s.includes("budvik")) return true;
  return !!aiVat;
}

export async function setInvoiceStatus(inv, status, by, note) {
  const history = [...(inv.history || []), { status, at: new Date().toISOString(), by, ...(note ? { note } : {}) }];
  const patch = { status, history, updated_at: new Date().toISOString() };
  if (note !== undefined) patch.comment = note;
  const { error } = await supabase.from("invoices").update(patch).eq("id", inv.id);
  if (error) throw error;
}

export async function updateInvoice(id, patch) {
  const { error } = await supabase.from("invoices").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeInvoices(onChange) {
  const ch = rtChannel("invoices-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* AI-розпізнавання скріна з 1С — Edge Function «invoice-extract».
   Повертає { counterparty, amount, invoice_no } або кидає помилку
   (тоді вводимо руками). */
export async function extractInvoice(dataUrl) {
  const { data, error } = await supabase.functions.invoke("invoice-extract", { body: { image: dataUrl } });
  if (error) {
    let msg = error.message || "extract error";
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}
