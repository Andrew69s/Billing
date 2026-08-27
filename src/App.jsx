import React, { useState, useEffect, useMemo } from "react";
import _ from "lodash";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Camera, X, ChevronLeft, Check, AlertTriangle, TrendingUp, Users, ClipboardList, Pencil,
  Store, Calculator, LogIn, Wallet,
} from "lucide-react";
import {
  MANAGER, ACCOUNTANT, TMS, SALONS, salonLabel, salonByKey, salonsOfTm, tmByKey,
  ensureCredentialsSeeded, verifyLogin,
} from "./org.js";
import {
  calcSmAll, emptySmData, SM_FIELD_LABELS, SM_CATEGORIES, PLAN_BRACKETS,
  categoryOf, normDaysOff, MANAGER_COEFS,
} from "./smCalc.js";

/* =========================================================
   CONSTANTS & HELPERS
========================================================= */
const TM_LIST = TMS.map((t) => ({ key: t.key, name: t.name }));
const MANAGER_NAME = MANAGER.name;
const MONTH_NAMES = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const GRADE_MIN = { 1: 60000, 2: 50000, 3: 45000 };

const FIELD_LABELS = {
  "block1.salesPlanPercent": "1.1 % виконання плану продажів",
  "block1.lflPercent": "1.2 % LFL",
  "block1.smPlanPercent": "1.3 % СМ, що виконали план",
  "block2.callsPlan": "2.1 План додзвонів",
  "block2.callsFact": "2.1 Факт додзвонів",
  "block2.callsRevenue": "2.1 Оборот з дзвінків",
  "block2.callsCostNorm": "2.1 Норма вартості дзвінка",
  "block2.rentabilityPercent": "2.2 % рентабельності",
  "block2.pbiObligatory": "2.3 Виконано місячний план (PBI)",
  "block2.pbiTotalRevenue": "2.3 Загальний оборот",
  "block2.pbiRevenue": "2.3 Оборот PBI",
  "block3.staffPercent": "3.1 % укомплектованості штату",
  "block3.violationsCount": "3.2 Неприпустимі ситуації",
  "block3.scheduleViolationsCount": "3.3 Порушення графіку",
  "block3.smViolationsFound": "3.4 Порушень виявлено",
  "block3.smViolationsUnfixed": "3.4 Порушень не виправлено",
  "block3.merchViolationsCount": "3.5 Порушення мерчандайзингу",
  "block3.trainingScore": "3.6 Середній бал навчання",
  "ez.revenue": "ЕЗ Сума продажів",
  "ez.profitabilityPercent": "ЕЗ Рентабельність",
  "ez.och": "ЕЗ Витрати ОЧ",
  "ez.np": "ЕЗ Витрати НП",
  "ez.acquiring": "ЕЗ Еквайринг",
};

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
const fmt = (n) => Math.round(n || 0).toLocaleString("uk-UA") + " грн";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("uk-UA") : "—");
const selectOnFocus = (e) => e.target.select();

function emptyData() {
  return {
    block1: { salesPlanPercent: 0, lflPercent: 0, smPlanPercent: 0 },
    block2: {
      callsPlan: 0, callsFact: 0, callsRevenue: 0, callsCostNorm: 0,
      rentabilityPercent: 0,
      pbiObligatory: false, pbiTotalRevenue: 0, pbiRevenue: 0,
      stores: [],
    },
    block3: {
      staffPercent: 0,
      violationsCount: 0,
      scheduleViolationsCount: 0,
      smViolationsFound: 0, smViolationsUnfixed: 0,
      merchViolationsCount: 0,
      trainingScore: 0,
    },
    ez: { revenue: 0, profitabilityPercent: 0, och: 0, np: 0, acquiring: 0 },
    screenshots: {},
    submittedAt: null,
    status: "draft", // draft | submitted | corrected
    tmSnapshot: null,
    managerComment: "",
    correctionDiff: [],
    correctedAt: null,
    tmReplyComment: "",
    tmRepliedAt: null,
    paymentStatus: "none", // none | to_pay | paid
    paymentStatusAt: null,
  };
}

function buildDiff(snapshot, current) {
  if (!snapshot) return [];
  const diffs = [];
  for (const path of Object.keys(FIELD_LABELS)) {
    const oldV = _.get(snapshot, path);
    const newV = _.get(current, path);
    if (oldV !== newV) diffs.push({ label: FIELD_LABELS[path], oldV, newV });
  }
  const oldStores = JSON.stringify((snapshot.block2?.stores || []).map((s) => [s.name, s.profitPercent]));
  const newStores = JSON.stringify((current.block2?.stores || []).map((s) => [s.name, s.profitPercent]));
  if (oldStores !== newStores) diffs.push({ label: "2.4 Список магазинів / прибутковість", oldV: "змінено", newV: "змінено" });
  return diffs;
}

/* =========================================================
   CALCULATION ENGINE
========================================================= */
function rowOf(v, edges) { return v < edges[0] ? 0 : v < edges[1] ? 1 : v <= edges[2] ? 2 : 3; }

function calcBlock1(b1, grade) {
  const gi = grade - 1;
  const salesTable = [[15000,10000,5000],[20000,15000,10000],[25000,20000,15000],[30000,25000,20000]];
  const lflTable = [[4000,3000,2000],[10000,8000,6000],[20000,16000,12000],[25000,20000,15000]];
  const smTable = [[3000,2000,1000],[10000,8000,6000],[16000,14000,12000],[20000,18000,16000]];
  const sales = salesTable[rowOf(b1.salesPlanPercent, [90,100,110])][gi];
  const lfl = lflTable[rowOf(b1.lflPercent, [25,35,45])][gi];
  const sm = smTable[rowOf(b1.smPlanPercent, [50,75,100])][gi];
  return { sales, lfl, sm, subtotal: sales + lfl + sm };
}

function calcCalls(b2) {
  if (!b2.callsFact || b2.callsFact < b2.callsPlan || !b2.callsCostNorm) return 0;
  const avgCost = b2.callsRevenue / b2.callsFact;
  const ratio = (avgCost / b2.callsCostNorm) * 100;
  const pct = ratio < 90 ? 0.5 : ratio <= 110 ? 1 : 1.5;
  return b2.callsRevenue * (pct / 100);
}
function calcRentability(pct) { return pct < 25 ? 0 : pct <= 27 ? 5000 : 10000; }
function calcPbi(b2) {
  if (!b2.pbiObligatory) return { percent: 0, bonus: 0 };
  const total = b2.pbiTotalRevenue || 0;
  const pbiRev = b2.pbiRevenue || 0;
  const percent = total > 0 ? (pbiRev / total) * 100 : 0;
  const bp = percent < 15 ? 0.2 : percent <= 20 ? 0.5 : 0.7;
  return { percent, bonus: total * (bp / 100) };
}
function calcStores(stores) {
  return (stores || []).reduce((sum, s) => {
    const p = s.profitPercent;
    const v = p < 0 ? -2000 : p <= 5 ? 0 : p <= 10 ? 2000 : 5000;
    return sum + v;
  }, 0);
}
function calcBlock2(b2) {
  const calls = calcCalls(b2);
  const rentability = calcRentability(b2.rentabilityPercent);
  const pbiCalc = calcPbi(b2);
  const stores = calcStores(b2.stores);
  return { calls, rentability, pbi: pbiCalc.bonus, pbiPercent: pbiCalc.percent, stores, subtotal: calls + rentability + pbiCalc.bonus + stores };
}

function calcStaff(pct) { return pct < 75 ? 0 : pct <= 90 ? 2000 : pct <= 99 ? 4000 : 8000; }
function calcCapped1000(count) { return clamp(1000 - 200 * (count || 0), -1000, 1000); }
function calcSmState(smCount, found, unfixed) { return 500 * smCount - 100 * (found || 0) - 200 * (unfixed || 0); }
function calcTraining(score) {
  if (score < 90) return -1000;
  if (score < 95) return 0;
  if (score < 98) return 1000;
  return 2000;
}
function calcBlock3(b3, smCount) {
  const staff = calcStaff(b3.staffPercent);
  const violations = calcCapped1000(b3.violationsCount);
  const schedule = calcCapped1000(b3.scheduleViolationsCount);
  const smState = calcSmState(smCount, b3.smViolationsFound, b3.smViolationsUnfixed);
  const merch = calcCapped1000(b3.merchViolationsCount);
  const training = calcTraining(b3.trainingScore);
  const rawSubtotal = staff + violations + schedule + smState + merch + training;
  return { staff, violations, schedule, smState, merch, training, rawSubtotal, subtotal: Math.min(rawSubtotal, 15000) };
}

function calcEz(ez) {
  const netProfit = (ez.revenue || 0) * ((ez.profitabilityPercent || 0) / 100);
  const ezValue = netProfit - (ez.och || 0) - (ez.np || 0) - (ez.acquiring || 0);
  return { netProfit, ezValue, bonus: ezValue * 0.10 };
}

function calcAll(data, grade) {
  const smCount = data.block2.stores.length;
  const b1 = calcBlock1(data.block1, grade);
  const b2 = calcBlock2(data.block2);
  const b3 = calcBlock3(data.block3, smCount);
  const ez = calcEz(data.ez);
  const beforeFloor = b1.subtotal + b2.subtotal + b3.subtotal + ez.bonus;
  const min = GRADE_MIN[grade] || GRADE_MIN[2];
  const floored = Math.max(beforeFloor, min);
  return { b1, b2, b3, ez, beforeFloor, floored, floorApplied: beforeFloor < min, min };
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
function ScreenshotSlot({ value, onUpload, onRemove, onPreview, readOnly }) {
  const inputRef = React.useRef(null);
  if (readOnly) {
    return value ? (
      <div className="shot-slot"><div className="shot-thumb" onClick={() => onPreview(value)}><img src={value} alt="скрін" /></div></div>
    ) : <div className="shot-slot"><div className="shot-empty">немає скріна</div></div>;
  }
  return (
    <div className="shot-slot">
      {value ? (
        <div className="shot-thumb" onClick={() => onPreview(value)}>
          <img src={value} alt="скрін" />
          <button className="shot-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }}><X size={12} /></button>
        </div>
      ) : (
        <button className="shot-add" onClick={() => inputRef.current?.click()}>
          <Camera size={14} /><span>скрін</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(await resizeImage(file));
          e.target.value = "";
        }} />
    </div>
  );
}
function Item({ num, title, amount, children, screenshotKey, screenshots, onUpload, onRemove, onPreview, readOnly }) {
  return (
    <div className="item">
      <div className="item-head">
        <span className="item-num">{num}</span>
        <span className="item-title">{title}</span>
        {amount !== undefined && (
          <span className={`item-amount ${amount < 0 ? "neg" : amount > 0 ? "pos" : ""}`}>{fmt(amount)}</span>
        )}
      </div>
      <div className="item-body">
        <div className="item-fields">{children}</div>
        <ScreenshotSlot
          value={screenshots?.[screenshotKey]}
          onUpload={(url) => onUpload && onUpload(screenshotKey, url)}
          onRemove={() => onRemove && onRemove(screenshotKey)}
          onPreview={onPreview}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
function BlockHeader({ n, title }) {
  return (
    <div className="block-header">
      <span className="block-header-n">Блок {n}</span>
      <span className="block-header-title">{title}</span>
    </div>
  );
}
function StoresEditor({ stores, update, readOnly }) {
  if (readOnly) {
    return (
      <div className="stores-editor field-full">
        {stores.length === 0 && <div className="hint">Магазини не додані</div>}
        {stores.map((s) => (<div className="store-row-view" key={s.id}>{s.name || "Магазин"} — {s.profitPercent}%</div>))}
      </div>
    );
  }
  const setStores = (next) => update(["block2", "stores"], next);
  return (
    <div className="stores-editor field-full">
      {stores.map((s, i) => (
        <div className="store-row" key={s.id}>
          <input className="store-name" placeholder={`Магазин ${i + 1}`} value={s.name}
            onChange={(e) => setStores(stores.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input className="store-pct" type="number" value={s.profitPercent} onFocus={selectOnFocus}
            onChange={(e) => setStores(stores.map((x, j) => (j === i ? { ...x, profitPercent: Number(e.target.value) } : x)))} />
          <span className="store-pct-suffix">%</span>
          <button className="store-remove" onClick={() => setStores(stores.filter((_x, j) => j !== i))}><X size={12} /></button>
        </div>
      ))}
      <button className="store-add" onClick={() => setStores([...stores, { id: Date.now() + Math.random(), name: "", profitPercent: 0 }])}>
        + Додати магазин
      </button>
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
function TopBar({ title, onBack }) {
  return (
    <div className="topbar">
      <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> Назад</button>
      <span className="topbar-title">{title}</span>
    </div>
  );
}

/* =========================================================
   CRITERIA FORM (shared by TM and Manager views)
========================================================= */
function CriteriaForm({ data, update, grade, showAmounts, onUpload, onRemove, onPreview, readOnly }) {
  const smCount = data.block2.stores.length;
  const b1 = showAmounts ? calcBlock1(data.block1, grade) : {};
  const callsAmt = showAmounts ? calcCalls(data.block2) : undefined;
  const rentAmt = showAmounts ? calcRentability(data.block2.rentabilityPercent) : undefined;
  const pbiCalcResult = showAmounts ? calcPbi(data.block2) : { percent: 0, bonus: 0 };
  const pbiAmt = showAmounts ? pbiCalcResult.bonus : undefined;
  const storesAmt = showAmounts ? calcStores(data.block2.stores) : undefined;
  const staffAmt = showAmounts ? calcStaff(data.block3.staffPercent) : undefined;
  const violAmt = showAmounts ? calcCapped1000(data.block3.violationsCount) : undefined;
  const schedAmt = showAmounts ? calcCapped1000(data.block3.scheduleViolationsCount) : undefined;
  const smStateAmt = showAmounts ? calcSmState(smCount, data.block3.smViolationsFound, data.block3.smViolationsUnfixed) : undefined;
  const merchAmt = showAmounts ? calcCapped1000(data.block3.merchViolationsCount) : undefined;
  const trainAmt = showAmounts ? calcTraining(data.block3.trainingScore) : undefined;
  const ez = showAmounts ? calcEz(data.ez) : {};

  const shotProps = { screenshots: data.screenshots, onUpload, onRemove, onPreview, readOnly };

  return (
    <div className="criteria-form">
      <BlockHeader n="1" title="Фінансовий блок" />
      <Item num="1.1" title="Виконання плану продажів" amount={b1.sales} screenshotKey="sales" {...shotProps}>
        <Field readOnly={readOnly} label="% виконання плану" value={data.block1.salesPlanPercent} onChange={(v) => update(["block1", "salesPlanPercent"], v)} suffix="%" />
      </Item>
      <Item num="1.2" title="Зростання продажів (LFL)" amount={b1.lfl} screenshotKey="lfl" {...shotProps}>
        <Field readOnly={readOnly} label="% LFL" value={data.block1.lflPercent} onChange={(v) => update(["block1", "lflPercent"], v)} suffix="%" />
      </Item>
      <Item num="1.3" title="% СМ, що виконали план на 100+%" amount={b1.sm} screenshotKey="smPlan" {...shotProps}>
        <Field readOnly={readOnly} label="% магазинів" value={data.block1.smPlanPercent} onChange={(v) => update(["block1", "smPlanPercent"], v)} suffix="%" />
      </Item>

      <BlockHeader n="2" title="Фокусні задачі" />
      <Item num="2.1" title="Дзвінки" amount={callsAmt} screenshotKey="calls" {...shotProps}>
        <Field readOnly={readOnly} label="План додзвонів" value={data.block2.callsPlan} onChange={(v) => update(["block2", "callsPlan"], v)} />
        <Field readOnly={readOnly} label="Факт додзвонів" value={data.block2.callsFact} onChange={(v) => update(["block2", "callsFact"], v)} />
        <Field readOnly={readOnly} label="Оборот з дзвінків" value={data.block2.callsRevenue} onChange={(v) => update(["block2", "callsRevenue"], v)} suffix="грн" />
        <Field readOnly={readOnly} label="Норма вартості дзвінка" value={data.block2.callsCostNorm} onChange={(v) => update(["block2", "callsCostNorm"], v)} suffix="грн" />
      </Item>
      <Item num="2.2" title="Рентабельність" amount={rentAmt} screenshotKey="rentability" {...shotProps}>
        <Field readOnly={readOnly} label="% рентабельності" value={data.block2.rentabilityPercent} onChange={(v) => update(["block2", "rentabilityPercent"], v)} suffix="%" />
      </Item>
      <Item num="2.3" title="Продажі PBI" amount={pbiAmt} screenshotKey="pbi" {...shotProps}>
        <CheckField readOnly={readOnly} label="Виконано місячний план" checked={data.block2.pbiObligatory} onChange={(v) => update(["block2", "pbiObligatory"], v)} />
        <Field readOnly={readOnly} label="Загальний оборот" value={data.block2.pbiTotalRevenue} onChange={(v) => update(["block2", "pbiTotalRevenue"], v)} suffix="грн" />
        <Field readOnly={readOnly} label="Оборот PBI" value={data.block2.pbiRevenue} onChange={(v) => update(["block2", "pbiRevenue"], v)} suffix="грн" />
        {showAmounts && <div className="ez-sub"><span>% PBI від обороту: {pbiCalcResult.percent.toFixed(1)}%</span></div>}
      </Item>
      <Item num="2.4" title="Прибутковість магазинів" amount={storesAmt} screenshotKey="stores" {...shotProps}>
        <StoresEditor readOnly={readOnly} stores={data.block2.stores} update={update} />
      </Item>

      <BlockHeader n="3" title="Стандарти" />
      <Item num="3.1" title="Укомплектованість штату" amount={staffAmt} screenshotKey="staff" {...shotProps}>
        <Field readOnly={readOnly} label="% укомплектованості" value={data.block3.staffPercent} onChange={(v) => update(["block3", "staffPercent"], v)} suffix="%" />
      </Item>
      <Item num="3.2" title="Неприпустимі ситуації" amount={violAmt} screenshotKey="violations" {...shotProps}>
        <Field readOnly={readOnly} label="Кількість підтверджених" value={data.block3.violationsCount} onChange={(v) => update(["block3", "violationsCount"], v)} />
      </Item>
      <Item num="3.3" title="Дотримання графіків роботи" amount={schedAmt} screenshotKey="schedule" {...shotProps}>
        <Field readOnly={readOnly} label="Кількість порушень" value={data.block3.scheduleViolationsCount} onChange={(v) => update(["block3", "scheduleViolationsCount"], v)} />
      </Item>
      <Item num="3.4" title="Стандарти внутрішнього стану СМ" amount={smStateAmt} screenshotKey="smState" {...shotProps}>
        <Field readOnly={readOnly} label="Порушень виявлено" value={data.block3.smViolationsFound} onChange={(v) => update(["block3", "smViolationsFound"], v)} />
        <Field readOnly={readOnly} label="Порушень не виправлено" value={data.block3.smViolationsUnfixed} onChange={(v) => update(["block3", "smViolationsUnfixed"], v)} />
        <div className="hint">Магазинів на території: {smCount} (за списком у п. 2.4)</div>
      </Item>
      <Item num="3.5" title="Стандарт мерчандайзингу" amount={merchAmt} screenshotKey="merch" {...shotProps}>
        <Field readOnly={readOnly} label="Кількість порушень" value={data.block3.merchViolationsCount} onChange={(v) => update(["block3", "merchViolationsCount"], v)} />
      </Item>
      <Item num="3.6" title="Проходження навчання (АКО)" amount={trainAmt} screenshotKey="training" {...shotProps}>
        <Field readOnly={readOnly} label="Середній бал, %" value={data.block3.trainingScore} onChange={(v) => update(["block3", "trainingScore"], v)} suffix="%" />
      </Item>

      <BlockHeader n="ЕЗ" title="Фінальний розрахунок" />
      <Item num="2.5" title="Економічний ефект (ЕЗ)" amount={ez.bonus} screenshotKey="ez" {...shotProps}>
        <Field readOnly={readOnly} label="Сума продажів (оборот)" value={data.ez.revenue} onChange={(v) => update(["ez", "revenue"], v)} suffix="грн" />
        <Field readOnly={readOnly} label="Рентабельність" value={data.ez.profitabilityPercent} onChange={(v) => update(["ez", "profitabilityPercent"], v)} suffix="%" />
        <Field readOnly={readOnly} label="Витрати ОЧ (Оплата частинами)" value={data.ez.och} onChange={(v) => update(["ez", "och"], v)} suffix="грн" />
        <Field readOnly={readOnly} label="Витрати НП (Нова Пошта)" value={data.ez.np} onChange={(v) => update(["ez", "np"], v)} suffix="грн" />
        <Field readOnly={readOnly} label="Еквайринг" value={data.ez.acquiring} onChange={(v) => update(["ez", "acquiring"], v)} suffix="грн" />
        {showAmounts && (
          <div className="ez-sub">
            <span>Чистий прибуток: {fmt(ez.netProfit)}</span>
            <span>ЕЗ: {fmt(ez.ezValue)}</span>
          </div>
        )}
      </Item>
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

function SalarySummary({ data, grade, adj, qbonus, isLastMonthOfQuarter, expandedBlock, onToggle, editable, onAdjChange, onSaveAdj, savingAdj, onSetPaymentStatus, monthLbl }) {
  const calc = useMemo(() => calcAll(data, grade), [data, grade]);
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
      <SummaryBlock id="ez" title="ЕЗ (економічний ефект)" total={calc.ez.bonus} items={ezItems} expanded={expandedBlock === "ez"} onToggle={onToggle} />

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

  if (!data.managerComment && (!data.correctionDiff || data.correctionDiff.length === 0)) {
    return <div className="loading">Корективів від керівника ще немає.</div>;
  }

  const submit = async () => { setSaving(true); await onReply(reply); setSaving(false); };

  return (
    <div className="corrections-panel">
      <p className="hint">Внесено: {fmtDate(data.correctedAt)}</p>
      {data.managerComment && <div className="manager-comment">{data.managerComment}</div>}
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
  const onUpload = (key, url) => update(["screenshots", key], url);
  const onRemove = (key) => update(["screenshots", key], null);
  const toggleBlock = (id) => setExpandedBlock((prev) => (prev === id ? null : id));

  const submit = async () => {
    setSaving(true);
    const snapshot = _.cloneDeep({ block1: data.block1, block2: data.block2, block3: data.block3, ez: data.ez });
    const next = {
      ...data,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      tmSnapshot: snapshot,
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

  const day = new Date().getDate();
  const isCurrent = ym === nowYm();
  const showBanner = isCurrent && data.status === "draft";
  const hasCorrections = !!data.managerComment || (data.correctionDiff && data.correctionDiff.length > 0);

  const months = useMemo(() => {
    const arr = []; const d = new Date();
    for (let i = 0; i < 12; i++) { arr.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); d.setMonth(d.getMonth() - 1); }
    return arr;
  }, []);

  return (
    <div className={embedded ? "embedded" : "view"}>
      {!embedded && <TopBar title={`ТМ · ${tmName}`} onBack={onBack} />}
      <div className="month-picker">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
        {data.status === "submitted" && <span className="badge-ok"><Check size={13} /> На розгляді в керівника</span>}
        {data.status === "corrected" && <span className="badge-off">Керівник вніс корективи</span>}
      </div>
      {showBanner && (
        <div className={`banner ${day > 10 ? "banner-late" : "banner-warn"}`}>
          <AlertTriangle size={16} />
          {day > 10
            ? "Термін подачі (до 10 числа) минув — заповніть дані якнайшвидше. Подати можна й зараз."
            : `Заповніть дані та скріншоти до 10 числа (сьогодні ${day}-е)`}
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
          <CriteriaForm data={data} update={update} grade={grade} showAmounts onUpload={onUpload} onRemove={onRemove} onPreview={setPreview} readOnly={false} />
          <SalarySummary
            data={data} grade={grade} adj={adj} qbonus={qbonus} isLastMonthOfQuarter={isLastMonthOfQuarter}
            expandedBlock={expandedBlock} onToggle={toggleBlock} editable={false} monthLbl={monthLabel(ym)}
          />
          <div className="save-bar">
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Надсилання…" : "Подати на погодження"}
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
        const allMet = monthsData.every((d) => (d.block1.salesPlanPercent || 0) >= 100);
        const avgOver = monthsData.reduce((s, d) => s + Math.max(0, (d.block1.salesPlanPercent || 0) - 100), 0) / 3;
        const sumFloored = monthsData.reduce((s, d) => s + calcAll(d, grade).floored, 0);
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
  const [editMode, setEditMode] = useState(false);
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
    setEditMode(false);
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
          points.push({ month: m, total: Math.round(calcAll(d, g).floored) });
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

  const update = (path, value) => setData((prev) => _.set(_.cloneDeep(prev), path, value));
  const onUpload = (key, url) => update(["screenshots", key], url);
  const onRemove = (key) => update(["screenshots", key], null);
  const persistGrade = async (g) => { setGrade(g); await saveGrade(tmKey, qKey, g); };
  const toggleBlock = (id) => setExpandedBlock((prev) => (prev === id ? null : id));

  const saveAdjOnly = async () => { setSavingAdj(true); await saveAdj(tmKey, ym, adj); setSavingAdj(false); };
  const setPaymentStatus = async (status) => {
    const next = { ...data, paymentStatus: status, paymentStatusAt: new Date().toISOString() };
    setData(next);
    await saveData(tmKey, ym, next);
  };

  const startEdit = () => setEditMode(true);
  const cancelEdit = async () => {
    const d = await loadData(tmKey, ym);
    setData(d);
    setCorrectionComment("");
    setEditMode(false);
  };
  const saveCorrections = async () => {
    setSavingCorr(true);
    const diff = buildDiff(data.tmSnapshot, data);
    const next = { ...data, status: "corrected", correctedAt: new Date().toISOString(), managerComment: correctionComment, correctionDiff: diff };
    await saveData(tmKey, ym, next);
    setData(next);
    setEditMode(false);
    setCorrectionComment("");
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
                Статус: {data.status === "submitted" ? "подано на погодження" : data.status === "corrected" ? "внесено корективи" : "ТМ ще не подав дані за цей місяць"}
                {data.submittedAt && ` · подано ${fmtDate(data.submittedAt)}`}
              </div>
              {data.tmReplyComment && (
                <div className="reply-banner"><b>Коментар ТМ:</b> {data.tmReplyComment}</div>
              )}

              {!editMode ? (
                <div className="edit-toggle-bar">
                  <button className="btn-secondary" onClick={startEdit}><Pencil size={14} /> Внести корективи</button>
                </div>
              ) : (
                <div className="correction-bar">
                  <label className="over-field" style={{ maxWidth: "100%" }}>
                    Коментар до корективи (побачить ТМ)
                    <textarea rows={2} value={correctionComment} onChange={(e) => setCorrectionComment(e.target.value)} />
                  </label>
                  <div className="correction-actions">
                    <button className="btn-secondary" onClick={cancelEdit}>Скасувати</button>
                    <button className="btn-primary" onClick={saveCorrections} disabled={savingCorr}>
                      {savingCorr ? "Збереження…" : "Зберегти корективи"}
                    </button>
                  </div>
                </div>
              )}

              <CriteriaForm data={data} update={update} grade={grade} showAmounts onUpload={onUpload} onRemove={onRemove} onPreview={setPreview} readOnly={!editMode} />

              <SalarySummary
                data={data} grade={grade} adj={adj} qbonus={qbonus} isLastMonthOfQuarter={isLastMonthOfQuarter}
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
function CabinetCard({ icon, name, sub, tone, onClick }) {
  return (
    <button className={`cab-card ${tone || ""}`} onClick={onClick}>
      <span className="cab-card-icon">{icon}</span>
      <span className="cab-card-text">
        <span className="cab-card-name">{name}</span>
        <span className="cab-card-sub">{sub}</span>
      </span>
    </button>
  );
}

function HierarchyHome({ onPick }) {
  return (
    <div className="role-select">
      <div className="hierarchy-inner fade-in">
        <span className="role-eyebrow">Робочий простір</span>
        <h1>Мотивація команди</h1>
        <p>Оберіть кабінет — вхід за логіном і паролем</p>

        <div className="cab-top">
          <CabinetCard
            tone="cab-manager" icon={<Users size={20} />}
            name={MANAGER.name} sub="Керівник"
            onClick={() => onPick({ type: "manager", key: "manager", label: MANAGER.name })}
          />
          <CabinetCard
            tone="cab-acct" icon={<Wallet size={20} />}
            name={ACCOUNTANT.name} sub="Бухгалтер · зведення й виплати"
            onClick={() => onPick({ type: "accountant", key: "accountant", label: ACCOUNTANT.name })}
          />
        </div>

        {TMS.map((tm) => (
          <div className="cab-branch" key={tm.key}>
            <CabinetCard
              tone="cab-tm" icon={<ClipboardList size={20} />}
              name={tm.name} sub={`Територіальний менеджер · ${salonsOfTm(tm.key).length} салони`}
              onClick={() => onPick({ type: "tm", key: tm.key, label: tm.name })}
            />
            <div className="cab-children">
              {salonsOfTm(tm.key).map((s) => (
                <CabinetCard
                  key={s.key} tone="cab-sm" icon={<Store size={17} />}
                  name={salonLabel(s)} sub={`Салон майстерності · ${s.area}`}
                  onClick={() => onPick({ type: "sm", key: s.key, label: salonLabel(s) })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ВХІД (логін + пароль)
========================================================= */
function LoginGate({ title, subtitle, onCancel, onSuccess, verify }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!login || !password) return;
    setBusy(true);
    const ok = await verify(login, password);
    setBusy(false);
    if (ok) onSuccess();
    else { setError("Невірний логін або пароль"); setPassword(""); }
  };

  return (
    <div className="role-select">
      <div className="role-select-inner fade-in">
        <div className="pin-avatar"><LogIn size={22} /></div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
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
              id="lg-pass" type="password" inputMode="numeric" autoComplete="current-password" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </label>
        </div>
        <p className={`pin-error ${error ? "visible" : ""}`}>{error || " "}</p>
        <div className="pin-actions">
          <button className="btn-secondary" onClick={onCancel}>Назад</button>
          <button className="btn-primary" onClick={submit} disabled={!login || !password || busy}>
            {busy ? "Перевірка…" : "Увійти"}
          </button>
        </div>
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
function SmCriteriaForm({ data, update, calc, area, showAmounts, onUpload, onRemove, onPreview, readOnly, isQuarterEnd }) {
  const shot = { screenshots: data.screenshots, onUpload, onRemove, onPreview, readOnly };
  const catOptions = [
    { value: "", label: `Авто (${categoryOf(data.base.avg3To)})` },
    ...SM_CATEGORIES.map((c) => ({ value: c.key, label: `${c.key} · ${c.note}` })),
  ];
  const coefOptions = MANAGER_COEFS.map((c) => ({ value: c.value, label: c.label }));

  return (
    <div className="criteria-form">
      <BlockHeader n="1" title="Основна частина за виконання плану" />
      <Item num="1.1" title="Категорія та база" amount={showAmounts ? calc.baseAdjusted : undefined} screenshotKey="base" {...shot}>
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
      </Item>

      <BlockHeader n="2" title="Мотивація керуючого" />
      <Item num="2.1" title="Атестація співробітників ФМ" amount={showAmounts ? calc.mgr.attest : undefined} screenshotKey="attest" {...shot}>
        <CheckField readOnly={readOnly} label="Атестація всіма співробітниками ≥ 98%" checked={data.manager.attestationAll} onChange={(v) => update(["manager", "attestationAll"], v)} />
      </Item>
      <Item num="2.2" title="Підтримання стандартів ФМ" amount={showAmounts ? calc.mgr.standards : undefined} screenshotKey="standards" {...shot}>
        <CheckField readOnly={readOnly} label="Без зауважень (бонус 2 000)" checked={data.manager.noRemarks} onChange={(v) => update(["manager", "noRemarks"], v)} />
        <Field readOnly={readOnly} label="Виявлені зауваження (−200)" value={data.manager.remarksFound} onChange={(v) => update(["manager", "remarksFound"], v)} />
        <Field readOnly={readOnly} label="Невиправлені зауваження (−400)" value={data.manager.remarksUnfixed} onChange={(v) => update(["manager", "remarksUnfixed"], v)} />
        <div className="hint">Штраф до −2 000 грн. Виявлене та виправлене зауваження не сумуються.</div>
      </Item>
      <Item num="2.3" title="Коефіцієнт керуючого" amount={showAmounts ? calc.mgr.coefBonus : undefined} screenshotKey="coef" {...shot}>
        <SelectField readOnly={readOnly} label="Статус" value={data.manager.coef} onChange={(v) => update(["manager", "coef"], Number(v))} options={coefOptions} />
        <div className="hint">Додатковий бонус = ставка за категорією ({fmt(calc.baseRaw)}) × (коеф − 1). Умова переходу на «Керуючий»: 2 з 3 планів по СМ.</div>
      </Item>

      <BlockHeader n="3" title="Бонусна частина" />
      <Item num="3.1" title="Обіг з дзвінків" amount={showAmounts ? calc.bonus.calls : undefined} screenshotKey="calls" {...shot}>
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
      </Item>
      <Item num="3.2" title="Заміна на іншому магазині" amount={showAmounts ? calc.bonus.replacement : undefined} screenshotKey="replace" {...shot}>
        <Field readOnly={readOnly} label="Днів заміни" value={data.bonus.replacementDays} onChange={(v) => update(["bonus", "replacementDays"], v)} />
        {showAmounts && <div className="hint">Денна ставка на своєму магазині: {fmt(calc.dailyRate)} · +20% за день заміни</div>}
      </Item>
      <Item num="3.3" title="Середній чек" amount={showAmounts ? calc.bonus.avgCheck : undefined} screenshotKey="sc" {...shot}>
        <Field readOnly={readOnly} label="Факт. середній чек" suffix="грн" value={data.bonus.avgCheckFact} onChange={(v) => update(["bonus", "avgCheckFact"], v)} />
        <Field readOnly={readOnly} label="Поріг 1 → 700 грн" value={data.bonus.scN1} onChange={(v) => update(["bonus", "scN1"], v)} />
        <Field readOnly={readOnly} label="Поріг 2 → 1 500 грн" value={data.bonus.scN2} onChange={(v) => update(["bonus", "scN2"], v)} />
        <Field readOnly={readOnly} label="Поріг 3 → 2 000 грн" value={data.bonus.scN3} onChange={(v) => update(["bonus", "scN3"], v)} />
        <div className="hint">Мінімальний середній чек на місяць надає ТМ.</div>
      </Item>
      <Item num="3.4" title="Довжина чека" amount={showAmounts ? calc.bonus.checkLen : undefined} screenshotKey="cl" {...shot}>
        <Field readOnly={readOnly} label="Факт. довжина чека" value={data.bonus.checkLenFact} onChange={(v) => update(["bonus", "checkLenFact"], v)} />
        <Field readOnly={readOnly} label="Поріг 1 → 700 грн" value={data.bonus.clN1} onChange={(v) => update(["bonus", "clN1"], v)} />
        <Field readOnly={readOnly} label="Поріг 2 → 1 500 грн" value={data.bonus.clN2} onChange={(v) => update(["bonus", "clN2"], v)} />
        <Field readOnly={readOnly} label="Поріг 3 → 2 000 грн" value={data.bonus.clN3} onChange={(v) => update(["bonus", "clN3"], v)} />
        <div className="hint">Мінімальну довжину чека на місяць надає ТМ.</div>
      </Item>
      <Item num="3.5" title="Атестація (курси)" amount={showAmounts ? calc.bonus.courses : undefined} screenshotKey="courses" {...shot}>
        <CheckField readOnly={readOnly} label="≥ 98% середньо-місячних курсів, без перепризначення" checked={data.bonus.coursesOk} onChange={(v) => update(["bonus", "coursesOk"], v)} />
      </Item>
      <Item num="3.6" title="Продажі із сайту через НП" amount={showAmounts ? calc.bonus.siteNp : undefined} screenshotKey="np" {...shot}>
        <Field readOnly={readOnly} label="Оборот продажів через НП" suffix="грн" value={data.bonus.siteNpRevenue} onChange={(v) => update(["bonus", "siteNpRevenue"], v)} />
        <div className="hint">4% на команду</div>
      </Item>
      <Item num="3.7" title="Продаж по БН" amount={showAmounts ? calc.bonus.bn : undefined} screenshotKey="bn" {...shot}>
        <Field readOnly={readOnly} label="Оборот по БН" suffix="грн" value={data.bonus.bnRevenue} onChange={(v) => update(["bonus", "bnRevenue"], v)} />
        <div className="hint">4% на команду</div>
      </Item>

      <BlockHeader n="4" title="Додаткова мотивація за продаж PPI" />
      <Item num="4.1" title="Продаж PPI" amount={showAmounts ? calc.ppi.bonus : undefined} screenshotKey="ppi" {...shot}>
        <Field readOnly={readOnly} label="Оборот по категорії PPI" suffix="грн" value={data.ppi.ppiRevenue} onChange={(v) => update(["ppi", "ppiRevenue"], v)} />
        <CheckField readOnly={readOnly} label="План PPI закрито" checked={data.ppi.planClosed} onChange={(v) => update(["ppi", "planClosed"], v)} />
        {showAmounts && <div className="hint">{calc.ppi.pct}% від обороту PPI ({data.ppi.planClosed ? "план закрито" : "план не закрито"})</div>}
      </Item>

      <BlockHeader n="5" title="Рекорд та квартальна премія" />
      <Item num="5.1" title="Бонус за рекордні показники" amount={showAmounts ? calc.record.bonus : undefined} screenshotKey="record" {...shot}>
        <Field readOnly={readOnly} label="Оборот ТО за місяць (команда)" suffix="грн" value={data.record.monthlyTo} onChange={(v) => update(["record", "monthlyTo"], v)} />
        <Field readOnly={readOnly} label="Попередній рекорд ТО" suffix="грн" value={data.record.prevRecord} onChange={(v) => update(["record", "prevRecord"], v)} />
        {showAmounts && (
          <div className="hint">
            Поточний поріг рекорду: {fmt(calc.record.threshold)} (мін. 1 млн, крок +10%). Бонус — 1% від ТО.
            {calc.record.beaten ? " Рекорд перебито ✔" : ""}
          </div>
        )}
      </Item>
      {isQuarterEnd && (
        <Item num="5.2" title="Квартальна премія" amount={showAmounts ? calc.quarterly : undefined} screenshotKey="quarter" {...shot}>
          <CheckField readOnly={readOnly} label="3/3 місяці план по обороту закрито" checked={data.quarterly.threeOfThree} onChange={(v) => update(["quarterly", "threeOfThree"], v)} />
          <Field readOnly={readOnly} label="Сума 3 останніх ЗП" suffix="грн" value={data.quarterly.last3SalarySum} onChange={(v) => update(["quarterly", "last3SalarySum"], v)} />
          <div className="hint">Премія — 10% від суми трьох останніх заробітних плат.</div>
        </Item>
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
  const onUpload = (k, url) => update(["screenshots", k], url);
  const onRemove = (k) => update(["screenshots", k], null);
  const toggleBlock = (id) => setExpandedBlock((p) => (p === id ? null : id));

  const calc = useMemo(() => calcSmAll(data, { ym, area: salon.area }), [data, ym, salon.area]);

  const months = useMemo(() => {
    const arr = []; const d = new Date();
    for (let i = 0; i < 12; i++) { arr.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); d.setMonth(d.getMonth() - 1); }
    return arr;
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
            onUpload={onUpload} onRemove={onRemove} onPreview={setPreview} readOnly={false} isQuarterEnd={isQuarterEnd}
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
  const onUpload = (k, url) => update(["screenshots", k], url);
  const onRemove = (k) => update(["screenshots", k], null);
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
            onUpload={onUpload} onRemove={onRemove} onPreview={setPreview} readOnly={!editMode} isQuarterEnd={isQuarterEnd}
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
    const arr = []; const d = new Date();
    for (let i = 0; i < 12; i++) { arr.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); d.setMonth(d.getMonth() - 1); }
    return arr;
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
  const calc = calcAll(d, g);
  const total = calc.floored + (isLast ? (qb.bonus41 + qb.bonus42) : 0) + (a.amount || 0) - (a.advance || 0);
  return { data: d, total, status: d.status, paymentStatus: d.paymentStatus };
}

function ConsolidationPanel({ role }) {
  const [ym, setYm] = useState(nowYm());
  const [rows, setRows] = useState(null);
  const [reload, setReload] = useState(0);

  const months = useMemo(() => {
    const arr = []; const d = new Date();
    for (let i = 0; i < 12; i++) { arr.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); d.setMonth(d.getMonth() - 1); }
    return arr;
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
   КАБІНЕТИ (обгортки з навігацією)
========================================================= */
function TmCabinet({ tmKey, onExit }) {
  const tm = tmByKey(tmKey);
  const [tab, setTab] = useState("salary");
  return (
    <div className="view">
      <TopBar title={`ТМ · ${tm.name}`} onBack={onExit} />
      <div className="cab-nav">
        <button className={tab === "salary" ? "active" : ""} onClick={() => setTab("salary")}><Calculator size={14} /> Розрахунок ЗП</button>
        <button className={tab === "salons" ? "active" : ""} onClick={() => setTab("salons")}><Store size={14} /> ЗП салонів</button>
      </div>
      {tab === "salary" && <TmView tmKey={tmKey} tmName={tm.name} embedded />}
      {tab === "salons" && <SalonReviewPanel tmKey={tmKey} reviewer="tm" />}
    </div>
  );
}

function ManagerCabinet({ onExit }) {
  const [tab, setTab] = useState("byTm");
  return (
    <div className="view">
      <TopBar title={MANAGER.name} onBack={onExit} />
      <div className="cab-nav">
        <button className={tab === "byTm" ? "active" : ""} onClick={() => setTab("byTm")}><Users size={14} /> По ТМ</button>
        <button className={tab === "consol" ? "active" : ""} onClick={() => setTab("consol")}><Wallet size={14} /> Зведення ЗП</button>
      </div>
      {tab === "byTm" && <ManagerView embedded />}
      {tab === "consol" && <ConsolidationPanel role="manager" />}
    </div>
  );
}

function AccountantCabinet({ onExit }) {
  return (
    <div className="view">
      <TopBar title={ACCOUNTANT.name} onBack={onExit} />
      <div className="cab-nav"><button className="active"><Wallet size={14} /> Зведення ЗП</button></div>
      <ConsolidationPanel role="accountant" />
    </div>
  );
}

function SmCabinet({ salonKey, onExit }) {
  const salon = salonByKey(salonKey);
  return (
    <div className="view">
      <TopBar title={`Салон · ${salonLabel(salon)}`} onBack={onExit} />
      <div className="cab-nav"><button className="active"><Calculator size={14} /> Розрахунок ЗП</button></div>
      <SmView salon={salon} embedded />
    </div>
  );
}

function CabinetRouter({ cabinet, onExit }) {
  switch (cabinet.type) {
    case "manager": return <ManagerCabinet onExit={onExit} />;
    case "accountant": return <AccountantCabinet onExit={onExit} />;
    case "tm": return <TmCabinet tmKey={cabinet.key} onExit={onExit} />;
    case "sm": return <SmCabinet salonKey={cabinet.key} onExit={onExit} />;
    default: return null;
  }
}

const SUBTITLE = { manager: "Керівник", accountant: "Бухгалтер", tm: "Територіальний менеджер", sm: "Салон майстерності" };

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
.item-head{display:flex;align-items:center;gap:11px;margin-bottom:12px;}
.item-num{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;color:var(--muted);background:var(--surface-alt);padding:3px 7px;border-radius:6px;}
.item-title{font-weight:600;font-size:14px;flex:1;letter-spacing:-.005em;color:var(--ink);}
.item-amount{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--muted);padding:3px 9px;border-radius:999px;background:var(--surface-alt);white-space:nowrap;}
.item-amount.pos{color:var(--positive);background:rgba(60,107,73,.12);}
.item-amount.neg{color:var(--negative);background:rgba(160,58,42,.12);}
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

.shot-slot{flex-shrink:0;}
.shot-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;width:68px;height:68px;border:1.5px dashed var(--line-strong);border-radius:var(--radius-md);background:var(--surface-alt);color:var(--muted);cursor:pointer;font-size:10px;transition:all .15s var(--ease);}
.shot-add:hover{border-color:var(--gold);color:var(--gold);background:rgba(190,138,46,.06);}
.shot-empty{width:68px;height:68px;border:1.5px dashed var(--line);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--faint);text-align:center;padding:4px;}
.shot-thumb{position:relative;width:68px;height:68px;border-radius:var(--radius-md);overflow:hidden;cursor:pointer;border:1px solid var(--line);box-shadow:var(--sh-1);transition:transform .15s var(--ease);}
.shot-thumb:hover{transform:scale(1.03);}
.shot-thumb img{width:100%;height:100%;object-fit:cover;}
.shot-remove{position:absolute;top:3px;right:3px;background:rgba(0,0,0,.62);border:none;border-radius:50%;width:19px;height:19px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);}

.stores-editor{display:flex;flex-direction:column;gap:9px;}
.store-row{display:flex;align-items:center;gap:9px;}
.store-row-view{font-size:13px;padding:5px 0;color:var(--ink-soft);border-bottom:1px dashed var(--line);}
.store-name{flex:1;padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;font-size:13px;font-family:inherit;}
.store-pct{width:74px;padding:8px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;font-family:'IBM Plex Mono',monospace;font-size:13px;}
.store-pct-suffix{font-size:12px;color:var(--muted);}
.store-remove{background:none;border:none;color:var(--negative);cursor:pointer;display:flex;padding:4px;border-radius:6px;}
.store-remove:hover{background:rgba(160,58,42,.1);}
.store-add{align-self:flex-start;background:var(--surface-alt);border:1px dashed var(--line-strong);border-radius:var(--radius-sm);padding:8px 14px;font-size:12px;font-weight:500;color:var(--ink-soft);cursor:pointer;transition:all .15s var(--ease);}
.store-add:hover{border-color:var(--gold);color:var(--gold);}

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
.correction-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}

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
  .cab-top{grid-template-columns:1fr;}
  .cab-children{padding-left:12px;}
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

/* ---------- ієрархія кабінетів ---------- */
.hierarchy-inner{max-width:760px;width:100%;text-align:center;}
.hierarchy-inner .role-eyebrow{margin-bottom:14px;}
.hierarchy-inner h1{font-family:'Fraunces',serif;font-size:32px;line-height:1.1;color:var(--on-dark);margin:0 0 8px;font-weight:600;letter-spacing:-.015em;}
.hierarchy-inner>p{color:var(--on-dark-2);margin:0 0 26px;font-size:13.5px;}
.cab-top{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.cab-branch{margin-top:14px;padding-top:14px;border-top:1px solid var(--line-dark);}
.cab-children{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:9px;margin-top:9px;padding-left:22px;position:relative;}
.cab-children::before{content:"";position:absolute;left:9px;top:-6px;bottom:14px;width:1px;background:var(--line-dark);}
.cab-card{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid transparent;border-radius:var(--radius-md);padding:13px 15px;cursor:pointer;color:var(--ink);text-align:left;box-shadow:var(--sh-2);transition:transform .16s var(--ease),box-shadow .16s var(--ease),border-color .16s var(--ease);}
.cab-card:hover{transform:translateY(-2px);box-shadow:var(--sh-3);border-color:var(--gold);}
.cab-card:active{transform:translateY(0);}
.cab-card-icon{flex-shrink:0;width:38px;height:38px;border-radius:10px;background:linear-gradient(180deg,var(--surface-alt),var(--surface-sink));display:flex;align-items:center;justify-content:center;color:var(--gold);box-shadow:inset 0 0 0 1px rgba(0,0,0,.04);}
.cab-card-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.cab-card-name{font-size:13.5px;font-weight:700;letter-spacing:-.01em;line-height:1.3;}
.cab-card-sub{font-size:10.5px;color:var(--muted);letter-spacing:.01em;}
.cab-manager{background:linear-gradient(180deg,#FFFDF6,var(--surface-alt));}
.cab-manager .cab-card-icon,.cab-acct .cab-card-icon{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);}
.cab-tm{background:linear-gradient(180deg,#FFFDF6,var(--surface-alt));}

/* ---------- вхід ---------- */
.login-fields{display:flex;flex-direction:column;gap:12px;margin:4px 0 2px;text-align:left;}
.login-field{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--on-dark-2);}
.login-field input{padding:11px 13px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface);color:var(--ink);font-family:'IBM Plex Mono',monospace;font-size:14px;}
.login-field input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.2);}

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

export default function App() {
  const [session, setSession] = useState(null);
  const [pending, setPending] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { ensureCredentialsSeeded().then(() => setReady(true)); }, []);

  return (
    <div className="app-root">
      <style>{CSS}</style>
      <LivingBackground />
      {!ready && <div className="loading" style={{ paddingTop: 120 }}>Завантаження…</div>}
      {ready && !session && !pending && <HierarchyHome onPick={setPending} />}
      {ready && pending && !session && (
        <LoginGate
          title={pending.label}
          subtitle={SUBTITLE[pending.type]}
          onCancel={() => setPending(null)}
          onSuccess={() => { setSession(pending); setPending(null); }}
          verify={(login, password) => verifyLogin(pending.key, login, password)}
        />
      )}
      {ready && session && <CabinetRouter cabinet={session} onExit={() => setSession(null)} />}
    </div>
  );
}
