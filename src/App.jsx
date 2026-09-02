import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import _ from "lodash";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Camera, X, ChevronLeft, Check, AlertTriangle, TrendingUp, Users, ClipboardList, Pencil,
  Store, Calculator, LogIn, Wallet, User, Clock,
  LayoutGrid, FileText, Calendar, Package, BarChart3, CreditCard, CheckSquare, ListChecks, GraduationCap,
  Bell, Star, Trash2, Plus, ChevronRight, Sparkles, Image as ImageIcon,
  Cake, UserPlus, UserMinus, Archive as ArchiveIcon, CalendarRange, ExternalLink, RefreshCw,
  Eye, EyeOff, GripVertical, SlidersHorizontal, Table,
  Wrench, MessageSquare, Send, Banknote, Menu,
  Warehouse, PackagePlus, TrendingDown, Minus,
} from "lucide-react";
import {
  MANAGER, ACCOUNTANT, OFFICE, TMS, SALONS, salonLabel, salonByKey, salonsOfTm, salonTmOn, tmByKey, cabName,
  verifyLogin, getLogin, currentCabinet, signOutCab, initAfterAuth,
  ADMIN_KEY, ADMIN_NAME, listRecoveryRequests, clearRecovery,
  masterLogin, confirmRecovery, adminSetPassword,
  listReassignments, addReassignment, removeReassignment,
  CAPABILITIES, getCapabilities, setCapabilities, listLog, ALL_CAB_KEYS,
  cabType, PARTICIPANTS, canAssign,
} from "./org.js";
import { emptySmData, SM_FIELD_LABELS } from "./smCalc.js";
import {
  calcTm, calcTmBatch, calcSm, calcSmBatch, useTmCalc, useSmCalc,
  subscribeCalcBusy, calcBusyNow,
} from "./lib/calc.js";
import {
  loadCalcRefs, tmCond, smCond, planBracketLabel, smCategoryOptions, managerCoefOptions,
} from "./lib/calcRefs.js";
import { TASK_STATUS, listTasks, createTasks, setTaskStatus, deleteTask, markSeen, subscribeTasks } from "./lib/tasks.js";
import {
  INVOICE_STATUS, INVOICE_FLOW, nextStatus, deriveVat,
  listInvoices, createInvoice, setInvoiceStatus, updateInvoice, deleteInvoice, subscribeInvoices, extractInvoice,
} from "./lib/invoices.js";
import {
  EMP_ROLES, EMP_ROLE_ORDER,
  listEmployees, createEmployee, updateEmployee, fireEmployee, rehireEmployee, transferEmployee, deleteEmployee, subscribeEmployees,
  birthdayIn, tenure,
} from "./lib/employees.js";
import {
  ABSENCE_REASONS, daysInMonth, dayKey, todayISO,
  listShifts, upsertShift, upsertShiftsBatch, deleteShift,
  getStoreDay, setStoreDay, listStoreDays, subscribeShifts, monthTally,
} from "./lib/shifts.js";
import {
  listNotifications, markRead, markAllRead, notify, subscribeNotifications,
} from "./lib/notifications.js";
import {
  TM_METRICS, SALON_MONTH_PLAN, daysInYm, dateOf,
  listMetrics, listPlans, planOf, effective, saveManual, resetManual, syncFromPlanner, subscribeMetrics, monthAgg, planAgg,
} from "./lib/territory.js";
import { getMaintenance, setMaintenance, subscribeFlags } from "./lib/appFlags.js";
import { submitFeedback, listFeedback, setFeedbackStatus, resolveFeedback, deleteFeedback, subscribeFeedback } from "./lib/feedback.js";
import {
  listCashDays, outstandingBySalon, setCashDay, cashHandover, listHandovers, subscribeCash,
  yesterdayISO as cashYesterday,
} from "./lib/cash.js";
import {
  SUPPLY_CATEGORIES, SUPPLY_UNITS, CENTRAL, ACT_KIND, uah as suah, uahN as suahN,
  listItems, upsertItem, setPrice, listStock, stockMap, stockState,
  listActs, actLines, writeoffLines, receipt as whReceipt, writeoff as whWriteoff, adjust as whAdjust,
  shipOrder, receiveOrder, listOrders, orderLines, createOrder, saveOrderLines, submitOrder, deleteOrder,
  subscribeSupply,
} from "./lib/supply.js";

/* =========================================================
   CONSTANTS & HELPERS
========================================================= */
const TM_LIST = TMS.map((t) => ({ key: t.key, name: t.name }));
const MANAGER_NAME = MANAGER.name;
const MONTH_NAMES = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const MONTH_GEN = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
const MON_SHORT = ["січ","лют","бер","кві","тра","чер","лип","сер","вер","жов","лис","гру"];
const WEEKDAYS_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"];
const pad2 = (n) => String(n).padStart(2, "0");
/* людський підпис дедлайну; приймає ISO-таймстамп або "YYYY-MM-DD" */
function fmtDeadline(v) {
  if (!v) return "";
  if (v.length <= 10) { const [y, m, d] = v.split("-").map(Number); return `${d} ${MON_SHORT[m - 1]}`; }
  const dt = new Date(v);
  if (isNaN(dt)) return "";
  const now = new Date();
  const yr = dt.getFullYear() === now.getFullYear() ? "" : ` ${dt.getFullYear()}`;
  const time = (dt.getHours() || dt.getMinutes()) ? `, ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` : "";
  return `${dt.getDate()} ${MON_SHORT[dt.getMonth()]}${yr}${time}`;
}

const pad = (n) => String(n).padStart(2, "0");
const nowYm = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const prevYm = (ym) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
/* активний період ЗП — завжди попередній календарний місяць
   (у вересні працюємо над серпнем, дедлайн — 10 вересня) */
const salaryYm = () => prevYm(nowYm());
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
/* ---------- СМ: сховище розрахунків ЗП (по співробітнику) ----------
   Ключ: smdata:<salonKey>:<employeeId>:<ym>  (salonKey як частина 2 — для RLS) */
const smKey = (salonKey, empId, ym) => `smdata:${salonKey}:${empId}:${ym}`;
async function loadSmData(salonKey, empId, ym) {
  try {
    const r = await window.storage.get(smKey(salonKey, empId, ym), true);
    return r ? { ...emptySmData(), ...JSON.parse(r.value) } : emptySmData();
  } catch { return emptySmData(); }
}
async function saveSmData(salonKey, empId, ym, data) {
  try { await window.storage.set(smKey(salonKey, empId, ym), JSON.stringify(data), true); } catch (e) { console.error(e); }
}
async function listSmMonths(salonKey, empId) {
  try {
    const pref = `smdata:${salonKey}:${empId}:`;
    const r = await window.storage.list(pref, true);
    return (r?.keys || []).map((k) => k.replace(pref, ""));
  } catch { return []; }
}
/* ЗП салону за місяць = сума по всіх активних співробітниках */
async function salonSalaryRows(salonKey, ym, employees) {
  const emps = (employees || []).filter((e) => e.salon_key === salonKey && e.status === "active");
  const datas = await Promise.all(emps.map((e) => loadSmData(salonKey, e.id, ym)));
  const calcs = emps.length ? await calcSmBatch(emps.map((e, i) => ({ data: datas[i], salonKey, ym }))) : [];
  return emps.map((e, i) => ({ emp: e, data: datas[i], calc: calcs[i], total: calcs[i]?.total || 0 }));
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
/* Числове поле: 0 не показуємо (плейсхолдер), під час набору тримаємо
   «чернетку» рядком — курсор і Backspace працюють природно.
   allowEmpty: порожнє значення повертає "" замість 0 (де важлива різниця
   «не заповнено» vs «нуль», напр. рентабельність по магазинах). */
/* Неконтрольований під час набору (DOM тримає текст) — курсор і Backspace
   поводяться природно, немає гонки з ре-рендером. Значення комітиться на
   blur / Enter. 0 показуємо як плейсхолдер, а не літерал. */
const numStr = (v) => (v === "" || v == null || v === 0 ? "" : String(v));
const parseNum = (s, allowEmpty) => {
  const t = String(s).replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === "." || t === "-.") return allowEmpty ? "" : 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : (allowEmpty ? "" : 0);
};
function NumInput({ value, onChange, className, placeholder = "0", allowEmpty = false, ...rest }) {
  const ref = React.useRef(null);
  const editing = React.useRef(false);

  useEffect(() => {
    if (!editing.current && ref.current && ref.current.value !== numStr(value)) {
      ref.current.value = numStr(value);
    }
  }, [value]);

  const commit = () => {
    editing.current = false;
    const next = parseNum(ref.current.value, allowEmpty);
    // не смикати onChange, якщо значення фактично не змінилося
    const cur = allowEmpty && (value === "" || value == null) ? "" : (Number(value) || 0);
    if (next === cur) return;
    onChange(next);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      className={className}
      defaultValue={numStr(value)}
      placeholder={placeholder}
      onFocus={(e) => { editing.current = true; const el = e.target; requestAnimationFrame(() => el.select()); }}
      onInput={(e) => {
        const el = e.currentTarget;
        const cleaned = el.value.replace(/[^\d.,-]/g, "");
        if (cleaned !== el.value) el.value = cleaned;
      }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { commit(); e.currentTarget.blur(); } }}
      {...rest}
    />
  );
}

function Field({ label, value, onChange, suffix, full, readOnly }) {
  return (
    <label className={`field ${full ? "field-full" : ""}`}>
      <span className="field-label">{label}</span>
      {readOnly ? (
        <div className="field-value">{value ?? 0}{suffix ? ` ${suffix}` : ""}</div>
      ) : (
        <div className="field-input-wrap">
          <NumInput className="field-input" value={value} onChange={onChange} />
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
const TmItem = (props) => <Item {...props} conditions={tmCond(props.num)} />;
const SmItem = (props) => <Item {...props} conditions={smCond(props.num)} />;
function BlockHeader({ n, title }) {
  return (
    <div className="block-header">
      <span className="block-header-n">Блок {n}</span>
      <span className="block-header-title">{title}</span>
    </div>
  );
}

/* міні-тренд для KPI-плиток (без осей) */
function Spark({ data, w = 56, h = 18, color = "var(--gold)" }) {
  const pts = (data || []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
  const step = w / (pts.length - 1);
  const xy = pts.map((v, i) => [i * step, h - 1 - ((v - min) / rng) * (h - 2)]);
  const d = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg className="kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="1.9" fill={color} />
    </svg>
  );
}

/* дельта до попереднього місяця */
function Delta({ value, unit = "", suffix = "", invert = false }) {
  if (value == null || Number.isNaN(value)) return null;
  const zero = Math.abs(value) < (unit === "%" ? 0.5 : 1);
  const good = invert ? value < 0 : value > 0;
  const tone = zero ? "flat" : good ? "up" : "down";
  const arrow = zero ? "≈" : value > 0 ? "▲" : "▼";
  const num = unit === "%" ? Math.abs(Math.round(value)) : fmt(Math.abs(value)).replace(" грн", "");
  return (
    <span className={`kpi-delta ${tone}`}>
      {arrow} {zero ? "на рівні місяця" : `${num}${unit} ${suffix}`}
    </span>
  );
}
function ImageModal({ src, onClose }) {
  const [z, setZ] = useState(1);              // масштаб
  const [off, setOff] = useState({ x: 0, y: 0 }); // зсув при перетягуванні
  const drag = useRef(null);
  const MIN = 1, MAX = 6;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZ((v) => Math.min(MAX, +(v + 0.4).toFixed(2)));
      if (e.key === "-") setZ((v) => { const n = Math.max(MIN, +(v - 0.4).toFixed(2)); if (n === MIN) setOff({ x: 0, y: 0 }); return n; });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const zoomAt = (delta) => setZ((v) => {
    const n = Math.min(MAX, Math.max(MIN, +(v + delta).toFixed(2)));
    if (n === MIN) setOff({ x: 0, y: 0 });
    return n;
  });
  const onWheel = (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 0.3 : -0.3); };
  const onDown = (e) => { if (z <= MIN) return; drag.current = { x: e.clientX - off.x, y: e.clientY - off.y }; };
  const onMove = (e) => { if (!drag.current) return; setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };
  const onDbl = () => { if (z > MIN) { setZ(1); setOff({ x: 0, y: 0 }); } else setZ(2.5); };

  return (
    <div className="modal-overlay" onClick={onClose} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
      <div className="img-modal" onClick={(e) => e.stopPropagation()}>
        <div className="img-modal-tools">
          <button type="button" onClick={() => zoomAt(-0.4)} disabled={z <= MIN} aria-label="Зменшити">−</button>
          <span className="img-modal-z">{Math.round(z * 100)}%</span>
          <button type="button" onClick={() => zoomAt(0.4)} disabled={z >= MAX} aria-label="Збільшити">+</button>
          <button type="button" onClick={() => { setZ(1); setOff({ x: 0, y: 0 }); }} disabled={z === 1} aria-label="Скинути">↺</button>
        </div>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div
          className="img-modal-stage"
          onWheel={onWheel}
          onMouseDown={onDown}
          onDoubleClick={onDbl}
          style={{ cursor: z > MIN ? (drag.current ? "grabbing" : "grab") : "zoom-in" }}
        >
          <img
            src={src}
            alt="скрін"
            draggable={false}
            style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${z})` }}
          />
        </div>
      </div>
    </div>
  );
}
function CalcBusyDot() {
  const [busy, setBusy] = useState(calcBusyNow());
  useEffect(() => subscribeCalcBusy(setBusy), []);
  return <span className={`calc-busy-dot ${busy ? "on" : ""}`} title="Перерахунок мотивації…" aria-hidden={!busy} />;
}

function FeedbackButton({ cabKey }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("problem");
  const [body, setBody] = useState("");
  const [shot, setShot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const pickFile = async (file) => {
    if (!file) return;
    try { setShot(await resizeImage(file)); } catch { /* ignore */ }
  };
  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) pickFile(item.getAsFile());
  };
  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await submitFeedback({ kind, body, screenshot: shot, fromCabinet: cabKey, fromType: "" });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setBody(""); setShot(null); setKind("problem"); }, 1400);
    } catch (e) { alert(e.message || e); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button className="topbar-fb" title="Повідомити про проблему або запропонувати" onClick={() => setOpen(true)}>
        <MessageSquare size={17} />
      </button>
      {open && createPortal(
        <div className="modal-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="fb-modal" onClick={(e) => e.stopPropagation()} onPaste={onPaste}>
            <div className="fb-modal-head">
              <span>Звернення до адміністратора</span>
              <button className="modal-close" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            {done ? (
              <div className="fb-done"><Check size={22} /> Дякуємо! Звернення надіслано.</div>
            ) : (
              <div className="fb-modal-body">
                <div className="fb-kind">
                  <button className={kind === "problem" ? "active" : ""} onClick={() => setKind("problem")}>
                    <Wrench size={14} /> Проблема
                  </button>
                  <button className={kind === "proposal" ? "active" : ""} onClick={() => setKind("proposal")}>
                    <Sparkles size={14} /> Пропозиція
                  </button>
                </div>
                <textarea
                  className="fb-ta" rows={4} autoFocus value={body}
                  placeholder={kind === "problem" ? "Опишіть, що не працює або поводиться дивно…" : "Опишіть ідею чи що покращити…"}
                  onChange={(e) => setBody(e.target.value)}
                />
                {shot ? (
                  <div className="fb-shot">
                    <img src={shot} alt="скрін" />
                    <button onClick={() => setShot(null)}><X size={13} /></button>
                  </div>
                ) : (
                  <label className="fb-attach">
                    <ImageIcon size={14} /> Додати скріншот
                    <input type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
                  </label>
                )}
                <p className="fb-hint">Скрін можна вставити з буфера (Ctrl+V).</p>
                <button className="btn-primary" onClick={send} disabled={busy || !body.trim()}>
                  <Send size={14} /> {busy ? "Надсилання…" : "Надіслати"}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function TopBar({ title, onBack, onLogout, cabKey, onMenu }) {
  return (
    <div className="topbar">
      {onMenu && (
        <button className="topbar-menu" onClick={onMenu} aria-label="Меню"><Menu size={18} /></button>
      )}
      <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> Назад</button>
      <span className="topbar-title">{title}</span>
      <div className="topbar-right">
        <CalcBusyDot />
        {cabKey && <FeedbackButton cabKey={cabKey} />}
        {cabKey && <NotificationCenter cabKey={cabKey} />}
        {onLogout && (
          <button className="topbar-logout" onClick={onLogout}>Вийти</button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   СПОВІЩЕННЯ — дзвіночок + випадна панель + тости-строки
========================================================= */
/* локальна шина тостів — щоб показати строку тому, хто сам виконав дію */
const toastBus = typeof window !== "undefined" ? new EventTarget() : null;
function pushToast(detail) {
  toastBus?.dispatchEvent(new CustomEvent("toast", { detail }));
}

const notifIcon = (kind) => {
  if (kind === "task_new") return <CheckSquare size={15} />;
  if (kind === "task_status") return <Check size={15} />;
  if (kind === "salary") return <Wallet size={15} />;
  if (kind === "invoice") return <CreditCard size={15} />;
  if (kind === "birthday") return <Cake size={15} />;
  if (kind === "feedback") return <MessageSquare size={15} />;
  return <Bell size={15} />;
};
const relTime = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "щойно";
  if (s < 3600) return `${Math.floor(s / 60)} хв тому`;
  if (s < 86400) return `${Math.floor(s / 3600)} год тому`;
  return `${Math.floor(s / 86400)} дн тому`;
};

function NotificationCenter({ cabKey }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const reload = () => listNotifications(60).then(setItems).catch(() => {});
  const showToast = (t) => {
    const id = t.id || `l${Date.now()}${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, title: t.title, body: t.body }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  };
  useEffect(() => {
    reload();
    const unsub = subscribeNotifications(cabKey, (n) => {
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
      showToast(n);
    });
    const onLocal = (e) => showToast(e.detail || {});
    toastBus?.addEventListener("toast", onLocal);
    return () => { unsub(); toastBus?.removeEventListener("toast", onLocal); };
  }, [cabKey]);

  const unread = items.filter((n) => !n.read).length;
  const onOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      await markAllRead().catch(() => {});
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  return (
    <>
      <div className="notif-wrap">
        <button className="notif-bell" onClick={onOpen} aria-label="Сповіщення">
          <Bell size={18} />
          {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
        </button>
        {open && (
          <>
            <div className="notif-backdrop" onClick={() => setOpen(false)} />
            <div className="notif-panel">
              <div className="notif-panel-head">
                <span>Сповіщення</span>
                {items.length > 0 && (
                  <button className="notif-clear" onClick={async () => { await markAllRead().catch(() => {}); setItems((p) => p.map((n) => ({ ...n, read: true }))); }}>
                    прочитати всі
                  </button>
                )}
              </div>
              <div className="notif-list">
                {items.length === 0 && <div className="notif-empty">Поки що порожньо</div>}
                {items.map((n) => (
                  <div className={`notif-item ${n.read ? "" : "notif-unread"}`} key={n.id}>
                    <span className="notif-ic">{notifIcon(n.kind)}</span>
                    <div className="notif-body">
                      <b>{n.title}</b>
                      {n.body && <p>{n.body}</p>}
                      <time>{relTime(n.created_at)}</time>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {createPortal(
        <div className="toast-stack">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              <Bell size={16} />
              <div><b>{t.title}</b>{t.body && <span>{t.body}</span>}</div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
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
                <NumInput className="salon-pct-input" value={v} allowEmpty placeholder="—"
                  onChange={(nv) => onSet(s.key, nv)} />
                <span className="salon-pct-suffix">{suffix}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CriteriaForm({ data, update, grade, showAmounts, onAddShot, onRemoveShot, onPreview, readOnly, tmKey, ym, managerMode, onFlag, calc }) {
  const salons = salonsOfTm(tmKey, ym);
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

function SalarySummary({ data, grade, tmKey, ym, adj, qbonus, isLastMonthOfQuarter, expandedBlock, onToggle, editable, onAdjChange, onSaveAdj, savingAdj, onSetPaymentStatus, monthLbl, calc }) {
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
            <NumInput className="adj-amount" value={adj.amount} onChange={(v) => onAdjChange({ ...adj, amount: v })} />
            <span>грн</span>
          </div>
          <div className="adj-row">
            <span>Аванс (вирахувати)</span>
            <NumInput className="adj-amount" value={adj.advance} onChange={(v) => onAdjChange({ ...adj, advance: v })} />
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
  const [ym, setYm] = useState(salaryYm());
  const [data, setData] = useState(emptyData());
  const [adj, setAdj] = useState({ amount: 0, comment: "", advance: 0 });
  const [grade, setGrade] = useState(2);
  const [qbonus, setQbonus] = useState({ bonus41: 0, bonus42: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("form");
  const [expandedBlock, setExpandedBlock] = useState(null);
  const skipSave = React.useRef(true);

  const qKey = ymToQuarter(ym);
  const qMonths = quarterMonths(qKey);
  const isLastMonthOfQuarter = ym === qMonths[2];
  const { calc } = useTmCalc(data, grade, tmKey, ym);

  useEffect(() => {
    let active = true;
    setLoading(true);
    skipSave.current = true;
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

  const saveDraft = async () => {
    setSaving(true);
    await saveData(tmKey, ym, data);
    setSaving(false);
    setSavedAt(new Date());
  };
  // автозбереження через 2,5 с після останньої зміни
  useEffect(() => {
    if (loading) return undefined;
    if (skipSave.current) { skipSave.current = false; return undefined; }
    const t = setTimeout(async () => { await saveData(tmKey, ym, data); setSavedAt(new Date()); }, 2500);
    return () => clearTimeout(t);
  }, [data, loading, tmKey, ym]);

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

      {loading || !calc ? <div className="loading">Завантаження…</div> : tab === "form" ? (
        <>
          <CriteriaForm data={data} update={update} grade={grade} tmKey={tmKey} ym={ym} showAmounts calc={calc}
            onAddShot={onAddShot} onRemoveShot={onRemoveShot} onPreview={setPreview} readOnly={false} />
          <SalarySummary
            data={data} grade={grade} tmKey={tmKey} ym={ym} adj={adj} qbonus={qbonus} isLastMonthOfQuarter={isLastMonthOfQuarter}
            expandedBlock={expandedBlock} onToggle={toggleBlock} editable={false} monthLbl={monthLabel(ym)} calc={calc}
          />
          <div className="save-bar">
            <span className="save-hint">
              {saving ? "Зберігаю…" : savedAt ? `Збережено о ${savedAt.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}` : "Зміни зберігаються автоматично"}
            </span>
            <button className="btn-secondary" onClick={saveDraft} disabled={saving}>Зберегти</button>
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
        const calcs = await calcTmBatch(monthsData.map((d, i) => ({ data: d, grade, tmKey: t.key, ym: qMonths[i] })));
        const pcts = calcs.map((c) => c.b1.d.sales.pct);
        const allMet = pcts.every((p) => p >= 100);
        const avgOver = pcts.reduce((s, p) => s + Math.max(0, p - 100), 0) / 3;
        const sumFloored = calcs.reduce((s, c) => s + c.floored, 0);
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
              <NumInput value={r.avgOver} onChange={(v) => setOverride(t.key, v)} />
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
  const [ym, setYm] = useState(salaryYm());
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
  const { calc } = useTmCalc(data, grade, tmKey, ym);

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
        const items = [];
        for (const m of ms) {
          const [d, g] = await Promise.all([loadData(t.key, m), loadGrade(t.key, ymToQuarter(m))]);
          items.push({ data: d, grade: g, tmKey: t.key, ym: m });
        }
        const calcs = items.length ? await calcTmBatch(items) : [];
        results[t.key] = ms.map((m, i) => ({ month: m, total: Math.round(calcs[i].floored) }));
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
    if (status === "to_pay") notify({ recipient: tmKey, kind: "salary", title: "ЗП призначено до виплати", body: monthLabel(ym), actor: "manager", link: "salary" });
    if (status === "paid") notify({ recipient: tmKey, kind: "salary", title: "ЗП виплачено", body: monthLabel(ym), actor: "manager", link: "salary" });
  };

  const sendBack = async () => {
    setSavingCorr(true);
    const next = { ...data, status: "corrected", correctedAt: new Date().toISOString(), managerComment: correctionComment };
    await saveData(tmKey, ym, next);
    setData(next);
    setCorrectionComment("");
    setSavingCorr(false);
    notify({ recipient: tmKey, kind: "salary", title: "Керівник повернув ЗП на доопрацювання", body: monthLabel(ym), actor: "manager", link: "salary" });
  };
  const approve = async () => {
    setSavingCorr(true);
    const next = { ...data, status: "approved", approvedAt: new Date().toISOString(), managerFlags: {}, managerComment: "" };
    await saveData(tmKey, ym, next);
    setData(next);
    setSavingCorr(false);
    notify({ recipient: tmKey, kind: "salary", title: "Керівник погодив вашу ЗП", body: monthLabel(ym), actor: "manager", link: "salary" });
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

          {loading || !calc ? <div className="loading">Завантаження…</div> : (
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
                data={data} grade={grade} tmKey={tmKey} ym={ym} showAmounts readOnly calc={calc}
                managerMode={data.status !== "draft"} onFlag={onFlag}
                onPreview={setPreview}
              />

              <SalarySummary
                data={data} grade={grade} tmKey={tmKey} ym={ym} adj={adj} qbonus={qbonus} isLastMonthOfQuarter={isLastMonthOfQuarter}
                expandedBlock={expandedBlock} onToggle={toggleBlock} editable calc={calc}
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
      const employees = await listEmployees().catch(() => []);
      for (const s of SALONS) {
        const rows = await salonSalaryRows(s.key, ym, employees);
        if (rows.length && rows.every((r) => r.data.status === "submitted" || r.data.status === "corrected")) submitted += 1;
        if (rows.some((r) => r.data.paymentStatus === "to_pay")) toPay += 1;
      }
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
  const [login, setLogin] = useState(() => getLogin(cabKey));
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [mCode, setMCode] = useState("");
  const [mPass, setMPass] = useState("");
  const [mErr, setMErr] = useState("");
  const [mBusy, setMBusy] = useState(false);

  const submit = async () => {
    if (!login || !password) return;
    setBusy(true);
    // майстер-код можна ввести й у звичайне поле пароля
    let ok = await verify(login, password);
    if (!ok) ok = await masterLogin(cabKey, password).catch(() => false);
    setBusy(false);
    if (ok) onSuccess(remember);
    else { setError("Невірний логін або пароль"); setPassword(""); }
  };

  const masterEnter = async () => {
    if (!mCode) return;
    setMBusy(true); setMErr("");
    const ok = await masterLogin(cabKey, mCode);
    setMBusy(false);
    if (ok) onSuccess(remember);
    else setMErr("Невірний код відновлення");
  };
  const masterReset = async () => {
    if (!mCode || mPass.length < 6) return;
    setMBusy(true); setMErr("");
    const r = await confirmRecovery(cabKey, mCode, mPass);
    if (!r.ok) { setMBusy(false); setMErr(r.error || "Не вдалося"); return; }
    const ok = await verify(login, mPass);
    setMBusy(false);
    if (ok) onSuccess(remember);
    else { setForgot(false); setError("Пароль змінено — увійдіть новим"); setPassword(""); }
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
              autoComplete="username" value={login}
              onChange={(e) => { setLogin(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("lg-pass")?.focus(); }}
            />
          </label>
          <label className="login-field">
            <span>Пароль</span>
            <input
              id="lg-pass" type="password" autoFocus autoComplete="current-password" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </label>
          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Не виходити на цьому пристрої</span>
          </label>
        </div>
        <p className={`pin-error ${error ? "visible" : ""}`}>{error || " "}</p>
        <div className="pin-actions">
          <button className="btn-secondary" onClick={onCancel}>Назад</button>
          <button className="btn-primary" onClick={submit} disabled={!login || !password || busy}>
            {busy ? "Перевірка…" : "Увійти"}
          </button>
        </div>
        {forgot ? (
          <div className="lg-recover">
            <p className="recover-lead">
              Введіть <b>код відновлення</b>. Лише з кодом — увійдете одразу. З новим паролем — ще й зміните його.
              Якщо коду немає — зверніться до {ADMIN_NAME}.
            </p>
            <input className="lg-recover-in" placeholder="Код відновлення" value={mCode}
              onChange={(e) => { setMCode(e.target.value); setMErr(""); }} />
            <input className="lg-recover-in" type="password" placeholder="Новий пароль (необовʼязково, мін. 6)"
              value={mPass} onChange={(e) => { setMPass(e.target.value); setMErr(""); }} />
            {mErr && <p className="pin-error visible">{mErr}</p>}
            <div className="pin-actions">
              <button className="btn-secondary" onClick={() => setForgot(false)}>Назад</button>
              {mPass ? (
                <button className="btn-primary" onClick={masterReset} disabled={mBusy || !mCode || mPass.length < 6}>
                  {mBusy ? "…" : "Змінити й увійти"}
                </button>
              ) : (
                <button className="btn-primary" onClick={masterEnter} disabled={mBusy || !mCode}>
                  {mBusy ? "…" : "Увійти за кодом"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <button className="pin-forgot" onClick={() => setForgot(true)}>Забули пароль?</button>
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
    { value: "", label: `Авто${calc?.autoCategory ? ` (${calc.autoCategory})` : ""}` },
    ...smCategoryOptions().map((c) => ({ value: c.key, label: `${c.key} · ${c.note}` })),
  ];
  const coefOptions = managerCoefOptions().map((c) => ({ value: c.key, label: c.label }));

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
            <span>Брекет: {planBracketLabel(calc.bracket)}</span>
            <span>База: {fmt(calc.baseRaw)}</span>
            <span>Відпрац. коеф: {calc.factor.toFixed(2)} (норма вихідних {area === "місто" ? 10 : 9})</span>
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
        <SelectField readOnly={readOnly} label="Статус" value={String(data.manager.coef)} onChange={(v) => update(["manager", "coef"], v)} options={coefOptions} />
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
    { label: `База (${calc.category} · ${planBracketLabel(calc.bracket)})`, amount: calc.baseRaw },
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
            <NumInput className="adj-amount" value={data.adj.amount} onChange={(v) => onAdjChange({ ...data.adj, amount: v })} />
            <span>грн</span>
          </div>
          <div className="adj-row">
            <span>Аванс (вирахувати)</span>
            <NumInput className="adj-amount" value={data.adj.advance} onChange={(v) => onAdjChange({ ...data.adj, advance: v })} />
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
const smStatusText = { draft: "чернетка", submitted: "подано", corrected: "корективи ТМ", approved: "погоджено" };
function SmEmployeePicker({ salon, employees, ym, onPick }) {
  const emps = useMemo(() => employees
    .filter((e) => e.salon_key === salon.key && e.status === "active")
    .sort((a, b) => EMP_ROLE_ORDER.indexOf(a.role) - EMP_ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)), [employees, salon.key]);
  const [info, setInfo] = useState({}); // empId → { status, total }

  useEffect(() => {
    let active = true;
    if (!emps.length) return undefined;
    salonSalaryRows(salon.key, ym, employees).then((rows) => {
      if (!active) return;
      const m = {};
      rows.forEach((r) => { m[r.emp.id] = { status: r.data.status, total: r.total }; });
      setInfo(m);
    });
    return () => { active = false; };
  }, [salon.key, ym, emps.length]); // eslint-disable-line

  return (
    <div className="sm-emp-pick">
      <h3 className="ov-h">Оберіть співробітника</h3>
      <p className="ov-sub">ЗП рахується окремо для кожного · {salonLabel(salon)} · {monthLabel(ym)}</p>
      {emps.length === 0 ? (
        <div className="admin-empty">У цьому магазині ще немає співробітників. Додайте їх у модулі «Команда» (кабінет ТМ).</div>
      ) : (
        <div className="sm-emp-grid">
          {emps.map((e) => {
            const it = info[e.id];
            const submitted = it && it.status !== "draft";
            return (
              <button className="sm-emp-card" key={e.id} onClick={() => onPick(e)}>
                <span className="sm-emp-name">{e.full_name}</span>
                <span className={`badge ${empRoleTone[e.role]}`}>{EMP_ROLES[e.role]}</span>
                {it && (
                  <span className="sm-emp-status">
                    <span className={`badge ${it.status === "submitted" || it.status === "approved" ? "badge-ok" : it.status === "corrected" ? "badge-off" : "badge-warn"}`}>
                      {smStatusText[it.status] || "—"}
                    </span>
                    {submitted && <b>{fmt(it.total)}</b>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SmView({ salon, embedded }) {
  const [employees, setEmployees] = useState(null);
  const [emp, setEmp] = useState(null);
  const [ym, setYm] = useState(salaryYm());
  const [data, setData] = useState(emptySmData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("form");
  const [expandedBlock, setExpandedBlock] = useState(null);
  const skipSave = React.useRef(true);

  const qMonths = quarterMonths(ymToQuarter(ym));
  const isQuarterEnd = ym === qMonths[2];

  useEffect(() => { listEmployees().then(setEmployees).catch(() => setEmployees([])); }, []);

  useEffect(() => {
    if (!emp) return undefined;
    let active = true;
    setLoading(true);
    setTab("form");
    skipSave.current = true;
    loadSmData(salon.key, emp.id, ym).then((d) => {
      if (!active) return;
      // коефіцієнт керуючого за замовчуванням = роль співробітника
      const roleCoef = { manager: "1.2", acting_manager: "1.1", seller: "1.0", intern: "1.0" }[emp.role] || "1.0";
      setData(d.status === "draft" ? { ...d, manager: { ...d.manager, coef: roleCoef } } : d);
      setLoading(false);
    });
    return () => { active = false; };
  }, [salon.key, emp, ym]);

  const update = (path, value) => setData((prev) => _.set(_.cloneDeep(prev), path, value));
  const onAddShot = makeAddShot(setData);
  const onRemoveShot = makeRemoveShot(setData);
  const toggleBlock = (id) => setExpandedBlock((p) => (p === id ? null : id));

  const saveDraft = async () => {
    setSaving(true);
    await saveSmData(salon.key, emp.id, ym, data);
    setSaving(false);
    setSavedAt(new Date());
  };
  useEffect(() => {
    if (loading || !emp) return undefined;
    if (skipSave.current) { skipSave.current = false; return undefined; }
    const t = setTimeout(async () => { await saveSmData(salon.key, emp.id, ym, data); setSavedAt(new Date()); }, 2500);
    return () => clearTimeout(t);
  }, [data, loading, salon.key, emp, ym]);

  const { calc } = useSmCalc(data, salon.key, ym);

  const months = useMemo(() => recentMonths(12), []);

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
    await saveSmData(salon.key, emp.id, ym, next);
    setData(next);
    setSaving(false);
  };
  const onReply = async (comment) => {
    const next = { ...data, smReplyComment: comment, smRepliedAt: new Date().toISOString() };
    await saveSmData(salon.key, emp.id, ym, next);
    setData(next);
  };

  if (employees === null) return <div className="loading">Завантаження…</div>;
  if (!emp) {
    return (
      <div className={embedded ? "embedded" : "view"}>
        {!embedded && <TopBar title={`Салон · ${salonLabel(salon)}`} onBack={() => {}} />}
        <div className="month-picker">
          <select value={ym} onChange={(e) => setYm(e.target.value)}>
            {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
          </select>
        </div>
        <SmEmployeePicker salon={salon} employees={employees} ym={ym} onPick={setEmp} />
      </div>
    );
  }

  const dl = deadlineInfo(ym);
  const showBanner = !dl.future && (data.status === "draft" || data.status === "corrected");
  const hasCorr = !!data.tmComment || (data.correctionDiff && data.correctionDiff.length > 0);

  return (
    <div className={embedded ? "embedded" : "view"}>
      {!embedded && <TopBar title={`Салон · ${salonLabel(salon)}`} onBack={() => {}} />}
      <div className="sm-emp-bar">
        <button className="topbar-back" onClick={() => setEmp(null)}><ChevronLeft size={15} /> інший співробітник</button>
        <span className="sm-emp-cur">{emp.full_name}</span>
        <span className={`badge ${empRoleTone[emp.role]}`}>{EMP_ROLES[emp.role]}</span>
      </div>
      <div className="month-picker">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
        {data.status === "submitted" && <span className="badge-ok"><Check size={13} /> На розгляді в ТМ</span>}
        {data.status === "corrected" && <span className="badge-off">ТМ вніс корективи</span>}
        {data.tmApproved && <span className="badge-warn">Передано керівнику</span>}
      </div>
      {showBanner && (
        <div className={`banner ${dl.overdue ? "banner-late" : "banner-warn"}`}>
          <AlertTriangle size={16} />
          {dl.overdue
            ? `Термін подачі ЗП за ${monthLabel(ym)} минув (був до ${dl.dueLabel}).`
            : `Подайте ЗП за ${monthLabel(ym)} до ${dl.dueLabel}.`}
        </div>
      )}

      <div className="inner-tabs">
        <button className={tab === "form" ? "active" : ""} onClick={() => setTab("form")}>Форма</button>
        <button className={tab === "corrections" ? "active" : ""} onClick={() => setTab("corrections")}>
          Корективи від ТМ{hasCorr && !data.smRepliedAt ? " •" : ""}
        </button>
      </div>

      {loading || !calc ? <div className="loading">Завантаження…</div> : tab === "form" ? (
        <>
          <SmCriteriaForm
            data={data} update={update} calc={calc} area={salon.area} showAmounts
            onAddShot={onAddShot} onRemoveShot={onRemoveShot} onPreview={setPreview} readOnly={false} isQuarterEnd={isQuarterEnd}
          />
          <SmSummary data={data} calc={calc} expandedBlock={expandedBlock} onToggle={toggleBlock} editable={false} monthLbl={monthLabel(ym)} />
          <div className="save-bar">
            <span className="save-hint">
              {saving ? "Зберігаю…" : savedAt ? `Збережено о ${savedAt.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}` : "Зміни зберігаються автоматично"}
            </span>
            <button className="btn-secondary" onClick={saveDraft} disabled={saving}>Зберегти</button>
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
function SalonDetail({ salon, emp, ym, reviewer, onBack }) {
  const [data, setData] = useState(emptySmData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [comment, setComment] = useState("");
  const [expandedBlock, setExpandedBlock] = useState(null);

  const canEdit = reviewer === "tm"; // корективи вносить ТМ; керівник дивиться
  const qMonths = quarterMonths(ymToQuarter(ym));
  const isQuarterEnd = ym === qMonths[2];
  const empId = emp?.id;
  const notifBody = `${emp?.full_name || ""} · ${monthLabel(ym)}`;

  useEffect(() => {
    if (!empId) return undefined;
    let active = true;
    setLoading(true); setEditMode(false); setComment(""); setExpandedBlock(null);
    loadSmData(salon.key, empId, ym).then((d) => { if (active) { setData(d); setLoading(false); } });
    return () => { active = false; };
  }, [salon.key, empId, ym]);

  const update = (path, value) => setData((prev) => _.set(_.cloneDeep(prev), path, value));
  const onAddShot = makeAddShot(setData);
  const onRemoveShot = makeRemoveShot(setData);
  const toggleBlock = (id) => setExpandedBlock((p) => (p === id ? null : id));

  const { calc } = useSmCalc(data, salon.key, ym);

  const saveAdjOnly = async () => { setSaving(true); await saveSmData(salon.key, empId, ym, data); setSaving(false); };
  const setPaymentStatus = async (status) => {
    const next = { ...data, paymentStatus: status, paymentStatusAt: new Date().toISOString() };
    setData(next);
    await saveSmData(salon.key, empId, ym, next);
    if (status === "to_pay") notify({ recipient: salon.key, kind: "salary", title: "ЗП призначено до виплати", body: notifBody, actor: "manager", link: "salary" });
    if (status === "paid") notify({ recipient: salon.key, kind: "salary", title: "ЗП виплачено", body: notifBody, actor: "manager", link: "salary" });
  };
  const cancelEdit = async () => {
    const d = await loadSmData(salon.key, empId, ym);
    setData(d); setComment(""); setEditMode(false);
  };
  const saveCorrections = async () => {
    setSaving(true);
    const diff = smBuildDiff(data.smSnapshot, data);
    const next = { ...data, status: "corrected", correctedAt: new Date().toISOString(), tmComment: comment, correctionDiff: diff };
    await saveSmData(salon.key, empId, ym, next);
    setData(next); setEditMode(false); setComment(""); setSaving(false);
    notify({ recipient: salon.key, kind: "salary", title: "ТМ вніс корективи у ЗП", body: notifBody, actor: "tm", link: "salary" });
  };
  const approveToManager = async () => {
    const next = { ...data, tmApproved: true, tmApprovedAt: new Date().toISOString() };
    setData(next);
    await saveSmData(salon.key, empId, ym, next);
  };

  return (
    <div className="embedded">
      <div className="detail-head">
        <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> До списку співробітників</button>
        <span className="detail-title">{emp?.full_name} <span className="detail-sub">· {salonLabel(salon)} · {EMP_ROLES[emp?.role]} · {monthLabel(ym)}</span></span>
      </div>

      {loading || !calc ? <div className="loading">Завантаження…</div> : (
        <>
          <div className="status-line">
            Статус: {data.status === "submitted" ? "подано на погодження" : data.status === "corrected" ? "внесено корективи" : "не подано"}
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
const smStatusBadge = (st) => (
  <span className={`badge ${st === "submitted" ? "badge-ok" : st === "corrected" ? "badge-off" : "badge-warn"}`}>
    {st === "submitted" ? "подано" : st === "corrected" ? "корективи" : "чернетка"}
  </span>
);

function SalonReviewPanel({ tmKey, reviewer }) {
  const [ym, setYm] = useState(salaryYm());
  const salons = useMemo(() => salonsOfTm(tmKey, ym), [tmKey, ym]);
  const [employees, setEmployees] = useState(null);
  const [bySalon, setBySalon] = useState(null); // { salonKey: rows[] }
  const [openSalon, setOpenSalon] = useState(null);
  const [openEmp, setOpenEmp] = useState(null);
  const [reloadN, setReloadN] = useState(0);

  const months = useMemo(() => recentMonths(12), []);

  useEffect(() => { listEmployees().then(setEmployees).catch(() => setEmployees([])); }, []);

  useEffect(() => {
    if (!employees) return undefined;
    let active = true;
    setBySalon(null);
    (async () => {
      const out = {};
      for (const s of salons) out[s.key] = await salonSalaryRows(s.key, ym, employees);
      if (active) setBySalon(out);
    })();
    return () => { active = false; };
  }, [salons, ym, employees, reloadN, openEmp]);

  if (openSalon && openEmp) {
    const salon = salonByKey(openSalon);
    const emp = (employees || []).find((e) => e.id === openEmp);
    return <SalonDetail salon={salon} emp={emp} ym={ym} reviewer={reviewer} onBack={() => { setOpenEmp(null); setReloadN((n) => n + 1); }} />;
  }

  if (!employees || !bySalon) return <div className="loading">Завантаження…</div>;

  return (
    <div className="embedded">
      <div className="month-row">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
        </select>
        {openSalon && <button className="topbar-back" onClick={() => setOpenSalon(null)}><ChevronLeft size={15} /> усі магазини</button>}
      </div>

      {!openSalon ? (
        <div className="salon-list">
          {salons.map((s) => {
            const rows = bySalon[s.key] || [];
            const total = rows.reduce((a, r) => a + r.total, 0);
            const done = rows.filter((r) => r.data.status === "submitted" || r.data.status === "corrected").length;
            return (
              <button className="salon-row" key={s.key} onClick={() => setOpenSalon(s.key)}>
                <span className="salon-row-main">
                  <span className="salon-row-name">{salonLabel(s)}</span>
                  <span className="salon-row-sub">{rows.length} співр. · подали {done}/{rows.length}</span>
                </span>
                <b className="salon-row-total">{fmt(total)}</b>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="salon-list">
          <div className="emp-group-head" style={{ borderRadius: "var(--radius-md)", marginBottom: 4 }}>{salonLabel(salonByKey(openSalon))}</div>
          {(bySalon[openSalon] || []).length === 0 && <div className="admin-empty">У магазині немає співробітників.</div>}
          {(bySalon[openSalon] || []).map((r) => (
            <button className="salon-row" key={r.emp.id} onClick={() => setOpenEmp(r.emp.id)}>
              <span className="salon-row-main">
                <span className="salon-row-name">{r.emp.full_name}</span>
                <span className="salon-row-sub">{EMP_ROLES[r.emp.role]}</span>
              </span>
              {smStatusBadge(r.data.status)}
              {r.data.tmApproved && <span className="badge badge-warn">керівнику</span>}
              <b className="salon-row-total">{fmt(r.total)}</b>
            </button>
          ))}
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
  const calc = await calcTm(d, g, tmKey, ym);
  const total = calc.floored + (isLast ? (qb.bonus41 + qb.bonus42) : 0) + (a.amount || 0) - (a.advance || 0);
  return { data: d, total, status: d.status, paymentStatus: d.paymentStatus };
}

function ConsolidationPanel({ role }) {
  const [ym, setYm] = useState(salaryYm());
  const [rows, setRows] = useState(null);
  const [reload, setReload] = useState(0);

  const months = useMemo(() => {
    return recentMonths(12);
  }, []);

  useEffect(() => {
    let active = true;
    setRows(null);
    (async () => {
      const employees = await listEmployees().catch(() => []);
      const [tmResults, salonResults] = await Promise.all([
        Promise.all(TMS.map((t) => tmGrandTotal(t.key, ym))),
        Promise.all(SALONS.map((s) => salonSalaryRows(s.key, ym, employees))),
      ]);
      const tmRows = TMS.map((t, i) => ({ kind: "tm", key: t.key, name: t.name, tm: null, ...tmResults[i] }));
      const smRows = [];
      SALONS.forEach((s, si) => {
        salonResults[si].forEach((er) => smRows.push({
          kind: "sm", key: `${s.key}::${er.emp.id}`, salonKey: s.key, empId: er.emp.id,
          name: er.emp.full_name, sub: `${cabName(s.key)} · ${EMP_ROLES[er.emp.role]}`, tm: salonTmOn(s.key, ym),
          data: er.data, total: er.total,
          status: er.data.status, paymentStatus: er.data.paymentStatus, tmApproved: er.data.tmApproved,
        }));
      });
      if (active) setRows([...tmRows, ...smRows]);
    })();
    return () => { active = false; };
  }, [ym, reload]);

  const setPay = async (row, status) => {
    const patch = { paymentStatus: status, paymentStatusAt: new Date().toISOString() };
    let recipient = row.key;
    if (row.kind === "tm") {
      const d = await loadData(row.key, ym);
      await saveData(row.key, ym, { ...d, ...patch });
    } else {
      const d = await loadSmData(row.salonKey, row.empId, ym);
      await saveSmData(row.salonKey, row.empId, ym, { ...d, ...patch });
      recipient = row.salonKey;
    }
    if (status === "to_pay" || status === "paid") {
      notify({
        recipient, kind: "salary",
        title: status === "to_pay" ? "ЗП призначено до виплати" : "ЗП виплачено",
        body: row.kind === "sm" ? `${row.name} · ${monthLabel(ym)}` : monthLabel(ym),
        actor: role === "accountant" ? "accountant" : "manager", link: "salary",
      });
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
                <span className="consol-role">{r.kind === "tm" ? "ТМ" : r.sub}</span>
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
   АДМІНІСТРУВАННЯ (кабінет Шаха Андрія) — панель керування сайтом
========================================================= */
const reassignMonthOpts = () => {
  const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
  return Array.from({ length: 9 }, (_, i) => {
    const x = new Date(y, m - 1 + i, 1);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`;
  });
};

function AdminRecovery() {
  const [reqs, setReqs] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    listRecoveryRequests().then((r) => { if (active) setReqs(r); });
    return () => { active = false; };
  }, [reload]);
  const dismiss = async (k) => { await clearRecovery(k); setReload((n) => n + 1); };
  return (
    <div className="admin-panel">
      <h3>Запити на відновлення паролю</h3>
      <p className="hint">
        Змінити пароль будь-кому — у вкладці «Доступи». Користувач також може відновити сам на екрані входу
        («Забули пароль?») майстер-кодом.
      </p>
      {reqs === null ? <div className="loading">Завантаження…</div>
        : reqs.length === 0 ? <div className="admin-empty">Активних запитів немає.</div>
        : (
          <div className="admin-list">
            {reqs.map((r) => (
              <div className="admin-req" key={r.cabKey}>
                <div className="admin-req-info">
                  <span className="admin-req-name">{cabName(r.cabKey)}</span>
                  <span className="admin-req-time">запит {fmtDate(r.at)}</span>
                </div>
                <PassReset cabKey={r.cabKey} />
                <button className="btn-secondary small" onClick={() => dismiss(r.cabKey)}>Прибрати</button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function PassReset({ cabKey }) {
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setBusy(true); setMsg("");
    const r = await adminSetPassword(cabKey, pass);
    setBusy(false);
    if (r.ok) { setMsg("✓ змінено"); setPass(""); setTimeout(() => { setOpen(false); setMsg(""); }, 1400); }
    else setMsg(r.error || "помилка");
  };
  if (!open) return <button className="btn-secondary small" onClick={() => setOpen(true)}>Змінити пароль</button>;
  return (
    <span className="admin-pass-edit">
      <input type="text" autoFocus placeholder="новий пароль (мін. 6)" value={pass}
        onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && pass.length >= 6) save(); }} />
      <button className="btn-primary small" disabled={busy || pass.length < 6} onClick={save}>{busy ? "…" : "OK"}</button>
      <button className="btn-secondary small" onClick={() => { setOpen(false); setMsg(""); }}>×</button>
      {msg && <span className="admin-pass-msg">{msg}</span>}
    </span>
  );
}

function AdminAccess() {
  const rows = ALL_CAB_KEYS.map((k) => ({ key: k, name: cabName(k), login: getLogin(k) }));
  return (
    <div className="admin-panel">
      <h3>Доступи</h3>
      <p className="hint">Логіни фіксовані. Пароль будь-якого кабінету можна змінити тут.</p>
      <div className="admin-list">
        {rows.map((r) => (
          <div className="admin-access-row" key={r.key}>
            <div className="admin-req-info">
              <span className="admin-req-name">{r.name}</span>
              <span className="admin-req-time">{r.login}@dnipro-m.local</span>
            </div>
            <PassReset cabKey={r.key} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminReassign() {
  const [list, setList] = useState(null);
  const [salonKey, setSalonKey] = useState(SALONS[0].key);
  const [toTm, setToTm] = useState(TMS[0].key);
  const [fromYm, setFromYm] = useState(nowYm());
  const months = useMemo(reassignMonthOpts, []);
  const load = () => listReassignments().then((l) => setList(l.sort((a, b) => (a.fromYm < b.fromYm ? 1 : -1))));
  useEffect(() => { load(); }, []);
  const add = async () => {
    await addReassignment({ salonKey, toTm, fromYm });
    load();
  };
  const del = async (id) => { await removeReassignment(id); load(); };
  return (
    <div className="admin-panel">
      <h3>Магазини й ТМ</h3>
      <p className="hint">Перепризначення діє від указаного місяця й далі — розрахунок ЗП, зведення та всі модулі це враховують.</p>
      <div className="admin-reassign-form">
        <label className="over-field"><span>Магазин</span>
          <select value={salonKey} onChange={(e) => setSalonKey(e.target.value)}>
            {SALONS.map((s) => <option key={s.key} value={s.key}>{salonLabel(s)} (зараз: {tmByKey(salonTmOn(s.key, fromYm))?.name})</option>)}
          </select>
        </label>
        <label className="over-field"><span>Переходить до ТМ</span>
          <select value={toTm} onChange={(e) => setToTm(e.target.value)}>
            {TMS.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </label>
        <label className="over-field"><span>Від місяця</span>
          <select value={fromYm} onChange={(e) => setFromYm(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <button className="btn-primary" onClick={add}>Застосувати перехід</button>
      </div>
      {list === null ? <div className="loading">Завантаження…</div>
        : list.length === 0 ? <div className="admin-empty">Перепризначень немає — усі магазини за базовим підпорядкуванням.</div>
        : (
          <div className="admin-list">
            {list.map((r) => (
              <div className="admin-req" key={r.id}>
                <div className="admin-req-info">
                  <span className="admin-req-name">{salonLabel(salonByKey(r.salonKey))}</span>
                  <span className="admin-req-time">→ {tmByKey(r.toTm)?.name} · від {monthLabel(r.fromYm)}</span>
                </div>
                <button className="btn-secondary small" onClick={() => del(r.id)}>Скасувати</button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function AdminRights() {
  const people = OFFICE;
  const [caps, setCaps] = useState(null);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      const out = {};
      for (const p of people) out[p.key] = await getCapabilities(p.key);
      if (active) setCaps(out);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggle = async (personKey, capKey) => {
    const cur = caps[personKey] || [];
    const next = cur.includes(capKey) ? cur.filter((c) => c !== capKey) : [...cur, capKey];
    setCaps((c) => ({ ...c, [personKey]: next }));
    await setCapabilities(personKey, next);
    setSaved(personKey + capKey);
    setTimeout(() => setSaved(""), 1200);
  };
  return (
    <div className="admin-panel">
      <h3>Права користувачів</h3>
      <p className="hint">Надання додаткових можливостей співробітникам офісу. Модулі зʼявляються в їхньому кабінеті.</p>
      {caps === null ? <div className="loading">Завантаження…</div> : (
        <div className="admin-rights">
          {people.map((p) => (
            <div className="admin-rights-person" key={p.key}>
              <div className="admin-rights-name">{p.name}</div>
              <div className="admin-rights-caps">
                {CAPABILITIES.map((c) => (
                  <label className="admin-cap" key={c.key}>
                    <input type="checkbox" checked={(caps[p.key] || []).includes(c.key)}
                      onChange={() => toggle(p.key, c.key)} />
                    <span>{c.label}{saved === p.key + c.key ? " ✓" : ""}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminLog() {
  const [log, setLog] = useState(null);
  useEffect(() => { let a = true; listLog().then((l) => { if (a) setLog(l); }); return () => { a = false; }; }, []);
  const label = {
    login_master: "вхід за майстер-кодом", recovery_request: "запит відновлення", recovery_done: "змінено пароль",
    reassign: "перепризначено магазин", caps: "змінено права",
  };
  return (
    <div className="admin-panel">
      <h3>Журнал дій</h3>
      {log === null ? <div className="loading">Завантаження…</div>
        : log.length === 0 ? <div className="admin-empty">Журнал порожній.</div>
        : (
          <div className="admin-logrows">
            {log.map((e, i) => (
              <div className="admin-logrow" key={i}>
                <span className="admin-log-time">{fmtDate(e.at)}</span>
                <span className="admin-log-act">{label[e.action] || e.action}</span>
                <span className="admin-log-detail">{e.detail?.cabKey ? cabName(e.detail.cabKey) : e.detail?.salonKey ? salonLabel(salonByKey(e.detail.salonKey)) : ""}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function AdminMaintenance() {
  const [flag, setFlag] = useState(null);   // { on, message, since }
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let a = true;
    getMaintenance().then((f) => { if (a) { setFlag(f || { on: false }); setMsg(f?.message || ""); } });
    return subscribeFlags(() => getMaintenance().then((f) => { if (a && f) setFlag(f); }));
  }, []);
  if (!flag) return <div className="loading">Завантаження…</div>;

  const toggle = async (on) => {
    setBusy(true);
    try { await setMaintenance(on, msg, "andriy"); setFlag((f) => ({ ...f, on, message: msg, since: on ? new Date().toISOString() : null })); }
    catch (e) { alert(e.message || e); }
    finally { setBusy(false); }
  };
  const saveMsg = async () => {
    if (!flag.on) return;
    setBusy(true);
    try { await setMaintenance(true, msg, "andriy"); pushToast({ title: "Текст оновлено" }); }
    catch (e) { alert(e.message || e); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-panel">
      <h3>Технічна перерва</h3>
      <p className="hint" style={{ marginBottom: 14 }}>
        Коли увімкнено — усі, крім вас, бачать вікно «Тривають технічні роботи» і не можуть користуватися застосунком.
        Ви працюєте як зазвичай.
      </p>
      <label className={`maint-toggle ${flag.on ? "on" : ""}`}>
        <input type="checkbox" checked={!!flag.on} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        <span className="maint-switch" />
        <span className="maint-label">
          {flag.on ? "Технічну перерву УВІМКНЕНО" : "Технічну перерву вимкнено"}
          {flag.on && flag.since && <em> · з {fmtDate(flag.since)}</em>}
        </span>
      </label>
      <label className="over-field" style={{ maxWidth: "100%", marginTop: 14 }}>
        <span>Повідомлення для користувачів (необовʼязково)</span>
        <textarea
          rows={2} value={msg} placeholder="напр. Оновлюємо розрахунок ЗП, повернемось за 15 хв"
          onChange={(e) => setMsg(e.target.value)}
        />
      </label>
      {flag.on && (
        <button className="btn-secondary small" style={{ marginTop: 8 }} onClick={saveMsg} disabled={busy}>
          Оновити текст
        </button>
      )}
    </div>
  );
}

function FeedbackItem({ r, onPreview, onReload }) {
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setBusy(true);
    try {
      await resolveFeedback(r, comment);
      pushToast({ title: "Звернення опрацьовано", body: r.from_cabinet ? `Сповіщення надіслано: ${cabName(r.from_cabinet)}` : "" });
      onReload();
    } catch (e) { alert(e.message || e); setBusy(false); }
  };

  return (
    <div className={`fb-item ${r.status}`}>
      <div className="fb-item-top">
        <span className={`fb-tag ${r.kind}`}>{r.kind === "proposal" ? "Пропозиція" : "Проблема"}</span>
        <span className="fb-from">{cabName(r.from_cabinet) || r.from_cabinet || "—"}</span>
        <span className="fb-time">{fmtDate(r.created_at)}</span>
      </div>
      <p className="fb-body">{r.body}</p>
      {r.screenshot && (
        <button className="fb-thumb" onClick={() => onPreview(r.screenshot)}>
          <img src={r.screenshot} alt="скрін" />
        </button>
      )}
      {r.status === "done" && r.admin_comment && (
        <div className="fb-reply"><b>Відповідь:</b> {r.admin_comment}</div>
      )}

      <div className="fb-actions">
        {r.status === "new" ? (
          open ? (
            <button className="btn-secondary small" onClick={() => setOpen(false)}>Згорнути</button>
          ) : (
            <button className="btn-primary small" onClick={() => setOpen(true)}>
              <Check size={13} /> Опрацювати
            </button>
          )
        ) : (
          <button className="btn-secondary small" onClick={() => setFeedbackStatus(r.id, "new").then(onReload)}>Повернути в нові</button>
        )}
        <button className="fb-del" onClick={() => { if (confirm("Видалити звернення?")) deleteFeedback(r.id).then(onReload); }}>
          <Trash2 size={13} />
        </button>
      </div>

      {open && r.status === "new" && (
        <div className="fb-resolve">
          <textarea
            rows={2} value={comment} autoFocus
            placeholder="Коментар для автора (необовʼязково): що виправлено / рішення по пропозиції…"
            onChange={(e) => setComment(e.target.value)}
          />
          <button className="btn-primary small" onClick={resolve} disabled={busy}>
            <Send size={13} /> {busy ? "…" : (r.from_cabinet ? "Опрацювати й повідомити автора" : "Позначити опрацьованим")}
          </button>
        </div>
      )}
    </div>
  );
}

function AdminFeedback() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("new");
  const [preview, setPreview] = useState(null);
  const reload = () => listFeedback().then(setRows).catch(() => setRows([]));
  useEffect(() => { reload(); return subscribeFeedback(reload); }, []);
  if (rows === null) return <div className="loading">Завантаження…</div>;

  const shown = rows.filter((r) => (filter === "new" ? r.status === "new" : filter === "all" ? true : r.status === filter));
  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <div className="admin-panel">
      <h3>Звернення {newCount > 0 && <span className="badge badge-warn">{newCount} нових</span>}</h3>
      <div className="fb-filter">
        {[["new", "Нові"], ["done", "Опрацьовані"], ["all", "Усі"]].map(([k, l]) => (
          <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {shown.length === 0 ? <div className="admin-empty">Немає звернень.</div> : (
        <div className="fb-list">
          {shown.map((r) => (
            <FeedbackItem key={r.id} r={r} onPreview={setPreview} onReload={reload} />
          ))}
        </div>
      )}
      {preview && <ImageModal src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function AdminPanel() {
  const [tab, setTab] = useState("recovery");
  const tabs = [
    ["recovery", "Відновлення паролю"],
    ["access", "Доступи"],
    ["reassign", "Магазини й ТМ"],
    ["rights", "Права"],
    ["feedback", "Звернення"],
    ["maint", "Технічна перерва"],
    ["log", "Журнал"],
  ];
  return (
    <div className="embedded">
      <div className="admin-subnav">
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "recovery" && <AdminRecovery />}
      {tab === "access" && <AdminAccess />}
      {tab === "reassign" && <AdminReassign />}
      {tab === "rights" && <AdminRights />}
      {tab === "feedback" && <AdminFeedback />}
      {tab === "maint" && <AdminMaintenance />}
      {tab === "log" && <AdminLog />}
    </div>
  );
}

/* =========================================================
   КАБІНЕТИ — оболонка з лівою панеллю модулів
========================================================= */
function ModuleStub({ name, note }) {
  return (
    <div className="office-stub">
      <span className="office-stub-ic"><Clock size={26} /></span>
      <h3>{name}</h3>
      <p>{note || "Модуль у розробці — зʼявиться найближчим часом."}</p>
    </div>
  );
}

/* =========================================================
   МОДУЛЬ «ЗАДАЧІ»
========================================================= */
const taskDue = (t) => t.due_at || t.due_date || null;
const isOverdue = (t) => {
  const d = taskDue(t);
  return d && t.status !== "done" && new Date(d.length <= 10 ? `${d}T23:59` : d) < new Date();
};

function useMyTasks() {
  const [tasks, setTasks] = useState(null);
  const reload = () => listTasks().then(setTasks).catch(() => setTasks([]));
  useEffect(() => {
    reload();
    const unsub = subscribeTasks(() => reload());
    return unsub;
  }, []);
  return [tasks, reload];
}

/* стан індикатора-кружечка праворуч на картці */
function dotState(t) {
  if (t.status === "done") return "dot-done";                 // суцільний зелений
  const seenByAssignee = !!(t.seen || {})[t.assignee];
  if (!seenByAssignee) return "dot-unseen";                   // червоний — не переглянуто
  if (t.status === "in_progress") return "dot-progress";      // блимає — в роботі
  return "dot-open";                                          // сірий — очікує
}
const dotTitle = {
  "dot-done": "Виконано",
  "dot-unseen": "Виконавець ще не переглянув",
  "dot-progress": "В роботі",
  "dot-open": "Очікує",
};

function TaskCard({ t, cabKey, onStatus, onDelete }) {
  const mine = t.assignee === cabKey;
  const owner = t.created_by === cabKey;
  const [open, setOpen] = useState(false);
  const [doneMode, setDoneMode] = useState(false);
  const [comment, setComment] = useState("");
  const ds = dotState(t);

  const finish = async () => {
    await onStatus(t.id, "done", comment.trim() || undefined);
    setDoneMode(false); setComment("");
  };

  return (
    <div className={`task-card ${isOverdue(t) ? "task-overdue" : ""} ${t.status === "done" ? "task-card-done" : ""} ${open ? "task-card-open" : ""}`}>
      <button className="task-card-main" onClick={() => setOpen((v) => !v)}>
        {t.priority && <Star size={13} className="task-star" fill="currentColor" />}
        <span className="task-title">{t.title}</span>
        <span className="task-card-sub">
          {mine ? `від ${cabName(t.created_by)}` : `кому ${cabName(t.assignee)}`}
          {taskDue(t) && <> · <span className={isOverdue(t) ? "task-due-over" : ""}>до {fmtDeadline(taskDue(t))}</span></>}
        </span>
        <span className={`task-dot ${ds}`} title={dotTitle[ds]} />
      </button>

      {open && (
        <div className="task-card-detail">
          {t.description && <p className="task-desc">{t.description}</p>}
          <div className="task-meta">
            <span>Кому: <b>{cabName(t.assignee)}</b></span>
            <span>Від: {cabName(t.created_by)}</span>
            <span className={`task-dot-legend ${ds}`}>{dotTitle[ds]}</span>
          </div>
          {t.comment && <p className="task-comment">💬 {t.comment}</p>}

          {doneMode ? (
            <div className="task-done-form">
              <textarea rows={2} placeholder="Коментар до виконання (необовʼязково)"
                value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="task-actions">
                <button className="btn-primary small" onClick={finish}>Підтвердити</button>
                <button className="btn-secondary small" onClick={() => setDoneMode(false)}>Скасувати</button>
              </div>
            </div>
          ) : (
            <div className="task-actions">
              {mine && t.status === "open" && (
                <button className="btn-secondary small" onClick={() => onStatus(t.id, "in_progress")}>Взяти в роботу</button>
              )}
              {mine && t.status !== "done" && (
                <button className="btn-primary small" onClick={() => setDoneMode(true)}>Виконано</button>
              )}
              {(owner || mine) && t.status === "done" && (
                <button className="btn-secondary small" onClick={() => onStatus(t.id, "open")}>Повернути</button>
              )}
              {owner && (
                <button className="btn-danger small" onClick={() => { if (confirm("Видалити задачу?")) onDelete(t.id); }}>
                  <Trash2 size={13} /> Видалити
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ієрархічний вибір «кому» через галочки */
const TIER_LABEL = { head: "Керівництво", tm: "Територіальні менеджери", sm: "Салони", office: "Офіс" };
function AssigneePicker({ cab, selected, setSelected }) {
  const allowed = useMemo(
    () => PARTICIPANTS.filter((p) => p.key !== cab.key && canAssign(cab.type, cab.key, p.key)),
    [cab],
  );
  const allowSelf = canAssign(cab.type, cab.key, cab.key);
  const rows = allowSelf
    ? [{ key: cab.key, label: "Собі", tier: "self" }, ...allowed]
    : allowed;

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  const groupKeys = (tier) => rows.filter((r) => r.tier === tier).map((r) => r.key);
  const setGroup = (tier, on) => {
    const g = groupKeys(tier);
    setSelected((s) => (on ? [...new Set([...s, ...g])] : s.filter((k) => !g.includes(k))));
  };
  const allKeys = rows.map((r) => r.key);
  const allOn = allKeys.length > 0 && allKeys.every((k) => selected.includes(k));

  const tiers = ["self", "head", "tm", "sm", "office"].filter((tr) => rows.some((r) => r.tier === tr));

  return (
    <div className="assignee-picker">
      <label className="assignee-all">
        <input type="checkbox" checked={allOn}
          onChange={(e) => setSelected(e.target.checked ? allKeys : [])} />
        <b>Поставити для всіх</b>
      </label>
      {tiers.map((tier) => {
        const g = groupKeys(tier);
        const gOn = g.length > 0 && g.every((k) => selected.includes(k));
        return (
          <div className="assignee-group" key={tier}>
            {tier !== "self" && (
              <label className="assignee-group-head">
                <input type="checkbox" checked={gOn} onChange={(e) => setGroup(tier, e.target.checked)} />
                <span>{TIER_LABEL[tier]}</span>
              </label>
            )}
            {rows.filter((r) => r.tier === tier).map((r) => (
              <label className="assignee-row" key={r.key}>
                <input type="checkbox" checked={selected.includes(r.key)} onChange={() => toggle(r.key)} />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* Сучасний вибір дати+часу — власний календар, однаковий у всіх кабінетах.
   value: ISO-таймстамп або ""; onChange(iso|""). */
function DateTimeField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0 });
  const btnRef = React.useRef(null);
  const sel = value ? new Date(value) : null;
  const [view, setView] = useState(() => {
    const b = sel || new Date();
    return new Date(b.getFullYear(), b.getMonth(), 1);
  });
  const h = sel ? sel.getHours() : 18;
  const m = sel ? sel.getMinutes() : 0;

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const flip = r.bottom + 350 > window.innerHeight;
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 296)),
      top: flip ? undefined : r.bottom + 6,
      bottom: flip ? window.innerHeight - r.top + 6 : undefined,
    });
    setView(new Date((sel || new Date()).getFullYear(), (sel || new Date()).getMonth(), 1));
    setOpen(true);
  };
  const emit = (y, mo, d, hh, mm) => onChange(new Date(y, mo, d, hh, mm, 0, 0).toISOString());
  const pickDay = (d) => emit(view.getFullYear(), view.getMonth(), d, h, m);
  const pickTime = (hh, mm) => {
    const base = sel || new Date();
    emit(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm);
  };
  const quick = (addDays, hh) => { const d = new Date(); d.setDate(d.getDate() + addDays); emit(d.getFullYear(), d.getMonth(), d.getDate(), hh, 0); setOpen(false); };

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const now = new Date();
  const sameMonth = (dt) => dt && dt.getFullYear() === view.getFullYear() && dt.getMonth() === view.getMonth();

  return (
    <div className="dtf">
      <button type="button" ref={btnRef} className={`dtf-trigger ${value ? "has" : ""}`} onClick={toggle}>
        <Calendar size={14} />
        <span>{value ? fmtDeadline(value) : "Без дедлайну"}</span>
        {value && <span className="dtf-clear" onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}><X size={13} /></span>}
      </button>
      {open && createPortal(
        <>
          <div className="dtf-backdrop" onClick={() => setOpen(false)} />
          <div className="dtf-pop" style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}>
            <div className="dtf-quick">
              <button type="button" onClick={() => quick(0, 18)}>Сьогодні</button>
              <button type="button" onClick={() => quick(1, 10)}>Завтра</button>
              <button type="button" onClick={() => quick(7, 10)}>+7 днів</button>
            </div>
            <div className="dtf-calhead">
              <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
              <span>{MONTH_NAMES[view.getMonth()]} {view.getFullYear()}</span>
              <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
            </div>
            <div className="dtf-grid">
              {WEEKDAYS_SHORT.map((w) => <span key={w} className="dtf-wd">{w}</span>)}
              {cells.map((d, i) => d == null ? <span key={i} /> : (
                <button type="button" key={i}
                  className={`dtf-day ${sameMonth(sel) && sel.getDate() === d ? "sel" : ""} ${now.getFullYear() === view.getFullYear() && now.getMonth() === view.getMonth() && now.getDate() === d ? "today" : ""}`}
                  onClick={() => pickDay(d)}>{d}</button>
              ))}
            </div>
            <div className="dtf-time">
              <Clock size={13} />
              <select value={h} onChange={(e) => pickTime(Number(e.target.value), m)}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad2(i)}</option>)}
              </select>
              <span>:</span>
              <select value={m} onChange={(e) => pickTime(h, Number(e.target.value))}>
                {[0, 15, 30, 45].map((mm) => <option key={mm} value={mm}>{pad2(mm)}</option>)}
              </select>
              <button type="button" className="dtf-ok" onClick={() => setOpen(false)}>Готово</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function TaskCreateModal({ cab, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!title.trim() || selected.length === 0) return;
    setBusy(true); setErr("");
    try {
      await createTasks({
        title, description: desc, assignees: selected,
        due_at: due, priority, created_by: cab.key,
      });
      pushToast({
        title: selected.length === 1 ? `Задачу призначено: ${cabName(selected[0])}` : `Задачу призначено (${selected.length})`,
        body: title.trim(),
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e.message || "Не вдалося створити задачу");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Нова задача</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <input className="task-input" placeholder="Що потрібно зробити" value={title}
            onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea className="task-input" rows={3} placeholder="Деталі (необовʼязково)"
            value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="task-modal-row">
            <label className="over-field"><span>Дедлайн</span>
              <DateTimeField value={due} onChange={setDue} />
            </label>
            <label className="task-priority-toggle">
              <input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} />
              <Star size={14} /> Пріоритетна
            </label>
          </div>
          <div className="task-modal-label">Кому поставити</div>
          <AssigneePicker cab={cab} selected={selected} setSelected={setSelected} />
          {err && <p className="form-err">{err}</p>}
        </div>
        <div className="modal-foot">
          <span className="task-modal-count">{selected.length ? `Обрано: ${selected.length}` : "Нікого не обрано"}</span>
          <button className="btn-primary" onClick={submit} disabled={busy || !title.trim() || !selected.length}>
            {busy ? "…" : "Поставити задачу"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TasksModule({ cab }) {
  const [tasks, reload] = useMyTasks();
  const [showModal, setShowModal] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [onlyPriority, setOnlyPriority] = useState(false);

  useEffect(() => {
    if (tasks && tasks.length) markSeen(tasks, cab.key).catch(() => {});
  }, [tasks, cab.key]);

  const onStatus = async (id, s, comment) => {
    const t = tasks?.find((x) => x.id === id);
    await setTaskStatus(id, s, comment);
    const msg = s === "in_progress" ? "Взято в роботу" : s === "done" ? "Задачу виконано" : "Задачу повернено";
    pushToast({ title: msg, body: t?.title });
    reload();
  };
  const onDelete = async (id) => {
    try { await deleteTask(id); reload(); }
    catch (e) { alert("Не вдалося видалити: " + (e.message || e)); }
  };

  if (tasks === null) return <div className="loading">Завантаження…</div>;

  const visible = onlyPriority ? tasks.filter((t) => t.priority) : tasks;
  const active = visible.filter((t) => t.status !== "done");
  const done = visible.filter((t) => t.status === "done");

  const inWork = tasks.filter((t) => t.status === "in_progress").length;
  const unfinished = tasks.filter((t) => t.status !== "done").length;
  const unseen = tasks.filter((t) => t.assignee === cab.key && t.status !== "done" && !(t.seen || {})[cab.key]).length;

  return (
    <div className="tasks-mod">
      <div className="tasks-head">
        <h3 className="ov-h">Задачі</h3>
        <button className="btn-primary small" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Нова задача
        </button>
      </div>

      <div className="tasks-dash">
        <span><b>{inWork}</b> в роботі</span>
        <span><b>{unfinished}</b> невиконані</span>
        {unseen > 0 && <span className="tasks-dash-alert"><b>{unseen}</b> нових для вас</span>}
        <button className={`tasks-filter ${onlyPriority ? "on" : ""}`} onClick={() => setOnlyPriority((v) => !v)}>
          <Star size={13} /> Тільки пріоритетні
        </button>
      </div>

      {active.length === 0 ? (
        <div className="admin-empty">{onlyPriority ? "Пріоритетних задач немає." : "Активних задач немає."}</div>
      ) : (
        <div className="task-list">
          {active.map((t) => <TaskCard key={t.id} t={t} cabKey={cab.key} onStatus={onStatus} onDelete={onDelete} />)}
        </div>
      )}

      {done.length > 0 && (
        <>
          <button className="task-done-toggle" onClick={() => setShowDone((v) => !v)}>
            Виконані ({done.length}) {showDone ? "▾" : "▸"}
          </button>
          {showDone && (
            <div className="task-list">
              {done.map((t) => <TaskCard key={t.id} t={t} cabKey={cab.key} onStatus={onStatus} onDelete={onDelete} />)}
            </div>
          )}
        </>
      )}

      {showModal && <TaskCreateModal cab={cab} onClose={() => setShowModal(false)} onCreated={reload} />}
    </div>
  );
}

/* =========================================================
   МОДУЛЬ «БЕЗНАЛЬНІ РАХУНКИ»
========================================================= */
const invMoney = (n) => (Number(n) || 0).toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " грн";
const INV_TONE = { issued: "badge-warn", paid: "badge-ok", shipped: "badge-ok", documented: "badge-ok", cancelled: "badge-off" };

function useInvoices() {
  const [rows, setRows] = useState(null);
  const reload = () => listInvoices().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
    const unsub = subscribeInvoices(() => reload());
    return unsub;
  }, []);
  return [rows, reload];
}

function InvoicePasteZone({ onImage, busy, compact }) {
  const inputRef = React.useRef(null);
  const take = async (file) => {
    if (!file || !file.type?.startsWith("image/")) return;
    const url = await resizeImage(file);
    onImage(url);
  };
  useEffect(() => {
    const onPaste = (e) => {
      for (const it of e.clipboardData?.items || []) {
        if (it.type?.startsWith("image/")) { e.preventDefault(); take(it.getAsFile()); return; }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button type="button" className={`inv-paste ${compact ? "compact" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files?.[0]); }}
      onDragOver={(e) => e.preventDefault()}>
      {busy ? <span>Обробка…</span> : (
        <>
          <Camera size={compact ? 16 : 22} />
          <b>{compact ? "Замінити скрін" : "Вставте скрін з 1С — Ctrl+V (⌘V)"}</b>
          {!compact && <span>або перетягніть / натисніть, щоб вибрати файл</span>}
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
    </button>
  );
}

function InvoiceCreateModal({ cab, onClose, onCreated }) {
  const [shot, setShot] = useState("");
  const [counterparty, setCounterparty] = useState(""); // Покупець (клієнт)
  const [issuer, setIssuer] = useState("");             // Постачальник (Будвік / ФОП)
  const [vat, setVat] = useState(false);
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState(0);
  const [invNo, setInvNo] = useState("");
  const [comment, setComment] = useState("");
  const [ai, setAi] = useState("");        // "" | "run" | "ok" | "fail"
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onImage = async (url) => {
    setShot(url); setAi("run"); setErr("");
    try {
      const r = await extractInvoice(url);
      setCounterparty((c) => c || r.buyer || "");
      setIssuer((i) => i || r.issuer || "");
      setAmount((a) => a || r.amount || 0);
      setInvNo((n) => n || r.invoice_no || "");
      setVat(deriveVat(r.issuer, r.vat));
      if (Array.isArray(r.items) && r.items.length) setItems(r.items);
      setAi(r.buyer || r.amount ? "ok" : "fail");
    } catch { setAi("fail"); }
  };

  const submit = async () => {
    if (!shot || (!amount && !counterparty.trim())) return;
    setBusy(true); setErr("");
    try {
      await createInvoice({ counterparty, issuer, vat, items, amount, invoice_no: invNo, screenshot: shot, comment, created_by: cab.key });
      pushToast({ title: "Рахунок виставлено", body: `${counterparty || "рахунок"} · ${invMoney(amount)}` });
      onCreated(); onClose();
    } catch (e) { setErr(e.message || "Не вдалося зберегти"); setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Новий безнальний рахунок</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {!shot ? (
            <InvoicePasteZone onImage={onImage} busy={ai === "run"} />
          ) : (
            <div className="inv-shot-preview">
              <img src={shot} alt="скрін рахунку" />
              <InvoicePasteZone onImage={onImage} busy={ai === "run"} compact />
            </div>
          )}
          {ai === "run" && <p className="inv-ai inv-ai-run"><Sparkles size={13} /> Розпізнаю рахунок…</p>}
          {ai === "ok" && <p className="inv-ai inv-ai-ok"><Sparkles size={13} /> Розпізнано — перевірте поля</p>}
          {ai === "fail" && <p className="inv-ai inv-ai-fail"><Sparkles size={13} /> Не вдалося розпізнати — заповніть вручну</p>}

          <label className="over-field"><span>Покупець (клієнт)</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Кому виставлено рахунок" />
          </label>
          <div className="task-modal-row">
            <label className="over-field"><span>Виставлено від</span>
              <input value={issuer} onChange={(e) => { setIssuer(e.target.value); setVat(deriveVat(e.target.value, vat)); }} placeholder="ТОВ Будвік / ФОП" />
            </label>
            <label className="task-priority-toggle">
              <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} />
              {vat ? "з ПДВ" : "без ПДВ"}
            </label>
          </div>
          <div className="task-modal-row">
            <label className="over-field"><span>Сума</span>
              <NumInput value={amount} onChange={setAmount} placeholder="0.00" />
            </label>
            <label className="over-field"><span>№ рахунку</span>
              <input value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="—" />
            </label>
          </div>

          {items.length > 0 && (
            <div className="inv-items">
              <div className="inv-items-head">
                <span>Позиції ({items.length})</span>
                <button type="button" className="inv-items-clear" onClick={() => setItems([])}>прибрати</button>
              </div>
              <div className="inv-items-list">
                {items.map((it, i) => (
                  <div className="inv-item-row" key={i}>
                    <span className="inv-item-code">{it.code || "—"}</span>
                    <span className="inv-item-name">{it.name}</span>
                    <span className="inv-item-qty">{it.qty || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="over-field"><span>Коментар (необовʼязково)</span>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          {err && <p className="form-err">{err}</p>}
        </div>
        <div className="modal-foot">
          <span className="task-modal-count">{shot ? "Скрін додано" : "Додайте скрін рахунку"}</span>
          <button className="btn-primary" onClick={submit} disabled={busy || !shot || (!amount && !counterparty.trim())}>
            {busy ? "…" : "Виставити рахунок"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InvoiceCard({ inv, cab, canManage, onPreview, onChanged }) {
  const [open, setOpen] = useState(false);
  const [cmt, setCmt] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = inv.created_by === cab.key;
  const nx = nextStatus(inv.status);
  const prevIdx = INVOICE_FLOW.indexOf(inv.status) - 1;
  const prev = prevIdx >= 0 ? INVOICE_FLOW[prevIdx] : null;
  const active = inv.status !== "cancelled" && inv.status !== "documented";

  const move = async (st, note) => {
    setBusy(true);
    try { await setInvoiceStatus(inv, st, cab.key, note); onChanged(); }
    catch (e) { alert("Не вдалося: " + (e.message || e)); }
    setBusy(false); setCmt("");
  };
  const addComment = async () => {
    if (!cmt.trim()) return;
    setBusy(true);
    try { await updateInvoice(inv.id, { comment: cmt.trim(), history: [...(inv.history || []), { status: inv.status, at: new Date().toISOString(), by: cab.key, note: cmt.trim() }] }); onChanged(); setCmt(""); }
    catch (e) { alert(e.message || e); }
    setBusy(false);
  };

  return (
    <div className={`inv-card ${inv.status === "cancelled" ? "inv-cancelled" : ""} ${open ? "inv-open" : ""}`}>
      <div className="inv-card-main">
        <button className="inv-card-expand" onClick={() => setOpen((v) => !v)}>
          <span className={`inv-dot inv-${inv.status}`} />
          <span className="inv-cp-wrap">
            <span className="inv-cp">{inv.counterparty || "рахунок без назви"}</span>
            {inv.issuer && <span className="inv-issuer">від {inv.issuer}</span>}
          </span>
          <span className={`inv-vat ${inv.vat ? "on" : ""}`}>{inv.vat ? "з ПДВ" : "без ПДВ"}</span>
          <span className="inv-amount">{invMoney(inv.amount)}</span>
          <span className={`badge ${INV_TONE[inv.status]} inv-badge`}>{INVOICE_STATUS[inv.status]}</span>
        </button>
        {inv.screenshot && (
          <button className="inv-shot-btn" title="Відкрити скрін рахунку" onClick={() => onPreview(inv.screenshot)}>
            <ImageIcon size={15} />
          </button>
        )}
      </div>
      {open && (
        <div className="inv-detail">
          <div className="inv-meta">
            {inv.created_by !== cab.key && <span>Салон: <b>{cabName(inv.created_by)}</b></span>}
            {inv.invoice_no && <span>№ {inv.invoice_no}</span>}
            <span>{fmtDeadline(inv.created_at)}</span>
          </div>

          {(inv.items || []).length > 0 && (
            <div className="inv-items-view">
              <div className="inv-item-row inv-item-hd"><span>Код</span><span>Найменування</span><span>К-сть</span></div>
              {inv.items.map((it, i) => (
                <div className="inv-item-row" key={i}>
                  <span className="inv-item-code">{it.code || "—"}</span>
                  <span className="inv-item-name">{it.name}</span>
                  <span className="inv-item-qty">{it.qty || ""}</span>
                </div>
              ))}
            </div>
          )}

          {inv.screenshot && (
            <button className="inv-thumb-btn" onClick={() => onPreview(inv.screenshot)}>
              <img className="inv-thumb" src={inv.screenshot} alt="скрін рахунку" />
              <span className="inv-thumb-hint"><ImageIcon size={13} /> Відкрити рахунок</span>
            </button>
          )}
          {inv.comment && <p className="task-comment">💬 {inv.comment}</p>}

          {(inv.history || []).length > 1 && (
            <div className="inv-history">
              {inv.history.map((h, i) => (
                <div key={i} className="inv-hist-row">
                  <span className="inv-hist-st">{INVOICE_STATUS[h.status] || h.status}</span>
                  <span>{cabName(h.by)}</span>
                  <span className="inv-hist-at">{fmtDeadline(h.at)}</span>
                  {h.note && <span className="inv-hist-note">— {h.note}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="inv-actions">
            {canManage && nx && (
              <button className="btn-primary small" disabled={busy} onClick={() => move(nx)}>
                Позначити: {INVOICE_STATUS[nx]}
              </button>
            )}
            {canManage && prev && active && (
              <button className="btn-secondary small" disabled={busy} onClick={() => move(prev)}>↩ {INVOICE_STATUS[prev]}</button>
            )}
            {(canManage || (owner && inv.status === "issued")) && inv.status !== "cancelled" && (
              <button className="btn-secondary small" disabled={busy} onClick={() => move("cancelled")}>Скасувати</button>
            )}
            {owner && inv.status === "issued" && (
              <button className="btn-danger small" disabled={busy} onClick={() => { if (confirm("Видалити рахунок?")) deleteInvoice(inv.id).then(onChanged); }}>
                <Trash2 size={13} /> Видалити
              </button>
            )}
          </div>

          <div className="inv-comment-add">
            <input placeholder="Додати коментар…" value={cmt} onChange={(e) => setCmt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} />
            <button className="btn-secondary small" disabled={busy || !cmt.trim()} onClick={addComment}>Додати</button>
          </div>
        </div>
      )}
    </div>
  );
}

const invMonth = (inv) => (inv.created_at || "").slice(0, 7);
const CHART_COLORS = { issued: "#DCA94A", paid: "#7896c8", shipped: "#7FBF8F", documented: "#3C6B49" };

function InvoiceAnalytics({ rows, cab }) {
  const [period, setPeriod] = useState("6m");   // 3m | 6m | 12m | all
  const [statusF, setStatusF] = useState("all");
  const [vatF, setVatF] = useState("all");      // all | vat | novat
  const [salonF, setSalonF] = useState("all");

  const multiSalon = cab.type !== "sm";
  const salonKeys = useMemo(() => [...new Set(rows.map((r) => r.created_by))].sort(), [rows]);

  const now = new Date();
  const back = { "3m": 2, "6m": 5, "12m": 11 }[period];
  const cutoff = period === "all" ? "0000-00" : `${new Date(now.getFullYear(), now.getMonth() - back, 1).getFullYear()}-${pad2(new Date(now.getFullYear(), now.getMonth() - back, 1).getMonth() + 1)}`;

  const filtered = rows.filter((r) => {
    if (r.status === "cancelled") return false;
    if (invMonth(r) < cutoff) return false;
    if (statusF !== "all" && r.status !== statusF) return false;
    if (vatF === "vat" && !r.vat) return false;
    if (vatF === "novat" && r.vat) return false;
    if (salonF !== "all" && r.created_by !== salonF) return false;
    return true;
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  const vatSum = filtered.filter((r) => r.vat).reduce((s, r) => s + Number(r.amount || 0), 0);
  const count = filtered.length;

  const byMonth = {};
  filtered.forEach((r) => {
    const m = invMonth(r);
    byMonth[m] = byMonth[m] || { m, issued: 0, paid: 0, shipped: 0, documented: 0 };
    byMonth[m][r.status] += Number(r.amount || 0);
  });
  const chartData = Object.values(byMonth).sort((a, b) => (a.m < b.m ? -1 : 1))
    .map((d) => ({ ...d, label: monthLabel(d.m).replace(/ 20\d\d/, "") }));

  return (
    <div className="inv-analytics">
      <div className="inv-anl-filters">
        <label>Період
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="3m">3 місяці</option><option value="6m">6 місяців</option>
            <option value="12m">рік</option><option value="all">увесь час</option>
          </select>
        </label>
        <label>Статус
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="all">усі</option>
            {INVOICE_FLOW.map((s) => <option key={s} value={s}>{INVOICE_STATUS[s]}</option>)}
          </select>
        </label>
        <label>ПДВ
          <select value={vatF} onChange={(e) => setVatF(e.target.value)}>
            <option value="all">усі</option><option value="vat">з ПДВ</option><option value="novat">без ПДВ</option>
          </select>
        </label>
        {multiSalon && (
          <label>Салон
            <select value={salonF} onChange={(e) => setSalonF(e.target.value)}>
              <option value="all">усі</option>
              {salonKeys.map((k) => <option key={k} value={k}>{cabName(k)}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="ov-tiles">
        <div className="ov-tile"><b>{invMoney(total)}</b><span>сума за період</span></div>
        <div className="ov-tile"><b>{count}</b><span>рахунків</span></div>
        <div className="ov-tile"><b>{invMoney(vatSum)}</b><span>з них з ПДВ</span></div>
        <div className="ov-tile"><b>{invMoney(count ? total / count : 0)}</b><span>середній рахунок</span></div>
      </div>

      {chartData.length === 0 ? (
        <div className="admin-empty">Немає даних за обраними фільтрами.</div>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="2 5" stroke="#D9D2BE" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A8069" }} tickLine={false} axisLine={{ stroke: "#D9D2BE" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8069" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v, n) => [invMoney(v), INVOICE_STATUS[n] || n]} />
              <Legend formatter={(v) => INVOICE_STATUS[v] || v} wrapperStyle={{ fontSize: 11 }} />
              {INVOICE_FLOW.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={CHART_COLORS[s]} radius={s === "documented" ? [3, 3, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function InvoicesModule({ cab }) {
  const [rows, reload] = useInvoices();
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState("list");     // list | analytics
  const [filter, setFilter] = useState("open"); // open | archive | all | <status>
  const [sort, setSort] = useState("date_desc");
  const [salonF, setSalonF] = useState("all");
  const [preview, setPreview] = useState(null);

  const canCreate = cab.type === "sm";
  const canManage = cab.type === "accountant" || cab.type === "manager" || cab.type === "tm";
  const multiSalon = cab.type !== "sm";

  if (rows === null) return <div className="loading">Завантаження…</div>;

  const salonKeys = [...new Set(rows.map((r) => r.created_by))].sort();
  const counts = INVOICE_FLOW.reduce((a, s) => ({ ...a, [s]: rows.filter((r) => r.status === s).length }), {});
  const archived = (r) => r.status === "documented" || r.status === "cancelled";

  let shown = rows.filter((r) => {
    if (salonF !== "all" && r.created_by !== salonF) return false;
    if (filter === "open") return !archived(r);
    if (filter === "archive") return archived(r);
    if (filter === "all") return true;
    return r.status === filter;
  });
  const cmp = {
    date_desc: (a, b) => (a.created_at < b.created_at ? 1 : -1),
    date_asc: (a, b) => (a.created_at < b.created_at ? -1 : 1),
    amount_desc: (a, b) => Number(b.amount) - Number(a.amount),
    status: (a, b) => INVOICE_FLOW.indexOf(a.status) - INVOICE_FLOW.indexOf(b.status),
    salon: (a, b) => cabName(a.created_by).localeCompare(cabName(b.created_by)),
  }[sort];
  shown = [...shown].sort(cmp);

  return (
    <div className="tasks-mod">
      <div className="tasks-head">
        <h3 className="ov-h">Безнальні рахунки</h3>
        {canCreate && (
          <button className="btn-primary small" onClick={() => setShowModal(true)}><Plus size={14} /> Новий рахунок</button>
        )}
      </div>

      <div className="inv-viewtabs">
        <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>Список</button>
        <button className={view === "analytics" ? "on" : ""} onClick={() => setView("analytics")}><BarChart3 size={13} /> Аналітика</button>
      </div>

      {view === "analytics" ? (
        <InvoiceAnalytics rows={rows} cab={cab} />
      ) : (
        <>
          <div className="tasks-dash">
            <span><b>{counts.issued || 0}</b> виставлено</span>
            <span><b>{counts.paid || 0}</b> оплачено</span>
            <span><b>{counts.shipped || 0}</b> відвантажено</span>
          </div>

          <div className="inv-toolbar">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date_desc">Спочатку нові</option>
              <option value="date_asc">Спочатку старі</option>
              <option value="amount_desc">За сумою</option>
              <option value="status">За статусом</option>
              {multiSalon && <option value="salon">За салоном</option>}
            </select>
            {multiSalon && (
              <select value={salonF} onChange={(e) => setSalonF(e.target.value)}>
                <option value="all">Усі салони</option>
                {salonKeys.map((k) => <option key={k} value={k}>{cabName(k)}</option>)}
              </select>
            )}
          </div>

          <div className="inv-filters">
            {[["open", "Активні"], ["all", "Усі"], ...INVOICE_FLOW.map((s) => [s, INVOICE_STATUS[s]]), ["archive", "Архів"]].map(([k, l]) => (
              <button key={k} className={`inv-fchip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="admin-empty">Рахунків немає.</div>
          ) : (
            <div className="task-list">
              {shown.map((inv) => (
                <InvoiceCard key={inv.id} inv={inv} cab={cab} canManage={canManage} onPreview={setPreview} onChanged={reload} />
              ))}
            </div>
          )}
        </>
      )}

      {showModal && <InvoiceCreateModal cab={cab} onClose={() => setShowModal(false)} onCreated={reload} />}
      {preview && <ImageModal src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* =========================================================
   МОДУЛЬ «КОМАНДА» (співробітники магазинів)
========================================================= */
function useEmployees() {
  const [rows, setRows] = useState(null);
  const reload = () => listEmployees().then(setRows).catch(() => setRows([]));
  useEffect(() => { reload(); return subscribeEmployees(() => reload()); }, []);
  return [rows, reload];
}

const empRoleTone = { manager: "badge-ok", acting_manager: "badge-warn", seller: "badge-off", intern: "badge-off" };
const fmtBday = (dob) => {
  if (!dob) return "—";
  const [, m, d] = dob.split("-").map(Number);
  return `${d} ${MON_SHORT[m - 1]}`;
};

function EmployeeForm({ cab, salons, emp, onClose, onSaved }) {
  const [salonKey, setSalonKey] = useState(emp?.salon_key || salons[0]?.key || "");
  const [name, setName] = useState(emp?.full_name || "");
  const [phone, setPhone] = useState(emp?.phone || "");
  const [dob, setDob] = useState(emp?.dob || "");
  const [hired, setHired] = useState(emp?.hired_at || "");
  const [role, setRole] = useState(emp?.role || "seller");
  const [note, setNote] = useState(emp?.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!name.trim() || !salonKey) return;
    setBusy(true); setErr("");
    try {
      if (emp) {
        await updateEmployee(emp, { salon_key: salonKey, full_name: name.trim(), phone: phone.trim(), dob: dob || null, hired_at: hired || null, role, note: note.trim() }, cab.key, "edit");
      } else {
        await createEmployee({ salon_key: salonKey, full_name: name, phone, dob, hired_at: hired, role, note, by: cab.key });
        pushToast({ title: "Прийнято на роботу", body: `${name.trim()} · ${cabName(salonKey)}` });
      }
      onSaved(); onClose();
    } catch (e) { setErr(e.message || "Не вдалося зберегти"); setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{emp ? "Редагувати співробітника" : "Прийняти на роботу"}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <label className="over-field"><span>ПІБ</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Прізвище Імʼя" />
          </label>
          <div className="task-modal-row">
            <label className="over-field"><span>Магазин</span>
              <select value={salonKey} onChange={(e) => setSalonKey(e.target.value)}>
                {salons.map((s) => <option key={s.key} value={s.key}>{salonLabel(s)}</option>)}
              </select>
            </label>
            <label className="over-field"><span>Посада</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {EMP_ROLE_ORDER.map((r) => <option key={r} value={r}>{EMP_ROLES[r]}</option>)}
              </select>
            </label>
          </div>
          <div className="task-modal-row">
            <label className="over-field"><span>Телефон</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380…" />
            </label>
            <label className="over-field"><span>День народження</span>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </label>
          </div>
          <label className="over-field"><span>Дата прийому</span>
            <input type="date" value={hired} onChange={(e) => setHired(e.target.value)} />
          </label>
          <label className="over-field"><span>Примітка</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {err && <p className="form-err">{err}</p>}
        </div>
        <div className="modal-foot">
          <span className="task-modal-count" />
          <button className="btn-primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "…" : emp ? "Зберегти" : "Прийняти"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FireModal({ emp, cab, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fire = async () => {
    setBusy(true);
    try { await fireEmployee(emp, reason, cab.key); pushToast({ title: "Співробітника звільнено", body: emp.full_name }); onDone(); onClose(); }
    catch (e) { alert(e.message || e); setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(420px,100%)" }}>
        <div className="modal-head"><h3>Звільнити: {emp.full_name}</h3><button className="modal-x" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">
          <label className="over-field"><span>Причина / коментар</span>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
          <p className="hint">Запис перейде в «Архів». Дані збережуться.</p>
        </div>
        <div className="modal-foot">
          <button className="btn-secondary" onClick={onClose}>Скасувати</button>
          <button className="btn-danger small" disabled={busy} onClick={fire}>{busy ? "…" : "Звільнити"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EmployeeRow({ emp, canManage, salons, onEdit, onFire, onTransfer }) {
  const [xfer, setXfer] = useState(false);
  const bd = birthdayIn(emp.dob);
  const bdSoon = bd !== null && bd <= 7;
  return (
    <div className="emp-row">
      <div className="emp-main">
        <span className="emp-name">{emp.full_name}</span>
        <span className={`badge ${empRoleTone[emp.role]} emp-role`}>{EMP_ROLES[emp.role]}</span>
        {bdSoon && <span className="emp-bd"><Cake size={12} /> {bd === 0 ? "сьогодні ДН" : `ДН через ${bd} дн.`}</span>}
      </div>
      <div className="emp-meta">
        {emp.phone && <span>{emp.phone}</span>}
        <span>ДН: {fmtBday(emp.dob)}</span>
        {emp.hired_at && <span>прийнято {fmtDeadline(emp.hired_at)} · {tenure(emp.hired_at)}</span>}
      </div>
      {emp.note && <p className="emp-note">{emp.note}</p>}
      {canManage && (
        <div className="emp-actions">
          {xfer ? (
            <>
              <select className="emp-xfer-sel" defaultValue="" onChange={(e) => { if (e.target.value) { onTransfer(emp, e.target.value); setXfer(false); } }}>
                <option value="" disabled>перевести в…</option>
                {salons.filter((s) => s.key !== emp.salon_key).map((s) => <option key={s.key} value={s.key}>{salonLabel(s)}</option>)}
              </select>
              <button className="btn-secondary small" onClick={() => setXfer(false)}>×</button>
            </>
          ) : (
            <>
              <button className="btn-secondary small" onClick={() => onEdit(emp)}>Редагувати</button>
              {salons.length > 1 && <button className="btn-secondary small" onClick={() => setXfer(true)}>Перевести</button>}
              <button className="btn-danger small" onClick={() => onFire(emp)}><UserMinus size={13} /> Звільнити</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmployeesModule({ cab, archive }) {
  const [rows, reload] = useEmployees();
  const [form, setForm] = useState(null);   // null | "new" | emp
  const [fireT, setFireT] = useState(null);

  const canManage = !archive && (cab.type === "tm" || cab.type === "manager");
  const salons = useMemo(() => {
    if (cab.type === "tm") return salonsOfTm(cab.tmKey || cab.key);
    if (cab.type === "sm") return [salonByKey(cab.key)].filter(Boolean);
    return SALONS;
  }, [cab]);

  if (rows === null) return <div className="loading">Завантаження…</div>;

  // RLS може віддавати ширше коло (ТМ бачить усі салони для графіка) — у «Команді»
  // показуємо лише свій обсяг; «orphan» = штат без відомого салону взагалі
  const scopeKeys = new Set(salons.map((s) => s.key));
  const known = new Set(SALONS.map((s) => s.key));
  const inScope = (e) => cab.type === "manager" ? true : scopeKeys.has(e.salon_key);
  const list = rows.filter((e) => (archive ? e.status === "fired" : e.status === "active") && inScope(e));
  const bySalon = salons.map((s) => ({
    salon: s,
    emps: list.filter((e) => e.salon_key === s.key)
      .sort((a, b) => EMP_ROLE_ORDER.indexOf(a.role) - EMP_ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)),
  }));
  const orphan = list.filter((e) => !known.has(e.salon_key));

  const onTransfer = async (emp, toKey) => { await transferEmployee(emp, toKey, cab.key); pushToast({ title: "Переведено", body: `${emp.full_name} → ${cabName(toKey)}` }); reload(); };
  const onRehire = async (emp) => { await rehireEmployee(emp, emp.salon_key, cab.key); reload(); };

  return (
    <div className="tasks-mod">
      <div className="tasks-head">
        <h3 className="ov-h">{archive ? "Архів співробітників" : "Команда"}</h3>
        {canManage && <button className="btn-primary small" onClick={() => setForm("new")}><UserPlus size={14} /> Прийняти на роботу</button>}
      </div>

      {!archive && (
        <div className="tasks-dash">
          <span><b>{list.length}</b> у штаті</span>
          <span><b>{list.filter((e) => e.role === "manager" || e.role === "acting_manager").length}</b> керуючих</span>
          <span><b>{list.filter((e) => e.role === "intern").length}</b> стажерів</span>
        </div>
      )}

      {list.length === 0 ? (
        <div className="admin-empty">{archive ? "Архів порожній." : "Співробітників ще не додано."}</div>
      ) : archive ? (
        <div className="task-list">
          {list.sort((a, b) => (a.fired_at < b.fired_at ? 1 : -1)).map((e) => (
            <div className="emp-row emp-fired" key={e.id}>
              <div className="emp-main">
                <span className="emp-name">{e.full_name}</span>
                <span className={`badge ${empRoleTone[e.role]} emp-role`}>{EMP_ROLES[e.role]}</span>
              </div>
              <div className="emp-meta">
                <span>{cabName(e.salon_key)}</span>
                {e.hired_at && <span>стаж {tenure(e.hired_at, e.fired_at)}</span>}
                <span>звільнено {e.fired_at ? fmtDeadline(e.fired_at) : "—"}</span>
                {e.phone && <span>{e.phone}</span>}
              </div>
              {e.fired_reason && <p className="emp-note">Причина: {e.fired_reason}</p>}
              {(cab.type === "tm" || cab.type === "manager") && (
                <div className="emp-actions"><button className="btn-secondary small" onClick={() => onRehire(e)}>Повернути в штат</button></div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="emp-groups">
          {bySalon.map(({ salon, emps }) => (
            <div className="emp-group" key={salon.key}>
              <div className="emp-group-head">{salonLabel(salon)} <span>· {emps.length}</span></div>
              {emps.length === 0 ? <div className="admin-empty" style={{ padding: "10px 0" }}>немає</div> : emps.map((e) => (
                <EmployeeRow key={e.id} emp={e} canManage={canManage} salons={salons}
                  onEdit={(x) => setForm(x)} onFire={(x) => setFireT(x)} onTransfer={onTransfer} />
              ))}
            </div>
          ))}
          {orphan.length > 0 && (
            <div className="emp-group">
              <div className="emp-group-head">Інші магазини</div>
              {orphan.map((e) => (
                <EmployeeRow key={e.id} emp={e} canManage={false} salons={salons} onEdit={() => {}} onFire={() => {}} onTransfer={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {form && <EmployeeForm cab={cab} salons={salons} emp={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={reload} />}
      {fireT && <FireModal emp={fireT} cab={cab} onClose={() => setFireT(null)} onDone={reload} />}
    </div>
  );
}

/* =========================================================
   МОДУЛЬ «ГРАФІК ЗМІН»
========================================================= */
const shiftDow = (ym, day) => { const [y, m] = ym.split("-").map(Number); return (new Date(y, m - 1, day).getDay() + 6) % 7; }; // 0=пн
const isWeekendDay = (ym, day) => shiftDow(ym, day) >= 5;
const empRoleShort = { manager: "керуючий", acting_manager: "В.О.", seller: "продавець", intern: "стажер" };

function useShiftMonth(ym) {
  const [shifts, setShifts] = useState(null);
  const [storeDays, setStoreDays] = useState([]);
  const reload = () => Promise.all([listShifts(ym), listStoreDays(ym)])
    .then(([s, sd]) => { setShifts(s); setStoreDays(sd); })
    .catch(() => { setShifts([]); setStoreDays([]); });
  useEffect(() => { setShifts(null); reload(); const un = subscribeShifts(() => reload()); return un; /* eslint-disable-next-line */ }, [ym]);
  return [shifts, storeDays, reload];
}

function ShiftCellMenu({ pos, salonOptions, editMode, onClose, onSet }) {
  return createPortal(
    <>
      <div className="dtf-backdrop" onClick={onClose} />
      <div className="shift-menu" style={{ top: pos.top, left: pos.left }}>
        <div className="shift-menu-row">
          <button className="shift-menu-work" onClick={() => onSet({ type: "worked" })}>✓ На зміні</button>
          <button onClick={() => onSet({ type: "off" })}>Вихідний</button>
        </div>
        <div className="shift-menu-row">
          <button onClick={() => onSet({ type: "absent" })}>Відсутній</button>
          <button onClick={() => onSet({ type: "clear" })}>Прибрати</button>
        </div>
        {salonOptions.length > 0 && (
          <div className="shift-menu-row shift-menu-subst">
            <span>Заміна:</span>
            <select defaultValue="" onChange={(e) => { if (e.target.value) onSet({ type: "subst", salon: e.target.value }); }}>
              <option value="" disabled>магазин</option>
              {salonOptions.map((s) => <option key={s.key} value={s.key}>{s.city}</option>)}
            </select>
          </div>
        )}
        <div className="shift-menu-hint">{editMode === "plan" ? "редагуємо план" : "редагуємо факт"}</div>
      </div>
    </>,
    document.body,
  );
}

function ShiftGrid({ ym, salons, employees, shifts, storeDays, canEditSalon, onChange, cabKey }) {
  const [menu, setMenu] = useState(null); // { empId, day, homeSalon, pos }
  const [editMode, setEditMode] = useState("plan");
  const canEdit = salons.some((s) => canEditSalon(s.key));
  const scrollRef = React.useRef(null);
  const nDays = daysInMonth(ym);
  const today = todayISO();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || ym !== nowYm()) return;
    const d = new Date().getDate();
    el.scrollLeft = Math.max(0, (d - 4) * 27); // ~ширина клітинки
  }, [ym, shifts]);
  const shiftMap = useMemo(() => {
    const m = {};
    shifts.forEach((s) => { m[`${s.employee_id}:${s.work_date}`] = s; });
    return m;
  }, [shifts]);
  const closedDays = useMemo(() => {
    const m = {};
    storeDays.forEach((d) => { if (d.closed) m[`${d.salon_key}:${d.work_date}`] = true; });
    return m;
  }, [storeDays]);

  const openMenu = (e, empId, day, homeSalon) => {
    if (!canEditSalon(homeSalon)) return;
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ empId, day, homeSalon, pos: { top: Math.min(r.bottom + 4, window.innerHeight - 170), left: Math.min(r.left, window.innerWidth - 210) } });
  };
  const applySet = async (action) => {
    const { empId, day, homeSalon } = menu;
    const wd = dayKey(ym, day);
    setMenu(null);
    const cur = shiftMap[`${empId}:${wd}`] || {};
    let row = { employee_id: empId, work_date: wd, salon_key: cur.salon_key || homeSalon, plan_h: cur.plan_h ?? null, fact_h: cur.fact_h ?? null, state: "work", absence_reason: cur.absence_reason || "", is_senior: cur.is_senior || false, updated_by: cabKey };
    if (action.type === "clear") { await deleteShift(empId, wd).catch(() => {}); onChange(); return; }
    if (action.type === "worked") {
      if (editMode === "plan") row.plan_h = 1; else row.fact_h = 1;
      row.state = "work"; row.absence_reason = "";
    } else if (action.type === "off") {
      row.state = "off"; row.plan_h = null; row.fact_h = null;
    } else if (action.type === "absent") {
      const reason = prompt("Причина (відпустка / лікарняний / відгул / прогул / навчання):", "відпустка") || "";
      const key = Object.entries(ABSENCE_REASONS).find(([, v]) => v.toLowerCase() === reason.trim().toLowerCase())?.[0] || "vacation";
      row.state = "absent"; row.absence_reason = key; row.fact_h = null;
    } else if (action.type === "subst") {
      row.salon_key = action.salon;
      if (editMode === "plan") row.plan_h = 1; else row.fact_h = 1;
      row.state = "work";
    }
    await upsertShift(row).catch((e) => alert(e.message || e));
    onChange();
  };

  const cellContent = (s, homeSalon) => {
    if (!s) return { txt: "", cls: "" };
    if (s.state === "closed") return { txt: "", cls: "sh-closed" };
    if (s.state === "off") return { txt: "", cls: "sh-off" };
    if (s.state === "absent") return { txt: (ABSENCE_REASONS[s.absence_reason] || "×").slice(0, 4), cls: "sh-absent" };
    const worked = s.fact_h != null;
    const planned = s.plan_h != null;
    if (!worked && !planned) return { txt: "", cls: "" };
    const subst = s.salon_key !== homeSalon;
    if (subst) return { txt: salonByKey(s.salon_key)?.city?.slice(0, 3) || "?", cls: "sh-subst" };
    // відпрацював → повна заливка; заплановано → напівпрозора
    return { txt: "", cls: worked ? "sh-fill" : "sh-fill-plan" };
  };

  const groups = salons.map((s) => ({
    salon: s,
    emps: employees.filter((e) => e.salon_key === s.key && e.status === "active")
      .sort((a, b) => EMP_ROLE_ORDER.indexOf(a.role) - EMP_ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)),
  }));

  return (
    <div className="shift-grid-wrap">
      {canEdit && (
        <div className="shift-modebar">
          <span>Клік по клітинці редагує:</span>
          <button className={editMode === "plan" ? "on" : ""} onClick={() => setEditMode("plan")}>План</button>
          <button className={editMode === "fact" ? "on" : ""} onClick={() => setEditMode("fact")}>Факт</button>
          {salons.length > 1 && !salons.every((s) => canEditSalon(s.key)) && <span className="muted" style={{ marginLeft: 6 }}>· редагувати можна лише свої магазини</span>}
        </div>
      )}
      <div className="grid-scroll" ref={scrollRef}>
        <table className="sched">
          <thead>
            <tr>
              <th className="rh" />
              {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => (
                <th key={d} className={isWeekendDay(ym, d) ? "we" : ""}>
                  {d}<br /><span className="wd">{WEEKDAYS_SHORT[shiftDow(ym, d)].toLowerCase()}</span>
                </th>
              ))}
              <th className="rh sh-sum-h">відпрац.</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ salon, emps }) => (
              <React.Fragment key={salon.key}>
                <tr className="grp"><td colSpan={nDays + 2}>{salonLabel(salon)}</td></tr>
                {emps.length === 0 && <tr><td className="rh muted" colSpan={nDays + 2}>немає співробітників</td></tr>}
                {emps.map((e) => {
                  const t = monthTally(shifts, e.id, e.salon_key);
                  return (
                    <tr key={e.id}>
                      <td className="rh"><span className="nm">{e.full_name}</span><br /><span className="rl">{empRoleShort[e.role]}</span></td>
                      {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
                        const wd = dayKey(ym, d);
                        let s = shiftMap[`${e.id}:${wd}`];
                        if (!s && closedDays[`${e.salon_key}:${wd}`]) s = { state: "closed" };
                        const { txt, cls } = cellContent(s, e.salon_key);
                        const edit = canEditSalon(e.salon_key);
                        return (
                          <td key={d}
                            className={`sh ${cls} ${wd === today ? "sh-today" : ""} ${edit ? "sh-edit" : ""}`}
                            onClick={edit ? (ev) => openMenu(ev, e.id, d, e.salon_key) : undefined}>
                            {txt}
                          </td>
                        );
                      })}
                      <td className="rh sh-sum"><b>{t.factDays}</b> дн{t.planDays ? ` / ${t.planDays} план` : ""}{t.substDays ? ` · зам. ${t.substDays}` : ""}{t.absentDays ? ` · відс. ${t.absentDays}` : ""}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="shift-legend">
        <span><i className="sw sh-fill" />відпрацював</span>
        <span><i className="sw sh-fill-plan" />заплановано</span>
        <span><i className="sw sh-off" />вихідний</span>
        <span><i className="sw sh-subst">Т</i>заміна на іншому магазині</span>
        <span><i className="sw sh-closed" />зачинено</span>
        <span><i className="sw sh-absent" />відсутній</span>
      </div>
      {menu && (
        <ShiftCellMenu
          pos={menu.pos} editMode={editMode} onClose={() => setMenu(null)} onSet={applySet}
          salonOptions={SALONS.filter((s) => s.key !== menu.homeSalon)}
        />
      )}
    </div>
  );
}

function ShiftScheduleModule({ cab }) {
  const [ym, setYm] = useState(nowYm());
  const [employees, setEmployees] = useState(null);
  const [shifts, storeDays, reload] = useShiftMonth(ym);
  const months = useMemo(() => recentMonths(12), []);

  useEffect(() => { listEmployees().then(setEmployees).catch(() => setEmployees([])); }, []);

  // графік показуємо по всіх 8 магазинах усім ТМ і керівнику; СМ — свою територію
  const salons = useMemo(() => {
    if (cab.type === "sm") { const tm = cab.tmKey || salonTmOn(cab.key); return tm ? salonsOfTm(tm) : [salonByKey(cab.key)].filter(Boolean); }
    return SALONS;
  }, [cab]);
  const canEditSalon = useMemo(() => {
    if (cab.type === "sm") return (k) => k === cab.key;
    if (cab.type === "manager") return () => true;
    if (cab.type === "tm") { const my = cab.tmKey || cab.key; return (k) => salonTmOn(k) === my; }
    return () => false;
  }, [cab]);

  if (employees === null || shifts === null) return <div className="loading">Завантаження…</div>;

  const today = todayISO();
  const onShiftToday = shifts.filter((s) => s.work_date === today && s.state === "work" && s.fact_h != null);

  return (
    <div className="tasks-mod">
      <div className="tasks-head">
        <h3 className="ov-h">Графік змін</h3>
        <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {ym === nowYm() && (
        <div className="tasks-dash">
          {onShiftToday.length === 0
            ? <span className="tasks-dash-alert">Сьогодні ще ніхто не відмітив зміну</span>
            : <span><b>{onShiftToday.length}</b> на зміні сьогодні: {onShiftToday.map((s) => {
                const e = employees.find((x) => x.id === s.employee_id);
                return e ? `${e.full_name}${s.salon_key !== e.salon_key ? ` (${salonByKey(s.salon_key)?.city})` : ""}` : "";
              }).filter(Boolean).join(", ")}</span>}
        </div>
      )}

      <ShiftGrid
        ym={ym} salons={salons} employees={employees} shifts={shifts} storeDays={storeDays}
        canEditSalon={canEditSalon} onChange={reload} cabKey={cab.key}
      />
    </div>
  );
}

function DailyCheckIn({ salon, onDone }) {
  const [employees, setEmployees] = useState(null);
  const [planned, setPlanned] = useState([]);
  const [picks, setPicks] = useState({});   // empId → bool (на зміні)
  const [senior, setSenior] = useState(null);
  const [subst, setSubst] = useState([]);   // [empId] — заміни з інших магазинів
  const [busy, setBusy] = useState(false);
  const [closeMode, setCloseMode] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [step, setStep] = useState("shift");   // shift | cash
  const [cashInfo, setCashInfo] = useState(null); // { total, days }
  const today = todayISO();

  useEffect(() => {
    (async () => {
      const [emps, todayShifts] = await Promise.all([listEmployees().catch(() => []), listShifts(nowYm()).catch(() => [])]);
      const mine = emps.filter((e) => e.salon_key === salon.key && e.status === "active");
      const plan = todayShifts.filter((s) => s.work_date === today);
      const init = {};
      mine.forEach((e) => {
        const p = plan.find((s) => s.employee_id === e.id);
        init[e.id] = !!(p && p.state === "work" && (p.plan_h != null || p.fact_h != null));
      });
      setEmployees(emps); setPlanned(plan); setPicks(init);
      const seniorPlan = plan.find((s) => s.is_senior);
      setSenior(seniorPlan?.employee_id || mine.find((e) => e.role === "manager")?.id || mine[0]?.id || null);
    })();
  }, [salon.key]);

  if (employees === null) return null;
  const mine = employees.filter((e) => e.salon_key === salon.key && e.status === "active")
    .sort((a, b) => EMP_ROLE_ORDER.indexOf(a.role) - EMP_ROLE_ORDER.indexOf(b.role));
  const others = employees.filter((e) => e.salon_key !== salon.key && e.status === "active");

  const start = async () => {
    setBusy(true);
    try {
      const rows = [];
      mine.forEach((e) => {
        if (picks[e.id]) rows.push({ employee_id: e.id, work_date: today, salon_key: salon.key, fact_h: 1, state: "work", is_senior: e.id === senior, updated_by: salon.key });
        else if (planned.find((s) => s.employee_id === e.id && s.plan_h != null)) rows.push({ employee_id: e.id, work_date: today, salon_key: salon.key, state: "absent", absence_reason: "dayoff", updated_by: salon.key });
      });
      subst.forEach((eid) => rows.push({ employee_id: eid, work_date: today, salon_key: salon.key, fact_h: 1, state: "work", updated_by: salon.key }));
      await upsertShiftsBatch(rows);
      await setStoreDay({ salon_key: salon.key, work_date: today, opened_at: new Date().toISOString(), opened_by: salon.key, senior_id: senior, closed: false });
      pushToast({ title: "Зміну розпочато", body: `${rows.filter((r) => r.state === "work").length} на зміні` });
      // питання про готівку: чи забрав Віктор те, що назбиралось до сьогодні
      const prior = await listCashDays({ salonKey: salon.key, to: cashYesterday() }).catch(() => []);
      const openPrior = prior.filter((r) => !r.collected);
      if (openPrior.length) {
        setCashInfo({ total: openPrior.reduce((a, r) => a + Number(r.amount), 0), days: openPrior.length });
        setStep("cash");
        setBusy(false);
      } else {
        onDone();
      }
    } catch (e) { alert(e.message || e); setBusy(false); }
  };
  const answerCash = async (taken) => {
    setBusy(true);
    try {
      if (taken) await cashHandover(salon.key, salon.key, "підтверджено на ранковому чек-іні");
      onDone();
    } catch (e) { alert(e.message || e); setBusy(false); }
  };
  const closeStore = async () => {
    setBusy(true);
    try {
      await setStoreDay({ salon_key: salon.key, work_date: today, opened_by: salon.key, closed: true, closed_reason: closeReason.trim() });
      onDone();
    } catch (e) { alert(e.message || e); setBusy(false); }
  };

  if (step === "cash") {
    return createPortal(
      <div className="modal-overlay checkin-overlay">
        <div className="checkin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="checkin-h">
            <div className="k">Готівка</div>
            <div className="d">{salonLabel(salon)}</div>
          </div>
          <div className="checkin-b ci-cash">
            <span className="ci-cash-ic"><Banknote size={26} /></span>
            <p>До видачі назбиралось <b>{uah(cashInfo.total)}</b> за {cashInfo.days} дн.</p>
            <p className="hint">Віктор уже забрав цю готівку?</p>
          </div>
          <div className="checkin-f">
            <button className="btn-secondary" disabled={busy} onClick={() => answerCash(false)}>Ще ні</button>
            <button className="btn-primary" disabled={busy} onClick={() => answerCash(true)}>Так, забрав</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="modal-overlay checkin-overlay">
      <div className="checkin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="checkin-h">
          <div className="k">Хто сьогодні на зміні?</div>
          <div className="d">{fmtDeadline(today)} · {salonLabel(salon)}</div>
        </div>

        {closeMode ? (
          <div className="checkin-b">
            <label className="over-field"><span>Причина (необовʼязково)</span>
              <input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="напр. санітарний день" autoFocus />
            </label>
          </div>
        ) : (
          <div className="checkin-b">
            {mine.map((e) => (
              <div className="ci-emp" key={e.id}>
                <button className={`chk ${picks[e.id] ? "on" : ""}`} onClick={() => setPicks((s) => ({ ...s, [e.id]: !s[e.id] }))} />
                <span className="ci-name">{e.full_name}<span className="ci-role">{empRoleShort[e.role]}</span></span>
                <button className={`ci-senior ${senior === e.id ? "on" : ""}`} title="Старший зміни" onClick={() => setSenior(e.id)}>★</button>
              </div>
            ))}
            {subst.map((eid, i) => {
              const e = employees.find((y) => y.id === eid);
              return (
                <div className="ci-emp ci-subst" key={eid}>
                  <button className="chk on" style={{ background: "var(--blue)", borderColor: "var(--blue)" }} onClick={() => setSubst((s) => s.filter((_, j) => j !== i))} />
                  <span className="ci-name">{e?.full_name}<span className="ci-role">заміна · {salonByKey(e?.salon_key)?.city}</span></span>
                </div>
              );
            })}
            {mine.length === 0 && <p className="hint" style={{ padding: "10px 2px" }}>Співробітників цього магазину ще не додано (модуль «Команда»). Можна почати зміну без списку.</p>}
            {others.length > 0 && (
              <div className="ci-add">
                <select value="" onChange={(e) => { if (e.target.value && !subst.includes(e.target.value)) setSubst((s) => [...s, e.target.value]); }}>
                  <option value="">+ додати заміну з іншого магазину</option>
                  {others.map((e) => <option key={e.id} value={e.id}>{e.full_name} — {salonByKey(e.salon_key)?.city}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="checkin-f">
          {closeMode ? (
            <>
              <button className="btn-secondary" onClick={() => setCloseMode(false)}>Назад</button>
              <button className="btn-primary" disabled={busy} onClick={closeStore}>Підтвердити «зачинено»</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setCloseMode(true)}>Зачинено сьогодні</button>
              <button className="btn-primary" disabled={busy || (mine.length > 0 && !Object.values(picks).some(Boolean) && subst.length === 0)} onClick={start}>
                {busy ? "…" : "Почати зміну"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* Загальна панель для вбудованого зовнішнього ресурсу (iframe + шапка з діями). */
function EmbedPanel({ url, title, hint }) {
  const [k, setK] = useState(0); // для «оновити»
  return (
    <div className="planner-embed">
      <div className="planner-bar">
        <span className="planner-hint">{hint}</span>
        <div className="planner-actions">
          <button type="button" className="planner-btn" onClick={() => setK((v) => v + 1)}>
            <RefreshCw size={13} /> Оновити
          </button>
          <a className="planner-btn" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> Відкрити в новому вікні
          </a>
        </div>
      </div>
      <iframe
        key={k}
        src={url}
        title={title}
        className="planner-frame"
        loading="lazy"
        allow="clipboard-write"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

/* Онлайн-планер регіону (зовнішній застосунок, власний бекенд).
   За потреби різні сторінки під різних ТМ — додати ключ у PLANNER_BY_TM. */
const PLANNER_URL_DEFAULT = "https://serene-sunflower-83a9e2.netlify.app/bor.html";
const PLANNER_BY_TM = {
  // andriy: "https://serene-sunflower-83a9e2.netlify.app/bor.html",
  // ivan:   "https://serene-sunflower-83a9e2.netlify.app/por.html",
};
const plannerUrl = (tmKey) => PLANNER_BY_TM[tmKey] || PLANNER_URL_DEFAULT;

function PlannerModule({ tmKey }) {
  return (
    <EmbedPanel
      url={plannerUrl(tmKey)}
      title="Планер регіону"
      hint="Онлайн-планер регіону — заповнюють магазини, дані спільні для всіх учасників."
    />
  );
}

/* Офіційні виплати — Google-таблиця (лише ТМ і керівник). */
const REGION_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1yVdLFLuT6P7bj3FeoDN1zx4-1gFFyu7t88wONJiVF-w/edit?gid=1711229427&rm=minimal";

function RegionSheetModule() {
  return (
    <EmbedPanel
      url={REGION_SHEET_URL}
      title="Офіційні виплати"
      hint="Офіційні виплати — Google-таблиця. Потрібен доступ Google — якщо в рамці просить вхід, відкрийте в новому вікні."
    />
  );
}

/* ---------- Показники території ---------- */
const tmMoney = (n) => Math.round(n || 0).toLocaleString("uk-UA");
const rowKey = (sk, d) => `${sk}|${d}`;

function TerritorySummaryStrip({ salonKeys, rows, daysPassed, dim, plans }) {
  const { sum } = monthAgg(rows, salonKeys);
  const plan = planAgg(salonKeys, plans);
  return (
    <div className="tm-strip">
      {TM_METRICS.map((mt) => {
        const planToDate = dim ? (plan[mt.key] / dim) * daysPassed : 0;
        const pct = planToDate ? Math.round((sum[mt.key] / planToDate) * 100) : null;
        const tone = pct == null ? "" : pct >= 100 ? "good" : pct >= 90 ? "warn" : "bad";
        return (
          <div className="tm-strip-tile" key={mt.key}>
            <span className="tm-strip-lab">{mt.label}</span>
            <b>{tmMoney(sum[mt.key])}{mt.money ? " ₴" : ""}</b>
            <span className="tm-strip-sub">
              план міс. {tmMoney(plan[mt.key])}
              {pct != null && <em className={`tm-pct ${tone}`}> · {pct}% до дати</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TerritoryAllSalons({ salons, rows, activeKey, onPick, plans }) {
  return (
    <div className="tm-all">
      <table className="tm-all-tbl">
        <thead>
          <tr><th>Салон</th><th>Оборот, міс.</th><th>План</th><th>%</th><th>Днів</th></tr>
        </thead>
        <tbody>
          {salons.map((s) => {
            const { sum, daysBySalon } = monthAgg(rows, [s.key]);
            const plan = planOf(plans, s.key).assort || 0;
            const pct = plan ? Math.round((sum.assort / plan) * 100) : null;
            return (
              <tr key={s.key} className={s.key === activeKey ? "active" : ""} onClick={() => onPick(s.key)}>
                <td>{s.city}, {shortAddr(s.addr)}</td>
                <td className="num">{tmMoney(sum.assort)} ₴</td>
                <td className="num muted">{tmMoney(plan)}</td>
                <td className="num">{pct == null ? "—" : `${pct}%`}</td>
                <td className="num">{daysBySalon[s.key] || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TerritoryDayTable({ salonKey, ym, rowsMap, editable, by, onPatched, plans }) {
  const dim = daysInYm(ym);
  const today = todayISO();
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const plan = planOf(plans, salonKey);
  const totals = { assort: 0, ez: 0, cheky: 0, bn: 0, dzvinky: 0 };

  const commit = async (day, metric, val) => {
    const d = dateOf(ym, day);
    const patch = { [metric]: val === "" || val == null ? null : Number(val) || 0 };
    onPatched(salonKey, d, patch); // оптимістично
    try { await saveManual(salonKey, d, patch, by); }
    catch (e) { alert(e.message || e); }
  };
  const reset = async (day) => {
    const d = dateOf(ym, day);
    onPatched(salonKey, d, null);
    try { await resetManual(salonKey, d); } catch (e) { alert(e.message || e); }
  };

  return (
    <div className="tm-grid-wrap">
      <table className="tm-grid">
        <thead>
          <tr>
            <th className="tm-c-day">День</th>
            {TM_METRICS.map((mt) => <th key={mt.key}>{mt.short}</th>)}
            <th>Сер. чек</th>
            {editable && <th className="tm-c-rst" />}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const d = dateOf(ym, day);
            const row = rowsMap.get(rowKey(salonKey, d));
            const e = effective(row || {});
            for (const mt of TM_METRICS) totals[mt.key] += e[mt.key];
            const anyEdited = TM_METRICS.some((mt) => e[`${mt.key}__edited`]);
            const isFuture = d > today;
            const avg = e.cheky ? Math.round(e.assort / e.cheky) : 0;
            return (
              <tr key={day} className={isFuture ? "tm-future" : ""}>
                <td className="tm-c-day">{day}</td>
                {TM_METRICS.map((mt) => (
                  <td key={mt.key} className={e[`${mt.key}__edited`] ? "tm-edited" : ""}>
                    {editable ? (
                      <NumInput
                        className="tm-in" allowEmpty
                        value={e[`${mt.key}__edited`] || e[mt.key] ? e[mt.key] : ""}
                        onChange={(v) => commit(day, mt.key, v)}
                      />
                    ) : (
                      <span>{e[mt.key] ? tmMoney(e[mt.key]) : "—"}</span>
                    )}
                  </td>
                ))}
                <td className="muted">{avg ? tmMoney(avg) : "—"}</td>
                {editable && (
                  <td className="tm-c-rst">
                    {anyEdited && (
                      <button type="button" className="tm-rst" title="Повернути до планера" onClick={() => reset(day)}>↩</button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="tm-tot">
            <td className="tm-c-day">Разом</td>
            {TM_METRICS.map((mt) => <td key={mt.key} className="num">{tmMoney(totals[mt.key])}</td>)}
            <td className="muted">{totals.cheky ? tmMoney(Math.round(totals.assort / totals.cheky)) : "—"}</td>
            {editable && <td />}
          </tr>
          <tr className="tm-plan">
            <td className="tm-c-day">План міс.</td>
            {TM_METRICS.map((mt) => <td key={mt.key} className="num muted">{tmMoney(plan[mt.key] || 0)}</td>)}
            <td />
            {editable && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TerritoryModule({ cab }) {
  const scopeSalons = cab.type === "tm"
    ? salonsOfTm(cab.tmKey || cab.key)
    : (cab.type === "sm" ? [salonByKey(cab.key)].filter(Boolean) : SALONS);
  const editable = cab.type === "tm" || cab.type === "manager";
  const months = useMemo(() => recentMonths(15), []);
  const [ym, setYm] = useState(nowYm());
  const [rowsMap, setRowsMap] = useState(new Map());
  const [plans, setPlans] = useState(SALON_MONTH_PLAN);
  const [loading, setLoading] = useState(true);
  const [salonKey, setSalonKey] = useState(scopeSalons[0]?.key || null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const localEditAt = React.useRef(0);

  const reload = async () => {
    // не перетирати щойно збережені локальні правки відлунням realtime
    if (Date.now() - localEditAt.current < 2500) return;
    const list = await listMetrics(ym).catch(() => []);
    const m = new Map();
    for (const r of list) m.set(rowKey(r.salon_key, r.work_date), r);
    setRowsMap(m);
    setLoading(false);
  };
  useEffect(() => { listPlans().then(setPlans).catch(() => {}); }, []);
  useEffect(() => { setLoading(true); localEditAt.current = 0; reload(); /* eslint-disable-next-line */ }, [ym]);
  useEffect(() => subscribeMetrics(() => { reload(); listPlans().then(setPlans).catch(() => {}); }), [ym]); // eslint-disable-line

  const patchLocal = (sk, d, patch) => {
    localEditAt.current = Date.now();
    setRowsMap((prev) => {
      const next = new Map(prev);
      const k = rowKey(sk, d);
      const cur = next.get(k) || { salon_key: sk, work_date: d, planner: {}, manual: {} };
      const manual = patch === null ? {} : { ...(cur.manual || {}) };
      if (patch) {
        for (const [kk, vv] of Object.entries(patch)) {
          if (vv === null) delete manual[kk]; else manual[kk] = Number(vv) || 0;
        }
      }
      next.set(k, { ...cur, manual });
      return next;
    });
  };

  const runSync = async () => {
    setSyncing(true); setSyncNote("");
    try {
      const r = await syncFromPlanner([ym]);
      setSyncNote(`оновлено рядків: ${r?.rows ?? 0}`);
      localEditAt.current = 0;
      await reload();
    } catch (e) {
      setSyncNote(`помилка: ${e.message || e}`);
    } finally { setSyncing(false); }
  };

  const dim = daysInYm(ym);
  const isCurYm = ym === nowYm();
  const daysPassed = isCurYm ? Math.min(new Date().getDate(), dim) : dim;
  const rowsArr = Array.from(rowsMap.values());
  const scopeKeys = scopeSalons.map((s) => s.key);
  const activeSalon = salonKey && scopeKeys.includes(salonKey) ? salonKey : scopeKeys[0];

  return (
    <div className="tm-mod">
      <div className="tm-head">
        <h3 className="ov-h">Показники території</h3>
        <div className="tm-head-actions">
          <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          {editable && (
            <button type="button" className="planner-btn" onClick={runSync} disabled={syncing}>
              <RefreshCw size={13} /> {syncing ? "Оновлення…" : "Оновити з планера"}
            </button>
          )}
        </div>
      </div>
      {syncNote && <p className="tm-sync-note">{syncNote}</p>}

      {loading ? <div className="loading">Завантаження…</div> : (
        <>
          <TerritorySummaryStrip salonKeys={scopeKeys} rows={rowsArr} daysPassed={daysPassed} dim={dim} plans={plans} />

          {scopeSalons.length > 1 && (
            <TerritoryAllSalons salons={scopeSalons} rows={rowsArr} activeKey={activeSalon} onPick={setSalonKey} plans={plans} />
          )}

          {scopeSalons.length > 1 && (
            <div className="tm-salon-chips">
              {scopeSalons.map((s) => (
                <button key={s.key} className={`chip ${s.key === activeSalon ? "active" : ""}`} onClick={() => setSalonKey(s.key)}>
                  {s.city}, {shortAddr(s.addr)}
                </button>
              ))}
            </div>
          )}

          {activeSalon && (
            <>
              <p className="tm-grid-cap">
                {salonLabel(salonByKey(activeSalon))} · {monthLabel(ym)}
                {editable && <span className="muted"> · клітинку можна відкоригувати вручну, ↩ повертає значення з планера</span>}
              </p>
              <TerritoryDayTable
                salonKey={activeSalon} ym={ym} rowsMap={rowsMap} plans={plans}
                editable={editable} by={cab.key} onPatched={patchLocal}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Облік готівки ---------- */
const uah = (n) => Math.round(Number(n) || 0).toLocaleString("uk-UA") + " ₴";
const cashDayLabel = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MON_SHORT[m - 1]}`; };

/* СМ: внести наторговане за день + видача Віктору */
function CashModule({ cab, salonKey: overrideKey }) {
  const salonKey = overrideKey || cab.key;
  const canEdit = cab.type === "sm" || cab.type === "manager";
  const [days, setDays] = useState(null);
  const [handovers, setHandovers] = useState([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [d, h] = await Promise.all([
      listCashDays({ salonKey, from: "2000-01-01" }).catch(() => []),
      listHandovers({ salonKey }).catch(() => []),
    ]);
    setDays(d); setHandovers(h);
  };
  useEffect(() => { reload(); return subscribeCash(reload); /* eslint-disable-next-line */ }, [salonKey]);
  if (days === null) return <div className="loading">Завантаження…</div>;

  const open = days.filter((r) => !r.collected);
  const outstanding = open.reduce((a, r) => a + Number(r.amount), 0);
  const todayRow = days.find((r) => r.work_date === todayISO());
  const recent = days.slice(0, 20);

  const saveToday = async (val) => {
    try { await setCashDay(salonKey, todayISO(), val, cab.key); }
    catch (e) { alert(e.message || e); }
  };
  const handover = async () => {
    if (!open.length) return;
    if (!confirm(`Підтвердити видачу готівки Віктору: ${uah(outstanding)}?`)) return;
    setBusy(true);
    try {
      const s = await cashHandover(salonKey, cab.key, "");
      pushToast({ title: "Готівку видано", body: uah(s) });
      await reload();
    } catch (e) { alert(e.message || e); }
    finally { setBusy(false); }
  };

  return (
    <div className="cash-mod">
      <h3 className="ov-h">Готівка</h3>
      <p className="ov-sub">{salonLabel(salonByKey(salonKey))}</p>

      <div className="cash-cards">
        <div className="cash-card big">
          <span className="cash-lab">До видачі Віктору</span>
          <b>{uah(outstanding)}</b>
          <span className="cash-sub">{open.length ? `${open.length} дн. не забрано` : "усе забрано"}</span>
          {canEdit && open.length > 0 && (
            <button className="btn-primary" onClick={handover} disabled={busy}>
              <Banknote size={15} /> Видача готівки Віктору
            </button>
          )}
        </div>
        {canEdit && (
          <div className="cash-card">
            <span className="cash-lab">Наторговано сьогодні ({cashDayLabel(todayISO())})</span>
            <NumInput
              className="cash-in" allowEmpty placeholder="0"
              value={todayRow ? Number(todayRow.amount) : ""}
              onChange={saveToday}
            />
            <span className="cash-sub">готівка, яку ви здасте Віктору</span>
          </div>
        )}
      </div>

      <div className="cash-hist">
        <h4>Останні дні</h4>
        {recent.length === 0 ? <p className="hint">Записів ще немає.</p> : (
          <table className="cash-tbl">
            <tbody>
              {recent.map((r) => (
                <tr key={r.work_date} className={r.collected ? "done" : ""}>
                  <td>{cashDayLabel(r.work_date)}</td>
                  <td className="num">{uah(r.amount)}</td>
                  <td className="st">{r.collected ? `забрано ${fmtDate(r.collected_at).split(",")[0]}` : "до видачі"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {handovers.length > 0 && (
        <div className="cash-hist">
          <h4>Видачі Віктору</h4>
          <table className="cash-tbl">
            <tbody>
              {handovers.slice(0, 12).map((h) => (
                <tr key={h.id}>
                  <td>{fmtDate(h.happened_at)}</td>
                  <td className="num">{uah(h.amount)}</td>
                  <td className="st">{h.covers_from ? `за ${cashDayLabel(h.covers_from)}–${cashDayLabel(h.covers_to)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* к-ть повних днів від дати (ISO) до сьогодні */
const daysSince = (iso) => {
  if (!iso) return 0;
  const a = new Date(iso + "T00:00:00");
  const b = new Date(todayISO() + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 86400000));
};
/* рівень терміновості плитки готівки */
const cashLevel = (m) => {
  if (!m || m.total <= 0) return 0;
  const age = daysSince(m.oldest);
  if (age >= 3) return 3;              // лежить 3+ дні — критично
  if (age >= 2 || m.total >= 20000) return 2;
  return 1;
};
const cashLevelWord = (m) => {
  const age = daysSince(m.oldest);
  if (age <= 0) return "сьогодні";
  return `${age} ${age === 1 ? "день" : age < 5 ? "дні" : "днів"}${m.days > 1 ? ` · ${m.days} внесень` : ""}`;
};

/* Віктор — головний екран: теплова сітка готівки до видачі */
function ManagerCashOverview() {
  const [out, setOut] = useState(null);
  const [lastHand, setLastHand] = useState(null);
  useEffect(() => {
    const load = () => {
      outstandingBySalon().then(setOut).catch(() => setOut({}));
      listHandovers({ limit: 1 }).then((h) => setLastHand(h[0] || null)).catch(() => {});
    };
    load();
    return subscribeCash(load);
  }, []);
  if (out === null) return <div className="loading">Завантаження…</div>;

  const tmTitle = { ivan: "Львів", andriy: "Область" };
  const grand = Object.values(out).reduce((a, m) => a + m.total, 0);
  const subtotals = { ivan: 0, andriy: 0 };
  SALONS.forEach((s) => { const t = salonTmOn(s.key); if (subtotals[t] != null) subtotals[t] += out[s.key]?.total || 0; });
  const waiting = SALONS.filter((s) => (out[s.key]?.total || 0) > 0).length;

  const tiles = SALONS
    .map((s) => ({ s, m: out[s.key], lvl: cashLevel(out[s.key]) }))
    .sort((a, b) => (b.lvl - a.lvl) || ((b.m?.total || 0) - (a.m?.total || 0)));

  return (
    <div className="cash-bento">
      <div className={`cash-hero ${grand === 0 ? "calm" : ""}`}>
        <div>
          <div className="cash-hero-lab">Готівка до видачі</div>
          {grand === 0 ? (
            <>
              <div className="cash-hero-v calm">Усе зібрано</div>
              <p className="cash-hero-note">
                {lastHand
                  ? `останнє надходження — ${cabName(lastHand.salon_key).replace("Салон · ", "") || lastHand.salon_key}, ${fmtDate(lastHand.happened_at)}`
                  : "жоден магазин не має незданої готівки"}
              </p>
            </>
          ) : (
            <>
              <div className="cash-hero-v">{uah(grand)}</div>
              <p className="cash-hero-note">{waiting} {waiting === 1 ? "магазин чекає" : waiting < 5 ? "магазини чекають" : "магазинів чекають"} · оновлено щойно</p>
            </>
          )}
        </div>
        <div className="cash-hero-terrs">
          {["ivan", "andriy"].map((t) => (
            <div key={t}>
              <div className="n">{uah(subtotals[t])}</div>
              <div className="l">{tmTitle[t]}</div>
            </div>
          ))}
        </div>
      </div>

      {tiles.map(({ s, m, lvl }) => (
        <div className={`cash-tile lvl${lvl}`} key={s.key} title={salonLabel(s)}>
          <div className="cash-tile-nm">{s.city}, {shortAddr(s.addr)}</div>
          <div>
            <div className="cash-tile-v">{uah(m?.total || 0)}</div>
            <div className="cash-tile-d">{lvl === 0 ? "зібрано" : cashLevelWord(m)}</div>
          </div>
        </div>
      ))}

      <p className="cash-bento-note">
        Магазини вносять готівку в кінці дня. Червоне «горить» — лежить 3+ дні. Коли забрали — СМ тисне «Видача готівки».
      </p>
    </div>
  );
}

/* Віктор — вкладка «Готівка»: аналітика по кожному магазину */
function ManagerCashTab() {
  const [salonKey, setSalonKey] = useState(SALONS[0].key);
  return (
    <div className="embedded">
      <div className="tm-salon-chips" style={{ marginBottom: 16 }}>
        {SALONS.map((s) => (
          <button key={s.key} className={`chip ${s.key === salonKey ? "active" : ""}`} onClick={() => setSalonKey(s.key)}>
            {s.city}, {shortAddr(s.addr)}
          </button>
        ))}
      </div>
      <CashModule cab={{ key: "manager", type: "manager" }} salonKey={salonKey} />
    </div>
  );
}

/* ==================== СКЛАД ГОСПОДАРСЬКИХ ПОТРЕБ ==================== */
const whName = (w) => (w === CENTRAL ? "Основний склад" : salonByKey(w) ? salonLabel(salonByKey(w)) : w);
const catRank = (c) => { const i = SUPPLY_CATEGORIES.indexOf(c); return i < 0 ? 99 : i; };
const ORDER_ST = { draft: "чернетка", submitted: "подано", shipped: "відправлено", received: "отримано" };

function useSupply() {
  const [items, setItems] = useState(null);
  const [stock, setStock] = useState([]);
  const reload = async () => {
    const [it, st] = await Promise.all([listItems().catch(() => []), listStock().catch(() => [])]);
    setItems(it); setStock(st);
  };
  useEffect(() => { reload(); return subscribeSupply(reload); }, []);
  return { items, stock, reload };
}

/* --- рядок вводу товару (для приходу / списання / замовлення) --- */
function SupplyLineRow({ items, line, exclude, onChange, onRemove, priceCol }) {
  const opts = items.filter((i) => i.id === line.item_id || !exclude.has(i.id));
  return (
    <div className="wh-line">
      <select value={line.item_id} onChange={(e) => onChange({ ...line, item_id: e.target.value })}>
        <option value="">— позиція —</option>
        {opts.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <NumInput className="wh-line-qty" allowEmpty placeholder="к-ть" value={line.qty} onChange={(v) => onChange({ ...line, qty: v })} />
      {priceCol && (
        <NumInput className="wh-line-qty" allowEmpty placeholder="ціна" value={line.unit_cost}
          onChange={(v) => onChange({ ...line, unit_cost: v })} />
      )}
      <button className="wh-line-x" onClick={onRemove}><X size={13} /></button>
    </div>
  );
}

/* --- Основний склад --- */
function SupplyCentral({ items, stock, canManage, onReload }) {
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [receiptFrom, setReceiptFrom] = useState(null); // null | [] | prefill lines
  const sm = stockMap(stock, CENTRAL);
  const rows = items
    .filter((i) => (!cat || i.category === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase())))
    .map((i) => {
      const qty = sm[i.id] || 0;
      const need = Math.max(0, i.min_central - qty);
      return { i, qty, need, state: stockState(qty, i.min_central), value: qty * i.unit_cost };
    })
    .filter((r) => !lowOnly || r.need > 0)
    .sort((a, b) => catRank(a.i.category) - catRank(b.i.category) || a.i.sort - b.i.sort);
  const totalValue = items.reduce((s, i) => s + (sm[i.id] || 0) * i.unit_cost, 0);
  const reorder = items.map((i) => ({ i, need: Math.max(0, i.min_central - (sm[i.id] || 0)) })).filter((r) => r.need > 0);
  const reorderSum = reorder.reduce((s, r) => s + r.need * r.i.unit_cost, 0);

  return (
    <div className="wh-view">
      <div className="wh-bar">
        <input className="wh-search" placeholder="Пошук позиції…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="inv-toolbar-sel" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">усі категорії</option>
          {SUPPLY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="wh-check"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> лише «горить»</label>
        {canManage && <button className="btn-secondary small" onClick={() => setReceiptFrom([])}><PackagePlus size={14} /> Прихід</button>}
      </div>

      {reorder.length > 0 && (
        <div className="wh-reorder">
          <b>Потрібно дозамовити:</b> {reorder.length} поз. на <b>{suah(reorderSum)}</b>
          {canManage && (
            <button className="wh-link" onClick={() => setReceiptFrom(reorder.map((r) => ({ item_id: r.i.id, qty: String(r.need), unit_cost: "" })))}>
              Прихід за списком →
            </button>
          )}
        </div>
      )}

      <div className="wh-tw">
        <table className="wh-tbl">
          <thead><tr><th>Позиція</th><th>Од.</th><th>Ціна</th><th>Залишок</th><th>Мін</th><th>Дозамовити</th><th>Вартість</th></tr></thead>
          <tbody>
            {rows.map(({ i, qty, need, state, value }) => (
              <tr key={i.id} className={`st-${state}`}>
                <td className="wh-nm">{i.name}<span className="wh-cat">{i.category}</span></td>
                <td>{i.unit}</td>
                <td className="num">
                  {canManage
                    ? <NumInput className="wh-price" value={i.unit_cost} onChange={(v) => setPrice(i.id, v).then(onReload).catch((e) => alert(e.message))} />
                    : suahN(i.unit_cost)}
                </td>
                <td className={`num ${qty < 0 ? "wh-neg" : ""}`}>{qty}</td>
                <td className="num muted">{i.min_central}</td>
                <td className="num">{need > 0 ? <span className="wh-pill lo">−{need}</span> : "—"}</td>
                <td className="num">{suahN(value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Разом запас центрального складу</td><td /><td /><td /><td /><td className="num">{suahN(reorderSum)}</td><td className="num">{suahN(totalValue)}</td></tr></tfoot>
        </table>
      </div>

      {receiptFrom && (
        <SupplyReceipt items={items} warehouse={CENTRAL} prefill={receiptFrom.length ? receiptFrom : null}
          onClose={() => setReceiptFrom(null)} onDone={() => { setReceiptFrom(null); onReload(); }} />
      )}
    </div>
  );
}

/* --- Прихід (модалка) --- */
function SupplyReceipt({ items, warehouse, prefill, onClose, onDone }) {
  const [cp, setCp] = useState("");
  const [lines, setLines] = useState(prefill || [{ item_id: "", qty: "", unit_cost: "" }]);
  const [busy, setBusy] = useState(false);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const set = (idx, ln) => setLines((ls) => ls.map((x, i) => (i === idx ? ln : x)));
  const total = lines.reduce((s, l) => {
    const c = l.unit_cost !== "" ? Number(l.unit_cost) : (byId[l.item_id]?.unit_cost || 0);
    return s + (Number(l.qty) || 0) * c;
  }, 0);
  const submit = async () => {
    const good = lines.filter((l) => l.item_id && Number(l.qty) > 0).map((l) => ({
      item_id: l.item_id, qty: Number(l.qty),
      unit_cost: l.unit_cost === "" ? undefined : Number(l.unit_cost),
    }));
    if (!good.length) return;
    setBusy(true);
    try { await whReceipt(warehouse, cp.trim(), good); pushToast({ title: "Прихід оформлено", body: suah(total) }); onDone(); }
    catch (e) { alert(e.message || e); setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wh-modal-h"><span>Прихід на {whName(warehouse)}</span><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="wh-modal-b">
          <label className="over-field" style={{ maxWidth: "100%" }}><span>Постачальник / № накладної</span>
            <input value={cp} onChange={(e) => setCp(e.target.value)} placeholder="напр. ФОП Іваненко, накл. №142" />
          </label>
          <div className="wh-lines">
            {lines.map((l, i) => (
              <SupplyLineRow key={i} items={items} line={l} exclude={new Set(lines.map((x) => x.item_id).filter((_, j) => j !== i))}
                priceCol onChange={(ln) => set(i, ln)} onRemove={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
            ))}
            <button className="wh-add" onClick={() => setLines((ls) => [...ls, { item_id: "", qty: "", unit_cost: "" }])}><Plus size={13} /> Ще позиція</button>
          </div>
          <div className="wh-modal-foot"><span>Сума</span><b>{suah(total)}</b></div>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "…" : "Оформити прихід"}</button>
          <p className="hint">Ціну можна лишити порожньою — візьметься з довідника. Якщо ввести іншу — довідник оновиться.</p>
        </div>
      </div>
    </div>, document.body);
}

/* --- Довідник --- */
function SupplyItemsView({ items, canManage, onReload }) {
  const [form, setForm] = useState(null); // null | 'new' | item
  return (
    <div className="wh-view">
      {canManage && !form && <button className="btn-secondary small" style={{ marginBottom: 12 }} onClick={() => setForm("new")}><Plus size={14} /> Нова позиція</button>}
      {form && <SupplyItemForm item={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); onReload(); }} />}
      <div className="wh-tw">
        <table className="wh-tbl">
          <thead><tr><th>Позиція</th><th>Категорія</th><th>Од.</th><th>Ціна</th><th>Мін центр</th><th>Мін салон</th><th /></tr></thead>
          <tbody>
            {[...items].sort((a, b) => catRank(a.category) - catRank(b.category) || a.sort - b.sort).map((i) => (
              <tr key={i.id}>
                <td className="wh-nm">{i.name}</td>
                <td className="muted">{i.category}</td>
                <td>{i.unit}</td>
                <td className="num">{canManage
                  ? <NumInput className="wh-price" value={i.unit_cost} onChange={(v) => setPrice(i.id, v).then(onReload).catch((e) => alert(e.message))} />
                  : suahN(i.unit_cost)}</td>
                <td className="num muted">{i.min_central}</td>
                <td className="num muted">{i.min_salon}</td>
                <td>{canManage && <button className="wh-link" onClick={() => setForm(i)}>ред.</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function SupplyItemForm({ item, onClose, onSaved }) {
  const [f, setF] = useState(item || { name: "", category: "інше", unit: "шт", unit_cost: 0, min_central: 0, min_salon: 0, active: true, sort: 100 });
  const [startQty, setStartQty] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      const saved = await upsertItem({ ...f, name: f.name.trim(), unit_cost: Number(f.unit_cost) || 0, min_central: Number(f.min_central) || 0, min_salon: Number(f.min_salon) || 0 });
      if (!item && startQty !== "" && Number(startQty) > 0) {
        await whAdjust(CENTRAL, "стартовий залишок нової позиції", [{ item_id: saved.id, qty: Number(startQty) }]);
      }
      pushToast({ title: item ? "Позицію оновлено" : "Позицію додано" });
      onSaved();
    } catch (e) { alert(e.message || e); setBusy(false); }
  };
  return (
    <div className="wh-form">
      <div className="wh-form-grid">
        <label className="over-field" style={{ gridColumn: "1/-1" }}><span>Назва</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></label>
        <label className="over-field"><span>Категорія</span>
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{SUPPLY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="over-field"><span>Одиниця</span>
          <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{SUPPLY_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        </label>
        <label className="over-field"><span>Ціна, ₴</span><div className="field-input-wrap"><NumInput className="field-input" value={f.unit_cost} onChange={(v) => setF({ ...f, unit_cost: v })} /></div></label>
        <label className="over-field"><span>Мін. на центр. складі</span><div className="field-input-wrap"><NumInput className="field-input" value={f.min_central} onChange={(v) => setF({ ...f, min_central: v })} /></div></label>
        <label className="over-field"><span>Мін. на салоні</span><div className="field-input-wrap"><NumInput className="field-input" value={f.min_salon} onChange={(v) => setF({ ...f, min_salon: v })} /></div></label>
        {!item && <label className="over-field"><span>Стартовий залишок центр. складу</span><div className="field-input-wrap"><NumInput className="field-input" allowEmpty value={startQty} onChange={setStartQty} /></div></label>}
      </div>
      <div className="wh-form-act">
        <button className="btn-secondary small" onClick={onClose}>Скасувати</button>
        <button className="btn-primary small" onClick={save} disabled={busy}>{busy ? "…" : "Зберегти"}</button>
      </div>
    </div>
  );
}

/* --- Мій склад (салон) --- */
function SupplySalonStock({ salonKey, items, stock, onOrderAll }) {
  const sm = stockMap(stock, salonKey);
  const rows = items.map((i) => {
    const qty = sm[i.id] || 0;
    return { i, qty, need: Math.max(0, i.min_salon - qty), state: stockState(qty, i.min_salon), value: qty * i.unit_cost };
  }).sort((a, b) => catRank(a.i.category) - catRank(b.i.category) || a.i.sort - b.i.sort);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const need = rows.filter((r) => r.need > 0);
  return (
    <div className="wh-view">
      <div className="wh-kpis">
        <div className="wh-kpi"><span>Вартість мого запасу</span><b>{suah(total)}</b></div>
        <div className={`wh-kpi ${need.length ? "attn" : ""}`}><span>Треба замовити</span><b>{need.length} поз.</b></div>
      </div>
      {need.length > 0 && <button className="btn-secondary small" style={{ margin: "4px 0 12px" }} onClick={() => onOrderAll(need.map((r) => ({ item_id: r.i.id, qty: String(r.need) })))}>Замовити все, що нижче мін</button>}
      <div className="wh-tw">
        <table className="wh-tbl">
          <thead><tr><th>Позиція</th><th>Залишок</th><th>Мін</th><th>Замовити</th><th>Вартість</th></tr></thead>
          <tbody>
            {rows.map(({ i, qty, need: n, state, value }) => (
              <tr key={i.id} className={`st-${state}`}>
                <td className="wh-nm">{i.name}<span className="wh-cat">{i.category}</span></td>
                <td className={`num ${qty < 0 ? "wh-neg" : ""}`}>{qty}</td>
                <td className="num muted">{i.min_salon}</td>
                <td className="num">{n > 0 ? <span className="wh-pill lo">{n}</span> : "—"}</td>
                <td className="num">{suahN(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- Замовити (будівник замовлення) --- */
function SupplyOrderBuilder({ salonKey, items, stock, order, prefill, onDone }) {
  const sm = stockMap(stock, salonKey);
  const [qty, setQty] = useState(() => {
    const q = {};
    (order?.lines || []).forEach((l) => { q[l.item_id] = String(l.qty_req); });
    (prefill || []).forEach((l) => { q[l.item_id] = l.qty; });
    return q;
  });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const lines = () => Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([item_id, v]) => ({ item_id, qty: Number(v) }));
  const sum = lines().reduce((s, l) => s + l.qty * (items.find((i) => i.id === l.item_id)?.unit_cost || 0), 0);
  const shown = items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => catRank(a.category) - catRank(b.category) || a.sort - b.sort);

  const save = async (submit) => {
    const ls = lines();
    if (!ls.length) return;
    setBusy(true);
    try {
      let id = order?.id;
      if (id) await saveOrderLines(id, ls);
      else { const o = await createOrder(salonKey, salonKey, ls); id = o.id; }
      if (submit) await submitOrder(id);
      pushToast({ title: submit ? "Замовлення подано" : "Чернетку збережено", body: `${ls.length} поз. · ${suah(sum)}` });
      onDone();
    } catch (e) { alert(e.message || e); setBusy(false); }
  };

  return (
    <div className="wh-view">
      <input className="wh-search" placeholder="Пошук позиції…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="wh-tw">
        <table className="wh-tbl">
          <thead><tr><th>Позиція</th><th>Залишок</th><th>Мін</th><th>Підказка</th><th>Замовити</th></tr></thead>
          <tbody>
            {shown.map((i) => {
              const s = sm[i.id] || 0;
              const sug = Math.max(0, i.min_salon - s);
              return (
                <tr key={i.id}>
                  <td className="wh-nm">{i.name}<span className="wh-cat">{i.category}</span></td>
                  <td className="num muted">{s}</td>
                  <td className="num muted">{i.min_salon}</td>
                  <td className="num">{sug > 0 ? <button className="wh-link" onClick={() => setQty((x) => ({ ...x, [i.id]: String(sug) }))}>+{sug}</button> : "—"}</td>
                  <td className="num"><NumInput className="wh-price" allowEmpty value={qty[i.id] ?? ""} onChange={(v) => setQty((x) => ({ ...x, [i.id]: v }))} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="wh-modal-foot"><span>{lines().length} поз.</span><b>{suah(sum)}</b></div>
      <div className="wh-form-act">
        <button className="btn-secondary small" onClick={() => save(false)} disabled={busy}>Зберегти чернетку</button>
        <button className="btn-primary small" onClick={() => save(true)} disabled={busy}>{busy ? "…" : "Подати замовлення"}</button>
      </div>
    </div>
  );
}

/* --- Замовлення (списки) --- */
function SupplyOrders({ scope, salonKey, tmKey, items, stock, onReload, onEditDraft }) {
  const [orders, setOrders] = useState(null);
  const [open, setOpen] = useState(null); // { order, lines }
  const [ship, setShip] = useState(null); // order being shipped
  const byId = Object.fromEntries((items || []).map((i) => [i.id, i]));
  const load = async () => {
    let list = [];
    if (scope === "mine") list = await listOrders({ salonKey });
    else if (scope === "incoming") list = (await listOrders({})).filter((o) => o.status !== "draft");
    else list = (await listOrders({})).filter((o) => salonsOfTm(tmKey).some((s) => s.key === o.salon_key));
    setOrders(list);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, salonKey]);
  if (orders === null) return <div className="loading">Завантаження…</div>;
  if (!orders.length) return <div className="admin-empty">Замовлень немає.</div>;

  const openOrder = async (o) => setOpen({ order: o, lines: await orderLines(o.id) });
  const receive = async (o) => {
    const ls = await orderLines(o.id);
    const recv = ls.map((l) => ({ item_id: l.item_id, qty: Number(l.qty_shipped ?? l.qty_req) || 0 }));
    if (!confirm(`Підтвердити отримання замовлення (${recv.length} поз.)?`)) return;
    try { await receiveOrder(o.id, o.salon_key, recv); pushToast({ title: "Отримання підтверджено" }); load(); onReload && onReload(); }
    catch (e) { alert(e.message || e); }
  };

  return (
    <div className="wh-view">
      <div className="wh-ord-list">
        {orders.map((o) => (
          <div className={`wh-ord ${o.status}`} key={o.id}>
            <div className="wh-ord-top">
              <span className="wh-ord-nm">{scope === "mine" ? monthLabel(o.created_at.slice(0, 7)) : salonByKey(o.salon_key)?.city}</span>
              <span className="wh-ord-st">{ORDER_ST[o.status]}</span>
              <span className="wh-ord-at">{fmtDate(o.created_at)}</span>
            </div>
            <div className="wh-ord-act">
              <button className="wh-link" onClick={() => openOrder(o)}>позиції</button>
              {scope === "mine" && o.status === "draft" && <button className="wh-link" onClick={() => onEditDraft(o)}>редагувати</button>}
              {scope === "mine" && o.status === "draft" && <button className="wh-link" onClick={() => { if (confirm("Видалити чернетку?")) deleteOrder(o.id).then(load); }}>видалити</button>}
              {scope === "mine" && o.status === "shipped" && <button className="btn-primary small" onClick={() => receive(o)}>Прийняти</button>}
              {scope === "incoming" && o.status === "submitted" && <button className="btn-primary small" onClick={() => setShip(o)}>Відправити</button>}
            </div>
          </div>
        ))}
      </div>

      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-h"><span>{salonByKey(open.order.salon_key)?.city} · {ORDER_ST[open.order.status]}</span><button className="modal-close" onClick={() => setOpen(null)}><X size={16} /></button></div>
            <div className="wh-modal-b">
              <table className="wh-tbl"><tbody>
                {open.lines.map((l) => (
                  <tr key={l.item_id}><td className="wh-nm">{byId[l.item_id]?.name}</td>
                    <td className="num">замовлено {l.qty_req}</td>
                    <td className="num">{l.qty_shipped != null ? `відправлено ${l.qty_shipped}` : ""}</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
        </div>,
        document.body
      )}
      {ship && <SupplyShip order={ship} items={items} stock={stock} onClose={() => setShip(null)} onDone={() => { setShip(null); load(); onReload && onReload(); }} />}
    </div>
  );
}

function SupplyShip({ order, items, stock, onClose, onDone }) {
  const [lines, setLines] = useState(null);
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);
  const cs = stockMap(stock, CENTRAL);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  useEffect(() => { orderLines(order.id).then((ls) => { setLines(ls); const q = {}; ls.forEach((l) => { q[l.item_id] = String(Math.min(l.qty_req, cs[l.item_id] ?? l.qty_req)); }); setQty(q); }); }, [order.id]);
  if (!lines) return null;
  const send = async () => {
    const ls = lines.map((l) => ({ item_id: l.item_id, qty: Number(qty[l.item_id]) || 0 })).filter((l) => l.qty > 0);
    setBusy(true);
    try { await shipOrder(order.id, order.salon_key, ls); pushToast({ title: "Відправлено", body: salonByKey(order.salon_key)?.city }); onDone(); }
    catch (e) { alert(e.message || e); setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wh-modal-h"><span>Відправити → {salonByKey(order.salon_key)?.city}</span><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="wh-modal-b">
          <table className="wh-tbl"><thead><tr><th>Позиція</th><th>Замовлено</th><th>На складі</th><th>Відправити</th></tr></thead>
            <tbody>{lines.map((l) => (
              <tr key={l.item_id}><td className="wh-nm">{byId[l.item_id]?.name}</td>
                <td className="num muted">{l.qty_req}</td>
                <td className={`num ${(cs[l.item_id] || 0) < l.qty_req ? "wh-neg" : "muted"}`}>{cs[l.item_id] || 0}</td>
                <td className="num"><NumInput className="wh-price" value={qty[l.item_id] ?? ""} onChange={(v) => setQty((x) => ({ ...x, [l.item_id]: v }))} /></td></tr>
            ))}</tbody>
          </table>
          <button className="btn-primary" onClick={send} disabled={busy}>{busy ? "…" : "Відправити й списати з центрального"}</button>
        </div>
      </div>
    </div>, document.body);
}

/* --- Акт списання (салон) --- */
function SupplyWriteoff({ salonKey, items, stock, onReload }) {
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState([{ item_id: "", qty: "" }]);
  const [acts, setActs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const cs = stockMap(stock, salonKey);
  const load = () => listActs({ warehouse: salonKey, kind: "writeoff" }).then(setActs).catch(() => setActs([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [salonKey]);

  const set = (idx, ln) => setLines((ls) => ls.map((x, i) => (i === idx ? ln : x)));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (byId[l.item_id]?.unit_cost || 0), 0);
  const submit = async () => {
    const good = lines.filter((l) => l.item_id && Number(l.qty) > 0).map((l) => ({ item_id: l.item_id, qty: Number(l.qty) }));
    if (!good.length || !reason.trim()) return;
    setBusy(true);
    try {
      await whWriteoff(salonKey, reason.trim(), good);
      pushToast({ title: "Акт списання створено", body: suah(total) });
      setReason(""); setLines([{ item_id: "", qty: "" }]); load(); onReload();
    } catch (e) { alert(e.message || e); setBusy(false); }
  };

  return (
    <div className="wh-view">
      <div className="wh-form">
        <label className="over-field" style={{ maxWidth: "100%" }}><span>Причина списання (обовʼязково)</span>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="напр. використано за вересень / зіпсовано при транспортуванні" />
        </label>
        <div className="wh-lines">
          {lines.map((l, i) => (
            <SupplyLineRow key={i} items={items} line={l} exclude={new Set(lines.map((x) => x.item_id).filter((_, j) => j !== i))}
              onChange={(ln) => set(i, ln)} onRemove={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
          ))}
          <button className="wh-add" onClick={() => setLines((ls) => [...ls, { item_id: "", qty: "" }])}><Plus size={13} /> Ще позиція</button>
        </div>
        <div className="wh-modal-foot"><span>Сума списання</span><b>{suah(total)}</b></div>
        <button className="btn-primary small" onClick={submit} disabled={busy || !reason.trim()}>{busy ? "…" : "Створити акт списання"}</button>
      </div>

      <h4 className="wh-h4">Складські акти</h4>
      {acts === null ? <div className="loading">…</div> : acts.length === 0 ? <p className="hint">Актів ще немає.</p> : (
        <div className="wh-acts">
          {acts.map((a) => (
            <div className="wh-act" key={a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
              <div className="wh-act-top">
                <span className="wh-act-sum">−{suahN(a.total)} ₴</span>
                <span className="wh-act-reason">{a.reason || "—"}</span>
                <span className="wh-act-at">{fmtDate(a.created_at)}</span>
              </div>
              {open === a.id && <WhActLines actId={a.id} byId={byId} sign="−" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function WhActLines({ actId, byId, sign }) {
  const [ls, setLs] = useState(null);
  useEffect(() => { actLines(actId).then(setLs).catch(() => setLs([])); }, [actId]);
  if (!ls) return null;
  return (
    <div className="wh-act-lines">
      {ls.map((l) => (
        <div key={l.item_id}><span>{byId[l.item_id]?.name || "?"}</span><span className="mono">{sign || ""}{l.qty} · {suahN(l.qty * l.unit_cost)} ₴</span></div>
      ))}
    </div>
  );
}

/* --- Складські акти центрального складу --- */
function SupplyActsView({ warehouse, items }) {
  const [acts, setActs] = useState(null);
  const [kind, setKind] = useState("");
  const [open, setOpen] = useState(null);
  const byId = Object.fromEntries((items || []).map((i) => [i.id, i]));
  useEffect(() => { listActs({ warehouse, kind: kind || undefined }).then(setActs).catch(() => setActs([])); }, [warehouse, kind]);
  const signOf = (k) => (k === "writeoff" || k === "shipment" ? "−" : k === "adjust" ? "" : "+");
  return (
    <div className="wh-view">
      <div className="wh-bar">
        <select className="inv-toolbar-sel" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">усі акти</option>
          {Object.entries(ACT_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {acts === null ? <div className="loading">…</div> : acts.length === 0 ? <p className="hint">Актів немає.</p> : (
        <div className="wh-acts">
          {acts.map((a) => (
            <div className={`wh-act k-${a.kind}`} key={a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
              <div className="wh-act-top">
                <span className="wh-act-kind">{ACT_KIND[a.kind]}</span>
                <span className="wh-act-sum">{signOf(a.kind)}{suahN(a.total)} ₴</span>
                <span className="wh-act-reason">{a.counterparty || a.reason || (a.order_id ? "замовлення салону" : "")}</span>
                <span className="wh-act-at">{fmtDate(a.created_at)}</span>
              </div>
              {open === a.id && <WhActLines actId={a.id} byId={byId} sign={signOf(a.kind)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Склади території (ТМ) --- */
function SupplyTerritory({ tmKey, items, stock }) {
  const salons = salonsOfTm(tmKey);
  const [pick, setPick] = useState(salons[0]?.key);
  return (
    <div className="wh-view">
      <div className="tm-salon-chips" style={{ marginBottom: 14 }}>
        {salons.map((s) => <button key={s.key} className={`chip ${s.key === pick ? "active" : ""}`} onClick={() => setPick(s.key)}>{s.city}</button>)}
      </div>
      {pick && <SupplySalonStock salonKey={pick} items={items} stock={stock} onOrderAll={() => {}} />}
    </div>
  );
}

/* --- модуль «Склад» --- */
function SupplyModule({ cab }) {
  const manageWh = cab.key === "lviv-lypynskoho" || cab.key === "olha" || cab.type === "manager";
  const salonKey = cab.type === "sm" ? cab.key : null;
  const isTm = cab.type === "tm";
  const { items, stock, reload } = useSupply();
  const [orderPrefill, setOrderPrefill] = useState(null);
  const [editOrder, setEditOrder] = useState(null);

  const subs = [];
  if (manageWh) subs.push(["central", "Основний склад"], ["incoming", "Замовлення салонів"], ["acts", "Складські акти"], ["items", "Довідник"]);
  if (salonKey) subs.push(["mine", "Мій склад"], ["order", "Замовити"], ["myorders", "Мої замовлення"], ["writeoff", "Акт списання"]);
  if (isTm) subs.push(["terr", "Склади території"], ["torders", "Замовлення території"]);
  const [tab, setTab] = useState(subs[0]?.[0] || "central");

  if (items === null) return <div className="loading">Завантаження…</div>;
  const goOrder = (prefill) => { setOrderPrefill(prefill); setEditOrder(null); setTab("order"); };

  return (
    <div className="tasks-mod wh-mod">
      <div className="tasks-head"><h3 className="ov-h">Склад господарських потреб</h3></div>
      <div className="cab-nav wh-nav">
        {subs.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === "central" && <SupplyCentral items={items} stock={stock} canManage={manageWh} onReload={reload} />}
      {tab === "items" && <SupplyItemsView items={items} canManage={manageWh} onReload={reload} />}
      {tab === "acts" && <SupplyActsView warehouse={CENTRAL} items={items} />}
      {tab === "incoming" && <SupplyOrders scope="incoming" items={items} stock={stock} onReload={reload} onEditDraft={() => {}} />}
      {tab === "mine" && <SupplySalonStock salonKey={salonKey} items={items} stock={stock} onOrderAll={goOrder} />}
      {tab === "order" && <SupplyOrderBuilder salonKey={salonKey} items={items} stock={stock} order={editOrder} prefill={orderPrefill} onDone={() => { setOrderPrefill(null); setEditOrder(null); reload(); setTab("myorders"); }} />}
      {tab === "myorders" && <SupplyOrders scope="mine" salonKey={salonKey} items={items} stock={stock} onReload={reload} onEditDraft={(o) => { orderLines(o.id).then((ls) => { setEditOrder({ ...o, lines: ls }); setOrderPrefill(null); setTab("order"); }); }} />}
      {tab === "writeoff" && <SupplyWriteoff salonKey={salonKey} items={items} stock={stock} onReload={reload} />}
      {tab === "terr" && <SupplyTerritory tmKey={cab.tmKey || cab.key} items={items} stock={stock} />}
      {tab === "torders" && <SupplyOrders scope="territory" tmKey={cab.tmKey || cab.key} items={items} stock={stock} onReload={reload} onEditDraft={() => {}} />}
    </div>
  );
}

/* ==================== ВИТРАТИ ПО СМ ==================== */
function ExpensesModule({ cab }) {
  const own = cab.type === "sm" ? cab.key : null;
  const scopeSalons = cab.type === "tm" ? salonsOfTm(cab.tmKey || cab.key) : (own ? [salonByKey(own)].filter(Boolean) : SALONS);
  const [pick, setPick] = useState(own || (scopeSalons.length > 1 ? "all" : scopeSalons[0]?.key));
  const [lines, setLines] = useState(null);
  const [items, setItems] = useState({});
  const [openM, setOpenM] = useState(null);
  const [cmp, setCmp] = useState(false);
  const months = useMemo(() => recentMonths(12), []);
  const [pa, setPa] = useState(months[1]);
  const [pb, setPb] = useState(months[0]);

  useEffect(() => {
    listItems({ includeArchived: true }).then((it) => setItems(Object.fromEntries(it.map((i) => [i.id, i]))));
  }, []);
  useEffect(() => {
    const from = `${months[months.length - 1]}-01`;
    const sk = pick === "all" ? undefined : pick;
    writeoffLines({ from, salonKey: sk })
      .then((ls) => (cab.type === "tm" && pick === "all"
        ? ls.filter((l) => scopeSalons.some((s) => s.key === l.act.warehouse))
        : ls))
      .then(setLines).catch(() => setLines([]));
    // eslint-disable-next-line
  }, [pick]);

  if (lines === null) return <div className="loading">Завантаження…</div>;

  const byMonth = {};
  for (const l of lines) {
    const ym = (l.act?.created_at || "").slice(0, 7);
    if (!ym) continue;
    (byMonth[ym] = byMonth[ym] || { total: 0, items: {} });
    const v = Number(l.qty) * Number(l.unit_cost);
    byMonth[ym].total += v;
    const it = byMonth[ym].items[l.item_id] = byMonth[ym].items[l.item_id] || { qty: 0, sum: 0 };
    it.qty += Number(l.qty); it.sum += v;
  }
  const monthRows = months.filter((m) => byMonth[m]).map((m) => ({ ym: m, ...byMonth[m] }));
  const periodItems = (ym) => Object.entries(byMonth[ym]?.items || {})
    .map(([id, x]) => ({ name: items[id]?.name || "?", ...x }))
    .sort((a, b) => b.sum - a.sum);

  return (
    <div className="tasks-mod">
      <div className="tasks-head"><h3 className="ov-h">Витрати по СМ · господарські потреби</h3></div>

      {scopeSalons.length > 1 && (
        <div className="tm-salon-chips" style={{ marginBottom: 12 }}>
          <button className={`chip ${pick === "all" ? "active" : ""}`} onClick={() => setPick("all")}>усі</button>
          {scopeSalons.map((s) => <button key={s.key} className={`chip ${pick === s.key ? "active" : ""}`} onClick={() => setPick(s.key)}>{s.city}</button>)}
        </div>
      )}
      <button className="btn-secondary small" style={{ marginBottom: 12 }} onClick={() => setCmp((v) => !v)}>
        {cmp ? "Звичайний вигляд" : "Порівняти витрати"}
      </button>

      {cmp ? (
        <div className="exp-cmp">
          <div className="exp-cmp-pick">
            <select className="inv-toolbar-sel" value={pa} onChange={(e) => setPa(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
            <span>vs</span>
            <select className="inv-toolbar-sel" value={pb} onChange={(e) => setPb(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
          </div>
          <div className="exp-cmp-cols">
            {[pa, pb].map((ym) => (
              <div className="exp-col" key={ym}>
                <div className="exp-col-h">{monthLabel(ym)}<b>{suah(byMonth[ym]?.total || 0)}</b></div>
                {periodItems(ym).length === 0 ? <p className="hint">немає списань</p> : periodItems(ym).map((r) => (
                  <div className="exp-row" key={r.name}><span>{r.name}</span><span className="mono">{r.qty} · {suahN(r.sum)} ₴</span></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : monthRows.length === 0 ? (
        <div className="admin-empty">Списань ще немає.</div>
      ) : (
        <div className="exp-months">
          {monthRows.map((m) => (
            <div className="exp-month" key={m.ym}>
              <button className="exp-month-h" onClick={() => setOpenM(openM === m.ym ? null : m.ym)}>
                <span>{monthLabel(m.ym)}</span>
                <b>{suah(m.total)}</b>
                <ChevronRight size={15} style={{ transform: openM === m.ym ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </button>
              {openM === m.ym && (
                <div className="exp-month-b">
                  {periodItems(m.ym).map((r) => (
                    <div className="exp-row" key={r.name}><span>{r.name}</span><span className="mono">{r.qty} · {suahN(r.sum)} ₴</span></div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="hint" style={{ marginTop: 14 }}>Зараз тут витрати зі складських актів списання. Блок витрат розширюватимемо.</p>
    </div>
  );
}

/* Персональне налаштування лівої навігації (порядок + приховані пункти).
   Зберігається локально на пристрої, окремо для кожного кабінету. */
function useNavPrefs(cabKey, itemKeys) {
  const storeKey = `dnipro-m-nav:${cabKey}`;
  const [prefs, setPrefs] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(storeKey) || "{}");
      return { order: Array.isArray(p.order) ? p.order : [], hidden: Array.isArray(p.hidden) ? p.hidden : [] };
    } catch { return { order: [], hidden: [] }; }
  });
  const save = (next) => {
    setPrefs(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  // впорядкувати за збереженим порядком; невідомі (нові) ключі — у їхній первісній позиції
  const ordered = (() => {
    const known = prefs.order.filter((k) => itemKeys.includes(k));
    const rest = itemKeys.filter((k) => !known.includes(k));
    if (!known.length) return itemKeys.slice();
    const out = [];
    // вставляємо rest приблизно там, де вони стоять у оригіналі
    itemKeys.forEach((k, i) => {
      if (rest.includes(k)) out.push({ k, i });
    });
    const merged = known.slice();
    out.forEach(({ k, i }) => {
      const at = Math.min(i, merged.length);
      merged.splice(at, 0, k);
    });
    return merged.filter((k, i) => merged.indexOf(k) === i);
  })();

  const move = (key, dir) => {
    const arr = ordered.slice();
    const i = arr.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save({ ...prefs, order: arr });
  };
  const moveTo = (key, targetKey) => {
    if (key === targetKey) return;
    const arr = ordered.filter((k) => k !== key);
    const at = arr.indexOf(targetKey);
    if (at < 0) return;
    arr.splice(at, 0, key);
    save({ ...prefs, order: arr });
  };
  const toggleHidden = (key) => {
    const hidden = prefs.hidden.includes(key)
      ? prefs.hidden.filter((k) => k !== key)
      : [...prefs.hidden, key];
    if (hidden.length >= itemKeys.length) return; // не ховати геть усе
    save({ ...prefs, hidden });
  };
  const reset = () => save({ order: [], hidden: [] });

  return { ordered, hidden: prefs.hidden, customised: !!(prefs.order.length || prefs.hidden.length), move, moveTo, toggleHidden, reset };
}

function CabinetShell({ title, onExit, onLogout, modules, cabKey, banner }) {
  const items = modules.filter(Boolean);
  const byKey = React.useMemo(() => Object.fromEntries(items.map((m) => [m.key, m])), [items]);
  const nav = useNavPrefs(cabKey, items.map((m) => m.key));
  const [editNav, setEditNav] = useState(false);
  const [dragKey, setDragKey] = useState(null);

  const orderedItems = nav.ordered.map((k) => byKey[k]).filter(Boolean);
  const visibleItems = orderedItems.filter((m) => !nav.hidden.includes(m.key));
  const shownItems = editNav ? orderedItems : visibleItems;

  const [activeReq, setActive] = useState(items[0].key);
  const [navOpen, setNavOpen] = useState(false); // мобільна шухляда
  // якщо обраний пункт приховано — показуємо перший видимий (без ефекту, прямо при рендері)
  const active = (!editNav && !visibleItems.some((m) => m.key === activeReq))
    ? (visibleItems[0]?.key ?? activeReq)
    : activeReq;
  const mod = byKey[active] || visibleItems[0] || items[0];
  const pick = (key) => { setActive(key); setNavOpen(false); };

  return (
    <div className="view cab-shell">
      <TopBar title={title} onBack={onExit} onLogout={onLogout} cabKey={cabKey} onMenu={() => setNavOpen((v) => !v)} />
      <div className={`cab-scrim ${navOpen ? "on" : ""}`} onClick={() => setNavOpen(false)} />
      {banner}
      <div className="cab-layout">
        <nav className={`cab-side ${editNav ? "editing" : ""} ${navOpen ? "open" : ""}`}>
          {shownItems.map((m) => {
            const isHidden = nav.hidden.includes(m.key);
            return (
              <React.Fragment key={m.key}>
                {m.divider && !editNav && <span className="cab-side-sep" />}
                <div
                  className={`cab-side-row ${dragKey === m.key ? "dragging" : ""}`}
                  draggable={editNav}
                  onDragStart={editNav ? () => setDragKey(m.key) : undefined}
                  onDragOver={editNav ? (e) => e.preventDefault() : undefined}
                  onDrop={editNav ? () => { if (dragKey) nav.moveTo(dragKey, m.key); setDragKey(null); } : undefined}
                  onDragEnd={() => setDragKey(null)}
                >
                  {editNav && <span className="cab-side-grip"><GripVertical size={15} /></span>}
                  <button
                    className={`cab-side-item ${m.key === active && !editNav ? "active" : ""} ${editNav && isHidden ? "is-hidden" : ""}`}
                    onClick={() => (editNav ? nav.toggleHidden(m.key) : pick(m.key))}
                    title={editNav ? (isHidden ? "Показати" : "Приховати") : undefined}
                  >
                    {m.icon}
                    <span className="cab-side-label">{m.label}</span>
                    {!editNav && m.badge != null && <span className={`badge ${m.badgeTone || "badge-warn"}`}>{m.badge}</span>}
                    {editNav && <span className="cab-side-eye">{isHidden ? <EyeOff size={15} /> : <Eye size={15} />}</span>}
                  </button>
                </div>
              </React.Fragment>
            );
          })}
          <span className="cab-side-sep" />
          <button className="cab-side-cfg" onClick={() => setEditNav((v) => !v)}>
            {editNav ? <><Check size={15} /> Готово</> : <><SlidersHorizontal size={15} /> Налаштувати меню</>}
          </button>
          {editNav && nav.customised && (
            <button className="cab-side-cfg subtle" onClick={nav.reset}>
              <RefreshCw size={14} /> Скинути до типового
            </button>
          )}
          {editNav && <p className="cab-side-tip">Перетягніть, щоб змінити порядок. Натисніть пункт, щоб приховати або повернути.</p>}
        </nav>
        <div className="cab-content">{mod.render()}</div>
      </div>
    </div>
  );
}

const WHATIF_STEPS = [70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130];

function TmWhatIf({ base }) {
  // base: { plan, ez, curve: [{pct,total}], current }
  const clampPct = (p) => Math.max(WHATIF_STEPS[0], Math.min(WHATIF_STEPS[WHATIF_STEPS.length - 1], p));
  const [pct, setPct] = useState(() => clampPct(Math.round(base.current || 100)));
  const curve = base.curve;
  // лінійна інтерполяція між вузлами кривої
  const at = (p) => {
    const lo = [...curve].reverse().find((c) => c.pct <= p) || curve[0];
    const hi = curve.find((c) => c.pct >= p) || curve[curve.length - 1];
    if (lo.pct === hi.pct) return lo.total;
    const k = (p - lo.pct) / (hi.pct - lo.pct);
    return lo.total + k * (hi.total - lo.total);
  };
  const total = at(pct);
  const diff = total - at(clampPct(base.current || 100));
  const flat = curve.every((c) => c.total === curve[0].total);
  return (
    <div className="chart-wrap ov-whatif">
      <div className="ov-card-h">Калькулятор «що якщо»</div>
      <p className="ov-card-sub">Якщо територія виконає план на <b>{pct}%</b> — очікувана ЗП за місяць:</p>
      <div className="wi-value">{fmt(total)}</div>
      {flat ? (
        <div className="wi-diff flat">ЗП тримається на мінімумі грейду — заповніть блоки 2–3 у розрахунку для точного прогнозу</div>
      ) : Math.abs(diff) >= 500 && (
        <div className={`wi-diff ${diff > 0 ? "up" : "down"}`}>
          {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))} до поточного темпу ({Math.round(base.current)}%)
        </div>
      )}
      <input
        type="range" className="wi-slider"
        min={WHATIF_STEPS[0]} max={WHATIF_STEPS[WHATIF_STEPS.length - 1]} step={1}
        value={pct} onChange={(e) => setPct(+e.target.value)}
        aria-label="Виконання плану, %"
      />
      <div className="wi-scale"><span>70%</span><span>100%</span><span>130%</span></div>
      <div className="wi-chart">
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={curve} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 5" stroke="#D9D2BE" vertical={false} />
            <XAxis dataKey="pct" tick={{ fontSize: 10, fill: "#8A8069" }} tickFormatter={(v) => `${v}%`}
              axisLine={{ stroke: "#D9D2BE" }} tickLine={false} interval={2} />
            <YAxis hide domain={["dataMin - 2000", "dataMax + 2000"]} />
            <Tooltip formatter={(v) => fmt(v)} labelFormatter={(v) => `План ${v}%`}
              contentStyle={{ borderRadius: 8, border: "1px solid #E1D9C1", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} />
            <ReferenceLine x={curve.reduce((a, c) => (Math.abs(c.pct - pct) < Math.abs(a - pct) ? c.pct : a), curve[0].pct)}
              stroke="#BE8A2E" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="total" stroke="#BE8A2E" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-note">Змінюється лише Факт продажів (п. 1.1). Квартальні бонуси, аванс і коригування керівника не враховані.</p>
    </div>
  );
}

/* Смужка-нагадування про подачу ЗП за попередній місяць — вгорі кабінету,
   видима на всіх вкладках, поки не подано. */
function SalaryDeadlineBanner({ role, tmKey, salonKey }) {
  const [state, setState] = useState(null); // { pending, overdue, dl } | { done:true } | null
  useEffect(() => {
    let active = true;
    const ym = salaryYm();
    const dl = deadlineInfo(ym);
    (async () => {
      try {
        if (role === "tm") {
          const d = await loadData(tmKey, ym);
          const pending = d.status === "draft" || d.status === "corrected";
          if (active) setState({ pending, overdue: dl.overdue, dl, ym });
        } else {
          const emps = await listEmployees().catch(() => []);
          const rows = await salonSalaryRows(salonKey, ym, emps);
          const pending = rows.length === 0 || rows.some((r) => r.data.status !== "submitted" && r.data.status !== "corrected" && r.data.status !== "approved");
          if (active) setState({ pending, overdue: dl.overdue, dl, ym, count: rows.filter((r) => r.data.status === "draft").length, total: rows.length });
        }
      } catch { if (active) setState(null); }
    })();
    return () => { active = false; };
  }, [role, tmKey, salonKey]);

  if (!state || !state.pending) return null;
  const per = monthLabel(state.ym);
  return (
    <div className={`salary-strip ${state.overdue ? "late" : ""}`}>
      <AlertTriangle size={15} />
      {state.overdue
        ? `Термін подачі ЗП за ${per} минув (був до ${state.dl.dueLabel}) — подайте якнайшвидше`
        : `Подайте ЗП за ${per} до ${state.dl.dueLabel}`}
    </div>
  );
}

function TmOverview({ tmKey }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let active = true;
    const ym = salaryYm();
    (async () => {
      const [d, g, invoices, employees] = await Promise.all([
        loadData(tmKey, ym), loadGrade(tmKey, ymToQuarter(ym)), listInvoices().catch(() => []), listEmployees().catch(() => []),
      ]);
      const salons = salonsOfTm(tmKey, ym);
      let submitted = 0;
      let salonPayroll = 0;
      for (const sl of salons) {
        const rows = await salonSalaryRows(sl.key, ym, employees);
        if (rows.length && rows.every((r) => r.data.status === "submitted" || r.data.status === "corrected")) submitted += 1;
        salonPayroll += rows.reduce((a, r) => a + r.total, 0);
      }
      const calc = await calcTm(d, g, tmKey, ym);
      const invM = invoices.filter((inv) => invMonth(inv) === ym && inv.status !== "cancelled");
      const invIssued = invM.reduce((a, i) => a + Number(i.amount || 0), 0);
      const invPaid = invM.filter((i) => i.status !== "issued").reduce((a, i) => a + Number(i.amount || 0), 0);

      // --- історія за 6 місяців (для дельт, спарклайнів, графіка по блоках) ---
      let hist = [];
      try {
        let ms = (await listMonths(tmKey)).sort();
        if (!ms.includes(ym)) ms.push(ym);
        ms = ms.slice(-6);
        const datas = await Promise.all(ms.map((m) => loadData(tmKey, m)));
        const grades = await Promise.all(ms.map((m) => loadGrade(tmKey, ymToQuarter(m))));
        const calcs = await calcTmBatch(ms.map((m, i) => ({ data: datas[i], grade: grades[i], tmKey, ym: m })));
        hist = ms.map((m, i) => {
          const c = calcs[i];
          const mi = Number(m.split("-")[1]) - 1;
          return {
            ym: m, m: MON_SHORT[mi],
            total: Math.round(c.floored),
            b1: Math.round(c.b1.subtotal),
            b2: Math.round(c.b2.subtotal + c.ez.bonus),
            b3: Math.round(c.b3.subtotal),
            pct: c.b1.d.sales.pct || 0,
          };
        });
      } catch { hist = []; }

      // --- калькулятор «що якщо» ---
      let whatif = null;
      const plan = Number(d.block1?.salesPlan || 0);
      const ez = Number(d.block1?.salesEz || 0);
      if (plan > 0) {
        try {
          const items = WHATIF_STEPS.map((p) => ({
            data: { ...d, block1: { ...d.block1, salesFact: Math.round((plan * p) / 100 + ez) } },
            grade: g, tmKey, ym,
          }));
          const calcs = await calcTmBatch(items);
          whatif = {
            plan, ez, current: calc.b1.d.sales.pct || 0,
            curve: WHATIF_STEPS.map((p, i) => ({ pct: p, total: Math.round(calcs[i].floored) })),
          };
        } catch { whatif = null; }
      }

      const curFinal = d.status !== "draft";        // місяць подано/погоджено → порівняння коректне
      const hasPct = plan > 0 || curFinal;
      if (active) setS({
        status: d.status, total: calc.floored, pct: calc.b1.d.sales.pct || 0, curFinal, hasPct, ym,
        submitted, salonTotal: salons.length,
        invIssued, invPaid, invCount: invM.length, salonPayroll, hist, whatif,
      });
    })();
    return () => { active = false; };
  }, [tmKey]);
  if (!s) return <div className="loading">Завантаження…</div>;
  const st = { draft: "чернетка", submitted: "на розгляді", corrected: "потребує коректив", approved: "погоджено" }[s.status] || "—";
  const notSubmitted = s.salonTotal - s.submitted;

  // для трендів ігноруємо поточний місяць, поки він чернетка (неповний)
  const vizHist = s.curFinal ? s.hist : s.hist.filter((h) => h.ym !== s.ym);
  const prev = s.curFinal && vizHist.length >= 2 ? vizHist[vizHist.length - 2] : null;
  const dZP = prev ? s.total - prev.total : null;
  const dPct = prev ? s.pct - prev.pct : null;
  const chartData = vizHist.length >= 2 ? vizHist : null;
  const sparkZP = vizHist.map((h) => h.total);
  const sparkPct = vizHist.map((h) => h.pct);

  return (
    <div className="ov">
      <h3 className="ov-h">Огляд</h3>
      <p className="ov-sub">ЗП за {monthLabel(salaryYm())}</p>
      <div className="ov-tiles">
        <div className="ov-tile ov-tile-kpi">
          <b>{fmt(s.total)}</b>
          <span>моя ЗП · {st}</span>
          {s.curFinal ? <Delta value={dZP} suffix="до місяця" /> : <span className="kpi-delta flat">чернетка · дельта після подачі</span>}
          <Spark data={sparkZP} />
        </div>
        <div className="ov-tile ov-tile-kpi">
          <b>{s.hasPct ? `${s.pct.toFixed(0)}%` : "—"}</b>
          <span>план по ТО{s.hasPct && !s.curFinal ? " · чернетка" : ""}</span>
          {s.curFinal ? <Delta value={dPct} unit=" п.п." suffix="до місяця" /> : <span className="kpi-delta flat">за поточний місяць</span>}
          <Spark data={sparkPct} />
        </div>
        <div className={`ov-tile ${notSubmitted > 0 ? "ov-tile-attn" : ""}`}>
          <b>{s.submitted} / {s.salonTotal}</b>
          <span>{notSubmitted > 0 ? `салони подали ЗП · ${notSubmitted} чекаємо` : "усі салони подали ЗП"}</span>
        </div>
        <div className="ov-tile"><b>{fmt(s.salonPayroll)}</b><span>ФОП салонів за місяць</span></div>
        <div className="ov-tile"><b>{invMoney(s.invIssued)}</b><span>безнал за місяць · {s.invCount} рах.</span></div>
        <div className="ov-tile"><b>{invMoney(s.invPaid)}</b><span>з них оплачено+</span></div>
      </div>

      <div className="ov-charts">
        <div className="chart-wrap">
          <div className="ov-card-h">Моя ЗП по блоках · {chartData ? `${chartData.length} міс` : "історія накопичується"}</div>
          {chartData ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="g-b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6E8DAA" stopOpacity="0.5" /><stop offset="1" stopColor="#6E8DAA" stopOpacity="0.05" /></linearGradient>
                  <linearGradient id="g-b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5AA6A0" stopOpacity="0.5" /><stop offset="1" stopColor="#5AA6A0" stopOpacity="0.05" /></linearGradient>
                  <linearGradient id="g-b3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#DCA94A" stopOpacity="0.55" /><stop offset="1" stopColor="#DCA94A" stopOpacity="0.05" /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 5" stroke="#D9D2BE" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#8A8069" }} tickMargin={8} axisLine={{ stroke: "#D9D2BE" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8069" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v, n) => [fmt(v), n]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #E1D9C1", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="circle" />
                <Area type="monotone" dataKey="b3" name="Блок 3 · управління" stackId="1" stroke="#DCA94A" fill="url(#g-b3)" strokeWidth={2} />
                <Area type="monotone" dataKey="b2" name="Блок 2 · економіка" stackId="1" stroke="#5AA6A0" fill="url(#g-b2)" strokeWidth={2} />
                <Area type="monotone" dataKey="b1" name="Блок 1 · продажі" stackId="1" stroke="#6E8DAA" fill="url(#g-b1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="chart-note">Графік зʼявиться, коли буде щонайменше 2 місяці розрахунків.</p>
          )}
        </div>

        {s.whatif
          ? <TmWhatIf base={s.whatif} />
          : (
            <div className="chart-wrap ov-whatif">
              <div className="ov-card-h">Калькулятор «що якщо»</div>
              <p className="chart-note">Внесіть <b>План продажів</b> у розрахунку ЗП (п. 1.1) — і тут зʼявиться прогноз: скільки буде ЗП за різного виконання плану.</p>
            </div>
          )}
      </div>
    </div>
  );
}

function SmOverview({ salon }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let active = true;
    const ym = salaryYm();
    (async () => {
      const [invoices, employees] = await Promise.all([listInvoices().catch(() => []), listEmployees().catch(() => [])]);
      const rows = await salonSalaryRows(salon.key, ym, employees);
      if (!active) return;
      const invM = invoices.filter((i) => invMonth(i) === ym && i.status !== "cancelled");
      const pending = rows.filter((r) => r.data.status !== "submitted" && r.data.status !== "corrected").length;
      setS({
        payroll: rows.reduce((a, r) => a + r.total, 0), headcount: rows.length, pending,
        invSum: invM.reduce((a, i) => a + Number(i.amount || 0), 0), invCount: invM.length,
      });
    })();
    return () => { active = false; };
  }, [salon.key]);
  if (!s) return <div className="loading">Завантаження…</div>;
  return (
    <div className="ov">
      <h3 className="ov-h">Огляд</h3>
      <p className="ov-sub">ЗП за {monthLabel(salaryYm())}</p>
      <div className="ov-tiles">
        <div className="ov-tile"><b>{fmt(s.payroll)}</b><span>ФОП магазину за місяць</span></div>
        <div className="ov-tile"><b>{s.headcount - s.pending} / {s.headcount}</b><span>ЗП подано</span></div>
        <div className="ov-tile"><b>{invMoney(s.invSum)}</b><span>безнал за місяць · {s.invCount} рах.</span></div>
      </div>
    </div>
  );
}

function TmCabinet({ tmKey, onExit, onLogout }) {
  const tm = tmByKey(tmKey);
  const isAdmin = tmKey === ADMIN_KEY;
  const modules = [
    { key: "overview", label: "Огляд", icon: <LayoutGrid size={16} />, render: () => <TmOverview tmKey={tmKey} /> },
    { key: "salary", label: "Розрахунок ЗП", icon: <Calculator size={16} />, render: () => <TmView tmKey={tmKey} tmName={tm.name} embedded /> },
    { key: "salons", label: "ЗП салонів", icon: <Store size={16} />, render: () => <SalonReviewPanel tmKey={tmKey} reviewer="tm" /> },
    { key: "tasks", label: "Задачі", icon: <CheckSquare size={16} />, render: () => <TasksModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "planner", label: "Планер", icon: <CalendarRange size={16} />, render: () => <PlannerModule tmKey={tmKey} /> },
    { key: "regionsheet", label: "Офіційні виплати", icon: <Table size={16} />, render: () => <RegionSheetModule /> },
    { key: "kpi", label: "Показники території", icon: <BarChart3 size={16} />, render: () => <TerritoryModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "warehouse", label: "Склад", icon: <Warehouse size={16} />, render: () => <SupplyModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "expenses", label: "Витрати по СМ", icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "team", label: "Команда", icon: <Users size={16} />, divider: true, render: () => <EmployeesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "shifts", label: "Графік змін", icon: <Calendar size={16} />, render: () => <ShiftScheduleModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "archive", label: "Архів", icon: <ArchiveIcon size={16} />, render: () => <EmployeesModule cab={{ key: tmKey, type: "tm", tmKey }} archive /> },
    { key: "docs", label: "Документи й стандарти", icon: <FileText size={16} />, divider: true, render: () => <ModuleStub name="Документи й стандарти" /> },
    { key: "bn", label: "Безнальні рахунки", icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    isAdmin ? { key: "admin", label: "Адміністрування", icon: <User size={16} />, divider: true, render: () => <AdminPanel /> } : null,
  ];
  return (
    <CabinetShell
      title={`ТМ · ${tm.name}`} onExit={onExit} onLogout={onLogout} modules={modules} cabKey={tmKey}
      banner={<SalaryDeadlineBanner role="tm" tmKey={tmKey} />}
    />
  );
}

function ManagerCabinet({ onExit, onLogout }) {
  const cab = { key: "manager", type: "manager" };
  const modules = [
    { key: "home", label: "Головна", icon: <LayoutGrid size={16} />, render: () => <ManagerCashOverview /> },
    { key: "byTm", label: "По ТМ", icon: <Users size={16} />, render: () => <ManagerView embedded /> },
    { key: "consol", label: "Зведення ЗП", icon: <Wallet size={16} />, render: () => <ConsolidationPanel role="manager" /> },
    { key: "cash", label: "Готівка", icon: <Banknote size={16} />, render: () => <ManagerCashTab /> },
    { key: "warehouse", label: "Склад", icon: <Warehouse size={16} />, render: () => <SupplyModule cab={cab} /> },
    { key: "expenses", label: "Витрати по СМ", icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={cab} /> },
    { key: "tasks", label: "Задачі", icon: <CheckSquare size={16} />, divider: true, render: () => <TasksModule cab={cab} /> },
    { key: "inv", label: "Рахунки", icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={cab} /> },
    { key: "team", label: "Команда", icon: <Users size={16} />, render: () => (<><EmployeesModule cab={cab} /><EmployeesModule cab={cab} archive /></>) },
    { key: "shifts", label: "Графік", icon: <Calendar size={16} />, render: () => <ShiftScheduleModule cab={cab} /> },
    { key: "kpi", label: "Показники території", icon: <BarChart3 size={16} />, render: () => <TerritoryModule cab={cab} /> },
    { key: "sheet", label: "Офіційні виплати", icon: <Table size={16} />, render: () => <RegionSheetModule /> },
  ];
  return <CabinetShell title={MANAGER.name} onExit={onExit} onLogout={onLogout} modules={modules} cabKey="manager" />;
}

function AccountantCabinet({ onExit, onLogout }) {
  const cab = { key: "accountant", type: "accountant" };
  const modules = [
    { key: "consol", label: "Зведення ЗП", icon: <Wallet size={16} />, render: () => <ConsolidationPanel role="accountant" /> },
    { key: "inv", label: "Безнальні рахунки", icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={cab} /> },
    { key: "warehouse", label: "Склад", icon: <Warehouse size={16} />, render: () => <SupplyModule cab={cab} /> },
    { key: "expenses", label: "Витрати по СМ", icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={cab} /> },
  ];
  return <CabinetShell title={ACCOUNTANT.name} onExit={onExit} onLogout={onLogout} modules={modules} cabKey="accountant" />;
}

const checkinFlag = (salonKey) => `dnipro-m-checkin:${salonKey}:${todayISO()}`;
const markCheckedInLocal = (salonKey) => { try { localStorage.setItem(checkinFlag(salonKey), "1"); } catch { /* ignore */ } };

function SmCabinet({ salonKey, onExit, onLogout }) {
  const salon = salonByKey(salonKey);
  // локальна відмітка → миттєво пропускаємо гейт (без запиту), навіть якщо БД гальмує
  const [checkedIn, setCheckedIn] = useState(() => {
    try { return localStorage.getItem(checkinFlag(salonKey)) === "1" ? true : null; } catch { return null; }
  });

  useEffect(() => {
    if (checkedIn) return undefined;
    let a = true;
    getStoreDay(salonKey, todayISO())
      .then((d) => {
        if (!a) return;
        const done = !!(d && (d.opened_at || d.closed));
        if (done) markCheckedInLocal(salonKey);
        setCheckedIn(done);
      })
      .catch(() => { if (a) setCheckedIn(true); }); // якщо помилка — не блокуємо
    return () => { a = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonKey]);

  if (checkedIn === false) {
    return <DailyCheckIn salon={salon} onDone={() => { markCheckedInLocal(salonKey); setCheckedIn(true); }} />;
  }

  const modules = [
    { key: "overview", label: "Огляд", icon: <LayoutGrid size={16} />, render: () => <SmOverview salon={salon} /> },
    { key: "salary", label: "Розрахунок ЗП", icon: <Calculator size={16} />, render: () => <SmView salon={salon} embedded /> },
    { key: "tasks", label: "Задачі й чек-листи", icon: <ListChecks size={16} />, render: () => <TasksModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "team", label: "Команда", icon: <Users size={16} />, render: () => <EmployeesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "shifts", label: "Графік змін", icon: <Calendar size={16} />, render: () => <ShiftScheduleModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "cash", label: "Готівка", icon: <Banknote size={16} />, render: () => <CashModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "warehouse", label: "Склад", icon: <Warehouse size={16} />, render: () => <SupplyModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "expenses", label: "Витрати по СМ", icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "kpi", label: "Показники магазину", icon: <BarChart3 size={16} />, render: () => <TerritoryModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "planner", label: "Планер", icon: <CalendarRange size={16} />, render: () => <PlannerModule tmKey={salonTmOn(salonKey)} /> },
    { key: "requests", label: "Заявки", icon: <Package size={16} />, render: () => <ModuleStub name="Заявки" /> },
    { key: "reports", label: "Звіти", icon: <FileText size={16} />, render: () => <ModuleStub name="Звіти (клінінг, лічильники)" /> },
    { key: "standards", label: "Стандарти й навчання", icon: <GraduationCap size={16} />, render: () => <ModuleStub name="Стандарти й навчання" /> },
    { key: "bn", label: "Безнальні рахунки", icon: <CreditCard size={16} />, divider: true, render: () => <InvoicesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
  ];
  return (
    <CabinetShell
      title={`Салон · ${salonLabel(salon)}`} onExit={onExit} onLogout={onLogout} modules={modules} cabKey={salonKey}
      banner={<SalaryDeadlineBanner role="sm" salonKey={salonKey} tmKey={salonTmOn(salonKey)} />}
    />
  );
}

function OfficeCabinet({ cabKey, onExit, onLogout }) {
  const person = OFFICE.find((o) => o.key === cabKey);
  const [caps, setCaps] = useState(null);
  useEffect(() => { let a = true; getCapabilities(cabKey).then((c) => { if (a) setCaps(c); }); return () => { a = false; }; }, [cabKey]);

  if (!caps) {
    return (
      <div className="view">
        <TopBar title={person?.name || "Офіс"} onBack={onExit} onLogout={onLogout} cabKey={cabKey} />
        <div className="loading">Завантаження…</div>
      </div>
    );
  }
  const modules = [
    { key: "home", label: "Кабінет", icon: <LayoutGrid size={16} />, render: () => (
      <div className="office-stub">
        <span className="office-stub-ic"><Clock size={26} /></span>
        <h3>{person?.name}</h3>
        <p>{caps.length ? "Доступні модулі — у панелі зліва." : "Кабінет у розробці. Додаткові права надає адміністратор."}</p>
      </div>
    ) },
    caps.includes("view_consolidation")
      ? { key: "consol", label: "Зведення ЗП", icon: <Wallet size={16} />, render: () => <ConsolidationPanel role={caps.includes("manage_payments") ? "accountant" : "viewer"} /> }
      : null,
    cabKey === "olha"
      ? { key: "warehouse", label: "Склад", icon: <Warehouse size={16} />, render: () => <SupplyModule cab={{ key: cabKey, type: "office" }} /> }
      : null,
    { key: "expenses", label: "Витрати по СМ", icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={{ key: cabKey, type: "office" }} /> },
    { key: "bn", label: "Безнальні рахунки", icon: <CreditCard size={16} />, divider: true, render: () => <ModuleStub name="Безнальні рахунки" /> },
  ];
  return <CabinetShell title={person?.name || "Офіс"} onExit={onExit} onLogout={onLogout} modules={modules} cabKey={cabKey} />;
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
  --on-dark:#F7F4EA; --on-dark-2:#C4BCA6; --on-dark-3:#8E856F;
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
.topbar-menu{display:none;background:rgba(247,244,234,.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
.topbar-menu:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.cab-scrim{display:none;position:fixed;inset:0;z-index:65;background:rgba(6,10,14,.6);opacity:0;pointer-events:none;transition:opacity .2s var(--ease);}
.cab-scrim.on{opacity:1;pointer-events:auto;}
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

/* смужка-нагадування про подачу ЗП — вгорі кабінету, на всіх вкладках */
.salary-strip{display:flex;align-items:center;gap:9px;padding:10px 16px;margin-bottom:16px;border-radius:var(--radius-md);font-size:12.5px;font-weight:600;line-height:1.35;
  background:rgba(190,138,46,.16);color:var(--gold-bright);border:1px solid rgba(220,169,74,.3);}
.salary-strip svg{flex-shrink:0;}
.salary-strip.late{background:rgba(160,58,42,.2);color:var(--negative-bright);border-color:rgba(224,145,127,.32);}
@media (max-width:880px){.salary-strip{margin-bottom:12px;font-size:12px;}}
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
.field-input::placeholder,.salon-pct-input::placeholder,.adj-amount::placeholder{color:var(--muted);opacity:.4;}
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
.save-bar{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;flex-wrap:wrap;}
.save-hint{margin-right:auto;font-size:11.5px;color:var(--on-dark-3);font-family:'IBM Plex Mono',monospace;}
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

/* перегляд скріншота — по центру, ~55% екрана, з масштабуванням */
.img-modal{position:relative;width:min(58vw,760px);height:min(72vh,720px);background:var(--surface);border-radius:var(--radius-md);box-shadow:var(--sh-3);overflow:hidden;}
@media(max-width:640px){.img-modal{width:92vw;height:70vh;}}
.img-modal-stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:repeating-conic-gradient(rgba(120,110,90,.06) 0% 25%,transparent 0% 50%) 50%/22px 22px;}
.img-modal-stage img{max-width:100%;max-height:100%;user-select:none;-webkit-user-drag:none;transition:transform .12s var(--ease);will-change:transform;}
.img-modal-tools{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:2;display:flex;align-items:center;gap:4px;background:rgba(20,16,10,.82);backdrop-filter:blur(6px);border-radius:999px;padding:4px 6px;box-shadow:var(--sh-2);}
.img-modal-tools button{width:28px;height:28px;border:none;border-radius:50%;background:rgba(247,244,234,.1);color:var(--on-dark);font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.img-modal-tools button:hover:not(:disabled){background:var(--gold);color:#1a1206;}
.img-modal-tools button:disabled{opacity:.35;cursor:default;}
.img-modal-z{min-width:44px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--on-dark);}
.img-modal .modal-close{top:10px;right:10px;z-index:3;width:30px;height:30px;}

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
  .topbar{padding:12px 13px;margin:0 -13px 10px;gap:8px;}
  .topbar-title{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
  .topbar-back{padding:7px 9px;font-size:0;}
  .topbar-back svg{width:17px;height:17px;}
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
  .cab-layout{grid-template-columns:1fr;gap:0;}
  .topbar-menu{display:flex;}
  .cab-scrim{display:block;}
  /* ліва навігація як шухляда (вища специфічність — щоб перекрити базове правило нижче) */
  .cab-shell .cab-side{
    position:fixed;top:0;left:0;bottom:0;z-index:70;
    width:min(82vw,300px);
    flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;
    border-radius:0;border:none;border-right:1px solid var(--line-dark);
    background:linear-gradient(180deg,var(--bg-2),var(--bg));
    box-shadow:0 0 60px rgba(0,0,0,.5);
    padding:14px 10px calc(14px + env(safe-area-inset-bottom));
    transform:translateX(-100%);
    transition:transform .24s var(--ease);
  }
  .cab-shell .cab-side.open{transform:translateX(0);}
  .cab-side-item{white-space:normal;}
}

/* ---------- вхід ---------- */
.login-fields{display:flex;flex-direction:column;gap:12px;margin:4px 0 2px;text-align:left;}
.login-field{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:var(--on-dark-2);}
.login-field input{padding:11px 13px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface);color:var(--ink);font-family:'IBM Plex Mono',monospace;font-size:14px;}
.login-field input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.2);}
.login-remember{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--on-dark-2);cursor:pointer;padding:2px 0;}
.login-remember input[type=checkbox]{width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;}
.recover-lead{color:var(--on-dark-2);font-size:12.5px;line-height:1.5;margin:0 0 4px;text-align:left;}
.lg-recover{display:flex;flex-direction:column;gap:9px;width:100%;margin-top:6px;}
.lg-recover-in{width:100%;padding:10px 12px;border:1px solid var(--line-dark);border-radius:var(--radius-sm);background:rgba(247,244,234,.05);color:var(--on-dark);font-family:inherit;font-size:13px;}
.lg-recover-in::placeholder{color:var(--on-dark-2);opacity:.6;}
.lg-recover-in:focus{outline:none;border-color:var(--gold);}
.admin-pass-edit{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
.admin-pass-edit input{padding:7px 10px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12.5px;min-width:180px;}
.admin-pass-msg{font-size:11.5px;color:var(--positive);}
.resume-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:rgba(220,169,74,.1);border:1px solid rgba(220,169,74,.28);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--on-dark);}
.resume-bar b{color:var(--gold-bright);}
.resume-actions{display:flex;gap:8px;}
.resume-bar .btn-primary.small,.resume-bar .btn-secondary.small{padding:7px 14px;font-size:12px;}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
.topbar-logout{background:rgba(247,244,234,.06);border:1px solid var(--line-dark);color:var(--on-dark-2);font-size:12px;padding:7px 13px;border-radius:999px;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease);}
.topbar-logout:hover{color:var(--negative-bright);border-color:rgba(224,145,127,.4);}

/* ---------- сповіщення ---------- */
.notif-wrap{position:relative;}
.notif-bell{position:relative;background:rgba(247,244,234,.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease);}
.notif-bell:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.notif-dot{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--negative-bright);color:#1a0f0d;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg-2);}
.notif-backdrop{position:fixed;inset:0;z-index:60;}
.notif-panel{position:absolute;top:46px;right:0;width:min(340px,86vw);max-height:70vh;overflow:auto;z-index:61;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 24px 60px -18px rgba(0,0,0,.55);}
.notif-panel-head{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--line);font-family:'Fraunces',serif;font-size:15px;color:var(--ink);font-weight:600;}
.notif-clear{background:none;border:none;color:var(--gold);font-size:12px;cursor:pointer;font-family:inherit;}
.notif-list{display:flex;flex-direction:column;}
.notif-empty{padding:26px 15px;text-align:center;color:var(--muted);font-size:13px;}
.notif-item{display:flex;gap:10px;padding:12px 15px;border-bottom:1px solid var(--line);align-items:flex-start;}
.notif-item:last-child{border-bottom:none;}
.notif-item.notif-unread{background:rgba(190,138,46,.07);}
.notif-ic{color:var(--gold);flex-shrink:0;margin-top:1px;}
.notif-body{min-width:0;}
.notif-body b{display:block;font-size:13px;color:var(--ink);font-weight:600;}
.notif-body p{margin:2px 0 0;font-size:12.5px;color:var(--ink-soft);}
.notif-body time{font-size:11px;color:var(--muted);}
.toast-stack{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;width:max-content;max-width:92vw;}
.toast{display:flex;align-items:center;gap:11px;background:#1b2530;color:#f4f1ea;border:1px solid rgba(220,169,74,.45);border-left:3px solid var(--gold-bright);border-radius:12px;padding:13px 20px;font-size:13.5px;line-height:1.35;box-shadow:0 20px 44px -12px rgba(0,0,0,.55);animation:toastIn .34s cubic-bezier(.2,.9,.3,1) both;}
.toast b{font-weight:700;display:block;}
.toast span{color:#c9c2b2;font-size:12.5px;}
.toast svg{color:var(--gold-bright);flex-shrink:0;}
@keyframes toastIn{from{opacity:0;transform:translateY(-14px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}

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

.admin-subnav{display:flex;gap:4px;margin-bottom:16px;background:rgba(247,244,234,.05);border:1px solid var(--line-dark);border-radius:10px;padding:4px;width:fit-content;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.admin-subnav button{background:none;border:none;color:var(--on-dark-2);padding:8px 14px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;transition:background .15s var(--ease),color .15s var(--ease);}
.admin-subnav button:hover{color:var(--on-dark);}
.admin-subnav button.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);}
.admin-panel + .admin-panel{margin-top:14px;}
.admin-access-row{display:flex;align-items:center;gap:12px;background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);padding:11px 14px;flex-wrap:wrap;}
.admin-pass-input{flex:1;min-width:140px;padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;font-family:'IBM Plex Mono',monospace;font-size:13px;}
.admin-reassign-form{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:14px 0;padding:14px;background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);}
.admin-reassign-form .over-field{max-width:none;flex:1 1 200px;margin-bottom:0;}
.admin-reassign-form select{width:100%;}
.admin-rights{display:flex;flex-direction:column;gap:14px;margin-top:14px;}
.admin-rights-person{background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;}
.admin-rights-name{font-weight:700;font-size:13.5px;color:var(--ink);margin-bottom:9px;}
.admin-rights-caps{display:flex;flex-direction:column;gap:7px;}
.admin-cap{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink-soft);cursor:pointer;}
.admin-cap input[type=checkbox]{width:15px;height:15px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;}
.admin-logrows{display:flex;flex-direction:column;margin-top:10px;}
.admin-logrow{display:grid;grid-template-columns:150px 1fr 1fr;gap:12px;padding:8px 0;border-bottom:1px dashed var(--line);font-size:11.5px;}
.admin-log-time{font-family:'IBM Plex Mono',monospace;color:var(--muted);}
.admin-log-act{color:var(--ink-soft);font-weight:600;}
.admin-log-detail{color:var(--muted);}

/* ---------- модуль «Задачі» ---------- */
/* індикатор перерахунку — у шапці біля дзвіночка, завжди в потоці (без стрибків) */
.calc-busy-dot{width:14px;height:14px;flex:0 0 14px;border-radius:50%;border:2px solid var(--line-dark);border-top-color:var(--gold-bright);opacity:0;transition:opacity .2s var(--ease);}
.calc-busy-dot.on{opacity:1;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.tasks-mod{animation:fadeIn .28s ease both;}
.tasks-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.tasks-head .ov-h{margin:0;}
.btn-primary.small,.btn-secondary.small{padding:7px 13px;font-size:12px;}
.task-input{width:100%;padding:10px 12px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;background:#fff;resize:vertical;}

/* міні-дашборд + фільтр */
.tasks-dash{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-bottom:14px;padding:10px 14px;background:rgba(247,244,234,.03);border:1px solid var(--line-dark);border-radius:var(--radius-md);font-size:12px;color:var(--on-dark-2);}
.tasks-dash b{color:var(--on-dark);font-size:14px;font-weight:700;margin-right:3px;}
.tasks-dash-alert{color:var(--gold-bright);}
.tasks-filter{margin-left:auto;display:flex;align-items:center;gap:5px;background:none;border:1px solid var(--line-dark);color:var(--on-dark-2);border-radius:999px;padding:6px 12px;font-size:11.5px;font-family:inherit;cursor:pointer;transition:all .14s var(--ease);}
.tasks-filter.on{background:rgba(220,169,74,.16);color:var(--gold-bright);border-color:rgba(220,169,74,.4);}

/* компактні картки */
.task-list{display:flex;flex-direction:column;gap:7px;}
.task-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--sh-1);overflow:hidden;color:var(--ink);}
.task-card.task-overdue{border-color:rgba(160,58,42,.5);}
.task-card.task-card-done{opacity:.6;}
.task-card-main{width:100%;display:flex;align-items:center;gap:10px;padding:11px 14px;background:none;border:none;font-family:inherit;text-align:left;cursor:pointer;}
.task-card-main:hover{background:rgba(190,138,46,.05);}
.task-star{color:var(--gold);flex-shrink:0;}
.task-card-main .task-title{font-weight:600;font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1;}
.task-card-sub{font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;white-space:nowrap;margin-left:auto;flex-shrink:0;}
.task-due-over{color:var(--negative);font-weight:600;}
.task-dot{width:10px;height:10px;border-radius:999px;flex-shrink:0;background:var(--muted);}
.task-dot.dot-open{background:#b9b1a0;}
.task-dot.dot-progress{background:var(--gold-bright);animation:dotPulse 1.4s ease-in-out infinite;}
.task-dot.dot-done{background:var(--positive);}
.task-dot.dot-unseen{background:var(--negative-bright);animation:dotPulse 1s ease-in-out infinite;}
@keyframes dotPulse{0%,100%{box-shadow:0 0 0 0 currentColor;opacity:1;}50%{box-shadow:0 0 0 4px transparent;opacity:.55;}}
.task-card-detail{padding:2px 14px 13px;border-top:1px solid var(--line);}
.task-desc{font-size:12.5px;color:var(--ink-soft);margin:10px 0 0;line-height:1.5;}
.task-meta{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;align-items:center;}
.task-meta b{color:var(--ink-soft);font-weight:600;}
.task-dot-legend{padding-left:14px;position:relative;}
.task-dot-legend::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:999px;}
.task-dot-legend.dot-open::before{background:#b9b1a0;}
.task-dot-legend.dot-progress::before{background:var(--gold-bright);}
.task-dot-legend.dot-done::before{background:var(--positive);}
.task-dot-legend.dot-unseen::before{background:var(--negative-bright);}
.task-comment{margin:9px 0 0;font-size:12px;color:var(--ink-soft);background:rgba(190,138,46,.07);border-radius:var(--radius-sm);padding:7px 10px;}
.task-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px;}
.task-done-form{margin-top:12px;display:flex;flex-direction:column;gap:8px;}
.task-done-form textarea{width:100%;padding:9px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12.5px;resize:vertical;}
.task-done-toggle{background:none;border:none;color:var(--on-dark-2);font-size:12px;font-weight:600;cursor:pointer;padding:14px 2px 6px;font-family:inherit;}
.task-done-toggle:hover{color:var(--on-dark);}
.btn-danger.small{background:rgba(160,58,42,.12);border:1px solid rgba(224,145,127,.3);color:var(--negative);border-radius:var(--radius-sm);padding:7px 13px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .14s var(--ease);}
.btn-danger.small:hover{background:rgba(160,58,42,.2);}

/* ---------- безнальні рахунки ---------- */
/* ---------- команда / співробітники ---------- */
/* ---------- графік змін ---------- */
.inv-toolbar-sel{appearance:none;-webkit-appearance:none;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23BE8A2E' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 28px 7px 11px;font-family:inherit;font-size:12.5px;color:var(--ink);cursor:pointer;}
.shift-modebar{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--on-dark-2);margin-bottom:10px;}
.shift-modebar button{background:none;border:1px solid var(--line-dark);color:var(--on-dark-2);border-radius:999px;padding:5px 13px;font-size:11.5px;font-family:inherit;cursor:pointer;}
.shift-modebar button.on{background:rgba(220,169,74,.16);color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.grid-scroll{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);}
table.sched{border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:11px;}
table.sched th,table.sched td{border:1px solid var(--line);text-align:center;padding:0;}
table.sched thead th{background:var(--surface-alt);color:var(--muted);font-weight:600;padding:3px 0;min-width:26px;line-height:1.2;position:sticky;top:0;}
table.sched thead th.we{background:rgba(63,107,74,.14);color:var(--positive);}
table.sched .wd{font-size:8px;opacity:.7;}
table.sched .rh{text-align:left;padding:5px 10px;white-space:nowrap;background:var(--surface);font-family:'Inter',sans-serif;position:sticky;left:0;z-index:1;min-width:150px;}
table.sched .rh .nm{font-size:12px;font-weight:600;color:var(--ink);}
table.sched .rh .rl{font-size:10px;color:var(--muted);}
table.sched .grp td{background:var(--surface-sink);text-align:left;padding:4px 10px;font-size:11px;font-weight:700;color:var(--ink-soft);position:sticky;left:0;}
td.sh{height:26px;color:var(--ink);}
td.sh-edit{cursor:pointer;}
td.sh-edit:hover{background:rgba(190,138,46,.1);}
td.sh-plan{color:var(--muted);}
td.sh-off{background:rgba(160,58,42,.14);}
td.sh-closed{background:repeating-linear-gradient(45deg,var(--surface-sink),var(--surface-sink) 3px,transparent 3px,transparent 6px);}
td.sh-subst{background:rgba(78,108,151,.16);color:#4E6C97;font-weight:600;}
td.sh-absent{background:rgba(160,58,42,.1);color:var(--negative);font-size:9px;}
td.sh-fill{background:#0a0a0a;}
td.sh-fill-plan{background:linear-gradient(135deg,#0a0a0a 0 46%,transparent 46%);}
td.sh-fill.sh-edit:hover{background:#333;}
td.sh-today{outline:2px solid var(--gold);outline-offset:-2px;}
td.sh-sum,th.sh-sum-h{background:var(--surface-alt);font-size:10px;color:var(--muted);white-space:nowrap;padding:0 8px;text-align:right;position:sticky;right:0;}
td.sh-sum b{color:var(--ink);}
.shift-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:var(--on-dark-2);}
.shift-legend span{display:flex;align-items:center;gap:6px;}
.shift-legend .sw{width:16px;height:16px;border-radius:3px;border:1px solid var(--line-strong);background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--pos);font-style:normal;font-family:'IBM Plex Mono',monospace;}
.shift-legend .sw.sh-plan{color:var(--muted);}
.shift-legend .sw.sh-subst{color:#4E6C97;background:rgba(78,108,151,.16);}
.shift-menu-work{background:var(--pos-soft,rgba(63,107,74,.2))!important;color:var(--positive)!important;font-weight:600;}
td.sh{font-size:12px;font-weight:600;}
td.sh.sh-plan{font-weight:400;}
.shift-menu{position:fixed;z-index:301;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 20px 50px -14px rgba(0,0,0,.5);padding:10px;width:200px;animation:fadeIn .14s ease both;}
.shift-menu-row{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;align-items:center;}
.shift-menu-row button{flex:1;min-width:38px;padding:6px 4px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface-alt);font-family:inherit;font-size:11.5px;color:var(--ink-soft);cursor:pointer;}
.shift-menu-row button:hover{background:rgba(190,138,46,.14);}
.shift-menu-subst{font-size:11px;color:var(--muted);}
.shift-menu-subst select{flex:1;padding:5px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-size:11px;}
.shift-menu-hint{font-size:10px;color:var(--muted);text-align:center;font-family:'IBM Plex Mono',monospace;}

/* щоденний вхід */
.checkin-overlay{align-items:flex-start;padding-top:6vh;}
.checkin-modal{width:min(460px,100%);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 40px 100px -24px rgba(0,0,0,.6);color:var(--ink);animation:fadeIn .24s ease both;overflow:hidden;}
.checkin-h{padding:16px 20px;border-bottom:1px solid var(--line);}
.checkin-h .k{font-family:'Fraunces',serif;font-size:18px;font-weight:600;}
.checkin-h .d{font-size:12px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-top:2px;}
.checkin-b{padding:8px 20px;max-height:52vh;overflow:auto;}
.ci-emp{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line);}
.ci-emp:last-child{border-bottom:none;}
.ci-emp .chk{width:19px;height:19px;border-radius:5px;border:2px solid var(--line-strong);background:none;flex-shrink:0;cursor:pointer;position:relative;}
.ci-emp .chk.on{background:var(--gold);border-color:var(--gold);}
.ci-emp .chk.on::after{content:"";position:absolute;left:5px;top:1px;width:5px;height:9px;border:solid var(--gold-ink);border-width:0 2px 2px 0;transform:rotate(45deg);}
.ci-name{flex:1;font-size:13px;font-weight:500;min-width:0;}
.ci-role{font-size:10px;font-family:'IBM Plex Mono',monospace;color:var(--muted);margin-left:6px;}
.ci-senior{width:26px;height:26px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);color:var(--faint);cursor:pointer;font-size:13px;}
.ci-senior.on{background:rgba(190,138,46,.16);color:var(--gold);border-color:rgba(220,169,74,.4);}
.ci-add{padding:10px 0;}
.ci-add select{width:100%;padding:8px 10px;border:1px dashed var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12px;background:var(--surface-alt);}
.checkin-f{padding:14px 20px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;background:var(--surface-alt);}

.emp-groups{display:flex;flex-direction:column;gap:16px;}
.emp-group{border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);box-shadow:var(--sh-1);}
.emp-group-head{padding:9px 14px;background:var(--surface-alt);font-family:'Fraunces',serif;font-size:14px;font-weight:600;color:var(--ink);}
.emp-group-head span{color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:12px;}
.emp-row{padding:11px 14px;border-top:1px solid var(--line);}
.emp-group .emp-row:first-of-type{border-top:none;}
.emp-row.emp-fired{border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);opacity:.85;}
.emp-main{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
.emp-name{font-weight:600;font-size:13.5px;color:var(--ink);}
.emp-role{flex-shrink:0;}
.emp-bd{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--gold);background:rgba(190,138,46,.1);border-radius:999px;padding:2px 8px;}
.emp-meta{display:flex;flex-wrap:wrap;gap:5px 14px;margin-top:6px;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;}
.emp-note{margin:6px 0 0;font-size:12px;color:var(--ink-soft);}
.emp-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;}
.emp-xfer-sel{padding:7px 10px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12px;}
.sm-emp-pick .ov-sub{margin-bottom:14px;}
.sm-emp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
.sm-emp-card{display:flex;flex-direction:column;align-items:flex-start;gap:7px;padding:14px 15px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--sh-1);cursor:pointer;font-family:inherit;text-align:left;transition:border-color .14s var(--ease),transform .1s var(--ease);}
.sm-emp-card:hover{border-color:var(--gold);transform:translateY(-1px);}
.sm-emp-name{font-weight:600;font-size:13.5px;color:var(--ink);}
.sm-emp-status{display:flex;align-items:center;gap:8px;margin-top:2px;}
.sm-emp-status b{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);}
.sm-emp-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line-dark);}
.sm-emp-cur{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:var(--on-dark);}
.detail-sub{font-family:'Inter',sans-serif;font-size:12px;font-weight:400;color:var(--muted);}

.inv-viewtabs{display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--line-dark);}
.inv-viewtabs button{background:none;border:none;border-bottom:2px solid transparent;padding:8px 14px;font-size:12.5px;font-weight:600;color:var(--on-dark-2);cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;margin-bottom:-1px;}
.inv-viewtabs button:hover{color:var(--on-dark);}
.inv-viewtabs button.on{color:var(--gold-bright);border-bottom-color:var(--gold);}
.inv-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}
.inv-toolbar select{appearance:none;-webkit-appearance:none;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23BE8A2E' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 28px 7px 11px;font-family:inherit;font-size:12px;color:var(--ink);cursor:pointer;}
.inv-anl-filters{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;}
.inv-anl-filters label{display:flex;flex-direction:column;gap:3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--on-dark-2);}
.inv-anl-filters select{appearance:none;-webkit-appearance:none;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23BE8A2E' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 26px 7px 10px;font-family:inherit;font-size:12.5px;color:var(--ink);cursor:pointer;}
.inv-analytics .chart-wrap{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:14px 10px 6px;box-shadow:var(--sh-1);}
.inv-analytics .ov-tile b{font-size:16px;line-height:1.2;}
.ov-tiles{grid-template-columns:repeat(auto-fit,minmax(135px,1fr));}
.inv-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}
.inv-fchip{background:none;border:1px solid var(--line-dark);color:var(--on-dark-2);border-radius:999px;padding:5px 12px;font-size:11.5px;font-family:inherit;cursor:pointer;transition:all .13s var(--ease);}
.inv-fchip.on{background:rgba(220,169,74,.16);color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.inv-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--sh-1);overflow:hidden;color:var(--ink);}
.inv-card.inv-cancelled{opacity:.55;}
.inv-card-main{display:flex;align-items:stretch;}
.inv-card-expand{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 14px;background:none;border:none;font-family:inherit;text-align:left;cursor:pointer;}
.inv-card-expand:hover{background:rgba(190,138,46,.05);}
.inv-shot-btn{flex-shrink:0;width:40px;border:none;border-left:1px solid var(--line);background:none;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;}
.inv-shot-btn:hover{background:rgba(190,138,46,.1);color:var(--gold);}
.inv-dot{width:9px;height:9px;border-radius:999px;flex-shrink:0;background:var(--muted);}
.inv-dot.inv-issued{background:var(--gold-bright);}
.inv-dot.inv-paid{background:#7896c8;}
.inv-dot.inv-shipped{background:var(--positive);}
.inv-dot.inv-documented{background:var(--positive);}
.inv-dot.inv-cancelled{background:var(--negative-bright);}
.inv-cp-wrap{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.inv-cp{font-weight:600;font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.inv-issuer{font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.inv-vat{flex-shrink:0;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em;background:var(--surface-alt);color:var(--muted);border:1px solid var(--line);}
.inv-vat.on{background:rgba(190,138,46,.16);color:var(--gold-ink);border-color:rgba(220,169,74,.3);}
.inv-amount{font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink-soft);white-space:nowrap;}
.inv-badge{flex-shrink:0;}
.inv-detail{padding:4px 14px 14px;border-top:1px solid var(--line);}
.inv-meta{display:flex;flex-wrap:wrap;gap:6px 16px;margin:10px 0;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;}
.inv-meta b{color:var(--ink-soft);}
.inv-items-view{margin:8px 0 12px;border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden;}
.inv-item-row{display:grid;grid-template-columns:88px 1fr 56px;gap:8px;padding:6px 10px;font-size:11.5px;color:var(--ink-soft);border-bottom:1px solid var(--line);}
.inv-item-row:last-child{border-bottom:none;}
.inv-item-hd{background:var(--surface-alt);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);}
.inv-item-code{font-family:'IBM Plex Mono',monospace;color:var(--muted);}
.inv-item-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.inv-item-qty{text-align:right;font-family:'IBM Plex Mono',monospace;}
.inv-thumb-btn{display:inline-block;max-width:100%;border:none;background:none;padding:0;cursor:zoom-in;position:relative;margin-top:2px;}
.inv-thumb{max-width:100%;max-height:240px;border:1px solid var(--line);border-radius:var(--radius-sm);display:block;}
.inv-thumb-hint{position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;gap:4px;font-size:10.5px;background:rgba(20,25,32,.82);color:#f4f1ea;padding:3px 8px;border-radius:999px;opacity:0;transition:opacity .15s var(--ease);}
.inv-thumb-btn:hover .inv-thumb-hint{opacity:1;}
.inv-items{border:1px solid var(--line-strong);border-radius:var(--radius-sm);overflow:hidden;}
.inv-items-head{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--surface-alt);font-size:11px;font-weight:700;color:var(--ink-soft);}
.inv-items-clear{background:none;border:none;color:var(--gold);font-size:11px;cursor:pointer;font-family:inherit;}
.inv-items-list{max-height:150px;overflow:auto;}
.inv-items-list .inv-item-row{grid-template-columns:80px 1fr 44px;}
.inv-history{margin:10px 0;padding:8px 10px;background:var(--surface-alt);border-radius:var(--radius-sm);display:flex;flex-direction:column;gap:4px;}
.inv-hist-row{display:flex;flex-wrap:wrap;gap:4px 8px;font-size:11px;color:var(--ink-soft);font-family:'IBM Plex Mono',monospace;}
.inv-hist-st{font-weight:700;color:var(--ink);}
.inv-hist-at{color:var(--muted);}
.inv-hist-note{width:100%;color:var(--muted);}
.inv-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px;}
.inv-comment-add{display:flex;gap:7px;margin-top:10px;}
.inv-comment-add input{flex:1;padding:8px 10px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12.5px;}
.inv-paste{width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px 16px;border:1.5px dashed var(--line-strong);border-radius:var(--radius-sm);background:var(--surface-alt);color:var(--ink-soft);font-family:inherit;cursor:pointer;transition:border-color .14s var(--ease);}
.inv-paste:hover{border-color:var(--gold);}
.inv-paste.compact{padding:9px 14px;flex-direction:row;font-size:12px;}
.inv-paste svg{color:var(--gold);}
.inv-paste b{font-size:12.5px;color:var(--ink);}
.inv-paste span{font-size:11px;color:var(--muted);}
.inv-shot-preview{display:flex;flex-direction:column;gap:8px;}
.inv-shot-preview img{max-width:100%;max-height:260px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);object-fit:contain;background:#fff;}
.inv-ai{display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0;font-family:'IBM Plex Mono',monospace;}
.inv-ai-run{color:var(--gold);}
.inv-ai-ok{color:var(--positive);}
.inv-ai-fail{color:var(--muted);}
.task-modal .over-field>input,.task-modal .over-field>textarea{width:100%;}

/* модалка створення задачі */
.modal-overlay{position:fixed;inset:0;z-index:200;background:rgba(12,10,7,.55);display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow:auto;backdrop-filter:blur(2px);}
.modal{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 40px 100px -24px rgba(0,0,0,.6);width:min(520px,100%);color:var(--ink);animation:fadeIn .22s ease both;}
.task-modal{display:flex;flex-direction:column;max-height:90vh;}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line);}
.modal-head h3{margin:0;font-family:'Fraunces',serif;font-size:18px;font-weight:600;color:var(--ink);}
.modal-x{background:none;border:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:var(--radius-sm);}
.modal-x:hover{color:var(--ink);background:rgba(0,0,0,.05);}
.modal-body{padding:18px 20px;overflow:auto;display:flex;flex-direction:column;gap:12px;}
.modal-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-top:1px solid var(--line);}
.task-modal-row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;}
.task-modal-row .over-field{max-width:none;flex:1 1 190px;margin-bottom:0;}
.task-modal-row .over-field>input{width:100%;}

/* ---------- вибір дати й часу (DateTimeField) ---------- */
.dtf{width:100%;}
.dtf-trigger{width:100%;display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;font-family:inherit;font-size:13px;color:var(--muted);cursor:pointer;transition:border-color .14s var(--ease),box-shadow .14s var(--ease);text-align:left;}
.dtf-trigger:hover{border-color:var(--gold);}
.dtf-trigger:focus-visible{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.16);}
.dtf-trigger.has{color:var(--ink);font-weight:600;}
.dtf-trigger svg{color:var(--gold);flex-shrink:0;}
.dtf-trigger>span:first-of-type{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dtf-clear{display:inline-flex;align-items:center;color:var(--muted);border-radius:999px;padding:2px;}
.dtf-clear:hover{color:var(--negative);background:rgba(160,58,42,.1);}

.dtf-backdrop{position:fixed;inset:0;z-index:300;}
.dtf-pop{position:fixed;z-index:301;width:280px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 24px 60px -16px rgba(0,0,0,.5);padding:12px;animation:fadeIn .16s ease both;}
.dtf-quick{display:flex;gap:6px;margin-bottom:10px;}
.dtf-quick button{flex:1;padding:6px 4px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:rgba(190,138,46,.06);color:var(--ink-soft);font-family:inherit;font-size:11.5px;cursor:pointer;transition:all .12s var(--ease);}
.dtf-quick button:hover{background:rgba(190,138,46,.16);color:var(--ink);border-color:var(--gold);}
.dtf-calhead{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 8px;font-family:'Fraunces',serif;font-size:14px;font-weight:600;color:var(--ink);}
.dtf-calhead button{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:none;background:none;color:var(--on-dark-2);border-radius:var(--radius-sm);cursor:pointer;}
.dtf-calhead button:hover{background:rgba(190,138,46,.12);color:var(--ink);}
.dtf-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
.dtf-wd{text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);padding:3px 0 5px;}
.dtf-day{height:30px;border:none;background:none;border-radius:var(--radius-sm);font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink-soft);cursor:pointer;transition:background .1s var(--ease);}
.dtf-day:hover{background:rgba(190,138,46,.12);color:var(--ink);}
.dtf-day.today{color:var(--gold);font-weight:700;}
.dtf-day.sel{background:var(--gold);color:var(--gold-ink);font-weight:700;}
.dtf-time{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);}
.dtf-time svg{color:var(--gold);}
.dtf-time select{appearance:none;-webkit-appearance:none;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:#fff;padding:5px 8px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);cursor:pointer;}
.dtf-time select:focus{outline:none;border-color:var(--gold);}
.dtf-ok{margin-left:auto;padding:6px 14px;border:none;border-radius:var(--radius-sm);background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);font-family:inherit;font-weight:700;font-size:12px;cursor:pointer;}
.task-priority-toggle{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-soft);cursor:pointer;padding-bottom:9px;}
.task-priority-toggle svg{color:var(--gold);}
.task-modal-label{font-size:12px;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:.04em;margin-top:2px;}
.task-modal-count{font-size:12px;color:var(--muted);}
.form-err{color:var(--negative);font-size:12.5px;margin:0;}

/* ієрархічний вибір «кому» */
.assignee-picker{border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:10px 12px;max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:4px;background:#fff;}
.assignee-all{display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--line);margin-bottom:4px;font-size:13px;color:var(--ink);cursor:pointer;}
.assignee-group{display:flex;flex-direction:column;gap:2px;}
.assignee-group-head{display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);cursor:pointer;margin-top:4px;}
.assignee-row{display:flex;align-items:center;gap:8px;padding:5px 4px 5px 18px;font-size:13px;color:var(--ink-soft);cursor:pointer;border-radius:var(--radius-sm);}
.assignee-row:hover{background:rgba(190,138,46,.06);}
.assignee-picker input[type=checkbox]{width:15px;height:15px;accent-color:var(--gold);cursor:pointer;}

/* ---------- навігація кабінету (вкладки — керівник/бухгалтер) ---------- */
.cab-nav{display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--line-dark);}
.cab-nav button{background:none;border:none;border-bottom:2px solid transparent;padding:11px 15px;font-size:13px;font-weight:600;color:var(--on-dark-2);cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;margin-bottom:-1px;transition:color .15s var(--ease),border-color .15s var(--ease);}
.cab-nav button:hover{color:var(--on-dark);}
.cab-nav button.active{color:var(--gold-bright);border-bottom-color:var(--gold);}
.embedded{animation:fadeIn .28s ease both;}

/* ---------- оболонка кабінету з лівою панеллю ---------- */
.cab-shell{max-width:1120px;animation:none;}  /* без transform — щоб мобільна шухляда позиціонувалась від краю екрана */
.cab-layout{display:grid;grid-template-columns:232px 1fr;gap:22px;align-items:start;}
.cab-side{position:sticky;top:78px;display:flex;flex-direction:column;gap:2px;padding:8px;background:rgba(247,244,234,.03);border:1px solid var(--line-dark);border-radius:var(--radius-md);}
.cab-side-item{display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:none;border-radius:var(--radius-sm);background:none;color:var(--on-dark-2);font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;text-align:left;transition:background .14s var(--ease),color .14s var(--ease);}
.cab-side-item:hover{background:rgba(247,244,234,.05);color:var(--on-dark);}
.cab-side-item.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);font-weight:600;}
.cab-side-item svg{flex-shrink:0;}
.cab-side-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cab-side-item .badge{margin-left:auto;flex-shrink:0;}
.cab-side-sep{height:1px;background:var(--line-dark);margin:7px 6px;}
.cab-content{min-width:0;}
.cab-content .embedded{animation:none;}

/* налаштування навігації */
.cab-side-row{display:flex;align-items:center;gap:2px;border-radius:var(--radius-sm);}
.cab-side-row .cab-side-item{flex:1;}
.cab-side.editing .cab-side-row{background:rgba(247,244,234,.03);cursor:grab;}
.cab-side.editing .cab-side-row.dragging{opacity:.4;}
.cab-side-grip{display:flex;align-items:center;color:var(--on-dark-3);padding-left:4px;flex-shrink:0;}
.cab-side-eye{margin-left:auto;display:flex;align-items:center;color:var(--on-dark-3);flex-shrink:0;}
.cab-side-item.is-hidden{opacity:.4;}
.cab-side-item.is-hidden .cab-side-label{text-decoration:line-through;}
.cab-side.editing .cab-side-item:hover{background:rgba(247,244,234,.06);}
.cab-side-cfg{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-radius:var(--radius-sm);background:none;color:var(--on-dark-3);font-family:inherit;font-size:11.5px;font-weight:500;cursor:pointer;text-align:left;transition:color .14s var(--ease),background .14s var(--ease);}
.cab-side-cfg:hover{background:rgba(247,244,234,.05);color:var(--on-dark);}
.cab-side-cfg.subtle{font-size:11px;color:var(--on-dark-3);}
.cab-side-tip{font-size:10.5px;line-height:1.45;color:var(--on-dark-3);padding:4px 12px 6px;margin:0;}
@media (max-width:880px){
  .cab-side.editing{flex-direction:column;}
}

/* ---------- вбудований планер ---------- */
.planner-embed{display:flex;flex-direction:column;gap:10px;animation:fadeIn .28s ease both;}
.planner-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.planner-hint{font-size:12px;color:var(--on-dark-2);line-height:1.4;}
.planner-actions{display:flex;gap:8px;flex-shrink:0;}
.planner-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(247,244,234,.05);border:1px solid var(--line-dark);color:var(--on-dark-2);border-radius:999px;padding:7px 13px;font-size:12px;font-family:inherit;cursor:pointer;text-decoration:none;transition:border-color .15s var(--ease),color .15s var(--ease);}
.planner-btn:hover{border-color:var(--gold);color:var(--gold-bright);}
.planner-frame{width:100%;height:calc(100vh - 210px);min-height:520px;border:1px solid var(--line-dark);border-radius:var(--radius-md);background:#fff;box-shadow:var(--sh-2);}
@media (max-width:720px){.planner-frame{height:calc(100vh - 260px);}}

/* ---------- показники території ---------- */
.tm-mod{animation:fadeIn .28s ease both;}
.tm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;}
.tm-head .ov-h{margin:0;}
.tm-head-actions{display:flex;gap:8px;align-items:center;}
.tm-sync-note{font-size:11.5px;color:var(--on-dark-2);margin:0 0 12px;font-family:'IBM Plex Mono',monospace;}
.tm-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0;}
.tm-strip-tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;box-shadow:var(--sh-1);}
.tm-strip-lab{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.03em;text-transform:uppercase;}
.tm-strip-tile b{display:block;font-family:'IBM Plex Mono',monospace;font-size:17px;font-weight:600;color:var(--ink);margin:3px 0 2px;font-variant-numeric:tabular-nums;}
.tm-strip-sub{font-size:10.5px;color:var(--muted);}
.tm-pct{font-style:normal;font-weight:600;}
.tm-pct.good{color:var(--positive);}
.tm-pct.warn{color:var(--gold);}
.tm-pct.bad{color:var(--negative);}
.tm-all{overflow-x:auto;margin-bottom:14px;border:1px solid var(--line);border-radius:var(--radius-md);}
.tm-all-tbl{width:100%;border-collapse:collapse;font-size:12.5px;background:var(--surface);}
.tm-all-tbl th{text-align:right;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);}
.tm-all-tbl th:first-child{text-align:left;}
.tm-all-tbl td{padding:9px 12px;border-bottom:1px solid var(--line);color:var(--ink);}
.tm-all-tbl td.num{text-align:right;font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.tm-all-tbl td.muted{color:var(--muted);}
.tm-all-tbl tr:last-child td{border-bottom:none;}
.tm-all-tbl tbody tr{cursor:pointer;}
.tm-all-tbl tbody tr:hover{background:var(--surface-alt);}
.tm-all-tbl tbody tr.active{background:rgba(190,138,46,.1);}
.tm-salon-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
.tm-salon-chips .chip{font-size:11.5px;padding:6px 11px;border-radius:999px;border:1px solid var(--line-dark);background:rgba(247,244,234,.04);color:var(--on-dark-2);cursor:pointer;}
.tm-salon-chips .chip.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);border-color:transparent;font-weight:600;}
.tm-grid-cap{font-size:12px;color:var(--on-dark-2);margin:0 0 8px;}
.tm-grid-wrap{overflow:auto;max-height:calc(100vh - 340px);border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);}
.tm-grid{width:100%;border-collapse:collapse;font-size:12.5px;}
.tm-grid th{position:sticky;top:0;z-index:1;background:var(--surface-alt);color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase;padding:8px 8px;text-align:right;border-bottom:1px solid var(--line-strong);}
.tm-grid th.tm-c-day{text-align:left;left:0;z-index:2;}
.tm-grid td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;color:var(--ink);font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.tm-grid td.tm-c-day{position:sticky;left:0;background:var(--surface);text-align:left;color:var(--muted);font-weight:600;}
.tm-grid td.muted{color:var(--muted);}
.tm-grid tr.tm-future td{opacity:.5;}
.tm-in{width:78px;border:1px solid transparent;background:none;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink);text-align:right;padding:5px 6px;border-radius:6px;}
.tm-in:hover{border-color:var(--line-strong);}
.tm-in:focus{outline:none;border-color:var(--gold);background:#fff;}
.tm-grid td.tm-edited{background:rgba(190,138,46,.12);}
.tm-grid td.tm-edited .tm-in{color:var(--gold-ink);font-weight:600;}
.tm-c-rst{width:26px;padding:0;}
.tm-rst{border:none;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;}
.tm-rst:hover{color:var(--gold);background:rgba(190,138,46,.12);}
.tm-grid tfoot td{position:sticky;bottom:0;background:var(--surface-alt);border-top:2px solid var(--line-strong);border-bottom:none;}
.tm-grid tfoot tr.tm-tot td{font-weight:700;color:var(--ink);}
.tm-grid tfoot tr.tm-plan td{color:var(--muted);font-weight:500;border-top:1px solid var(--line);}
.tm-grid td.num{text-align:right;}

/* ---------- технічна перерва ---------- */
.maint-screen{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(1000px 500px at 50% 0%,rgba(190,138,46,.14),transparent 60%),var(--bg-deep,#14100a);}
.maint-card{max-width:420px;width:100%;text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:36px 28px 30px;box-shadow:var(--sh-3);}
.maint-ic{display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;background:rgba(190,138,46,.12);color:var(--gold);margin-bottom:16px;animation:maint-tick 3s ease-in-out infinite;}
@keyframes maint-tick{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(6deg);}}
.maint-card h1{font-family:'Fraunces',serif;font-size:22px;color:var(--ink);margin:0 0 8px;font-weight:600;}
.maint-card p{color:var(--muted);font-size:13.5px;line-height:1.5;margin:0 0 20px;}
.maint-card .btn-secondary{color:var(--ink-soft);border-color:var(--line-strong);background:var(--surface-alt);}
.maint-card .btn-secondary:hover{color:var(--gold);border-color:var(--gold);}
.maint-toggle{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;padding:12px 14px;border:1px solid var(--line-strong);border-radius:var(--radius-md);background:var(--surface);}
.maint-toggle.on{border-color:var(--negative);background:rgba(160,58,42,.08);}
.maint-toggle input{position:absolute;opacity:0;pointer-events:none;}
.maint-switch{flex-shrink:0;width:42px;height:24px;border-radius:999px;background:var(--line-strong);position:relative;transition:background .18s var(--ease);}
.maint-switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:var(--sh-1);transition:transform .18s var(--ease);}
.maint-toggle.on .maint-switch{background:var(--negative);}
.maint-toggle.on .maint-switch::after{transform:translateX(18px);}
.maint-label{font-size:13px;font-weight:600;color:var(--ink);}
.maint-label em{font-style:normal;font-weight:500;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:11px;}

/* ---------- звернення ---------- */
.topbar-fb{position:relative;background:rgba(247,244,234,.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease);}
.topbar-fb:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.fb-modal{position:relative;background:var(--surface);border-radius:var(--radius);max-width:440px;width:100%;box-shadow:var(--sh-3);overflow:hidden;animation:fadeIn .2s ease both;}
.fb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line);font-family:'Fraunces',serif;font-size:16px;color:var(--ink);font-weight:600;}
.fb-modal-head .modal-close{position:static;width:28px;height:28px;top:auto;right:auto;}
.fb-modal-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:12px;}
.fb-kind{display:flex;gap:8px;}
.fb-kind button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface-alt);color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;}
.fb-kind button.active{border-color:var(--gold);background:rgba(190,138,46,.1);color:var(--gold);}
.fb-ta{width:100%;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;background:#fff;color:var(--ink);}
.fb-ta:focus{outline:none;border-color:var(--gold);}
.fb-attach{display:inline-flex;align-items:center;gap:7px;align-self:flex-start;padding:7px 12px;border:1px dashed var(--line-strong);border-radius:var(--radius-sm);color:var(--muted);font-size:12px;cursor:pointer;}
.fb-attach:hover{border-color:var(--gold);color:var(--gold);}
.fb-shot{position:relative;align-self:flex-start;max-width:180px;}
.fb-shot img{width:100%;border-radius:var(--radius-sm);border:1px solid var(--line);display:block;}
.fb-shot button{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;background:var(--surface);border:1px solid var(--line-strong);color:var(--ink-soft);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--sh-1);}
.fb-hint{font-size:11px;color:var(--faint);margin:0;}
.fb-done{padding:34px 18px;text-align:center;color:var(--positive);font-weight:600;font-size:14px;display:flex;flex-direction:column;align-items:center;gap:10px;}
.fb-filter{display:flex;gap:6px;margin-bottom:12px;}
.fb-filter button{padding:6px 12px;border:1px solid var(--line-strong);border-radius:999px;background:var(--surface);color:var(--muted);font-family:inherit;font-size:11.5px;cursor:pointer;}
.fb-filter button.active{background:var(--ink);color:var(--surface);border-color:var(--ink);}
.fb-list{display:flex;flex-direction:column;gap:10px;}
.fb-item{border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;background:var(--surface);}
.fb-item.new{border-left:3px solid var(--gold);}
.fb-item.done{opacity:.72;}
.fb-item-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;}
.fb-tag{font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:3px 8px;border-radius:6px;}
.fb-tag.problem{background:rgba(160,58,42,.14);color:var(--negative);}
.fb-tag.proposal{background:rgba(60,107,74,.14);color:var(--positive);}
.fb-from{font-size:12px;font-weight:600;color:var(--ink);}
.fb-time{margin-left:auto;font-size:11px;color:var(--faint);font-family:'IBM Plex Mono',monospace;}
.fb-body{font-size:13px;color:var(--ink-soft);line-height:1.5;margin:0 0 8px;white-space:pre-wrap;}
.fb-thumb{padding:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;background:none;display:block;max-width:160px;margin-bottom:8px;}
.fb-thumb img{width:100%;display:block;}
.fb-actions{display:flex;align-items:center;gap:8px;}
.fb-del{margin-left:auto;background:none;border:none;color:var(--faint);cursor:pointer;padding:4px;border-radius:6px;}
.fb-del:hover{color:var(--negative);background:rgba(160,58,42,.1);}
.fb-reply{background:var(--surface-alt);border-radius:var(--radius-sm);padding:8px 11px;font-size:12px;color:var(--ink-soft);margin-bottom:8px;line-height:1.45;}
.fb-reply b{color:var(--ink);font-weight:600;}
.fb-resolve{margin-top:10px;display:flex;flex-direction:column;gap:8px;}
.fb-resolve textarea{width:100%;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:9px 11px;font-family:inherit;font-size:12.5px;resize:vertical;background:#fff;color:var(--ink);}
.fb-resolve textarea:focus{outline:none;border-color:var(--gold);}
.fb-resolve .btn-primary{align-self:flex-start;}

/* ---------- готівка ---------- */
.cash-mod,.cash-ov{animation:fadeIn .28s ease both;}
.cash-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0 20px;}
.cash-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:16px 18px;box-shadow:var(--sh-1);display:flex;flex-direction:column;gap:4px;}
.cash-card.big{border-color:rgba(220,169,74,.35);background:linear-gradient(180deg,rgba(190,138,46,.08),var(--surface));}
.cash-lab{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);}
.cash-card b{font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
.cash-card.big b{color:var(--gold-ink);}
.cash-sub{font-size:11.5px;color:var(--muted);}
.cash-card .btn-primary{margin-top:10px;}
.cash-in{width:100%;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:10px 12px;font-family:'IBM Plex Mono',monospace;font-size:17px;color:var(--ink);background:#fff;text-align:right;}
.cash-in:focus{outline:none;border-color:var(--gold);}
.cash-hist{margin-bottom:18px;}
.cash-hist h4{font-family:Inter,sans-serif;font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;}
.cash-tbl{width:100%;border-collapse:collapse;font-size:12.5px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;}
.cash-tbl td{padding:9px 12px;border-bottom:1px solid var(--line);color:var(--ink);}
.cash-tbl tr:last-child td{border-bottom:none;}
.cash-tbl td.num{font-family:'IBM Plex Mono',monospace;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
.cash-tbl td.st{color:var(--muted);font-size:11px;text-align:right;}
.cash-tbl tr.done td{color:var(--faint);}
.cash-tbl tr.done td.num{color:var(--muted);font-weight:500;}

/* теплова сітка готівки (головний екран Віктора) */
.cash-bento{
  --cw:#C98A2E;            /* свіже/увага */
  --cw-soft:rgba(201,138,46,.15);
  --cb:#C05A3C;            /* критично */
  animation:fadeIn .28s ease both;
  display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start;
}
@media(max-width:900px){.cash-bento{grid-template-columns:repeat(2,1fr);}}
.cash-hero{grid-column:span 2;grid-row:span 2;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius);padding:22px;box-shadow:var(--sh-1);display:flex;flex-direction:column;justify-content:space-between;min-height:196px;}
.cash-hero.calm{background:linear-gradient(180deg,#F1F6EE,var(--surface));}
.cash-hero-lab{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);}
.cash-hero-v{font-family:'IBM Plex Mono',monospace;font-size:clamp(30px,5vw,46px);font-weight:600;letter-spacing:-.03em;line-height:1;margin-top:8px;color:var(--ink);font-variant-numeric:tabular-nums;}
.cash-hero-v.calm{font-family:'Fraunces',serif;font-size:24px;color:var(--positive);letter-spacing:-.01em;}
.cash-hero-note{font-size:12px;color:var(--muted);margin-top:10px;line-height:1.4;}
.cash-hero-terrs{display:flex;gap:22px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line);}
.cash-hero-terrs .n{font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:var(--ink);}
.cash-hero-terrs .l{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);margin-top:2px;}
.cash-tile{border-radius:var(--radius-md);padding:14px;min-height:92px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;border:1px solid transparent;}
.cash-tile-nm{font-size:12px;font-weight:600;line-height:1.25;}
.cash-tile-v{font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}
.cash-tile-d{font-family:'IBM Plex Mono',monospace;font-size:10px;opacity:.82;margin-top:2px;}
.cash-tile.lvl0{background:rgba(247,244,234,.04);border-color:var(--line-dark);color:var(--on-dark-2);}
.cash-tile.lvl0 .cash-tile-v{color:var(--on-dark-3);}
.cash-tile.lvl1{background:rgba(201,138,46,.16);border-color:rgba(201,138,46,.4);color:var(--on-dark);}
.cash-tile.lvl1 .cash-tile-v{color:var(--gold-bright);}
.cash-tile.lvl2{background:var(--cw);color:#241905;}
.cash-tile.lvl3{background:var(--cb);color:#fff;box-shadow:0 6px 20px -6px rgba(192,90,60,.5);}
.cash-bento-note{grid-column:1/-1;font-size:11px;color:var(--on-dark-3);line-height:1.45;margin:4px 0 0;}

.ci-cash{text-align:center;padding:22px 4px 6px;}
.ci-cash-ic{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgba(190,138,46,.12);color:var(--gold);margin-bottom:12px;}
.ci-cash p{margin:2px 0;font-size:14px;color:var(--ink);}
.ci-cash p.hint{font-size:12.5px;color:var(--muted);margin-top:8px;}

/* ---------- склад господарських потреб ---------- */
.wh-mod .tasks-head{margin-bottom:8px;}
.wh-nav{margin-bottom:14px;flex-wrap:wrap;}
.wh-view{animation:fadeIn .2s ease both;}
.wh-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;}
.wh-search{flex:1;min-width:150px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:8px 12px;font-family:inherit;font-size:13px;background:#fff;color:var(--ink);}
.wh-search:focus{outline:none;border-color:var(--gold);}
.wh-check{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--on-dark-2);white-space:nowrap;}
.wh-reorder{background:rgba(190,138,46,.12);border:1px solid rgba(220,169,74,.3);border-radius:var(--radius-md);padding:10px 14px;font-size:12.5px;color:var(--gold-bright);margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.wh-reorder b{color:var(--on-dark);}
.wh-link{background:none;border:none;color:var(--gold-bright);font-size:12px;cursor:pointer;padding:2px 4px;text-decoration:underline;text-underline-offset:2px;font-family:inherit;}
.wh-tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);}
.wh-tbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--ink);min-width:520px;}
.wh-tbl th{text-align:right;padding:9px 12px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);background:var(--surface-alt);border-bottom:1px solid var(--line-strong);white-space:nowrap;}
.wh-tbl th:first-child{text-align:left;}
.wh-tbl td{padding:7px 12px;border-bottom:1px solid var(--line);text-align:right;font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.wh-tbl td.wh-nm{text-align:left;font-family:Inter,sans-serif;font-weight:500;}
.wh-tbl td.num{text-align:right;}
.wh-tbl td.muted{color:var(--muted);}
.wh-tbl tr:last-child td{border-bottom:none;}
.wh-tbl tfoot td{background:var(--surface-alt);font-weight:700;border-top:2px solid var(--line-strong);}
.wh-tbl tr td:first-child{border-left:3px solid transparent;}
.wh-tbl tr.st-lo td:first-child{border-left-color:var(--negative);}
.wh-tbl tr.st-mid td:first-child{border-left-color:var(--gold);}
.wh-tbl tr.st-ok td:first-child{border-left-color:var(--positive);}
.wh-cat{display:block;font-size:10px;color:var(--faint);font-weight:400;font-family:'IBM Plex Mono',monospace;}
.wh-neg{color:var(--negative);font-weight:700;}
.wh-pill{display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(160,58,42,.14);color:var(--negative);}
.wh-price{width:70px;border:1px solid transparent;background:none;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink);text-align:right;padding:4px 6px;border-radius:6px;}
.wh-price:hover{border-color:var(--line-strong);}
.wh-price:focus{outline:none;border-color:var(--gold);background:#fff;}
.wh-h4{font-family:Inter,sans-serif;font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin:20px 0 10px;}
.wh-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px;}
.wh-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;}
.wh-kpi span{font-size:11px;color:var(--muted);}
.wh-kpi b{display:block;font-family:'IBM Plex Mono',monospace;font-size:17px;color:var(--ink);margin-top:3px;}
.wh-kpi.attn{border-color:rgba(220,169,74,.35);background:linear-gradient(180deg,rgba(190,138,46,.1),var(--surface));}
.wh-kpi.attn b{color:var(--gold);}

.wh-modal{position:relative;background:var(--surface);border-radius:var(--radius);max-width:560px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:var(--sh-3);overflow:hidden;animation:fadeIn .2s ease both;}
.wh-modal-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line);font-family:'Fraunces',serif;font-size:16px;color:var(--ink);font-weight:600;}
.wh-modal-h .modal-close{position:static;width:28px;height:28px;top:auto;right:auto;}
.wh-modal-b{padding:16px 18px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;}
.wh-lines{display:flex;flex-direction:column;gap:7px;}
.wh-line{display:flex;gap:6px;align-items:center;}
.wh-line select{flex:1;min-width:0;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 9px;font-family:inherit;font-size:12.5px;background:#fff;color:var(--ink);}
.wh-line-qty{width:72px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 8px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;text-align:right;background:#fff;color:var(--ink);}
.wh-line-x{background:none;border:none;color:var(--faint);cursor:pointer;padding:4px;flex-shrink:0;}
.wh-line-x:hover{color:var(--negative);}
.wh-add{align-self:flex-start;background:none;border:1px dashed var(--line-strong);border-radius:var(--radius-sm);color:var(--muted);font-size:12px;padding:6px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;}
.wh-add:hover{border-color:var(--gold);color:var(--gold);}
.wh-modal-foot{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-family:'IBM Plex Mono',monospace;}
.wh-modal-foot b{font-size:15px;color:var(--ink);}

.wh-form{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:16px 18px;margin-bottom:16px;}
.wh-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;}
@media(max-width:640px){.wh-form-grid{grid-template-columns:1fr;}}
.wh-form-grid select{padding:8px 10px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;background:#fff;font-size:13px;color:var(--ink);}
.wh-form-act{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}

.wh-ord-list{display:flex;flex-direction:column;gap:8px;}
.wh-ord{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:11px 14px;}
.wh-ord.submitted{border-left:3px solid var(--gold);}
.wh-ord.shipped{border-left:3px solid var(--positive);}
.wh-ord-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
.wh-ord-nm{font-weight:600;color:var(--ink);font-size:13px;}
.wh-ord-st{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 8px;border-radius:999px;background:var(--surface-alt);color:var(--muted);text-transform:uppercase;letter-spacing:.03em;}
.wh-ord.submitted .wh-ord-st{background:rgba(190,138,46,.14);color:var(--gold);}
.wh-ord.shipped .wh-ord-st{background:rgba(60,107,74,.14);color:var(--positive);}
.wh-ord-at{margin-left:auto;font-size:11px;color:var(--faint);font-family:'IBM Plex Mono',monospace;}
.wh-ord-act{display:flex;gap:10px;align-items:center;margin-top:7px;}

.wh-acts{display:flex;flex-direction:column;gap:6px;}
.wh-act{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:10px 13px;cursor:pointer;}
.wh-act.k-writeoff{border-left:3px solid var(--negative);}
.wh-act.k-receipt{border-left:3px solid var(--positive);}
.wh-act.k-shipment{border-left:3px solid var(--gold);}
.wh-act-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12.5px;}
.wh-act-kind{font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);}
.wh-act-sum{font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--ink);}
.wh-act-reason{color:var(--ink-soft);flex:1;min-width:0;}
.wh-act-at{margin-left:auto;font-size:11px;color:var(--faint);font-family:'IBM Plex Mono',monospace;}
.wh-act-lines{margin-top:8px;padding-top:8px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:4px;font-size:12px;}
.wh-act-lines>div{display:flex;justify-content:space-between;color:var(--ink-soft);}
.wh-act-lines .mono{font-family:'IBM Plex Mono',monospace;color:var(--muted);}

/* витрати по СМ */
.exp-months{display:flex;flex-direction:column;gap:6px;}
.exp-month{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;}
.exp-month-h{width:100%;display:flex;align-items:center;gap:12px;padding:12px 15px;background:none;border:none;cursor:pointer;font-family:inherit;color:var(--ink);}
.exp-month-h span{font-weight:600;font-size:13px;}
.exp-month-h b{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:14px;}
.exp-month-b{padding:4px 15px 12px;display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--line);}
.exp-row{display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink-soft);padding:3px 0;}
.exp-row .mono{font-family:'IBM Plex Mono',monospace;color:var(--muted);}
.exp-cmp-pick{display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:13px;color:var(--muted);}
.exp-cmp-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:640px){.exp-cmp-cols{grid-template-columns:1fr;}}
.exp-col{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;}
.exp-col-h{display:flex;justify-content:space-between;font-weight:600;color:var(--ink);font-size:13px;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--line);}
.exp-col-h b{font-family:'IBM Plex Mono',monospace;}

/* ---------- огляд ---------- */
.ov{animation:fadeIn .28s ease both;}
.ov-h{font-family:'Fraunces',serif;font-size:20px;font-weight:600;color:var(--on-dark);margin:0 0 2px;}
.ov-sub{font-size:12px;color:var(--on-dark-3);margin:0 0 18px;}
.ov-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;}
.ov-tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:16px;box-shadow:var(--sh-1);}
.ov-tile b{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:var(--ink);display:block;font-variant-numeric:tabular-nums;}
.ov-tile span{font-size:11px;color:var(--muted);}
.ov-tile-kpi{position:relative;overflow:hidden;}
.kpi-spark{position:absolute;right:12px;bottom:12px;opacity:.9;}
.kpi-delta{display:block;margin-top:5px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:.01em;}
.kpi-delta.up{color:var(--positive);}
.kpi-delta.down{color:var(--negative);}
.kpi-delta.flat{color:var(--muted);}
.ov-tile-attn{background:linear-gradient(180deg,rgba(190,138,46,.1),var(--surface));border-color:rgba(220,169,74,.3);}
.ov-tile-attn b{color:var(--gold);}

.ov-charts{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;margin-top:16px;}
@media(max-width:820px){.ov-charts{grid-template-columns:1fr;}}
.ov-card-h{font-family:Inter,sans-serif;font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;}
.ov-card-sub{font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.45;}
.ov-card-sub b{color:var(--ink);}

.ov-whatif{display:flex;flex-direction:column;}
.wi-value{font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
.wi-diff{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;margin-top:3px;}
.wi-diff.up{color:var(--positive);}
.wi-diff.down{color:var(--negative);}
.wi-diff.flat{color:var(--muted);font-weight:500;font-family:Inter,sans-serif;line-height:1.4;}
.wi-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:999px;margin:16px 0 4px;background:linear-gradient(90deg,var(--negative-bright),var(--gold-bright) 50%,var(--positive-bright));outline:none;}
.wi-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:var(--surface);border:2px solid var(--gold);box-shadow:var(--sh-2);cursor:pointer;}
.wi-slider::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--surface);border:2px solid var(--gold);box-shadow:var(--sh-2);cursor:pointer;}
.wi-scale{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);margin-bottom:6px;}
.wi-chart{margin-top:6px;}

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

const KEEP_KEY = "dnipro-m-keep";   // «Не виходити» відмічено
const ALIVE_KEY = "dnipro-m-alive"; // sessionStorage: жива вкладка (переживає reload, не переживає закриття)

function MaintenanceScreen({ message }) {
  return (
    <div className="maint-screen">
      <div className="maint-card">
        <span className="maint-ic"><Clock size={40} /></span>
        <h1>Тривають технічні роботи</h1>
        <p>{message || "Оновлюємо застосунок. Спробуйте зайти за кілька хвилин."}</p>
        <button className="btn-secondary" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Оновити сторінку
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);      // активний кабінет { key, type, tmKey, label }
  const [remembered, setRemembered] = useState(null); // збережений вхід (для смужки на головній)
  const [pending, setPending] = useState(null);
  const [ready, setReady] = useState(false);
  const [, setRefsV] = useState(0); // ре-рендер після завантаження текстів «Умови»/лейблів
  const bumpRefs = () => setRefsV((v) => v + 1);
  const [maint, setMaint] = useState(null); // { on, message } | null

  useEffect(() => {
    let a = true;
    getMaintenance().then((f) => { if (a && f) setMaint(f); });
    return subscribeFlags(() => getMaintenance().then((f) => { if (a && f) setMaint(f); }));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const keep = localStorage.getItem(KEEP_KEY) === "1";
      const aliveTab = sessionStorage.getItem(ALIVE_KEY) === "1";
      const cab = await currentCabinet();
      if (cab && !keep && !aliveTab) {
        // сесія є, але «Не виходити» не відмічено і вкладку відкрито заново → вийти
        await signOutCab();
        if (active) { setReady(true); }
        return;
      }
      sessionStorage.setItem(ALIVE_KEY, "1");
      if (cab) {
        await initAfterAuth();
        loadCalcRefs().then(() => { if (active) bumpRefs(); });
        if (active) { setSession(cab); if (keep) setRemembered(cab); }
      }
      if (active) setReady(true);
    })();
    return () => { active = false; };
  }, []);

  const enter = (cab, remember) => {
    setSession(cab);
    setPending(null);
    localStorage.setItem(KEEP_KEY, remember ? "1" : "0");
    sessionStorage.setItem(ALIVE_KEY, "1");
    setRemembered(remember ? cab : null);
    loadCalcRefs().then(bumpRefs);
  };
  const goHome = () => setSession(null);            // на головну, сесія Supabase лишається
  const logout = async () => { await signOutCab(); localStorage.removeItem(KEEP_KEY); setSession(null); setRemembered(null); };
  const pick = async (cab) => {
    if (remembered && remembered.key === cab.key) { setSession(cab); return; }
    const cur = await currentCabinet();
    if (cur && cur.key === cab.key) setSession(cur);
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
      {ready && session && maint?.on && session.key !== ADMIN_KEY && (
        <MaintenanceScreen message={maint.message} />
      )}
      {ready && session && !(maint?.on && session.key !== ADMIN_KEY) && (
        <CabinetRouter cabinet={session} onExit={goHome} onLogout={logout} />
      )}
    </div>
  );
}
