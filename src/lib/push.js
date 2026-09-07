import { supabase } from "./supabase.js";

/* Web Push — підписка пристрою на ранкові сповіщення. */

export const VAPID_PUBLIC_KEY =
  "BNI9LQELxtTaOycMVvuA0u2Z7s4gpDBscOB6QGbmboyaWKlzM74SwD4wR2E011HIQSoPSRgaZ2w0FDsq6Ikz40U";

export function pushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getReg() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg || navigator.serviceWorker.ready;
}

/* поточний стан: "unsupported" | "denied" | "on" | "off" */
export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await getReg();
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush(cabinetKey) {
  if (!pushSupported()) throw new Error("Пристрій не підтримує сповіщення");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Дозвіл на сповіщення не надано");

  const reg = await getReg();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const j = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      cabinet_key: cabinetKey,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      ua: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function disablePush() {
  try {
    const reg = await getReg();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) { console.error("disablePush:", e); }
}
