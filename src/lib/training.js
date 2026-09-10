import { supabase, rtChannel } from "./supabase.js";

/* Перелік тестувань (RLS: бачать усі авторизовані; редагують ТМ/керівник/адмін) */
export async function listTrainings({ includeArchived = false } = {}) {
  let q = supabase.from("trainings").select("*").order("deadline", { ascending: true, nullsFirst: false });
  if (!includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function createTraining(row) {
  const { data, error } = await supabase.from("trainings").insert(row).select().single();
  if (error) throw error;
  return data;
}
export async function updateTraining(id, patch) {
  const { error } = await supabase.from("trainings").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteTraining(id) {
  const { error } = await supabase.from("trainings").delete().eq("id", id);
  if (error) throw error;
}

export async function listTrainingResults(trainingIds) {
  let q = supabase.from("training_results").select("*");
  if (trainingIds && trainingIds.length) q = q.in("training_id", trainingIds);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function upsertTrainingResult(row) {
  const { error } = await supabase.from("training_results")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "training_id,employee_id" });
  if (error) throw error;
}

export async function extractTrainingScreenshot(dataUrl) {
  const { data, error } = await supabase.functions.invoke("training-ocr", { body: { image: dataUrl } });
  if (error) throw new Error(data?.error || error.message || "OCR не вдалось");
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export function subscribeTrainings(onChange) {
  const ch = rtChannel("trainings")
    .on("postgres_changes", { event: "*", schema: "public", table: "trainings" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "training_results" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* дні до дедлайну (null якщо дедлайн не заданий) */
export function daysToDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline + "T23:59:59");
  return Math.ceil((d.getTime() - Date.now()) / 864e5);
}

/* середній бал салону за місяць (по пройдених із проставленою оцінкою) */
export function salonMonthAvg(results, salonKey, ym) {
  const vals = (results || [])
    .filter((r) => r.salon_key === salonKey && r.passed && r.score != null
      && String(r.passed_on || "").slice(0, 7) === ym)
    .map((r) => Number(r.score))
    .filter((n) => !Number.isNaN(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
