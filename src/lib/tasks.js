import { supabase } from "./supabase.js";

export const TASK_STATUS = {
  open: "Відкрита",
  in_progress: "В роботі",
  done: "Виконана",
};

export async function listTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTask({ title, description, assignee, due_date, created_by }) {
  const { error } = await supabase.from("tasks").insert({
    title: title.trim(),
    description: (description || "").trim(),
    assignee,
    created_by,
    due_date: due_date || null,
  });
  if (error) throw error;
}

export async function setTaskStatus(id, status) {
  const patch = { status, updated_at: new Date().toISOString() };
  patch.done_at = status === "done" ? new Date().toISOString() : null;
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/* підписка на зміни задач (realtime) */
export function subscribeTasks(onChange) {
  const ch = supabase
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
