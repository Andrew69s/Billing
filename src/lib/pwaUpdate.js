/* Оновлення PWA: показуємо банер, коли готова нова версія.
   Клік «Оновити» → skipWaiting + перезавантаження сторінки.
   Плюс періодична перевірка щохвилини (щоб банер зʼявився без переоткриття). */
import { registerSW } from "virtual:pwa-register";

let _updateSW = () => {};
const listeners = new Set();
let _ready = false;

export function onUpdateReady(cb) {
  listeners.add(cb);
  if (_ready) cb();
  return () => listeners.delete(cb);
}
export function applyUpdate() { _updateSW(true); }

export function initPwaUpdate() {
  if (typeof window === "undefined") return;
  _updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      _ready = true;
      listeners.forEach((cb) => cb());
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => { reg.update().catch(() => {}); }, 60_000);
    },
  });
}
