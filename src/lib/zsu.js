import { supabase, rtChannel } from "./supabase.js";

/* Промокоди ЗСУ −15% (RLS: свій салон / своя територія / керівник-адмін-бухгалтер) */
export async function listZsuCodes({ salonKey } = {}) {
  let q = supabase.from("zsu_codes").select("*").order("created_at", { ascending: true });
  if (salonKey) q = q.eq("salon_key", salonKey);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* розбір вставленого тексту у список кодів */
export function parseCodes(raw) {
  return [...new Set(
    String(raw || "")
      .split(/[\s,;\n\r\t]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4),
  )];
}

export async function uploadZsuCodes(salonKey, codes, by) {
  const batch = `b${Date.now()}`;
  const rows = codes
    .map((c) => String(c).trim())
    .filter(Boolean)
    .map((code) => ({ salon_key: salonKey, code, batch_id: batch, created_by: by || "" }));
  if (!rows.length) return { added: 0, dup: 0 };
  const existing = await listZsuCodes({ salonKey });
  const have = new Set(existing.map((r) => r.code));
  const fresh = rows.filter((r) => !have.has(r.code));
  if (fresh.length) {
    const { error } = await supabase.from("zsu_codes").insert(fresh);
    if (error) throw error;
  }
  return { added: fresh.length, dup: rows.length - fresh.length };
}

export async function markZsuUsed(id, receiptNo, usedOn, by) {
  const { error } = await supabase.from("zsu_codes").update({
    used: true,
    receipt_no: String(receiptNo || "").trim(),
    used_on: usedOn || null,
    used_at: new Date().toISOString(),
    used_by: by || "",
  }).eq("id", id);
  if (error) throw error;
}
export async function undoZsuUsed(id) {
  const { error } = await supabase.from("zsu_codes").update({
    used: false, receipt_no: "", used_on: null, used_at: null, used_by: "",
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteZsuCode(id) {
  const { error } = await supabase.from("zsu_codes").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeZsuCodes(onChange) {
  const ch = rtChannel("zsu-codes")
    .on("postgres_changes", { event: "*", schema: "public", table: "zsu_codes" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
