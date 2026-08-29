import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import _ from "lodash";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Camera, X, ChevronLeft, Check, AlertTriangle, TrendingUp, Users, ClipboardList, Pencil,
  Store, Calculator, LogIn, Wallet, User, Clock,
} from "lucide-react";
import {
  MANAGER, ACCOUNTANT, OFFICE, TMS, SALONS, salonLabel, salonByKey, salonsOfTm, tmByKey,
  ensureCredentialsSeeded, verifyLogin,
  ADMIN_KEY, ADMIN_NAME, isAdminCab, requestRecovery, listRecoveryRequests, clearRecovery, confirmRecovery,
} from "./org.js";
import {
  calcSmAll, emptySmData, SM_FIELD_LABELS, SM_CATEGORIES, PLAN_BRACKETS,
  categoryOf, normDaysOff, MANAGER_COEFS,
} from "./smCalc.js";
import { TM_CONDITIONS, SM_CONDITIONS } from "./conditions.js";

/* =========================================================
   CONSTANTS & HELPERS
========================================================= */
const TM_LIST = TMS.map((t) => ({ key: t.key, name: t.name }));
const MANAGER_NAME = MANAGER.name;
const MONTH_NAMES = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const MONTH_GEN = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
const GRADE_MIN = { 1: 60000, 2: 50000, 3: 45000 };

const pad = (n) => String(n).padStart(2, "0");
const nowYm = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const ymToQuarter = (ym) => { const [y, m] = ym.split("-").map(Number); return `${y}-Q${Math.ceil(m / 3)}`; };
const quarterMonths = (qKey) => {
  const [y, qs] = qKey.split("-Q");
  const q = Number(qs);
  const start = (q - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${y}-${pad(start + i)}`);
};
const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; };
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
const salonWord = (n) => plural(n, "салон", "салони", "салонів");
const recentMonths = (n = 12) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - i, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
};
const fmt = (n) => Math.round(n || 0).toLocaleString("uk-UA") + " грн";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ЗП за місяць M подають до 10-го числа наступного місяця (M+1) */
function deadlineInfo(ym) {
  const [y, m] = ym.split("-").map(Number); // m — 1-based
  const due = new Date(y, m, 10, 23, 59, 59); // місяць-індекс m = наступний місяць
  const now = new Date();
  const monthStart = new Date(y, m - 1, 1);
  return {
    due,
    dueLabel: `10 ${MONTH_GEN[due.getMonth()]} ${due.getFullYear()}`,
    overdue: now > due,
    future: monthStart > now,
  };
}
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("uk-UA") : "—");
const selectOnFocus = (e) => e.target.select();

function emptyData() {
  return {
    block1: {
      salesPlan: 0, salesFact: 0, salesEz: 0,   // 1.1
      lflPrev: 0, lflCurrent: 0,                // 1.2
      smPlanMet: {},                            // 1.3 { [salonKey]: bool }
    },
    block2: {
      callsPlanMet: false, callsRevenue: 0, callsFact: 0, callsCostNorm: 0, // 2.1
      rentabilityByStore: {},                   // 2.2 { [salonKey]: percent }
      pbiTotalRevenue: 0, pbiRevenue: 0,        // 2.3
      profitByStore: {},                        // 2.4 { [salonKey]: percent }
    },
    block3: {
      staffPlan: 0, staffFact: 0,               // 3.1
      violationsCount: 0,                       // 3.2
      scheduleViolationsCount: 0,               // 3.3
      smViolationsFound: 0, smViolationsUnfixed: 0, // 3.4
      merchViolationsCount: 0,                  // 3.5
      trainingScore: 0,                         // 3.6
    },
    ez: { revenue: 0, profitabilityPercent: 0, och: 0, np: 0, acquiring: 0, taxes: 0 },
    screenshots: {},          // { [key]: [dataURL, ...] } — до 5 на пункт
    managerFlags: {},         // { [itemNum]: { flagged: bool, comment: string } }
    submittedAt: null,
    status: "draft",          // draft | submitted | corrected | approved
    approvedAt: null,
    tmSnapshot: null,
    managerComment: "",
    correctionDiff: [],
    correctedAt: null,
    tmReplyComment: "",
    tmRepliedAt: null,
    paymentStatus: "none",    // none | to_pay | paid
    paymentStatusAt: null,
  };
}

/* нормалізація скрінів: раніше зберігали рядок, тепер масив (до 5) */
function shotList(v) {
  if (!v) return [];
  return Array.isArray(v) ? v.slice(0, 5) : [v];
}
const makeAddShot = (setData) => (key, url) => setData((prev) => {
  const cur = shotList(prev.screenshots?.[key]);
  return _.set(_.cloneDeep(prev), ["screenshots", key], [...cur, url].slice(0, 5));
});
const makeRemoveShot = (setData) => (key, i) => setData((prev) => {
  const cur = shotList(prev.screenshots?.[key]);
  return _.set(_.cloneDeep(prev), ["screenshots", key], cur.filter((_x, j) => j !== i));
});

/* =========================================================
   CALCULATION ENGINE (мотивація ТМ)
========================================================= */
function rowOf(v, edges) { return v < edges[0] ? 0 : v < edges[1] ? 1 : v <= edges[2] ? 2 : 3; }
const GI = (grade) => clamp((grade || 2) - 1, 0, 2);

const SALES_TABLE = [[15000, 10000, 5000], [20000, 15000, 10000], [25000, 20000, 15000], [30000, 25000, 20000]];
const LFL_TABLE = [[4000, 3000, 2000], [10000, 8000, 6000], [20000, 16000, 12000], [25000, 20000, 15000]];
const SM13_TABLE = [[3000, 2000, 1000], [10000, 8000, 6000], [16000, 14000, 12000], [20000, 18000, 16000]];

/* 1.1 — План / Факт / ЕЗ → % = (Факт − ЕЗ) / План */
function calcSales(b1, grade) {
  const factNet = (b1.salesFact || 0) - (b1.salesEz || 0);
  const pct = b1.salesPlan > 0 ? (factNet / b1.salesPlan) * 100 : 0;
  const bonus = SALES_TABLE[rowOf(pct, [90, 100, 110])][GI(grade)];
  return { factNet, pct, bonus };
}
/* 1.2 — Попередній / Поточний період → % приросту */
function calcLfl(b1, grade) {
  const growth = (b1.lflCurrent || 0) - (b1.lflPrev || 0);
  const pct = b1.lflPrev > 0 ? (growth / b1.lflPrev) * 100 : 0;
  const bonus = LFL_TABLE[rowOf(pct, [25, 35, 45])][GI(grade)];
  return { growth, pct, bonus };
}
/* 1.3 — галочки по салонах ТМ → % = виконали / всього */
function calcSm13(b1, grade, salonKeys) {
  const total = salonKeys.length;
  const met = salonKeys.filter((k) => b1.smPlanMet?.[k]).length;
  const pct = total > 0 ? (met / total) * 100 : 0;
  const bonus = SM13_TABLE[rowOf(pct, [50, 75, 100])][GI(grade)];
  return { total, met, pct, bonus };
}

/* 2.1 — галочка «план виконано» + оборот + к-ть + норма вартості дзвінка */
function calcCalls(b2) {
  if (!b2.callsPlanMet || !b2.callsFact || !b2.callsCostNorm) return { avgCost: 0, ratio: 0, pct: 0, bonus: 0 };
  const avgCost = (b2.callsRevenue || 0) / b2.callsFact;
  const ratio = (avgCost / b2.callsCostNorm) * 100;
  const pct = ratio < 90 ? 0.5 : ratio <= 110 ? 1 : 1.5;
  return { avgCost, ratio, pct, bonus: (b2.callsRevenue || 0) * (pct / 100) };
}
/* 2.2 — рентабельність по кожному магазину → середнє по території */
function calcRent(b2, salonKeys) {
  const total = salonKeys.length;
  const filled = salonKeys.filter((k) => {
    const x = b2.rentabilityByStore?.[k];
    return x !== undefined && x !== "" && x !== null;
  });
  const avg = total > 0
    ? salonKeys.reduce((s, k) => s + (Number(b2.rentabilityByStore?.[k]) || 0), 0) / total
    : 0;
  const bonus = avg < 25 ? 0 : avg <= 27 ? 5000 : 10000;
  return { avg, filled: filled.length, total, bonus };
}
/* 2.3 — без умови виконання плану */
function calcPbi(b2) {
  const total = b2.pbiTotalRevenue || 0;
  const percent = total > 0 ? ((b2.pbiRevenue || 0) / total) * 100 : 0;
  const bp = percent < 15 ? 0.2 : percent <= 20 ? 0.5 : 0.7;
  return { percent, bonus: total * (bp / 100) };
}
/* 2.4 — прибутковість по кожному магазину → сума балів */
function calcStores(b2, salonKeys) {
  return salonKeys.reduce((sum, k) => {
    const p = Number(b2.profitByStore?.[k]) || 0;
    return sum + (p < 0 ? -2000 : p <= 5 ? 0 : p <= 10 ? 2000 : 5000);
  }, 0);
}

/* 3.1 — планова / фактична к-ть співробітників → % */
function calcStaff(b3) {
  const pct = b3.staffPlan > 0 ? ((b3.staffFact || 0) / b3.staffPlan) * 100 : 0;
  const bonus = pct < 75 ? 0 : pct <= 90 ? 2000 : pct <= 99 ? 4000 : 8000;
  return { pct, bonus };
}
/* 3.2 — 0 порушень → +1000; ≥1 → штраф −200 за кожне (без +1000) */
function calcViolations32(count) {
  const c = count || 0;
  return c === 0 ? 1000 : Math.max(-1000, -200 * c);
}
function calcCapped1000(count) { return clamp(1000 - 200 * (count || 0), -1000, 1000); }
function calcSmState(smCount, found, unfixed) { return 500 * smCount - 100 * (found || 0) - 200 * (unfixed || 0); }
function calcTraining(score) {
  if (score < 90) return -1000;
  if (score < 95) return 0;
  if (score < 98) return 1000;
  return 2000;
}
function calcBlock3(b3, salonCount) {
  const staff = calcStaff(b3).bonus;
  const violations = calcViolations32(b3.violationsCount);
  const schedule = calcCapped1000(b3.scheduleViolationsCount);
  const smState = calcSmState(salonCount, b3.smViolationsFound, b3.smViolationsUnfixed);
  const merch = calcCapped1000(b3.merchViolationsCount);
  const training = calcTraining(b3.trainingScore);
  const rawSubtotal = staff + violations + schedule + smState + merch + training;
  return { staff, violations, schedule, smState, merch, training, rawSubtotal, subtotal: Math.min(rawSubtotal, 15000) };
}

/* ЕЗ — додано «Податки» до відрахувань */
function calcEz(ez) {
  const netProfit = (ez.revenue || 0) * ((ez.profitabilityPercent || 0) / 100);
  const ezValue = netProfit - (ez.och || 0) - (ez.np || 0) - (ez.acquiring || 0) - (ez.taxes || 0);
  return { netProfit, ezValue, bonus: ezValue * 0.10 };
}

function calcAll(data, grade, tmKey) {
  const salonKeys = salonsOfTm(tmKey || TMS[0].key).map((s) => s.key);
  const salonCount = salonKeys.length;

  const sales = calcSales(data.block1, grade);
  const lfl = calcLfl(data.block1, grade);
  const sm13 = calcSm13(data.block1, grade, salonKeys);
  const b1 = { sales: sales.bonus, lfl: lfl.bonus, sm: sm13.bonus, subtotal: sales.bonus + lfl.bonus + sm13.bonus, d: { sales, lfl, sm13 } };

  const calls = calcCalls(data.block2);
  const rent = calcRent(data.block2, salonKeys);
  const pbi = calcPbi(data.block2);
  const stores = calcStores(data.block2, salonKeys);
  const b2 = { calls: calls.bonus, rentability: rent.bonus, pbi: pbi.bonus, pbiPercent: pbi.percent, stores, subtotal: calls.bonus + rent.bonus + pbi.bonus + stores, d: { calls, rent, pbi } };

  const b3 = calcBlock3(data.block3, salonCount);
  const staff = calcStaff(data.block3);
  b3.d = { staff };

  const ez = calcEz(data.ez);
  const beforeFloor = b1.subtotal + b2.subtotal + b3.subtotal + ez.bonus;
  const min = GRADE_MIN[grade] || GRADE_MIN[2];
  const floored = Math.max(beforeFloor, min);
  return { b1, b2, b3, ez, beforeFloor, floored, floorApplied: beforeFloor < min, min, salonKeys, salonCount };
}

/* =========================================================
   STORAGE
========================================================= */
async function loadData(tmKey, ym) {
  try {
    const r = await window.storage.get(`data:${tmKey}:${ym}`, true);
    return r ? { ...emptyData(), ...JSON.parse(r.value) } : emptyData();
  } catch { return emptyData(); }
}
async function saveData(tmKey, ym, data) {
  try { await window.storage.set(`data:${tmKey}:${ym}`, JSON.stringify(data), true); } catch (e) { console.error(e); }
}
async function loadAdj(tmKey, ym) {
  try { const r = await window.storage.get(`adj:${tmKey}:${ym}`, true); return r ? { amount: 0, comment: "", advance: 0, ...JSON.parse(r.value) } : { amount: 0, comment: "", advance: 0 }; }
  catch { return { amount: 0, comment: "", advance: 0 }; }
}
async function saveAdj(tmKey, ym, adj) {
  try { await window.storage.set(`adj:${tmKey}:${ym}`, JSON.stringify(adj), true); } catch (e) { console.error(e); }
}
async function loadGrade(tmKey, qKey) {
  try { const r = await window.storage.get(`grade:${tmKey}:${qKey}`, true); return r ? Number(r.value) : 2; }
  catch { return 2; }
}
async function saveGrade(tmKey, qKey, grade) {
  try { await window.storage.set(`grade:${tmKey}:${qKey}`, String(grade), true); } catch (e) { console.error(e); }
}
async function loadQBonus(tmKey, qKey) {
  try {
    const r = await window.storage.get(`qbonus:${tmKey}:${qKey}`, true);
    return r ? JSON.parse(r.value) : { bonus41: 0, bonus42: 0, overExecOverride: 0, allMet: false };
  } catch { return { bonus41: 0, bonus42: 0, overExecOverride: 0, allMet: false }; }
}
async function saveQBonus(tmKey, qKey, qb) {
  try { await window.storage.set(`qbonus:${tmKey}:${qKey}`, JSON.stringify(qb), true); } catch (e) { console.error(e); }
}
async function listMonths(tmKey) {
  try {
    const r = await window.storage.list(`data:${tmKey}:`, true);
    return (r?.keys || []).map((k) => k.replace(`data:${tmKey}:`, ""));
  } catch { return []; }
}
/* ---------- СМ: сховище розрахунків салонів ---------- */
async function loadSmData(salonKey, ym) {
  try {
    const r = await window.storage.get(`smdata:${salonKey}:${ym}`, true);
    return r ? { ...emptySmData(), ...JSON.parse(r.value) } : emptySmData();
  } catch { return emptySmData(); }
}
async function saveSmData(salonKey, ym, data) {
  try { await window.storage.set(`smdata:${salonKey}:${ym}`, JSON.stringify(data), true); } catch (e) { console.error(e); }
}
async function listSmMonths(salonKey) {
  try {
    const r = await window.storage.list(`smdata:${salonKey}:`, true);
    return (r?.keys || []).map((k) => k.replace(`smdata:${salonKey}:`, ""));
  } catch { return []; }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */
function Field({ label, value, onChange, suffix, full, readOnly }) {
  return (
    <label className={`field ${full ? "field-full" : ""}`}>
      <span className="field-label">{label}</span>
      {readOnly ? (
        <div className="field-value">{value ?? 0}{suffix ? ` ${suffix}` : ""}</div>
      ) : (
        <div className="field-input-wrap">
          <input type="number" className="field-input" value={value ?? 0} onFocus={selectOnFocus}
            onChange={(e) => onChange(Number(e.target.value))} />
          {suffix && <span className="field-suffix">{suffix}</span>}
        </div>
      )}
    </label>
  );
}
function CheckField({ label, checked, onChange, readOnly }) {
  if (readOnly) {
    return <div className="check-field"><span className={`check-dot ${checked ? "on" : ""}`} />{label}</div>;
  }
  return (
    <label className="check-field">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
function PasteShotModal({ startCount, onClose, onAdd }) {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(startCount);
  const inputRef = React.useRef(null);
  const full = count >= 5;

  const handleFile = async (file) => {
    if (!file || !file.type?.startsWith("image/") || count >= 5) return;
    setBusy(true);
    try {
      const url = await resizeImage(file);
      onAdd(url);
      setCount((x) => Math.min(5, x + 1));
    } catch (e) { console.error(e); }
    setBusy(false);
  };

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith("image/")) {
          e.preventDefault();
          handleFile(it.getAsFile());
          return;
        }
      }
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("paste", onPaste); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="paste-modal" onClick={(e) => e.stopPropagation()}>
        <div className="info-modal-head">
          <span className="info-modal-title">Додати скрін · {count}/5</span>
          <button className="modal-close info-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <button
          type="button"
          className="paste-zone"
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !full && inputRef.current?.click()}
        >
          {busy ? (
            <span>Обробка…</span>
          ) : full ? (
            <span>Максимум — 5 скрінів</span>
          ) : (
            <>
              <Camera size={22} />
              <b>Вставте скрін з буфера — Ctrl+V (⌘V)</b>
              <span>або перетягніть сюди / натисніть, щоб вибрати файл</span>
            </>
          )}
        </button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="paste-actions">
          <button className="btn-primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScreenshotStack({ shots, onAdd, onRemove, onPreview, readOnly }) {
  const [adding, setAdding] = useState(false);
  const list = shotList(shots);
  return (
    <div className="shot-stack">
      {list.map((url, i) => (
        <div className="shot-thumb" key={i} onClick={() => onPreview(url)}>
          <img src={url} alt={`скрін ${i + 1}`} />
          {!readOnly && (
            <button className="shot-remove" onClick={(e) => { e.stopPropagation(); onRemove(i); }}><X size={12} /></button>
          )}
        </div>
      ))}
      {!readOnly && list.length < 5 && (
        <button type="button" className="shot-add" onClick={() => setAdding(true)}>
          <Camera size={14} /><span>скрін</span>
        </button>
      )}
      {readOnly && list.length === 0 && <div className="shot-empty">немає скрінів</div>}
      {adding && (
        <PasteShotModal startCount={list.length} onAdd={onAdd} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
function ConditionsBlocks({ blocks }) {
  return (
    <div className="cond-blocks">
      {blocks.map((b, i) => {
        if (b.p) return <p key={i} className="cond-p">{b.p}</p>;
        if (b.note) return <p key={i} className="cond-note">{b.note}</p>;
        if (b.ul) return (
          <ul key={i} className="cond-ul">{b.ul.map((li, j) => <li key={j}>{li}</li>)}</ul>
        );
        if (b.table) return (
          <div key={i} className="cond-table-wrap">
            <table className="cond-table">
              <thead><tr>{b.table.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
              <tbody>
                {b.table.rows.map((r, j) => (
                  <tr key={j}>{r.map((c, k) => <td key={k} className={k === 0 ? "cond-td-label" : ""}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        return null;
      })}
    </div>
  );
}

function InfoModal({ title, blocks, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="info-modal-head">
          <span className="info-modal-title">{title}</span>
          <button className="modal-close info-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="info-modal-body">
          <ConditionsBlocks blocks={blocks} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Item({
  num, title, amount, children, screenshotKey, screenshots,
  onAddShot, onRemoveShot, onPreview, readOnly, conditions,
  flag, managerMode, onFlag, headerNote,
}) {
  const [showCond, setShowCond] = useState(false);
  const [editFlag, setEditFlag] = useState(false);
  const flagged = !!flag?.flagged;
  return (
    <div className={`item ${flagged ? "item-flagged" : ""}`}>
      <div className="item-head">
        <span className="item-num">{num}</span>
        <span className="item-title">{title}{headerNote ? <span className="item-note"> · {headerNote}</span> : null}</span>
        {amount !== undefined && (
          <span className={`item-amount ${amount < 0 ? "neg" : amount > 0 ? "pos" : ""}`}>{fmt(amount)}</span>
        )}
        {conditions && (
          <button type="button" className="item-cond" onClick={() => setShowCond(true)}>Умови</button>
        )}
        {managerMode && (
          <button type="button" className={`item-flagbtn ${flagged ? "on" : ""}`} onClick={() => setEditFlag((v) => !v)}>
            <Pencil size={12} /> {flagged ? "Корективу внесено" : "Внести корективи"}
          </button>
        )}
      </div>

      {managerMode && editFlag && (
        <div className="item-flag-editor">
          <textarea
            rows={2} placeholder="Що виправити в цьому пункті (побачить ТМ)"
            value={flag?.comment || ""}
            onChange={(e) => onFlag(num, { flagged: true, comment: e.target.value })}
          />
          <div className="item-flag-actions">
            <button className="btn-secondary small" onClick={() => { onFlag(num, { flagged: false, comment: "" }); setEditFlag(false); }}>Прибрати</button>
            <button className="btn-secondary small" onClick={() => setEditFlag(false)}>Готово</button>
          </div>
        </div>
      )}
      {!managerMode && flagged && (
        <div className="item-flag-note"><b>Керівник просить виправити:</b> {flag.comment || "—"}</div>
      )}

      {showCond && conditions && (
        <InfoModal title={conditions.title} blocks={conditions.blocks} onClose={() => setShowCond(false)} />
      )}
      <div className="item-body">
        <div className="item-fields">{children}</div>
        <ScreenshotStack
          shots={screenshots?.[screenshotKey]}
          onAdd={(url) => onAddShot && onAddShot(screenshotKey, url)}
          onRemove={(i) => onRemoveShot && onRemoveShot(screenshotKey, i)}
          onPreview={onPreview}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
const TmItem = (props) => <Item {...props} conditions={TM_CONDITIONS[props.num]} />;
const SmItem = (props) => <Item {...props} conditions={SM_CONDITIONS[props.num]} />;
function BlockHeader({ n, title }) {
  return (
    <div className="block-header">
      <span className="block-header-n">Блок {n}</span>
      <span className="block-header-title">{title}</span>
    </div>
  );
}
function ImageModal({ src, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <img src={src} alt="скрін" />
      </div>
    </div>
  );
}
function TopBar({ title, onBack, onLogout }) {
  return (
    <div className="topbar">
      <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> Назад</button>
      <span className="topbar-title">{title}</span>
      {onLogout && (
        <button className="topbar-logout" onClick={onLogout}>Вийти</button>
      )}
    </div>
  );
}

/* =========================================================
   CRITERIA FORM (shared by TM and Manager views)
========================================================= */
function SalonCheckRows({ salons, values, onToggle, readOnly }) {
  return (
    <div className="salon-rows field-full">
      {salons.map((s) => (
        <label className="salon-check-row" key={s.key}>
          <input type="checkbox" disabled={readOnly} checked={!!values?.[s.key]}
            onChange={(e) => onToggle(s.key, e.target.checked)} />
          <span>{salonLabel(s)}</span>
        </label>
      ))}
    </div>
  );
}
function SalonPctRows({ salons, values, onSet, readOnly, suffix = "%" }) {
  return (
    <div className="salon-rows field-full">
      {salons.map((s) => {
        const v = values?.[s.key];
        return (
          <div className="salon-pct-row" key={s.key}>
            <span className="salon-pct-name">{salonLabel(s)}</span>
            {readOnly ? (
              <span className="salon-pct-val">{v ?? 0}{suffix}</span>
            ) : (
              <span className="salon-pct-inputwrap">
                <input type="number" className="salon-pct-input" value={v ?? ""} onFocus={selectOnFocus}
                  onChange={(e) => onSet(s.key, e.target.value === "" ? "" : Number(e.target.value))} />
                <span className="salon-pct-suffix">{suffix}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CriteriaForm({ data, update, grade, showAmounts, onAddShot, onRemoveShot, onPreview, readOnly, tmKey, managerMode, onFlag }) {
  const salons = salonsOfTm(tmKey);
  const calc = calcAll(data, grade, tmKey);
  const setMap = (block, field, key, val) => update([block, field, key], val);
  const shot = { screenshots: data.screenshots, onAddShot, onRemoveShot, onPreview, readOnly, managerMode, onFlag };
  const flg = (num) => data.managerFlags?.[num];
  const A = (v) => (showAmounts ? v : undefined);
  const note = `магазинів: ${salons.length}`;

  return (
    <div className="criteria-form">
      <BlockHeader n="1" title="Фінансовий блок" />

      <TmItem num="1.1" title="Виконання плану продажів" amount={A(calc.b1.sales)} screenshotKey="sales" flag={flg("1.1")} {...shot}>
        <Field readOnly={readOnly} label="План продажів" suffix="грн" value={data.block1.salesPlan} onChange={(v) => update(["block1", "salesPlan"], v)} />
        <Field readOnly={readOnly} label="Факт продажів" suffix="грн" value={data.block1.salesFact} onChange={(v) => update(["block1", "salesFact"], v)} />
        <Field readOnly={readOnly} label="ЕЗ" suffix="грн" value={data.block1.salesEz} onChange={(v) => update(["block1", "salesEz"], v)} />
        {showAmounts && (
          <div className="ez-sub">
            <span>Факт без ЕЗ: {fmt(calc.b1.d.sales.factNet)}</span>
            <span>% виконання плану: {calc.b1.d.sales.pct.toFixed(1)}%</span>
          </div>
        )}
      </TmItem>

      <TmItem num="1.2" title="Зростання продажів (LFL)" amount={A(calc.b1.lfl)} screenshotKey="lfl" flag={flg("1.2")} {...shot}>
        <Field readOnly={readOnly} label="Попередній період" suffix="грн" value={data.block1.lflPrev} onChange={(v) => update(["block1", "lflPrev"], v)} />
        <Field readOnly={readOnly} label="Поточний період" suffix="грн" value={data.block1.lflCurrent} onChange={(v) => update(["block1", "lflCurrent"], v)} />
        {showAmounts && (
          <div className="ez-sub">
            <span>Приріст: {fmt(calc.b1.d.lfl.growth)}</span>
            <span>% LFL: {calc.b1.d.lfl.pct.toFixed(1)}%</span>
          </div>
        )}
      </TmItem>

      <TmItem num="1.3" title="% магазинів, що виконали план" amount={A(calc.b1.sm)} screenshotKey="smPlan" headerNote={note} flag={flg("1.3")} {...shot}>
        <SalonCheckRows salons={salons} values={data.block1.smPlanMet} readOnly={readOnly}
          onToggle={(k, v) => setMap("block1", "smPlanMet", k, v)} />
        {showAmounts && (
          <div className="ez-sub"><span>Виконали {calc.b1.d.sm13.met} з {calc.b1.d.sm13.total} · {calc.b1.d.sm13.pct.toFixed(0)}%</span></div>
        )}
      </TmItem>

      <BlockHeader n="2" title="Фокусні задачі" />

      <TmItem num="2.1" title="Дзвінки" amount={A(calc.b2.calls)} screenshotKey="calls" flag={flg("2.1")} {...shot}>
        <CheckField readOnly={readOnly} label="План по дзвінках виконано" checked={data.block2.callsPlanMet} onChange={(v) => update(["block2", "callsPlanMet"], v)} />
        <Field readOnly={readOnly} label="Оборот з дзвінків" suffix="грн" value={data.block2.callsRevenue} onChange={(v) => update(["block2", "callsRevenue"], v)} />
        <Field readOnly={readOnly} label="Кількість додзвонів" value={data.block2.callsFact} onChange={(v) => update(["block2", "callsFact"], v)} />
        <Field readOnly={readOnly} label="Норма вартості дзвінка" suffix="грн" value={data.block2.callsCostNorm} onChange={(v) => update(["block2", "callsCostNorm"], v)} />
        {showAmounts && data.block2.callsPlanMet && (
          <div className="ez-sub">
            <span>Середня вартість дзвінка: {fmt(calc.b2.d.calls.avgCost)}</span>
            <span>Показник: {calc.b2.d.calls.ratio.toFixed(0)}% → {calc.b2.d.calls.pct}%</span>
          </div>
        )}
      </TmItem>

      <TmItem num="2.2" title="Рентабельність" amount={A(calc.b2.rentability)} screenshotKey="rentability" headerNote={note} flag={flg("2.2")} {...shot}>
        <SalonPctRows salons={salons} values={data.block2.rentabilityByStore} readOnly={readOnly}
          onSet={(k, v) => setMap("block2", "rentabilityByStore", k, v)} />
        {showAmounts && (
          <div className="ez-sub"><span>Середня по території: {calc.b2.d.rent.avg.toFixed(1)}% (заповнено {calc.b2.d.rent.filled} з {calc.b2.d.rent.total})</span></div>
        )}
      </TmItem>

      <TmItem num="2.3" title="Продажі PBI" amount={A(calc.b2.pbi)} screenshotKey="pbi" flag={flg("2.3")} {...shot}>
        <Field readOnly={readOnly} label="Загальний оборот" suffix="грн" value={data.block2.pbiTotalRevenue} onChange={(v) => update(["block2", "pbiTotalRevenue"], v)} />
        <Field readOnly={readOnly} label="Оборот PBI" suffix="грн" value={data.block2.pbiRevenue} onChange={(v) => update(["block2", "pbiRevenue"], v)} />
        {showAmounts && <div className="ez-sub"><span>% PBI від обороту: {calc.b2.pbiPercent.toFixed(1)}%</span></div>}
      </TmItem>

      <TmItem num="2.4" title="Прибутковість магазинів" amount={A(calc.b2.stores)} screenshotKey="stores" headerNote={note} flag={flg("2.4")} {...shot}>
        <SalonPctRows salons={salons} values={data.block2.profitByStore} readOnly={readOnly}
          onSet={(k, v) => setMap("block2", "profitByStore", k, v)} />
      </TmItem>

      <BlockHeader n="3" title="Стандарти" />

      <TmItem num="3.1" title="Укомплектованість штату" amount={A(calc.b3.staff)} screenshotKey="staff" flag={flg("3.1")} {...shot}>
        <Field readOnly={readOnly} label="Планова к-ть співробітників" value={data.block3.staffPlan} onChange={(v) => update(["block3", "staffPlan"], v)} />
        <Field readOnly={readOnly} label="Фактична к-ть співробітників" value={data.block3.staffFact} onChange={(v) => update(["block3", "staffFact"], v)} />
        {showAmounts && <div className="ez-sub"><span>% укомплектованості: {calc.b3.d.staff.pct.toFixed(1)}%</span></div>}
      </TmItem>

      <TmItem num="3.2" title="Неприпустимі ситуації" amount={A(calc.b3.violations)} screenshotKey="violations" flag={flg("3.2")} {...shot}>
        <Field readOnly={readOnly} label="Кількість підтверджених порушень" value={data.block3.violationsCount} onChange={(v) => update(["block3", "violationsCount"], v)} />
        {showAmounts && (
          <div className="hint">
            {(data.block3.violationsCount || 0) === 0
              ? "Порушень немає → +1 000 грн"
              : `${data.block3.violationsCount} порушень → штраф ${fmt(calc.b3.violations)} (бонус +1 000 не нараховується)`}
          </div>
        )}
      </TmItem>

      <TmItem num="3.3" title="Дотримання графіків роботи" amount={A(calc.b3.schedule)} screenshotKey="schedule" flag={flg("3.3")} {...shot}>
        <Field readOnly={readOnly} label="Кількість порушень" value={data.block3.scheduleViolationsCount} onChange={(v) => update(["block3", "scheduleViolationsCount"], v)} />
      </TmItem>

      <TmItem num="3.4" title="Стандарти внутрішнього стану СМ" amount={A(calc.b3.smState)} screenshotKey="smState" headerNote={note} flag={flg("3.4")} {...shot}>
        <Field readOnly={readOnly} label="Порушень виявлено" value={data.block3.smViolationsFound} onChange={(v) => update(["block3", "smViolationsFound"], v)} />
        <Field readOnly={readOnly} label="Порушень не виправлено" value={data.block3.smViolationsUnfixed} onChange={(v) => update(["block3", "smViolationsUnfixed"], v)} />
      </TmItem>

      <TmItem num="3.5" title="Стандарт мерчандайзингу" amount={A(calc.b3.merch)} screenshotKey="merch" flag={flg("3.5")} {...shot}>
        <Field readOnly={readOnly} label="Кількість порушень" value={data.block3.merchViolationsCount} onChange={(v) => update(["block3", "merchViolationsCount"], v)} />
      </TmItem>

      <TmItem num="3.6" title="Проходження навчання (АКО)" amount={A(calc.b3.training)} screenshotKey="training" flag={flg("3.6")} {...shot}>
        <Field readOnly={readOnly} label="Середній бал, %" suffix="%" value={data.block3.trainingScore} onChange={(v) => update(["block3", "trainingScore"], v)} />
      </TmItem>

      <BlockHeader n="ЕЗ" title="Фінальний розрахунок" />
      <TmItem num="2.5" title="Енергозабезпечення (ЕЗ)" amount={A(calc.ez.bonus)} screenshotKey="ez" flag={flg("2.5")} {...shot}>
        <Field readOnly={readOnly} label="Сума продажів (оборот)" suffix="грн" value={data.ez.revenue} onChange={(v) => update(["ez", "revenue"], v)} />
        <Field readOnly={readOnly} label="Рентабельність" suffix="%" value={data.ez.profitabilityPercent} onChange={(v) => update(["ez", "profitabilityPercent"], v)} />
        <Field readOnly={readOnly} label="Витрати ОЧ (Оплата частинами)" suffix="грн" value={data.ez.och} onChange={(v) => update(["ez", "och"], v)} />
        <Field readOnly={readOnly} label="Витрати НП (Нова Пошта)" suffix="грн" value={data.ez.np} onChange={(v) => update(["ez", "np"], v)} />
        <Field readOnly={readOnly} label="Еквайринг" suffix="грн" value={data.ez.acquiring} onChange={(v) => update(["ez", "acquiring"], v)} />
        <Field readOnly={readOnly} label="Податки" suffix="грн" value={data.ez.taxes} onChange={(v) => update(["ez", "taxes"], v)} />
        {showAmounts && (
          <div className="ez-sub">
            <span>Чистий прибуток: {fmt(calc.ez.netProfit)}</span>
            <span>ЕЗ: {fmt(calc.ez.ezValue)}</span>
          </div>
        )}
      </TmItem>
    </div>
  );
}

/* =========================================================
   SALARY SUMMARY (collapsible drill-down + payment/advance)
========================================================= */
function SummaryBlock({ id, title, note, total, items, expanded, onToggle }) {
  return (
    <div className="summary-block">
      <button className="summary-row summary-toggle" onClick={() => onToggle(id)}>
        <span>{title}{note ? ` · ${note}` : ""} <span className="chevron">{expanded ? "▾" : "▸"}</span></span>
        <b>{fmt(total)}</b>
      </button>
      {expanded && (
        <div className="summary-detail">
          {items.map((it, i) => (
            <div className="summary-detail-row" key={i}>
              <span>{it.label}</span>
              <span className={it.amount < 0 ? "neg" : it.amount > 0 ? "pos" : ""}>{fmt(it.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SalarySummary({ data, grade, tmKey, adj, qbonus, isLastMonthOfQuarter, expandedBlock, onToggle, editable, onAdjChange, onSaveAdj, savingAdj, onSetPaymentStatus, monthLbl }) {
  const calc = useMemo(() => calcAll(data, grade, tmKey), [data, grade, tmKey]);
  const advance = adj.advance || 0;
  const grandTotal = calc.floored + (isLastMonthOfQuarter ? (qbonus.bonus41 + qbonus.bonus42) : 0) + (adj.amount || 0) - advance;

  const b1Items = [
    { label: "1.1 Виконання плану продажів", amount: calc.b1.sales },
    { label: "1.2 LFL", amount: calc.b1.lfl },
    { label: "1.3 % СМ, що виконали план", amount: calc.b1.sm },
  ];
  const b2Items = [
    { label: "2.1 Дзвінки", amount: calc.b2.calls },
    { label: "2.2 Рентабельність", amount: calc.b2.rentability },
    { label: `2.3 PBI (${(calc.b2.pbiPercent || 0).toFixed(1)}% від обороту)`, amount: calc.b2.pbi },
    { label: "2.4 Прибутковість магазинів", amount: calc.b2.stores },
  ];
  const b3Items = [
    { label: "3.1 Штат", amount: calc.b3.staff },
    { label: "3.2 Неприпустимі ситуації", amount: calc.b3.violations },
    { label: "3.3 Графіки роботи", amount: calc.b3.schedule },
    { label: "3.4 Стан СМ", amount: calc.b3.smState },
    { label: "3.5 Мерчандайзинг", amount: calc.b3.merch },
    { label: "3.6 Навчання", amount: calc.b3.training },
  ];
  const ezItems = [
    { label: "Чистий прибуток", amount: calc.ez.netProfit },
    { label: "ЕЗ (база)", amount: calc.ez.ezValue },
    { label: "Бонус (10% від ЕЗ)", amount: calc.ez.bonus },
  ];

  return (
    <div className="summary">
      <SummaryBlock id="b1" title="Блок 1 (Фінансовий)" total={calc.b1.subtotal} items={b1Items} expanded={expandedBlock === "b1"} onToggle={onToggle} />
      <SummaryBlock id="b2" title="Блок 2 (Фокусні задачі)" total={calc.b2.subtotal} items={b2Items} expanded={expandedBlock === "b2"} onToggle={onToggle} />
      <SummaryBlock id="b3" title="Блок 3 (Стандарти)" note={calc.b3.rawSubtotal > 15000 ? "обмежено стелею 15 000" : null} total={calc.b3.subtotal} items={b3Items} expanded={expandedBlock === "b3"} onToggle={onToggle} />
      <SummaryBlock id="ez" title="ЕЗ (енергозабезпечення)" total={calc.ez.bonus} items={ezItems} expanded={expandedBlock === "ez"} onToggle={onToggle} />

      <div className="summary-row total"><span>Разом до застосування мінімуму</span><b>{fmt(calc.beforeFloor)}</b></div>
      {calc.floorApplied && (
        <div className="summary-row floor-note"><span>Застосовано гарантований мінімум (грейд {grade})</span><b>{fmt(calc.min)}</b></div>
      )}
      {isLastMonthOfQuarter && (qbonus.bonus41 > 0 || qbonus.bonus42 > 0) && (
        <div className="summary-row"><span>Квартальний бонус</span><b>{fmt(qbonus.bonus41 + qbonus.bonus42)}</b></div>
      )}

      {editable ? (
        <>
          <div className="adj-row">
            <span>Додатково (керівник)</span>
            <input className="adj-comment" placeholder="напр. премія за ініціативу" value={adj.comment} onChange={(e) => onAdjChange({ ...adj, comment: e.target.value })} />
            <input className="adj-amount" type="number" value={adj.amount} onFocus={selectOnFocus} onChange={(e) => onAdjChange({ ...adj, amount: Number(e.target.value) })} />
            <span>грн</span>
          </div>
          <div className="adj-row">
            <span>Аванс (вирахувати)</span>
            <input className="adj-amount" type="number" value={adj.advance || 0} onFocus={selectOnFocus} onChange={(e) => onAdjChange({ ...adj, advance: Number(e.target.value) })} />
            <span>грн</span>
            <button className="btn-secondary small" onClick={onSaveAdj} disabled={savingAdj}>{savingAdj ? "…" : "Зберегти"}</button>
          </div>
        </>
      ) : (
        <>
          {(adj.amount || 0) !== 0 && (
            <div className="summary-row"><span>Додатково{adj.comment ? ` (${adj.comment})` : ""}</span><b>{fmt(adj.amount)}</b></div>
          )}
          {(adj.advance || 0) !== 0 && (
            <div className="summary-row"><span>Аванс (вирахувано)</span><b>-{fmt(adj.advance)}</b></div>
          )}
        </>
      )}

      <div className="summary-row grand"><span>Загальна ЗП за {monthLbl}</span><b>{fmt(grandTotal)}</b></div>

      <div className="payment-row">
        <span>Статус виплати:</span>
        <span className={`badge ${data.paymentStatus === "paid" ? "badge-ok" : data.paymentStatus === "to_pay" ? "badge-warn" : "badge-off"}`}>
          {data.paymentStatus === "paid" ? "Виплачено" : data.paymentStatus === "to_pay" ? "До виплати" : "Не підтверджено"}
        </span>
        {editable && data.paymentStatus !== "to_pay" && data.paymentStatus !== "paid" && (
          <button className="btn-secondary small" onClick={() => onSetPaymentStatus("to_pay")}>Позначити «До виплати»</button>
        )}
        {editable && data.paymentStatus === "to_pay" && (
          <button className="btn-secondary small" onClick={() => onSetPaymentStatus("paid")}>Позначити «Виплачено»</button>
        )}
        {editable && data.paymentStatus === "paid" && (
          <button className="btn-secondary small" onClick={() => onSetPaymentStatus("to_pay")}>Повернути «До виплати»</button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CORRECTIONS TAB (TM side)
========================================================= */
function CorrectionsTab({ data, onReply }) {
  const [reply, setReply] = useState(data.tmReplyComment || "");
  const [saving, setSaving] = useState(false);

  const flags = Object.entries(data.managerFlags || {}).filter(([, f]) => f?.flagged);
  if (!data.managerComment && flags.length === 0 && (!data.correctionDiff || data.correctionDiff.length === 0)) {
    return <div className="loading">Корективів від керівника ще немає.</div>;
  }

  const submit = async () => { setSaving(true); await onReply(reply); setSaving(false); };

  return (
    <div className="corrections-panel">
      <p className="hint">Внесено: {fmtDate(data.correctedAt)}</p>
      {data.managerComment && <div className="manager-comment">{data.managerComment}</div>}
      {flags.length > 0 && (
        <div className="flag-list">
          {flags.map(([num, f]) => (
            <div className="flag-list-row" key={num}>
              <span className="flag-list-num">{num}</span>
              <span className="flag-list-comment">{f.comment || "потребує коректив"}</span>
            </div>
          ))}
        </div>
      )}
      {data.correctionDiff?.length > 0 && (
        <div className="diff-list">
          {data.correctionDiff.map((d, i) => (
            <div className="diff-row" key={i}>
              <span className="diff-label">{d.label}</span>
              <span className="diff-old">{String(d.oldV)}</span>
              <span className="diff-arrow">→</span>
              <span className="diff-new">{String(d.newV)}</span>
            </div>
          ))}
        </div>
      )}
      <label className="over-field" style={{ maxWidth: "100%" }}>
        Ваш коментар керівнику
        <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
      </label>
      <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? "Надсилання…" : "Надіслати коментар"}</button>
      {data.tmRepliedAt && <p className="hint">Надіслано: {fmtDate(data.tmRepliedAt)}</p>}
    </div>
  );
}

/* =========================================================
   TM VIEW
========================================================= */
function TmView({ tmKey, tmName, onBack, embedded }) {
  const [ym, setYm] = useState(nowYm());
  const [data, setData] = useState(emptyData());
  const [adj, setAdj] = useState({ amount: 0, comment: "", advance: 0 });
  const [grade, setGrade] = useState(2);
  const [qbonus, setQbonus] = useState({ bonus41: 0, bonus42: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("form");
  const [expandedBlock, setExpandedBlock] = useState(null);

  const qKey = ymToQuarter(ym);
  const qMonths = quarterMonths(qKey);
  const isLastMonthOfQuarter = ym === qMonths[2];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTab("form");
    Promise.all([
      loadData(tmKey, ym),
      loadAdj(tmKey, ym),
      loadGrade(tmKey, qKey),
      isLastMonthOfQuarter ? loadQBonus(tmKey, qKey) : Promise.resolve({ bonus41: 0, bonus42: 0 }),
    ]).then(([d, a, g, qb]) => {
      if (active) { setData(d); setAdj(a); setGrade(g); setQbonus(qb); setLoading(false); }
    });
    return () => { active = false; };
  }, [tmKey, ym]);

  const update = (path, value) => setData((prev) => _.set(_.cloneDeep(prev), path, value));
  const onAddShot = makeAddShot(setData);
  const onRemoveShot = makeRemoveShot(setData);
  const toggleBlock = (id) => setExpandedBlock((prev) => (prev === id ? null : id));
  const persistGrade = async (g) => { setGrade(g); await saveGrade(tmKey, qKey, g); };

  const submit = async () => {
    setSaving(true);
    const snapshot = _.cloneDeep({ block1: data.block1, block2: data.block2, block3: data.block3, ez: data.ez });
    const next = {
      ...data,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      tmSnapshot: snapshot,
      managerFlags: {},
      managerComment: "",
      correctionDiff: [],
      correctedAt: null,
      tmReplyComment: "",
      tmRepliedAt: null,
    };
    await saveData(tmKey, ym, next);
    setData(next);
    setSaving(false);
  };

  const onReply = async (comment) => {
    const next = { ...data, tmReplyComment: comment, tmRepliedAt: new Date().toISOString() };
    await saveData(tmKey, ym, next);
    setData(next);
  };

  const dl = deadlineInfo(ym);
  const showBanner = !dl.future && (data.status === "draft" || data.status === "corrected");
  const flagCount = Object.values(data.managerFlags || {}).filter((f) => f?.flagged).length;
  const hasCorrections = data.status === "corrected" || flagCount > 0 || !!data.managerComment;

  const months = useMemo(() => recentMonths(12), []);

  return (
    <div className={embedded ? "embedded" : "view"}>
      {!embedded && <TopBar title={`ТМ · ${tmName}`} onBack={onBack} />}
      <div className="month-picker">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
        <div className="grade-picker">
          <span>Грейд ({qKey}):</span>
          {[1, 2, 3].map((g) => (
            <button key={g} className={`grade-btn ${grade === g ? "active" : ""}`} onClick={() => persistGrade(g)}>{g}</button>
          ))}
        </div>
        {data.status === "submitted" && <span className="badge-ok"><Check size={13} /> На розгляді в керівника</span>}
        {data.status === "approved" && <span className="badge-ok"><Check size={13} /> Погоджено керівником</span>}
        {data.status === "corrected" && <span className="badge-off">Керівник вніс корективи</span>}
      </div>
      {showBanner && (
        <div className={`banner ${dl.overdue ? "banner-late" : "banner-warn"}`}>
          <AlertTriangle size={16} />
          {dl.overdue
            ? `Термін подачі ЗП за ${monthLabel(ym)} минув (був до ${dl.dueLabel}). Подати можна й зараз.`
            : `Подайте ЗП за ${monthLabel(ym)} до ${dl.dueLabel}.`}
        </div>
      )}

      <div className="inner-tabs">
        <button className={tab === "form" ? "active" : ""} onClick={() => setTab("form")}>Форма</button>
        <button className={tab === "corrections" ? "active" : ""} onClick={() => setTab("corrections")}>
          Корективи від керівника{hasCorrections && !data.tmRepliedAt ? " •" : ""}
        </button>
      </div>

      {loading ? <div className="loading">Завантаження…</div> : tab === "form" ? (
        <>
          <CriteriaForm data={data} update={update} grade={grade} tmKey={tmKey} showAmounts
            onAddShot={onAddShot} onRemoveShot={onRemoveShot} onPreview={setPreview} readOnly={false} />
          <SalarySummary
            data={data} grade={grade} tmKey={tmKey} adj={adj} qbonus={qbonus} isLastMonthOfQuarter={isLastMonthOfQuarter}
            expandedBlock={expandedBlock} onToggle={toggleBlock} editable={false} monthLbl={monthLabel(ym)}
          />
          <div className="save-bar">
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Надсилання…" : data.status === "corrected" ? "Подати виправлене" : "Подати на погодження"}
            </button>
          </div>
        </>
      ) : (
        <CorrectionsTab data={data} onReply={onReply} />
      )}
      {preview && <ImageModal src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* =========================================================
   QUARTER PANEL
========================================================= */
function QuarterPanel({ qKey, onDone }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const qMonths = quarterMonths(qKey);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const out = {};
      for (const t of TM_LIST) {
        const grade = await loadGrade(t.key, qKey);
        const monthsData = await Promise.all(qMonths.map((m) => loadData(t.key, m)));
        const salesPct = (d) => calcSales(d.block1, grade).pct;
        const allMet = monthsData.every((d) => salesPct(d) >= 100);
        const avgOver = monthsData.reduce((s, d) => s + Math.max(0, salesPct(d) - 100), 0) / 3;
        const sumFloored = monthsData.reduce((s, d) => s + calcAll(d, grade, t.key).floored, 0);
        const existing = await loadQBonus(t.key, qKey);
        out[t.key] = { grade, allMet, avgOver: existing.overExecOverride || Math.round(avgOver * 10) / 10, sumFloored };
      }
      if (active) { setRows(out); setLoading(false); }
    })();
    return () => { active = false; };
  }, [qKey]);

  if (loading || !rows) return <div className="loading">Завантаження…</div>;

  const setOverride = (tmKey, val) => setRows((prev) => ({ ...prev, [tmKey]: { ...prev[tmKey], avgOver: val } }));

  const winner = (() => {
    const eligible = TM_LIST.filter((t) => rows[t.key].allMet);
    if (eligible.length === 0) return null;
    return eligible.reduce((a, b) => (rows[a.key].avgOver >= rows[b.key].avgOver ? a : b)).key;
  })();

  const save = async () => {
    setSaving(true);
    for (const t of TM_LIST) {
      const r = rows[t.key];
      const bonus41 = winner === t.key ? 10000 : 0;
      const bonus42 = r.allMet ? Math.round(r.sumFloored * 0.05) : 0;
      await saveQBonus(t.key, qKey, { bonus41, bonus42, overExecOverride: r.avgOver, allMet: r.allMet });
    }
    setSaving(false);
    onDone();
  };

  return (
    <div className="quarter-panel">
      <h3>Квартальні бонуси · {qKey}</h3>
      <p className="hint">Місяці кварталу: {qMonths.map(monthLabel).join(", ")}</p>
      {TM_LIST.map((t) => {
        const r = rows[t.key];
        return (
          <div className="quarter-row" key={t.key}>
            <div className="quarter-row-head">
              <span>{t.name}</span>
              <span className={`badge ${r.allMet ? "badge-ok" : "badge-off"}`}>
                {r.allMet ? "3/3 місяці на 100%" : "план виконано не у всіх місяцях"}
              </span>
            </div>
            <label className="over-field">
              % перевиконання за квартал
              <input type="number" value={r.avgOver} onFocus={selectOnFocus} onChange={(e) => setOverride(t.key, Number(e.target.value))} />
            </label>
            <div className="quarter-preview">
              <span>4.2 (5% від суми ЗП за квартал): {fmt(r.allMet ? r.sumFloored * 0.05 : 0)}</span>
              <span>4.1 (бонус за перевиконання): {winner === t.key ? fmt(10000) : fmt(0)}</span>
            </div>
          </div>
        );
      })}
      <button className="btn-primary" onClick={save} disabled={saving}>
        {saving ? "Збереження…" : "Застосувати бонуси до останнього місяця кварталу"}
      </button>
    </div>
  );
}

/* =========================================================
   MANAGER VIEW
========================================================= */
function ManagerView({ onBack, embedded }) {
  const [tmKey, setTmKey] = useState("andriy");
  const [ym, setYm] = useState(nowYm());
  const [data, setData] = useState(emptyData());
  const [adj, setAdj] = useState({ amount: 0, comment: "", advance: 0 });
  const [grade, setGrade] = useState(2);
  const [qbonus, setQbonus] = useState({ bonus41: 0, bonus42: 0 });
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingAdj, setSavingAdj] = useState(false);
  const [savingCorr, setSavingCorr] = useState(false);
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("month");
  const [correctionComment, setCorrectionComment] = useState("");
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  const qKey = ymToQuarter(ym);
  const qMonths = quarterMonths(qKey);
  const isLastMonthOfQuarter = ym === qMonths[2];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCorrectionComment("");
    setExpandedBlock(null);
    Promise.all([
      loadData(tmKey, ym),
      loadAdj(tmKey, ym),
      loadGrade(tmKey, qKey),
      isLastMonthOfQuarter ? loadQBonus(tmKey, qKey) : Promise.resolve({ bonus41: 0, bonus42: 0 }),
    ]).then(([d, a, g, qb]) => {
      if (active) { setData(d); setAdj(a); setGrade(g); setQbonus(qb); setLoading(false); }
    });
    return () => { active = false; };
  }, [tmKey, ym]);

  useEffect(() => { listMonths(tmKey).then((m) => setMonths(m.sort().reverse())); }, [tmKey, ym]);

  useEffect(() => {
    if (tab !== "chart") return;
    let active = true;
    setChartLoading(true);
    (async () => {
      const results = {};
      for (const t of TM_LIST) {
        const ms = (await listMonths(t.key)).sort();
        const points = [];
        for (const m of ms) {
          const [d, g] = await Promise.all([loadData(t.key, m), loadGrade(t.key, ymToQuarter(m))]);
          points.push({ month: m, total: Math.round(calcAll(d, g, t.key).floored) });
        }
        results[t.key] = points;
      }
      const allMonths = Array.from(new Set([...(results.andriy || []), ...(results.ivan || [])].map((p) => p.month))).sort();
      const merged = allMonths.map((m) => ({
        month: monthLabel(m),
        andriy: results.andriy?.find((p) => p.month === m)?.total ?? null,
        ivan: results.ivan?.find((p) => p.month === m)?.total ?? null,
      }));
      if (active) { setChartData(merged); setChartLoading(false); }
    })();
    return () => { active = false; };
  }, [tab]);

  const persistGrade = async (g) => { setGrade(g); await saveGrade(tmKey, qKey, g); };
  const toggleBlock = (id) => setExpandedBlock((prev) => (prev === id ? null : id));
  const onFlag = (num, val) => setData((prev) => _.set(_.cloneDeep(prev), ["managerFlags", num], val));
  const flagCount = Object.values(data.managerFlags || {}).filter((f) => f?.flagged).length;

  const saveAdjOnly = async () => { setSavingAdj(true); await saveAdj(tmKey, ym, adj); setSavingAdj(false); };
  const setPaymentStatus = async (status) => {
    const next = { ...data, paymentStatus: status, paymentStatusAt: new Date().toISOString() };
    setData(next);
    await saveData(tmKey, ym, next);
  };

  const sendBack = async () => {
    setSavingCorr(true);
    const next = { ...data, status: "corrected", correctedAt: new Date().toISOString(), managerComment: correctionComment };
    await saveData(tmKey, ym, next);
    setData(next);
    setCorrectionComment("");
    setSavingCorr(false);
  };
  const approve = async () => {
    setSavingCorr(true);
    const next = { ...data, status: "approved", approvedAt: new Date().toISOString(), managerFlags: {}, managerComment: "" };
    await saveData(tmKey, ym, next);
    setData(next);
    setSavingCorr(false);
  };

  return (
    <div className={embedded ? "embedded" : "view"}>
      {!embedded && <TopBar title={MANAGER_NAME} onBack={onBack} />}
      <div className="tm-tabs">
        {TM_LIST.map((t) => (
          <button key={t.key} className={`tm-tab ${t.key === tmKey ? "active" : ""}`} onClick={() => setTmKey(t.key)}>{t.name}</button>
        ))}
      </div>
      <div className="inner-tabs">
        <button className={tab === "month" ? "active" : ""} onClick={() => setTab("month")}>Місяць</button>
        <button className={tab === "quarter" ? "active" : ""} onClick={() => setTab("quarter")}>Квартальний бонус</button>
        <button className={tab === "chart" ? "active" : ""} onClick={() => setTab("chart")}><TrendingUp size={14} /> Динаміка ЗП</button>
      </div>

      {tab === "month" && (
        <>
          <div className="month-row">
            <select value={ym} onChange={(e) => setYm(e.target.value)}>
              {Array.from(new Set([ym, ...months])).sort().reverse().map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
            </select>
            <div className="grade-picker">
              <span>Грейд ({qKey}):</span>
              {[1, 2, 3].map((g) => (
                <button key={g} className={`grade-btn ${grade === g ? "active" : ""}`} onClick={() => persistGrade(g)}>{g}</button>
              ))}
            </div>
          </div>

          {loading ? <div className="loading">Завантаження…</div> : (
            <>
              <div className="status-line">
                Статус: {
                  data.status === "submitted" ? "подано на погодження"
                  : data.status === "approved" ? "погоджено керівником"
                  : data.status === "corrected" ? "відправлено ТМ на доопрацювання"
                  : "ТМ ще не подав дані за цей місяць"
                }
                {data.submittedAt && ` · подано ${fmtDate(data.submittedAt)}`}
              </div>
              {data.tmReplyComment && (
                <div className="reply-banner"><b>Коментар ТМ:</b> {data.tmReplyComment}</div>
              )}

              {data.status !== "draft" && (
                <div className="correction-bar">
                  <p className="hint">
                    Тисніть «Внести корективи» біля потрібних пунктів — вони підуть ТМ на доопрацювання.
                    {flagCount > 0 ? ` Позначено пунктів: ${flagCount}.` : ""}
                  </p>
                  <label className="over-field" style={{ maxWidth: "100%" }}>
                    Загальний коментар ТМ (необовʼязково)
                    <textarea rows={2} value={correctionComment} onChange={(e) => setCorrectionComment(e.target.value)} />
                  </label>
                  <div className="correction-actions">
                    <button className="btn-secondary" onClick={sendBack} disabled={savingCorr || (flagCount === 0 && !correctionComment)}>
                      {savingCorr ? "…" : "Надіслати ТМ на доопрацювання"}
                    </button>
                    <button className="btn-primary" onClick={approve} disabled={savingCorr}>
                      {savingCorr ? "…" : "Погодити"}
                    </button>
                  </div>
                </div>
              )}

              <CriteriaForm
                data={data} grade={grade} tmKey={tmKey} showAmounts readOnly
                managerMode={data.status !== "draft"} onFlag={onFlag}
                onPreview={setPreview}
              />

              <SalarySummary
                data={data} grade={grade} tmKey={tmKey} adj={adj} qbonus={qbonus} isLastMonthOfQuarter={isLastMonthOfQuarter}
                expandedBlock={expandedBlock} onToggle={toggleBlock} editable
                onAdjChange={setAdj} onSaveAdj={saveAdjOnly} savingAdj={savingAdj}
                onSetPaymentStatus={setPaymentStatus} monthLbl={monthLabel(ym)}
              />
            </>
          )}
        </>
      )}

      {tab === "quarter" && <QuarterPanel qKey={qKey} onDone={() => setTab("month")} />}

      {tab === "chart" && (
        <div className="chart-wrap">
          {chartLoading ? <div className="loading">Завантаження…</div> : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 5" stroke="#D9D2BE" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8A8069" }} tickMargin={8}
                  axisLine={{ stroke: "#D9D2BE" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8069" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  formatter={(v) => fmt(v)}
                  contentStyle={{ borderRadius: 10, border: "1px solid #E1D9C1", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", boxShadow: "0 8px 24px rgba(20,15,5,.14)" }}
                  cursor={{ stroke: "#BE8A2E", strokeDasharray: "3 3", strokeOpacity: 0.5 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="plainline" />
                <Line type="monotone" dataKey="andriy" name="Шах Андрій" stroke="#BE8A2E" strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: "#BE8A2E" }} activeDot={{ r: 5 }} connectNulls />
                <Line type="monotone" dataKey="ivan" name="Паньків Іван" stroke="#3C6B49" strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: "#3C6B49" }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="chart-note">Без урахування квартальних бонусів, авансу й ручних коригувань керівника.</p>
        </div>
      )}

      {preview && <ImageModal src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}


/* =========================================================
   ЖИВИЙ ФОН
========================================================= */
function LivingBackground() {
  return (
    <div className="living-bg" aria-hidden="true">
      <span className="blob blob-1" />
      <span className="blob blob-2" />
      <span className="blob blob-3" />
      <span className="blob blob-4" />
    </div>
  );
}

/* =========================================================
   ІЄРАРХІЯ КАБІНЕТІВ (початковий екран)
========================================================= */
function useMonthStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let active = true;
    const ym = nowYm();
    (async () => {
      let submitted = 0;
      let toPay = 0;
      const bump = (d) => {
        if (d.status === "submitted" || d.status === "corrected") submitted += 1;
        if (d.paymentStatus === "to_pay") toPay += 1;
      };
      for (const t of TMS) bump(await loadData(t.key, ym));
      for (const s of SALONS) bump(await loadSmData(s.key, ym));
      if (active) setStats({ submitted, toPay, total: TMS.length + SALONS.length });
    })();
    return () => { active = false; };
  }, []);
  return stats;
}

const shortAddr = (addr) => addr.replace(/^(вул\.|пл\.|просп\.)\s+/, "");

function HierarchyHome({ onPick, remembered, onLogout }) {
  const stats = useMonthStats();
  return (
    <div className="role-select deck-screen">
      <div className="deck-inner fade-in">
        <span className="role-eyebrow">Dnipro-M</span>
        <h1>Ваш робочий простір</h1>
        <p>Оберіть кабінет — вхід за логіном і паролем</p>

        {remembered && (
          <div className="resume-bar">
            <span>Вхід збережено: <b>{remembered.label}</b></span>
            <span className="resume-actions">
              <button className="btn-primary small" onClick={() => onPick(remembered)}>Продовжити</button>
              <button className="btn-secondary small" onClick={onLogout}>Вийти</button>
            </span>
          </div>
        )}

        <div className="deck-grid">
          <button className="deck-tile deck-lead" onClick={() => onPick({ type: "manager", key: "manager", label: MANAGER.name })}>
            <span className="deck-lead-top">
              <span className="deck-ic deck-ic-gold"><Users size={22} /></span>
              <span className="deck-name deck-name-lg">{MANAGER.name}</span>
              <span className="deck-role deck-role-gold">Керівник</span>
            </span>
            <span className="deck-stat">
              <span className="deck-stat-cell"><b>{stats ? stats.submitted : "—"}</b><span>{`подало з ${stats ? stats.total : TMS.length + SALONS.length}`}</span></span>
              <span className="deck-stat-cell"><b>{stats ? stats.toPay : "—"}</b><span>до виплати</span></span>
            </span>
          </button>

          <div className="deck-tile deck-office">
            <span className="deck-hd">Офіс</span>
            {OFFICE.map((o) => (
              <button
                className="deck-orow" key={o.key}
                onClick={() => onPick({ type: o.key === "accountant" ? "accountant" : "office", key: o.key, label: o.name })}
              >
                <span className="deck-ic deck-ic-sm">{o.key === "accountant" ? <Wallet size={15} /> : <User size={15} />}</span>
                <span className="deck-orow-body">
                  <span className="deck-name">{o.name}</span>
                  <span className="deck-role">{o.role}</span>
                </span>
              </button>
            ))}
          </div>

          {TMS.map((tm) => {
            const salons = salonsOfTm(tm.key);
            return (
              <div className="deck-tile deck-tm" key={tm.key}>
                <button className="deck-tm-top" onClick={() => onPick({ type: "tm", key: tm.key, label: tm.name })}>
                  <span className="deck-ic"><ClipboardList size={17} /></span>
                  <span className="deck-orow-body">
                    <span className="deck-name">{tm.name}</span>
                    <span className="deck-role">{`Тер. менеджер · ${salons.length} ${salonWord(salons.length)}`}</span>
                  </span>
                </button>
                <div className="deck-chips">
                  {salons.map((s) => (
                    <button className="deck-chip" key={s.key} onClick={() => onPick({ type: "sm", key: s.key, label: salonLabel(s) })}>
                      <b>{s.city}</b><span>{shortAddr(s.addr)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ВХІД (логін + пароль)
========================================================= */
function LoginGate({ title, subtitle, cabKey, onCancel, onSuccess, verify }) {
  const [mode, setMode] = useState("login"); // login | recover
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const admin = isAdminCab(cabKey);
  const [reqSent, setReqSent] = useState(false);
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [recOk, setRecOk] = useState("");

  const submit = async () => {
    if (!login || !password) return;
    setBusy(true);
    const ok = await verify(login, password);
    setBusy(false);
    if (ok) onSuccess(remember);
    else { setError("Невірний логін або пароль"); setPassword(""); }
  };

  const doRequest = async () => {
    setBusy(true);
    await requestRecovery(cabKey);
    setBusy(false);
    setReqSent(true);
    setRecOk("");
  };
  const doConfirm = async () => {
    setBusy(true);
    const r = await confirmRecovery(cabKey, code, newPass);
    setBusy(false);
    if (r.ok) {
      setError("");
      setRecOk("Пароль змінено. Увійдіть новим паролем.");
      setCode(""); setNewPass("");
      setTimeout(() => { setMode("login"); setReqSent(false); setRecOk(""); }, 1600);
    } else {
      setError(r.error);
    }
  };

  return (
    <div className="role-select">
      <div className="role-select-inner fade-in">
        <div className="pin-avatar"><LogIn size={22} /></div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}

        {mode === "login" ? (
          <>
            <div className="login-fields">
              <label className="login-field">
                <span>Логін</span>
                <input
                  autoFocus autoComplete="username" value={login}
                  onChange={(e) => { setLogin(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("lg-pass")?.focus(); }}
                />
              </label>
              <label className="login-field">
                <span>Пароль</span>
                <input
                  id="lg-pass" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                />
              </label>
              <label className="login-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Не виходити на цьому пристрої</span>
              </label>
            </div>
            <p className={`pin-error ${error || recOk ? "visible" : ""}`}>{error || recOk || " "}</p>
            <div className="pin-actions">
              <button className="btn-secondary" onClick={onCancel}>Назад</button>
              <button className="btn-primary" onClick={submit} disabled={!login || !password || busy}>
                {busy ? "Перевірка…" : "Увійти"}
              </button>
            </div>
            <button className="pin-forgot" onClick={() => { setMode("recover"); setError(""); }}>Забули пароль?</button>
          </>
        ) : (
          <>
            <p className="recover-lead">
              {admin
                ? "Введіть майстер-код відновлення адміністратора та новий пароль."
                : `Запросіть код — він зʼявиться в кабінеті адміністратора (${ADMIN_NAME}). Отримайте його й введіть нижче разом із новим паролем.`}
            </p>
            <div className="login-fields">
              {!admin && (
                <button className="btn-secondary" onClick={doRequest} disabled={busy || reqSent}>
                  {reqSent ? "Код надіслано адміністратору" : busy ? "…" : "Запросити код"}
                </button>
              )}
              <label className="login-field">
                <span>{admin ? "Майстер-код" : "Код відновлення"}</span>
                <input value={code} onChange={(e) => { setCode(e.target.value); setError(""); }} />
              </label>
              <label className="login-field">
                <span>Новий пароль</span>
                <input
                  type="password" value={newPass}
                  onChange={(e) => { setNewPass(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") doConfirm(); }}
                />
              </label>
            </div>
            <p className={`pin-error ${error || recOk ? "visible" : ""}`}>{error || recOk || " "}</p>
            <div className="pin-actions">
              <button className="btn-secondary" onClick={() => { setMode("login"); setError(""); setReqSent(false); }}>До входу</button>
              <button className="btn-primary" onClick={doConfirm} disabled={!code || !newPass || busy}>
                {busy ? "…" : "Змінити пароль"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   СМ · дрібні поля
========================================================= */
function SelectField({ label, value, onChange, options, readOnly }) {
  const cur = options.find((o) => String(o.value) === String(value));
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {readOnly ? (
        <div className="field-value">{cur ? cur.label : "—"}</div>
      ) : (
        <div className="field-input-wrap">
          <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </div>
      )}
    </label>
  );
}

/* =========================================================
   СМ · ФОРМА КРИТЕРІЇВ
========================================================= */
function SmCriteriaForm({ data, update, calc, area, showAmounts, onAddShot, onRemoveShot, onPreview, readOnly, isQuarterEnd }) {
  const shot = { screenshots: data.screenshots, onAddShot, onRemoveShot, onPreview, readOnly };
  const catOptions = [
    { value: "", label: `Авто (${categoryOf(data.base.avg3To)})` },
    ...SM_CATEGORIES.map((c) => ({ value: c.key, label: `${c.key} · ${c.note}` })),
  ];
  const coefOptions = MANAGER_COEFS.map((c) => ({ value: c.value, label: c.label }));

  return (
    <div className="criteria-form">
      <BlockHeader n="1" title="Основна частина за виконання плану" />
      <SmItem num="1.1" title="Категорія та база" amount={showAmounts ? calc.baseAdjusted : undefined} screenshotKey="base" {...shot}>
        <Field readOnly={readOnly} label="Середній ТО за 3 міс" suffix="грн" value={data.base.avg3To} onChange={(v) => update(["base", "avg3To"], v)} />
        <SelectField readOnly={readOnly} label="Категорія салону" value={data.base.categoryOverride} onChange={(v) => update(["base", "categoryOverride"], v)} options={catOptions} />
        <Field readOnly={readOnly} label="% виконання плану ТО" suffix="%" value={data.base.planPercent} onChange={(v) => update(["base", "planPercent"], v)} />
        <Field readOnly={readOnly} label="Вихідних за місяць (факт)" value={data.base.daysOff} onChange={(v) => update(["base", "daysOff"], v)} />
        {showAmounts && (
          <div className="ez-sub">
            <span>Категорія: {calc.category}</span>
            <span>Брекет: {PLAN_BRACKETS[calc.bracket]}</span>
            <span>База: {fmt(calc.baseRaw)}</span>
            <span>Відпрац. коеф: {calc.factor.toFixed(2)} (норма вихідних {normDaysOff(area)})</span>
          </div>
        )}
      </SmItem>

      <BlockHeader n="2" title="Мотивація керуючого" />
      <SmItem num="2.1" title="Атестація співробітників ФМ" amount={showAmounts ? calc.mgr.attest : undefined} screenshotKey="attest" {...shot}>
        <CheckField readOnly={readOnly} label="Атестація всіма співробітниками ≥ 98%" checked={data.manager.attestationAll} onChange={(v) => update(["manager", "attestationAll"], v)} />
      </SmItem>
      <SmItem num="2.2" title="Підтримання стандартів ФМ" amount={showAmounts ? calc.mgr.standards : undefined} screenshotKey="standards" {...shot}>
        <CheckField readOnly={readOnly} label="Без зауважень (бонус 2 000)" checked={data.manager.noRemarks} onChange={(v) => update(["manager", "noRemarks"], v)} />
        <Field readOnly={readOnly} label="Виявлені зауваження (−200)" value={data.manager.remarksFound} onChange={(v) => update(["manager", "remarksFound"], v)} />
        <Field readOnly={readOnly} label="Невиправлені зауваження (−400)" value={data.manager.remarksUnfixed} onChange={(v) => update(["manager", "remarksUnfixed"], v)} />
        <div className="hint">Штраф до −2 000 грн. Виявлене та виправлене зауваження не сумуються.</div>
      </SmItem>
      <SmItem num="2.3" title="Коефіцієнт керуючого" amount={showAmounts ? calc.mgr.coefBonus : undefined} screenshotKey="coef" {...shot}>
        <SelectField readOnly={readOnly} label="Статус" value={data.manager.coef} onChange={(v) => update(["manager", "coef"], Number(v))} options={coefOptions} />
        <div className="hint">Додатковий бонус = ставка за категорією ({fmt(calc.baseRaw)}) × (коеф − 1). Умова переходу на «Керуючий»: 2 з 3 планів по СМ.</div>
      </SmItem>

      <BlockHeader n="3" title="Бонусна частина" />
      <SmItem num="3.1" title="Обіг з дзвінків" amount={showAmounts ? calc.bonus.calls : undefined} screenshotKey="calls" {...shot}>
        <Field readOnly={readOnly} label="Загальний план ТО на місяць" suffix="грн" value={data.bonus.monthlyToPlan} onChange={(v) => update(["bonus", "monthlyToPlan"], v)} />
        <CheckField readOnly={readOnly} label="Виконано кількість дзвінків" checked={data.bonus.callsCountDone} onChange={(v) => update(["bonus", "callsCountDone"], v)} />
        <CheckField readOnly={readOnly} label="Виконано оборот з дзвінків" checked={data.bonus.callsRevenueDone} onChange={(v) => update(["bonus", "callsRevenueDone"], v)} />
        <Field readOnly={readOnly} label="Факт. оборот з дзвінків" suffix="грн" value={data.bonus.callsRevenue} onChange={(v) => update(["bonus", "callsRevenue"], v)} />
        {showAmounts && (
          <div className="ez-sub">
            <span>План обороту з дзвінків (10% від плану ТО): {fmt(calc.bonus.callsPlanRevenue)}</span>
            <span>Ставка бонусу: {calc.bonus.callsPct}%</span>
          </div>
        )}
      </SmItem>
      <SmItem num="3.2" title="Заміна на іншому магазині" amount={showAmounts ? calc.bonus.replacement : undefined} screenshotKey="replace" {...shot}>
        <Field readOnly={readOnly} label="Днів заміни" value={data.bonus.replacementDays} onChange={(v) => update(["bonus", "replacementDays"], v)} />
        {showAmounts && <div className="hint">Денна ставка на своєму магазині: {fmt(calc.dailyRate)} · +20% за день заміни</div>}
      </SmItem>
      <SmItem num="3.3" title="Середній чек" amount={showAmounts ? calc.bonus.avgCheck : undefined} screenshotKey="sc" {...shot}>
        <Field readOnly={readOnly} label="Факт. середній чек" suffix="грн" value={data.bonus.avgCheckFact} onChange={(v) => update(["bonus", "avgCheckFact"], v)} />
        <Field readOnly={readOnly} label="Поріг 1 → 700 грн" value={data.bonus.scN1} onChange={(v) => update(["bonus", "scN1"], v)} />
        <Field readOnly={readOnly} label="Поріг 2 → 1 500 грн" value={data.bonus.scN2} onChange={(v) => update(["bonus", "scN2"], v)} />
        <Field readOnly={readOnly} label="Поріг 3 → 2 000 грн" value={data.bonus.scN3} onChange={(v) => update(["bonus", "scN3"], v)} />
        <div className="hint">Мінімальний середній чек на місяць надає ТМ.</div>
      </SmItem>
      <SmItem num="3.4" title="Довжина чека" amount={showAmounts ? calc.bonus.checkLen : undefined} screenshotKey="cl" {...shot}>
        <Field readOnly={readOnly} label="Факт. довжина чека" value={data.bonus.checkLenFact} onChange={(v) => update(["bonus", "checkLenFact"], v)} />
        <Field readOnly={readOnly} label="Поріг 1 → 700 грн" value={data.bonus.clN1} onChange={(v) => update(["bonus", "clN1"], v)} />
        <Field readOnly={readOnly} label="Поріг 2 → 1 500 грн" value={data.bonus.clN2} onChange={(v) => update(["bonus", "clN2"], v)} />
        <Field readOnly={readOnly} label="Поріг 3 → 2 000 грн" value={data.bonus.clN3} onChange={(v) => update(["bonus", "clN3"], v)} />
        <div className="hint">Мінімальну довжину чека на місяць надає ТМ.</div>
      </SmItem>
      <SmItem num="3.5" title="Атестація (курси)" amount={showAmounts ? calc.bonus.courses : undefined} screenshotKey="courses" {...shot}>
        <CheckField readOnly={readOnly} label="≥ 98% середньо-місячних курсів, без перепризначення" checked={data.bonus.coursesOk} onChange={(v) => update(["bonus", "coursesOk"], v)} />
      </SmItem>
      <SmItem num="3.6" title="Продажі із сайту через НП" amount={showAmounts ? calc.bonus.siteNp : undefined} screenshotKey="np" {...shot}>
        <Field readOnly={readOnly} label="Оборот продажів через НП" suffix="грн" value={data.bonus.siteNpRevenue} onChange={(v) => update(["bonus", "siteNpRevenue"], v)} />
        <div className="hint">4% на команду</div>
      </SmItem>
      <SmItem num="3.7" title="Продаж по БН" amount={showAmounts ? calc.bonus.bn : undefined} screenshotKey="bn" {...shot}>
        <Field readOnly={readOnly} label="Оборот по БН" suffix="грн" value={data.bonus.bnRevenue} onChange={(v) => update(["bonus", "bnRevenue"], v)} />
        <div className="hint">4% на команду</div>
      </SmItem>

      <BlockHeader n="4" title="Додаткова мотивація за продаж PPI" />
      <SmItem num="4.1" title="Продаж PPI" amount={showAmounts ? calc.ppi.bonus : undefined} screenshotKey="ppi" {...shot}>
        <Field readOnly={readOnly} label="Оборот по категорії PPI" suffix="грн" value={data.ppi.ppiRevenue} onChange={(v) => update(["ppi", "ppiRevenue"], v)} />
        <CheckField readOnly={readOnly} label="План PPI закрито" checked={data.ppi.planClosed} onChange={(v) => update(["ppi", "planClosed"], v)} />
        {showAmounts && <div className="hint">{calc.ppi.pct}% від обороту PPI ({data.ppi.planClosed ? "план закрито" : "план не закрито"})</div>}
      </SmItem>

      <BlockHeader n="5" title="Рекорд та квартальна премія" />
      <SmItem num="5.1" title="Бонус за рекордні показники" amount={showAmounts ? calc.record.bonus : undefined} screenshotKey="record" {...shot}>
        <Field readOnly={readOnly} label="Оборот ТО за місяць (команда)" suffix="грн" value={data.record.monthlyTo} onChange={(v) => update(["record", "monthlyTo"], v)} />
        <Field readOnly={readOnly} label="Попередній рекорд ТО" suffix="грн" value={data.record.prevRecord} onChange={(v) => update(["record", "prevRecord"], v)} />
        {showAmounts && (
          <div className="hint">
            Поточний поріг рекорду: {fmt(calc.record.threshold)} (мін. 1 млн, крок +10%). Бонус — 1% від ТО.
            {calc.record.beaten ? " Рекорд перебито ✔" : ""}
          </div>
        )}
      </SmItem>
      {isQuarterEnd && (
        <SmItem num="5.2" title="Квартальна премія" amount={showAmounts ? calc.quarterly : undefined} screenshotKey="quarter" {...shot}>
          <CheckField readOnly={readOnly} label="3/3 місяці план по обороту закрито" checked={data.quarterly.threeOfThree} onChange={(v) => update(["quarterly", "threeOfThree"], v)} />
          <Field readOnly={readOnly} label="Сума 3 останніх ЗП" suffix="грн" value={data.quarterly.last3SalarySum} onChange={(v) => update(["quarterly", "last3SalarySum"], v)} />
          <div className="hint">Премія — 10% від суми трьох останніх заробітних плат.</div>
        </SmItem>
      )}
    </div>
  );
}

/* =========================================================
   СМ · ЗВЕДЕННЯ ЗП
========================================================= */
function SmSummary({ data, calc, expandedBlock, onToggle, editable, onAdjChange, onSaveAdj, savingAdj, onSetPaymentStatus, monthLbl }) {
  const grand = calc.total;

  const baseItems = [
    { label: `База (${calc.category} · ${PLAN_BRACKETS[calc.bracket]})`, amount: calc.baseRaw },
    { label: `Коеф. відпрацьованих змін ×${calc.factor.toFixed(2)}`, amount: calc.baseAdjusted - calc.baseRaw },
  ];
  const mgrItems = [
    { label: "Атестація співробітників", amount: calc.mgr.attest },
    { label: "Стандарти ФМ", amount: calc.mgr.standards },
    { label: "Коефіцієнт керуючого", amount: calc.mgr.coefBonus },
  ];
  const bonusItems = [
    { label: `Обіг з дзвінків (${calc.bonus.callsPct}%)`, amount: calc.bonus.calls },
    { label: "Заміна на іншому магазині", amount: calc.bonus.replacement },
    { label: "Середній чек", amount: calc.bonus.avgCheck },
    { label: "Довжина чека", amount: calc.bonus.checkLen },
    { label: "Атестація (курси)", amount: calc.bonus.courses },
    { label: "Сайт через НП (4%)", amount: calc.bonus.siteNp },
    { label: "Продаж по БН (4%)", amount: calc.bonus.bn },
  ];

  return (
    <div className="summary">
      <SummaryBlock id="base" title="1 · Основна частина" total={calc.baseAdjusted} items={baseItems} expanded={expandedBlock === "base"} onToggle={onToggle} />
      <SummaryBlock id="mgr" title="2 · Мотивація керуючого" total={calc.mgr.subtotal} items={mgrItems} expanded={expandedBlock === "mgr"} onToggle={onToggle} />
      <SummaryBlock id="bonus" title="3 · Бонусна частина" total={calc.bonus.subtotal} items={bonusItems} expanded={expandedBlock === "bonus"} onToggle={onToggle} />

      <div className="summary-row"><span>4 · Продаж PPI ({calc.ppi.pct}%)</span><b>{fmt(calc.ppi.bonus)}</b></div>
      <div className="summary-row"><span>5 · Рекордний показник{calc.record.beaten ? " ✔" : ""}</span><b>{fmt(calc.record.bonus)}</b></div>
      {calc.quarterly !== 0 && (
        <div className="summary-row"><span>5 · Квартальна премія</span><b>{fmt(calc.quarterly)}</b></div>
      )}

      {editable ? (
        <>
          <div className="adj-row">
            <span>Додатково (ТМ)</span>
            <input className="adj-comment" placeholder="коментар" value={data.adj.comment} onChange={(e) => onAdjChange({ ...data.adj, comment: e.target.value })} />
            <input className="adj-amount" type="number" value={data.adj.amount} onFocus={selectOnFocus} onChange={(e) => onAdjChange({ ...data.adj, amount: Number(e.target.value) })} />
            <span>грн</span>
          </div>
          <div className="adj-row">
            <span>Аванс (вирахувати)</span>
            <input className="adj-amount" type="number" value={data.adj.advance || 0} onFocus={selectOnFocus} onChange={(e) => onAdjChange({ ...data.adj, advance: Number(e.target.value) })} />
            <span>грн</span>
            <button className="btn-secondary small" onClick={onSaveAdj} disabled={savingAdj}>{savingAdj ? "…" : "Зберегти"}</button>
          </div>
        </>
      ) : (
        <>
          {(data.adj.amount || 0) !== 0 && (
            <div className="summary-row"><span>Додатково{data.adj.comment ? ` (${data.adj.comment})` : ""}</span><b>{fmt(data.adj.amount)}</b></div>
          )}
          {(data.adj.advance || 0) !== 0 && (
            <div className="summary-row"><span>Аванс (вирахувано)</span><b>-{fmt(data.adj.advance)}</b></div>
          )}
        </>
      )}

      <div className="summary-row grand"><span>Загальна ЗП за {monthLbl}</span><b>{fmt(grand)}</b></div>

      <div className="payment-row">
        <span>Статус виплати:</span>
        <span className={`badge ${data.paymentStatus === "paid" ? "badge-ok" : data.paymentStatus === "to_pay" ? "badge-warn" : "badge-off"}`}>
          {data.paymentStatus === "paid" ? "Виплачено" : data.paymentStatus === "to_pay" ? "До виплати" : "Не підтверджено"}
        </span>
        {editable && data.paymentStatus !== "to_pay" && data.paymentStatus !== "paid" && (
          <button className="btn-secondary small" onClick={() => onSetPaymentStatus("to_pay")}>Позначити «До виплати»</button>
        )}
        {editable && data.paymentStatus === "to_pay" && (
          <button className="btn-secondary small" onClick={() => onSetPaymentStatus("paid")}>Позначити «Виплачено»</button>
        )}
        {editable && data.paymentStatus === "paid" && (
          <button className="btn-secondary small" onClick={() => onSetPaymentStatus("to_pay")}>Повернути «До виплати»</button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   СМ · КОРЕКТИВИ ВІД ТМ (сторона СМ)
========================================================= */
function SmCorrectionsTab({ data, onReply }) {
  const [reply, setReply] = useState(data.smReplyComment || "");
  const [saving, setSaving] = useState(false);

  if (!data.tmComment && (!data.correctionDiff || data.correctionDiff.length === 0)) {
    return <div className="loading">Корективів від ТМ ще немає.</div>;
  }
  const submit = async () => { setSaving(true); await onReply(reply); setSaving(false); };

  return (
    <div className="corrections-panel">
      <p className="hint">Внесено: {fmtDate(data.correctedAt)}</p>
      {data.tmComment && <div className="manager-comment">{data.tmComment}</div>}
      {data.correctionDiff?.length > 0 && (
        <div className="diff-list">
          {data.correctionDiff.map((d, i) => (
            <div className="diff-row" key={i}>
              <span className="diff-label">{d.label}</span>
              <span className="diff-old">{String(d.oldV)}</span>
              <span className="diff-arrow">→</span>
              <span className="diff-new">{String(d.newV)}</span>
            </div>
          ))}
        </div>
      )}
      <label className="over-field" style={{ maxWidth: "100%" }}>
        Ваш коментар ТМ
        <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
      </label>
      <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? "Надсилання…" : "Надіслати коментар"}</button>
      {data.smRepliedAt && <p className="hint">Надіслано: {fmtDate(data.smRepliedAt)}</p>}
    </div>
  );
}

function smBuildDiff(snapshot, current) {
  if (!snapshot) return [];
  const out = [];
  for (const path of Object.keys(SM_FIELD_LABELS)) {
    const oldV = _.get(snapshot, path);
    const newV = _.get(current, path);
    if (oldV !== newV) out.push({ label: SM_FIELD_LABELS[path], oldV, newV });
  }
  return out;
}

/* =========================================================
   СМ · КАБІНЕТ (вкладка «Розрахунок ЗП»)
========================================================= */
function SmView({ salon, embedded }) {
  const [ym, setYm] = useState(nowYm());
  const [data, setData] = useState(emptySmData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("form");
  const [expandedBlock, setExpandedBlock] = useState(null);

  const qMonths = quarterMonths(ymToQuarter(ym));
  const isQuarterEnd = ym === qMonths[2];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTab("form");
    loadSmData(salon.key, ym).then((d) => { if (active) { setData(d); setLoading(false); } });
    return () => { active = false; };
  }, [salon.key, ym]);

  const update = (path, value) => setData((prev) => _.set(_.cloneDeep(prev), path, value));
  const onAddShot = makeAddShot(setData);
  const onRemoveShot = makeRemoveShot(setData);
  const toggleBlock = (id) => setExpandedBlock((p) => (p === id ? null : id));

  const calc = useMemo(() => calcSmAll(data, { ym, area: salon.area }), [data, ym, salon.area]);

  const months = useMemo(() => {
    return recentMonths(12);
  }, []);

  const submit = async () => {
    setSaving(true);
    const snap = _.cloneDeep({
      base: data.base, manager: data.manager, bonus: data.bonus,
      ppi: data.ppi, record: data.record, quarterly: data.quarterly,
    });
    const next = {
      ...data, status: "submitted", submittedAt: new Date().toISOString(), smSnapshot: snap,
      tmComment: "", correctionDiff: [], correctedAt: null, smReplyComment: "", smRepliedAt: null,
      tmApproved: false, tmApprovedAt: null,
    };
    await saveSmData(salon.key, ym, next);
    setData(next);
    setSaving(false);
  };
  const onReply = async (comment) => {
    const next = { ...data, smReplyComment: comment, smRepliedAt: new Date().toISOString() };
    await saveSmData(salon.key, ym, next);
    setData(next);
  };

  const day = new Date().getDate();
  const isCurrent = ym === nowYm();
  const showBanner = isCurrent && data.status === "draft";
  const hasCorr = !!data.tmComment || (data.correctionDiff && data.correctionDiff.length > 0);

  return (
    <div className={embedded ? "embedded" : "view"}>
      {!embedded && <TopBar title={`Салон · ${salonLabel(salon)}`} onBack={() => {}} />}
      <div className="month-picker">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
        {data.status === "submitted" && <span className="badge-ok"><Check size={13} /> На розгляді в ТМ</span>}
        {data.status === "corrected" && <span className="badge-off">ТМ вніс корективи</span>}
        {data.tmApproved && <span className="badge-warn">Передано керівнику</span>}
      </div>
      {showBanner && (
        <div className={`banner ${day > 10 ? "banner-late" : "banner-warn"}`}>
          <AlertTriangle size={16} />
          {day > 10
            ? "Термін подачі (до 10 числа) минув — заповніть дані якнайшвидше."
            : `Заповніть дані та скріншоти до 10 числа (сьогодні ${day}-е)`}
        </div>
      )}

      <div className="inner-tabs">
        <button className={tab === "form" ? "active" : ""} onClick={() => setTab("form")}>Форма</button>
        <button className={tab === "corrections" ? "active" : ""} onClick={() => setTab("corrections")}>
          Корективи від ТМ{hasCorr && !data.smRepliedAt ? " •" : ""}
        </button>
      </div>

      {loading ? <div className="loading">Завантаження…</div> : tab === "form" ? (
        <>
          <SmCriteriaForm
            data={data} update={update} calc={calc} area={salon.area} showAmounts
            onAddShot={onAddShot} onRemoveShot={onRemoveShot} onPreview={setPreview} readOnly={false} isQuarterEnd={isQuarterEnd}
          />
          <SmSummary data={data} calc={calc} expandedBlock={expandedBlock} onToggle={toggleBlock} editable={false} monthLbl={monthLabel(ym)} />
          <div className="save-bar">
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Надсилання…" : "Подати ТМ на погодження"}
            </button>
          </div>
        </>
      ) : (
        <SmCorrectionsTab data={data} onReply={onReply} />
      )}
      {preview && <ImageModal src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* =========================================================
   СМ · ДЕТАЛЬ ДЛЯ ТМ / КЕРІВНИКА (перегляд + корективи)
========================================================= */
function SalonDetail({ salon, reviewer, onBack }) {
  const [ym, setYm] = useState(nowYm());
  const [data, setData] = useState(emptySmData());
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [comment, setComment] = useState("");
  const [expandedBlock, setExpandedBlock] = useState(null);

  const canEdit = reviewer === "tm"; // корективи вносить ТМ; керівник дивиться
  const qMonths = quarterMonths(ymToQuarter(ym));
  const isQuarterEnd = ym === qMonths[2];

  useEffect(() => {
    let active = true;
    setLoading(true); setEditMode(false); setComment(""); setExpandedBlock(null);
    loadSmData(salon.key, ym).then((d) => { if (active) { setData(d); setLoading(false); } });
    return () => { active = false; };
  }, [salon.key, ym]);
  useEffect(() => { listSmMonths(salon.key).then((m) => setMonths(m.sort().reverse())); }, [salon.key, ym]);

  const update = (path, value) => setData((prev) => _.set(_.cloneDeep(prev), path, value));
  const onAddShot = makeAddShot(setData);
  const onRemoveShot = makeRemoveShot(setData);
  const toggleBlock = (id) => setExpandedBlock((p) => (p === id ? null : id));

  const calc = useMemo(() => calcSmAll(data, { ym, area: salon.area }), [data, ym, salon.area]);

  const saveAdjOnly = async () => { setSaving(true); await saveSmData(salon.key, ym, data); setSaving(false); };
  const setPaymentStatus = async (status) => {
    const next = { ...data, paymentStatus: status, paymentStatusAt: new Date().toISOString() };
    setData(next);
    await saveSmData(salon.key, ym, next);
  };
  const cancelEdit = async () => {
    const d = await loadSmData(salon.key, ym);
    setData(d); setComment(""); setEditMode(false);
  };
  const saveCorrections = async () => {
    setSaving(true);
    const diff = smBuildDiff(data.smSnapshot, data);
    const next = { ...data, status: "corrected", correctedAt: new Date().toISOString(), tmComment: comment, correctionDiff: diff };
    await saveSmData(salon.key, ym, next);
    setData(next); setEditMode(false); setComment(""); setSaving(false);
  };
  const approveToManager = async () => {
    const next = { ...data, tmApproved: true, tmApprovedAt: new Date().toISOString() };
    setData(next);
    await saveSmData(salon.key, ym, next);
  };

  return (
    <div className="embedded">
      <div className="detail-head">
        <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> До списку салонів</button>
        <span className="detail-title">{salonLabel(salon)}</span>
      </div>

      <div className="month-row">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {Array.from(new Set([ym, ...months])).sort().reverse().map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
      </div>

      {loading ? <div className="loading">Завантаження…</div> : (
        <>
          <div className="status-line">
            Статус: {data.status === "submitted" ? "подано на погодження" : data.status === "corrected" ? "внесено корективи" : "салон ще не подав дані"}
            {data.submittedAt && ` · подано ${fmtDate(data.submittedAt)}`}
            {data.tmApproved && " · передано керівнику"}
          </div>
          {data.smReplyComment && <div className="reply-banner"><b>Коментар салону:</b> {data.smReplyComment}</div>}

          {canEdit && (!editMode ? (
            <div className="edit-toggle-bar">
              <button className="btn-secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Внести корективи</button>
              {!data.tmApproved && data.status !== "draft" && (
                <button className="btn-secondary" onClick={approveToManager}><Check size={14} /> Передати керівнику</button>
              )}
            </div>
          ) : (
            <div className="correction-bar">
              <label className="over-field" style={{ maxWidth: "100%" }}>
                Коментар до корективи (побачить салон)
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
              <div className="correction-actions">
                <button className="btn-secondary" onClick={cancelEdit}>Скасувати</button>
                <button className="btn-primary" onClick={saveCorrections} disabled={saving}>{saving ? "Збереження…" : "Зберегти корективи"}</button>
              </div>
            </div>
          ))}

          <SmCriteriaForm
            data={data} update={update} calc={calc} area={salon.area} showAmounts
            onAddShot={onAddShot} onRemoveShot={onRemoveShot} onPreview={setPreview} readOnly={!editMode} isQuarterEnd={isQuarterEnd}
          />
          <SmSummary
            data={data} calc={calc} expandedBlock={expandedBlock} onToggle={toggleBlock}
            editable={canEdit} onAdjChange={(a) => setData((p) => ({ ...p, adj: a }))}
            onSaveAdj={saveAdjOnly} savingAdj={saving} onSetPaymentStatus={setPaymentStatus} monthLbl={monthLabel(ym)}
          />
        </>
      )}
      {preview && <ImageModal src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* =========================================================
   ТМ · ВКЛАДКА «ЗП САЛОНІВ» (лише свої салони)
========================================================= */
function SalonReviewPanel({ tmKey, reviewer }) {
  const salons = useMemo(() => salonsOfTm(tmKey), [tmKey]);
  const [ym, setYm] = useState(nowYm());
  const [rows, setRows] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  const months = useMemo(() => {
    return recentMonths(12);
  }, []);

  useEffect(() => {
    let active = true;
    setRows(null);
    (async () => {
      const out = {};
      for (const s of salons) {
        const d = await loadSmData(s.key, ym);
        out[s.key] = { data: d, total: calcSmAll(d, { ym, area: s.area }).total };
      }
      if (active) setRows(out);
    })();
    return () => { active = false; };
  }, [salons, ym, openKey]);

  if (openKey) {
    const salon = salonByKey(openKey);
    return <SalonDetail salon={salon} reviewer={reviewer} onBack={() => setOpenKey(null)} />;
  }

  return (
    <div className="embedded">
      <div className="month-row">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
      </div>
      {!rows ? <div className="loading">Завантаження…</div> : (
        <div className="salon-list">
          {salons.map((s) => {
            const r = rows[s.key];
            const st = r.data.status;
            return (
              <button className="salon-row" key={s.key} onClick={() => setOpenKey(s.key)}>
                <span className="salon-row-main">
                  <span className="salon-row-name">{salonLabel(s)}</span>
                  <span className="salon-row-sub">{s.area}</span>
                </span>
                <span className={`badge ${st === "submitted" ? "badge-ok" : st === "corrected" ? "badge-off" : "badge-warn"}`}>
                  {st === "submitted" ? "подано" : st === "corrected" ? "корективи" : "чернетка"}
                </span>
                {r.data.tmApproved && <span className="badge badge-warn">керівнику</span>}
                <b className="salon-row-total">{fmt(r.total)}</b>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   ЗВЕДЕННЯ ЗП (керівник + бухгалтер)
========================================================= */
async function tmGrandTotal(tmKey, ym) {
  const qKey = ymToQuarter(ym);
  const qMonths = quarterMonths(qKey);
  const isLast = ym === qMonths[2];
  const [d, a, g, qb] = await Promise.all([
    loadData(tmKey, ym), loadAdj(tmKey, ym), loadGrade(tmKey, qKey),
    isLast ? loadQBonus(tmKey, qKey) : Promise.resolve({ bonus41: 0, bonus42: 0 }),
  ]);
  const calc = calcAll(d, g, tmKey);
  const total = calc.floored + (isLast ? (qb.bonus41 + qb.bonus42) : 0) + (a.amount || 0) - (a.advance || 0);
  return { data: d, total, status: d.status, paymentStatus: d.paymentStatus };
}

function ConsolidationPanel({ role }) {
  const [ym, setYm] = useState(nowYm());
  const [rows, setRows] = useState(null);
  const [reload, setReload] = useState(0);

  const months = useMemo(() => {
    return recentMonths(12);
  }, []);

  useEffect(() => {
    let active = true;
    setRows(null);
    (async () => {
      const tmRows = [];
      for (const t of TMS) {
        const r = await tmGrandTotal(t.key, ym);
        tmRows.push({ kind: "tm", key: t.key, name: t.name, tm: null, ...r });
      }
      const smRows = [];
      for (const s of SALONS) {
        const d = await loadSmData(s.key, ym);
        smRows.push({
          kind: "sm", key: s.key, name: salonLabel(s), tm: s.tm,
          data: d, total: calcSmAll(d, { ym, area: s.area }).total,
          status: d.status, paymentStatus: d.paymentStatus, tmApproved: d.tmApproved,
        });
      }
      if (active) setRows([...tmRows, ...smRows]);
    })();
    return () => { active = false; };
  }, [ym, reload]);

  const setPay = async (row, status) => {
    if (row.kind === "tm") {
      const d = await loadData(row.key, ym);
      await saveData(row.key, ym, { ...d, paymentStatus: status, paymentStatusAt: new Date().toISOString() });
    } else {
      const d = await loadSmData(row.key, ym);
      await saveSmData(row.key, ym, { ...d, paymentStatus: status, paymentStatusAt: new Date().toISOString() });
    }
    setReload((n) => n + 1);
  };

  const total = rows ? rows.reduce((s, r) => s + r.total, 0) : 0;
  const toPay = rows ? rows.filter((r) => r.paymentStatus === "to_pay").length : 0;
  const paid = rows ? rows.filter((r) => r.paymentStatus === "paid").length : 0;

  const statusLabel = (s) => (s === "submitted" ? "подано" : s === "corrected" ? "корективи" : "чернетка");

  return (
    <div className="embedded">
      <div className="month-row">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
        {rows && <span className="hint">До виплати: {toPay} · Виплачено: {paid}</span>}
      </div>

      {!rows ? <div className="loading">Завантаження…</div> : (
        <div className="consol-table">
          {rows.map((r) => (
            <div className="consol-row" key={r.kind + r.key}>
              <span className="consol-name">
                {r.name}
                <span className="consol-role">{r.kind === "tm" ? "ТМ" : `Салон · ${tmByKey(r.tm)?.name || ""}`}</span>
              </span>
              <span className={`badge ${r.status === "submitted" ? "badge-ok" : r.status === "corrected" ? "badge-off" : "badge-warn"}`}>
                {statusLabel(r.status)}
              </span>
              {r.kind === "sm" && r.tmApproved && <span className="badge badge-warn">керівнику</span>}
              <b className="consol-total">{fmt(r.total)}</b>
              <span className={`badge ${r.paymentStatus === "paid" ? "badge-ok" : r.paymentStatus === "to_pay" ? "badge-warn" : "badge-off"}`}>
                {r.paymentStatus === "paid" ? "виплачено" : r.paymentStatus === "to_pay" ? "до виплати" : "—"}
              </span>
              <span className="consol-actions">
                {role === "manager" && r.paymentStatus !== "to_pay" && r.paymentStatus !== "paid" && (
                  <button className="btn-secondary small" onClick={() => setPay(r, "to_pay")}>До виплати</button>
                )}
                {role === "manager" && r.paymentStatus === "to_pay" && (
                  <button className="btn-secondary small" onClick={() => setPay(r, "paid")}>Виплачено</button>
                )}
                {role === "manager" && r.paymentStatus === "paid" && (
                  <button className="btn-secondary small" onClick={() => setPay(r, "to_pay")}>Повернути</button>
                )}
                {role === "accountant" && r.paymentStatus === "to_pay" && (
                  <button className="btn-secondary small" onClick={() => setPay(r, "paid")}>Виплачено</button>
                )}
                {role === "accountant" && r.paymentStatus === "paid" && (
                  <button className="btn-secondary small" onClick={() => setPay(r, "to_pay")}>Повернути</button>
                )}
              </span>
            </div>
          ))}
          <div className="consol-row consol-total-row">
            <span className="consol-name">Разом за {monthLabel(ym)}</span>
            <b className="consol-total">{fmt(total)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   АДМІНІСТРУВАННЯ (кабінет Шаха Андрія) — запити на відновлення паролю
========================================================= */
function cabName(key) {
  if (key === "manager") return MANAGER.name;
  const o = OFFICE.find((x) => x.key === key);
  if (o) return o.name;
  const t = tmByKey(key);
  if (t) return `ТМ ${t.name}`;
  const s = salonByKey(key);
  if (s) return salonLabel(s);
  return key;
}

function AdminPanel() {
  const [reqs, setReqs] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    listRecoveryRequests().then((r) => { if (active) setReqs(r); });
    return () => { active = false; };
  }, [reload]);

  const dismiss = async (k) => { await clearRecovery(k); setReload((n) => n + 1); };

  return (
    <div className="embedded">
      <div className="admin-panel">
        <h3>Запити на відновлення паролю</h3>
        <p className="hint">Передайте код відповідній особі. Вона введе його разом із новим паролем на екрані входу. Після зміни паролю запит зникає.</p>
        {reqs === null ? (
          <div className="loading">Завантаження…</div>
        ) : reqs.length === 0 ? (
          <div className="admin-empty">Активних запитів немає.</div>
        ) : (
          <div className="admin-list">
            {reqs.map((r) => (
              <div className="admin-req" key={r.cabKey}>
                <div className="admin-req-info">
                  <span className="admin-req-name">{cabName(r.cabKey)}</span>
                  <span className="admin-req-time">запит {fmtDate(r.at)}</span>
                </div>
                <span className="admin-req-code">{r.code}</span>
                <button className="btn-secondary small" onClick={() => dismiss(r.cabKey)}>Готово</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   КАБІНЕТИ (обгортки з навігацією)
========================================================= */
function TmCabinet({ tmKey, onExit, onLogout }) {
  const tm = tmByKey(tmKey);
  const [tab, setTab] = useState("salary");
  const isAdmin = tmKey === ADMIN_KEY;
  return (
    <div className="view">
      <TopBar title={`ТМ · ${tm.name}`} onBack={onExit} onLogout={onLogout} />
      <div className="cab-nav">
        <button className={tab === "salary" ? "active" : ""} onClick={() => setTab("salary")}><Calculator size={14} /> Розрахунок ЗП</button>
        <button className={tab === "salons" ? "active" : ""} onClick={() => setTab("salons")}><Store size={14} /> ЗП салонів</button>
        {isAdmin && (
          <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}><User size={14} /> Адміністрування</button>
        )}
      </div>
      {tab === "salary" && <TmView tmKey={tmKey} tmName={tm.name} embedded />}
      {tab === "salons" && <SalonReviewPanel tmKey={tmKey} reviewer="tm" />}
      {tab === "admin" && isAdmin && <AdminPanel />}
    </div>
  );
}

function ManagerCabinet({ onExit, onLogout }) {
  const [tab, setTab] = useState("byTm");
  return (
    <div className="view">
      <TopBar title={MANAGER.name} onBack={onExit} onLogout={onLogout} />
      <div className="cab-nav">
        <button className={tab === "byTm" ? "active" : ""} onClick={() => setTab("byTm")}><Users size={14} /> По ТМ</button>
        <button className={tab === "consol" ? "active" : ""} onClick={() => setTab("consol")}><Wallet size={14} /> Зведення ЗП</button>
      </div>
      {tab === "byTm" && <ManagerView embedded />}
      {tab === "consol" && <ConsolidationPanel role="manager" />}
    </div>
  );
}

function AccountantCabinet({ onExit, onLogout }) {
  return (
    <div className="view">
      <TopBar title={ACCOUNTANT.name} onBack={onExit} onLogout={onLogout} />
      <div className="cab-nav"><button className="active"><Wallet size={14} /> Зведення ЗП</button></div>
      <ConsolidationPanel role="accountant" />
    </div>
  );
}

function SmCabinet({ salonKey, onExit, onLogout }) {
  const salon = salonByKey(salonKey);
  return (
    <div className="view">
      <TopBar title={`Салон · ${salonLabel(salon)}`} onBack={onExit} onLogout={onLogout} />
      <div className="cab-nav"><button className="active"><Calculator size={14} /> Розрахунок ЗП</button></div>
      <SmView salon={salon} embedded />
    </div>
  );
}

function OfficeCabinet({ cabKey, onExit, onLogout }) {
  const person = OFFICE.find((o) => o.key === cabKey);
  return (
    <div className="view">
      <TopBar title={person?.name || "Офіс"} onBack={onExit} onLogout={onLogout} />
      <div className="cab-nav"><button className="active"><Clock size={14} /> Кабінет</button></div>
      <div className="office-stub">
        <span className="office-stub-ic"><Clock size={26} /></span>
        <h3>Кабінет у розробці</h3>
        <p>Вміст кабінету «{person?.name}» ще налаштовується. Логін уже працює — доступ буде відкрито найближчим часом.</p>
      </div>
    </div>
  );
}

function CabinetRouter({ cabinet, onExit, onLogout }) {
  switch (cabinet.type) {
    case "manager": return <ManagerCabinet onExit={onExit} onLogout={onLogout} />;
    case "accountant": return <AccountantCabinet onExit={onExit} onLogout={onLogout} />;
    case "office": return <OfficeCabinet cabKey={cabinet.key} onExit={onExit} onLogout={onLogout} />;
    case "tm": return <TmCabinet tmKey={cabinet.key} onExit={onExit} onLogout={onLogout} />;
    case "sm": return <SmCabinet salonKey={cabinet.key} onExit={onExit} onLogout={onLogout} />;
    default: return null;
  }
}

const SUBTITLE = { manager: "Керівник", accountant: "Зведення · виплати", office: "Офіс", tm: "Територіальний менеджер", sm: "Салон майстерності" };

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;450;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root {
  --bg:#161E29; --bg-2:#1E2836;
  --surface:#FBF8F0; --surface-alt:#F1EBDA; --surface-sink:#EDE6D2;
  --ink:#221F1A; --ink-soft:#4A4437; --muted:#8A8069; --faint:#B8AF97;
  --on-dark:#F7F4EA; --on-dark-2:#C4BCA6;
  --gold:#BE8A2E; --gold-bright:#DCA94A; --gold-ink:#5C4113;
  --positive:#3C6B49; --positive-bright:#7FBF8F;
  --negative:#A03A2A; --negative-bright:#E0917F;
  --line:#E1D9C1; --line-strong:#CFC5A6; --line-dark:rgba(247,244,234,.12);
  --radius:14px; --radius-md:10px; --radius-sm:8px;
  --sh-1:0 1px 2px rgba(20,15,5,.05), 0 1px 3px rgba(20,15,5,.04);
  --sh-2:0 2px 6px rgba(20,15,5,.06), 0 12px 28px -12px rgba(20,15,5,.18);
  --sh-3:0 8px 24px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.2);
  --ease:cubic-bezier(.32,.72,.28,1);
}

.app-root{
  font-family:'Inter',system-ui,sans-serif;
  color:var(--ink);
  background:
    radial-gradient(1100px 620px at 78% -8%, rgba(190,138,46,.16), transparent 60%),
    radial-gradient(900px 520px at 8% 4%, rgba(120,150,200,.10), transparent 55%),
    linear-gradient(180deg, var(--bg-2), var(--bg));
  background-attachment:fixed;
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
.app-root *{box-sizing:border-box;}
.app-root ::selection{background:rgba(190,138,46,.28);}

/* ---------- role select & pin ---------- */
.role-select{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;}
.role-select-inner{max-width:440px;width:100%;text-align:center;}
.role-eyebrow{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-bright);margin-bottom:14px;padding:5px 12px;border:1px solid var(--line-dark);border-radius:999px;background:rgba(247,244,234,.03);}
.role-select-inner h1{font-family:'Fraunces',serif;font-size:34px;line-height:1.1;color:var(--on-dark);margin:0 0 10px;font-weight:600;letter-spacing:-.015em;}
.role-select-inner p{color:var(--on-dark-2);margin:0 0 30px;font-size:14px;}
.role-cards{display:flex;flex-direction:column;gap:10px;}
.role-card-group{display:flex;flex-direction:column;gap:10px;}
.role-card{width:100%;display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid transparent;border-radius:var(--radius);padding:16px 18px;cursor:pointer;color:var(--ink);text-align:left;box-shadow:var(--sh-2);transition:transform .18s var(--ease),box-shadow .18s var(--ease),border-color .18s var(--ease);}
.role-card:hover{transform:translateY(-3px);box-shadow:var(--sh-3);border-color:var(--gold);}
.role-card:active{transform:translateY(-1px);}
.role-card-manager{background:linear-gradient(180deg,#FFFDF6,var(--surface-alt));}
.role-card-icon{flex-shrink:0;width:42px;height:42px;border-radius:11px;background:linear-gradient(180deg,var(--surface-alt),var(--surface-sink));display:flex;align-items:center;justify-content:center;color:var(--gold);box-shadow:inset 0 0 0 1px rgba(0,0,0,.04);}
.role-card-text{display:flex;flex-direction:column;gap:3px;min-width:0;}
.role-card-name{font-size:14.5px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.role-card-sub{font-size:11px;color:var(--muted);letter-spacing:.02em;}

.pin-avatar{width:60px;height:60px;border-radius:50%;background:linear-gradient(180deg,#FFFDF6,var(--surface-alt));color:var(--gold);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-family:'Fraunces',serif;font-size:20px;font-weight:600;box-shadow:var(--sh-2),inset 0 0 0 1px rgba(0,0,0,.05);}
.pin-digits{display:flex;gap:10px;justify-content:center;margin-bottom:6px;}
.pin-digits.shake{animation:pinShake .4s ease;}
@keyframes pinShake{10%,90%{transform:translateX(-2px);}20%,80%{transform:translateX(4px);}30%,50%,70%{transform:translateX(-8px);}40%,60%{transform:translateX(8px);}}
.pin-digit{width:52px;height:60px;text-align:center;font-size:26px;font-family:'IBM Plex Mono',monospace;border-radius:12px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);box-shadow:var(--sh-1);transition:border-color .15s var(--ease),box-shadow .15s var(--ease),transform .15s var(--ease);}
.pin-digit:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 4px rgba(190,138,46,.22);transform:translateY(-1px);}
.pin-sublabel{color:var(--on-dark-2);font-size:12px;margin:16px 0 6px;}
.pin-error{color:var(--negative-bright);font-size:12px;margin:12px 0;min-height:16px;opacity:0;transform:translateY(-2px);transition:opacity .18s var(--ease),transform .18s var(--ease);}
.pin-error.visible{opacity:1;transform:none;}
.pin-actions{display:flex;gap:10px;justify-content:center;margin-bottom:12px;}
.pin-forgot{background:none;border:none;color:var(--on-dark-2);font-size:12px;cursor:pointer;padding:8px;border-radius:6px;text-underline-offset:3px;text-decoration:underline;}
.pin-forgot:hover{color:var(--on-dark);}

/* ---------- shell ---------- */
.view{max-width:900px;margin:0 auto;padding:8px 22px 96px;animation:fadeIn .3s ease both;}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:16px 22px 14px;margin:0 -22px 10px;background:var(--bg-2);border-bottom:1px solid var(--line-dark);box-shadow:0 10px 22px -14px rgba(0,0,0,.6);}
.topbar-back{background:rgba(247,244,234,.05);border:1px solid var(--line-dark);color:var(--on-dark-2);display:flex;align-items:center;gap:3px;cursor:pointer;font-size:12.5px;padding:7px 12px 7px 8px;border-radius:999px;transition:background .15s var(--ease),color .15s var(--ease);}
.topbar-back:hover{background:rgba(247,244,234,.1);color:var(--on-dark);}
.topbar-title{font-family:'Fraunces',serif;font-size:21px;color:var(--on-dark);font-weight:600;letter-spacing:-.01em;}

.month-picker,.month-row{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;}
.month-picker select,.month-row select{appearance:none;-webkit-appearance:none;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23BE8A2E' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 12px center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:9px 32px 9px 13px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);cursor:pointer;box-shadow:var(--sh-1);}
.month-picker select:focus,.month-row select:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.2);}

.badge-ok,.badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:5px 11px;border-radius:999px;background:rgba(63,107,74,.2);color:var(--positive-bright);font-weight:600;letter-spacing:.01em;border:1px solid rgba(127,191,143,.2);}
.badge-off{background:rgba(160,58,42,.18);color:var(--negative-bright);border-color:rgba(224,145,127,.2);}
.badge-warn{background:rgba(190,138,46,.18);color:var(--gold-bright);border-color:rgba(220,169,74,.22);}

.grade-picker{display:flex;align-items:center;gap:7px;color:var(--on-dark-2);font-size:12.5px;}
.grade-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--line-dark);background:rgba(247,244,234,.04);color:var(--on-dark-2);cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:13px;transition:all .15s var(--ease);}
.grade-btn:hover{border-color:var(--gold);color:var(--on-dark);}
.grade-btn.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);border-color:transparent;font-weight:700;box-shadow:0 4px 12px rgba(190,138,46,.35);}

.banner{display:flex;align-items:center;gap:10px;padding:13px 16px;border-radius:var(--radius-md);margin-bottom:18px;font-size:13px;line-height:1.4;border:1px solid transparent;}
.banner svg{flex-shrink:0;}
.banner-warn{background:rgba(190,138,46,.14);color:var(--gold-bright);border-color:rgba(220,169,74,.22);}
.banner-late{background:rgba(160,58,42,.18);color:var(--negative-bright);border-color:rgba(224,145,127,.22);}
.loading{color:var(--on-dark-2);padding:44px 0;text-align:center;font-size:13px;animation:pulse 1.4s ease-in-out infinite;}

/* ---------- blocks & items ---------- */
.block-header{display:flex;align-items:center;gap:12px;margin:30px 0 12px;}
.block-header::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line-dark),transparent);}
.block-header-n{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--gold-bright);letter-spacing:.12em;text-transform:uppercase;padding:4px 9px;border:1px solid var(--line-dark);border-radius:999px;background:rgba(247,244,234,.03);}
.block-header-title{font-family:'Fraunces',serif;font-size:20px;color:var(--on-dark);font-weight:600;letter-spacing:-.01em;}

.item{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-bottom:11px;box-shadow:var(--sh-2);transition:border-color .16s var(--ease),transform .16s var(--ease),box-shadow .16s var(--ease);}
.item:focus-within{border-color:var(--gold);box-shadow:var(--sh-2),0 0 0 3px rgba(190,138,46,.14);}
.item-head{display:flex;align-items:center;gap:9px;margin-bottom:12px;flex-wrap:wrap;}
.item-num{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;color:var(--muted);background:var(--surface-alt);padding:3px 7px;border-radius:6px;}
.item-title{font-weight:600;font-size:14px;flex:1;letter-spacing:-.005em;color:var(--ink);}
.item-amount{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--muted);padding:3px 9px;border-radius:999px;background:var(--surface-alt);white-space:nowrap;}
.item-amount.pos{color:var(--positive);background:rgba(60,107,73,.12);}
.item-amount.neg{color:var(--negative);background:rgba(160,58,42,.12);}
.item-cond{flex-shrink:0;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:none;border:1px solid var(--line-strong);border-radius:999px;padding:3px 9px;cursor:pointer;transition:color .14s var(--ease),border-color .14s var(--ease),background .14s var(--ease);}
.item-cond:hover{color:var(--gold);border-color:var(--gold);background:rgba(190,138,46,.08);}
.item-body{display:flex;align-items:flex-start;gap:16px;}
.item-fields{display:flex;flex-wrap:wrap;gap:12px 18px;flex:1;}

.field{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--muted);min-width:158px;}
.field-full{width:100%;}
.field-label{font-weight:500;letter-spacing:.01em;}
.field-input-wrap{display:flex;align-items:center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;padding:7px 11px;transition:border-color .14s var(--ease),box-shadow .14s var(--ease);}
.field-input-wrap:focus-within{border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.16);}
.field-input{border:none;background:none;font-family:'IBM Plex Mono',monospace;font-size:13.5px;color:var(--ink);width:100%;outline:none;}
.field-value{border:1px solid var(--line);border-radius:var(--radius-sm);padding:7px 11px;font-family:'IBM Plex Mono',monospace;font-size:13.5px;color:var(--ink-soft);background:var(--surface-alt);}
.field-suffix{font-size:11px;color:var(--muted);margin-left:6px;font-family:'IBM Plex Mono',monospace;}
.check-field{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink);cursor:pointer;}
.check-field input[type=checkbox]{width:16px;height:16px;accent-color:var(--gold);cursor:pointer;}
.check-dot{width:11px;height:11px;border-radius:50%;background:var(--line-strong);display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);}
.check-dot.on{background:var(--positive);box-shadow:0 0 0 3px rgba(60,107,73,.18);}
.hint{font-size:11px;color:var(--muted);width:100%;line-height:1.45;}

.shot-stack{flex-shrink:0;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;max-width:150px;}
.shot-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;width:68px;height:68px;border:1.5px dashed var(--line-strong);border-radius:var(--radius-md);background:var(--surface-alt);color:var(--muted);cursor:pointer;font-size:10px;transition:all .15s var(--ease);}
.shot-add:hover{border-color:var(--gold);color:var(--gold);background:rgba(190,138,46,.06);}
.shot-empty{width:68px;height:68px;border:1.5px dashed var(--line);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--faint);text-align:center;padding:4px;}
.shot-thumb{position:relative;width:68px;height:68px;border-radius:var(--radius-md);overflow:hidden;cursor:pointer;border:1px solid var(--line);box-shadow:var(--sh-1);transition:transform .15s var(--ease);}
.shot-thumb:hover{transform:scale(1.03);}
.shot-thumb img{width:100%;height:100%;object-fit:cover;}
.shot-remove{position:absolute;top:3px;right:3px;background:rgba(0,0,0,.62);border:none;border-radius:50%;width:19px;height:19px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);}

/* ---------- вставка скріна (paste modal) ---------- */
.paste-modal{position:relative;background:var(--surface);border-radius:var(--radius);max-width:440px;width:100%;box-shadow:var(--sh-3);overflow:hidden;animation:fadeIn .2s ease both;}
.paste-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin:18px;padding:32px 20px;border:2px dashed var(--line-strong);border-radius:var(--radius-md);background:var(--surface-alt);color:var(--muted);text-align:center;cursor:pointer;font-family:inherit;transition:border-color .15s var(--ease),background .15s var(--ease);}
.paste-zone:hover,.paste-zone:focus-visible{border-color:var(--gold);background:rgba(190,138,46,.06);}
.paste-zone b{color:var(--ink);font-size:13px;font-weight:600;}
.paste-zone span{font-size:11.5px;}
.paste-actions{display:flex;justify-content:flex-end;padding:0 18px 18px;}

/* ---------- рядки по магазинах ---------- */
.salon-rows{display:flex;flex-direction:column;gap:2px;}
.salon-check-row{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink);padding:7px 0;border-bottom:1px dashed var(--line);cursor:pointer;}
.salon-check-row:last-child{border-bottom:none;}
.salon-check-row input[type=checkbox]{width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;}
.salon-pct-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--line);}
.salon-pct-row:last-child{border-bottom:none;}
.salon-pct-name{flex:1;font-size:12.5px;color:var(--ink-soft);min-width:0;}
.salon-pct-inputwrap{display:flex;align-items:center;gap:5px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;padding:6px 10px;}
.salon-pct-inputwrap:focus-within{border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.16);}
.salon-pct-input{width:60px;border:none;background:none;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);outline:none;text-align:right;}
.salon-pct-suffix{font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;}
.salon-pct-val{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink-soft);}

/* ---------- корективи по пунктах ---------- */
.item-note{font-weight:500;font-size:11px;color:var(--muted);}
.item-flagbtn{flex-shrink:0;display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--ink-soft);background:var(--surface-alt);border:1px solid var(--line-strong);border-radius:999px;padding:4px 10px;cursor:pointer;transition:all .14s var(--ease);}
.item-flagbtn:hover{border-color:var(--gold);color:var(--gold);}
.item-flagbtn.on{background:rgba(160,58,42,.12);border-color:rgba(160,58,42,.35);color:var(--negative);}
.item-flagged{border-color:rgba(160,58,42,.5);box-shadow:0 0 0 3px rgba(160,58,42,.1);}
.item-flag-editor{margin-bottom:12px;}
.item-flag-editor textarea{width:100%;padding:9px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12.5px;resize:vertical;background:#fff;}
.item-flag-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}
.item-flag-note{background:rgba(160,58,42,.08);border-left:3px solid var(--negative);border-radius:var(--radius-sm);padding:9px 12px;font-size:12.5px;color:var(--ink-soft);margin-bottom:12px;line-height:1.45;}
.item-flag-note b{color:var(--negative);}
.flag-list{display:flex;flex-direction:column;gap:7px;margin-bottom:16px;}
.flag-list-row{display:flex;gap:10px;background:rgba(160,58,42,.06);border:1px solid rgba(160,58,42,.18);border-radius:var(--radius-sm);padding:9px 12px;}
.flag-list-num{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--negative);flex-shrink:0;}
.flag-list-comment{font-size:12.5px;color:var(--ink-soft);line-height:1.4;}

.ez-sub{display:flex;flex-wrap:wrap;gap:8px 18px;width:100%;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink-soft);border-top:1px dashed var(--line-strong);padding-top:10px;margin-top:6px;}

/* ---------- buttons ---------- */
.save-bar{display:flex;justify-content:flex-end;margin-top:24px;}
.btn-primary{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);border:none;border-radius:var(--radius-sm);padding:13px 26px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;box-shadow:0 6px 18px -4px rgba(190,138,46,.5),inset 0 1px 0 rgba(255,255,255,.28);letter-spacing:.01em;transition:transform .14s var(--ease),box-shadow .16s var(--ease),filter .16s var(--ease);}
.btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 26px -6px rgba(190,138,46,.55),inset 0 1px 0 rgba(255,255,255,.3);filter:brightness(1.03);}
.btn-primary:active:not(:disabled){transform:translateY(0);}
.btn-primary:disabled{opacity:.55;cursor:default;}
.btn-secondary{background:rgba(247,244,234,.05);border:1px solid var(--line-dark);color:var(--on-dark);border-radius:var(--radius-sm);padding:11px 18px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s var(--ease);}
.btn-secondary:hover:not(:disabled){border-color:var(--gold);color:var(--gold-bright);background:rgba(190,138,46,.08);}
.btn-secondary.small{padding:7px 13px;font-size:12px;color:var(--ink-soft);background:var(--surface-alt);border-color:var(--line-strong);}
.btn-secondary.small:hover:not(:disabled){color:var(--gold);border-color:var(--gold);background:rgba(190,138,46,.08);}

.modal-overlay{position:fixed;inset:0;background:rgba(12,10,6,.78);display:flex;align-items:center;justify-content:center;z-index:50;padding:24px;backdrop-filter:blur(4px);animation:fadeIn .18s ease both;}
.modal-content{position:relative;max-width:90vw;max-height:90vh;}
.modal-content img{max-width:90vw;max-height:88vh;border-radius:var(--radius-md);box-shadow:var(--sh-3);}
.modal-close{position:absolute;top:-15px;right:-15px;background:var(--surface);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--sh-2);}

/* ---------- info / умови modal ---------- */
.info-modal{position:relative;background:var(--surface);border-radius:var(--radius);max-width:520px;width:100%;max-height:82vh;display:flex;flex-direction:column;box-shadow:var(--sh-3);overflow:hidden;animation:fadeIn .2s ease both;}
.info-modal-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--surface-alt);}
.info-modal-title{font-family:'Fraunces',serif;font-size:15.5px;font-weight:600;color:var(--ink);flex:1;letter-spacing:-.01em;}
.info-modal-close{position:static;top:auto;right:auto;width:28px;height:28px;box-shadow:none;background:var(--surface);border:1px solid var(--line-strong);flex-shrink:0;}
.info-modal-body{padding:16px 18px;overflow-y:auto;}
.cond-blocks{display:flex;flex-direction:column;gap:12px;}
.cond-p{font-size:13px;line-height:1.55;color:var(--ink-soft);margin:0;}
.cond-note{font-size:11.5px;line-height:1.5;color:var(--muted);margin:0;padding-left:11px;border-left:2px solid var(--line-strong);}
.cond-ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;}
.cond-ul li{font-size:12.5px;line-height:1.5;color:var(--ink-soft);}
.cond-table-wrap{overflow-x:auto;}
.cond-table{width:100%;border-collapse:collapse;font-size:12px;font-family:'IBM Plex Mono',monospace;}
.cond-table th{text-align:right;font-weight:600;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line-strong);white-space:nowrap;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;}
.cond-table th:first-child{text-align:left;}
.cond-table td{text-align:right;padding:7px 8px;border-bottom:1px dashed var(--line);color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums;}
.cond-table td.cond-td-label{text-align:left;color:var(--ink-soft);font-family:'Inter',sans-serif;font-size:12px;}
.cond-table tr:last-child td{border-bottom:none;}

/* ---------- tabs ---------- */
.tm-tabs{display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--line-dark);}
.tm-tab{background:none;border:none;border-bottom:2px solid transparent;padding:11px 16px;font-size:13px;font-weight:600;color:var(--on-dark-2);cursor:pointer;font-family:inherit;transition:color .15s var(--ease),border-color .15s var(--ease);margin-bottom:-1px;}
.tm-tab:hover{color:var(--on-dark);}
.tm-tab.active{color:var(--gold-bright);border-bottom-color:var(--gold);}
.inner-tabs{display:flex;gap:3px;margin-bottom:20px;background:rgba(247,244,234,.05);border:1px solid var(--line-dark);border-radius:10px;padding:4px;width:fit-content;max-width:100%;}
.inner-tabs button{background:none;border:none;color:var(--on-dark-2);padding:8px 15px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;font-family:inherit;white-space:nowrap;transition:background .15s var(--ease),color .15s var(--ease);}
.inner-tabs button:hover{color:var(--on-dark);}
.inner-tabs button.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);box-shadow:0 3px 10px rgba(190,138,46,.32);}

.status-line{font-size:12px;color:var(--on-dark-2);margin-bottom:12px;letter-spacing:.01em;}
.reply-banner{background:rgba(190,138,46,.12);color:var(--gold-bright);border:1px solid rgba(220,169,74,.2);border-radius:var(--radius-md);padding:11px 15px;font-size:13px;margin-bottom:14px;line-height:1.45;}
.edit-toggle-bar{display:flex;justify-content:flex-end;margin-bottom:14px;}
.correction-bar{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-bottom:16px;box-shadow:var(--sh-2);}
.correction-bar textarea{width:100%;padding:9px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;resize:vertical;background:#fff;}
.correction-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;flex-wrap:wrap;}
.correction-bar .btn-secondary{color:var(--ink-soft);background:var(--surface-alt);border-color:var(--line-strong);}
.correction-bar .btn-secondary:hover:not(:disabled){color:var(--gold);border-color:var(--gold);background:rgba(190,138,46,.08);}
.correction-bar .btn-secondary:disabled{opacity:.5;}

/* ---------- salary summary ---------- */
.summary{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:8px 22px 22px;margin-top:24px;box-shadow:var(--sh-2);}
.summary-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;font-size:13px;border-bottom:1px dashed var(--line-strong);font-family:'IBM Plex Mono',monospace;color:var(--ink-soft);}
.summary-row b{color:var(--ink);}
.summary-row.total{font-weight:700;border-bottom:2px solid var(--ink);color:var(--ink);margin-top:4px;}
.summary-row.floor-note{color:var(--gold);font-style:italic;}
.summary-row.grand{
  font-size:15px;font-weight:600;border:none;margin-top:16px;padding:18px 20px;
  background:linear-gradient(135deg,#20160A,#3A2A12);
  color:var(--on-dark);border-radius:var(--radius-md);
  box-shadow:inset 0 0 0 1px rgba(220,169,74,.25),0 10px 26px -10px rgba(0,0,0,.4);
}
.summary-row.grand span{font-family:'Inter',sans-serif;font-weight:500;letter-spacing:.01em;color:var(--on-dark-2);}
.summary-row.grand b{font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;color:var(--gold-bright);letter-spacing:-.01em;}

.summary-block{border-bottom:1px dashed var(--line-strong);}
.summary-toggle{width:100%;background:none;border:none;cursor:pointer;text-align:left;border-bottom:none;padding:11px 6px;border-radius:8px;font-family:'IBM Plex Mono',monospace;transition:background .14s var(--ease);}
.summary-toggle:hover{background:var(--surface-alt);}
.summary-toggle span{color:var(--ink);font-weight:500;}
.chevron{color:var(--gold);font-size:10px;margin-left:2px;}
.summary-detail{padding:2px 0 12px 14px;display:flex;flex-direction:column;gap:6px;animation:detailIn .18s ease both;}
.summary-detail-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;font-family:'IBM Plex Mono',monospace;color:var(--muted);}
.summary-detail-row .pos{color:var(--positive);}
.summary-detail-row .neg{color:var(--negative);}

.payment-row{display:flex;align-items:center;gap:10px;padding-top:16px;margin-top:4px;font-size:12px;color:var(--muted);flex-wrap:wrap;}
.adj-row{display:flex;align-items:center;gap:9px;padding:10px 0;font-size:12px;color:var(--muted);border-bottom:1px dashed var(--line-strong);}
.adj-comment{flex:1;padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;font-size:12px;font-family:inherit;}
.adj-amount{width:104px;padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;font-family:'IBM Plex Mono',monospace;font-size:13px;}

/* ---------- chart & quarter ---------- */
.chart-wrap{background:var(--surface);border-radius:var(--radius);padding:22px;border:1px solid var(--line);box-shadow:var(--sh-2);}
.chart-note{font-size:11px;color:var(--muted);margin-top:10px;line-height:1.45;}
.quarter-panel{background:var(--surface);border-radius:var(--radius);padding:22px;border:1px solid var(--line);box-shadow:var(--sh-2);}
.quarter-panel h3{font-family:'Fraunces',serif;font-size:19px;margin:0 0 4px;color:var(--ink);}
.quarter-row{border-top:1px solid var(--line);padding:16px 0;}
.quarter-row-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;font-weight:600;font-size:14px;}
.over-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted);margin-bottom:8px;max-width:240px;}
.over-field input,.over-field textarea{padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:'IBM Plex Mono',monospace;background:#fff;font-size:13px;}
.over-field textarea{font-family:inherit;resize:vertical;}
.quarter-preview{display:flex;gap:22px;font-size:12px;font-family:'IBM Plex Mono',monospace;color:var(--ink-soft);flex-wrap:wrap;}

/* ---------- corrections ---------- */
.corrections-panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--sh-2);}
.manager-comment{background:var(--surface-alt);border-left:3px solid var(--gold);border-radius:var(--radius-sm);padding:13px 15px;font-size:13px;margin-bottom:16px;line-height:1.5;color:var(--ink-soft);}
.diff-list{display:flex;flex-direction:column;gap:2px;margin-bottom:18px;}
.diff-row{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:center;font-size:12px;font-family:'IBM Plex Mono',monospace;border-bottom:1px dashed var(--line-strong);padding:8px 0;}
.diff-label{font-family:'Inter',sans-serif;color:var(--muted);}
.diff-old{color:var(--negative);text-decoration:line-through;opacity:.8;}
.diff-arrow{color:var(--faint);}
.diff-new{color:var(--positive);font-weight:600;}

/* ---------- motion, focus & polish ---------- */
@keyframes fadeIn{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:translateY(0);}}
.fade-in{animation:fadeIn .38s var(--ease) both;}
@keyframes detailIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:.5;}50%{opacity:1;}}
.app-root *:focus-visible{outline:2px solid var(--gold-bright);outline-offset:2px;border-radius:3px;}
.app-root button{transition:transform .12s var(--ease),box-shadow .12s var(--ease),background .15s var(--ease),border-color .15s var(--ease),color .15s var(--ease);}
.app-root button:active:not(:disabled){transform:scale(.985);}
.tm-tab,.inner-tabs button{min-height:38px;}
.grade-btn,.store-remove,.shot-remove{min-width:28px;}

.app-root ::-webkit-scrollbar{width:10px;height:10px;}
.app-root ::-webkit-scrollbar-thumb{background:rgba(247,244,234,.14);border-radius:999px;border:2px solid transparent;background-clip:content-box;}
.app-root ::-webkit-scrollbar-thumb:hover{background:rgba(247,244,234,.24);background-clip:content-box;}

@media (prefers-reduced-motion:reduce){
  .app-root *,.app-root *::before,.app-root *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}
}

/* ---------- responsive ---------- */
@media (max-width:640px){
  .view{padding:4px 13px 84px;}
  .topbar{padding:12px 13px;margin:0 -13px 10px;}
  .topbar-title{font-size:17px;}
  .role-select-inner h1{font-size:27px;}
  .item-body{flex-direction:column;}
  .shot-slot{align-self:flex-start;}
  .item-fields{gap:12px;}
  .field{min-width:0;width:100%;}
  .tm-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .tm-tab{white-space:nowrap;}
  .inner-tabs{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .month-row,.month-picker{flex-direction:column;align-items:stretch;gap:10px;}
  .month-picker select,.month-row select{width:100%;}
  .grade-picker{justify-content:space-between;}
  .diff-row{grid-template-columns:1fr;gap:3px;padding:10px 0;}
  .diff-old,.diff-new{font-size:11px;}
  .adj-row{flex-wrap:wrap;}
  .adj-comment{min-width:100%;order:1;}
  .payment-row{flex-direction:column;align-items:flex-start;}
  .quarter-preview{flex-direction:column;gap:5px;}
  .pin-digit{width:46px;height:54px;font-size:22px;}
  .summary{padding:6px 16px 18px;}
  .summary-row.grand{padding:15px 16px;flex-direction:column;align-items:flex-start;gap:6px;}
  .summary-row.grand b{font-size:22px;}
  .summary-row{flex-wrap:wrap;}
  .btn-primary,.btn-secondary{min-height:44px;}
  .save-bar .btn-primary{width:100%;justify-content:center;}
  .role-card{padding:14px;}
  .deck-grid{grid-template-columns:1fr;}
  .deck-lead,.deck-office,.deck-tm{grid-column:span 1;grid-row:auto;}
  .deck-lead{min-height:0;}
  .consol-row{grid-template-columns:1fr auto;row-gap:6px;}
  .consol-row .consol-total{grid-column:2;}
  .consol-actions{grid-column:1 / -1;justify-content:flex-start;}
  .cab-nav{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .salon-row{flex-wrap:wrap;}
}

/* ---------- живий фон ---------- */
.living-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.living-bg .blob{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;
  background:radial-gradient(circle at 50% 50%, rgba(190,138,46,.20), rgba(190,138,46,0) 70%);
  will-change:transform;}
.blob-1{width:52vw;height:52vw;top:-14vw;left:-10vw;animation:drift1 34s var(--ease) infinite alternate;}
.blob-2{width:44vw;height:44vw;bottom:-16vw;right:-12vw;animation:drift2 42s var(--ease) infinite alternate;}
.blob-3{width:34vw;height:34vw;top:32%;left:44%;opacity:.35;animation:drift3 50s var(--ease) infinite alternate;}
.blob-4{width:26vw;height:26vw;top:8%;right:16%;opacity:.3;animation:drift1 46s var(--ease) infinite alternate-reverse;}
@keyframes drift1{from{transform:translate3d(0,0,0) scale(1);}to{transform:translate3d(6vw,8vh,0) scale(1.12);}}
@keyframes drift2{from{transform:translate3d(0,0,0) scale(1.05);}to{transform:translate3d(-7vw,-6vh,0) scale(.92);}}
@keyframes drift3{from{transform:translate3d(0,0,0) scale(.95);}to{transform:translate3d(-5vw,7vh,0) scale(1.1);}}
@media (prefers-reduced-motion:reduce){.living-bg .blob{animation:none;}}
.role-select,.view,.embedded{position:relative;z-index:1;}

/* ---------- головна · командна панель ---------- */
.deck-screen{align-items:flex-start;padding:clamp(24px,6vw,64px) clamp(16px,5vw,48px) 80px;}
.deck-inner{max-width:1000px;width:100%;margin:0 auto;}
.deck-inner .role-eyebrow{margin-bottom:14px;}
.deck-inner h1{font-family:'Fraunces',serif;font-size:clamp(28px,4.4vw,40px);line-height:1.05;color:var(--on-dark);margin:0 0 8px;font-weight:600;letter-spacing:-.02em;}
.deck-inner>p{color:var(--on-dark-2);margin:0 0 clamp(22px,4vw,34px);font-size:13.5px;}

.deck-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;}
.deck-tile{background:rgba(247,244,234,.035);border:1px solid var(--line-dark);border-radius:16px;padding:17px;display:flex;flex-direction:column;text-align:left;color:var(--on-dark);transition:transform .18s var(--ease),border-color .18s var(--ease),box-shadow .18s var(--ease);}
button.deck-tile,.deck-tile button{cursor:pointer;font-family:inherit;}
button.deck-tile:hover,.deck-orow:hover,.deck-tm-top:hover{transform:translateY(-2px);border-color:var(--line-strong);}

.deck-ic{flex-shrink:0;display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(180deg,var(--surface-alt),var(--surface-sink));color:var(--gold-ink);}
.deck-ic-sm{width:30px;height:30px;border-radius:9px;}
.deck-ic-gold{width:50px;height:50px;background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);box-shadow:0 8px 22px -8px rgba(190,138,46,.5);}
.deck-name{font-weight:700;font-size:13.5px;letter-spacing:-.01em;color:var(--on-dark);line-height:1.25;}
.deck-name-lg{font-family:'Fraunces',serif;font-size:21px;font-weight:600;letter-spacing:-.015em;}
.deck-role{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);}
.deck-role-gold{color:var(--gold-bright);}

.deck-lead{grid-column:span 2;justify-content:space-between;gap:26px;min-height:190px;
  background:radial-gradient(340px 210px at 100% 0%, rgba(220,169,74,.20), transparent 65%), linear-gradient(160deg,#233140,#1A2430);
  border-color:rgba(220,169,74,.28);}
.deck-lead-top{display:flex;flex-direction:column;}
.deck-lead-top .deck-name-lg{margin-top:18px;}
.deck-lead-top .deck-role-gold{margin-top:6px;}
.deck-stat{display:flex;gap:10px;padding-top:16px;border-top:1px solid var(--line-dark);margin-top:auto;}
.deck-stat-cell{display:flex;flex-direction:column;gap:2px;flex:1;}
.deck-stat-cell b{font-family:'IBM Plex Mono',monospace;font-size:19px;color:var(--on-dark);font-variant-numeric:tabular-nums;}
.deck-stat-cell span{font-size:10px;color:var(--muted);letter-spacing:.02em;}

.deck-office{grid-column:span 2;gap:9px;justify-content:space-between;}
.deck-hd{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--on-dark-2);margin-bottom:2px;}
.deck-orow{display:flex;align-items:center;gap:11px;background:rgba(247,244,234,.03);border:1px solid var(--line-dark);border-radius:11px;padding:13px;transition:transform .16s var(--ease),border-color .16s var(--ease);}
.deck-orow-body{display:flex;flex-direction:column;gap:2px;min-width:0;}

.deck-tm{grid-column:span 4;gap:13px;}
.deck-tm-top{display:flex;align-items:center;gap:12px;background:none;border:1px solid transparent;border-radius:11px;margin:-4px;padding:4px;transition:transform .16s var(--ease);}
.deck-chips{display:flex;flex-wrap:wrap;gap:8px;}
.deck-chip{display:inline-flex;align-items:baseline;gap:7px;font-size:12px;color:var(--on-dark);background:rgba(247,244,234,.04);border:1px solid var(--line-dark);border-radius:9px;padding:8px 12px;cursor:pointer;font-family:inherit;transition:border-color .15s var(--ease),background .15s var(--ease);}
.deck-chip:hover{border-color:var(--gold);background:rgba(190,138,46,.1);}
.deck-chip b{font-weight:600;}
.deck-chip span{color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:10px;}

/* ---------- заглушка кабінету офісу ---------- */
.office-stub{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:44px 28px;text-align:center;box-shadow:var(--sh-2);}
.office-stub-ic{display:inline-grid;place-items:center;width:56px;height:56px;border-radius:16px;background:linear-gradient(180deg,var(--surface-alt),var(--surface-sink));color:var(--gold);margin-bottom:16px;}
.office-stub h3{font-family:'Fraunces',serif;font-size:19px;color:var(--ink);margin:0 0 8px;font-weight:600;}
.office-stub p{color:var(--muted);font-size:13px;max-width:42ch;margin:0 auto;line-height:1.5;}
@media (max-width:880px){
  .deck-grid{grid-template-columns:repeat(2,1fr);}
  .deck-lead,.deck-office{grid-column:span 2;grid-row:auto;}
  .deck-tm{grid-column:span 2;}
  .deck-office{flex-direction:row;flex-wrap:wrap;}
  .deck-office .deck-hd{width:100%;}
  .deck-orow{flex:1 1 180px;}
}

/* ---------- вхід ---------- */
.login-fields{display:flex;flex-direction:column;gap:12px;margin:4px 0 2px;text-align:left;}
.login-field{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--on-dark-2);}
.login-field input{padding:11px 13px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface);color:var(--ink);font-family:'IBM Plex Mono',monospace;font-size:14px;}
.login-field input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.2);}
.login-remember{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--on-dark-2);cursor:pointer;padding:2px 0;}
.login-remember input[type=checkbox]{width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;}
.recover-lead{color:var(--on-dark-2);font-size:12.5px;line-height:1.5;margin:0 0 4px;text-align:left;}
.resume-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:rgba(220,169,74,.1);border:1px solid rgba(220,169,74,.28);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--on-dark);}
.resume-bar b{color:var(--gold-bright);}
.resume-actions{display:flex;gap:8px;}
.resume-bar .btn-primary.small,.resume-bar .btn-secondary.small{padding:7px 14px;font-size:12px;}
.topbar-logout{margin-left:auto;background:rgba(247,244,234,.06);border:1px solid var(--line-dark);color:var(--on-dark-2);font-size:12px;padding:7px 13px;border-radius:999px;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease);}
.topbar-logout:hover{color:var(--negative-bright);border-color:rgba(224,145,127,.4);}

/* ---------- адміністрування ---------- */
.admin-panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--sh-2);}
.admin-panel h3{font-family:'Fraunces',serif;font-size:18px;color:var(--ink);margin:0 0 6px;font-weight:600;}
.admin-empty{color:var(--muted);font-size:13px;padding:20px 0;text-align:center;}
.admin-list{display:flex;flex-direction:column;gap:9px;margin-top:14px;}
.admin-req{display:flex;align-items:center;gap:14px;background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 15px;}
.admin-req-info{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.admin-req-name{font-weight:700;font-size:13.5px;color:var(--ink);}
.admin-req-time{font-size:10.5px;color:var(--muted);}
.admin-req-code{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;letter-spacing:.12em;color:var(--gold-ink);background:linear-gradient(180deg,var(--gold-bright),var(--gold));padding:6px 14px;border-radius:8px;}

/* ---------- навігація кабінету ---------- */
.cab-nav{display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--line-dark);}
.cab-nav button{background:none;border:none;border-bottom:2px solid transparent;padding:11px 15px;font-size:13px;font-weight:600;color:var(--on-dark-2);cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;margin-bottom:-1px;transition:color .15s var(--ease),border-color .15s var(--ease);}
.cab-nav button:hover{color:var(--on-dark);}
.cab-nav button.active{color:var(--gold-bright);border-bottom-color:var(--gold);}
.embedded{animation:fadeIn .28s ease both;}

/* ---------- детальний перегляд салону ---------- */
.detail-head{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.detail-title{font-family:'Fraunces',serif;font-size:17px;color:var(--on-dark);font-weight:600;}

/* ---------- список салонів ---------- */
.salon-list{display:flex;flex-direction:column;gap:9px;}
.salon-row{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:13px 15px;cursor:pointer;text-align:left;box-shadow:var(--sh-1);transition:border-color .15s var(--ease),transform .15s var(--ease);}
.salon-row:hover{border-color:var(--gold);transform:translateY(-1px);}
.salon-row-main{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.salon-row-name{font-size:13.5px;font-weight:600;color:var(--ink);}
.salon-row-sub{font-size:10.5px;color:var(--muted);}
.salon-row-total{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);white-space:nowrap;}

/* ---------- зведення ---------- */
.consol-table{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:8px 16px 14px;box-shadow:var(--sh-2);}
.consol-row{display:grid;grid-template-columns:1fr auto auto auto auto;gap:10px;align-items:center;padding:11px 4px;border-bottom:1px dashed var(--line-strong);font-size:12.5px;}
.consol-name{display:flex;flex-direction:column;gap:2px;font-weight:600;color:var(--ink);min-width:0;}
.consol-role{font-weight:500;font-size:10.5px;color:var(--muted);}
.consol-total{font-family:'IBM Plex Mono',monospace;color:var(--ink);white-space:nowrap;}
.consol-actions{display:flex;gap:6px;justify-content:flex-end;}
.consol-total-row{border-bottom:none;border-top:2px solid var(--ink);margin-top:4px;font-weight:700;}
.consol-total-row .consol-total{font-size:15px;color:var(--gold);}
`;

const SESSION_KEY = "tmapp:session";
const loadRemembered = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
};
const storeRemembered = (cab) => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(cab)); } catch { /* ignore */ } };
const forgetRemembered = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };

export default function App() {
  // якщо був відмічений «Не виходити» — одразу відкриваємо збережений кабінет
  const [session, setSession] = useState(() => loadRemembered());
  const [remembered, setRemembered] = useState(() => loadRemembered());
  const [pending, setPending] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { ensureCredentialsSeeded().then(() => setReady(true)); }, []);

  const enter = (cab, remember) => {
    setSession(cab);
    setPending(null);
    if (remember) { storeRemembered(cab); setRemembered(cab); }
    else { forgetRemembered(); setRemembered(null); }
  };
  // «Назад» з кабінету — на головну, але збережений вхід НЕ скидається
  const goHome = () => setSession(null);
  // явний вихід — скидає збережений вхід
  const logout = () => { setSession(null); forgetRemembered(); setRemembered(null); };
  // вибір кабінету з головної: якщо цей кабінет уже запамʼятаний — заходимо без пароля
  const pick = (cab) => {
    if (remembered && remembered.key === cab.key && remembered.type === cab.type) setSession(cab);
    else setPending(cab);
  };

  return (
    <div className="app-root">
      <style>{CSS}</style>
      <LivingBackground />
      {!ready && <div className="loading" style={{ paddingTop: 120 }}>Завантаження…</div>}
      {ready && !session && !pending && (
        <HierarchyHome onPick={pick} remembered={remembered} onLogout={logout} />
      )}
      {ready && pending && !session && (
        <LoginGate
          title={pending.label}
          subtitle={SUBTITLE[pending.type]}
          cabKey={pending.key}
          onCancel={() => setPending(null)}
          onSuccess={(remember) => enter(pending, remember)}
          verify={(login, password) => verifyLogin(pending.key, login, password)}
        />
      )}
      {ready && session && (
        <CabinetRouter
          cabinet={session}
          onExit={goHome}
          onLogout={remembered && remembered.key === session.key ? logout : null}
        />
      )}
    </div>
  );
}
