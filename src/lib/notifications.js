import { supabase, rtChannel } from "./supabase.js";

async function myCabKey() {
  try {
    const { data } = await supabase.from("cab_map").select("cabinet_key").maybeSingle();
    return data?.cabinet_key || null;
  } catch { return null; }
}

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
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

/* Позначити все прочитаним. Явний фільтр по одержувачу + перевірка сесії,
   щоб не «злітало» через протухлий токен (тоді лічильник повертався). */
export async function markAllRead(_retried = false) {
  const key = await myCabKey();
  let q = supabase.from("notifications").update({ read: true }).eq("read", false);
  if (key) q = q.eq("recipient", key);
  const { error } = await q;
  if (error) {
    if (!_retried && /jwt|unauthorized|expired|401/i.test(error.message || "")) {
      await supabase.auth.refreshSession().catch(() => {});
      return markAllRead(true);
    }
    throw error;
  }
}

/* створити сповіщення (для авто-подій, які робить клієнт — напр. статуси ЗП) */
export async function notify({ recipient, kind, title, body = "", actor = "", link = "" }) {
  const { error } = await supabase.from("notifications").insert({ recipient, kind, title, body, actor, link });
  if (error) console.error("notify:", error.message);
}

export function subscribeNotifications(cabKey, onInsert) {
  const ch = rtChannel("notif-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient=eq.${cabKey}` },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
