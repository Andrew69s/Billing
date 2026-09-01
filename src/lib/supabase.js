import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("Supabase env vars missing — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "dnipro-m-auth",
  },
});

/* унікальний realtime-канал — щоб два екземпляри одного модуля
   (напр. «Команда» + «Архів» разом) не билися за спільний канал */
export const rtChannel = (name) =>
  supabase.channel(`${name}:${Math.random().toString(36).slice(2)}`);
