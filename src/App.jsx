import React, { useState, useEffect, useMemo } from "react";
import _ from "lodash";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Camera, X, ChevronLeft, Check, AlertTriangle, TrendingUp, Users, ClipboardList, Pencil,
} from "lucide-react";

/* =========================================================
   CONSTANTS & HELPERS
========================================================= */
const TM_LIST = [
  { key: "andriy", name: "Шах Андрій" },
  { key: "ivan", name: "Паньків Іван" },
];
const MANAGER_NAME = "Кавецький Віктор Васильович";
const MONTH_NAMES = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const GRADE_MIN = { 1: 60000, 2: 50000, 3: 45000 };
const PIN_DEFAULTS = { andriy: "5417", ivan: "8206", manager: "4739", recovery: "9184" };

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
async function verifyPin(roleId, pin) {
  try { const r = await window.storage.get(`pin:${roleId}`, true); return r?.value === pin; }
  catch { return false; }
}
async function changePin(roleId, recoveryCode, newPin) {
  try {
    const rec = await window.storage.get(`pin:recovery`, true);
    if (rec?.value !== recoveryCode) return false;
    await window.storage.set(`pin:${roleId}`, newPin, true);
    return true;
  } catch { return false; }
}
async function ensurePinsSeeded() {
  for (const key of Object.keys(PIN_DEFAULTS)) {
    try { await window.storage.get(`pin:${key}`, true); }
    catch { try { await window.storage.set(`pin:${key}`, PIN_DEFAULTS[key], true); } catch (e) { console.error(e); } }
  }
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
function TmView({ tmKey, tmName, onBack }) {
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
    <div className="view">
      <TopBar title={`ТМ · ${tmName}`} onBack={onBack} />
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
function ManagerView({ onBack }) {
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
    <div className="view">
      <TopBar title={MANAGER_NAME} onBack={onBack} />
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
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D9D2BE" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
                <Line type="monotone" dataKey="andriy" name="Шах Андрій" stroke="#B8862B" strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="ivan" name="Паньків Іван" stroke="#3F6B4A" strokeWidth={2} connectNulls />
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
   PIN GATE
========================================================= */
function PinDigits({ value, onChange, autoFocus, shake, id }) {
  const refs = [React.useRef(null), React.useRef(null), React.useRef(null), React.useRef(null)];
  const digits = value.split("");
  while (digits.length < 4) digits.push("");

  useEffect(() => {
    if (autoFocus) refs[0].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAt = (i, ch) => {
    const next = digits.slice();
    next[i] = ch;
    onChange(next.join("").slice(0, 4));
  };

  return (
    <div className={`pin-digits ${shake ? "shake" : ""}`}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={refs[i]}
          className="pin-digit"
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digits[i]}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, ch);
            if (ch && i < 3) refs[i + 1].current?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) refs[i - 1].current?.focus();
          }}
          onFocus={selectOnFocus}
        />
      ))}
    </div>
  );
}

function PinGate({ label, onCancel, onSuccess, checkPin, resetPin }) {
  const [mode, setMode] = useState("enter");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submitPin = async (candidate) => {
    setBusy(true);
    const ok = await checkPin(candidate ?? pin);
    setBusy(false);
    if (ok) onSuccess();
    else {
      setError("Невірний код. Спробуйте ще раз");
      setPin("");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };
  const submitRecovery = async () => {
    setBusy(true);
    const ok = await resetPin(recoveryCode, newPin);
    setBusy(false);
    if (ok) { setMode("enter"); setPin(""); setRecoveryCode(""); setNewPin(""); setError("Код змінено — увійдіть новим кодом"); }
    else setError("Невірний код відновлення");
  };

  return (
    <div className="role-select">
      <div className="role-select-inner fade-in">
        <div className="pin-avatar">{label.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
        <h1>{label}</h1>
        {mode === "enter" ? (
          <>
            <p>Введіть 4-значний код доступу</p>
            <PinDigits
              value={pin}
              autoFocus
              shake={shake}
              onChange={(v) => { setPin(v); setError(""); if (v.length === 4) submitPin(v); }}
            />
            <p className={`pin-error ${error ? "visible" : ""}`}>{error || " "}</p>
            <div className="pin-actions">
              <button className="btn-secondary" onClick={onCancel}>Назад</button>
              <button className="btn-primary" onClick={() => submitPin()} disabled={pin.length !== 4 || busy}>{busy ? "Перевірка…" : "Увійти"}</button>
            </div>
            <button className="pin-forgot" onClick={() => { setMode("recover"); setError(""); setPin(""); }}>Забули код?</button>
          </>
        ) : (
          <>
            <p>Код відновлення</p>
            <PinDigits value={recoveryCode} autoFocus onChange={setRecoveryCode} />
            <p className="pin-sublabel">Новий код</p>
            <PinDigits value={newPin} onChange={setNewPin} />
            <p className={`pin-error ${error ? "visible" : ""}`}>{error || " "}</p>
            <div className="pin-actions">
              <button className="btn-secondary" onClick={() => { setMode("enter"); setError(""); }}>Назад</button>
              <button className="btn-primary" onClick={submitRecovery} disabled={recoveryCode.length !== 4 || newPin.length !== 4 || busy}>
                {busy ? "…" : "Змінити код"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   ROLE SELECT & ROOT APP
========================================================= */
function RoleSelect({ onSelect }) {
  return (
    <div className="role-select">
      <div className="role-select-inner fade-in">
        <span className="role-eyebrow">Облік мотивації</span>
        <h1>Мотивація ТМ</h1>
        <p>Оберіть, хто заходить у систему</p>
        <div className="role-cards">
          <button className="role-card role-card-manager" onClick={() => onSelect({ role: "manager" })}>
            <span className="role-card-icon"><Users size={20} /></span>
            <span className="role-card-text">
              <span className="role-card-name">{MANAGER_NAME}</span>
              <span className="role-card-sub">Керівник</span>
            </span>
          </button>
          <div className="role-card-group">
            {TM_LIST.map((t) => (
              <button key={t.key} className="role-card" onClick={() => onSelect({ role: "tm", tmKey: t.key })}>
                <span className="role-card-icon"><ClipboardList size={20} /></span>
                <span className="role-card-text">
                  <span className="role-card-name">{t.name}</span>
                  <span className="role-card-sub">Територіальний менеджер</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
:root {
  --bg:#1B2431; --surface:#F7F4EA; --surface-alt:#EFE9D8; --ink:#23201B; --muted:#786F5E;
  --gold:#B8862B; --positive:#3F6B4A; --negative:#A23E2E; --line:#DCD5C0;
}
.app-root{font-family:'Inter',sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;}
.app-root *{box-sizing:border-box;}
.role-select{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;}
.role-select-inner{max-width:460px;width:100%;text-align:center;}
.role-eyebrow{display:inline-block;font-family:'IBM Plex Mono';font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;}
.role-select-inner h1{font-family:'Fraunces',serif;font-size:30px;color:var(--surface);margin:0 0 8px;font-weight:600;letter-spacing:-.01em;}
.role-select-inner p{color:#C9C2AE;margin:0 0 28px;font-size:14px;}
.role-cards{display:flex;flex-direction:column;gap:10px;}
.role-card-group{display:flex;flex-direction:column;gap:10px;}
.role-card{width:100%;display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px;cursor:pointer;color:var(--ink);font-family:'Inter';text-align:left;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;}
.role-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.28);border-color:var(--gold);}
.role-card:active{transform:translateY(0);}
.role-card-icon{flex-shrink:0;width:38px;height:38px;border-radius:8px;background:var(--surface-alt);display:flex;align-items:center;justify-content:center;color:var(--gold);}
.role-card-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.role-card-name{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.role-card-sub{font-size:11px;color:var(--muted);}
.pin-avatar{width:52px;height:52px;border-radius:50%;background:var(--surface);color:var(--gold);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-family:'Fraunces',serif;font-size:18px;font-weight:600;border:1px solid var(--line);}
.pin-digits{display:flex;gap:10px;justify-content:center;margin-bottom:6px;}
.pin-digits.shake{animation:pinShake .4s ease;}
@keyframes pinShake{10%,90%{transform:translateX(-2px);}20%,80%{transform:translateX(4px);}30%,50%,70%{transform:translateX(-8px);}40%,60%{transform:translateX(8px);}}
.pin-digit{width:48px;height:56px;text-align:center;font-size:24px;font-family:'IBM Plex Mono';border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);transition:border-color .15s ease,box-shadow .15s ease;}
.pin-digit:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,134,43,.25);}
.pin-sublabel{color:#C9C2AE;font-size:12px;margin:14px 0 6px;}
.pin-error{color:#E08D7C;font-size:12px;margin:10px 0 12px;min-height:16px;opacity:0;transition:opacity .15s ease;}
.pin-error.visible{opacity:1;}
.pin-actions{display:flex;gap:10px;justify-content:center;margin-bottom:14px;}
.pin-forgot{background:none;border:none;color:#C9C2AE;font-size:12px;text-decoration:underline;cursor:pointer;padding:8px;}
.view{max-width:880px;margin:0 auto;padding:20px 20px 80px;}
.topbar{display:flex;align-items:center;gap:14px;padding:14px 0 18px;}
.topbar-back{background:none;border:none;color:#C9C2AE;display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;font-family:'Inter';}
.topbar-title{font-family:'Fraunces',serif;font-size:20px;color:var(--surface);font-weight:600;}
.month-picker,.month-row{display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap;}
.month-picker select,.month-row select{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 12px;font-family:'IBM Plex Mono';font-size:13px;color:var(--ink);}
.badge-ok,.badge{display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:4px 10px;border-radius:20px;background:rgba(63,107,74,.18);color:#7FBF8F;font-weight:600;}
.badge-off{background:rgba(162,62,46,.18);color:#E08D7C;}
.badge-warn{background:rgba(184,134,43,.18);color:#E3BA6D;}
.grade-picker{display:flex;align-items:center;gap:6px;color:#C9C2AE;font-size:13px;}
.grade-btn{width:28px;height:28px;border-radius:6px;border:1px solid var(--line);background:transparent;color:#C9C2AE;cursor:pointer;font-family:'IBM Plex Mono';}
.grade-btn.active{background:var(--gold);color:#1B2431;border-color:var(--gold);font-weight:700;}
.banner{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;margin-bottom:18px;font-size:13px;}
.banner-warn{background:rgba(184,134,43,.16);color:#E3BA6D;}
.banner-late{background:rgba(162,62,46,.2);color:#E08D7C;}
.loading{color:#C9C2AE;padding:40px 0;text-align:center;font-size:13px;}
.block-header{display:flex;align-items:baseline;gap:10px;margin:26px 0 10px;}
.block-header-n{font-family:'IBM Plex Mono';font-size:11px;color:var(--gold);letter-spacing:.06em;text-transform:uppercase;}
.block-header-title{font-family:'Fraunces',serif;font-size:19px;color:var(--surface);font-weight:600;}
.item{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:10px;}
.item-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.item-num{font-family:'IBM Plex Mono';font-size:12px;color:var(--muted);}
.item-title{font-weight:600;font-size:14px;flex:1;}
.item-amount{font-family:'IBM Plex Mono';font-size:14px;font-weight:600;color:var(--muted);}
.item-amount.pos{color:var(--positive);}
.item-amount.neg{color:var(--negative);}
.item-body{display:flex;align-items:flex-start;gap:14px;}
.item-fields{display:flex;flex-wrap:wrap;gap:10px 16px;flex:1;}
.field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);min-width:150px;}
.field-full{width:100%;}
.field-input-wrap{display:flex;align-items:center;border:1px solid var(--line);border-radius:6px;background:var(--surface-alt);padding:6px 10px;}
.field-input{border:none;background:none;font-family:'IBM Plex Mono';font-size:13px;color:var(--ink);width:100%;outline:none;}
.field-value{border:1px solid transparent;border-radius:6px;padding:6px 10px;font-family:'IBM Plex Mono';font-size:13px;color:var(--ink);background:rgba(0,0,0,.03);}
.field-suffix{font-size:11px;color:var(--muted);margin-left:6px;}
.check-field{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);}
.check-dot{width:10px;height:10px;border-radius:50%;background:var(--line);display:inline-block;}
.check-dot.on{background:var(--positive);}
.hint{font-size:11px;color:var(--muted);width:100%;}
.shot-slot{flex-shrink:0;}
.shot-add{display:flex;flex-direction:column;align-items:center;gap:4px;width:64px;height:64px;border:1px dashed var(--line);border-radius:8px;background:none;color:var(--muted);cursor:pointer;font-size:10px;}
.shot-empty{width:64px;height:64px;border:1px dashed var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--muted);text-align:center;padding:4px;}
.shot-thumb{position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;cursor:pointer;border:1px solid var(--line);}
.shot-thumb img{width:100%;height:100%;object-fit:cover;}
.shot-remove{position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);border:none;border-radius:50%;width:18px;height:18px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.stores-editor{display:flex;flex-direction:column;gap:8px;}
.store-row{display:flex;align-items:center;gap:8px;}
.store-row-view{font-size:13px;padding:4px 0;}
.store-name{flex:1;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface-alt);font-size:13px;}
.store-pct{width:70px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface-alt);font-family:'IBM Plex Mono';font-size:13px;}
.store-pct-suffix{font-size:12px;color:var(--muted);}
.store-remove{background:none;border:none;color:var(--negative);cursor:pointer;}
.store-add{align-self:flex-start;background:none;border:1px dashed var(--line);border-radius:6px;padding:6px 12px;font-size:12px;color:var(--muted);cursor:pointer;}
.ez-sub{display:flex;gap:18px;width:100%;font-family:'IBM Plex Mono';font-size:12px;color:var(--muted);border-top:1px dashed var(--line);padding-top:8px;margin-top:4px;}
.save-bar{display:flex;justify-content:flex-end;margin-top:20px;}
.btn-primary{background:var(--gold);color:#1B2431;border:none;border-radius:8px;padding:12px 22px;font-weight:700;font-size:13px;cursor:pointer;}
.btn-primary:disabled{opacity:.6;cursor:default;}
.btn-secondary{background:none;border:1px solid var(--line);color:var(--surface);border-radius:8px;padding:10px 18px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.btn-secondary.small{padding:6px 12px;font-size:12px;color:var(--ink);border-color:var(--line);}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:50;padding:24px;}
.modal-content{position:relative;max-width:90vw;max-height:90vh;}
.modal-content img{max-width:90vw;max-height:88vh;border-radius:8px;}
.modal-close{position:absolute;top:-14px;right:-14px;background:var(--surface);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;}
.tm-tabs{display:flex;gap:8px;margin-bottom:10px;}
.tm-tab{background:var(--surface-alt);border:1px solid var(--line);border-radius:8px 8px 0 0;padding:10px 18px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;}
.tm-tab.active{background:var(--surface);color:var(--ink);}
.inner-tabs{display:flex;gap:4px;margin-bottom:18px;background:rgba(255,255,255,.06);border-radius:8px;padding:4px;width:fit-content;}
.inner-tabs button{background:none;border:none;color:#C9C2AE;padding:7px 14px;border-radius:6px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;}
.inner-tabs button.active{background:var(--gold);color:#1B2431;font-weight:700;}
.status-line{font-size:12px;color:#C9C2AE;margin-bottom:10px;}
.reply-banner{background:rgba(184,134,43,.14);color:#E3BA6D;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;}
.edit-toggle-bar{display:flex;justify-content:flex-end;margin-bottom:14px;}
.correction-bar{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:14px;}
.correction-bar textarea{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-family:'Inter';font-size:13px;resize:vertical;}
.correction-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;}
.summary{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin-top:20px;}
.summary-row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px;border-bottom:1px dashed var(--line);font-family:'IBM Plex Mono';}
.summary-row.total{font-weight:700;border-bottom:1px solid var(--ink);}
.summary-row.floor-note{color:var(--gold);font-style:italic;}
.summary-row.grand{font-size:17px;font-weight:700;border:none;padding-top:14px;}
.summary-block{border-bottom:1px dashed var(--line);}
.summary-toggle{width:100%;background:none;border:none;cursor:pointer;text-align:left;border-bottom:none;}
.summary-toggle span{color:var(--ink);}
.chevron{color:var(--gold);font-size:11px;}
.summary-detail{padding:2px 0 10px 12px;display:flex;flex-direction:column;gap:4px;}
.summary-detail-row{display:flex;justify-content:space-between;font-size:12px;font-family:'IBM Plex Mono';color:var(--muted);}
.summary-detail-row .pos{color:var(--positive);}
.summary-detail-row .neg{color:var(--negative);}
.payment-row{display:flex;align-items:center;gap:10px;padding-top:14px;font-size:12px;color:var(--muted);flex-wrap:wrap;}
.adj-row{display:flex;align-items:center;gap:8px;padding:10px 0;font-size:12px;color:var(--muted);}
.adj-comment{flex:1;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface-alt);font-size:12px;}
.adj-amount{width:100px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface-alt);font-family:'IBM Plex Mono';font-size:13px;}
.chart-wrap{background:var(--surface);border-radius:10px;padding:20px;border:1px solid var(--line);}
.chart-note{font-size:11px;color:var(--muted);margin-top:8px;}
.quarter-panel{background:var(--surface);border-radius:10px;padding:20px;border:1px solid var(--line);}
.quarter-panel h3{font-family:'Fraunces',serif;margin:0 0 4px;}
.quarter-row{border-top:1px solid var(--line);padding:14px 0;}
.quarter-row-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600;}
.over-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);margin-bottom:8px;max-width:220px;}
.over-field input,.over-field textarea{padding:6px 10px;border:1px solid var(--line);border-radius:6px;font-family:'IBM Plex Mono';}
.quarter-preview{display:flex;gap:20px;font-size:12px;font-family:'IBM Plex Mono';color:var(--muted);}
.corrections-panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px 20px;}
.manager-comment{background:var(--surface-alt);border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:14px;}
.diff-list{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
.diff-row{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;font-size:12px;font-family:'IBM Plex Mono';border-bottom:1px dashed var(--line);padding:6px 0;}
.diff-label{font-family:'Inter';color:var(--muted);}
.diff-old{color:var(--negative);}
.diff-arrow{color:var(--muted);}
.diff-new{color:var(--positive);font-weight:600;}

/* motion, focus & polish */
@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
.fade-in{animation:fadeIn .35s ease both;}
.view{animation:fadeIn .3s ease both;}
.app-root *:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
.app-root button{transition:transform .12s ease,box-shadow .12s ease,background .15s ease,border-color .15s ease;}
.app-root button:active:not(:disabled){transform:scale(.97);}
.btn-primary:hover:not(:disabled){box-shadow:0 6px 16px rgba(184,134,43,.35);}
.btn-secondary:hover:not(:disabled){border-color:var(--gold);color:var(--gold);}
.item{transition:border-color .15s ease;}
.item:focus-within{border-color:var(--gold);}
.field-input:focus,.adj-comment:focus,.adj-amount:focus,.store-name:focus,.store-pct:focus,.correction-bar textarea:focus,.over-field input:focus,.over-field textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 2px rgba(184,134,43,.18);}
@keyframes detailIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}
.summary-detail{animation:detailIn .18s ease both;}
.summary-toggle{padding:9px 4px;border-radius:6px;}
.summary-toggle:hover{background:rgba(0,0,0,.03);}
@keyframes pulse{0%,100%{opacity:.55;}50%{opacity:1;}}
.loading{animation:pulse 1.4s ease-in-out infinite;}
.tm-tab,.inner-tabs button{min-height:38px;}
.grade-btn,.store-remove,.shot-remove{min-width:28px;}

/* responsive */
@media (max-width:640px){
  .view{padding:14px 12px 70px;}
  .topbar-title{font-size:17px;}
  .role-select-inner h1{font-size:25px;}
  .item-body{flex-direction:column;}
  .shot-slot{align-self:flex-start;}
  .item-fields{gap:10px;}
  .field{min-width:0;width:100%;}
  .tm-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .tm-tab{white-space:nowrap;}
  .inner-tabs{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .month-row,.month-picker{flex-direction:column;align-items:stretch;gap:10px;}
  .grade-picker{justify-content:space-between;}
  .diff-row{grid-template-columns:1fr;gap:2px;padding:8px 0;}
  .diff-old,.diff-new{font-size:11px;}
  .adj-row{flex-wrap:wrap;}
  .adj-comment{min-width:100%;order:1;}
  .payment-row{flex-direction:column;align-items:flex-start;}
  .quarter-preview{flex-direction:column;gap:4px;}
  .pin-digit{width:42px;height:50px;font-size:20px;}
  .btn-primary,.btn-secondary{min-height:44px;}
  .role-card{padding:14px;}
}
`;

export default function App() {
  const [session, setSession] = useState(null);
  const [pendingRole, setPendingRole] = useState(null);
  const [pinsReady, setPinsReady] = useState(false);

  useEffect(() => { ensurePinsSeeded().then(() => setPinsReady(true)); }, []);

  const roleId = (r) => (r.role === "manager" ? "manager" : r.tmKey);
  const roleLabel = (r) => (r.role === "manager" ? MANAGER_NAME : TM_LIST.find((t) => t.key === r.tmKey)?.name);

  return (
    <div className="app-root">
      <style>{CSS}</style>
      {!pinsReady && <div className="loading" style={{ paddingTop: 120 }}>Завантаження…</div>}
      {pinsReady && !session && !pendingRole && <RoleSelect onSelect={setPendingRole} />}
      {pinsReady && pendingRole && !session && (
        <PinGate
          label={roleLabel(pendingRole)}
          onCancel={() => setPendingRole(null)}
          onSuccess={() => { setSession(pendingRole); setPendingRole(null); }}
          checkPin={(pin) => verifyPin(roleId(pendingRole), pin)}
          resetPin={(rc, np) => changePin(roleId(pendingRole), rc, np)}
        />
      )}
      {session?.role === "manager" && <ManagerView onBack={() => setSession(null)} />}
      {session?.role === "tm" && (
        <TmView tmKey={session.tmKey} tmName={TM_LIST.find((t) => t.key === session.tmKey)?.name} onBack={() => setSession(null)} />
      )}
    </div>
  );
}
