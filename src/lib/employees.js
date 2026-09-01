import { supabase, rtChannel } from "./supabase.js";

export const EMP_ROLES = {
  manager: "Керуючий",
  acting_manager: "В.О. Керуючого",
  seller: "Продавець",
  intern: "Стажер",
};
export const EMP_ROLE_ORDER = ["manager", "acting_manager", "seller", "intern"];

export async function listEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createEmployee({ salon_key, full_name, phone, dob, hired_at, role, note, by }) {
  const row = {
    salon_key,
    full_name: (full_name || "").trim(),
    phone: (phone || "").trim(),
    dob: dob || null,
    hired_at: hired_at || null,
    role: role || "seller",
    note: (note || "").trim(),
    status: "active",
    history: [{ at: new Date().toISOString(), by, action: "hired", salon: salon_key }],
  };
  const { data, error } = await supabase.from("employees").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateEmployee(emp, patch, by, action) {
  const history = [...(emp.history || []), { at: new Date().toISOString(), by, action: action || "edit", ...patch }];
  const { error } = await supabase
    .from("employees")
    .update({ ...patch, history, updated_at: new Date().toISOString() })
    .eq("id", emp.id);
  if (error) throw error;
}

export async function fireEmployee(emp, reason, by) {
  await updateEmployee(
    emp,
    { status: "fired", fired_at: new Date().toISOString().slice(0, 10), fired_reason: (reason || "").trim() },
    by,
    "fired",
  );
}

export async function rehireEmployee(emp, salon_key, by) {
  await updateEmployee(
    emp,
    { status: "active", salon_key, fired_at: null, fired_reason: "" },
    by,
    "rehired",
  );
}

export async function transferEmployee(emp, salon_key, by) {
  await updateEmployee(emp, { salon_key }, by, "transferred");
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeEmployees(onChange) {
  const ch = rtChannel("employees-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* днів до дня народження (0 = сьогодні, null = немає дати / далі ніж 60 днів) */
export function birthdayIn(dob) {
  if (!dob) return null;
  const now = new Date();
  const [, mo, day] = dob.split("-").map(Number);
  let b = new Date(now.getFullYear(), mo - 1, day);
  b.setHours(0, 0, 0, 0);
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  if (b < t) b = new Date(now.getFullYear() + 1, mo - 1, day);
  const diff = Math.round((b - t) / 86400000);
  return diff <= 60 ? diff : null;
}

export function tenure(hired_at, until) {
  if (!hired_at) return "";
  const a = new Date(hired_at);
  const b = until ? new Date(until) : new Date();
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  if (months < 1) return "менше місяця";
  const y = Math.floor(months / 12); const m = months % 12;
  return [y ? `${y} р.` : "", m ? `${m} міс.` : ""].filter(Boolean).join(" ");
}
