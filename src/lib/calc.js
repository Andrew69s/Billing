import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";

/* Розрахунок мотивації тепер на сервері (Edge Function «calc»).
   Формули й таблиці у браузер не потрапляють. */

async function invoke(body, _retried = false) {
  const { data, error } = await supabase.functions.invoke("calc", { body });
  if (error) {
    // Edge Function повертає {error} з кодом 4xx — витягнемо текст
    let msg = error.message || "calc error";
    let status = 0;
    try { status = error.context?.status || 0; } catch { /* ignore */ }
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    // токен доступу міг протухнути (вкладка відкрита годинами) — оновлюємо сесію й пробуємо ще раз
    if (!_retried && (status === 401 || /unauthorized|no auth|jwt/i.test(msg))) {
      const { data: s } = await supabase.auth.refreshSession().catch(() => ({ data: null }));
      if (s?.session) return invoke(body, true);
      throw new Error("Сесія застаріла — увійдіть знову");
    }
    throw new Error(msg);
  }
  return data;
}

/* Розрахунку потрібні лише числові блоки — скрін-и (base64, до ~200 КБ),
   історія, снапшоти й прапорці керівника лише роздували б payload і гальмували
   (аж до таймауту). Вирізаємо їх перед відправкою. */
const CALC_OMIT = new Set([
  "screenshots", "history", "tmSnapshot", "smSnapshot",
  "correctionDiff", "managerFlags", "managerComment", "tmReplyComment",
]);
const slimData = (data) => {
  if (!data || typeof data !== "object") return data;
  const out = {};
  for (const k of Object.keys(data)) if (!CALC_OMIT.has(k)) out[k] = data[k];
  return out;
};
const slimItems = (items) => (items || []).map((it) => ({ ...it, data: slimData(it.data) }));

export const calcTm = (data, grade, tmKey, ym) => invoke({ op: "tm", data: slimData(data), grade, tmKey, ym });
export const calcTmBatch = (items) => invoke({ op: "tm-batch", items: slimItems(items) });
export const calcSm = (data, salonKey, ym) => invoke({ op: "sm", data: slimData(data), salonKey, ym });
export const calcSmBatch = (items) => invoke({ op: "sm-batch", items: slimItems(items) });
export const getConditions = () => invoke({ op: "conditions" });
export const getCalcMeta = () => invoke({ op: "meta" });
/* прогрів Edge-функції (щоб перший розрахунок ЗП не чекав холодний старт) */
let _warmedAt = 0;
export function warmCalc() {
  const now = Date.now();
  if (now - _warmedAt < 120_000) return; // не частіше, ніж раз на 2 хв
  _warmedAt = now;
  invoke({ op: "meta" }).catch(() => {});
}

/* ---- глобальний індикатор «іде розрахунок» (показуємо у шапці, не в потоці) ---- */
let _busy = 0;
const busyBus = typeof window !== "undefined" ? new EventTarget() : null;
const busyInc = () => { _busy += 1; if (_busy === 1) busyBus?.dispatchEvent(new Event("c")); };
const busyDec = () => { _busy = Math.max(0, _busy - 1); if (_busy === 0) busyBus?.dispatchEvent(new Event("c")); };
export const calcBusyNow = () => _busy > 0;
export function subscribeCalcBusy(cb) {
  const h = () => cb(_busy > 0);
  busyBus?.addEventListener("c", h);
  return () => busyBus?.removeEventListener("c", h);
}

/* ---- хуки з debounce ---- */
function useDebouncedCalc(fn, deps, delay = 400) {
  const [state, setState] = useState({ calc: null, loading: true, error: null });
  const seq = useRef(0);
  const first = useRef(true);
  useEffect(() => {
    const my = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    // перший розрахунок (маунт) — одразу, без затримки; далі debounce на введення
    const wait = first.current ? 0 : delay;
    first.current = false;
    const run = () => {
      busyInc();
      fn()
        .then((calc) => { if (my === seq.current) setState({ calc, loading: false, error: null }); })
        .catch((e) => { if (my === seq.current) setState((s) => ({ calc: s.calc, loading: false, error: e.message })); })
        .finally(busyDec);
    };
    if (wait === 0) { run(); return undefined; }
    const t = setTimeout(run, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useTmCalc(data, grade, tmKey, ym, delay = 400) {
  return useDebouncedCalc(
    () => calcTm(data, grade, tmKey, ym),
    [JSON.stringify(data), grade, tmKey, ym],
    delay,
  );
}

export function useSmCalc(data, salonKey, ym, delay = 400) {
  return useDebouncedCalc(
    () => calcSm(data, salonKey, ym),
    [JSON.stringify(data), salonKey, ym],
    delay,
  );
}
