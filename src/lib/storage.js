/*
 * Локальний шим для API, яке в артефакті Claude надавав `window.storage`.
 * Тут дані зберігаються в localStorage браузера (на цьому пристрої).
 *
 * Використовувані методи:
 *   window.storage.get(key)        -> { value } або кидає помилку, якщо ключа немає
 *   window.storage.set(key, value) -> зберігає рядкове значення
 *   window.storage.list(prefix)    -> { keys: string[] } (ключі з відкинутим службовим префіксом)
 *
 * Другий аргумент (global-прапорець) в оригіналі означав спільне сховище між
 * користувачами. У локальній версії воно одне, тож аргумент ігнорується.
 */

const NS = "tmapp:";

function realKey(key) {
  return NS + key;
}

export const storage = {
  async get(key) {
    const raw = localStorage.getItem(realKey(key));
    if (raw === null) {
      throw new Error(`storage: ключ "${key}" не знайдено`);
    }
    return { key, value: raw };
  },

  async set(key, value) {
    localStorage.setItem(realKey(key), String(value));
    return { key, value: String(value) };
  },

  async delete(key) {
    localStorage.removeItem(realKey(key));
  },

  async list(prefix = "") {
    const full = realKey(prefix);
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) {
        keys.push(k.slice(NS.length));
      }
    }
    return { keys };
  },
};

export function installStorage() {
  if (typeof window !== "undefined" && !window.storage) {
    window.storage = storage;
  }
}
