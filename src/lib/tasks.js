import { supabase } from "./supabase.js";

export const TASK_STATUS = { open: "Відкрита", in_progress: "В роботі", done: "Виконана" };

export async function listTasks() {
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* створити задачу для кожного з assignees (масив cabinet_key) */
export async function createTasks({ title, description, assignees, due_at, priority, created_by }) {
  const rows = assignees.map((assignee) => ({
    title: title.trim(),
    description: (description || "").trim(),
    assignee,
    created_by,
    priority: !!priority,
    due_at: due_at || null,
  }));
  const { error } = await supabase.from("tasks").insert(rows);
  if (error) throw error;
}

export async function setTaskStatus(id, status, comment) {
  const patch = { status, updated_at: new Date().toISOString() };
  patch.done_at = status === "done" ? new Date().toISOString() : null;
  if (comment !== undefined) patch.comment = comment;
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/* позначити задачі переглянутими поточним кабінетом (передаємо вже наявні seen) */
export async function markSeen(tasks, cabKey) {
  const stamp = new Date().toISOString();
  const toMark = tasks.filter((t) => t.assignee === cabKey && !(t.seen || {})[cabKey]);
  await Promise.all(
    toMark.map((t) =>
      supabase.from("tasks").update({ seen: { ...(t.seen || {}), [cabKey]: stamp } }).eq("id", t.id),
    ),
  );
}

export function subscribeTasks(onChange) {
  const ch = supabase
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
