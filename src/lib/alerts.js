/* Звук і сповіщення на екрані комп'ютера для нових сповіщень кабінету.
   Працює, поки застосунок відкрито (вкладка може бути прихована або згорнута):
   - звук — короткий сигнал через Web Audio (без файлів);
   - на екрані — системне сповіщення браузера, якщо вкладка прихована або вікно не в фокусі. */

const SOUND_KEY = "dnipro-alert-sound";
const DESK_KEY = "dnipro-alert-desktop";

export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; } };
export const setSoundOn = (v) => { try { localStorage.setItem(SOUND_KEY, v ? "1" : "0"); } catch { /* ignore */ } };

export const desktopSupported = () => typeof window !== "undefined" && "Notification" in window;
export const desktopPermission = () => (desktopSupported() ? Notification.permission : "denied");
export const desktopOn = () => {
  try { return desktopSupported() && Notification.permission === "granted" && localStorage.getItem(DESK_KEY) === "1"; } catch { return false; }
};
export const setDesktopOff = () => { try { localStorage.setItem(DESK_KEY, "0"); } catch { /* ignore */ } };
/* запит дозволу — лише з кліку користувача */
export async function enableDesktop() {
  if (!desktopSupported()) return "denied";
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm === "granted") { try { localStorage.setItem(DESK_KEY, "1"); } catch { /* ignore */ } }
  return perm;
}

let ctx = null;
const audio = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
};
/* браузер дозволяє звук лише після першої дії користувача — «розблоковуємо» на першому кліку/натисканні */
export function initAlertUnlock() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    const c = audio();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
}

export function playChime() {
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  [[880, 0], [1175, 0.16]].forEach(([freq, at]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + at);
    g.gain.exponentialRampToValueAtTime(0.22, now + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.32);
    o.connect(g).connect(c.destination);
    o.start(now + at);
    o.stop(now + at + 0.34);
  });
}

function showDesktop(n, onClick) {
  const opts = { body: n.body || "", icon: "/pwa-192.png", tag: n.id ? `n-${n.id}` : undefined };
  try {
    const x = new Notification(n.title || "Dnipro-M", opts);
    x.onclick = () => { try { window.focus(); } catch { /* ignore */ } x.close(); if (onClick) onClick(); };
  } catch {
    // деякі браузери (мобільні) дозволяють лише через service worker
    navigator.serviceWorker?.ready?.then((reg) => reg.showNotification(n.title || "Dnipro-M", { ...opts, badge: "/pwa-192.png", data: { url: "/" } })).catch(() => {});
  }
}

/* нове сповіщення: звук — завжди (якщо ввімкнено), на екран — коли вкладка прихована чи вікно не в фокусі */
export function alertNew(n, onClick) {
  if (soundOn()) playChime();
  if (desktopOn() && (document.hidden || !document.hasFocus())) showDesktop(n, onClick);
}
