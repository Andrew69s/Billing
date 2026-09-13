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
/* Юля зазвичай вписує коротку/впізнавану назву («Дар материнства»), а в
   рахунку контрагент повний («БЛАГОДІЙНИЙ ФОНД "ДАР МАТЕРИНСТВА"») —
   тож звірка не лише на точний збіг, а й на входження в обидва боки. */
export function isMedokCompany(list, name) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return false;
  return (list || []).some((c) => {
    const cn = (c.name || "").trim().toLowerCase();
    return cn.length > 2 && (cn === n || n.includes(cn) || cn.includes(n));
  });
}
export function subscribeMedok(onChange) {
  const ch = rtChannel("medok-companies")
    .on("postgres_changes", { event: "*", schema: "public", table: "medok_companies" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
