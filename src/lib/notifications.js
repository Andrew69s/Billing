import { supabase } from "./supabase.js";

export async function listNotifications(limit = 50) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markRead(id) {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllRead() {
  await supabase.from("notifications").update({ read: true }).eq("read", false);
}

/* створити сповіщення (для авто-подій, які робить клієнт — напр. статуси ЗП) */
export async function notify({ recipient, kind, title, body = "", actor = "", link = "" }) {
  const { error } = await supabase.from("notifications").insert({ recipient, kind, title, body, actor, link });
  if (error) console.error("notify:", error.message);
}

export function subscribeNotifications(cabKey, onInsert) {
  const ch = supabase
    .channel("notif-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient=eq.${cabKey}` },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
