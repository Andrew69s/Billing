/* Оновлення PWA: показуємо банер, коли готова нова версія.
   SW має skipWaiting+clientsClaim → нова версія стає активною одразу у фоні,
   тому банер тригеримо і з onNeedRefresh, і з controllerchange.
   Клік «Оновити» → перезавантаження сторінки.
   Плюс періодична перевірка щохвилини. */
import { registerSW } from "virtual:pwa-register";

const listeners = new Set();
let _ready = false;

function markReady() {
  if (_ready) return;
  _ready = true;
  listeners.forEach((cb) => cb());
}

export function onUpdateReady(cb) {
  listeners.add(cb);
  if (_ready) cb();
  return () => listeners.delete(cb);
}
export function applyUpdate() {
  try { window.location.reload(); } catch { /* ignore */ }
}

export function initPwaUpdate() {
  if (typeof window === "undefined") return;
  registerSW({
    immediate: true,
    onNeedRefresh: markReady,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => { reg.update().catch(() => {}); }, 60_000);
    },
  });
  if ("serviceWorker" in navigator) {
    let firstControl = !navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // перша реєстрація SW на цій вкладці — не оновлення, ігноруємо
      if (firstControl) { firstControl = false; return; }
      markReady();
    });
  }
}
