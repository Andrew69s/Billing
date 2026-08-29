/*
 * window.storage — тепер поверх Supabase (таблиця public.kv), а не localStorage.
 * Інтерфейс збережено, щоб решта коду не мінялася:
 *   window.storage.get(key)        -> { value } (рядок JSON) або кидає помилку
 *   window.storage.set(key, value) -> зберігає (value — рядок; парситься у jsonb)
 *   window.storage.list(prefix)    -> { keys: string[] }
 *   window.storage.delete(key)
 * Доступ обмежує RLS у базі (див. supabase/schema.sql).
 */
import { supabase } from "./supabase.js";

function toJsonb(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

export const storage = {
  async get(key) {
    const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`storage: ключ "${key}" не знайдено`);
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    const { error } = await supabase.from("kv").upsert({ key, value: toJsonb(value) }, { onConflict: "key" });
    if (error) throw error;
    return { key, value: String(value) };
  },

  async delete(key) {
    const { error } = await supabase.from("kv").delete().eq("key", key);
    if (error) throw error;
  },

  async list(prefix = "") {
    const esc = prefix.replace(/[%_\\]/g, (m) => `\\${m}`);
    const { data, error } = await supabase.from("kv").select("key").like("key", `${esc}%`);
    if (error) return { keys: [] };
    return { keys: (data || []).map((r) => r.key) };
  },
};

export function installStorage() {
  if (typeof window !== "undefined") window.storage = storage;
}
