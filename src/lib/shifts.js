import { supabase, rtChannel } from "./supabase.js";

export const ABSENCE_REASONS = {
  vacation: "Відпустка",
  sick: "Лікарняний",
  dayoff: "Відгул",
  noshow: "Прогул",
  training: "Навчання",
};

export const ymOf = (d) => d.slice(0, 7);
export const daysInMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
export const dayKey = (ym, day) => `${ym}-${String(day).padStart(2, "0")}`;
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* усі зміни магазинів за місяць (RLS обмежує видиме) */
export async function listShifts(ym) {
  const from = `${ym}-01`;
  const to = dayKey(ym, daysInMonth(ym));
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .gte("work_date", from)
    .lte("work_date", to);
  if (error) throw error;
  return data || [];
}

export async function upsertShift(row) {
  const { error } = await supabase
    .from("shifts")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "employee_id,work_date" });
  if (error) throw error;
}

export async function upsertShiftsBatch(rows) {
  if (!rows.length) return;
  const { error } = await supabase
    .from("shifts")
    .upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "employee_id,work_date" });
  if (error) throw error;
}

export async function deleteShift(employee_id, work_date) {
  const { error } = await supabase.from("shifts").delete().eq("employee_id", employee_id).eq("work_date", work_date);
  if (error) throw error;
}

/* «вхід у зміну» магазину за день */
export async function getStoreDay(salon_key, work_date) {
  const { data, error } = await supabase
    .from("store_days").select("*").eq("salon_key", salon_key).eq("work_date", work_date).maybeSingle();
  if (error) throw error;
  return data;
}
export async function setStoreDay(row) {
  const { error } = await supabase
    .from("store_days")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "salon_key,work_date" });
  if (error) throw error;
}
export async function listStoreDays(ym) {
  const { data, error } = await supabase
    .from("store_days").select("*")
    .gte("work_date", `${ym}-01`).lte("work_date", dayKey(ym, daysInMonth(ym)));
  if (error) throw error;
  return data || [];
}

export function subscribeShifts(onChange) {
  const ch = rtChannel("shifts-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "store_days" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* ---- Замок планування ------------------------------------------------------
   Графік на місяць подається у перші дні цього ж місяця — до 3 числа
   включно. Після 3 числа план місяця замикається назавжди, вноситься лише
   факт (і лише за дозволом ТМ). Напр. графік на вересень — до 3 вересня. */
export function planDeadline(ym) {
  const [y, m] = ym.split("-").map(Number); // m — 1-based ⇒ (m-1) = цей місяць 0-based
  return new Date(y, m - 1, 4, 0, 0, 0, 0); // 00:00 4-го = кінець 3-го числа
}
export const planLocked = (ym) => Date.now() >= planDeadline(ym).getTime();
/* факт замикається лише коли місяць завершився (минулі місяці) */
export function factLocked(ym) {
  const n = new Date();
  return ym < `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export async function listShiftEditRequests(ym) {
  let q = supabase.from("shift_edit_requests").select("*").order("requested_at", { ascending: false });
  if (ym) q = q.eq("ym", ym);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function requestShiftFactEdit(salonKey, ym, note, by) {
  const { error } = await supabase.from("shift_edit_requests")
    .insert({ salon_key: salonKey, ym, note: note || "", requested_by: by || "" });
  if (error) throw error;
}
export async function resolveShiftFactEdit(id, approve, by) {
  const { error } = await supabase.from("shift_edit_requests")
    .update({ status: approve ? "approved" : "declined", resolved_by: by || "", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
/* активний дозвіл: схвалений сьогодні запит для цього салону+місяця */
export function factGrantActive(reqs, salonKey, ym) {
  const t = todayISO();
  return (reqs || []).some((r) => r.salon_key === salonKey && r.ym === ym
    && r.status === "approved" && String(r.resolved_at || "").slice(0, 10) === t);
}
export function pendingFactRequest(reqs, salonKey, ym) {
  return (reqs || []).find((r) => r.salon_key === salonKey && r.ym === ym && r.status === "pending") || null;
}
export function subscribeShiftEditRequests(onChange) {
  const ch = rtChannel("shift-edit-req")
    .on("postgres_changes", { event: "*", schema: "public", table: "shift_edit_requests" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
/* розбіжності план/факт за минулі дні (для «Потребує уваги» ТМ) */
export function planFactGaps(shifts, salonKeys) {
  const today = todayISO();
  const set = salonKeys ? new Set(salonKeys) : null;
  return (shifts || []).filter((s) => {
    if (set && !set.has(s.salon_key)) return false;
    if (s.work_date >= today) return false;
    if (s.state === "off" || s.state === "closed" || s.state === "absent") return false;
    return (s.plan_h != null) !== (s.fact_h != null);
  });
}

/* підсумок відпрацьованого за місяць по співробітнику (для ЗП) */
export function monthTally(shifts, employeeId, homeSalonKey) {
  const mine = shifts.filter((s) => s.employee_id === employeeId);
  let factDays = 0, planDays = 0, substDays = 0, offDays = 0, absentDays = 0;
  for (const s of mine) {
    if (s.state === "off" || s.state === "closed") { offDays += 1; continue; }
    if (s.state === "absent") { absentDays += 1; continue; }
    if (s.plan_h != null) planDays += 1;
    if (s.fact_h != null) {
      factDays += 1;
      if (homeSalonKey && s.salon_key !== homeSalonKey) substDays += 1;
    }
  }
  return { factDays, planDays, substDays, offDays, absentDays };
}
