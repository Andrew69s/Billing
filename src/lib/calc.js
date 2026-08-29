import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";

/* Розрахунок мотивації тепер на сервері (Edge Function «calc»).
   Формули й таблиці у браузер не потрапляють. */

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke("calc", { body });
  if (error) {
    // Edge Function повертає {error} з кодом 4xx — витягнемо текст
    let msg = error.message || "calc error";
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export const calcTm = (data, grade, tmKey, ym) => invoke({ op: "tm", data, grade, tmKey, ym });
export const calcTmBatch = (items) => invoke({ op: "tm-batch", items });
export const calcSm = (data, salonKey, ym) => invoke({ op: "sm", data, salonKey, ym });
export const calcSmBatch = (items) => invoke({ op: "sm-batch", items });
export const getConditions = () => invoke({ op: "conditions" });
export const getCalcMeta = () => invoke({ op: "meta" });

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
  useEffect(() => {
    const my = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      busyInc();
      fn()
        .then((calc) => { if (my === seq.current) setState({ calc, loading: false, error: null }); })
        .catch((e) => { if (my === seq.current) setState((s) => ({ calc: s.calc, loading: false, error: e.message })); })
        .finally(busyDec);
    }, delay);
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
