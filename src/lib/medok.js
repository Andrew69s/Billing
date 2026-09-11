import { supabase, rtChannel } from "./supabase.js";

/* Компанії з договором Medok — документи по відвантаженню не пропечатовуються. */
export async function listMedokCompanies() {
  const { data, error } = await supabase.from("medok_companies").select("*").order("name");
  if (error) throw error;
  return data || [];
}
export async function addMedokCompany(name, by) {
  const { error } = await supabase.from("medok_companies").insert({ name: (name || "").trim(), created_by: by || "" });
  if (error) throw error;
}
export async function deleteMedokCompany(id) {
  const { error } = await supabase.from("medok_companies").delete().eq("id", id);
  if (error) throw error;
}
export function isMedokCompany(list, name) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return false;
  return (list || []).some((c) => c.name.trim().toLowerCase() === n);
}
export function subscribeMedok(onChange) {
  const ch = rtChannel("medok-companies")
    .on("postgres_changes", { event: "*", schema: "public", table: "medok_companies" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
