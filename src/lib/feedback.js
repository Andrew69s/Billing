import { supabase } from "./supabase.js";

/* Звернення: проблеми / несправності / пропозиції.
   Подати може будь-хто; список бачить лише адміністратор (кабінет 'andriy'). */

export const FEEDBACK_KINDS = { problem: "Проблема / несправність", proposal: "Пропозиція" };

export async function submitFeedback({ kind, body, screenshot, fromCabinet, fromType }) {
  const { error } = await supabase.from("feedback").insert({
    kind: kind === "proposal" ? "proposal" : "problem",
    body: (body || "").trim(),
    screenshot: screenshot || null,
    from_cabinet: fromCabinet || "",
    from_type: fromType || "",
  });
  if (error) throw error;
}

export async function listFeedback() {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setFeedbackStatus(id, status) {
  const { error } = await supabase
    .from("feedback")
    .update({ status, resolved_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

/* опрацювати: статус done + коментар + сповіщення кабінету-автору */
export async function resolveFeedback(row, comment) {
  const { error } = await supabase
    .from("feedback")
    .update({ status: "done", admin_comment: (comment || "").trim(), resolved_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw error;
  if (row.from_cabinet) {
    const kindWord = row.kind === "proposal" ? "пропозицію" : "звернення";
    await supabase.from("notifications").insert({
      recipient: row.from_cabinet,
      kind: "feedback",
      title: `Адміністратор опрацював ваше ${kindWord}`,
      body: (comment || "").trim() || (row.body || "").slice(0, 140),
      actor: "andriy",
      link: "",
    });
  }
}

export async function deleteFeedback(id) {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeFeedback(onChange) {
  const ch = supabase.channel(`feedback-rt-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
