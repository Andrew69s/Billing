import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Warehouse, Paperclip, Info, PackagePlus, TrendingDown, Minus, Moon, Sun, Truck, ScanLine, ShieldCheck, BadgePercent, Search, Lock,
} from "lucide-react";
import {
  MANAGER, ACCOUNTANT, OFFICE, TMS, SALONS, salonLabel, salonByKey, salonsOfTm, salonTmOn, tmByKey, cabName,
  verifyLogin, getLogin, currentCabinet, signOutCab, initAfterAuth, loadReassignCache,
  ADMIN_KEY, ADMIN_NAME, listRecoveryRequests, clearRecovery,
  masterLogin, confirmRecovery, adminSetPassword,
  listReassignments, addReassignment, removeReassignment,
  listFopHistory, addFopAssignment, removeFopAssignment, fopEntryOn, fopOn, currentFop, fopHistoryAll,
  CAPABILITIES, getCapabilities, setCapabilities, listLog, ALL_CAB_KEYS,
  getModuleAccess, setModuleAccess, moduleAccessAllows, getModuleCatalog, saveModuleCatalog, subscribeModuleAccess,
  getModuleExtra, addModuleExtra, removeModuleExtra,
  cabType, PARTICIPANTS, canAssign,
} from "./org.js";
import { emptySmData, SM_FIELD_LABELS } from "./smCalc.js";
import { onUpdateReady, applyUpdate } from "./lib/pwaUpdate.js";
import {
  calcTm, calcTmBatch, calcSmBatch, useTmCalc,
  subscribeCalcBusy, calcBusyNow, warmCalc,
} from "./lib/calc.js";
import {
  loadCalcRefs, tmCond, smCond, planBracketLabel, smCategoryOptions, managerCoefOptions,
} from "./lib/calcRefs.js";
import { TASK_STATUS, listTasks, createTasks, setTaskStatus, deleteTask, deleteTaskBatch, groupTasks, markSeen, markTaskAck, subscribeTasks } from "./lib/tasks.js";
import {
  INVOICE_STATUS, INVOICE_FLOW, nextStatus, deriveVat,
  listInvoices, createInvoice, createManualInvoice, setInvoiceStatus, updateInvoice, deleteInvoice, subscribeInvoices, extractInvoice, getInvoice,
  listCounterparties,
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
  listScheduleLocks, setScheduleLock, scheduleLockedFor, subscribeScheduleLocks, planFactGaps,
} from "./lib/shifts.js";
import { getSmPlan, listSmPlans, listSmPlansForSalon, listSmPlansForSalons, saveSmPlan, setPlanLock, subscribePlans, emptyPlan } from "./lib/plans.js";
import { upsertTurnoverMonthFact, listTurnoverHistory, listTurnoverHistoryForSalons, subscribeTurnoverHistory } from "./lib/turnover.js";
import { EZ_PAYMENT_METHODS, listEzSales, createEzSale, updateEzSale, processEzSale, deleteEzSale, recomputeTurnoverEz, subscribeEzSales } from "./lib/ez.js";
import {
  listNotifications, markRead, markAllRead, notify, subscribeNotifications,
} from "./lib/notifications.js";
import {
  TM_METRICS, SALON_MONTH_PLAN, daysInYm, dateOf,
  listMetrics, listMetricsRange, daysBetween, listPlans, planOf, effective, saveManual, resetManual, syncFromPlanner, subscribeMetrics, monthAgg, planAgg,
} from "./lib/territory.js";
import { getMaintenance, setMaintenance, getSmSalaryLock, smSalaryLockedFor, setSmSalaryLock, subscribeFlags } from "./lib/appFlags.js";
import { submitFeedback, listFeedback, setFeedbackStatus, resolveFeedback, deleteFeedback, subscribeFeedback } from "./lib/feedback.js";
import {
  bDaysInYm, bDateOf, bonusNet, listBonusYear, saveBonusDay, subscribeBonus, bonusYearAgg,
  listBonusMonthly, bonusMonthlyMap, upsertBonusMonthly, deleteBonusMonthly,
} from "./lib/bonus.js";
import { pushState, enablePush, disablePush } from "./lib/push.js";
import { soundOn, setSoundOn, desktopSupported, desktopPermission, desktopOn, setDesktopOff, enableDesktop, alertNew } from "./lib/alerts.js";
import {
  listCashDays, outstandingBySalon, setCashDay, cashHandover, listHandovers, subscribeCash,
  yesterdayISO as cashYesterday,
} from "./lib/cash.js";
import {
  SUPPLY_CATEGORIES, SUPPLY_UNITS, CENTRAL, CENTRAL_DRAW_SALONS, ACT_KIND, uah as suah, uahN as suahN,
  WRITEOFF_ARTICLES_BUILTIN, listWriteoffArticles, saveWriteoffArticles, articleLabel,
  listItems, upsertItem, deleteItem, setPrice, listStock, stockMap, stockState,
  listActs, actLines, writeoffLines, salonSupplyExpenseLines, actSalon, receipt as whReceipt, writeoff as whWriteoff, adjust as whAdjust,
  shipOrder, receiveOrder, listOrders, orderLines, createOrder, saveOrderLines, submitOrder, deleteOrder,
  markOrderedFromSupplier, extractNakladna,
  subscribeSupply,
} from "./lib/supply.js";
import {
  EXPENSE_CATEGORIES, MANUAL_CATEGORIES, catOf,
  listExpenses, createExpense, deleteExpense, uploadReceipt, receiptUrl,
} from "./lib/expenses.js";
import {
  listTrainings, createTraining, updateTraining, deleteTraining,
  listTrainingResults, upsertTrainingResult, extractTrainingScreenshot,
  subscribeTrainings, daysToDeadline, salonMonthAvg,
} from "./lib/training.js";
import {
  listZsuCodes, parseCodes, uploadZsuCodes, markZsuUsed, undoZsuUsed, deleteZsuCode, subscribeZsuCodes,
} from "./lib/zsu.js";
import {
  listMedokCompanies, addMedokCompany, deleteMedokCompany, isMedokCompany, subscribeMedok,
} from "./lib/medok.js";
import { fetchPlannerDay } from "./lib/plannerDay.js";

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
/* дедуп одночасних читань одного ключа (кілька компонентів монтуються разом
   і всі просять data:<tm>:<ym>) — без кешу в часі, лише спільний in-flight промис */
const _loadDataInflight = new Map();
async function loadData(tmKey, ym) {
  const key = `data:${tmKey}:${ym}`;
  if (_loadDataInflight.has(key)) return _loadDataInflight.get(key);
  const p = (async () => {
    try {
      const r = await window.storage.get(key, true);
      return r ? { ...emptyData(), ...JSON.parse(r.value) } : emptyData();
    } catch { return emptyData(); }
    finally { _loadDataInflight.delete(key); }
  })();
  _loadDataInflight.set(key, p);
  return p;
}
async function saveData(tmKey, ym, data) {
  _loadDataInflight.delete(`data:${tmKey}:${ym}`);
  try { await window.storage.set(`data:${tmKey}:${ym}`, JSON.stringify(data), true); } catch (e) { console.error(e); }
}
async function loadAdj(tmKey, ym) {
  try { const r = await window.storage.get(`adj:${tmKey}:${ym}`, true); return r ? { amount: 0, comment: "", advance: 0, official: 0, birthdays: 0, ...JSON.parse(r.value) } : { amount: 0, comment: "", advance: 0, official: 0, birthdays: 0 }; }
  catch { return { amount: 0, comment: "", advance: 0, official: 0, birthdays: 0 }; }
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
  // фіксуємо реальний оборот в історію (для авто-категоризації) — лише коли це вже
  // не чернетка: подано СМ або скориговано ТМ
  if ((data.status === "submitted" || data.status === "corrected") && data.base?.monthFact) {
    upsertTurnoverMonthFact(salonKey, ym, data.base.monthFact).catch(() => {});
  }
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

/* Дістати зображення з системного буфера обміну (кнопка «Вставити зі скріншота»).
   Повертає File або null. */
async function readClipboardImage() {
  try {
    if (!navigator.clipboard?.read) return null;
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith("image/"));
      if (type) {
        const blob = await it.getType(type);
        return new File([blob], "clipboard.png", { type });
      }
    }
  } catch { /* немає доступу / порожньо */ }
  return null;
}
/* image File із події paste (Ctrl+V у вікні) */
function pasteEventImage(e) {
  for (const it of e.clipboardData?.items || []) {
    if (it.type.startsWith("image/")) return it.getAsFile();
  }
  return null;
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
        if (b.h) return <h4 key={i} className="cond-h">{b.h}</h4>;
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

const THEME_KEY = "dnipro-m-theme";
function applyTheme(t) {
  try { document.documentElement.dataset.theme = t; } catch { /* ignore */ }
}
function getStoredTheme() {
  try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "dark"; }
  catch { return "dark"; }
}
// застосувати збережену тему одразу при завантаженні
applyTheme(getStoredTheme());

function ThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme);
  useEffect(() => { applyTheme(theme); try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ } }, [theme]);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="topbar-theme" onClick={() => setTheme(next)}
      title={next === "light" ? "Світла тема" : "Темна тема"} aria-label="Перемкнути тему"
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={16} />}
    </button>
  );
}

function NewsQuickModal({ onClose }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      for (const k of ALL_CAB_KEYS) await notify({ recipient: k, kind: "news", title: title.trim(), body: body.trim(), actor: ADMIN_KEY, link: "" });
      pushToast({ title: "Новину надіслано", body: `${ALL_CAB_KEYS.length} кабінет(ів)` });
      onClose();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Нова новина</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <input className="task-input" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea className="task-input" rows={3} placeholder="Текст (необовʼязково)" value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="hint">Прилітає в сповіщення (дзвіночок) усім кабінетам ({ALL_CAB_KEYS.length}). Обрати конкретних отримувачів — в Адміністрування → Новини.</p>
        </div>
        <div className="modal-foot">
          <span />
          <button className="btn-primary" onClick={send} disabled={busy || !title.trim()}>{busy ? "…" : "Надіслати всім"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QuickCreate({ cabKey }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null); // "task" | "news" | null
  const cab = useMemo(() => ({ key: cabKey, type: cabType(cabKey) }), [cabKey]);
  const isAdmin = cabKey === ADMIN_KEY;
  // магазини, за які цей кабінет може внести витрату (те саме, що дозволяє RLS)
  const expSalons = useMemo(() => (
    cab.type === "sm" ? [salonByKey(cabKey)].filter(Boolean)
      : cab.type === "tm" ? salonsOfTm(cabKey)
        : SALONS
  ), [cab.type, cabKey]);
  return (
    <div className="qc-wrap">
      <button className="topbar-quick" onClick={() => setOpen((v) => !v)} aria-label="Створити" title="Нова задача чи новина">
        <Plus size={18} />
      </button>
      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="qc-panel">
            <button className="qc-item" onClick={() => { setOpen(false); setModal("task"); }}>
              <ListChecks size={15} /> Нова задача
            </button>
            {cab.type === "sm" && (
              <button className="qc-item" onClick={() => { setOpen(false); setModal("ez"); }}>
                <BadgePercent size={15} /> Продаж ЕЗ
              </button>
            )}
            {expSalons.length > 0 && (
              <button className="qc-item" onClick={() => { setOpen(false); setModal("expense"); }}>
                <TrendingDown size={15} /> Нова витрата
              </button>
            )}
            {isAdmin && (
              <button className="qc-item" onClick={() => { setOpen(false); setModal("news"); }}>
                <Sparkles size={15} /> Новина для всіх
              </button>
            )}
          </div>
        </>
      )}
      {modal === "task" && <TaskCreateModal cab={cab} onClose={() => setModal(null)} onCreated={() => {}} />}
      {modal === "news" && <NewsQuickModal onClose={() => setModal(null)} />}
      {modal === "ez" && <EzSaleForm salonKey={cabKey} ym={nowYm()} cabKey={cabKey} onClose={() => setModal(null)} onCreated={() => {}} />}
      {modal === "expense" && (
        <ExpenseCreateModal
          salons={expSalons}
          defaultSalon={cab.type === "sm" ? cabKey : expSalons[0]?.key}
          onClose={() => setModal(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}

function TopBar({ title, onBack, onLogout, cabKey, onMenu }) {
  return (
    <div className="topbar">
      {onMenu && (
        <button className="topbar-menu" onClick={onMenu} aria-label="Меню"><Menu size={18} /></button>
      )}
      {onBack && <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> Назад</button>}
      <button className="topbar-title topbar-title-btn" onClick={openPalette} title="Пошук і швидкі дії (Ctrl/⌘ + K)">
        <span>{title}</span>
        <kbd className="topbar-kbd">⌘K</kbd>
      </button>
      <div className="topbar-right">
        <CalcBusyDot />
        {cabKey && <QuickCreate cabKey={cabKey} />}
        <ThemeToggle />
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
/* шина навігації — клік по сповіщенню відкриває відповідний модуль кабінету */
const navBus = typeof window !== "undefined" ? new EventTarget() : null;
function goToModule(key) {
  navBus?.dispatchEvent(new CustomEvent("nav", { detail: key }));
}
/* командний рядок (⌘K / Ctrl+K) */
const paletteBus = typeof window !== "undefined" ? new EventTarget() : null;
const openPalette = () => paletteBus?.dispatchEvent(new Event("open"));
/* шина сповіщень — щоб дзвіночок і бейджі на вкладках синхронно оновлювались */
const notifBus = typeof window !== "undefined" ? new EventTarget() : null;
const pokeNotifs = () => notifBus?.dispatchEvent(new Event("c"));
/* link/kind сповіщення → канонічна ціль (модуль) */
const NOTIF_LINK_MODULE = {
  tasks: "tasks", salary: "salary", warehouse: "warehouse", supply: "warehouse",
  invoices: "invoices", invoice: "invoices", feedback: "feedback", shifts: "shifts", bonus: "bonus",
  training: "training", zsu: "zsu",
};
/* канонічна ціль → можливі ключі модуля в різних кабінетах */
const NOTIF_MODULE_KEYS = {
  invoices: ["bn", "inv"], warehouse: ["warehouse"], tasks: ["tasks"], salary: ["salary"],
  feedback: ["feedback"], shifts: ["shifts"], bonus: ["bonus"], kpi: ["kpi"],
  training: ["training"], zsu: ["zsu"],
};
const notifTargetOf = (n) => {
  const linkKey = String(n?.link || "").split(":")[0];
  return NOTIF_LINK_MODULE[linkKey] || NOTIF_LINK_MODULE[n?.kind] || linkKey || "";
};
function moduleKeyForNotif(items, n) {
  const t = notifTargetOf(n);
  if (!t) return null;
  const cands = [t, ...(NOTIF_MODULE_KEYS[t] || [])];
  return items.find((m) => cands.includes(m.key))?.key || null;
}

const notifIcon = (kind) => {
  if (kind === "task_new") return <CheckSquare size={15} />;
  if (kind === "task_status") return <Check size={15} />;
  if (kind === "salary") return <Wallet size={15} />;
  if (kind === "invoice") return <CreditCard size={15} />;
  if (kind === "birthday") return <Cake size={15} />;
  if (kind === "feedback") return <MessageSquare size={15} />;
  if (kind === "supply") return <Warehouse size={15} />;
  if (kind === "news") return <Sparkles size={15} />;
  if (kind === "training") return <GraduationCap size={15} />;
  return <Bell size={15} />;
};

/* кабінети з доступом до основного складу — сюди летять сповіщення по замовленнях */
const WH_MANAGER_CABS = ["lviv-lypynskoho", "olha"];
const notifyWhManagers = (exceptKey, payload) =>
  WH_MANAGER_CABS.filter((k) => k !== exceptKey).forEach((k) => notify({ recipient: k, ...payload }));
const relTime = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "щойно";
  if (s < 3600) return `${Math.floor(s / 60)} хв тому`;
  if (s < 86400) return `${Math.floor(s / 3600)} год тому`;
  return `${Math.floor(s / 86400)} дн тому`;
};

/* звук і сповіщення на екрані комп'ютера (коли вкладка прихована) */
function AlertToggles() {
  const [sound, setSound] = useState(soundOn());
  const [desk, setDesk] = useState(desktopOn());
  const [perm, setPerm] = useState(desktopPermission());
  const flipSound = () => {
    const next = !sound;
    setSoundOn(next); setSound(next);
    pushToast({ title: next ? "Звук сповіщень увімкнено" : "Звук сповіщень вимкнено" });
  };
  const flipDesk = async () => {
    if (desk) { setDesktopOff(); setDesk(false); pushToast({ title: "Сповіщення на екрані вимкнено" }); return; }
    const p = await enableDesktop();
    setPerm(p);
    if (p === "granted") { setDesk(true); pushToast({ title: "Сповіщення на екрані увімкнено", body: "З'являтимуться, коли вкладка прихована" }); }
    else pushToast({ title: "Дозвіл не надано", body: "Дозвольте сповіщення для цього сайту в налаштуваннях браузера" });
  };
  return (
    <>
      <button className={`notif-push ${sound ? "on" : ""}`} onClick={flipSound}>
        <Bell size={14} /><span>{sound ? "Звук сповіщень · увімкнено" : "Увімкнути звук сповіщень"}</span>
        <span className={`notif-push-sw ${sound ? "on" : ""}`} />
      </button>
      {desktopSupported() && (
        <button className={`notif-push ${desk ? "on" : ""}`} onClick={flipDesk} disabled={perm === "denied"}>
          <Bell size={14} />
          <span>{perm === "denied" ? "Сповіщення на екрані заблоковано в браузері" : desk ? "На екрані, коли вкладка прихована · увімкнено" : "Показувати на екрані, коли вкладка прихована"}</span>
          {perm !== "denied" && <span className={`notif-push-sw ${desk ? "on" : ""}`} />}
        </button>
      )}
    </>
  );
}

function PushToggle({ cabKey }) {
  const [state, setState] = useState(null); // unsupported|denied|on|off|null
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setState); }, []);
  if (state === null || state === "unsupported") return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === "on") { await disablePush(); setState("off"); pushToast({ title: "Ранкові сповіщення вимкнено" }); }
      else { await enablePush(cabKey); setState("on"); pushToast({ title: "Ранкові сповіщення увімкнено", body: "Підсумок приходитиме зранку" }); }
    } catch (e) {
      pushToast({ title: "Не вдалося", body: String(e.message || e) });
      pushState().then(setState);
    }
    setBusy(false);
  };

  return (
    <button className={`notif-push ${state === "on" ? "on" : ""}`} onClick={toggle} disabled={busy || state === "denied"}>
      <Bell size={14} />
      <span>
        {state === "denied" ? "Сповіщення заблоковано в браузері"
          : state === "on" ? "Ранкові сповіщення · увімкнено"
          : "Увімкнути ранкові сповіщення"}
      </span>
      {state !== "denied" && <span className={`notif-push-sw ${state === "on" ? "on" : ""}`} />}
    </button>
  );
}

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
      alertNew(n, () => { const t = notifTargetOf(n); if (t) goToModule(t); }); // звук + сповіщення на екрані, якщо вкладка прихована
    });
    const onLocal = (e) => showToast(e.detail || {});
    toastBus?.addEventListener("toast", onLocal);
    notifBus?.addEventListener("c", reload);
    return () => { unsub(); toastBus?.removeEventListener("toast", onLocal); notifBus?.removeEventListener("c", reload); };
  }, [cabKey]);

  const unread = items.filter((n) => !n.read).length;
  const onOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      try {
        await markAllRead();
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        pokeNotifs();
      } catch (e) {
        // не позначаємо локально — щоб лічильник лишився правдивим і повторив спробу
        pushToast({ title: "Не вдалося позначити прочитаним", body: "Спробуйте ще раз" });
      }
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
                  <button className="notif-clear" onClick={async () => { try { await markAllRead(); setItems((p) => p.map((n) => ({ ...n, read: true }))); pokeNotifs(); } catch { pushToast({ title: "Не вдалося", body: "Спробуйте ще раз" }); } }}>
                    прочитати всі
                  </button>
                )}
              </div>
              <AlertToggles />
              <PushToggle cabKey={cabKey} />
              <div className="notif-list">
                {items.length === 0 && <div className="notif-empty">Поки що порожньо</div>}
                {items.map((n) => {
                  const linkId = String(n.link || "").split(":")[1];
                  const target = notifTargetOf(n) || null;
                  const onClick = async () => {
                    setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                    await markRead(n.id).catch(() => {});
                    pokeNotifs();
                    if (target === "tasks" && linkId) _focusTaskId = linkId;
                    if (target) { goToModule(target); setOpen(false); }
                  };
                  return (
                    <button className={`notif-item ${n.read ? "" : "notif-unread"} ${target ? "is-link" : ""}`} key={n.id} onClick={onClick}>
                      <span className="notif-ic">{notifIcon(n.kind)}</span>
                      <div className="notif-body">
                        <b>{n.title}</b>
                        {n.body && <p>{n.body}</p>}
                        <time>{relTime(n.created_at)}{target ? " · відкрити →" : ""}</time>
                      </div>
                    </button>
                  );
                })}
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

/* Підказка ТМ: сума обороту з дзвінків, яку вже внесли СМ по території
   за цей місяць (форма ЗП СМ, 3.1) — одним кліком підставляється в 2.1. */
function CallsRevenueHint({ tmKey, ym, readOnly, onUse }) {
  const [sum, setSum] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const salons = salonsOfTm(tmKey, ym);
        const employees = await listEmployees().catch(() => []);
        const rows = await Promise.all(salons.map((s) => salonSalaryRows(s.key, ym, employees)));
        const total = rows.flat().reduce((a, r) => a + (Number(r.data?.bonus?.callsRevenue) || 0), 0);
        if (active) setSum(total);
      } catch { if (active) setSum(null); }
    })();
    return () => { active = false; };
  }, [tmKey, ym]);
  if (sum == null) return null;
  return (
    <div className="calls-hint">
      <span>Обіг з дзвінків по території за {monthLabel(ym).toLowerCase()} (з форм СМ, 3.1): <b>{fmt(sum)}</b></span>
      {!readOnly && <button type="button" className="calls-hint-use" onClick={() => onUse(sum)}>Підставити</button>}
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
        <CallsRevenueHint tmKey={tmKey} ym={ym} readOnly={readOnly} onUse={(v) => update(["block2", "callsRevenue"], v)} />
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

/* Липка шапка розрахунку ЗП: жива сума «на руки», нараховано, грейд, статус */
function SalaryStickyBar({ grand, accrued, grade, status }) {
  const map = { draft: ["чернетка", ""], submitted: ["на розгляді", "ok"], approved: ["погоджено", "ok"], corrected: ["корективи", "warn"] };
  const [lab, cls] = map[status] || map.draft;
  return (
    <div className="sal-sticky">
      <div className="ss-main"><span className="ss-lab">На руки</span><b className="ss-big">{fmt(grand)}</b></div>
      <div className="ss-sub">
        <span>нараховано&nbsp;<b>{fmt(accrued)}</b></span>
        {grade != null && <span>грейд&nbsp;<b>{grade}</b></span>}
      </div>
      <span className={`ss-st ${cls}`}>{lab}</span>
    </div>
  );
}

function SalarySummary({ data, grade, tmKey, ym, adj, qbonus, isLastMonthOfQuarter, expandedBlock, onToggle, editable, deductEditable, onAdjChange, onSaveAdj, savingAdj, onSetPaymentStatus, monthLbl, calc }) {
  const advance = adj.advance || 0;
  const official = adj.official || 0;
  const birthdays = adj.birthdays || 0;
  const accrued = calc.floored + (isLastMonthOfQuarter ? (qbonus.bonus41 + qbonus.bonus42) : 0) + (adj.amount || 0);
  const grandTotal = accrued - advance - official - birthdays;
  const deductFields = editable || deductEditable;

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
        <div className="adj-row">
          <span>Додатково (керівник)</span>
          <input className="adj-comment" placeholder="напр. премія за ініціативу" value={adj.comment} onChange={(e) => onAdjChange({ ...adj, comment: e.target.value })} />
          <NumInput className="adj-amount" value={adj.amount} onChange={(v) => onAdjChange({ ...adj, amount: v })} />
          <span>грн</span>
        </div>
      ) : (adj.amount || 0) !== 0 && (
        <div className="summary-row"><span>Додатково{adj.comment ? ` (${adj.comment})` : ""}</span><b>{fmt(adj.amount)}</b></div>
      )}

      <div className="summary-row total"><span>Загалом нараховано</span><b>{fmt(accrued)}</b></div>

      {deductFields ? (
        <>
          <div className="adj-row"><span>Офіційно на картку</span>
            <NumInput className="adj-amount" value={adj.official} onChange={(v) => onAdjChange({ ...adj, official: v })} /><span>грн</span>
          </div>
          <div className="adj-row"><span>Аванс готівка</span>
            <NumInput className="adj-amount" value={adj.advance} onChange={(v) => onAdjChange({ ...adj, advance: v })} /><span>грн</span>
          </div>
          <div className="adj-row"><span>Дні народження</span>
            <NumInput className="adj-amount" value={adj.birthdays} onChange={(v) => onAdjChange({ ...adj, birthdays: v })} /><span>грн</span>
            {onSaveAdj && <button className="btn-secondary small" onClick={onSaveAdj} disabled={savingAdj}>{savingAdj ? "…" : "Зберегти"}</button>}
          </div>
        </>
      ) : (
        <>
          {official !== 0 && <div className="summary-row"><span>Офіційно на картку</span><b>-{fmt(official)}</b></div>}
          {advance !== 0 && <div className="summary-row"><span>Аванс готівка</span><b>-{fmt(advance)}</b></div>}
          {birthdays !== 0 && <div className="summary-row"><span>Дні народження</span><b>-{fmt(birthdays)}</b></div>}
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
  const [adj, setAdj] = useState({ amount: 0, comment: "", advance: 0, official: 0, birthdays: 0 });
  const [grade, setGrade] = useState(2);
  const [qbonus, setQbonus] = useState({ bonus41: 0, bonus42: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("form");
  const [expandedBlock, setExpandedBlock] = useState(null);
  const skipSave = React.useRef(true);
  const skipAdj = React.useRef(true);

  const qKey = ymToQuarter(ym);
  const qMonths = quarterMonths(qKey);
  const isLastMonthOfQuarter = ym === qMonths[2];
  const { calc, error: calcError } = useTmCalc(data, grade, tmKey, ym);

  useEffect(() => {
    let active = true;
    setLoading(true);
    skipSave.current = true;
    skipAdj.current = true;
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
    try {
      await saveData(tmKey, ym, data);
      setSavedAt(new Date());
      pushToast({ title: "Чернетку збережено", body: monthLabel(ym) });
    } catch (e) {
      pushToast({ title: "Не вдалося зберегти", body: String(e.message || e) });
    }
    setSaving(false);
  };
  // автозбереження через 2,5 с після останньої зміни
  useEffect(() => {
    if (loading) return undefined;
    if (skipSave.current) { skipSave.current = false; return undefined; }
    const t = setTimeout(async () => { await saveData(tmKey, ym, data); setSavedAt(new Date()); }, 2500);
    return () => clearTimeout(t);
  }, [data, loading, tmKey, ym]);
  // автозбереження утримань (Офіційно/Аванс/Дні народження) — окреме сховище adj:*
  useEffect(() => {
    if (loading) return undefined;
    if (skipAdj.current) { skipAdj.current = false; return undefined; }
    const t = setTimeout(() => { saveAdj(tmKey, ym, adj).catch(() => {}); }, 1200);
    return () => clearTimeout(t);
  }, [adj, loading, tmKey, ym]);

  const submit = async () => {
    if (!confirm(`Подати ЗП за ${monthLabel(ym)} на погодження керівнику?`)) return;
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
    try {
      await saveData(tmKey, ym, next);
      setData(next);
      pushToast({ title: "Подано на погодження", body: `ЗП за ${monthLabel(ym)} → керівник` });
    } catch (e) {
      pushToast({ title: "Не вдалося подати", body: String(e.message || e) });
    }
    setSaving(false);
  };

  const onReply = async (comment) => {
    const next = { ...data, tmReplyComment: comment, tmRepliedAt: new Date().toISOString() };
    await saveData(tmKey, ym, next);
    setData(next);
    pushToast({ title: "Відповідь надіслано керівнику" });
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

      {!loading && !calc && calcError ? (
        <div className="loading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span>Не вдалося порахувати ЗП: {String(calcError)}</span>
          <button className="btn-secondary small" onClick={() => window.location.reload()}>Спробувати ще раз</button>
        </div>
      ) : loading || !calc ? <div className="loading">Завантаження…</div> : tab === "form" ? (
        <>
          <SalaryStickyBar
            grand={calc.floored + (isLastMonthOfQuarter ? (qbonus.bonus41 + qbonus.bonus42) : 0) + (adj.amount || 0) - (adj.advance || 0) - (adj.official || 0) - (adj.birthdays || 0)}
            accrued={calc.floored + (isLastMonthOfQuarter ? (qbonus.bonus41 + qbonus.bonus42) : 0) + (adj.amount || 0)}
            grade={grade} status={data.status}
          />
          <CriteriaForm data={data} update={update} grade={grade} tmKey={tmKey} ym={ym} showAmounts calc={calc}
            onAddShot={onAddShot} onRemoveShot={onRemoveShot} onPreview={setPreview} readOnly={false} />
          <SalarySummary
            data={data} grade={grade} tmKey={tmKey} ym={ym} adj={adj} qbonus={qbonus} isLastMonthOfQuarter={isLastMonthOfQuarter}
            expandedBlock={expandedBlock} onToggle={toggleBlock} editable={false} deductEditable onAdjChange={setAdj}
            monthLbl={monthLabel(ym)} calc={calc}
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
  const [adj, setAdj] = useState({ amount: 0, comment: "", advance: 0, official: 0, birthdays: 0 });
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

  const saveAdjOnly = async () => {
    setSavingAdj(true);
    try { await saveAdj(tmKey, ym, adj); pushToast({ title: "Коригування збережено", body: monthLabel(ym) }); }
    catch (e) { pushToast({ title: "Не вдалося зберегти", body: String(e.message || e) }); }
    setSavingAdj(false);
  };
  const setPaymentStatus = async (status) => {
    const next = { ...data, paymentStatus: status, paymentStatusAt: new Date().toISOString() };
    setData(next);
    await saveData(tmKey, ym, next);
    if (status === "to_pay") { notify({ recipient: tmKey, kind: "salary", title: "ЗП призначено до виплати", body: monthLabel(ym), actor: "manager", link: "salary" }); pushToast({ title: "Призначено до виплати", body: monthLabel(ym) }); }
    if (status === "paid") { notify({ recipient: tmKey, kind: "salary", title: "ЗП виплачено", body: monthLabel(ym), actor: "manager", link: "salary" }); pushToast({ title: "Позначено як виплачено", body: monthLabel(ym) }); }
  };

  const sendBack = async () => {
    if (!confirm(`Повернути ЗП ${TM_LIST.find((t) => t.key === tmKey)?.name || ""} за ${monthLabel(ym)} на доопрацювання?`)) return;
    setSavingCorr(true);
    const next = { ...data, status: "corrected", correctedAt: new Date().toISOString(), managerComment: correctionComment };
    try {
      await saveData(tmKey, ym, next);
      setData(next);
      setCorrectionComment("");
      notify({ recipient: tmKey, kind: "salary", title: "Керівник повернув ЗП на доопрацювання", body: monthLabel(ym), actor: "manager", link: "salary" });
      pushToast({ title: "Повернено на доопрацювання", body: `ТМ отримає сповіщення` });
    } catch (e) {
      pushToast({ title: "Не вдалося виконати", body: String(e.message || e) });
    }
    setSavingCorr(false);
  };
  const approve = async () => {
    if (!confirm(`Погодити ЗП ${TM_LIST.find((t) => t.key === tmKey)?.name || ""} за ${monthLabel(ym)}?`)) return;
    setSavingCorr(true);
    const next = { ...data, status: "approved", approvedAt: new Date().toISOString(), managerFlags: {}, managerComment: "" };
    try {
      await saveData(tmKey, ym, next);
      setData(next);
      notify({ recipient: tmKey, kind: "salary", title: "Керівник погодив вашу ЗП", body: monthLabel(ym), actor: "manager", link: "salary" });
      pushToast({ title: "ЗП погоджено", body: monthLabel(ym) });
    } catch (e) {
      pushToast({ title: "Не вдалося погодити", body: String(e.message || e) });
    }
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

// Паньків Іван — повністю прибраний з деки (2026-09-14, за проханням користувача).
// Кабінет і дані в базі не видалені — щоб повернути тайл на головну,
// приберіть цей фільтр (HIDDEN_TM_KEYS.includes(...)) нижче в TMS.filter(...).
const HIDDEN_TM_KEYS = ["ivan"];

function HierarchyHome({ onPick, remembered, onLogout }) {
  return (
    <div className="role-select deck-screen">
      <div className="deck-inner fade-in">
        <span className="role-eyebrow">WorkSpace</span>
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

          {TMS.filter((tm) => !HIDDEN_TM_KEYS.includes(tm.key)).map((tm) => {
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
/* =========================================================
   СМ · РОЗРАХУНОК ЗП МАГАЗИНУ — одна таблиця на всіх співробітників
   Дані лишаються по співробітниках (smdata:<салон>:<співробітник>:<місяць>),
   спільні цифри магазину (ТО, дзвінки, сайт, БН, PPI, рекорд, скріни) пишуться в усі документи.
========================================================= */
const ST_SHARED = [
  ["base", "monthFact"], ["base", "viktorChecks"], ["base", "lowMarginChecks"], ["base", "categoryOverride"],
  ["bonus", "callsRevenue"], ["bonus", "siteNpRevenue"], ["bonus", "bnRevenue"],
  ["ppi", "ppiRevenue"], ["ppi", "planClosed"],
  ["record", "monthlyTo"], ["record", "prevRecord"],
];
const ST_SHOTS = [
  ["base", "Категорія та база"], ["attest", "Атестація"], ["standards", "Стандарти"], ["coef", "Коефіцієнт керуючого"],
  ["calls", "Обіг з дзвінків"], ["replace", "Заміна"], ["sc", "Середній чек"], ["cl", "Довжина чека"],
  ["np", "Сайт через НП"], ["bn", "Продаж по БН"], ["ppi", "PPI"],
  ["record", "Рекорд"], ["quarter", "Квартальна премія"], ["bonusExtra", "Бонус"],
];
const ST_ROLE_COEF = { manager: "1.2", acting_manager: "1.1", seller: "1.0", intern: "1.0" };
const stNum = (n) => Math.round(n || 0).toLocaleString("uk-UA");
const stMoney = (v) => (v ? <span className={v < 0 ? "st-neg" : ""}>{stNum(v)}</span> : <span className="st-mute">—</span>);
const StIn = ({ v, set, label, cls }) => <NumInput className={`st-in ${cls || ""}`} value={v} onChange={set} aria-label={label} />;
const StChk = ({ on, set, label, text }) => (
  <label className={`st-cb ${on ? "on" : ""} ${text ? "txt" : ""}`}>
    <input type="checkbox" checked={!!on} onChange={(ev) => set(ev.target.checked)} aria-label={label} />
    <span className="st-cb-box"><Check size={13} strokeWidth={3} /></span>
    {text && <span className="st-cb-t">{text}</span>}
  </label>
);
const StSeg = ({ items }) => (
  <span className="st-seg">{items.map(([t, on, click]) => (
    click
      ? <button key={t} type="button" className={on ? "on" : ""} onClick={click}>{t}</button>
      : <i key={t} className={on ? "on" : ""}>{t}</i>
  ))}</span>
);
/* умови мотивації по блоках (як у попередній версії) — номери пунктів для smCond */
const ST_COND = {
  "Основа": ["1.1"], "Дзвінки": ["3.1"], "Атестація": ["2.1"], "KPI": ["3.3", "3.4"], "Сайт і БН": ["3.6", "3.7"],
  "PPI": ["4.1"], "Премії": ["5.1", "5.2"], "Керуючий": ["2.2", "2.3"], "Інше": ["3.2", "5.3"],
};
const StInfoCtx = React.createContext(null);
function StRow({ g, gs, label, inp, cells, cls }) {
  const openInfo = React.useContext(StInfoCtx);
  return (
    <tr className={`${g ? "st-gt " : ""}${cls || ""}`}>
      {g && (
        <td className="st-g" rowSpan={gs}>
          <span className="st-g-in">
            {g}
            {ST_COND[g] && openInfo && (
              <span role="button" tabIndex={0} className="st-info" title="Умови мотивації" aria-label={`Умови: ${g}`}
                onClick={() => openInfo(g)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openInfo(g); } }}><Info size={11} /></span>
            )}
          </span>
        </td>
      )}
      <td className="st-lab">{label}</td>
      <td className="st-inp">{inp}</td>
      {cells.map((x, i) => <td key={i} className="st-num">{x}</td>)}
    </tr>
  );
}
function StTotalRow({ label, hint, cells, cls }) {
  return (
    <tr className={`st-gt ${cls}`}>
      <td colSpan={3} className="st-lab">{label} {hint && <span className="st-hint">{hint}</span>}</td>
      {cells.map((x, i) => <td key={i} className="st-num">{x}</td>)}
    </tr>
  );
}

function SmStoreSalary({ salon, review, ymProp }) {
  // review = "tm" | "manager" — та сама таблиця для ТМ/керівника: перегляд, а в режимі корективів (лише ТМ) — правки
  const isReview = !!review;
  const canEditReview = review === "tm";
  const [editMode, setEditMode] = useState(false);
  const [tmComment, setTmComment] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [employees, setEmployees] = useState(null);
  const [ymState, setYm] = useState(salaryYm());
  const ym = ymProp || ymState;
  const [tab, setTab] = useState("calc");
  const [drafts, setDrafts] = useState(null);
  const [calcs, setCalcs] = useState({});
  const [calcErr, setCalcErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [armed, setArmed] = useState(false);
  const [preview, setPreview] = useState(null);
  const [shotsOpen, setShotsOpen] = useState(false);
  const [ez, setEz] = useState({ total: 0, confirmed: 0, list: [] }); // оборот ЕЗ за місяць з модуля «ЕЗ»
  const [ezOpen, setEzOpen] = useState(false); // перегляд самих продажів ЕЗ за місяць
  const [subAuto, setSubAuto] = useState({}); // empId → днів заміни на іншому магазині за графіком
  const [workAuto, setWorkAuto] = useState({}); // empId → відпрацьованих днів за графіком
  const [infoGroup, setInfoGroup] = useState(null); // блок, для якого відкрито умови мотивації
  const saved = useRef({});      // empId → JSON останнього збереженого документа
  const touched = useRef(false); // були зміни від користувача
  const draftsRef = useRef(null);
  const months = useMemo(() => recentMonths(12), []);
  const qMonths = quarterMonths(ymToQuarter(ym));
  const isQuarterEnd = ym === qMonths[2];

  useEffect(() => { listEmployees().then(setEmployees).catch(() => setEmployees([])); }, []);
  const emps = useMemo(() => (employees || [])
    .filter((e) => e.salon_key === salon.key && e.status === "active")
    .sort((a, b) => EMP_ROLE_ORDER.indexOf(a.role) - EMP_ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)),
  [employees, salon.key]);

  // завантаження документів усіх співробітників за місяць
  useEffect(() => {
    if (!employees) return undefined;
    let alive = true;
    setDrafts(null); setCalcs({}); touched.current = false;
    Promise.all([Promise.all(emps.map((e) => loadSmData(salon.key, e.id, ym))), listShifts(ym).catch(() => [])]).then(([docs, monthShifts]) => {
      if (!alive) return;
      const next = {};
      const auto = {};
      const workDays = {};
      emps.forEach((e) => { const t = monthTally(monthShifts, e.id, e.salon_key); auto[e.id] = t.substDays; workDays[e.id] = t.factDays; });
      setSubAuto(auto);
      setWorkAuto(workDays);
      const nD = daysInMonth(ym);
      emps.forEach((e, i) => {
        const d = _.cloneDeep(docs[i]);
        saved.current[e.id] = JSON.stringify(docs[i]);
        if (!isReview) { // для ТМ/керівника показуємо документи як подані — без автопідстановок
          if (d.status === "draft") d.manager.coef = ST_ROLE_COEF[e.role] || "1.0"; // коеф. керуючого за замовчуванням = роль
          // дні заміни: автоматично з графіка, але СМ може виправити (тоді значення вважається ручним)
          if (d.bonus.replacementManual === undefined && (d.bonus.replacementDays || 0) > 0 && d.bonus.replacementDays !== auto[e.id]) d.bonus.replacementManual = true;
          if (!d.bonus.replacementManual && (d.status === "draft" || d.status === "corrected")) d.bonus.replacementDays = auto[e.id];
          d.manager.attestPay = e.role === "manager" || e.role === "acting_manager" ? 1000 : 500; // атестація: 1 000 керуючому, 500 іншим
          // робочі дні: автоматично з графіка (вихідних = днів у місяці − робочих), СМ може виправити
          const wa = workDays[e.id] || 0;
          if (d.base.daysManual === undefined && (d.base.daysOff || 0) > 0 && nD - d.base.daysOff !== wa) d.base.daysManual = true;
          if (!d.base.daysManual && wa > 0 && (d.status === "draft" || d.status === "corrected")) d.base.daysOff = Math.max(0, nD - wa);
        }
        next[e.id] = d;
      });
      if (!isReview) {
        // спільні цифри магазину: беремо перше заповнене значення, щоб усі документи збігалися
        ST_SHARED.forEach((path) => {
          const src = docs.map((d) => _.get(d, path)).find((v) => v) ?? _.get(docs[0], path);
          if (src !== undefined) emps.forEach((e) => { _.set(next[e.id], path, src); });
        });
        ST_SHOTS.forEach(([key]) => {
          const src = docs.map((d) => shotList(d.screenshots?.[key])).find((l) => l.length);
          if (src) emps.forEach((e) => { _.set(next[e.id], ["screenshots", key], src); });
        });
      }
      setDrafts(next);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, emps, salon.key, ym, loadKey]);

  useEffect(() => { draftsRef.current = drafts; }, [drafts]);

  // оборот ЕЗ, який СМ вносить у модулі «ЕЗ» (усі внесені продажі; окремо — підтверджені ТМ)
  useEffect(() => {
    let alive = true;
    const load = () => listEzSales({ salonKey: salon.key, ym }).then((l) => {
      if (!alive) return;
      const sum = (arr) => arr.reduce((a, x) => a + (Number(x.amount) || 0), 0);
      setEz({ total: sum(l), confirmed: sum(l.filter((x) => x.status === "confirmed")), list: l });
    }).catch(() => {});
    load();
    const off = subscribeEzSales(load);
    return () => { alive = false; off(); };
  }, [salon.key, ym]);

  // розрахунок на сервері (debounce на введення)
  useEffect(() => {
    if (!drafts || !emps.length) return undefined;
    let alive = true;
    const first = !Object.keys(calcs).length;
    const t = setTimeout(() => {
      calcSmBatch(emps.map((e) => ({ data: drafts[e.id], salonKey: salon.key, ym })))
        .then((cs) => { if (alive) { setCalcs(Object.fromEntries(emps.map((e, i) => [e.id, cs[i]]))); setCalcErr(""); } })
        .catch((err) => { if (alive) setCalcErr(String(err.message || err)); });
    }, first ? 0 : 350);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  const saveAll = async (src = draftsRef.current) => {
    if (!src) return;
    const changed = emps.filter((e) => src[e.id] && JSON.stringify(src[e.id]) !== saved.current[e.id]);
    if (!changed.length) return;
    await Promise.all(changed.map(async (e) => {
      await saveSmData(salon.key, e.id, ym, src[e.id]);
      saved.current[e.id] = JSON.stringify(src[e.id]);
    }));
    setSavedAt(new Date());
  };
  const saveRef = useRef(saveAll);
  saveRef.current = saveAll;

  // автозбереження через 2,5 с після останньої зміни; і при виході з вкладки
  useEffect(() => {
    if (isReview || !touched.current || !drafts) return undefined; // ТМ зберігає лише кнопкою «Зберегти корективи»
    const t = setTimeout(() => { saveRef.current(); }, 2500);
    return () => clearTimeout(t);
  }, [drafts]);
  useEffect(() => () => { if (touched.current && !isReview) saveRef.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeMonth = async (v) => {
    if (touched.current) await saveAll();
    setYm(v);
  };

  const touch = () => { touched.current = true; };
  const setShared = (path) => (v) => { touch(); setDrafts((d) => _.mapValues(d, (x) => _.set(_.cloneDeep(x), path, v))); };
  const setEmp = (id, path) => (v) => { touch(); setDrafts((d) => ({ ...d, [id]: _.set(_.cloneDeep(d[id]), path, v) })); };
  const setFact = (v) => {
    touch();
    setDrafts((d) => _.mapValues(d, (x) => {
      const y = _.cloneDeep(x);
      const old = y.base.monthFact || 0;
      if (!y.record.monthlyTo || y.record.monthlyTo === old) y.record.monthlyTo = v; // оборот для рекорду = факт, поки не змінено вручну
      y.base.monthFact = v;
      return y;
    }));
  };
  // дні заміни: змінене вручну відрізняється від графіка → ручне; збіглося з графіком → знову авто
  const setReplacement = (e, v) => {
    touch();
    setDrafts((d) => {
      const y = _.cloneDeep(d[e.id]);
      y.bonus.replacementDays = v;
      y.bonus.replacementManual = v !== (subAuto[e.id] || 0);
      return { ...d, [e.id]: y };
    });
  };
  // робочі дні: у формі вводять робочі, у розрахунок іде «вихідних» = днів у місяці − робочих
  const setWorkDays = (e, v) => {
    const nD = daysInMonth(ym);
    const work = Math.max(0, Math.min(nD, Number(v) || 0));
    touch();
    setDrafts((d) => {
      const y = _.cloneDeep(d[e.id]);
      y.base.daysOff = nD - work;
      y.base.daysManual = !(workAuto[e.id] > 0 && work === workAuto[e.id]);
      return { ...d, [e.id]: y };
    });
  };
  // KPI: сума + галочка. Старі документи (за порогами) при першій правці переходять на ручний режим із поточних значень
  const kpi = (e, kind) => {
    const b = drafts[e.id].bonus;
    if (b[`${kind}Ok`] !== undefined) return { sum: b[`${kind}Sum`] || 0, ok: !!b[`${kind}Ok`] };
    const cur = calcs[e.id]?.bonus?.[kind] || 0;
    return { sum: cur, ok: cur > 0 };
  };
  const setKpi = (e, kind, patch) => {
    const cur = kpi(e, kind);
    const v = { ...cur, ...patch };
    touch();
    setDrafts((d) => {
      const y = _.cloneDeep(d[e.id]);
      y.bonus[`${kind}Sum`] = v.sum;
      y.bonus[`${kind}Ok`] = v.ok;
      return { ...d, [e.id]: y };
    });
  };
  const shotsFor = (key) => {
    const d = emps.map((e) => drafts[e.id]).find((x) => shotList(x?.screenshots?.[key]).length);
    return d ? shotList(d.screenshots[key]) : [];
  };
  const addShot = (key, url) => setShared(["screenshots", key])([...shotsFor(key), url].slice(0, 5));
  const removeShot = (key, i) => setShared(["screenshots", key])(shotsFor(key).filter((_x, j) => j !== i));

  const submit = async () => {
    setArmed(false);
    const fact = drafts[emps[0].id].base.monthFact;
    if (!(fact > 0)) { pushToast({ title: "Вкажіть факт ТО за місяць" }); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const next = { ...drafts };
      for (const e of emps) {
        const d = drafts[e.id];
        const changed = JSON.stringify(d) !== saved.current[e.id];
        if (d.status === "submitted" && !changed) continue; // вже подано й не змінювалось
        const snap = _.cloneDeep({ base: d.base, manager: d.manager, bonus: d.bonus, ppi: d.ppi, record: d.record, quarterly: d.quarterly });
        next[e.id] = {
          ...d, status: "submitted", submittedAt: now, smSnapshot: snap,
          tmComment: "", correctionDiff: [], correctedAt: null, smReplyComment: "", smRepliedAt: null,
          tmApproved: false, tmApprovedAt: null,
        };
      }
      await saveAll(next);
      touched.current = false;
      setDrafts(next);
      pushToast({ title: "Подано на погодження", body: `${salonLabel(salon)} → ТМ` });
    } catch (err) {
      pushToast({ title: "Не вдалося подати", body: String(err.message || err) });
    }
    setSaving(false);
  };
  // ---- ТМ: корективи та передача керівнику ----
  const saveCorrections = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const next = { ...drafts };
      let n = 0;
      for (const e of emps) {
        const cur = drafts[e.id];
        if (JSON.stringify(cur) === saved.current[e.id]) continue;
        n += 1;
        next[e.id] = { ...cur, status: "corrected", correctedAt: now, tmComment, correctionDiff: smBuildDiff(cur.smSnapshot, cur) };
      }
      if (!n) { pushToast({ title: "Змін немає", body: "Виправте потрібні цифри в таблиці" }); setSaving(false); return; }
      await saveAll(next);
      touched.current = false;
      setDrafts(next); setEditMode(false); setTmComment("");
      notify({ recipient: salon.key, kind: "salary", title: "ТМ вніс корективи у ЗП", body: `${salonLabel(salon)} · ${monthLabel(ym)}`, actor: "tm", link: "salary" });
      pushToast({ title: "Корективи збережено", body: "Салон отримає сповіщення" });
    } catch (err) { pushToast({ title: "Не вдалося зберегти", body: String(err.message || err) }); }
    setSaving(false);
  };
  // статус виплати (ТМ): пишемо лише його, не чіпаючи можливі незбережені правки
  const setPayment = async (e, status) => {
    try {
      const at = new Date().toISOString();
      const base = JSON.parse(saved.current[e.id] || "{}");
      const nextSaved = { ...base, paymentStatus: status, paymentStatusAt: at };
      await saveSmData(salon.key, e.id, ym, nextSaved);
      saved.current[e.id] = JSON.stringify(nextSaved);
      setDrafts((dd) => ({ ...dd, [e.id]: { ...dd[e.id], paymentStatus: status, paymentStatusAt: at } }));
      const body = `${e.full_name} · ${monthLabel(ym)}`;
      if (status === "to_pay") { notify({ recipient: salon.key, kind: "salary", title: "ЗП призначено до виплати", body, actor: "manager", link: "salary" }); pushToast({ title: "Призначено до виплати", body }); }
      if (status === "paid") { notify({ recipient: salon.key, kind: "salary", title: "ЗП виплачено", body, actor: "manager", link: "salary" }); pushToast({ title: "Позначено як виплачено", body }); }
    } catch (err) { pushToast({ title: "Не вдалося", body: String(err.message || err) }); }
  };
  const cancelEdit = () => { touched.current = false; setEditMode(false); setTmComment(""); setLoadKey((k) => k + 1); };
  const approveAll = async () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 5000); return; }
    setArmed(false); setSaving(true);
    try {
      const now = new Date().toISOString();
      const next = { ...drafts };
      emps.forEach((e) => { const cur = drafts[e.id]; if (cur.status !== "draft" && !cur.tmApproved) next[e.id] = { ...cur, tmApproved: true, tmApprovedAt: now }; });
      await saveAll(next);
      setDrafts(next);
      pushToast({ title: "Передано керівнику", body: `${salonLabel(salon)} · ${monthLabel(ym)}` });
    } catch (err) { pushToast({ title: "Не вдалося передати", body: String(err.message || err) }); }
    setSaving(false);
  };
  const askSubmit = () => {
    if (armed) { submit(); return; }
    setArmed(true);
    setTimeout(() => setArmed(false), 5000);
  };
  const onReply = async (e, comment) => {
    const next = { ...drafts[e.id], smReplyComment: comment, smRepliedAt: new Date().toISOString() };
    await saveSmData(salon.key, e.id, ym, next);
    saved.current[e.id] = JSON.stringify(next);
    setDrafts((d) => ({ ...d, [e.id]: next }));
    pushToast({ title: "Відповідь надіслано ТМ", body: e.full_name });
  };

  if (employees === null || (emps.length > 0 && (!drafts || emps.some((e) => !calcs[e.id])))) {
    return (
      <div className="embedded">
        {calcErr ? <div className="banner banner-late"><AlertTriangle size={16} /> Не вдалося порахувати: {calcErr}</div> : <div className="loading">Завантаження…</div>}
      </div>
    );
  }
  if (!emps.length) {
    return <div className="embedded"><div className="admin-empty">У цьому магазині ще немає співробітників. Додайте їх у модулі «Команда».</div></div>;
  }

  const c = (e) => calcs[e.id];
  const d = (e) => drafts[e.id];
  const c0 = c(emps[0]);
  const d0 = d(emps[0]);
  const team = c0.bonus.team;
  const mgrEmp = emps.find((e) => e.role === "manager") || emps.find((e) => e.role === "acting_manager") || null;
  const dl = deadlineInfo(ym);
  const anyPending = emps.some((e) => d(e).status === "draft" || d(e).status === "corrected");
  const showBanner = !dl.future && anyPending;
  const corrEmps = emps.filter((e) => d(e).tmComment || (d(e).correctionDiff && d(e).correctionDiff.length > 0));
  const corrDot = corrEmps.some((e) => !d(e).smRepliedAt);
  const showTmAdj = emps.some((e) => (c(e).adj || 0) !== 0) || (isReview && canEditReview && editMode);
  const totalNet = _.sumBy(emps, (e) => c(e).total);
  const totalGross = _.sumBy(emps, (e) => c(e).grossTotal);
  const shotCount = ST_SHOTS.reduce((s, [k]) => s + shotsFor(k).length, 0);
  const catOpts = smCategoryOptions();
  const onCat = (key) => setShared(["base", "categoryOverride"])(key === c0.autoCategory || key === d0.base.categoryOverride ? "" : key);
  const each = (fn) => emps.map(fn);
  const pctNoEz = c0.monthPlan > 0 ? ((c0.factAdjusted - ez.total) / c0.monthPlan) * 100 : 0;

  return (
    <div className="embedded st-page" style={{ "--st-n": emps.length }}>
      <div className="st-head">
        <h1 className="st-h1">{isReview ? "ЗП" : "Розрахунок ЗП"} · {salonLabel(salon)}</h1>
        {ymProp
          ? <span className="st-monthchip">{monthLabel(ym)}</span>
          : (
            <div className="month-picker" style={{ margin: 0 }}>
              <select value={ym} onChange={(ev) => changeMonth(ev.target.value)}>
                {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
              </select>
            </div>
          )}
        {emps.every((e) => d(e).status === "submitted" || d(e).status === "corrected") ? null : <span className="st-status warn">Чернетка</span>}
        {emps.every((e) => d(e).status === "submitted") && <span className="st-status ok"><Check size={13} /> На розгляді в ТМ</span>}
        {emps.some((e) => d(e).status === "corrected") && <span className="st-status warn">ТМ вніс корективи</span>}
        {emps.some((e) => d(e).tmApproved) && <span className="st-status info">Передано керівнику</span>}
        <span className="st-spacer" />
        {!isReview && (
          <>
            <button className="btn-secondary" disabled={saving} onClick={async () => { setSaving(true); await saveAll(); setSaving(false); pushToast({ title: "Чернетку збережено", body: monthLabel(ym) }); }}>Зберегти чернетку</button>
            <button className={armed ? "btn-primary st-armed" : "btn-primary"} onClick={askSubmit} disabled={saving}>
              {saving ? "Надсилання…" : armed ? "Точно подати? Натисніть ще раз" : "Подати на погодження ТМ"}
            </button>
          </>
        )}
      </div>
      {!isReview && showBanner && (
        <div className={`banner ${dl.overdue ? "banner-late" : "banner-warn"}`}>
          <AlertTriangle size={16} />
          {dl.overdue ? `Термін подачі ЗП за ${monthLabel(ym)} минув (був до ${dl.dueLabel}).` : `Подайте ЗП за ${monthLabel(ym)} до ${dl.dueLabel}.`}
        </div>
      )}
      {isReview && emps.some((e) => d(e).smReplyComment) && (
        <div className="reply-banner">
          {emps.filter((e) => d(e).smReplyComment).map((e) => <div key={e.id}><b>Відповідь салону ({e.full_name}):</b> {d(e).smReplyComment}</div>)}
        </div>
      )}
      {!isReview && (
        <div className="inner-tabs">
          <button className={tab === "calc" ? "active" : ""} onClick={() => setTab("calc")}>Розрахунок</button>
          <button className={tab === "corrections" ? "active" : ""} onClick={() => setTab("corrections")}>Корективи від ТМ{corrDot ? " •" : ""}</button>
        </div>
      )}

      {!isReview && tab === "corrections" ? (
        corrEmps.length === 0
          ? <div className="admin-empty">Корективів від ТМ поки немає.</div>
          : corrEmps.map((e) => (
            <div key={e.id} className="st-corr">
              <h4>{e.full_name}</h4>
              <SmCorrectionsTab data={d(e)} onReply={(comment) => onReply(e, comment)} />
            </div>
          ))
      ) : (
        <>
          <fieldset className="st-fs" disabled={isReview && !editMode}>
          <div className="st-strip">
            <div className="st-cell">
              <div className="st-cap">План · факт · виконання</div>
              <div className="st-plan">
                <span><em>План</em> <b>{stNum(c0.monthPlan)}</b></span>
                <label><em>Факт з ЕЗ</em> <StIn v={d0.base.monthFact} set={setFact} label="Факт з ЕЗ за місяць" cls="st-in-w" /></label>
                <span className={`st-pct ${c0.planPercent >= 100 ? "ok" : ""}`}>{c0.planPercent.toFixed(0)}%</span>
              </div>
              <div className="st-adjs">
                <button type="button" className="st-ez-btn" title="Перейти до продажів ЕЗ за місяць" onClick={() => setEzOpen(true)}>
                  <em>ЕЗ</em> <b className="st-ezv">{stNum(ez.total)}</b>{ez.total !== ez.confirmed && <span className="st-hint"> · підтверджено ТМ {stNum(ez.confirmed)}</span>}{ez.total === 0 && <span className="st-hint"> · перевірте місяць у вкладці «ЕЗ»</span>}
                  <ChevronRight size={13} />
                </button>
                <label><em>Чеки Віктора</em> <StIn v={d0.base.viktorChecks} set={setShared(["base", "viktorChecks"])} label="Чеки Віктора" cls="st-in-s" /></label>
                <label><em>Низькорентабельні</em> <StIn v={d0.base.lowMarginChecks} set={setShared(["base", "lowMarginChecks"])} label="Низькорентабельні чеки" cls="st-in-s" /></label>
                <span className="st-hint">скориг. факт {stNum(c0.factAdjusted)}</span>
              </div>
              <StSeg items={[0, 1, 2, 3, 4].map((i) => [planBracketLabel(i), c0.bracket === i])} />
            </div>
            <div className="st-cell">
              <div className="st-cap">Виконання без ЕЗ</div>
              <div className="st-rate st-ez-sum">{stNum(c0.factAdjusted - ez.total)} ₴</div>
              <div className="st-hint">
                <span className={`st-pct-sm ${pctNoEz >= 100 ? "ok" : ""}`}>{pctNoEz.toFixed(0)}%</span> від плану {stNum(c0.monthPlan)}
              </div>
            </div>
            <div className="st-cell">
              <div className="st-cap">Категорія · {d0.base.categoryOverride ? "вручну" : "авто"}</div>
              <StSeg items={catOpts.map((o) => [o.key, c0.category === o.key, () => onCat(o.key)])} />
              <div className="st-hint">
                {!c0.hasHistory ? "історії обороту ще нема — за самовведеним" : c0.avg3Months < 3 ? `середнє за ${c0.avg3Months} міс.` : "за оборотом без ЕЗ за 3 міс."}
              </div>
              {!c0.hasPlan && <div className="st-hint st-warn">План на місяць ще не внесено ТМ</div>}
            </div>
            <div className="st-cell">
              <div className="st-cap">Ставка ЗП</div>
              <div className="st-rate">{stNum(c0.baseRaw)} ₴</div>
            </div>
            <div className="st-cell st-total">
              <div className="st-cap">До виплати по магазину</div>
              <div className="st-rate">{stNum(totalNet)} ₴</div>
              <div className="st-hint">нараховано {stNum(totalGross)} · мінус {stNum(totalGross - totalNet)}</div>
            </div>
          </div>
          {calcErr && <div className="banner banner-late"><AlertTriangle size={16} /> Не вдалося перерахувати: {calcErr}. Показано попередні цифри.</div>}

          <StInfoCtx.Provider value={setInfoGroup}>
          <div className="st-wrap">
            <table className="st">
              <colgroup><col style={{ width: 122 }} /><col style={{ width: 200 }} /><col />{emps.map((e) => <col key={e.id} style={{ width: 210 }} />)}</colgroup>
              <thead>
                <tr>
                  <th />
                  <th className="st-hl">Стаття</th>
                  <th className="st-hl">Вхідні дані магазину</th>
                  {emps.map((e) => (
                    <th key={e.id} className="st-he">
                      <div className="st-en">{e.full_name}</div>
                      <div className="st-er">{EMP_ROLES[e.role]} · {smStatusBadge(d(e).status)}</div>
                      <div className="st-er">
                        {(() => {
                          const nD = daysInMonth(ym);
                          const work = Math.max(0, nD - (d(e).base.daysOff || 0));
                          const wa = workAuto[e.id] || 0;
                          return (
                            <>
                              {wa > 0 && work !== wa && (
                                <button type="button" className="st-reset" title={`Повернути за графіком: ${wa}`} aria-label={`Повернути за графіком: ${wa}`} onClick={() => setWorkDays(e, wa)}><RefreshCw size={12} /></button>
                              )}
                              робочих днів <StIn v={work} set={(v) => setWorkDays(e, v)} label={`Робочих днів — ${e.full_name}`} cls="st-in-xs" />
                            </>
                          );
                        })()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <StRow g="Основа" gs={1} label="Ставка ЗП" inp={<span className="st-pill">{c0.category} · {planBracketLabel(c0.bracket)}</span>} cells={each((e) => stMoney(c(e).baseAdjusted))} />
                <StRow g="Дзвінки" gs={1} label="Обіг з дзвінків"
                  inp={<span className="st-two"><StIn v={d0.bonus.callsRevenue} set={setShared(["bonus", "callsRevenue"])} label="Обіг з дзвінків" /><StSeg items={[["5%", c0.bonus.callsPct === 5], ["3%", c0.bonus.callsPct === 3]]} /></span>}
                  cells={each((e) => stMoney(c(e).bonus.calls))} />
                <StRow g="Атестація" gs={1} label="Атестація ≥ 98%" inp={<span className="st-hint">галочка по кожному →</span>}
                  cells={each((e) => <span className="st-ck"><StChk on={d(e).manager.attestationAll} set={setEmp(e.id, ["manager", "attestationAll"])} label={`Атестація — ${e.full_name}`} /> {stMoney(c(e).mgr.attest)}</span>)} />
                {[["avgCheck", "Середній чек"], ["checkLen", "Довжина чека"]].map(([kind, title], i) => (
                  <StRow key={kind} g={i === 0 ? "KPI" : null} gs={2} label={title} inp={<span className="st-hint">сума й галочка →</span>}
                    cells={each((e) => {
                      const k = kpi(e, kind);
                      return <span className="st-ck"><StChk on={k.ok} set={(v) => setKpi(e, kind, { ok: v })} label={`${title} — ${e.full_name}, зарахувати`} /><StIn v={k.sum} set={(v) => setKpi(e, kind, { sum: v })} label={`${title} — ${e.full_name}, сума`} cls={`st-in-m ${k.ok ? "" : "off"}`} /></span>;
                    })} />
                ))}
                <StRow g="Сайт і БН" gs={2} label="Продажі із сайту (НП)" inp={<StIn v={d0.bonus.siteNpRevenue} set={setShared(["bonus", "siteNpRevenue"])} label="Продажі із сайту через НП" />} cells={each((e) => stMoney(c(e).bonus.siteNp))} />
                <StRow label="Продажі по БН" inp={<StIn v={d0.bonus.bnRevenue} set={setShared(["bonus", "bnRevenue"])} label="Продажі по БН" />} cells={each((e) => stMoney(c(e).bonus.bn))} />
                <StRow g="PPI" gs={1} label="Оборот PPI"
                  inp={<span className="st-two"><StIn v={d0.ppi.ppiRevenue} set={setShared(["ppi", "ppiRevenue"])} label="Оборот PPI" /><StSeg items={[["3%", !!d0.ppi.planClosed, () => setShared(["ppi", "planClosed"])(true)], ["1%", !d0.ppi.planClosed, () => setShared(["ppi", "planClosed"])(false)]]} /></span>}
                  cells={each((e) => stMoney(c(e).ppi.bonus))} />
                <StRow g="Премії" gs={2} cls={isQuarterEnd ? "" : "st-dim"} label="Квартальна премія"
                  inp={isQuarterEnd ? <span className="st-hint">сума 3 ЗП і «3/3 плани» →</span> : null}
                  cells={each((e) => (isQuarterEnd
                    ? <span className="st-ck"><StChk on={d(e).quarterly.threeOfThree} set={setEmp(e.id, ["quarterly", "threeOfThree"])} label={`3/3 плани — ${e.full_name}`} /><StIn v={d(e).quarterly.last3SalarySum} set={setEmp(e.id, ["quarterly", "last3SalarySum"])} label={`Сума 3 останніх ЗП — ${e.full_name}`} cls="st-in-m" /></span>
                    : stMoney(0)))} />
                <StRow label="Рекордний показник"
                  inp={<span className="st-two"><StIn v={d0.record.monthlyTo} set={setShared(["record", "monthlyTo"])} label="Оборот ТО за місяць (команда)" /><StIn v={d0.record.prevRecord} set={setShared(["record", "prevRecord"])} label="Попередній рекорд ТО" /></span>}
                  cells={each((e) => stMoney(c(e).record.bonus))} />
                <StRow g="Керуючий" gs={2} label="Стандарти"
                  inp={mgrEmp ? (
                    <span className="st-two">
                      <StChk on={d(mgrEmp).manager.noRemarks} set={setEmp(mgrEmp.id, ["manager", "noRemarks"])} label="Без зауважень" text="без зауважень" />
                      {!d(mgrEmp).manager.noRemarks && <>
                        <StIn v={d(mgrEmp).manager.remarksFound} set={setEmp(mgrEmp.id, ["manager", "remarksFound"])} label="Виявлені зауваження (−200)" cls="st-in-xs" />
                        <StIn v={d(mgrEmp).manager.remarksUnfixed} set={setEmp(mgrEmp.id, ["manager", "remarksUnfixed"])} label="Невиправлені зауваження (−400)" cls="st-in-xs" />
                      </>}
                    </span>
                  ) : <span className="st-hint">керуючого немає в команді</span>}
                  cells={each((e) => stMoney(c(e).mgr.standards))} />
                <StRow label="Коефіцієнт керуючого"
                  inp={mgrEmp ? (
                    <select className="st-sel" aria-label="Статус керуючого" value={String(d(mgrEmp).manager.coef)} onChange={(ev) => setEmp(mgrEmp.id, ["manager", "coef"])(ev.target.value)}>
                      {managerCoefOptions().map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  ) : <span className="st-hint">—</span>}
                  cells={each((e) => stMoney(c(e).mgr.coefBonus))} />
                <StRow g="Інше" gs={showTmAdj ? 4 : 3} label="Заміна на іншому магазині" inp={<span className="st-hint">днів із графіка змін · можна виправити</span>}
                  cells={each((e) => {
                    const auto = subAuto[e.id] || 0;
                    const days = d(e).bonus.replacementDays || 0;
                    return (
                      <span className="st-ck st-ck-flex">
                        {days !== auto && (
                          <button type="button" className="st-reset" title={`Повернути за графіком: ${auto}`} aria-label={`Повернути за графіком: ${auto}`} onClick={() => setReplacement(e, auto)}><RefreshCw size={12} /></button>
                        )}
                        <StIn v={days} set={(v) => setReplacement(e, v)} label={`Днів заміни — ${e.full_name}`} cls="st-in-xs" /> {stMoney(c(e).bonus.replacement)}
                      </span>
                    );
                  })} />
                <StRow label="ЕЗ" inp={<button type="button" className="wh-link" onClick={() => setEzOpen(true)}>{ez.list.length} прод. за місяць · переглянути →</button>} cells={each((e) => stMoney(c(e).bonus.ezTeam))} />
                <StRow label="Бонус (додатково)" inp={<span className="st-hint">вноситься по кожному →</span>}
                  cells={each((e) => <StIn v={d(e).bonusExtra?.amount || 0} set={setEmp(e.id, ["bonusExtra", "amount"])} label={`Бонус — ${e.full_name}`} cls="st-in-w" />)} />
                {showTmAdj && <StRow label="Додатково від ТМ" inp={<span className="st-hint">вносить ТМ</span>}
                  cells={each((e) => (isReview && editMode ? <StIn v={d(e).adj.amount} set={setEmp(e.id, ["adj", "amount"])} label={`Додатково від ТМ — ${e.full_name}`} cls="st-in-w" /> : stMoney(c(e).adj)))} />}
                <StTotalRow cls="st-sub" label="Всього нараховано" hint="включно з ЕЗ" cells={each((e) => stNum(c(e).grossTotal))} />
                {[["official", "Офіційно на картку"], ["advance", "Аванс готівка"], ["birthdays", "Дні народження"], ["inventory", "Інвентаризація"], ["ownUse", "Товар для власних потреб"]].map(([k, title], i) => (
                  <StRow key={k} g={i === 0 ? "Мінус" : null} gs={5} label={title} inp={<span className="st-hint">вноситься по кожному →</span>}
                    cells={each((e) => <StIn v={d(e).adj[k]} set={setEmp(e.id, ["adj", k])} label={`${title} — ${e.full_name}`} cls="st-in-w" />)} />
                ))}
                <StTotalRow cls="st-pay st-gross" label="Загальна ЗП" hint="= всього нараховано" cells={each((e) => <div className="st-payv">{stNum(c(e).grossTotal)}</div>)} />
                {/* у режимі перегляду ТМ сума й статус живуть у блоці «Виплата» внизу — тут рядок зайвий */}
                {!(isReview && canEditReview) && (
                  <StTotalRow cls="st-pay" label="До виплати"
                    cells={each((e) => (
                      <>
                        <div className="st-payv">{stNum(c(e).total)}</div>
                        {d(e).paymentStatus === "paid" && <div className="st-hint">виплачено</div>}
                        {d(e).paymentStatus === "to_pay" && <div className="st-hint">призначено до виплати</div>}
                      </>
                    ))} />
                )}
              </tbody>
            </table>
          </div>
          </StInfoCtx.Provider>

          <div className="st-shots">
            <button className="btn-secondary small" onClick={() => setShotsOpen((v) => !v)}><Camera size={13} /> Скріни-підтвердження{shotCount ? ` · ${shotCount}` : ""}</button>
            {shotsOpen && (
              <div className="st-shots-grid">
                {ST_SHOTS.filter(([k]) => k !== "quarter" || isQuarterEnd).map(([k, title]) => (
                  <div key={k} className="st-shot">
                    <div className="st-shot-t">{title}</div>
                    <ScreenshotStack shots={shotsFor(k)} onAdd={(url) => addShot(k, url)} onRemove={(i) => removeShot(k, i)} onPreview={setPreview} readOnly={false} />
                  </div>
                ))}
              </div>
            )}
          </div>

          </fieldset>

          {!isReview ? (
            <div className="save-bar">
              <span className="save-hint">
                {saving ? "Зберігаю…" : savedAt ? `Збережено о ${savedAt.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}` : "Зміни зберігаються автоматично"}
              </span>
            </div>
          ) : canEditReview ? (
            editMode ? (
              <div className="st-review-bar">
                <label className="over-field" style={{ maxWidth: "100%", flex: 1 }}>
                  <span>Коментар до корективи (побачить салон)</span>
                  <textarea rows={2} value={tmComment} onChange={(ev) => setTmComment(ev.target.value)} />
                </label>
                <div className="correction-actions">
                  <button className="btn-secondary" onClick={cancelEdit} disabled={saving}>Скасувати</button>
                  <button className="btn-primary" onClick={saveCorrections} disabled={saving}>{saving ? "Збереження…" : "Зберегти корективи"}</button>
                </div>
              </div>
            ) : (
              <div className="st-review-bar">
                <button className="btn-secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Внести корективи</button>
                {emps.some((e) => d(e).status !== "draft" && !d(e).tmApproved) && (
                  <button className={armed ? "btn-primary st-armed" : "btn-secondary"} onClick={approveAll} disabled={saving}>
                    <Check size={14} /> {armed ? "Точно передати? Натисніть ще раз" : "Передати керівнику"}
                  </button>
                )}
              </div>
            )
          ) : null}

          {isReview && canEditReview && (
            <div className="st-pay-strip">
              <div className="st-cap">Виплата</div>
              {emps.map((e) => {
                const ps = d(e).paymentStatus;
                return (
                  <div className="st-pay-row" key={e.id}>
                    <span className="st-pay-nm">{e.full_name}</span>
                    <span className={`badge ${ps === "paid" ? "badge-ok" : ps === "to_pay" ? "badge-warn" : "badge-off"}`}>{ps === "paid" ? "Виплачено" : ps === "to_pay" ? "До виплати" : "Не підтверджено"}</span>
                    <span className="st-spacer" />
                    <span className="st-pay-sum">{stNum(c(e).total)}</span>
                    {ps !== "to_pay" && ps !== "paid" && <button className="btn-secondary small" onClick={() => setPayment(e, "to_pay")}>Позначити «До виплати»</button>}
                    {ps === "to_pay" && <button className="btn-secondary small" onClick={() => setPayment(e, "paid")}>Позначити «Виплачено»</button>}
                    {ps === "paid" && <button className="btn-secondary small" onClick={() => setPayment(e, "to_pay")}>Повернути «До виплати»</button>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {preview && <ImageModal src={preview} onClose={() => setPreview(null)} />}
      {ezOpen && <EzSalonSalesModal salon={salon} ym={ym} sales={ez.list} onClose={() => setEzOpen(false)} />}
      {infoGroup && (() => {
        const conds = (ST_COND[infoGroup] || []).map((n) => smCond(n)).filter(Boolean);
        const blocks = conds.length === 1 ? conds[0].blocks : conds.flatMap((cd) => [{ h: cd.title }, ...cd.blocks]);
        return <InfoModal title={conds.length === 1 ? conds[0].title : `Умови: ${infoGroup}`} blocks={blocks.length ? blocks : [{ p: "Умови для цього блоку поки не завантажено." }]} onClose={() => setInfoGroup(null)} />;
      })()}
    </div>
  );
}

/* =========================================================
   ТМ · ВКЛАДКА «ЗП САЛОНІВ» (лише свої салони)
========================================================= */
const smStatusText = { draft: "чернетка", submitted: "подано", corrected: "корективи ТМ", approved: "погоджено" };
const smStatusBadge = (st) => (
  <span className={`badge ${st === "submitted" ? "badge-ok" : st === "corrected" ? "badge-off" : "badge-warn"}`}>
    {st === "submitted" ? "подано" : st === "corrected" ? "корективи" : "чернетка"}
  </span>
);

function SalonReviewPanel({ tmKey, reviewer }) {
  const [ym, setYm] = useState(salaryYm());
  const salons = useMemo(() => {
    const mine = salonsOfTm(tmKey, ym);
    if (tmKey !== ADMIN_KEY) return mine;
    // ТМ, чий кабінет приховано (звільнився) — за старі місяці, коли магазин ще
    // рахувався за ним, погоджувати вже нікому: адмін бере ці подання на себе.
    const orphaned = SALONS.filter((s) => {
      const owner = salonTmOn(s.key, ym);
      return owner !== tmKey && HIDDEN_TM_KEYS.includes(owner);
    });
    return orphaned.length ? [...mine, ...orphaned] : mine;
  }, [tmKey, ym]);
  const [employees, setEmployees] = useState(null);
  const [bySalon, setBySalon] = useState(null); // { salonKey: rows[] }
  const [openSalon, setOpenSalon] = useState(null);

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
  }, [salons, ym, employees]);

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
        (() => {
          const cards = salons.map((sl) => {
            const rows = bySalon[sl.key] || [];
            const total = rows.reduce((a, r) => a + r.total, 0);
            const done = rows.filter((r) => r.data.status === "submitted" || r.data.status === "corrected").length;
            const approved = rows.filter((r) => r.data.tmApproved).length;
            const cat = (rows.find((r) => r.calc?.category)?.calc || {}).category;
            const state = rows.length > 0 && done === rows.length ? "ok" : done === 0 ? "none" : "part";
            return { sl, rows, total, done, approved, cat, state };
          });
          const terrTotal = cards.reduce((a, c) => a + c.total, 0);
          const full = cards.filter((c) => c.state === "ok").length;
          return (
            <>
              <div className="sr-summary">
                <div><span className="st-cap">Разом по території</span><b className="sr-sum-v">{stNum(terrTotal)} ₴</b></div>
                <div><span className="st-cap">Магазини подали ЗП</span><b className="sr-sum-v">{full}<small> з {cards.length}</small></b></div>
                <div className="sr-legend"><span className="st-cap">Категорія за сер. ТО за 3 міс.</span>
                  <span><span className="cat-badge cat-Ap">A+</span> <span className="cat-badge cat-A">A</span> <span className="cat-badge cat-B">B</span> <span className="cat-badge cat-C">C</span></span>
                </div>
              </div>
              <div className="sr-grid">
                {cards.map(({ sl, rows, total, done, approved, cat, state }) => (
                  <button className={`sr-card ${state}`} key={sl.key} onClick={() => setOpenSalon(sl.key)}>
                    <span className="sr-top">
                      <span className="sr-nm">
                        <span className="sr-name">{salonShortName(sl)}</span>
                        <span className="sr-addr">{salonLabel(sl)}</span>
                      </span>
                      {cat && <span className={`cat-badge sr-cat cat-${cat.replace("+", "p")}`}>{cat}</span>}
                    </span>
                    <span className="sr-total">{stNum(total)}<small> ₴</small></span>
                    <span className="sr-dots" aria-hidden="true">
                      {rows.map((r) => <i key={r.emp.id} className={`sr-dot ${r.data.tmApproved ? "appr" : r.data.status}`} title={`${r.emp.full_name}: ${smStatusText[r.data.status] || r.data.status}`} />)}
                    </span>
                    <span className="sr-foot">
                      <span className={`sr-state ${state}`}>
                        {rows.length === 0 ? "Немає співробітників" : state === "ok" ? "Усі подали" : state === "none" ? "Ще ніхто не подав" : `Подали ${done} з ${rows.length}`}
                      </span>
                      {approved > 0 && <span className="sr-appr">передано керівнику {approved}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          );
        })()
      ) : (
        <SmStoreSalary key={`${openSalon}:${ym}`} salon={salonByKey(openSalon)} review={reviewer} ymProp={ym} />
      )}
    </div>
  );
}

/* =========================================================
   ТМ · ПЛАН ПОКАЗНИКІВ (оборот + пороги чека) по кожному магазину
========================================================= */
function SmPlanForm({ salon, ym, tmKey, onBack }) {
  const [plan, setPlan] = useState(emptyPlan());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSmPlan(salon.key, ym).then((p) => { if (active) { setPlan(p); setLoading(false); } });
    return () => { active = false; };
  }, [salon.key, ym]);

  const upd = (k) => (v) => setPlan((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await saveSmPlan(salon.key, ym, plan, tmKey);
      pushToast({ title: "План збережено", body: `${salonLabel(salon)} · ${monthLabel(ym)}` });
      onBack();
    } catch (e) {
      pushToast({ title: "Не вдалося зберегти", body: e.message === "plan_locked" ? "Місяць заблоковано адміном" : String(e.message || e) });
    }
    setSaving(false);
  };

  if (loading) return <div className="loading">Завантаження…</div>;
  return (
    <div className="embedded">
      <div className="detail-head">
        <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> До списку магазинів</button>
        <span className="detail-title">{salonLabel(salon)} <span className="detail-sub">· {monthLabel(ym)}</span></span>
      </div>
      {plan.locked && (
        <p className="hint" style={{ color: "var(--negative-bright)" }}>
          Місяць заблоковано адміном — редагування недоступне. Щоб змінити, попросіть Шаха розблокувати в Адміністрування → «Замок планів».
        </p>
      )}
      <div className="criteria-form">
        <div className="item-fields">
          <Field label="План обороту на місяць" suffix="грн" value={plan.turnover_plan} onChange={upd("turnover_plan")} readOnly={plan.locked} />
        </div>
        <div className="hint" style={{ margin: "14px 0 6px" }}>Пороги середнього чека — три градації бонусу (700 / 1 500 / 2 000 грн)</div>
        <div className="item-fields">
          <Field label="Поріг 1 → 700 грн" value={plan.avg_check_t1} onChange={upd("avg_check_t1")} readOnly={plan.locked} />
          <Field label="Поріг 2 → 1 500 грн" value={plan.avg_check_t2} onChange={upd("avg_check_t2")} readOnly={plan.locked} />
          <Field label="Поріг 3 → 2 000 грн" value={plan.avg_check_t3} onChange={upd("avg_check_t3")} readOnly={plan.locked} />
        </div>
        <div className="hint" style={{ margin: "14px 0 6px" }}>Пороги довжини чека — три градації бонусу (700 / 1 500 / 2 000 грн)</div>
        <div className="item-fields">
          <Field label="Поріг 1 → 700 грн" value={plan.check_len_t1} onChange={upd("check_len_t1")} readOnly={plan.locked} />
          <Field label="Поріг 2 → 1 500 грн" value={plan.check_len_t2} onChange={upd("check_len_t2")} readOnly={plan.locked} />
          <Field label="Поріг 3 → 2 000 грн" value={plan.check_len_t3} onChange={upd("check_len_t3")} readOnly={plan.locked} />
        </div>
        {!plan.locked && (
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
            {saving ? "Зберігаю…" : "Зберегти план"}
          </button>
        )}
      </div>
    </div>
  );
}

function SmPlanPanel({ tmKey }) {
  const [ym, setYm] = useState(salaryYm());
  const salons = useMemo(() => salonsOfTm(tmKey, ym), [tmKey, ym]);
  const [plans, setPlans] = useState(null);
  const [openSalon, setOpenSalon] = useState(null);
  const months = useMemo(() => recentMonths(12), []);

  const load = React.useCallback(() => {
    listSmPlans(salons.map((s) => s.key), ym).then(setPlans).catch(() => setPlans({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salons, ym]);
  useEffect(() => { setPlans(null); load(); }, [load]);
  useEffect(() => subscribePlans(load), [load]);

  if (openSalon) {
    return <SmPlanForm salon={salonByKey(openSalon)} ym={ym} tmKey={tmKey} onBack={() => setOpenSalon(null)} />;
  }
  if (plans === null) return <div className="loading">Завантаження…</div>;

  return (
    <div className="embedded">
      <div className="month-row">
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>
        План обороту й пороги чека на місяць — СМ бачить їх у своїй формі ЗП, але змінити не може.
      </p>
      <div className="salon-list">
        {salons.map((s) => {
          const p = plans[s.key];
          return (
            <button className="salon-row" key={s.key} onClick={() => setOpenSalon(s.key)}>
              <span className="salon-row-main">
                <span className="salon-row-name">{salonLabel(s)}</span>
                <span className="salon-row-sub">{p ? `план ${fmt(p.turnover_plan)}` : "план ще не внесено"}{p?.locked ? " · заблоковано" : ""}</span>
              </span>
            </button>
          );
        })}
      </div>
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
  const total = calc.floored + (isLast ? (qb.bonus41 + qb.bonus42) : 0) + (a.amount || 0)
    - (a.advance || 0) - (a.official || 0) - (a.birthdays || 0);
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

/* дата → «7 вер. 2026» коротко */
const fmtDay = (d) => { try { return new Date(d).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };

/* активний запис ФОП для магазину зі списку історії (локально, без кешу) */
function currentFopEntry(list, salonKey, onDate) {
  const d = onDate || todayISO();
  const rows = list
    .filter((r) => r.salonKey === salonKey && r.fromDate <= d)
    .sort((a, b) => (a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : a.id - b.id));
  return rows.length ? rows[rows.length - 1] : null;
}

function AdminFop() {
  const [list, setList] = useState(null);
  const [salonKey, setSalonKey] = useState(SALONS[0].key);
  const [fop, setFop] = useState("");
  const [fromDate, setFromDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const load = () => listFopHistory().then((l) => setList(l.slice().sort((a, b) => (a.fromDate < b.fromDate ? 1 : a.fromDate > b.fromDate ? -1 : b.id - a.id))));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!fop.trim() || !fromDate) return;
    setBusy(true);
    try {
      await addFopAssignment({ salonKey, fop: fop.trim(), fromDate });
      pushToast({ title: "ФОП призначено", body: `${salonByKey(salonKey)?.city} · ${fop.trim()} · з ${fmtDay(fromDate)}` });
      setFop(""); load();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy(false);
  };
  const del = async (id) => {
    if (!confirm("Видалити цей запис з історії ФОП? Відповідність перерахується.")) return;
    try { await removeFopAssignment(id); load(); }
    catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
  };

  return (
    <div className="admin-panel">
      <h3>ФОП по СМ</h3>
      <p className="hint">
        Призначте ФОП магазину й дату, з якої він діє. Дані підтягуються у вкладку «Довідник» і на плитки рахунків.
        Рахунки, виставлені до зміни, ФОП не змінюють — береться значення на дату документа.
      </p>
      <div className="admin-reassign-form">
        <label className="over-field"><span>Магазин</span>
          <select value={salonKey} onChange={(e) => setSalonKey(e.target.value)}>
            {SALONS.map((s) => <option key={s.key} value={s.key}>{salonLabel(s)}</option>)}
          </select>
        </label>
        <label className="over-field"><span>ФОП</span>
          <input value={fop} onChange={(e) => setFop(e.target.value)} placeholder="напр. ФОП Фещук Ю.Б" />
        </label>
        <label className="over-field"><span>Діє з дати</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={busy || !fop.trim()} onClick={add}>Призначити</button>
      </div>

      {list === null ? <div className="loading">Завантаження…</div> : (
        <>
          <h4 className="admin-sub-h">Актуальна відповідність ФОП до СМ</h4>
          <div className="tm-all">
            <table className="tm-all-tbl">
              <thead><tr><th>Магазин</th><th>Поточний ФОП</th><th>Діє з</th></tr></thead>
              <tbody>
                {SALONS.map((s) => {
                  const e = currentFopEntry(list, s.key);
                  return (
                    <tr key={s.key}>
                      <td>{s.city}, {shortAddr(s.addr)}</td>
                      <td>{e ? e.fop : <span className="muted">— не задано —</span>}</td>
                      <td className="num muted">{e ? fmtDay(e.fromDate) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h4 className="admin-sub-h">Історія ФОП</h4>
          {list.length === 0 ? <div className="admin-empty">Записів немає.</div> : (
            <div className="admin-list">
              {list.map((r) => (
                <div className="admin-req" key={r.id}>
                  <div className="admin-req-info">
                    <span className="admin-req-name">{salonByKey(r.salonKey)?.city || r.salonKey} · {r.fop}</span>
                    <span className="admin-req-time">діє з {fmtDay(r.fromDate)} · запис {fmtDate(r.at)}</span>
                  </div>
                  <button className="btn-secondary small" onClick={() => del(r.id)}>Видалити</button>
                </div>
              ))}
            </div>
          )}
        </>
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
    reassign: "перепризначено магазин", caps: "змінено права", fop_assign: "призначено ФОП",
    modaccess: "доступ до вкладки", modextra: "додано вкладку кабінету",
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
                <span className="admin-log-actor">{e.actor ? cabName(e.actor) : "—"}</span>
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
      <SmSalaryLockSwitch />
    </div>
  );
}

function SmSalaryLockSwitch() {
  const [st, setSt] = useState(null); // { on, open:[] }
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let a = true;
    const load = () => getSmSalaryLock().then((v) => { if (a) setSt(v); });
    load();
    const off = subscribeFlags(load);
    return () => { a = false; off(); };
  }, []);
  if (st === null) return null;
  const save = async (next, title, body) => {
    setBusy(true);
    try { await setSmSalaryLock(next, ADMIN_KEY); setSt(next); pushToast({ title, body }); }
    catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy(false);
  };
  const toggleSalon = (s) => {
    const opened = st.open.includes(s.key);
    save({ ...st, open: opened ? st.open.filter((k) => k !== s.key) : [...st.open, s.key] },
      opened ? "Розрахунок ЗП закрито" : "Розрахунок ЗП відкрито", `${s.city}, ${shortAddr(s.addr)}`);
  };
  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
      <h3>Розрахунок ЗП у кабінеті СМ</h3>
      <p className="hint" style={{ marginBottom: 14 }}>
        Поки замок увімкнено, СМ замість розрахунку ЗП бачать «Вибачте, це вікно на доопрацюванні», а нагадування «Подайте ЗП» не показується.
        Нижче можна відкрити розрахунок окремим магазинам. Розрахунок ЗП у кабінеті ТМ і «ЗП салонів» працюють як зазвичай.
      </p>
      <label className={`maint-toggle ${st.on ? "on" : ""}`}>
        <input type="checkbox" checked={st.on} disabled={busy} onChange={(e) => save({ ...st, on: e.target.checked }, e.target.checked ? "Розрахунок ЗП закрито для СМ" : "Розрахунок ЗП відкрито для всіх СМ")} />
        <span className="maint-switch" />
        <span className="maint-label">{st.on ? "Розрахунок ЗП для СМ ЗАКРИТО" : "Розрахунок ЗП для СМ відкрито"}</span>
      </label>
      {st.on && (
        <>
          <p className="hint" style={{ margin: "14px 0 8px" }}>Відкрито лише для цих магазинів:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SALONS.map((s) => (
              <button key={s.key} className="btn-secondary small" disabled={busy} onClick={() => toggleSalon(s)}
                style={st.open.includes(s.key) ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}>
                {st.open.includes(s.key) && <Check size={12} />} {s.city}, {shortAddr(s.addr)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AdminNews() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sel, setSel] = useState(() => new Set(ALL_CAB_KEYS));
  const [busy, setBusy] = useState(false);
  const all = sel.size === ALL_CAB_KEYS.length;
  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const send = async () => {
    if (!title.trim() || !sel.size) return;
    if (!confirm(`Надіслати новину «${title.trim()}» у ${sel.size} кабінет(ів)?`)) return;
    setBusy(true);
    try {
      for (const k of sel) await notify({ recipient: k, kind: "news", title: title.trim(), body: body.trim(), actor: ADMIN_KEY, link: "" });
      pushToast({ title: "Новину надіслано", body: `${sel.size} кабінет(ів)` });
      setTitle(""); setBody("");
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy(false);
  };
  return (
    <div className="admin-panel">
      <h3>Новини</h3>
      <p className="hint">Прилітає лише у сповіщення (дзвіночок) обраних кабінетів. Модалку не показує.</p>
      <label className="over-field" style={{ maxWidth: "100%" }}><span>Заголовок</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Оновили розрахунок мотивації" />
      </label>
      <label className="over-field" style={{ maxWidth: "100%" }}><span>Текст (необовʼязково)</span>
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="admin-sub-h" style={{ margin: "16px 0 8px" }}>Кому</div>
      <label className="admin-cap" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(ALL_CAB_KEYS))} />
        <span>Усі кабінети ({ALL_CAB_KEYS.length})</span>
      </label>
      <div className="admin-rights-caps" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 6 }}>
        {ALL_CAB_KEYS.map((k) => (
          <label className="admin-cap" key={k}>
            <input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} />
            <span>{cabName(k)}</span>
          </label>
        ))}
      </div>
      <button className="btn-primary" style={{ marginTop: 16 }} disabled={busy || !title.trim() || !sel.size} onClick={send}>
        {busy ? "Надсилаю…" : `Надіслати новину (${sel.size})`}
      </button>
    </div>
  );
}

function AdminShiftLocks() {
  const [locks, setLocks] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => listScheduleLocks().then(setLocks).catch(() => setLocks([]));
  useEffect(() => { load(); return subscribeScheduleLocks(load); }, []);
  if (locks === null) return <div className="loading">Завантаження…</div>;

  const isLocked = (k) => scheduleLockedFor(locks, k);
  const toggle = async (s, next) => {
    setBusy(s.key);
    try {
      await setScheduleLock(s.key, next, ADMIN_KEY);
      await notify({
        recipient: s.key, kind: "shifts",
        title: next ? "Коригування графіка заблоковано" : "Коригування графіка відкрито",
        body: next ? "Внести або змінити графік поки не можна." : "Можна вносити й коригувати графік.",
        actor: ADMIN_KEY, link: "shifts",
      }).catch(() => {});
      pushToast({ title: next ? "Заблоковано" : "Розблоковано", body: `${s.city}, ${shortAddr(s.addr)}` });
      load();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy("");
  };
  const bulk = async (next) => {
    if (!confirm(next ? "Заблокувати коригування графіків усім магазинам?" : "Розблокувати всім?")) return;
    setBusy("*");
    try {
      for (const s of SALONS) if (isLocked(s.key) !== next) {
        await setScheduleLock(s.key, next, ADMIN_KEY);
        await notify({ recipient: s.key, kind: "shifts",
          title: next ? "Коригування графіка заблоковано" : "Коригування графіка відкрито",
          body: next ? "Внести або змінити графік поки не можна." : "Можна вносити й коригувати графік.",
          actor: ADMIN_KEY, link: "shifts" }).catch(() => {});
      }
      pushToast({ title: next ? "Заблоковано всім" : "Розблоковано всім" });
      load();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy("");
  };

  const lockedCount = SALONS.filter((s) => isLocked(s.key)).length;
  return (
    <div className="admin-panel">
      <h3>Замок коригувань графіка</h3>
      <p className="hint">
        Поки замок увімкнено, СМ не може вносити чи міняти графік свого магазину (ані план, ані факт).
        ТМ і керівник редагують графік завжди. Нагадування «Заблокуйте коригування графіків» приходить 5 числа місяця.
      </p>
      <div className="admin-sub-h" style={{ margin: "14px 0 8px" }}>
        Заблоковано: {lockedCount} з {SALONS.length}
        <span style={{ marginLeft: 12 }}>
          <button className="btn-secondary small" disabled={busy} onClick={() => bulk(true)}>Заблокувати всім</button>{" "}
          <button className="btn-secondary small" disabled={busy} onClick={() => bulk(false)}>Розблокувати всім</button>
        </span>
      </div>
      <div className="shlock-list">
        {SALONS.map((s) => {
          const lk = isLocked(s.key);
          return (
            <div className={`shlock-row ${lk ? "on" : ""}`} key={s.key}>
              <span className="shlock-nm">{s.city}, {shortAddr(s.addr)}</span>
              <span className={`shlock-state ${lk ? "bad" : "ok"}`}>{lk ? "🔒 заблоковано" : "відкрито"}</span>
              <button className={lk ? "btn-secondary small" : "btn-primary small"} disabled={busy === s.key || busy === "*"}
                onClick={() => toggle(s, !lk)}>
                {lk ? "Розблокувати" : "Заблокувати"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminPlanLocks() {
  const [ym, setYm] = useState(salaryYm());
  const [plans, setPlans] = useState(null);
  const [busy, setBusy] = useState("");
  const months = useMemo(() => recentMonths(12), []);
  const load = React.useCallback(() => {
    listSmPlans(SALONS.map((s) => s.key), ym).then(setPlans).catch(() => setPlans({}));
  }, [ym]);
  useEffect(() => { setPlans(null); load(); }, [load]);
  useEffect(() => subscribePlans(load), [load]);
  if (plans === null) return <div className="loading">Завантаження…</div>;

  const toggle = async (s, next) => {
    setBusy(s.key);
    try {
      await setPlanLock(s.key, ym, next, ADMIN_KEY);
      pushToast({ title: next ? "План заблоковано" : "План розблоковано", body: `${s.city}, ${shortAddr(s.addr)} · ${monthLabel(ym)}` });
      load();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy("");
  };

  return (
    <div className="admin-panel">
      <h3>Замок планів</h3>
      <p className="hint">
        Поки план на місяць не заблоковано, ТМ може його редагувати. Після замка план назавжди
        фіксується для чесної аналітики план/факт — навіть адмін більше не змінить його випадково.
      </p>
      <div className="month-row" style={{ margin: "10px 0" }}>
        <select value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <div className="shlock-list">
        {SALONS.map((s) => {
          const p = plans[s.key];
          const lk = !!p?.locked;
          return (
            <div className={`shlock-row ${lk ? "on" : ""}`} key={s.key}>
              <span className="shlock-nm">{s.city}, {shortAddr(s.addr)}</span>
              <span className="shlock-state ok">{p ? `план ${fmt(p.turnover_plan)}` : "план не внесено"}</span>
              <button className={lk ? "btn-secondary small" : "btn-primary small"} disabled={busy === s.key || !p}
                onClick={() => toggle(s, !lk)}>
                {lk ? "Розблокувати" : "Заблокувати"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminSupplyArticles() {
  const [all, setAll] = useState(null);   // повний список (builtin + custom)
  const [label, setLabel] = useState("");
  const [asExpense, setAsExpense] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => listWriteoffArticles().then(setAll).catch(() => setAll(WRITEOFF_ARTICLES_BUILTIN));
  useEffect(() => { load(); }, []);

  const custom = (all || []).filter((a) => !a.builtin);
  const persist = async (nextCustom) => {
    setBusy(true);
    try { await saveWriteoffArticles(nextCustom); await load(); }
    catch (e) { pushToast({ title: "Не збережено", body: String(e.message || e) }); }
    setBusy(false);
  };
  const add = async () => {
    if (!label.trim()) return;
    await persist([...custom, { key: `c${Date.now()}`, label: label.trim(), expense: asExpense }]);
    setLabel(""); setAsExpense(false);
    pushToast({ title: "Статтю додано", body: label.trim() });
  };
  const toggleExpense = (key) => persist(custom.map((a) => (a.key === key ? { ...a, expense: !a.expense } : a)));
  const rename = (key, v) => persist(custom.map((a) => (a.key === key ? { ...a, label: v } : a)));
  const remove = (key) => { if (confirm("Видалити статтю? Наявні акти з нею залишаться, але статтю не буде видно у виборі.")) persist(custom.filter((a) => a.key !== key)); };

  if (all === null) return <div className="loading">Завантаження…</div>;

  return (
    <div className="admin-panel">
      <h3>Статті списань</h3>
      <p className="hint">
        Статті, з яких обирає магазин при акті списання. «У витрати магазину» — сума статті потрапляє
        у «Витрати по СМ». Усі статті (і власні) видно в розділі «Витрати по СМ → За статтями».
      </p>

      <div className="admin-reassign-form">
        <label className="over-field" style={{ flex: "1 1 240px" }}><span>Нова стаття</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="напр. Реклама / Ремонт" />
        </label>
        <label className="admin-cap" style={{ alignSelf: "center" }}>
          <input type="checkbox" checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} />
          <span>рахувати у витрати магазину</span>
        </label>
        <button className="btn-primary" disabled={busy || !label.trim()} onClick={add}>Додати</button>
      </div>

      <h4 className="admin-sub-h">Вбудовані</h4>
      <div className="admin-list">
        {all.filter((a) => a.builtin).map((a) => (
          <div className="admin-access-row" key={a.key}>
            <span className="modacc-name">{a.label}</span>
            <span className="modacc-count">{a.expense ? "у витрати магазину" : "лише аналітика"}</span>
          </div>
        ))}
      </div>

      <h4 className="admin-sub-h">Власні статті</h4>
      {custom.length === 0 ? <div className="admin-empty">Немає. Додайте вище.</div> : (
        <div className="admin-list">
          {custom.map((a) => (
            <div className="admin-access-row" key={a.key}>
              <input className="art-name" value={a.label} onChange={(e) => rename(a.key, e.target.value)} />
              <label className="admin-cap">
                <input type="checkbox" checked={!!a.expense} onChange={() => toggleExpense(a.key)} />
                <span>у витрати магазину</span>
              </label>
              <button className="modacc-rm" onClick={() => remove(a.key)}>видалити</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminModuleAccess() {
  const [rows, setRows] = useState(null); // [{ cabKey, name, catalog, access, extra:[key] }]
  const [openCab, setOpenCab] = useState(null);
  const [busy, setBusy] = useState("");

  const load = async () => {
    const out = await Promise.all(ALL_CAB_KEYS.map(async (k) => {
      const [catalog, access, extra] = await Promise.all([getModuleCatalog(k), getModuleAccess(k), getModuleExtra(k)]);
      return { cabKey: k, name: cabName(k), catalog, access, extra };
    }));
    setRows(out);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (cabKey, modKey, enabled) => {
    setBusy(cabKey + modKey);
    setRows((rs) => rs.map((r) => {
      if (r.cabKey !== cabKey) return r;
      const access = { ...r.access };
      if (enabled) delete access[modKey]; else access[modKey] = false;
      return { ...r, access };
    }));
    try { await setModuleAccess(cabKey, modKey, enabled); }
    catch (e) { pushToast({ title: "Не збережено", body: String(e.message || e) }); await load(); }
    setBusy("");
  };
  const addExtra = async (cabKey, modKey) => {
    setBusy(cabKey + modKey);
    try {
      await addModuleExtra(cabKey, modKey);
      pushToast({ title: "Вкладку додано", body: `${cabName(cabKey)} · ${ADDABLE_BY_KEY[modKey]?.label || modKey}` });
      await load();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy("");
  };
  const removeExtra = async (cabKey, modKey) => {
    setBusy(cabKey + modKey);
    try { await removeModuleExtra(cabKey, modKey); await load(); }
    catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy("");
  };

  if (rows === null) return <div className="loading">Завантаження…</div>;

  return (
    <div className="admin-panel">
      <h3>Доступ до вкладок</h3>
      <p className="hint">
        Вмикайте / вимикайте вкладки кожного кабінету, або <b>додавайте</b> будь-яку вкладку зі спільного набору.
        Список рідних вкладок кабінету оновлюється сам після першого входу користувача (нові — одразу увімкнені).
        Перша вкладка кабінету вимкнути не можна. «ЗП ТМ» додати не можна.
      </p>
      <div className="admin-list">
        {rows.map((r) => {
          const off = Object.keys(r.access).filter((k) => r.access[k] === false).length;
          const isOpen = openCab === r.cabKey;
          const catKeys = new Set(r.catalog.map((m) => m.key));
          const canAdd = ADDABLE_MODULES.filter((a) => !catKeys.has(a.key) && !r.extra.includes(a.key));
          return (
            <div className="modacc-cab" key={r.cabKey}>
              <button className="modacc-head" onClick={() => setOpenCab(isOpen ? null : r.cabKey)}>
                <ChevronRight size={14} className={`modacc-chev ${isOpen ? "open" : ""}`} />
                <span className="modacc-name">{r.name}</span>
                <span className="modacc-count">
                  {r.catalog.length === 0 && r.extra.length === 0 ? "не відкривали"
                    : `${off ? `${off} вимкнено` : "усі увімкнені"}${r.extra.length ? ` · +${r.extra.length}` : ""}`}
                </span>
              </button>
              {isOpen && (
                <div className="modacc-body">
                  {r.catalog.length === 0 && (
                    <p className="muted" style={{ fontSize: 12, padding: "4px 2px" }}>
                      Рідні вкладки зʼявляться тут після першого входу користувача. Додані нижче — діють одразу.
                    </p>
                  )}
                  {r.catalog.map((m, i) => {
                    const enabled = r.access[m.key] !== false;
                    const locked = i === 0 && !m.extra;
                    const prevGroup = i > 0 ? (r.catalog[i - 1].group || "") : null;
                    const showGroup = m.group && m.group !== prevGroup;
                    return (
                      <React.Fragment key={m.key}>
                        {showGroup && <div className="modacc-group">{m.group}</div>}
                        <label className={`modacc-row ${locked ? "locked" : ""}`}>
                          <input
                            type="checkbox" checked={enabled} disabled={locked || busy === r.cabKey + m.key}
                            onChange={(e) => toggle(r.cabKey, m.key, e.target.checked)}
                          />
                          <span>{m.label}</span>
                          {m.extra && <span className="modacc-badge">додано</span>}
                          {locked && <span className="modacc-lock">завжди</span>}
                          {m.extra && (
                            <button type="button" className="modacc-rm" title="Прибрати вкладку"
                              onClick={(e) => { e.preventDefault(); removeExtra(r.cabKey, m.key); }}>прибрати</button>
                          )}
                        </label>
                      </React.Fragment>
                    );
                  })}
                  {/* додані, яких ще нема в каталозі (кабінет не відкривали після додавання) */}
                  {r.extra.filter((k) => !catKeys.has(k)).map((k) => (
                    <label className="modacc-row" key={`x-${k}`}>
                      <input type="checkbox" checked disabled />
                      <span>{ADDABLE_BY_KEY[k]?.label || k}</span>
                      <span className="modacc-badge">додано</span>
                      <button type="button" className="modacc-rm" onClick={(e) => { e.preventDefault(); removeExtra(r.cabKey, k); }}>прибрати</button>
                    </label>
                  ))}

                  {canAdd.length > 0 && (
                    <div className="modacc-add">
                      <span className="modacc-add-lbl">Додати вкладку:</span>
                      {canAdd.map((a) => (
                        <button key={a.key} type="button" className="modacc-add-chip" disabled={busy === r.cabKey + a.key}
                          onClick={() => addExtra(r.cabKey, a.key)}>
                          <Plus size={12} /> {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
    } catch (e) { alert(e.message || e); }
    setBusy(false);
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
    ["fop", "ФОП по СМ"],
    ["modaccess", "Доступ до вкладок"],
    ["shiftlock", "Замок графіків"],
    ["planlocks", "Замок планів"],
    ["articles", "Статті списань"],
    ["news", "Новини"],
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
      {tab === "fop" && <AdminFop />}
      {tab === "modaccess" && <AdminModuleAccess />}
      {tab === "shiftlock" && <AdminShiftLocks />}
      {tab === "planlocks" && <AdminPlanLocks />}
      {tab === "articles" && <AdminSupplyArticles />}
      {tab === "news" && <AdminNews />}
      {tab === "rights" && <AdminRights />}
      {tab === "feedback" && <AdminFeedback />}
      {tab === "maint" && <AdminMaintenance />}
      {tab === "log" && <AdminLog />}
    </div>
  );
}

/* =========================================================
   ДОВІДНИК — спільна вкладка (усі кабінети, лише перегляд)
========================================================= */
function DirectoryModule({ cab }) {
  const [list, setList] = useState(null);
  const ownSalon = cab?.type === "sm" ? cab.key : null;
  useEffect(() => {
    let a = true;
    listFopHistory().then((l) => { if (a) setList(l); });
    return () => { a = false; };
  }, []);
  return (
    <div className="dir-mod">
      <div className="tm-head"><h3 className="ov-h">Довідник</h3></div>

      <section className="dir-sec">
        <h4 className="admin-sub-h">Актуальна відповідність ФОП до СМ</h4>
        {list === null ? <div className="loading">Завантаження…</div> : (
          <div className="tm-all">
            <table className="tm-all-tbl">
              <thead><tr><th>Магазин</th><th>ФОП</th><th>Діє з</th></tr></thead>
              <tbody>
                {SALONS.map((s) => {
                  const e = currentFopEntry(list, s.key);
                  return (
                    <tr key={s.key} className={s.key === ownSalon ? "active" : ""}>
                      <td>{s.city}, {shortAddr(s.addr)}</td>
                      <td>{e ? e.fop : <span className="muted">— не задано —</span>}</td>
                      <td className="num muted">{e ? fmtDay(e.fromDate) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dir-sec">
        <h4 className="admin-sub-h">Історія ФОП</h4>
        {list === null ? null
          : list.length === 0 ? <div className="admin-empty">Записів немає.</div>
          : (
            <div className="dir-hist">
              {list.slice().sort((a, b) => (a.fromDate < b.fromDate ? 1 : a.fromDate > b.fromDate ? -1 : b.id - a.id)).map((r) => (
                <div className="dir-hist-row" key={r.id}>
                  <span className="dir-hist-salon">{salonByKey(r.salonKey)?.city || r.salonKey}</span>
                  <span className="dir-hist-fop">{r.fop}</span>
                  <span className="dir-hist-from">з {fmtDay(r.fromDate)}</span>
                </div>
              ))}
            </div>
          )}
      </section>

      <p className="muted" style={{ fontSize: 12 }}>Керування — у кабінеті адміністратора, вкладка «Адміністрування → ФОП по СМ».</p>
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

function TaskCard({ t, cabKey, onStatus, onDelete, autoOpen, cardRef }) {
  const mine = t.assignee === cabKey;
  const owner = t.created_by === cabKey;
  const [open, setOpen] = useState(!!autoOpen);
  const [doneMode, setDoneMode] = useState(false);
  const [comment, setComment] = useState("");
  const [reminded, setReminded] = useState(false);
  const ds = dotState(t);

  const finish = async () => {
    await onStatus(t.id, "done", comment.trim() || undefined);
    setDoneMode(false); setComment("");
  };

  const remind = async () => {
    try {
      await notify({ recipient: t.assignee, kind: "task_new", title: "Нова задача", body: t.title, actor: cabKey, link: `tasks:${t.id}` });
      pushToast({ title: "Нагадано", body: cabName(t.assignee) });
      setReminded(true);
      setTimeout(() => setReminded(false), 4000);
    } catch (e) { pushToast({ title: "Не вдалося нагадати", body: String(e.message || e) }); }
  };

  const minePending = mine && t.status !== "done";

  return (
    <div ref={cardRef} className={`task-card ${isOverdue(t) ? "task-overdue" : ""} ${t.status === "done" ? "task-card-done" : ""} ${minePending ? "task-card-mine" : ""} ${open ? "task-card-open" : ""} ${autoOpen ? "task-card-focus" : ""}`}>
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
              {cabKey === ADMIN_KEY && !mine && t.status !== "done" && (
                <button className="btn-secondary small" onClick={remind} disabled={reminded}>
                  <Bell size={13} /> {reminded ? "Нагадано" : "Нагадати"}
                </button>
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

/* Задача, поставлена одразу кільком (спільний batch_id) — одна картка;
   розгортається на список отримувачів зі статусом кожного. */
function TaskGroupCard({ group, cabKey, onDeleteBatch, autoOpen, cardRef }) {
  const items = group.items;
  const first = items[0];
  const owner = first.created_by === cabKey;
  const total = items.length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const [open, setOpen] = useState(!!autoOpen);
  const [remindBusy, setRemindBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const myItem = items.find((it) => it.assignee === cabKey);
  const minePending = myItem && myItem.status !== "done";

  const remindAll = async () => {
    const pending = items.filter((it) => it.status !== "done");
    if (!pending.length) return;
    setRemindBusy(true);
    try {
      await Promise.all(pending.map((it) => notify({ recipient: it.assignee, kind: "task_new", title: "Нова задача", body: it.title, actor: cabKey, link: `tasks:${it.id}` })));
      pushToast({ title: "Нагадано, хто не виконав", body: `${pending.length} кабінет(ів)` });
    } catch (e) { pushToast({ title: "Не вдалося нагадати", body: String(e.message || e) }); }
    setRemindBusy(false);
  };

  const delBatch = () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    onDeleteBatch(items.map((it) => it.id));
  };

  return (
    <div ref={cardRef} className={`task-card task-group ${isOverdue(first) ? "task-overdue" : ""} ${minePending ? "task-card-mine" : ""} ${open ? "task-card-open" : ""} ${autoOpen ? "task-card-focus" : ""}`}>
      <button className="task-card-main" onClick={() => setOpen((v) => !v)}>
        {first.priority && <Star size={13} className="task-star" fill="currentColor" />}
        <span className="task-title">{first.title}</span>
        <span className="task-card-sub">
          від {cabName(first.created_by)} · {total} отримувач(ів)
          {taskDue(first) && <> · <span className={isOverdue(first) ? "task-due-over" : ""}>до {fmtDeadline(taskDue(first))}</span></>}
        </span>
        <span className="task-group-progress" title={`Виконали ${doneCount} з ${total}`}>{doneCount}/{total}</span>
      </button>

      {open && (
        <div className="task-card-detail">
          {first.description && <p className="task-desc">{first.description}</p>}
          <div className="task-group-list">
            {items.map((it) => (
              <div key={it.id} className={`task-group-row ${it.status === "done" ? "tg-done" : "tg-open"} ${it.assignee === cabKey && it.status !== "done" ? "tg-mine" : ""}`}>
                <div className="tg-row-main">
                  <span className="tg-name">{cabName(it.assignee)}</span>
                  <span className="tg-status">{it.status === "done" ? "Виконано ✓" : it.status === "in_progress" ? "В роботі" : "Не виконано"}</span>
                </div>
                {it.comment && <p className="tg-comment">💬 {it.comment}</p>}
              </div>
            ))}
          </div>
          {owner && (
            <div className="task-actions">
              {cabKey === ADMIN_KEY && doneCount < total && (
                <button className="btn-secondary small" onClick={remindAll} disabled={remindBusy}>
                  <Bell size={13} /> Нагадати, хто не виконав
                </button>
              )}
              <button className="btn-danger small" onClick={delBatch}>
                <Trash2 size={13} /> {confirmDel ? "Точно видалити всі?" : "Видалити"}
              </button>
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
function DateTimeField({ value, onChange, dateOnly, placeholder }) {
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
    const z = window.__uiZoom || 1; // фіксоване позиціювання рахується в масштабованих px
    const rb = r.bottom / z, rt = r.top / z, rl = r.left / z, vh = window.innerHeight / z, vw = window.innerWidth / z;
    const flip = rb + 350 > vh;
    setPos({
      left: Math.max(8, Math.min(rl, vw - 296)),
      top: flip ? undefined : rb + 6,
      bottom: flip ? vh - rt + 6 : undefined,
    });
    setView(new Date((sel || new Date()).getFullYear(), (sel || new Date()).getMonth(), 1));
    setOpen(true);
  };
  const emit = (y, mo, d, hh, mm) => onChange(new Date(y, mo, d, hh, mm, 0, 0).toISOString());
  const pickDay = (d) => { emit(view.getFullYear(), view.getMonth(), d, h, m); if (dateOnly) setOpen(false); };
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
        <span>{value ? (dateOnly ? new Date(value).toLocaleDateString("uk-UA") : fmtDeadline(value)) : (placeholder || "Без дедлайну")}</span>
        {value && <span className="dtf-clear" onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}><X size={13} /></span>}
      </button>
      {open && createPortal(
        <>
          <div className="dtf-backdrop" onClick={() => setOpen(false)} />
          <div className="dtf-pop" style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}>
            <div className="dtf-quick">
              {dateOnly ? (
                <>
                  <button type="button" onClick={() => quick(0, 12)}>Сьогодні</button>
                  <button type="button" onClick={() => quick(-1, 12)}>Вчора</button>
                  <button type="button" onClick={() => quick(-7, 12)}>−7 днів</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => quick(0, 18)}>Сьогодні</button>
                  <button type="button" onClick={() => quick(1, 10)}>Завтра</button>
                  <button type="button" onClick={() => quick(7, 10)}>+7 днів</button>
                </>
              )}
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
            {!dateOnly && <div className="dtf-time">
              <Clock size={13} />
              <select value={h} onChange={(e) => pickTime(Number(e.target.value), m)}>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad2(i)}</option>)}
              </select>
              <span>:</span>
              <select value={m} onChange={(e) => pickTime(h, Number(e.target.value))}>
                {[0, 15, 30, 45].map((mm) => <option key={mm} value={mm}>{pad2(mm)}</option>)}
              </select>
              <button type="button" className="dtf-ok" onClick={() => setOpen(false)}>Готово</button>
            </div>}
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
  const [focusId] = useState(() => takeFocusTaskId()); // перехід зі сповіщення на конкретну задачу
  const focusRef = useRef(null);

  useEffect(() => {
    if (tasks && tasks.length) markSeen(tasks, cab.key).catch(() => {});
  }, [tasks, cab.key]);
  useEffect(() => {
    if (focusId && focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, tasks]);

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
  const onDeleteBatch = async (ids) => {
    try { await deleteTaskBatch(ids); reload(); }
    catch (e) { pushToast({ title: "Не вдалося видалити", body: String(e.message || e) }); }
  };

  if (tasks === null) return <div className="loading">Завантаження…</div>;

  const visible = onlyPriority ? tasks.filter((t) => t.priority) : tasks;
  // задачі, поставлені кільком отримувачам одразу (спільний batch_id), рендеримо
  // однією карткою — розгортається на «хто виконав / хто ні»; в «виконані» падає,
  // лише коли виконали абсолютно всі.
  const groups = groupTasks(visible);
  const activeGroups = groups.filter((g) => g.items.some((it) => it.status !== "done"));
  const doneGroups = groups.filter((g) => g.items.every((it) => it.status === "done"));
  const allGroups = groupTasks(tasks);
  const renderGroup = (g) => {
    const focusHere = g.items.some((it) => it.id === focusId);
    if (g.items.length > 1) {
      return (
        <TaskGroupCard key={g.batchId} group={g} cabKey={cab.key} onStatus={onStatus} onDeleteBatch={onDeleteBatch}
          autoOpen={focusHere} cardRef={focusHere ? focusRef : undefined} />
      );
    }
    const t = g.items[0];
    return <TaskCard key={t.id} t={t} cabKey={cab.key} onStatus={onStatus} onDelete={onDelete} autoOpen={t.id === focusId} cardRef={t.id === focusId ? focusRef : undefined} />;
  };

  const inWork = tasks.filter((t) => t.status === "in_progress").length;
  const unfinished = allGroups.filter((g) => g.items.some((it) => it.status !== "done")).length;
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

      {activeGroups.length === 0 ? (
        <div className="admin-empty">{onlyPriority ? "Пріоритетних задач немає." : "Активних задач немає."}</div>
      ) : (
        <div className="task-list">
          {activeGroups.map(renderGroup)}
        </div>
      )}

      {doneGroups.length > 0 && (
        <>
          <button className="task-done-toggle" onClick={() => setShowDone((v) => !v)}>
            Виконані ({doneGroups.length}) {showDone ? "▾" : "▸"}
          </button>
          {showDone && (
            <div className="task-list">
              {doneGroups.map(renderGroup)}
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
/* прострочений = виставлений 5+ днів тому і досі не опрацьований (статус «Виставлено») */
const INV_OVERDUE_DAYS = 5;
const invDaysOld = (inv) => Math.floor((Date.now() - new Date(inv.created_at).getTime()) / 864e5);
const isInvOverdue = (inv) => inv.status === "issued" && invDaysOld(inv) >= INV_OVERDUE_DAYS;

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

function InvoiceCreateModal({ cab, inv, onClose, onCreated }) {
  const editing = !!inv;
  const [shot, setShot] = useState(inv?.screenshot || "");
  const [counterparty, setCounterparty] = useState(inv?.counterparty || ""); // Покупець (клієнт)
  const [issuer, setIssuer] = useState(inv?.issuer || "");             // Постачальник (Будвік / ФОП)
  const [vat, setVat] = useState(inv?.vat || false);
  const [items, setItems] = useState(inv?.items || []);
  const [amount, setAmount] = useState(inv?.amount || 0);
  const [invNo, setInvNo] = useState(inv?.invoice_no || "");
  const [comment, setComment] = useState(inv?.comment || "");
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
      if (editing) {
        await updateInvoice(inv.id, {
          counterparty, issuer, vat, items, amount, invoice_no: invNo, screenshot: shot, comment,
          history: [...(inv.history || []), { status: inv.status, at: new Date().toISOString(), by: cab.key, note: "рахунок відредаговано" }],
        });
        pushToast({ title: "Зміни збережено", body: `${counterparty || "рахунок"} · ${invMoney(amount)}` });
      } else {
        await createInvoice({ counterparty, issuer, vat, items, amount, invoice_no: invNo, screenshot: shot, comment, created_by: cab.key });
        pushToast({ title: "Рахунок виставлено", body: `${counterparty || "рахунок"} · ${invMoney(amount)}` });
      }
      onCreated(); onClose();
    } catch (e) { setErr(e.message || "Не вдалося зберегти"); setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{editing ? "Редагувати рахунок" : "Новий безнальний рахунок"}</h3>
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
            {busy ? "…" : editing ? "Зберегти зміни" : "Виставити рахунок"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InvoiceCard({ inv, cab, canManage, medok, onPreview, onChanged, onEdit, compact }) {
  const [open, setOpen] = useState(false);
  const [cmt, setCmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const owner = inv.created_by === cab.key;
  const nx = nextStatus(inv.status);
  const prevIdx = INVOICE_FLOW.indexOf(inv.status) - 1;
  const prev = prevIdx >= 0 ? INVOICE_FLOW[prevIdx] : null;
  const active = inv.status !== "cancelled" && inv.status !== "documented";
  // «Оплачено» ставлять лише ТМ Шах і Юля; «Відвантажено»/«Пропечатано» —
  // фізичні дії самого магазину, лише його власник рахунку. Більше ніхто.
  const isPayer = cab.key === "andriy" || cab.type === "accountant";
  const canAdvance = nx === "paid" ? isPayer : owner;
  const canRevert = inv.status === "paid" ? isPayer : (inv.status === "shipped" || inv.status === "documented") ? owner : false;

  const move = async (st, note) => {
    setBusy(true);
    try {
      await setInvoiceStatus(inv, st, cab.key, note);
      // Юля могла додати компанію до списку Medok уже ПІСЛЯ того, як магазин
      // відвантажив — тож перевіряємо на обох кроках (Відвантажено й Пропечатано),
      // щоб попередження точно наздогнало магазин.
      if ((st === "shipped" || st === "documented") && isMedokCompany(medok, inv.counterparty)) {
        pushToast({ title: "Договір Medok", body: `«${inv.counterparty}» — документи пропечатувати не потрібно` });
        if (inv.created_by && inv.created_by !== cab.key) {
          notify({
            recipient: inv.created_by, kind: "invoice",
            title: "Пропечатувати не потрібно",
            body: `«${inv.counterparty}»${inv.invoice_no ? ` · рахунок №${inv.invoice_no}` : ""} — договір Medok, документи не друкуємо.`,
            actor: cab.key, link: "invoices",
          }).catch(() => {});
        }
      }
      onChanged();
    } catch (e) {
      if (e.code === "stale_status") {
        // хтось (напр. ТМ і Юля одночасно) уже змінив статус — не тремо його історію
        try {
          const fresh = await getInvoice(inv.id);
          const last = (fresh.history || [])[fresh.history.length - 1];
          pushToast({
            title: "Статус уже змінено",
            body: last ? `${cabName(last.by)} щойно поставив «${INVOICE_STATUS[fresh.status] || fresh.status}»` : "Хтось уже оновив цей рахунок",
          });
        } catch { pushToast({ title: "Статус уже змінено", body: "Хтось уже оновив цей рахунок" }); }
        onChanged();
      } else {
        alert("Не вдалося: " + (e.message || e));
      }
    }
    setBusy(false); setCmt("");
  };
  const addComment = async () => {
    if (!cmt.trim()) return;
    setBusy(true);
    try { await updateInvoice(inv.id, { comment: cmt.trim(), history: [...(inv.history || []), { status: inv.status, at: new Date().toISOString(), by: cab.key, note: cmt.trim() }] }); onChanged(); setCmt(""); }
    catch (e) { alert(e.message || e); }
    setBusy(false);
  };

  const overdue = isInvOverdue(inv);
  return (
    <div className={`inv-card ${compact ? "inv-card-compact" : ""} ${inv.status === "cancelled" ? "inv-cancelled" : ""} ${overdue ? "inv-overdue" : ""} ${open ? "inv-open" : ""}`}>
      <div className="inv-card-main">
        <button className="inv-card-expand" onClick={() => setOpen((v) => !v)}>
          <span className={`inv-dot inv-${inv.status}`} />
          <span className="inv-cp-wrap">
            <span className="inv-cp">{inv.counterparty || "рахунок без назви"}</span>
            {inv.issuer && <span className="inv-issuer">від {inv.issuer}</span>}
          </span>
          <span className={`inv-vat ${inv.vat ? "on" : ""}`}>{inv.vat ? "з ПДВ" : "без ПДВ"}</span>
          <span className="inv-amount">{invMoney(inv.amount)}</span>
          {overdue
            ? <span className="badge badge-off inv-badge inv-badge-over">прострочено {invDaysOld(inv)} дн.</span>
            : <span className={`badge ${INV_TONE[inv.status]} inv-badge`}>{INVOICE_STATUS[inv.status]}</span>}
        </button>
        {inv.screenshot && (
          <button className="inv-shot-btn" title="Відкрити скрін рахунку" onClick={() => onPreview(inv.screenshot)}>
            <ImageIcon size={15} />
          </button>
        )}
      </div>
      {salonByKey(inv.created_by) && (
        <div className="inv-fop-line">{salonLabel(salonByKey(inv.created_by))}</div>
      )}
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
            {canAdvance && nx && (
              <button className="btn-primary small" disabled={busy} onClick={() => move(nx)}>
                Позначити: {INVOICE_STATUS[nx]}
              </button>
            )}
            {canRevert && prev && active && (
              <button className="btn-secondary small" disabled={busy} onClick={() => move(prev)}>↩ {INVOICE_STATUS[prev]}</button>
            )}
            {(canManage || (owner && inv.status === "issued")) && inv.status !== "cancelled" && (
              <button className="btn-secondary small" disabled={busy} onClick={() => move("cancelled")}>Скасувати</button>
            )}
            {owner && inv.status === "issued" && (
              <button className="btn-secondary small" disabled={busy} onClick={() => onEdit(inv)}>
                <Pencil size={13} /> Редагувати
              </button>
            )}
            {owner && inv.status === "issued" && (
              // без window.confirm (ненадійний у мобільному PWA) — озброюємо кнопку на 4с
              <button
                className="btn-danger small" disabled={busy}
                onClick={() => {
                  if (!confirmDel) {
                    setConfirmDel(true);
                    setTimeout(() => setConfirmDel(false), 4000);
                    return;
                  }
                  setConfirmDel(false);
                  deleteInvoice(inv.id).then(() => { pushToast({ title: "Рахунок видалено", body: inv.counterparty || "" }); onChanged(); })
                    .catch((e) => pushToast({ title: "Не вдалося", body: String(e.message || e) }));
                }}
              >
                <Trash2 size={13} /> {confirmDel ? "Точно видалити?" : "Видалити"}
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

/* Юля: список компаній з договором Medok — при «Відвантажено» пропечатувати не треба. */
function MedokPanel({ medok, cabKey }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [counterparties, setCounterparties] = useState([]);
  const [showSug, setShowSug] = useState(false);

  useEffect(() => { listCounterparties().then(setCounterparties).catch(() => setCounterparties([])); }, []);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return counterparties.filter((c) => c.toLowerCase().includes(q) && !isMedokCompany(medok, c)).slice(0, 8);
  }, [name, counterparties, medok]);

  const add = async (val) => {
    const v = (val ?? name).trim();
    if (!v) return;
    setBusy(true);
    try { await addMedokCompany(v, cabKey); pushToast({ title: "Додано", body: v }); setName(""); setShowSug(false); }
    catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy(false);
  };
  const remove = async (c) => {
    // window.confirm ненадійний у мобільному PWA — просто видаляємо і показуємо toast
    try { await deleteMedokCompany(c.id); pushToast({ title: "Прибрано зі списку Medok", body: c.name }); }
    catch (e) { pushToast({ title: "Не вдалося прибрати", body: String(e.message || e) }); }
  };
  return (
    <div className="medok-panel">
      <button className="medok-toggle" onClick={() => setOpen((v) => !v)}>
        <span>Договори Medok{medok.length ? ` · ${medok.length}` : ""}</span>
        <ChevronRight size={14} className={open ? "rot" : ""} />
      </button>
      {open && (
        <div className="medok-body">
          <p className="hint">Компанії з договором Medok — коли рахунок такої компанії переходить у «Відвантажено» чи «Пропечатано», паперові документи друкувати не потрібно. Почніть вводити назву — підкажемо контрагентів з усіх рахунків, з якими вже була взаємодія.</p>
          <div className="medok-add" style={{ position: "relative" }}>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setShowSug(true); }}
              onFocus={() => setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              placeholder="Пошук контрагента з рахунків…"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <button className="btn-primary small" disabled={busy || !name.trim()} onClick={() => add()}>Додати</button>
            {showSug && suggestions.length > 0 && (
              <div className="medok-suggest">
                {suggestions.map((c) => (
                  <button key={c} className="medok-suggest-item" onMouseDown={() => add(c)}>{c}</button>
                ))}
              </div>
            )}
          </div>
          <div className="medok-list">
            {medok.length === 0 && <p className="hint">список порожній</p>}
            {medok.map((c) => (
              <span className="medok-chip" key={c.id}>{c.name}<button onClick={() => remove(c)}><X size={12} /></button></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Контроль видаткових накладних (Юлія): «Пропечатано» → «Передано в офіс» ---------- */
const docsStamp = (inv) => {
  const h = [...(inv.history || [])].reverse().find((x) => x.status === "documented");
  return h?.at || inv.updated_at || inv.created_at;
};
const docsDays = (inv) => Math.max(0, Math.floor((Date.now() - new Date(docsStamp(inv)).getTime()) / 86400000));
const docsState = (inv) => (inv.docs_office_at ? "handed" : inv.docs_notified_at ? "notified" : "waiting");
const daysWord = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "день" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "дні" : "днів"}`;

/* нагадування СМ про відсутні видаткові накладні: задача з екраном «Ознайомлений» + відмітка в рахунку */
async function sendDocsReminder(inv, byKey) {
  // повторне нагадування: прибираємо попередню задачу, щоб у СМ не накопичувались дублі
  if (inv.docs_task_id) await deleteTask(inv.docs_task_id).catch(() => {});
  const created = await createTasks({
    title: `Бухгалтер повідомляє вас про відсутність видаткових накладних за рахунком: ${inv.counterparty || "без назви"}, сума ${invMoney(inv.amount)}`,
    description: "Знайдіть і передайте оригінали видаткових накладних в офіс.",
    assignees: [inv.created_by], due_at: "", priority: false, created_by: byKey,
  });
  await updateInvoice(inv.id, {
    docs_notified_at: new Date().toISOString(),
    docs_notify_count: (inv.docs_notify_count || 0) + 1,
    docs_task_id: created[0]?.id || null,
    history: [...(inv.history || []), { status: inv.status, at: new Date().toISOString(), by: byKey, note: "СМ повідомлено про відсутність видаткових накладних" }],
  });
}
const ymdUa = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join(".") : "");

/* Вікно «Додати рахунок вручну» (Юля): документи за старі періоди, яких магазин не виставляв */
function InvoiceManualModal({ cab, rows, onClose, onCreated }) {
  const today = new Date().toISOString().slice(0, 10);
  const [salonKey, setSalonKey] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [invNo, setInvNo] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState(0);
  const [issuer, setIssuer] = useState("budvik");
  const [comment, setComment] = useState("");
  const [notifyNow, setNotifyNow] = useState(true);
  const [sugg, setSugg] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [errField, setErrField] = useState("");
  const fail = (field, msg, id) => { setErr(msg); setErrField(field); if (id) setTimeout(() => document.getElementById(id)?.focus(), 30); return false; };
  useEffect(() => { listCounterparties().then(setSugg).catch(() => {}); }, []);
  const salons = useMemo(() => [...SALONS].sort((a, b) => salonLabel(a).localeCompare(salonLabel(b), "uk")), []);

  const submit = async () => {
    setErr(""); setErrField("");
    if (!salonKey) return fail("salon", "Оберіть магазин, якому призначити рахунок", "inv-m-salon");
    if (!counterparty.trim()) return fail("company", "Вкажіть компанію (покупця)", "inv-m-company");
    if (!(amount > 0)) return fail("amount", "Вкажіть суму рахунку", "inv-m-amount");
    if (!date) return fail("date", "Вкажіть дату рахунку — вона потрібна, щоб порахувати, скільки днів немає документів", "inv-m-date");
    if (date > today) return fail("date", "Дата рахунку не може бути в майбутньому", "inv-m-date");
    const no = invNo.trim().toLowerCase();
    if (no && rows.some((r) => r.created_by === salonKey && (r.invoice_no || "").trim().toLowerCase() === no && (r.counterparty || "").trim().toLowerCase() === counterparty.trim().toLowerCase())) {
      return fail("invNo", "Такий рахунок цього магазину вже є в списку", "inv-m-no");
    }
    setBusy(true);
    let created;
    try {
      created = await createManualInvoice({
        salonKey, counterparty, issuer: issuer === "budvik" ? "ТОВ Будвік" : "ФОП", vat: issuer === "budvik",
        amount, invoice_no: invNo, invoice_date: date, comment, by: cab.key,
      });
    } catch (e) { setErr(e.message || "Не вдалося додати рахунок"); setBusy(false); return; }
    if (notifyNow) {
      try { await sendDocsReminder(created, cab.key); pushToast({ title: "Рахунок додано, СМ повідомлено", body: cabName(salonKey) }); }
      catch (e) { pushToast({ title: "Рахунок додано, але СМ не повідомлено", body: String(e.message || e) }); }
    } else {
      pushToast({ title: "Рахунок додано", body: `${counterparty.trim()} · ${invMoney(amount)}` });
    }
    onCreated(); onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Додати рахунок вручну</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="hint">Для документів за старі періоди, яких магазин не виставляв. Рахунок одразу потрапить у «Чекають документи».</p>
          <label className={`over-field ${errField === "salon" ? "over-err" : ""}`}><span>Магазин (СМ отримає повідомлення)</span>
            <select id="inv-m-salon" value={salonKey} onChange={(e) => setSalonKey(e.target.value)}>
              <option value="">Оберіть магазин…</option>
              {salons.map((s) => <option key={s.key} value={s.key}>{salonLabel(s)}</option>)}
            </select>
          </label>
          <label className={`over-field ${errField === "company" ? "over-err" : ""}`}><span>Компанія (покупець)</span>
            <input id="inv-m-company" list="inv-manual-companies" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Кому виставлено рахунок" />
            <datalist id="inv-manual-companies">{sugg.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <div className="task-modal-row">
            <label className={`over-field ${errField === "invNo" ? "over-err" : ""}`}><span>№ рахунку</span>
              <input id="inv-m-no" value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="—" />
            </label>
            <label className={`over-field ${errField === "date" ? "over-err" : ""}`}><span>Дата рахунку</span>
              <input id="inv-m-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={`over-field ${errField === "amount" ? "over-err" : ""}`}><span>Сума, грн</span>
              <NumInput id="inv-m-amount" value={amount} onChange={setAmount} placeholder="0.00" />
            </label>
          </div>
          <div className="over-field"><span>Постачальник</span>
            <div className="inv-issuer">
              <button type="button" className={issuer === "budvik" ? "on" : ""} onClick={() => setIssuer("budvik")}>Будвік · з ПДВ</button>
              <button type="button" className={issuer === "fop" ? "on" : ""} onClick={() => setIssuer("fop")}>ФОП · без ПДВ</button>
            </div>
          </div>
          <label className="over-field"><span>Коментар (необовʼязково)</span>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Напр. накладна за березень, потрібен оригінал" />
          </label>
          <label className="task-priority-toggle">
            <input type="checkbox" checked={notifyNow} onChange={(e) => setNotifyNow(e.target.checked)} />
            Одразу повідомити СМ про відсутність документів
          </label>
        </div>
        <div className="modal-foot">
          {err && <p className="form-err" role="alert" style={{ flex: 1, margin: 0 }}>{err}</p>}
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Скасувати</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "…" : "Додати рахунок"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InvoiceDocsControl({ rows, cab, onChanged, onPreview }) {
  const [tasks, setTasks] = useState([]);
  const [f, setF] = useState("open"); // open | notified | handed | all
  const [q, setQ] = useState("");
  const [salonF, setSalonF] = useState("all");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let a = true;
    const load = () => listTasks().then((t) => { if (a) setTasks(t); }).catch(() => {});
    load();
    const un = subscribeTasks(load);
    return () => { a = false; un(); };
  }, []);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const docs = rows.filter((r) => r.status === "documented");
  const cnt = {
    open: docs.filter((r) => docsState(r) !== "handed").length,
    notified: docs.filter((r) => docsState(r) === "notified").length,
    handed: docs.filter((r) => docsState(r) === "handed").length,
    all: docs.length,
  };
  const salonKeys = [...new Set(docs.map((r) => r.created_by))].sort();
  const ql = q.trim().toLowerCase();
  const shown = docs
    .filter((r) => {
      if (salonF !== "all" && r.created_by !== salonF) return false;
      if (f === "open" && docsState(r) === "handed") return false;
      if (f === "notified" && docsState(r) !== "notified") return false;
      if (f === "handed" && docsState(r) !== "handed") return false;
      if (!ql) return true;
      return [r.counterparty, r.invoice_no, String(r.amount), cabName(r.created_by)].filter(Boolean).join(" ").toLowerCase().includes(ql);
    })
    .sort((a, b) => (f === "handed" ? (a.docs_office_at < b.docs_office_at ? 1 : -1) : docsDays(b) - docsDays(a)));

  const withHistory = (inv, note) => [...(inv.history || []), { status: inv.status, at: new Date().toISOString(), by: cab.key, note }];

  const markOffice = async (inv, on) => {
    setBusyId(inv.id);
    try {
      await updateInvoice(inv.id, {
        docs_office_at: on ? new Date().toISOString() : null,
        docs_office_by: on ? cab.key : "",
        history: withHistory(inv, on ? "документи передано в офіс" : "передачу документів в офіс скасовано"),
      });
      // якщо СМ уже отримав задачу-нагадування — закриваємо її, щоб не висіла
      if (on && inv.docs_task_id) setTaskStatus(inv.docs_task_id, "done", "Документи передано в офіс").catch(() => {});
      pushToast({ title: on ? "Позначено: передано в офіс" : "Позначку знято", body: `${inv.counterparty || "рахунок"} · ${invMoney(inv.amount)}` });
      onChanged();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusyId("");
  };

  const notifySm = async (inv) => {
    setBusyId(inv.id);
    try {
      await sendDocsReminder(inv, cab.key);
      pushToast({ title: "СМ повідомлено", body: cabName(inv.created_by) });
      onChanged();
    } catch (e) { pushToast({ title: "Не вдалося повідомити", body: String(e.message || e) }); }
    setBusyId("");
  };

  const [delArmed, setDelArmed] = useState("");
  const removeManual = async (inv) => {
    if (delArmed !== inv.id) { setDelArmed(inv.id); setTimeout(() => setDelArmed((v) => (v === inv.id ? "" : v)), 4000); return; }
    setBusyId(inv.id); setDelArmed("");
    try {
      if (inv.docs_task_id) await deleteTask(inv.docs_task_id).catch(() => {});
      await deleteInvoice(inv.id);
      pushToast({ title: "Рахунок видалено", body: `${inv.counterparty || "рахунок"} · ${invMoney(inv.amount)}` });
      onChanged();
    } catch (e) { pushToast({ title: "Не вдалося видалити", body: String(e.message || e) }); }
    setBusyId("");
  };

  return (
    <div>
      <p className="hint" style={{ marginBottom: 12 }}>
        Тут усі рахунки, які магазини позначили «Пропечатано», і ті, що ви додали вручну. Позначайте, коли оригінали документів дійшли до офісу.
        Якщо їх немає — одним кліком нагадайте магазину.
      </p>
      <div className="inv-toolbar">
        <div className="inv-search">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Компанія, сума або № рахунку" />
          {q && <button className="inv-search-clear" onClick={() => setQ("")}><X size={13} /></button>}
        </div>
        <select value={salonF} onChange={(e) => setSalonF(e.target.value)}>
          <option value="all">Усі салони</option>
          {salonKeys.map((k) => <option key={k} value={k}>{cabName(k)}</option>)}
        </select>
      </div>
      <div className="inv-filters">
        {[["open", "Чекають документи"], ["notified", "СМ повідомлено"], ["handed", "Передано в офіс"], ["all", "Усі"]].map(([k, l]) => (
          <button key={k} className={`inv-fchip ${f === k ? "on" : ""}`} onClick={() => setF(k)}>{l} · {cnt[k]}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="admin-empty">{f === "open" ? "Усі документи в офісі — чекати нічого." : "Рахунків немає."}</div>
      ) : (
        <div className="dc-list">
          {shown.map((inv) => {
            const st = docsState(inv);
            const days = docsDays(inv);
            const t = inv.docs_task_id ? taskById[inv.docs_task_id] : null;
            const ackTxt = t ? (t.status === "done" ? " · СМ позначив виконаним" : t.ack?.[inv.created_by] ? " · ознайомлений ✓" : " · ще не ознайомлений") : "";
            const busy = busyId === inv.id;
            return (
              <div className={`dc-row ${st === "handed" ? "done" : ""}`} key={inv.id}>
                <div className="dc-top">
                  <div className="dc-main">
                    <div className="dc-name">{inv.counterparty || "Без назви"}</div>
                    <div className="dc-sub">
                      {cabName(inv.created_by)}{inv.invoice_no ? ` · рахунок № ${inv.invoice_no}` : ""} · {inv.manual ? `від ${ymdUa(inv.invoice_date)}` : `пропечатано ${fmtDate(docsStamp(inv))}`}
                      {inv.screenshot && <> · <button className="wh-link" onClick={() => onPreview(inv.screenshot)}>рахунок</button></>}
                    </div>
                    {inv.comment && inv.manual && <div className="dc-sub">{inv.comment}</div>}
                  </div>
                  <div className="dc-amt">{invMoney(inv.amount)}</div>
                </div>
                <div className="dc-bottom">
                  {inv.manual && <span className="dc-pill info">Додано вручну</span>}
                  {st === "handed" ? (
                    <span className="dc-pill ok">Передано в офіс {fmtDate(inv.docs_office_at)} · {cabName(inv.docs_office_by)}</span>
                  ) : (
                    <>
                      {st === "notified" && <span className="dc-pill info">СМ повідомлено {fmtDate(inv.docs_notified_at)}{ackTxt}</span>}
                      <span className={`dc-pill ${days >= 10 ? "bad" : "warn"}`}>{st === "waiting" ? "Чекаємо документи · " : ""}{daysWord(days)}{st === "notified" ? " без документів" : ""}</span>
                    </>
                  )}
                  <span className="dc-spacer" />
                  {inv.manual && st !== "handed" && (
                    <button className="wh-link" disabled={busy} onClick={() => removeManual(inv)}>{delArmed === inv.id ? "точно видалити?" : "видалити"}</button>
                  )}
                  {st === "handed" ? (
                    <button className="wh-link" disabled={busy} onClick={() => markOffice(inv, false)}>скасувати</button>
                  ) : (
                    <>
                      <button className="btn-primary small" disabled={busy} onClick={() => markOffice(inv, true)}>Передали на офіс</button>
                      <button className={`btn-secondary small ${st === "waiting" ? "dc-warnbtn" : ""}`} disabled={busy} onClick={() => notifySm(inv)}>
                        {st === "waiting" && <Bell size={13} />} {busy ? "…" : st === "notified" ? "Нагадати ще раз" : "Повідомити СМ про відсутність документів"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InvoicesModule({ cab }) {
  const [allRows, reload] = useInvoices();
  const [showModal, setShowModal] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [view, setView] = useState("list");     // list | analytics
  const [filter, setFilter] = useState("open"); // open | archive | all | <status>
  const [medok, setMedok] = useState([]);
  const isYulia = cab.key === "accountant";
  useEffect(() => {
    const load = () => listMedokCompanies().then(setMedok).catch(() => setMedok([]));
    load();
    return subscribeMedok(load);
  }, []);
  const [sort, setSort] = useState("date_desc");
  const [salonF, setSalonF] = useState("all");
  const [preview, setPreview] = useState(null);
  const [editInv, setEditInv] = useState(null);
  const [q, setQ] = useState("");

  const canCreate = cab.type === "sm";
  const canManage = cab.type === "accountant" || cab.type === "manager" || cab.type === "tm";
  const multiSalon = cab.type !== "sm";
  const canControlDocs = cab.type === "accountant" || cab.type === "manager" || cab.key === ADMIN_KEY;

  if (allRows === null) return <div className="loading">Завантаження…</div>;
  // рахунки, додані вручну бухгалтером, живуть лише в «Контролі документів» — у списку, дошці й аналітиці їх немає
  const rows = allRows.filter((r) => !r.manual);
  const docsOpenCount = canControlDocs ? allRows.filter((r) => r.status === "documented" && !r.docs_office_at).length : 0;

  const salonKeys = [...new Set(rows.map((r) => r.created_by))].sort();
  const counts = INVOICE_FLOW.reduce((a, s) => ({ ...a, [s]: rows.filter((r) => r.status === s).length }), {});
  const archived = (r) => r.status === "documented" || r.status === "cancelled";
  const overdueCount = rows.filter(isInvOverdue).length;

  // пошук: покупець / постачальник / № рахунку / коментар / позиції / салон
  const ql = q.trim().toLowerCase();
  const matchesQuery = (r) => {
    if (!ql) return true;
    const hay = [
      r.counterparty, r.issuer, r.invoice_no, r.comment, cabName(r.created_by),
      ...(Array.isArray(r.items) ? r.items.map((it) => it.name) : []),
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(ql);
  };
  const rowsQ = ql ? rows.filter(matchesQuery) : rows;

  let shown = rowsQ.filter((r) => {
    if (salonF !== "all" && r.created_by !== salonF) return false;
    if (filter === "overdue") return isInvOverdue(r);
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
        {canControlDocs && (
          <button className="btn-primary small" onClick={() => setShowManual(true)}><Plus size={14} /> Додати рахунок</button>
        )}
      </div>

      <div className="inv-viewtabs">
        <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>Список</button>
        <button className={view === "board" ? "on" : ""} onClick={() => setView("board")}>Дошка</button>
        {!isYulia && <button className={view === "analytics" ? "on" : ""} onClick={() => setView("analytics")}><BarChart3 size={13} /> Аналітика</button>}
        {canControlDocs && <button className={view === "docs" ? "on" : ""} onClick={() => setView("docs")}>Контроль документів{docsOpenCount > 0 ? ` · ${docsOpenCount}` : ""}</button>}
      </div>

      {isYulia && <MedokPanel medok={medok} cabKey={cab.key} />}

      {view === "docs" && canControlDocs ? (
        <InvoiceDocsControl rows={allRows} cab={cab} onChanged={reload} onPreview={setPreview} />
      ) : view === "analytics" && !isYulia ? (
        <InvoiceAnalytics rows={rows} cab={cab} />
      ) : view === "board" ? (
        <>
          <div className="inv-toolbar">
            <div className="inv-search">
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: покупець, постачальник, № рахунку, позиція…" />
              {q && <button className="inv-search-clear" onClick={() => setQ("")}><X size={13} /></button>}
            </div>
            {multiSalon && (
              <select value={salonF} onChange={(e) => setSalonF(e.target.value)}>
                <option value="all">Усі салони</option>
                {salonKeys.map((k) => <option key={k} value={k}>{cabName(k)}</option>)}
              </select>
            )}
          </div>
          <div className="inv-board">
            {INVOICE_FLOW.map((st) => {
              const col = rowsQ.filter((r) => r.status === st && (salonF === "all" || r.created_by === salonF));
              const ordered = st === "issued"
                ? [...col].sort((a, b) => (isInvOverdue(b) ? 1 : 0) - (isInvOverdue(a) ? 1 : 0) || (a.created_at < b.created_at ? 1 : -1))
                : [...col].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
              const sum = col.reduce((s, r) => s + Number(r.amount || 0), 0);
              return (
                <div className="inv-col" key={st}>
                  <div className="inv-col-h"><span>{INVOICE_STATUS[st]}</span><span className="mono">{col.length} · {invMoney(sum)}</span></div>
                  <div className="inv-col-body">
                    {ordered.length === 0
                      ? <p className="inv-col-empty">—</p>
                      : ordered.map((inv) => <InvoiceCard key={inv.id} inv={inv} cab={cab} canManage={canManage} medok={medok} onPreview={setPreview} onChanged={reload} onEdit={setEditInv} compact />)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="tasks-dash">
            <span><b>{counts.issued || 0}</b> виставлено</span>
            <span><b>{counts.paid || 0}</b> оплачено</span>
            <span><b>{counts.shipped || 0}</b> відвантажено</span>
            {overdueCount > 0 && <span className="inv-dash-over"><b>{overdueCount}</b> прострочено</span>}
          </div>

          <div className="inv-toolbar">
            <div className="inv-search">
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: покупець, постачальник, № рахунку, позиція…" />
              {q && <button className="inv-search-clear" onClick={() => setQ("")}><X size={13} /></button>}
            </div>
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
          {ql && <p className="hint" style={{ margin: "-6px 0 10px" }}>Знайдено {shown.length} з {rowsQ.length}{rowsQ.length !== rows.length ? ` (усього ${rows.length})` : ""}.</p>}

          <div className="inv-filters">
            <button className={`inv-fchip inv-fchip-over ${filter === "overdue" ? "on" : ""} ${overdueCount > 0 && filter !== "overdue" ? "glow" : ""}`} onClick={() => setFilter("overdue")}>
              Прострочені{overdueCount > 0 ? ` · ${overdueCount}` : ""}
            </button>
            {[["open", "Активні"], ["all", "Усі"], ...INVOICE_FLOW.map((s) => [s, INVOICE_STATUS[s]]), ["archive", "Архів"]].map(([k, l]) => (
              <button key={k} className={`inv-fchip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          {filter === "overdue" && (
            <p className="hint" style={{ margin: "-4px 0 12px" }}>
              Виставлені 5+ днів тому й досі не опрацьовані (статус «Виставлено»).
              {cab.type === "sm" ? " Лише ваші рахунки." : " По всій території."}
            </p>
          )}

          {shown.length === 0 ? (
            <div className="admin-empty">Рахунків немає.</div>
          ) : (
            <div className="task-list">
              {shown.map((inv) => (
                <InvoiceCard key={inv.id} inv={inv} cab={cab} canManage={canManage} medok={medok} onPreview={setPreview} onChanged={reload} onEdit={setEditInv} />
              ))}
            </div>
          )}
        </>
      )}

      {showModal && <InvoiceCreateModal cab={cab} onClose={() => setShowModal(false)} onCreated={reload} />}
      {showManual && <InvoiceManualModal cab={cab} rows={allRows} onClose={() => setShowManual(false)} onCreated={() => { reload(); setView("docs"); }} />}
      {editInv && <InvoiceCreateModal cab={cab} inv={editInv} onClose={() => setEditInv(null)} onCreated={reload} />}
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

const shiftErr = (e) => {
  const m = String(e?.message || e || "");
  if (m.includes("schedule_locked")) return "Коригування графіка заблоковано адміністратором. Зверніться до Шаха, щоб розблокував.";
  // технічні помилки бази (constraint/relation/column) — не показуємо сирий SQL користувачу
  if (/violates .* constraint|relation ".*" (does not exist|violates)|column ".*" of relation/.test(m)) {
    return "Не вдалося зберегти через технічну помилку. Спробуйте ще раз — якщо повториться, повідомте Шаха.";
  }
  return m || "Помилка";
};

/* скорочена назва магазину для клітинки заміни: Гор, Мос, Тур, Лип, Щир, Шев, Кав, Ваш */
const salonCode = (sl) => {
  const name = sl.city === "Львів" ? shortAddr(sl.addr).split(",")[0].trim().split(/\s+/).pop() : sl.city;
  return name.slice(0, 3);
};

function ShiftCellMenu({ pos, field, current, homeSalon, onClose, onSet }) {
  const curHours = current ? current[field === "plan" ? "plan_h" : "fact_h"] : null;
  const isSubst = !!current && current.state === "work" && !!current.salon_key && current.salon_key !== homeSalon;
  const [hrs, setHrs] = useState(curHours != null && Number(curHours) !== 1 ? String(curHours) : "");
  const [dest, setDest] = useState(isSubst ? current.salon_key : "");
  const hoursNum = hrs !== "" && !Number.isNaN(Number(hrs)) ? Number(hrs) : undefined;
  const submitHours = () => { if (hoursNum != null) onSet({ type: "worked", hours: hoursNum, keepSalon: isSubst }); };
  const submitSubst = () => { if (dest) onSet({ type: "subst", salon: dest, hours: hoursNum }); };
  return createPortal(
    <>
      <div className="dtf-backdrop" onClick={onClose} />
      <div className="shift-menu" style={{ top: pos.top, left: pos.left }}>
        <div className="shift-swatches">
          <button className="sw-btn sw-black" onClick={() => onSet({ type: "worked" })}><i className="sw-ic sw-ic-black" />На зміні</button>
          <button className="sw-btn sw-amber" onClick={() => onSet({ type: "off" })}><i className="sw-ic sw-ic-amber" />Вихідний</button>
          <button className="sw-btn sw-red" onClick={() => onSet({ type: "absent" })}><i className="sw-ic sw-ic-red" />Відпустка</button>
          <button className="sw-btn sw-clear" onClick={() => onSet({ type: "clear" })}><i className="sw-ic sw-ic-clear" />Прибрати</button>
        </div>
        <div className="shift-menu-row shift-menu-hours">
          <input
            type="number" min="0" max="24" step="0.5" placeholder="год." value={hrs}
            onChange={(e) => setHrs(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitHours(); }}
          />
          <button disabled={hrs === ""} onClick={submitHours}>Вказати години</button>
        </div>
        <div className="shift-menu-row shift-menu-subst">
          <select value={dest} onChange={(e) => setDest(e.target.value)} aria-label="Заміна в магазині">
            <option value="">Заміна в іншому магазині…</option>
            {SALONS.filter((x) => x.key !== homeSalon).map((x) => <option key={x.key} value={x.key}>{salonLabel(x)}</option>)}
          </select>
          <button disabled={!dest} onClick={submitSubst}>Заміна</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* Таблиця «Факт»: лише співробітники свого магазину. Заміна в іншому магазині — синя клітинка зі скороченою
   назвою того магазину (без окремого рядка). Години бачить СМ магазину співробітника і ТМ. */
function ShiftTable({ field, ym, salons, employees, shifts, shiftMap, closedDays, canEditSalon, lockedFor, onChange, cabKey, today, seeAllHours, viewerSalon }) {
  const [menu, setMenu] = useState(null); // { empId, day, homeSalon, pos }
  const wrapRef = React.useRef(null);
  // рядок з числами липне під верхньою панеллю кабінету при прокрутці вниз
  useEffect(() => {
    const set = () => {
      const tb = document.querySelector(".topbar");
      wrapRef.current?.style.setProperty("--sched-top", `${tb ? tb.offsetHeight : 64}px`);
    };
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  const nDays = daysInMonth(ym);
  const modeAllowed = (k) => canEditSalon(k) && !(lockedFor && lockedFor(k));

  const openMenu = (e, empId, day, homeSalon) => {
    if (!modeAllowed(homeSalon)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const z = window.__uiZoom || 1; // фіксоване позиціювання рахується в масштабованих px
    setMenu({ empId, day, homeSalon, pos: { top: Math.min(r.bottom / z + 4, window.innerHeight / z - 250), left: Math.min(r.left / z, window.innerWidth / z - 220) } });
  };

  const applySet = async (action) => {
    const { empId, day, homeSalon } = menu;
    const wd = dayKey(ym, day);
    setMenu(null);
    const cur = shiftMap[`${empId}:${wd}`] || {};
    let row = { employee_id: empId, work_date: wd, salon_key: homeSalon, plan_h: cur.plan_h ?? null, fact_h: cur.fact_h ?? null, state: "work", absence_reason: cur.absence_reason || "", is_senior: cur.is_senior || false, updated_by: cabKey };
    const factOnly = field === "fact"; // у таблиці «Факт» план не чіпаємо (він може бути замкнений)
    if (action.type === "clear") {
      if (factOnly && cur.plan_h != null) {
        row.fact_h = null; row.state = "work"; row.absence_reason = "";
        await upsertShift(row).catch((e) => alert(shiftErr(e))); onChange(); return;
      }
      await deleteShift(empId, wd).catch(() => {}); onChange(); return;
    }
    if (action.type === "worked") {
      const h = action.hours != null && !Number.isNaN(action.hours) ? action.hours : 1;
      if (field === "plan") row.plan_h = h; else row.fact_h = h;
      row.state = "work"; row.absence_reason = "";
      if (action.keepSalon && cur.salon_key) row.salon_key = cur.salon_key; // години в клітинці заміни лишають її заміною
    } else if (action.type === "off") {
      row.state = "off"; row.fact_h = null; if (!factOnly) row.plan_h = null;
    } else if (action.type === "absent") {
      const reason = prompt("Причина (відпустка / лікарняний / відгул / прогул / навчання):", "відпустка") || "";
      const key = Object.entries(ABSENCE_REASONS).find(([, v]) => v.toLowerCase() === reason.trim().toLowerCase())?.[0] || "vacation";
      row.state = "absent"; row.absence_reason = key; row.fact_h = null;
    } else if (action.type === "subst") {
      row.salon_key = action.salon;
      const h = action.hours != null && !Number.isNaN(action.hours) ? action.hours : 1;
      if (field === "plan") row.plan_h = h; else row.fact_h = h;
      row.state = "work"; row.absence_reason = "";
    }
    try {
      await upsertShift(row);
      if (action.type === "subst") {
        const d = salonByKey(action.salon);
        pushToast({ title: "Заміну вказано", body: `${employees.find((x) => x.id === empId)?.full_name || ""} · ${d ? salonCode(d) : ""} · ${day}-го` });
      }
    } catch (e) { alert(shiftErr(e)); }
    onChange();
  };

  const cellInfo = (s, homeSalon, showH) => {
    if (!s) return { txt: "", cls: "" };
    if (s.state === "closed") return { txt: "", cls: "sh-closed", title: "Зачинено" };
    if (s.state === "off") return { txt: "", cls: "sh-off", title: "Вихідний" };
    if (s.state === "absent") {
      const label = ABSENCE_REASONS[s.absence_reason] || "Відсутність";
      return { txt: "", cls: s.absence_reason === "vacation" ? "sh-absent sh-vac" : "sh-absent", title: label };
    }
    const hVal = field === "plan" ? s.plan_h : s.fact_h;
    if (hVal == null) return { txt: "", cls: "" };
    const hNum = Number(hVal) !== 1 ? String(hVal).replace(/\.0$/, "") : "";
    if (s.salon_key !== homeSalon) {
      const dest = salonByKey(s.salon_key);
      return { txt: dest ? salonCode(dest) : "?", cls: "sh-subst", title: `Заміна: ${dest ? salonLabel(dest) : "?"}${hNum && showH ? ` · ${hNum} год` : ""}` };
    }
    return { txt: showH ? hNum : "", cls: field === "fact" ? "sh-fill" : "sh-fill-plan" };
  };

  // сума годин співробітника за місяць (1 = «відпрацював» без вказаних годин)
  const hoursOf = (empId) => {
    const h = shifts.reduce((a, sh) => (
      sh.employee_id === empId && sh.state === "work" && sh.fact_h != null && Number(sh.fact_h) !== 1 ? a + Number(sh.fact_h) : a
    ), 0);
    return Math.round(h * 10) / 10;
  };

  const groups = useMemo(() => salons.map((sl) => ({
    salon: sl,
    emps: employees.filter((e) => e.salon_key === sl.key && e.status === "active")
      .sort((a, b) => EMP_ROLE_ORDER.indexOf(a.role) - EMP_ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)),
  })), [salons, employees]);

  return (
    <div className="grid-scroll sched-wrap" ref={wrapRef}>
      <table className="sched">
        <thead>
          <tr>
            <th className="rh" />
            {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => (
              <th key={d} className={isWeekendDay(ym, d) ? "we" : ""}>
                {d}<br /><span className="wd">{WEEKDAYS_SHORT[shiftDow(ym, d)].toLowerCase()}</span>
              </th>
            ))}
            <th className="rh sh-sum-h">{field === "plan" ? "план" : "факт"}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ salon, emps }) => {
            const edit = modeAllowed(salon.key);
            const showH = seeAllHours || salon.key === viewerSalon;
            return (
              <React.Fragment key={salon.key}>
                <tr className="grp"><td colSpan={nDays + 2}>{salonLabel(salon)}</td></tr>
                {emps.length === 0 && <tr><td className="rh muted" colSpan={nDays + 2}>немає співробітників</td></tr>}
                {emps.map((e) => {
                  const t = monthTally(shifts, e.id, e.salon_key);
                  const hrs = showH ? hoursOf(e.id) : 0;
                  return (
                    <tr key={e.id}>
                      <td className="rh"><span className="nm">{e.full_name}</span></td>
                      {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
                        const wd = dayKey(ym, d);
                        let s = shiftMap[`${e.id}:${wd}`];
                        if (!s && closedDays[`${salon.key}:${wd}`]) s = { state: "closed" };
                        const { txt, cls, title } = cellInfo(s, salon.key, showH);
                        return (
                          <td key={d}
                            className={`sh ${cls} ${wd === today ? "sh-today" : ""} ${edit ? "sh-edit" : ""}`}
                            title={title || undefined}
                            onClick={edit ? (ev) => openMenu(ev, e.id, d, e.salon_key) : undefined}>
                            {txt}
                          </td>
                        );
                      })}
                      <td className="rh sh-sum">
                        {field === "plan"
                          ? <><b>{t.planDays}</b> дн{t.absentDays ? ` · відс. ${t.absentDays}` : ""}</>
                          : <><b>{t.factDays}</b> дн{hrs > 0 ? <> · <b>{String(hrs).replace(".", ",")}</b> год</> : ""}{t.substDays ? ` · зам. ${t.substDays}` : ""}{t.absentDays ? ` · відс. ${t.absentDays}` : ""}</>}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {menu && (
        <ShiftCellMenu
          pos={menu.pos} field={field} homeSalon={menu.homeSalon} onClose={() => setMenu(null)} onSet={applySet}
          current={shiftMap[`${menu.empId}:${dayKey(ym, menu.day)}`]}
        />
      )}
    </div>
  );
}

function ShiftGrid({ ym, salons, employees, shifts, storeDays, canEditSalon, onChange, cabKey, lockedFor, seeAllHours, viewerSalon }) {
  const today = todayISO();
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

  const tableProps = { ym, salons, employees, shifts, shiftMap, closedDays, canEditSalon, lockedFor, onChange, cabKey, today, seeAllHours, viewerSalon };

  return (
    <div className="shift-grid-wrap">
      <ShiftTable field="fact" {...tableProps} />

      <div className="shift-legend">
        <span><i className="sw sh-fill" />відпрацював (години)</span>
        <span><i className="sw sh-off" />вихідний</span>
        <span><i className="sw sh-vac" />відпустка</span>
        <span><i className="sw sh-subst" />заміна — скорочена назва магазину</span>
        <span><i className="sw sh-closed" />зачинено</span>
        <span><i className="sw sh-absent" />інша відсутність</span>
      </div>
    </div>
  );
}

/* ТМ-блок: усі невчасні відкриття магазинів у розрізі місяця */
function StoreOpeningLog({ cab }) {
  const [ym, setYm] = useState(nowYm());
  const [days, setDays] = useState(null);
  const months = useMemo(() => recentMonths(12), []);
  const my = cab.tmKey || cab.key;
  const scope = useMemo(() => (
    cab.type === "tm" ? SALONS.filter((s) => salonTmOn(s.key) === my) : SALONS
  ), [cab.type, my]);

  useEffect(() => {
    setDays(null);
    listStoreDays(ym).then(setDays).catch(() => setDays([]));
    return subscribeShifts(() => listStoreDays(ym).then(setDays).catch(() => {}));
  }, [ym]);

  if (days === null) return <div className="loading">Завантаження…</div>;
  const scopeKeys = new Set(scope.map((s) => s.key));
  const late = days
    .filter((d) => d.open_on_time === false && scopeKeys.has(d.salon_key))
    .sort((a, b) => (b.work_date || "").localeCompare(a.work_date || ""));
  const bySalon = {};
  late.forEach((d) => { bySalon[d.salon_key] = (bySalon[d.salon_key] || 0) + 1; });

  return (
    <div>
      <div className="tasks-head" style={{ marginBottom: 10 }}>
        <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <span className="hint">{late.length} невчасн{late.length === 1 ? "е відкриття" : "их відкриттів"} за {monthLabel(ym)}</span>
      </div>
      {Object.keys(bySalon).length > 0 && (
        <div className="open-tally">
          {scope.filter((s) => bySalon[s.key]).map((s) => (
            <span key={s.key} className="open-tally-chip">{s.city}, {shortAddr(s.addr)} — <b>{bySalon[s.key]}</b></span>
          ))}
        </div>
      )}
      {late.length === 0
        ? <p className="hint">За цей місяць невчасних відкриттів немає.</p>
        : (
          <table className="open-log">
            <thead><tr><th>Дата</th><th>Магазин</th><th>Відкрито</th><th>Причина</th></tr></thead>
            <tbody>
              {late.map((d) => (
                <tr key={`${d.salon_key}:${d.work_date}`}>
                  <td>{fmtDeadline(d.work_date)}</td>
                  <td>{salonByKey(d.salon_key)?.city}, {shortAddr(salonByKey(d.salon_key)?.addr || "")}</td>
                  <td className="open-log-t">{d.open_actual_time || "—"}</td>
                  <td>{d.late_reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

/* ТМ: аналіз замін — хто (зі свого магазину) куди й у які числа виходив на заміну */
function ShiftSubstAnalysis({ cab, ym, employees, shifts }) {
  const [mode, setMode] = useState("emp"); // emp — за співробітником | store — за магазином, куди виходили
  const [salonF, setSalonF] = useState("all");
  const my = cab.tmKey || cab.key;
  const scope = useMemo(() => new Set((cab.type === "tm" ? SALONS.filter((s) => salonTmOn(s.key) === my) : SALONS).map((s) => s.key)), [cab.type, my]);
  const empById = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);

  const recs = useMemo(() => shifts
    .filter((s) => s.state === "work" && s.fact_h != null)
    .map((s) => ({ s, e: empById[s.employee_id] }))
    .filter(({ s, e }) => e && e.salon_key !== s.salon_key && (scope.has(e.salon_key) || scope.has(s.salon_key)))
    .filter(({ s, e }) => salonF === "all" || e.salon_key === salonF || s.salon_key === salonF)
    .map(({ s, e }) => ({ emp: e, home: e.salon_key, dest: s.salon_key, day: Number(s.work_date.slice(8, 10)), h: Number(s.fact_h) !== 1 ? Number(s.fact_h) : 0 })),
  [shifts, empById, scope, salonF]);

  const rows = useMemo(() => {
    const m = {};
    recs.forEach((r) => {
      const k = mode === "emp" ? `${r.emp.id}|${r.dest}` : `${r.dest}|${r.emp.id}`;
      (m[k] ||= { emp: r.emp, home: r.home, dest: r.dest, days: [], hours: 0 });
      m[k].days.push(r.day); m[k].hours += r.h;
    });
    const nameOf = (r) => (mode === "emp" ? r.emp.full_name : salonLabel(salonByKey(r.dest) || {}));
    return Object.values(m).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "uk") || a.emp.full_name.localeCompare(b.emp.full_name, "uk"));
  }, [recs, mode]);

  const totalDays = recs.length;
  const totalEmps = new Set(recs.map((r) => r.emp.id)).size;
  const sname = (k) => { const sl = salonByKey(k); return sl ? salonLabel(sl) : k; };
  const dayList = (days) => [...days].sort((a, b) => a - b).join(", ");
  const fmtH = (h) => (h > 0 ? String(Math.round(h * 10) / 10).replace(".", ",") : "—");

  return (
    <div>
      <div className="inv-toolbar">
        <div className="trn-tabs">
          <button className={mode === "emp" ? "on" : ""} onClick={() => setMode("emp")}>За співробітником</button>
          <button className={mode === "store" ? "on" : ""} onClick={() => setMode("store")}>За магазином, куди виходили</button>
        </div>
        <select value={salonF} onChange={(e) => setSalonF(e.target.value)}>
          <option value="all">Усі магазини</option>
          {SALONS.filter((s) => scope.has(s.key)).map((s) => <option key={s.key} value={s.key}>{salonLabel(s)}</option>)}
        </select>
      </div>
      <p className="hint" style={{ margin: "6px 0 12px" }}>
        {totalDays === 0
          ? `За ${monthLabel(ym)} замін немає.`
          : `За ${monthLabel(ym)}: ${totalDays} ${totalDays === 1 ? "день заміни" : "днів замін"}, ${totalEmps} ${totalEmps === 1 ? "співробітник" : "співробітників"}.`}
      </p>
      {rows.length > 0 && (
        <div className="grid-scroll">
          <table className="open-log">
            <thead>
              <tr>
                {mode === "emp"
                  ? <><th>Співробітник (свій магазин)</th><th>Куди виходив на заміну</th></>
                  : <><th>Куди виходили</th><th>Хто (свій магазин)</th></>}
                <th>Числа</th><th>Днів</th><th>Годин</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.emp.id}|${r.dest}`}>
                  {mode === "emp"
                    ? <><td><b>{r.emp.full_name}</b><br /><span className="muted">{sname(r.home)}</span></td><td>{sname(r.dest)}</td></>
                    : <><td>{sname(r.dest)}</td><td><b>{r.emp.full_name}</b><br /><span className="muted">{sname(r.home)}</span></td></>}
                  <td className="open-log-t">{dayList(r.days)}</td>
                  <td className="open-log-t">{r.days.length}</td>
                  <td className="open-log-t">{fmtH(r.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ShiftScheduleModule({ cab }) {
  const [ym, setYm] = useState(nowYm());
  const [view, setView] = useState("grid");
  const [employees, setEmployees] = useState(null);
  const [shifts, storeDays, reload] = useShiftMonth(ym);
  const [locks, setLocks] = useState([]);
  const months = useMemo(() => recentMonths(12), []);

  useEffect(() => { listEmployees().then(setEmployees).catch(() => setEmployees([])); }, []);
  const reloadLocks = React.useCallback(() => { listScheduleLocks().then(setLocks).catch(() => setLocks([])); }, []);
  useEffect(() => { reloadLocks(); return subscribeScheduleLocks(reloadLocks); }, [reloadLocks]);

  // СМ за замовчуванням бачить лише свій магазин; кнопка «Переглянути графік території» розгортає всі.
  // ТМ і керівник бачать усі магазини. Години — лише СМ магазину, де їх внесли (ТМ і керівник — по всіх).
  const isSm = cab.type === "sm";
  const [territory, setTerritory] = useState(false);
  const seeAllHours = cab.type === "tm" || cab.type === "manager" || cab.key === ADMIN_KEY;
  const salons = useMemo(() => {
    if (!isSm) return SALONS;
    const mine = SALONS.filter((s) => s.key === cab.key);
    return territory ? [...mine, ...SALONS.filter((s) => s.key !== cab.key)] : mine;
  }, [isSm, territory, cab.key]);
  // редагувати графік свого магазину може лише сам СМ — ТМ і керівник тільки переглядають
  // і порівнюють план/факт (за проханням: «ніхто крім СМ не може редагувати свій графік»)
  const canEditSalon = useMemo(() => {
    if (cab.type === "sm") return (k) => k === cab.key;
    return () => false;
  }, [cab]);
  // замок стосується лише СМ (правки від його імені); ТМ/керівник не блокуються
  const lockedFor = React.useCallback((k) => cab.type === "sm" && scheduleLockedFor(locks, k), [locks, cab.type]);
  const myLocked = cab.type === "sm" && scheduleLockedFor(locks, cab.key);

  if (employees === null || shifts === null) return <div className="loading">Завантаження…</div>;

  const today = todayISO();
  const onShiftToday = shifts.filter((s) => s.work_date === today && s.state === "work" && s.fact_h != null);

  const showOpenings = cab.type === "tm" || cab.type === "manager";
  const showSubst = showOpenings || cab.key === ADMIN_KEY;

  return (
    <div className="tasks-mod">
      <div className="tasks-head">
        <h3 className="ov-h">Графік змін</h3>
        {showOpenings && (
          <div className="trn-tabs">
            <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}>Зміни</button>
            {showSubst && <button className={view === "subst" ? "on" : ""} onClick={() => setView("subst")}>Аналіз замін</button>}
            <button className={view === "openings" ? "on" : ""} onClick={() => setView("openings")}>Відкриття магазинів</button>
          </div>
        )}
        {(view === "grid" || view === "subst") && (
          <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        )}
        {view === "grid" && isSm && (
          <button className="btn-secondary small" onClick={() => setTerritory((v) => !v)}>
            {territory ? "Показати лише мій магазин" : "Переглянути графік території"}
          </button>
        )}
      </div>

      {view === "openings" && <StoreOpeningLog cab={cab} />}
      {view === "subst" && showSubst && <ShiftSubstAnalysis cab={cab} ym={ym} employees={employees} shifts={shifts} />}

      {view === "grid" && ym === nowYm() && (
        <div className="tasks-dash">
          {onShiftToday.length === 0
            ? <span className="tasks-dash-alert">Сьогодні ще ніхто не відмітив зміну</span>
            : <span><b>{onShiftToday.length}</b> на зміні сьогодні: {onShiftToday.map((s) => {
                const e = employees.find((x) => x.id === s.employee_id);
                return e ? `${e.full_name}${s.salon_key !== e.salon_key ? ` (${salonByKey(s.salon_key)?.city})` : ""}` : "";
              }).filter(Boolean).join(", ")}</span>}
        </div>
      )}

      {view === "grid" && myLocked && (
        <div className="shift-lock">
          <div className="shift-lock-h">🔒 Коригування графіка заблоковано</div>
          <p className="hint">Адміністратор закрив внесення й правки графіка для вашого магазину. Щоб внести зміни — зверніться до Шаха, щоб розблокував.</p>
        </div>
      )}

      {view === "grid" && (
        <ShiftGrid
          ym={ym} salons={salons} employees={employees} shifts={shifts} storeDays={storeDays}
          canEditSalon={canEditSalon} onChange={reload} cabKey={cab.key}
          lockedFor={lockedFor} seeAllHours={seeAllHours} viewerSalon={isSm ? cab.key : ""}
        />
      )}
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
  const [step, setStep] = useState("shift");   // shift | ontime | cash
  const [cashInfo, setCashInfo] = useState(null); // { total, days }
  const [lateMode, setLateMode] = useState(false);
  const [lateTime, setLateTime] = useState("");
  const [lateReason, setLateReason] = useState("");
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
      setStep("ontime");
      setBusy(false);
    } catch (e) { alert(shiftErr(e)); setBusy(false); }
  };
  // після кроку «вчасність відкриття» — питання про готівку, потім у програму
  const proceedToCash = async () => {
    try {
      const prior = await listCashDays({ salonKey: salon.key, to: cashYesterday() }).catch(() => []);
      const openPrior = prior.filter((r) => !r.collected);
      if (openPrior.length) {
        setCashInfo({ total: openPrior.reduce((a, r) => a + Number(r.amount), 0), days: openPrior.length });
        setStep("cash");
        setBusy(false);
      } else {
        onDone();
      }
    } catch { onDone(); }
  };
  const answerOnTime = async (onTime) => {
    if (!onTime && !lateMode) { setLateMode(true); return; }
    if (!onTime && (!lateTime || !lateReason.trim())) return;
    setBusy(true);
    try {
      await setStoreDay({
        salon_key: salon.key, work_date: today, opened_by: salon.key,
        open_on_time: onTime,
        open_actual_time: onTime ? null : lateTime,
        late_reason: onTime ? "" : lateReason.trim(),
      });
      if (!onTime) {
        const tm = salonTmOn(salon.key);
        if (tm) await notify({
          recipient: tm, kind: "shifts",
          title: `Невчасне відкриття — ${salon.city}, ${shortAddr(salon.addr)}`,
          body: `Відкрито о ${lateTime}. Причина: ${lateReason.trim()}`,
          actor: salon.key, link: "shifts",
        }).catch(() => {});
        pushToast({ title: "Відмічено невчасне відкриття", body: `ТМ повідомлено` });
      }
      await proceedToCash();
    } catch (e) { alert(shiftErr(e)); setBusy(false); }
  };
  const answerCash = async (taken) => {
    setBusy(true);
    try {
      if (taken) {
        const s = await cashHandover(salon.key, salon.key, "підтверджено на ранковому чек-іні");
        pushToast({ title: "Готівку відмічено як забрану", body: uah(s || cashInfo.total) });
      }
      onDone();
    } catch (e) { pushToast({ title: "Помилка", body: String(e.message || e) }); setBusy(false); }
  };
  const closeStore = async () => {
    setBusy(true);
    try {
      await setStoreDay({ salon_key: salon.key, work_date: today, opened_by: salon.key, closed: true, closed_reason: closeReason.trim() });
      onDone();
    } catch (e) { alert(shiftErr(e)); setBusy(false); }
  };

  if (step === "ontime") {
    return createPortal(
      <div className="modal-overlay checkin-overlay">
        <div className="checkin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="checkin-h">
            <div className="k">{lateMode ? "Невчасне відкриття" : "Відкриття магазину"}</div>
            <div className="d">{fmtDeadline(today)} · {salonLabel(salon)}</div>
          </div>
          {lateMode ? (
            <div className="checkin-b">
              <label className="over-field" style={{ maxWidth: "100%" }}><span>Фактичний час відкриття</span>
                <input type="time" value={lateTime} onChange={(e) => setLateTime(e.target.value)} autoFocus />
              </label>
              <label className="over-field" style={{ maxWidth: "100%" }}><span>Причина невчасного відкриття</span>
                <textarea rows={3} value={lateReason} onChange={(e) => setLateReason(e.target.value)} placeholder="напр. не приїхав транспорт, форс-мажор" />
              </label>
            </div>
          ) : (
            <div className="checkin-b ci-cash">
              <span className="ci-cash-ic"><Clock size={26} /></span>
              <p>Чи вчасно був відкритий магазин сьогодні?</p>
              <p className="hint">Якщо ні — вкажемо фактичний час і причину, це піде ТМ.</p>
            </div>
          )}
          <div className="checkin-f">
            {lateMode
              ? <><button className="btn-secondary" disabled={busy} onClick={() => setLateMode(false)}>Назад</button>
                  <button className="btn-primary" disabled={busy || !lateTime || !lateReason.trim()} onClick={() => answerOnTime(false)}>Надіслати ТМ</button></>
              : <><button className="btn-secondary" disabled={busy} onClick={() => answerOnTime(false)}>Ні, із запізненням</button>
                  <button className="btn-primary" disabled={busy} onClick={() => answerOnTime(true)}>Так, вчасно</button></>}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

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
        const factPct = plan[mt.key] ? Math.round((sum[mt.key] / plan[mt.key]) * 100) : null;
        const restPct = factPct != null ? Math.max(0, 100 - factPct) : null;
        const tone = factPct == null ? "" : factPct >= 100 ? "good" : factPct >= 90 ? "warn" : "bad";
        return (
          <div className="tm-strip-tile" key={mt.key}>
            <span className="tm-strip-lab">{mt.label}</span>
            <b>{tmMoney(sum[mt.key])}{mt.money ? " ₴" : ""}</b>
            <span className="tm-strip-sub">
              план міс. {tmMoney(plan[mt.key])}
              {factPct != null && <em className={`tm-pct ${tone}`}> · факт {factPct}% · залишок {restPct}%</em>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TerritoryAllSalons({ salons, rows, activeKey, onPick, plans, withEz, daysPassed, dim }) {
  const pace = dim > 0 ? Math.min(Math.max(daysPassed, 0), dim) / dim : 0;
  return (
    <div className="tm-all">
      <table className="tm-all-tbl">
        <thead>
          <tr><th>Салон</th><th>Оборот{withEz ? " (з ЕЗ)" : ""}, міс.</th><th>План</th><th>%</th><th title="відхилення від норми на поточний день">Темп</th><th>Днів</th></tr>
        </thead>
        <tbody>
          {salons.map((s) => {
            const { sum, daysBySalon } = monthAgg(rows, [s.key]);
            const done = sum.assort + (withEz ? sum.ez : 0);
            const plan = planTurnover(planOf(plans, s.key), withEz);
            const pct = plan ? Math.round((done / plan) * 100) : null;
            const normToDate = plan * pace;
            // відхилення у процентних пунктах від плану: (факт% плану) − (норма% плану на сьогодні)
            const devPct = plan > 0 ? ((done - normToDate) / plan) * 100 : null;
            const devRound = devPct == null ? null : Math.round(devPct);
            return (
              <tr key={s.key} className={s.key === activeKey ? "active" : ""} onClick={() => onPick(s.key)}>
                <td>{s.city}, {shortAddr(s.addr)}</td>
                <td className="num">{tmMoney(done)} ₴</td>
                <td className="num muted">{tmMoney(plan)}</td>
                <td className="num">{pct == null ? "—" : `${pct}%`}</td>
                <td className={`num dev ${devRound == null ? "" : devRound >= 0 ? "pos" : "neg"}`}>
                  {devRound == null ? "—" : `${devRound > 0 ? "+" : ""}${devRound}%`}
                </td>
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
    catch (e) { pushToast({ title: "Показник не збережено", body: String(e.message || e) }); }
  };
  const reset = async (day) => {
    const d = dateOf(ym, day);
    onPatched(salonKey, d, null);
    try { await resetManual(salonKey, d); } catch (e) { pushToast({ title: "Не вдалося скинути", body: String(e.message || e) }); }
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
  // показники лише читаються — тягнуться з планера, ніхто їх не редагує
  const scopeSalons = cab.type === "tm" || cab.type === "manager"
    ? SALONS
    : (cab.type === "sm" ? [salonByKey(cab.key)].filter(Boolean) : SALONS);
  const editable = false;
  const [withEz] = useWithEz();
  const months = useMemo(() => recentMonths(15), []);
  const [ym, setYm] = useState(nowYm());
  const [rowsMap, setRowsMap] = useState(new Map());
  const [plans, setPlans] = useState(SALON_MONTH_PLAN);
  const [loading, setLoading] = useState(true);
  const [salonKey, setSalonKey] = useState(() => {
    if (_focusSalon && scopeSalons.some((s) => s.key === _focusSalon)) { const f = _focusSalon; _focusSalon = null; return f; }
    return scopeSalons[0]?.key || null;
  });
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  const reload = async () => {
    const list = await listMetrics(ym).catch(() => []);
    const m = new Map();
    for (const r of list) m.set(rowKey(r.salon_key, r.work_date), r);
    setRowsMap(m);
    setLoading(false);
  };
  useEffect(() => { listPlans().then(setPlans).catch(() => {}); }, []);
  useEffect(() => { setLoading(true); reload(); /* eslint-disable-next-line */ }, [ym]);
  useEffect(() => subscribeMetrics(() => { reload(); listPlans().then(setPlans).catch(() => {}); }), [ym]); // eslint-disable-line

  const patchLocal = () => {};

  const runSync = async () => {
    setSyncing(true); setSyncNote("");
    try {
      const r = await syncFromPlanner([ym]);
      setSyncNote(`оновлено рядків: ${r?.rows ?? 0}`);
      await reload();
      pushToast({ title: "Синхронізовано з планера", body: `оновлено рядків: ${r?.rows ?? 0}` });
    } catch (e) {
      setSyncNote(`помилка: ${e.message || e}`);
      pushToast({ title: "Помилка синхронізації", body: String(e.message || e) });
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
        <h3 className="ov-h">Показники{scopeSalons.length === 1 ? ` · ${salonShortName(scopeSalons[0])}` : " території"}{withEz ? " · з ЕЗ" : ""}</h3>
        <div className="tm-head-actions">
          <EzToggle />
          <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button type="button" className="planner-btn" onClick={runSync} disabled={syncing}>
            <RefreshCw size={13} /> {syncing ? "Оновлення…" : "Оновити з планера"}
          </button>
        </div>
      </div>
      {syncNote && <p className="tm-sync-note">{syncNote}</p>}

      {loading ? <div className="loading">Завантаження…</div> : (
        <>
          <TerritorySummaryStrip salonKeys={scopeKeys} rows={rowsArr} daysPassed={daysPassed} dim={dim} plans={plans} />

          {scopeSalons.length > 1 && (
            <TerritoryAllSalons salons={scopeSalons} rows={rowsArr} activeKey={activeSalon} onPick={setSalonKey} plans={plans} withEz={withEz} daysPassed={daysPassed} dim={dim} />
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
                <span className="muted"> · дані з планера, лише перегляд</span>
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
    try { await setCashDay(salonKey, todayISO(), val, cab.key); pushToast({ title: "Готівку за день збережено", body: uah(Number(val) || 0) }); }
    catch (e) { pushToast({ title: "Не вдалося зберегти", body: String(e.message || e) }); }
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

/* ==================== ОБОРОТ САЛОНІВ — кільцевий дашборд ==================== */
const uahK = (n) => {
  n = Math.round(n || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + " млн";
  if (n >= 1000) return (n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "") + "к";
  return String(n);
};
const turnoverBand = (pct) => (pct < 50 ? "lo" : pct < 80 ? "mid" : pct <= 105 ? "ok" : "over");
const salonShortName = (s) => (s.city === "Львів" ? shortAddr(s.addr).split(",")[0] : s.city);

/* ---- «з ЕЗ / без ЕЗ» — спільний перемикач для всієї аналітики ---- */
const EZ_KEY = "dnipro-m-with-ez";
const ezBus = typeof window !== "undefined" ? new EventTarget() : null;
const getWithEz = () => { try { return localStorage.getItem(EZ_KEY) === "1"; } catch { return false; } };
const setWithEzGlobal = (v) => { try { localStorage.setItem(EZ_KEY, v ? "1" : "0"); } catch { /* */ } ezBus?.dispatchEvent(new Event("c")); };
function useWithEz() {
  const [v, setV] = useState(getWithEz);
  useEffect(() => {
    const h = () => setV(getWithEz());
    ezBus?.addEventListener("c", h);
    return () => ezBus?.removeEventListener("c", h);
  }, []);
  return [v, setWithEzGlobal];
}
/* оборот рядка з урахуванням прапорця ЕЗ */
const turnoverVal = (e, withEz) => (Number(e?.assort) || 0) + (withEz ? (Number(e?.ez) || 0) : 0);
const planTurnover = (p, withEz) => (Number(p?.assort) || 0) + (withEz ? (Number(p?.ez) || 0) : 0);

/* клік по салону з дашборду → сторінка «Показники» саме цього салону */
let _focusSalon = null;
function openSalonAnalytics(salonKey) { _focusSalon = salonKey; goToModule("kpi"); }

/* перехід зі сповіщення прямо на конкретну задачу (не лише на вкладку) */
let _focusTaskId = null;
function takeFocusTaskId() { const id = _focusTaskId; _focusTaskId = null; return id; }

function EzToggle() {
  const [withEz, setWithEz] = useWithEz();
  return (
    <label className="ez-toggle" title="Враховувати ТО ЕЗ в усіх показниках">
      <input type="checkbox" checked={withEz} onChange={(e) => setWithEz(e.target.checked)} />
      <span>з ЕЗ</span>
    </label>
  );
}

/* Кільце — розмір задає CSS (ширина комірки), SVG масштабується через viewBox */
function Ring({ pct, band, size = 82, sw = 7, children }) {
  const VB = 100; // внутрішня система координат
  const r = (VB - (sw / size) * VB) / 2;
  const C = 2 * Math.PI * r;
  const off = C * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  const strokeW = (sw / size) * VB;
  return (
    <div className="rg-ring" style={{ "--rg-max": `${size}px` }}>
      <svg viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid meet">
        <circle className="rg-track" cx={VB / 2} cy={VB / 2} r={r} strokeWidth={strokeW} fill="none" />
        <circle
          className={`rg-prog ${turnoverBand(band == null ? pct : band)}`} cx={VB / 2} cy={VB / 2} r={r} strokeWidth={strokeW} fill="none"
          strokeLinecap="round" transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
          strokeDasharray={C.toFixed(2)} strokeDashoffset={off.toFixed(2)}
        />
      </svg>
      <div className="rg-center">{children}</div>
    </div>
  );
}

function TurnoverRings({ scopeSalons, single: singleProp, onDayDrill }) {
  const salons = scopeSalons && scopeSalons.length ? scopeSalons : SALONS;
  const single = !!singleProp || salons.length === 1;
  const ym = nowYm();
  const today = todayISO();
  const dim = daysInYm(ym);
  const [withEz] = useWithEz();
  const [rows, setRows] = useState(null);
  const [plans, setPlans] = useState(SALON_MONTH_PLAN);
  const [mode, setMode] = useState("today"); // today | month | range
  const [rFrom, setRFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); });
  const [rTo, setRTo] = useState(today);
  const [syncing, setSyncing] = useState(false);

  const reload = () => {
    const p = mode === "range" && rFrom && rTo && rFrom <= rTo
      ? listMetricsRange(rFrom, rTo)
      : listMetrics(ym);
    p.then(setRows).catch(() => setRows([]));
    listPlans().then(setPlans).catch(() => {});
  };
  useEffect(() => {
    reload();
    return subscribeMetrics(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, mode, rFrom, rTo]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await syncFromPlanner([ym]);
      pushToast({ title: "Оновлено з планера", body: `рядків: ${r?.rows ?? 0}` });
      reload();
    } catch (e) {
      pushToast({ title: "Помилка синхронізації", body: String(e.message || e) });
    }
    setSyncing(false);
  };

  if (rows === null) return <div className="loading">Завантаження…</div>;

  const dayCount = Math.min(new Date().getDate(), dim);
  const rangeDays = mode === "range" ? daysBetween(rFrom, rTo) : 0;
  const normMult = mode === "today" ? 1 : mode === "month" ? dayCount : rangeDays;

  const byKey = {};
  for (const r of rows) {
    const v = turnoverVal(effective(r), withEz);
    const b = (byKey[r.salon_key] = byKey[r.salon_key] || { today: 0, sum: 0 });
    if (r.work_date === today) b.today = v;
    b.sum += v;
  }
  const valOf = (k) => (mode === "today" ? byKey[k]?.today || 0 : byKey[k]?.sum || 0);
  const monthPlanOf = (k) => planTurnover(planOf(plans, k), withEz);
  const dailyNorm = (k) => monthPlanOf(k) / dim;
  const normOf = (k) => dailyNorm(k) * normMult; // норма за обраний період (для темпу/кольору)
  // знаменник для ВІДОБРАЖЕНОГО %: місяць → місячний план СМ; день/період → закриття норми
  const refOf = (k) => (mode === "month" ? monthPlanOf(k) : normOf(k));

  const cells = salons
    .map((s) => {
      const v = valOf(s.key);
      const n = normOf(s.key);
      const ref = refOf(s.key);
      return { s, v, n, pct: ref ? (v / ref) * 100 : 0, bandPct: n ? (v / n) * 100 : 0 };
    })
    .sort((a, b) => a.pct - b.pct);

  const totV = cells.reduce((a, c) => a + c.v, 0);
  const totN = cells.reduce((a, c) => a + c.n, 0);
  const totRef = cells.reduce((a, c) => a + refOf(c.s.key), 0);
  const totPct = totRef ? (totV / totRef) * 100 : 0;
  const totBand = totN ? (totV / totN) * 100 : 0;

  const heroLab = mode === "today" ? "сьогодні"
    : mode === "month" ? "з початку місяця"
    : `${fmtDate(rFrom).split(",")[0]} – ${fmtDate(rTo).split(",")[0]}`;

  const terrDefs = single
    ? [{ label: salonShortName(salons[0]), keys: [salons[0].key] }]
    : [
        { label: "Територія · місто", keys: SALONS.filter((s) => s.area === "місто").map((s) => s.key) },
        { label: "Територія · область", keys: SALONS.filter((s) => s.area === "область").map((s) => s.key) },
      ];
  const territories = terrDefs.map((t) => {
    const keys = t.keys;
    const done = keys.reduce((a, k) => a + valOf(k), 0);
    const monthPlan = keys.reduce((a, k) => a + planTurnover(planOf(plans, k), withEz), 0);
    const norm = keys.reduce((a, k) => a + normOf(k), 0); // сьогодні: денна норма · місяць: денна×минуло · період: денна×днів
    const normToDatePct = dim ? (dayCount / dim) * 100 : 0;
    // за що порівнюємо: місяць — з місячним планом, інакше — з нормою за обраний період
    const ref = mode === "month" ? monthPlan : norm;
    return {
      ...t, done, monthPlan, norm, normToDatePct,
      donePct: ref ? (done / ref) * 100 : null,
      bandPct: norm ? (done / norm) * 100 : 0, // темп — для кольору
      markPct: mode === "month" ? normToDatePct : 100,
      gap: done - norm,
      gapPct: norm ? ((done - norm) / norm) * 100 : 0,
      remain: mode === "month" ? Math.max(0, monthPlan - done) : null,
    };
  });

  const gapWhen = mode === "today" ? "сьогодні" : mode === "range" ? "за період" : "на сьогодні";
  const planLab = mode === "month" ? "План на місяць" : mode === "range" ? "Норма за період" : "Норма на сьогодні";
  const doneLab = mode === "today" ? "Оборот сьогодні" : mode === "range" ? "Оборот за період" : "Оборот за місяць";

  return (
    <div className="rg-mod">
      <div className="rg-head">
        <h3 className="ov-h">Оборот {single ? "магазину" : "салонів"}{withEz ? " · з ЕЗ" : ""}</h3>
        <div className="rg-head-r">
          <EzToggle />
          <div className="rg-toggle">
            <button className={mode === "today" ? "on" : ""} onClick={() => setMode("today")}>Сьогодні</button>
            <button className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>Місяць</button>
            <button className={mode === "range" ? "on" : ""} onClick={() => setMode("range")}>Період</button>
          </div>
          {!single && (
            <button className={`rg-refresh ${syncing ? "spin" : ""}`} onClick={runSync} disabled={syncing} title="Підтягнути свіжі цифри з планера">
              <RefreshCw size={14} /><span>{syncing ? "Оновлення…" : "Оновити"}</span>
            </button>
          )}
        </div>
      </div>

      {mode === "range" && (
        <div className="rg-range">
          <label>з <input type="date" value={rFrom} max={rTo} onChange={(e) => setRFrom(e.target.value)} /></label>
          <label>по <input type="date" value={rTo} min={rFrom} max={today} onChange={(e) => setRTo(e.target.value)} /></label>
          <span className="rg-range-n">{rangeDays} {plural(rangeDays, "день", "дні", "днів")}</span>
        </div>
      )}

      <div className="rg-hero">
        <div className="rg-hero-top">
          <div className="rg-hero-meta">
            <div className="rg-hero-val">{fmt(totV)}</div>
            <div className="rg-hero-lab">оборот {single ? "магазину" : "мережі"} · {heroLab}</div>
          </div>
          <div className={`rg-hero-pct ${turnoverBand(totBand)}`}>{totPct.toFixed(1)}%</div>
        </div>
        <div className="rg-terr-bar rg-hero-bar">
          <div className={`rg-terr-fill ${turnoverBand(totBand)}`} style={{ width: `${Math.min(100, Math.max(0, totPct))}%` }} />
        </div>
        <div className="rg-hero-norm">{mode === "month" ? "План на місяць" : "Норма"}: <b>{fmt(mode === "month" ? totRef : totN)}</b></div>
      </div>

      <div className="rg-terr">
        {territories.map((x) => (
          <div className="rg-terr-card" key={x.label}>
            <div className="rg-terr-h">{x.label}{x.donePct != null && <span className={`rg-terr-done ${turnoverBand(x.bandPct)}`}>{Math.round(x.donePct)}% {mode === "month" ? "плану" : "норми"}</span>}</div>
            {x.donePct != null && (
              <div className="rg-terr-bar">
                <div className={`rg-terr-fill ${turnoverBand(x.bandPct)}`} style={{ width: `${Math.min(100, Math.max(0, x.donePct))}%` }} />
                <span className="rg-terr-mark" style={{ left: `${Math.min(100, x.markPct)}%` }} title={mode === "month" ? `норма на сьогодні: ${Math.round(x.normToDatePct)}% плану` : "норма за обраний період"} />
              </div>
            )}
            <div className="rg-terr-rows">
              <div><span>{planLab}</span><b>{fmt(mode === "month" ? x.monthPlan : x.norm)}</b></div>
              <div><span>{doneLab}</span><b>{fmt(x.done)}</b></div>
              <div>
                <span>{x.gap < 0 ? `Відставання від норми ${gapWhen}` : `Випередження норми ${gapWhen}`}</span>
                <b className={x.gap < 0 ? "neg" : "pos"}>{x.gap < 0 ? "−" : "+"}{fmt(Math.abs(x.gap))} · {Math.abs(Math.round(x.gapPct))}%</b>
              </div>
              {x.remain != null && <div><span>Залишок до закриття плану</span><b>{fmt(x.remain)}</b></div>}
            </div>
          </div>
        ))}
      </div>

      {!single && (
        <div className="rg-grid">
          {cells.map(({ s, v, pct, bandPct }) => (
            <button key={s.key} className="rg-cell" onClick={() => (onDayDrill ? onDayDrill(s) : openSalonAnalytics(s.key))} title={`${salonLabel(s)} — ${onDayDrill ? "звіт за день" : "відкрити аналітику"}`}>
              <Ring pct={pct} band={bandPct}>
                <b>{uahK(v)}</b>
              </Ring>
              <span className="rg-nm">{salonShortName(s)}</span>
              <span className={`rg-pct ${turnoverBand(bandPct)}`}>{Math.round(pct)}%</span>
            </button>
          ))}
        </div>
      )}
      <p className="rg-note">
        {mode === "month"
          ? `Число — % виконання місячного плану СМ. Колір — темп (чи встигає за нормою на сьогодні).`
          : `Кільце — оборот проти денної норми (план${withEz ? " з ЕЗ" : ""} ÷ ${dim}).`}
        {single ? "" : onDayDrill ? " Клік по салону — звіт за день (планер)." : " Клік по салону — його аналітика."}
      </p>
    </div>
  );
}

/* ---- Некликабельні кільця: оборот усіх магазинів лише за сьогодні ---- */
function AllSalonsRingsToday({ highlight }) {
  const [withEz] = useWithEz();
  const ym = nowYm();
  const today = todayISO();
  const dim = daysInYm(ym);
  const [rows, setRows] = useState(null);
  const [plans, setPlans] = useState(SALON_MONTH_PLAN);
  useEffect(() => {
    const reload = () => {
      listMetrics(ym).then(setRows).catch(() => setRows([]));
      listPlans().then(setPlans).catch(() => {});
    };
    reload();
    return subscribeMetrics(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym]);
  if (rows === null) return null;

  const byToday = {};
  for (const r of rows) if (r.work_date === today) byToday[r.salon_key] = turnoverVal(effective(r), withEz);
  const cells = SALONS.map((s) => {
    const v = byToday[s.key] || 0;
    const n = planTurnover(planOf(plans, s.key), withEz) / dim;
    return { s, v, pct: n ? (v / n) * 100 : 0 };
  }).sort((a, b) => b.v - a.v);
  const totV = cells.reduce((a, c) => a + c.v, 0);

  return (
    <div className="rg-mod">
      <div className="rg-head">
        <h3 className="ov-h">Усі магазини · сьогодні{withEz ? " · з ЕЗ" : ""}</h3>
        <span className="rg-allsum">разом {fmt(totV)}</span>
      </div>
      <div className="rg-grid">
        {cells.map(({ s, v, pct }) => (
          <div key={s.key} className={`rg-cell rg-cell-static ${s.key === highlight ? "rg-cell-me" : ""}`}>
            <Ring pct={pct}><b>{uahK(v)}</b></Ring>
            <span className="rg-nm">{salonShortName(s)}</span>
            <span className={`rg-pct ${turnoverBand(pct)}`}>{Math.round(pct)}%</span>
          </div>
        ))}
      </div>
      <p className="rg-note">Оборот кожного магазину проти денної норми — лише за сьогодні.</p>
    </div>
  );
}

/* ---- Продажі день-у-день: лінійний графік + фільтр магазинів + порівняння періодів ---- */
const isoDate = (d) => d.toISOString().slice(0, 10);
function SalesTrendChart({ scopeSalons }) {
  const salons = scopeSalons && scopeSalons.length ? scopeSalons : SALONS;
  const [withEz] = useWithEz();
  const today = todayISO();
  const [aFrom, setAFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 13); return isoDate(d); });
  const [aTo, setATo] = useState(today);
  const [cmp, setCmp] = useState(false);
  const [bFrom, setBFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 27); return isoDate(d); });
  const [bTo, setBTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return isoDate(d); });
  const [pick, setPick] = useState([]); // порожньо = усі салони в scope
  const [rows, setRows] = useState(null);

  const minFrom = cmp ? (aFrom < bFrom ? aFrom : bFrom) : aFrom;
  const maxTo = cmp ? (aTo > bTo ? aTo : bTo) : aTo;
  useEffect(() => {
    listMetricsRange(minFrom, maxTo).then(setRows).catch(() => setRows([]));
    return subscribeMetrics(() => listMetricsRange(minFrom, maxTo).then(setRows).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minFrom, maxTo]);

  if (rows === null) return <div className="chart-wrap"><div className="loading">Завантаження…</div></div>;

  const scopeKeys = new Set(salons.map((s) => s.key));
  const activeKeys = pick.length ? new Set(pick) : scopeKeys;
  const dayMap = {}; // "YYYY-MM-DD" -> сума обороту по обраних салонах
  for (const r of rows) {
    if (!activeKeys.has(r.salon_key)) continue;
    dayMap[r.work_date] = (dayMap[r.work_date] || 0) + turnoverVal(effective(r), withEz);
  }
  const seq = (from, to) => {
    const out = [];
    const d = new Date(from);
    const end = new Date(to);
    while (d <= end) { out.push(isoDate(d)); d.setDate(d.getDate() + 1); }
    return out;
  };
  const aDates = seq(aFrom, aTo);
  const bDates = cmp ? seq(bFrom, bTo) : [];
  const len = Math.max(aDates.length, bDates.length);
  const data = Array.from({ length: len }, (_, i) => ({
    i: i + 1,
    aLbl: aDates[i] ? fmtDate(aDates[i]).split(",")[0] : "",
    a: aDates[i] ? Math.round(dayMap[aDates[i]] || 0) : null,
    b: cmp && bDates[i] ? Math.round(dayMap[bDates[i]] || 0) : null,
  }));
  const aSum = aDates.reduce((s, d) => s + (dayMap[d] || 0), 0);
  const bSum = bDates.reduce((s, d) => s + (dayMap[d] || 0), 0);

  return (
    <div className="chart-wrap trend-wrap">
      <div className="trend-head">
        <div className="ov-card-h">Продажі день-у-день{withEz ? " · з ЕЗ" : ""}</div>
        <label className="ez-toggle"><input type="checkbox" checked={cmp} onChange={(e) => setCmp(e.target.checked)} /><span>порівняти періоди</span></label>
      </div>

      <div className="trend-filters">
        <div className="trend-dates">
          <span className="trend-dot a" />
          <input type="date" value={aFrom} max={aTo} onChange={(e) => setAFrom(e.target.value)} />
          <input type="date" value={aTo} min={aFrom} max={today} onChange={(e) => setATo(e.target.value)} />
          <b>{fmt(aSum)}</b>
        </div>
        {cmp && (
          <div className="trend-dates">
            <span className="trend-dot b" />
            <input type="date" value={bFrom} max={bTo} onChange={(e) => setBFrom(e.target.value)} />
            <input type="date" value={bTo} min={bFrom} max={today} onChange={(e) => setBTo(e.target.value)} />
            <b>{fmt(bSum)} {bSum ? <span className={aSum >= bSum ? "pos" : "neg"}>({aSum >= bSum ? "+" : ""}{fmt(aSum - bSum)})</span> : null}</b>
          </div>
        )}
      </div>

      {salons.length > 1 && (
        <div className="trend-salons">
          <button className={`chip ${pick.length === 0 ? "active" : ""}`} onClick={() => setPick([])}>Усі</button>
          {salons.map((s) => (
            <button key={s.key} className={`chip ${pick.includes(s.key) ? "active" : ""}`}
              onClick={() => setPick((p) => p.includes(s.key) ? p.filter((k) => k !== s.key) : [...p, s.key])}>
              {salonShortName(s)}
            </button>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" stroke="var(--line)" vertical={false} />
          <XAxis dataKey={cmp ? "i" : "aLbl"} tick={{ fontSize: 10, fill: "var(--muted)" }} tickMargin={8} axisLine={{ stroke: "var(--line)" }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} axisLine={false} tickLine={false} width={38} />
          <Tooltip formatter={(v, n) => [fmt(v), n === "a" ? "Період A" : "Період B"]}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
          {cmp && <Line type="monotone" dataKey="b" name="b" stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 4" dot={false} />}
          <Line type="monotone" dataKey="a" name="a" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 2.5, fill: "var(--gold)" }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Віктор — головний екран: оборот салонів + теплова сітка готівки */
/* «Потребує уваги» — черга дій з різних модулів на головному екрані */
function AttentionQueue({ cab }) {
  const [rows, setRows] = useState(null);
  const invKey = cab.type === "sm" || cab.type === "tm" ? "bn" : "inv";
  useEffect(() => {
    let a = true;
    (async () => {
      const out = [];
      try {
        const inv = await listInvoices();
        const od = inv.filter(isInvOverdue);
        if (od.length) out.push({ tone: "crit", n: od.length, label: "прострочені рахунки", sub: "виставлені 5+ днів тому", go: invKey });
      } catch { /* ignore */ }
      if (cab.type === "tm" || cab.type === "manager" || cab.type === "accountant" || cab.key === "olha") {
        try {
          const [its, st] = await Promise.all([listItems(), listStock(CENTRAL)]);
          const sm = stockMap(st, CENTRAL);
          const low = its.filter((i) => i.min_central > 0 && (sm[i.id] || 0) < i.min_central);
          if (low.length) out.push({ tone: "warn", n: low.length, label: "позицій нижче мінімуму на складі", sub: low.slice(0, 3).map((i) => i.name).join(", "), go: "warehouse" });
        } catch { /* ignore */ }
      }
      try {
        const tasks = await listTasks();
        const open = tasks.filter((t) => t.assignee === cab.key && t.status === "open");
        if (open.length) out.push({ tone: "info", n: open.length, label: open.length === 1 ? "відкрита задача" : "відкриті задачі", go: "tasks" });
      } catch { /* ignore */ }
      if (cab.type === "tm" || cab.type === "manager") {
        try {
          const my = cab.tmKey || cab.key;
          const mine = (cab.type === "manager" ? SALONS : SALONS.filter((s) => salonTmOn(s.key) === my)).map((s) => s.key);
          const cur = nowYm();
          const [yy, mm] = cur.split("-").map(Number);
          const prev = mm === 1 ? `${yy - 1}-12` : `${yy}-${String(mm - 1).padStart(2, "0")}`;
          const [a1, a2] = await Promise.all([listShifts(prev), listShifts(cur)]);
          const gaps = planFactGaps([...a1, ...a2], mine);
          if (gaps.length) {
            const bySalon = [...new Set(gaps.map((g) => g.salon_key))].map((k) => salonByKey(k)?.city).filter(Boolean);
            out.push({ tone: "warn", n: gaps.length, label: "розбіжностей план/факт у графіку", sub: bySalon.slice(0, 4).join(", "), go: "shifts" });
          }
          const sd = await listStoreDays(cur);
          const lateOpen = sd.filter((d) => d.open_on_time === false && mine.includes(d.salon_key));
          if (lateOpen.length) out.push({ tone: "warn", n: lateOpen.length, label: "невчасних відкриттів магазинів цього місяця", sub: [...new Set(lateOpen.map((d) => salonByKey(d.salon_key)?.city))].filter(Boolean).join(", "), go: "shifts" });
        } catch { /* ignore */ }
      }
      if (a) setRows(out);
    })();
    return () => { a = false; };
  }, [cab.key]);
  if (rows === null || rows.length === 0) return null;
  return (
    <div className="attn">
      <h4 className="attn-h">Потребує уваги</h4>
      <div className="attn-rows">
        {rows.map((r, i) => (
          <button key={i} className={`attn-row ${r.tone}`} onClick={() => r.go && goToModule(r.go)}>
            <span className="attn-n">{r.n}</span>
            <span className="attn-lead"><b>{r.label}</b>{r.sub && <em>{r.sub}</em>}</span>
            <span className="attn-go">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Денний звіт СМ — те саме, що бачить СМ у зовнішньому планері
   («Введення для СМ по контрольних точках дня»): чек-пойнти 12/15/18/20
   з накопиченими показниками. Дані читаються напряму з планера. */
function PlannerDayModal({ salon, onClose }) {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setErr(""); setData(null);
    fetchPlannerDay(salon.key, date)
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch((e) => { if (active) { setErr(String(e.message || e)); setLoading(false); } });
    return () => { active = false; };
  }, [salon.key, date]);

  const shiftDay = (delta) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };
  const isToday = date === todayISO();

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="pday-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pday-h">
          <span>{salonLabel(salon)} · звіт за день</span>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pday-nav">
          <button className="btn-secondary small" onClick={() => shiftDay(-1)}>‹ день</button>
          <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn-secondary small" onClick={() => shiftDay(1)} disabled={isToday}>день ›</button>
          <button className="btn-secondary small" disabled={isToday} onClick={() => setDate(todayISO())}>Сьогодні</button>
        </div>

        {loading && <div className="loading">Завантаження…</div>}
        {!loading && err && <p className="hint" style={{ color: "var(--negative-bright)" }}>{err}</p>}
        {!loading && !err && !data && <p className="hint">За {fmtDeadline(date)} даних у планері немає.</p>}
        {!loading && !err && data && (
          <>
            <div className="pday-tbl-wrap">
              <table className="pday-tbl">
                <thead>
                  <tr><th>Час</th><th>ТО осн.асорт.</th><th>за період</th><th>ТО ЕЗ</th><th>Чеків</th><th>Серед. чек</th><th>Дзвінків</th></tr>
                </thead>
                <tbody>
                  {data.checkpoints.map((c, i) => {
                    const prev = data.checkpoints[i - 1];
                    const delta = c.assort - (prev?.assort || 0);
                    const empty = !c.assort && !c.ez && !c.cheky && !c.dzvinky;
                    const avgCheck = c.cheky > 0 ? c.assort / c.cheky : 0;
                    return (
                      <tr key={c.cp} className={empty ? "muted" : ""}>
                        <td>{c.cp}:00</td>
                        <td className="num">{empty ? "—" : fmt(c.assort)}</td>
                        <td className="num">{empty ? "—" : delta ? fmt(delta) : "—"}</td>
                        <td className="num">{empty ? "—" : fmt(c.ez)}</td>
                        <td className="num">{empty ? "—" : c.cheky}</td>
                        <td className="num">{empty || !avgCheck ? "—" : fmt(avgCheck)}</td>
                        <td className="num">{empty ? "—" : c.dzvinky}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pday-extra">
              <span>БН: {fmt(data.bn)}</span>
              <span>LiqPay: {fmt(data.liqpay)}</span>
              <span>Розстрочка: {fmt(data.installment)}</span>
              {data.retOS > 0 && <span>Повернення ОС: {fmt(data.retOS)}</span>}
              {data.retEZ > 0 && <span>Повернення ЕЗ: {fmt(data.retEZ)}</span>}
            </div>
            {(data.note || data.reason || data.smComment || data.focusFactList.length > 0) && (
              <div className="pday-notes">
                {data.reason && <p><b>Причина:</b> {data.reason}</p>}
                {data.note && <p><b>Нотатка:</b> {data.note}</p>}
                {data.smComment && <p><b>Коментар СМ:</b> {data.smComment}</p>}
                {data.focusFactList.map((f, i) => <p key={i}><b>Фокус:</b> {f.text}</p>)}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ManagerHome() {
  const [dayDetail, setDayDetail] = useState(null);
  return (
    <>
      {/* «Потребує уваги» тимчасово прибрано з кабінету керівника (2026-09-11) */}
      <TurnoverRings onDayDrill={setDayDetail} />
      <ManagerCashOverview />
      {dayDetail && <PlannerDayModal salon={dayDetail} onClose={() => setDayDetail(null)} />}
    </>
  );
}

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

  // назва території ТМ — ім'я ТМ, а не хардкод геолокації (територія міняється при перепризначенні салонів)
  const tmTitle = Object.fromEntries(TMS.map((t) => [t.key, t.name]));
  const grand = Object.values(out).reduce((a, m) => a + m.total, 0);
  const subtotals = Object.fromEntries(TMS.map((t) => [t.key, 0]));
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
          {TMS.filter((t) => salonsOfTm(t.key).length > 0).map((t) => (
            <div key={t.key}>
              <div className="n">{uah(subtotals[t.key])}</div>
              <div className="l">{tmTitle[t.key]}</div>
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
const ORDER_ST = { draft: "чернетка", submitted: "подано", ordered: "їде", shipped: "відправлено", received: "отримано" };

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
/* вибір позиції з пошуком (замість довгого випадаючого списку) */
function ItemPicker({ value, options, onPick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const cur = options.find((o) => o.id === value);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = words.length ? options.filter((o) => words.every((w) => o.name.toLowerCase().includes(w))) : options;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, [open]);
  useEffect(() => {
    if (open) boxRef.current?.querySelector(".wh-pick-opt.hi")?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const pick = (id) => { onPick(id); setOpen(false); setQ(""); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[hi]) pick(list[hi].id); }
    else if (e.key === "Escape") { setOpen(false); setQ(""); }
  };

  return (
    <div className="wh-pick" ref={boxRef}>
      {open ? (
        <input autoFocus className="wh-pick-in" value={q} placeholder="Почніть вводити назву…"
          onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={onKey} />
      ) : (
        <button type="button" className={`wh-pick-btn ${cur ? "" : "empty"}`} onClick={() => { setOpen(true); setHi(0); }}>
          <span>{cur ? cur.name : "— позиція —"}</span><Search size={13} />
        </button>
      )}
      {open && (
        <div className="wh-pick-list">
          {list.length === 0
            ? <div className="wh-pick-none">Нічого не знайдено</div>
            : list.map((o, i) => (
              <button key={o.id} type="button" className={`wh-pick-opt ${i === hi ? "hi" : ""} ${o.id === value ? "cur" : ""}`}
                onMouseEnter={() => setHi(i)} onClick={() => pick(o.id)}>{o.name}</button>
            ))}
        </div>
      )}
    </div>
  );
}

function SupplyLineRow({ items, line, exclude, onChange, onRemove, priceCol, avail }) {
  const opts = items.filter((i) => i.id === line.item_id || !exclude.has(i.id));
  const over = avail != null && Number(line.qty) > avail;
  const pickItem = (id) => {
    const next = { ...line, item_id: id };
    // ціну підтягуємо з довідника; лишаємо ручну правку, якщо вона вже введена й відрізняється від попередньої позиції
    if (priceCol) {
      const prevPrice = items.find((i) => i.id === line.item_id)?.unit_cost;
      const manual = line.unit_cost !== "" && line.unit_cost != null && Number(line.unit_cost) !== Number(prevPrice);
      if (!manual) {
        const cost = items.find((i) => i.id === id)?.unit_cost;
        next.unit_cost = cost ? String(cost) : "";
      }
    }
    onChange(next);
  };
  return (
    <div className="wh-line">
      <ItemPicker value={line.item_id} options={opts} onPick={pickItem} />
      <NumInput className={`wh-line-qty ${over ? "wh-over" : ""}`} allowEmpty placeholder="к-ть" value={line.qty} onChange={(v) => onChange({ ...line, qty: v })} />
      {priceCol && (
        <NumInput key={line.item_id} className="wh-line-qty" allowEmpty placeholder="ціна" value={line.unit_cost}
          onChange={(v) => onChange({ ...line, unit_cost: v })} />
      )}
      <button className="wh-line-x" onClick={onRemove}><X size={13} /></button>
      {avail != null && line.item_id && (
        <span className={`wh-line-avail ${over ? "over" : ""}`}>{over ? `на складі ${avail}` : `≤ ${avail}`}</span>
      )}
    </div>
  );
}

/* --- Основний склад --- */
function SupplyCentral({ items, stock, canManage, cabKey, onReload }) {
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
        <SupplyReceipt items={items} warehouse={CENTRAL} cabKey={cabKey} prefill={receiptFrom.length ? receiptFrom : null}
          onClose={() => setReceiptFrom(null)} onDone={() => { setReceiptFrom(null); onReload(); }} />
      )}
    </div>
  );
}

/* --- Прихід (модалка) --- */
const _normName = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function matchCatalogItem(items, name) {
  const n = _normName(name);
  if (!n) return "";
  const nt = new Set(n.split(" ").filter((w) => w.length > 2));
  let best = "", score = 0;
  for (const it of items) {
    const c = _normName(it.name);
    let s = 0;
    if (c === n) s = 100;
    else if (c.includes(n) || n.includes(c)) s = 60;
    else s = c.split(" ").filter((w) => w.length > 2 && nt.has(w)).length * 22;
    if (s > score) { score = s; best = it.id; }
  }
  return score >= 22 ? best : "";
}

function SupplyReceipt({ items, warehouse, cabKey, prefill, onClose, onDone }) {
  const [cp, setCp] = useState("");
  const isCentral = warehouse === CENTRAL;
  const fileRef = useRef(null);
  const [ocr, setOcr] = useState("");       // "" | run | ok | fail
  const [ocrNote, setOcrNote] = useState("");
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const [lines, setLines] = useState(() =>
    (prefill || [{ item_id: "", qty: "", unit_cost: "" }]).map((l) =>
      l.item_id && (l.unit_cost === "" || l.unit_cost == null) && byId[l.item_id]?.unit_cost
        ? { ...l, unit_cost: String(byId[l.item_id].unit_cost) }
        : l
    )
  );
  const [busy, setBusy] = useState(false);
  const set = (idx, ln) => setLines((ls) => ls.map((x, i) => (i === idx ? ln : x)));
  const onNakladna = async (file) => {
    if (!file) return;
    setOcr("run"); setOcrNote("");
    try {
      const url = await resizeImage(file);
      const r = await extractNakladna(url, items.map((i) => i.name));
      const rows = (r?.items || []).map((it) => ({
        item_id: matchCatalogItem(items, it.name),
        qty: it.qty ? String(it.qty) : "",
        unit_cost: it.unit_price ? String(it.unit_price) : "",
      }));
      if (!rows.length) { setOcr("fail"); setOcrNote("Позицій не зчитано — введіть вручну"); return; }
      setLines(rows);
      const miss = rows.filter((x) => !x.item_id).length;
      setOcr("ok");
      setOcrNote(miss
        ? `Розпізнано ${rows.length}, ${miss} не знайдено в довіднику — оберіть у рядку вручну`
        : `Розпізнано ${rows.length} позицій — перевірте кількість і ціну`);
    } catch (e) { setOcr("fail"); setOcrNote(String(e.message || e)); }
  };
  // Ctrl+V у вікні приходу — вставити скріншот накладної з буфера
  useEffect(() => {
    if (!isCentral) return undefined;
    const h = (e) => { const f = pasteEventImage(e); if (f) { e.preventDefault(); onNakladna(f); } };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCentral, items]);
  const pasteFromClipboard = async () => {
    const f = await readClipboardImage();
    if (f) onNakladna(f);
    else { setOcr("fail"); setOcrNote("У буфері немає зображення — скопіюйте скріншот і спробуйте ще"); }
  };
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
    try {
      const res = await whReceipt(warehouse, cp.trim(), good);
      pushToast({ title: "Прихід оформлено", body: suah(total) });
      (res?.price_changes || []).forEach((c) =>
        pushToast({ title: `Ціну перераховано: ${c.name}`, body: `${suahN(c.old)} → ${suahN(c.new)} ₴ (середньозважена по залишку)` }));
      if (warehouse === CENTRAL) {
        notifyWhManagers(cabKey, { kind: "supply", title: "Прихід на основний склад", body: `${good.length} поз. · ${suah(total)}`, actor: cabKey || "", link: "warehouse" });
      }
      onDone();
    } catch (e) { pushToast({ title: "Не вдалося оформити прихід", body: String(e.message || e) }); setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wh-modal-h"><span>Прихід на {whName(warehouse)}</span><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="wh-modal-b">
          <label className="over-field" style={{ maxWidth: "100%" }}><span>Постачальник / № накладної</span>
            <input value={cp} onChange={(e) => setCp(e.target.value)} placeholder="напр. ФОП Іваненко, накл. №142" />
          </label>
          {isCentral && (
            <div className="wh-ocr">
              <button type="button" className="btn-secondary small" disabled={ocr === "run"} onClick={() => fileRef.current?.click()}>
                <ScanLine size={14} /> {ocr === "run" ? "Розпізнаю накладну…" : "Сфотографувати накладну"}
              </button>
              <button type="button" className="btn-secondary small" disabled={ocr === "run"} onClick={pasteFromClipboard}>
                <ImageIcon size={14} /> Вставити скрін з буфера
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={(e) => { onNakladna(e.target.files?.[0]); e.target.value = ""; }} />
              <span className="wh-ocr-hint">або Ctrl+V у цьому вікні</span>
              {ocrNote && <span className={`wh-ocr-note ${ocr}`}>{ocrNote}</span>}
            </div>
          )}
          <div className="wh-lines">
            {lines.map((l, i) => (
              <SupplyLineRow key={i} items={items} line={l} exclude={new Set(lines.map((x) => x.item_id).filter((_, j) => j !== i))}
                priceCol onChange={(ln) => set(i, ln)} onRemove={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
            ))}
            <button className="wh-add" onClick={() => setLines((ls) => [...ls, { item_id: "", qty: "", unit_cost: "" }])}><Plus size={13} /> Ще позиція</button>
          </div>
          <div className="wh-modal-foot"><span>Сума</span><b>{suah(total)}</b></div>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "…" : "Оформити прихід"}</button>
          <p className="hint">Ціна підтягується з довідника — за потреби відкоригуйте у рядку. Нова ціна оновить довідник.</p>
        </div>
      </div>
    </div>, document.body);
}

/* --- Довідник --- */
function SupplyItemsView({ canManage, onReload }) {
  const [form, setForm] = useState(null); // null | 'new' | item
  const [list, setList] = useState(null);
  const [showArch, setShowArch] = useState(false);
  const load = () => listItems({ includeArchived: true }).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const refresh = () => { load(); onReload(); };

  const del = async (i) => {
    if (!confirm(`Позиція «${i.name}»: видалити з довідника? Якщо вона вже фігурує в актах/залишках — буде заархівована.`)) return;
    try {
      const r = await deleteItem(i.id);
      pushToast({ title: r === "deleted" ? "Позицію видалено" : "Позицію заархівовано", body: i.name });
      refresh();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
  };

  if (list === null) return <div className="loading">Завантаження…</div>;
  const rows = [...list]
    .filter((i) => showArch || i.active !== false)
    .sort((a, b) => catRank(a.category) - catRank(b.category) || a.sort - b.sort);

  return (
    <div className="wh-view">
      <div className="wh-bar">
        {canManage && !form && <button className="btn-secondary small" onClick={() => setForm("new")}><Plus size={14} /> Нова позиція</button>}
        <label className="wh-check"><input type="checkbox" checked={showArch} onChange={(e) => setShowArch(e.target.checked)} /> показати архівні</label>
      </div>
      {form && <SupplyItemForm item={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
      <div className="wh-tw">
        <table className="wh-tbl">
          <thead><tr><th>Позиція</th><th>Категорія</th><th>Од.</th><th>Ціна</th><th>Мін центр</th><th>Мін салон</th><th /></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={i.active === false ? "wh-arch" : ""}>
                <td className="wh-nm">{i.name}{i.active === false && <span className="wh-cat">архів</span>}</td>
                <td className="muted">{i.category}</td>
                <td>{i.unit}</td>
                <td className="num">{canManage
                  ? <NumInput className="wh-price" value={i.unit_cost} onChange={(v) => setPrice(i.id, v).then(refresh).catch((e) => pushToast({ title: "Ціна не збережена", body: String(e.message || e) }))} />
                  : suahN(i.unit_cost)}</td>
                <td className="num muted">{i.min_central}</td>
                <td className="num muted">{i.min_salon}</td>
                <td className="wh-row-act">{canManage && <>
                  <button className="wh-link" onClick={() => setForm(i)}>ред.</button>
                  <button className="wh-link danger" onClick={() => del(i)}>видалити</button>
                </>}</td>
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
      pushToast({ title: item ? "Позицію оновлено" : "Позицію додано", body: f.name.trim() });
      onSaved();
    } catch (e) { pushToast({ title: "Не вдалося зберегти", body: String(e.message || e) }); setBusy(false); }
  };
  const toggleArchive = async () => {
    try {
      await upsertItem({ ...item, active: item.active === false });
      pushToast({ title: item.active === false ? "Повернено з архіву" : "Заархівовано", body: item.name });
      onSaved();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
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
        {item && <button className="btn-secondary small" onClick={toggleArchive}>{item.active === false ? "Повернути з архіву" : "Заархівувати"}</button>}
        <button className="btn-primary small" onClick={save} disabled={busy}>{busy ? "…" : "Зберегти"}</button>
      </div>
    </div>
  );
}

/* --- Мій склад (салон) --- */
function SupplySalonStock({ salonKey, items, stock, onOrderAll }) {
  // Липинського (та інші зі списку) своїх залишків не веде — списує госп.потреби прямо з Основного складу,
  // тож тут показуємо саме залишок Основного складу замість завжди порожнього «свого».
  const isCentralDraw = CENTRAL_DRAW_SALONS.includes(salonKey);
  const sm = stockMap(stock, isCentralDraw ? CENTRAL : salonKey);
  const cs = stockMap(stock, CENTRAL); // залишок Основного складу — щоб бачити, чи є що замовляти
  const rows = items.map((i) => {
    const qty = sm[i.id] || 0;
    return { i, qty, need: Math.max(0, i.min_salon - qty), state: stockState(qty, i.min_salon), value: qty * i.unit_cost };
  }).sort((a, b) => catRank(a.i.category) - catRank(b.i.category) || a.i.sort - b.i.sort);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const need = rows.filter((r) => r.need > 0);
  return (
    <div className="wh-view">
      <div className="wh-kpis">
        <div className="wh-kpi"><span>{isCentralDraw ? "Вартість запасу (Основний склад)" : "Вартість мого запасу"}</span><b>{suah(total)}</b></div>
        <div className={`wh-kpi ${need.length ? "attn" : ""}`}><span>Треба замовити</span><b>{need.length} поз.</b></div>
      </div>
      {need.length > 0 && <button className="btn-secondary small" style={{ margin: "4px 0 12px" }} onClick={() => onOrderAll(need.map((r) => ({ item_id: r.i.id, qty: String(r.need) })))}>Замовити все, що нижче мін</button>}
      <div className="wh-tw">
        <table className="wh-tbl">
          <thead><tr><th>Позиція</th>{!isCentralDraw && <th>Залишок Основного складу</th>}<th>Залишок</th><th>Мін</th><th>Замовити</th><th>Вартість</th></tr></thead>
          <tbody>
            {rows.map(({ i, qty, need: n, state, value }) => (
              <tr key={i.id} className={`st-${state}`}>
                <td className="wh-nm">{i.name}<span className="wh-cat">{i.category}</span></td>
                {!isCentralDraw && <td className="num wh-cs">{cs[i.id] || 0}</td>}
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
  const cs = stockMap(stock, CENTRAL);
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
      if (submit) {
        await submitOrder(id);
        notifyWhManagers(null, {
          kind: "supply",
          title: `Нове замовлення на склад: ${salonByKey(salonKey)?.city}`,
          body: `${ls.length} поз. · ${suah(sum)}`,
          actor: salonKey, link: "warehouse",
        });
      }
      pushToast({ title: submit ? "Замовлення подано" : "Чернетку збережено", body: `${ls.length} поз. · ${suah(sum)}` });
      onDone();
    } catch (e) { pushToast({ title: "Не вдалося зберегти замовлення", body: String(e.message || e) }); setBusy(false); }
  };

  return (
    <div className="wh-view">
      <input className="wh-search" placeholder="Пошук позиції…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="wh-tw">
        <table className="wh-tbl">
          <thead><tr><th>Позиція</th><th>Залишок Основного складу</th><th>Залишок</th><th>Мін</th><th>Підказка</th><th>Замовити</th></tr></thead>
          <tbody>
            {shown.map((i) => {
              const s = sm[i.id] || 0;
              const sug = Math.max(0, i.min_salon - s);
              return (
                <tr key={i.id}>
                  <td className="wh-nm">{i.name}<span className="wh-cat">{i.category}</span></td>
                  <td className="num wh-cs">{cs[i.id] || 0}</td>
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
const ORDER_ST_TONE = { draft: "st-draft", submitted: "st-sub", ordered: "st-ordered", shipped: "st-ship", received: "st-recv" };
const lineMismatch = (l) => l.qty_shipped != null && Number(l.qty_shipped) !== Number(l.qty_req);

function SupplyOrders({ scope, salonKey, tmKey, cabKey, items, stock, onReload, onEditDraft }) {
  const [orders, setOrders] = useState(null);
  const [open, setOpen] = useState(null); // { order, lines }
  const [ship, setShip] = useState(null); // order being shipped
  const [rcpt, setRcpt] = useState(null); // { orderId, prefill } — прихід під замовлення
  const [busyId, setBusyId] = useState("");
  const byId = Object.fromEntries((items || []).map((i) => [i.id, i]));
  const centralStock = stockMap(stock, CENTRAL);
  const load = async () => {
    let list = [];
    if (scope === "mine") list = await listOrders({ salonKey });
    else if (scope === "incoming") list = (await listOrders({})).filter((o) => o.status !== "draft");
    else list = (await listOrders({})).filter((o) => salonsOfTm(tmKey).some((s) => s.key === o.salon_key));
    // для відправлених/отриманих підтягуємо рядки — щоб показати к-ть і розбіжності
    const withLines = await Promise.all(list.map(async (o) => {
      if (o.status === "draft") return o;
      const ls = await orderLines(o.id).catch(() => []);
      return { ...o, _lines: ls, _mismatch: ls.some(lineMismatch), _count: ls.length };
    }));
    setOrders(withLines);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, salonKey]);
  if (orders === null) return <div className="loading">Завантаження…</div>;
  if (!orders.length) return <div className="admin-empty">Замовлень немає.</div>;

  const openOrder = async (o) => setOpen({ order: o, lines: o._lines || await orderLines(o.id) });
  const markOrdered = async (o) => {
    if (!confirm(`Замовлення для «${salonLabel(salonByKey(o.salon_key))}»: позначити, що замовлено в постачальників?`)) return;
    setBusyId(o.id);
    try {
      await markOrderedFromSupplier(o.id);
      pushToast({ title: "Позначено «Їде»", body: salonLabel(salonByKey(o.salon_key)) });
      notify({ recipient: o.salon_key, kind: "supply", title: "Ваше замовлення в дорозі 🚚", body: "Оля замовила товар у постачальників", actor: cabKey || "", link: "warehouse" });
      notifyWhManagers(cabKey, { kind: "supply", title: `Замовлення в дорозі: ${salonLabel(salonByKey(o.salon_key))}`, body: "Оля замовила в постачальників", actor: cabKey || "", link: "warehouse" });
      load(); onReload && onReload();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusyId("");
  };
  const receiptForOrder = async (o) => {
    const ls = o._lines || await orderLines(o.id).catch(() => []);
    setRcpt({ orderId: o.id, prefill: ls.map((l) => ({ item_id: l.item_id, qty: String(l.qty_req || ""), unit_cost: "" })) });
  };
  const receive = async (o) => {
    const ls = o._lines || await orderLines(o.id);
    const recv = ls.map((l) => ({ item_id: l.item_id, qty: Number(l.qty_shipped ?? l.qty_req) || 0 }));
    if (!confirm(`Підтвердити отримання замовлення (${recv.length} поз.)?`)) return;
    try {
      await receiveOrder(o.id, o.salon_key, recv);
      pushToast({ title: "Отримання підтверджено", body: salonLabel(salonByKey(o.salon_key)) });
      notifyWhManagers(null, {
        kind: "supply", title: `Салон прийняв замовлення: ${salonLabel(salonByKey(o.salon_key))}`,
        body: `${recv.length} поз.`, actor: o.salon_key, link: "warehouse",
      });
      load(); onReload && onReload();
    } catch (e) { pushToast({ title: "Не вдалося підтвердити", body: String(e.message || e) }); }
  };

  return (
    <div className="wh-view">
      <div className="wh-ord-list">
        {orders.map((o) => (
          <div className={`wh-ord ${o.status}`} key={o.id}>
            <div className="wh-ord-top">
              <span className="wh-ord-nm">
                {scope === "mine" ? monthLabel(o.created_at.slice(0, 7)) : salonLabel(salonByKey(o.salon_key))}
                {o._count != null && <span className="wh-ord-cnt"> · {o._count} поз.</span>}
                {o._mismatch && <span className="wh-ord-warn"><AlertTriangle size={12} /> розбіжність</span>}
              </span>
              <span className="wh-ord-at">{fmtDate(o.created_at)}</span>
              <span className={`wh-ord-st ${ORDER_ST_TONE[o.status] || ""}`}>
                {o.status === "ordered" && <Truck size={12} style={{ marginRight: 4, verticalAlign: "-2px" }} />}
                {ORDER_ST[o.status]}
              </span>
            </div>
            <div className="wh-ord-act">
              <button className="wh-link" onClick={() => openOrder(o)}>позиції</button>
              {scope === "mine" && o.status === "draft" && <button className="wh-link" onClick={() => onEditDraft(o)}>редагувати</button>}
              {scope === "mine" && o.status === "draft" && <button className="wh-link" onClick={() => { if (confirm("Видалити чернетку?")) deleteOrder(o.id).then(load); }}>видалити</button>}
              {scope === "mine" && o.status === "shipped" && <button className="btn-primary small" onClick={() => receive(o)}>Прийняти</button>}
              {scope === "incoming" && o.status === "submitted" && (
                <button className="btn-glow small" disabled={busyId === o.id} onClick={() => markOrdered(o)}>
                  <Truck size={13} /> Замовлено в постачальників
                </button>
              )}
              {scope === "incoming" && o.status === "ordered" && (
                <>
                  <button className="btn-secondary small" onClick={() => receiptForOrder(o)}>Створити прихід</button>
                  <button className="btn-primary small" onClick={() => setShip(o)}>Відправити салону</button>
                </>
              )}
              {scope === "incoming" && o.status === "submitted" && <button className="wh-link" onClick={() => setShip(o)}>відправити одразу</button>}
            </div>
          </div>
        ))}
      </div>

      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-h"><span>{salonLabel(salonByKey(open.order.salon_key))} · {ORDER_ST[open.order.status]}</span><button className="modal-close" onClick={() => setOpen(null)}><X size={16} /></button></div>
            <div className="wh-modal-b">
              <table className="wh-tbl">
                <thead><tr><th>Позиція</th><th>Залишок Основного складу</th><th>Замовлено</th><th>Відправлено</th></tr></thead>
                <tbody>
                {open.lines.map((l) => (
                  <tr key={l.item_id} className={lineMismatch(l) ? "wh-mismatch" : ""}><td className="wh-nm">{byId[l.item_id]?.name}</td>
                    <td className="num wh-cs">{centralStock[l.item_id] || 0}</td>
                    <td className="num">{l.qty_req}</td>
                    <td className="num">{l.qty_shipped != null ? l.qty_shipped : ""}</td></tr>
                ))}
              </tbody></table>
              {open.lines.some(lineMismatch) && <p className="hint wh-mismatch-note"><AlertTriangle size={13} /> Червоним — позиції, відправлені не в тій кількості, що замовляли.</p>}
            </div>
          </div>
        </div>,
        document.body
      )}
      {ship && <SupplyShip order={ship} items={items} stock={stock} cabKey={cabKey} onClose={() => setShip(null)} onDone={() => { setShip(null); load(); onReload && onReload(); }} />}
      {rcpt && (
        <SupplyReceipt items={items} warehouse={CENTRAL} cabKey={cabKey} prefill={rcpt.prefill}
          onClose={() => setRcpt(null)} onDone={() => { setRcpt(null); load(); onReload && onReload(); }} />
      )}
    </div>
  );
}

function SupplyShip({ order, items, stock, cabKey, onClose, onDone }) {
  const [lines, setLines] = useState(null);
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);
  const cs = stockMap(stock, CENTRAL);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  useEffect(() => { orderLines(order.id).then((ls) => { setLines(ls); const q = {}; ls.forEach((l) => { q[l.item_id] = String(Math.min(l.qty_req, cs[l.item_id] ?? l.qty_req)); }); setQty(q); }); }, [order.id]);
  if (!lines) return null;
  const send = async () => {
    const ls = lines.map((l) => ({ item_id: l.item_id, qty: Number(qty[l.item_id]) || 0 })).filter((l) => l.qty > 0);
    const partial = lines.some((l) => Number(qty[l.item_id] || 0) !== Number(l.qty_req));
    setBusy(true);
    try {
      await shipOrder(order.id, order.salon_key, ls);
      pushToast({ title: "Відправлено", body: salonLabel(salonByKey(order.salon_key)) });
      notify({
        recipient: order.salon_key, kind: "supply",
        title: "Замовлення зі складу відправлено",
        body: `${ls.length} поз.${partial ? " · є розбіжності з замовленням" : ""} — прийміть у «Мої замовлення»`,
        actor: cabKey || "", link: "warehouse",
      });
      notifyWhManagers(cabKey, {
        kind: "supply", title: `Замовлення відправлено: ${salonLabel(salonByKey(order.salon_key))}`,
        body: `${ls.length} поз.`, actor: cabKey || "", link: "warehouse",
      });
      onDone();
    } catch (e) { pushToast({ title: "Не вдалося відправити", body: String(e.message || e) }); setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wh-modal-h"><span>Відправити → {salonLabel(salonByKey(order.salon_key))}</span><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
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
function SupplyWriteoff({ salonKey, warehouse, items, stock, onReload }) {
  const wh = warehouse || salonKey;
  const fromCentral = wh === CENTRAL;
  const [articles, setArticles] = useState(WRITEOFF_ARTICLES_BUILTIN);
  const [article, setArticle] = useState("store");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState([{ item_id: "", qty: "" }]);
  const [acts, setActs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const cs = stockMap(stock, wh);
  const load = () => listActs({ warehouse: wh, kind: "writeoff" })
    .then((a) => setActs(fromCentral ? a.filter((x) => x.created_by === salonKey) : a))
    .catch(() => setActs([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [wh, salonKey]);
  useEffect(() => { listWriteoffArticles().then(setArticles).catch(() => {}); }, []);

  const set = (idx, ln) => setLines((ls) => ls.map((x, i) => (i === idx ? ln : x)));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (byId[l.item_id]?.unit_cost || 0), 0);
  const overLine = lines.find((l) => l.item_id && Number(l.qty) > (cs[l.item_id] || 0));
  const submit = async () => {
    const good = lines.filter((l) => l.item_id && Number(l.qty) > 0).map((l) => ({ item_id: l.item_id, qty: Number(l.qty) }));
    if (!good.length || !article) return;
    const bad = good.find((g) => g.qty > (cs[g.item_id] || 0));
    if (bad) { alert(`«${byId[bad.item_id]?.name || "позиція"}»: на складі лише ${cs[bad.item_id] || 0}, не можна списати ${bad.qty}`); return; }
    setBusy(true);
    try {
      await whWriteoff(wh, article, reason.trim(), good);
      pushToast({ title: "Акт списання створено", body: `${articleLabel(articles, article)} · ${suah(total)}` });
      setReason(""); setLines([{ item_id: "", qty: "" }]); load(); onReload();
    } catch (e) { alert(e.message || e); }
    setBusy(false);
  };

  return (
    <div className="wh-view">
      {fromCentral && <p className="ov-sub">Списання госп.потреб магазину прямо з Основного складу. Зі статтею «Витрати на магазин» сума йде у ваші витрати.</p>}
      <div className="wh-form">
        <label className="over-field" style={{ maxWidth: "100%" }}><span>Стаття списання (обовʼязково)</span>
          <select value={article} onChange={(e) => setArticle(e.target.value)}>
            {articles.map((a) => <option key={a.key} value={a.key}>{a.label}{a.expense ? " — у витрати магазину" : ""}</option>)}
          </select>
        </label>
        <label className="over-field" style={{ maxWidth: "100%" }}><span>Коментар (необовʼязково)</span>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="напр. використано за вересень / зіпсовано при транспортуванні" />
        </label>
        <div className="wh-lines">
          {lines.map((l, i) => (
            <SupplyLineRow key={i} items={items} line={l}
              avail={l.item_id ? (cs[l.item_id] || 0) : undefined}
              exclude={new Set(lines.map((x) => x.item_id).filter((_, j) => j !== i))}
              onChange={(ln) => set(i, ln)} onRemove={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
          ))}
          <button className="wh-add" onClick={() => setLines((ls) => [...ls, { item_id: "", qty: "" }])}><Plus size={13} /> Ще позиція</button>
        </div>
        {overLine && <p className="wh-warn">Списати більше, ніж є на складі, не можна — виправте кількість.</p>}
        <div className="wh-modal-foot"><span>Сума списання</span><b>{suah(total)}</b></div>
        <button className="btn-primary small" onClick={submit} disabled={busy || !article || !!overLine}>{busy ? "…" : "Створити акт списання"}</button>
      </div>

      <h4 className="wh-h4">Складські акти</h4>
      {acts === null ? <div className="loading">…</div> : acts.length === 0 ? <p className="hint">Актів ще немає.</p> : (
        <div className="wh-acts">
          {acts.map((a) => (
            <div className="wh-act" key={a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
              <div className="wh-act-top">
                <span className="wh-act-sum">−{suahN(a.total)} ₴</span>
                <span className="wh-act-article">{articleLabel(articles, a.article || "store")}</span>
                {a.reason && <span className="wh-act-reason">{a.reason}</span>}
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
  const isSalon = warehouse && warehouse !== CENTRAL;
  const kinds = isSalon
    ? Object.entries(ACT_KIND).filter(([k]) => k !== "shipment")
    : Object.entries(ACT_KIND);
  return (
    <div className="wh-view">
      {isSalon && <p className="ov-sub">Прихід зі складу, списання та коригування по вашому салону</p>}
      <div className="wh-bar">
        <select className="inv-toolbar-sel" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">усі акти</option>
          {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {acts === null ? <div className="loading">…</div> : acts.length === 0 ? <p className="hint">Актів немає.</p> : (
        <div className="wh-acts">
          {acts.map((a) => (
            <div className={`wh-act k-${a.kind}`} key={a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
              <div className="wh-act-top">
                <span className="wh-act-kind">{ACT_KIND[a.kind]}</span>
                <span className="wh-act-sum">{signOf(a.kind)}{suahN(a.total)} ₴</span>
                {a.kind === "writeoff" && <span className="wh-act-article">{articleLabel(null, a.article || "store")}</span>}
                <span className="wh-act-reason">{whName(a.counterparty) || a.reason || (a.order_id ? "замовлення салону" : "")}</span>
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
        {salons.map((s) => <button key={s.key} className={`chip ${s.key === pick ? "active" : ""}`} onClick={() => setPick(s.key)}>{salonShortName(s)}</button>)}
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

  // Липинського списує госп.потреби прямо з Основного складу, без «Мого складу»
  const centralWriteoff = CENTRAL_DRAW_SALONS.includes(cab.key);
  const subs = [];
  if (manageWh) subs.push(["central", "Основний склад"], ["incoming", "Замовлення салонів"], ["acts", "Складські акти"], ["items", "Довідник"]);
  if (centralWriteoff) subs.push(["writeoff", "Акт списання"]);
  else if (salonKey) subs.push(["mine", "Мій склад"], ["order", "Замовити"], ["myorders", "Мої замовлення"], ["writeoff", "Акт списання"], ["salonacts", "Рух складу"]);
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

      {tab === "central" && <SupplyCentral items={items} stock={stock} canManage={manageWh} cabKey={cab.key} onReload={reload} />}
      {tab === "items" && <SupplyItemsView canManage={manageWh} onReload={reload} />}
      {tab === "acts" && <SupplyActsView warehouse={CENTRAL} items={items} />}
      {tab === "incoming" && <SupplyOrders scope="incoming" cabKey={cab.key} items={items} stock={stock} onReload={reload} onEditDraft={() => {}} />}
      {tab === "mine" && <SupplySalonStock salonKey={salonKey} items={items} stock={stock} onOrderAll={goOrder} />}
      {tab === "order" && <SupplyOrderBuilder salonKey={salonKey} items={items} stock={stock} order={editOrder} prefill={orderPrefill} onDone={() => { setOrderPrefill(null); setEditOrder(null); reload(); setTab("myorders"); }} />}
      {tab === "myorders" && <SupplyOrders scope="mine" salonKey={salonKey} cabKey={cab.key} items={items} stock={stock} onReload={reload} onEditDraft={(o) => { orderLines(o.id).then((ls) => { setEditOrder({ ...o, lines: ls }); setOrderPrefill(null); setTab("order"); }); }} />}
      {tab === "writeoff" && <SupplyWriteoff salonKey={salonKey || cab.key} warehouse={centralWriteoff ? CENTRAL : salonKey} items={items} stock={stock} onReload={reload} />}
      {tab === "salonacts" && <SupplyActsView warehouse={salonKey} items={items} />}
      {tab === "terr" && <SupplyTerritory tmKey={cab.tmKey || cab.key} items={items} stock={stock} />}
      {tab === "torders" && <SupplyOrders scope="territory" tmKey={cab.tmKey || cab.key} items={items} stock={stock} onReload={reload} onEditDraft={() => {}} />}
    </div>
  );
}

/* Одноразове внесення стартових залишків складу — усі 8 складів це вже зробили
   (вересень 2026), вкладку прибрано з навігації. Компонент лишив на випадок,
   якщо з'явиться новий склад і знадобиться знову. Після збереження —
   назавжди замкнено (сервер не пропустить ще один adjust не від адміна);
   далі рух товару лише через прихід/списання. */
function SupplyStocktake({ warehouse, items, cabKey, locked, doneInfo, onReload }) {
  const [qtys, setQtys] = useState({});
  const [step, setStep] = useState("edit"); // edit | confirm
  const [busy, setBusy] = useState(false);

  const lines = useMemo(
    () => items.map((it) => ({ item: it, qty: Number(qtys[it.id]) || 0 })).filter((l) => l.qty > 0),
    [items, qtys],
  );

  const submit = async () => {
    setBusy(true);
    try {
      await whAdjust(warehouse, "Стартові залишки", lines.map((l) => ({ item_id: l.item.id, qty: l.qty })));
      pushToast({ title: "Стартові залишки внесено", body: `${lines.length} позицій · ${whName(warehouse)}` });
      onReload();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); setStep("edit"); }
    setBusy(false);
  };

  if (locked) {
    return (
      <div className="admin-panel">
        <h3>Стартові залишки</h3>
        <p className="hint">
          Уже внесено{doneInfo ? ` — ${cabName(doneInfo.done_by)}, ${fmtDeadline(doneInfo.done_at)}` : ""}.
          Далі залишки складу змінюються лише через прихід і списання — так і задумано, щоб уникнути махінацій.
        </p>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="admin-panel">
        <h3>⚠️ Це ще НЕ збережено — останній крок</h3>
        <p className="hint" style={{ color: "var(--negative-bright)" }}>
          Нижче — те, що потрапить у {whName(warehouse)}. Натисніть «Так, зафіксувати назавжди», інакше нічого не збережеться.
          Це одноразова дія — після збереження виправити залишки напряму вже не можна, лише через прихід і списання.
        </p>
        <div className="wh-lines">
          {lines.map((l) => (
            <div className="stocktake-row" key={l.item.id}><span className="stocktake-nm">{l.item.name}</span><b>{l.qty} {l.item.unit}</b></div>
          ))}
          {lines.length === 0 && <p className="hint">Не вказано жодної кількості — поверніться й заповніть хоча б одну позицію.</p>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn-secondary" disabled={busy} onClick={() => setStep("edit")}>Назад, виправити</button>
          <button className="btn-primary" disabled={busy || !lines.length} onClick={submit}>{busy ? "Зберігаю…" : "Так, зафіксувати назавжди"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <h3>Стартові залишки — {whName(warehouse)}</h3>
      <p className="hint">Внесіть фактичну кількість по кожній позиції — можна зробити лише ОДИН РАЗ. Далі коригувати залишки напряму не можна, лише через прихід і списання.</p>
      <div className="wh-lines" style={{ marginTop: 12 }}>
        {items.map((it) => (
          <div className="stocktake-row" key={it.id}>
            <span className="stocktake-nm">{it.name}</span>
            <NumInput className="tm-in" allowEmpty placeholder="0" value={qtys[it.id] ?? ""} onChange={(v) => setQtys((s) => ({ ...s, [it.id]: v }))} />
            <span className="stocktake-unit">{it.unit}</span>
          </div>
        ))}
        {items.length === 0 && <p className="hint">Довідник порожній — спершу додайте позиції.</p>}
      </div>
      <button
        className="btn-primary" style={{ marginTop: 14 }} disabled={!items.length}
        onClick={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); setStep("confirm"); }}
      >
        Переглянути перед збереженням →
      </button>
    </div>
  );
}

/* ==================== ПРОДАЖІ ЕЗ (генератори/електроінструмент) ==================== */
function EzSaleForm({ salonKey, ym: ymProp, cabKey, sale, onClose, onCreated }) {
  const editing = !!sale;
  const months = useMemo(() => recentMonths(12), []);
  const [ym, setYm] = useState(sale?.ym || ymProp || nowYm()); // місяць продажу — можна вибрати й заднім числом (до 10 числа наступного за минулим)
  const [nomenclature, setNomenclature] = useState(sale?.nomenclature || "");
  const [article, setArticle] = useState(sale?.article || "");
  const [orderNo, setOrderNo] = useState(sale?.order_no || "");
  const [amount, setAmount] = useState(sale && sale.payment_method !== "combined" ? String(sale.amount) : "");
  const [paymentMethod, setPaymentMethod] = useState(sale?.payment_method || "cash");
  const [breakdown, setBreakdown] = useState({
    cash: sale?.payment_breakdown?.cash || "", card: sale?.payment_breakdown?.card || "",
    transfer: sale?.payment_breakdown?.transfer || "", installment: sale?.payment_breakdown?.installment || "",
  });
  const [npDeliveryPaid, setNpDeliveryPaid] = useState(sale?.np_delivery_paid || false);
  const [busy, setBusy] = useState(false);

  const combined = paymentMethod === "combined";
  const breakdownTotal = Object.values(breakdown).reduce((s, v) => s + (Number(v) || 0), 0);
  const total = combined ? breakdownTotal : Number(amount) || 0;
  const setB = (k) => (v) => setBreakdown((b) => ({ ...b, [k]: v }));
  const valid = nomenclature.trim() && article.trim() && orderNo.trim() && total > 0;
  const willRevert = editing && sale.status === "confirmed" && (Number(amount) !== Number(sale.amount) || paymentMethod !== sale.payment_method) && !combined;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const core = { nomenclature, article, orderNo, amount, paymentMethod, paymentBreakdown: breakdown, npDeliveryPaid };
    try {
      if (editing) {
        await updateEzSale(sale.id, core);
        if (sale.status === "confirmed") await recomputeTurnoverEz(sale.salon_key, sale.ym).catch(() => {});
        pushToast({ title: "Продаж оновлено", body: suah(total) });
      } else {
        await createEzSale({ salonKey, ym, createdBy: cabKey, ...core });
        pushToast({ title: "Продаж ЕЗ додано", body: suah(total) });
      }
      onCreated(); onClose();
    } catch (e) { pushToast({ title: "Не вдалося зберегти", body: String(e.message || e) }); setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{editing ? "Редагувати продаж ЕЗ" : "Новий продаж ЕЗ"}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        {!editing && ym !== nowYm() && (
          <p className="hint" style={{ padding: "0 20px", color: "var(--gold-bright)" }}>Продаж буде враховано в ЗП за {monthLabel(ym).toLowerCase()}, а не за поточний місяць.</p>
        )}
        <div className="modal-body">
          {!editing && (
            <label className="over-field" style={{ maxWidth: "100%" }}><span>Місяць продажу</span>
              <select value={ym} onChange={(e) => setYm(e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </label>
          )}
          <label className="over-field" style={{ maxWidth: "100%" }}><span>Номенклатура</span>
            <input value={nomenclature} onChange={(e) => setNomenclature(e.target.value)} />
          </label>
          <label className="over-field" style={{ maxWidth: "100%" }}><span>Артикул</span>
            <input value={article} onChange={(e) => setArticle(e.target.value)} />
          </label>
          <label className="over-field" style={{ maxWidth: "100%" }}><span>№ замовлення</span>
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
          </label>
          <label className="over-field" style={{ maxWidth: "100%" }}><span>Спосіб оплати</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {Object.entries(EZ_PAYMENT_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {combined ? (
            <>
              <div className="item-fields">
                <Field label="Готівка" suffix="грн" value={breakdown.cash} onChange={setB("cash")} />
                <Field label="Картка" suffix="грн" value={breakdown.card} onChange={setB("card")} />
              </div>
              <div className="item-fields">
                <Field label="Перерахунок" suffix="грн" value={breakdown.transfer} onChange={setB("transfer")} />
                <Field label="ОЧ" suffix="грн" value={breakdown.installment} onChange={setB("installment")} />
              </div>
              <div className="hint">Разом: <b>{suah(breakdownTotal)}</b></div>
            </>
          ) : (
            <label className="over-field" style={{ maxWidth: "100%" }}><span>Сума продажу, грн</span>
              <NumInput allowEmpty value={amount} onChange={setAmount} />
            </label>
          )}
          <label className="admin-cap">
            <input type="checkbox" checked={npDeliveryPaid} onChange={(e) => setNpDeliveryPaid(e.target.checked)} />
            <span>Оплата за доставку НП</span>
          </label>
          {willRevert && (
            <p className="hint" style={{ color: "var(--negative-bright)" }}>
              Продаж уже підтверджено ТМ — оскільки сума чи спосіб оплати змінюються, статус повернеться
              «на опрацюванні», щоб ТМ переглянув собівартість наново.
            </p>
          )}
        </div>
        <div className="modal-foot">
          <span />
          <button className="btn-primary" onClick={submit} disabled={busy || !valid}>{busy ? "…" : editing ? "Зберегти зміни" : "Додати продаж"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ezStatusBadge = (st) => (
  <span className={`badge ${st === "confirmed" ? "badge-ok" : "badge-warn"}`}>
    {st === "confirmed" ? "Підтверджено" : "На опрацюванні"}
  </span>
);

function EzProcessRow({ sale, cabKey, onDone }) {
  const editingConfirmed = sale.status === "confirmed";
  const [costPrice, setCostPrice] = useState(sale.cost_price != null ? String(sale.cost_price) : "");
  const [costNp, setCostNp] = useState(sale.cost_np != null ? String(sale.cost_np) : "");
  const [costAcquiring, setCostAcquiring] = useState(sale.cost_acquiring != null ? String(sale.cost_acquiring) : "");
  const [costVat, setCostVat] = useState(sale.cost_vat != null ? String(sale.cost_vat) : "");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const extraTotal = (Number(costNp) || 0) + (Number(costAcquiring) || 0) + (Number(costVat) || 0);
  const netPreview = Math.max(0, Number(sale.amount) - (Number(costPrice) || 0) - extraTotal);

  const process = async () => {
    setBusy(true);
    try {
      await processEzSale(sale, { costPrice, costNp, costAcquiring, costVat }, cabKey);
      // після підтвердження перераховуємо суму всіх підтверджених продажів ЕЗ цього
      // магазину за місяць — саме вона віднімається від обороту для категоризації
      await recomputeTurnoverEz(sale.salon_key, sale.ym).catch(() => {});
      pushToast({ title: editingConfirmed ? "Розрахунок оновлено" : "Продаж підтверджено", body: `${salonLabel(salonByKey(sale.salon_key))} · прибуток ${suah(netPreview)}` });
      if (!editingConfirmed) notify({ recipient: sale.salon_key, kind: "ez", title: "Продаж ЕЗ підтверджено", body: `${suah(Number(sale.amount))} · прибуток ${suah(netPreview)}`, actor: cabKey, link: "ez" }).catch(() => {});
      onDone();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); setBusy(false); }
  };

  const del = async () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    setBusy(true);
    try {
      await deleteEzSale(sale.id);
      if (editingConfirmed) await recomputeTurnoverEz(sale.salon_key, sale.ym).catch(() => {});
      pushToast({ title: "Продаж видалено" });
      onDone();
    } catch (e) { pushToast({ title: "Не вдалося видалити", body: String(e.message || e) }); setBusy(false); }
  };

  const teamShare = Math.round(netPreview * 0.2);
  return (
    <div className="ez-process-row">
      <div className="ez-process-head">
        <b>{salonLabel(salonByKey(sale.salon_key))}</b>
        <span className="muted">{sale.nomenclature || "без номенклатури"}{sale.article ? ` · ${sale.article}` : ""}</span>
        <b>{suah(Number(sale.amount))}</b>
      </div>
      <div className="item-fields">
        <Field label="Вхідна ціна" suffix="грн" value={costPrice} onChange={setCostPrice} />
        <Field label="Доставка НП" suffix="грн" value={costNp} onChange={setCostNp} />
        <Field label="Еквайринг" suffix="грн" value={costAcquiring} onChange={setCostAcquiring} />
        <Field label="ПДВ" suffix="грн" value={costVat} onChange={setCostVat} />
      </div>
      <div className="ez-process-foot">
        <span>Прибуток: {suah(netPreview)} · на команду (20%): <b className="ez-team-num">{suah(teamShare)}</b></span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn-danger small" onClick={del} disabled={busy}>{confirmDel ? "Точно видалити?" : "Видалити"}</button>
          <button className="btn-primary small" onClick={process} disabled={busy}>{busy ? "…" : editingConfirmed ? "Зберегти" : "Опрацьовано"}</button>
        </span>
      </div>
    </div>
  );
}

/* Перегляд продажів ЕЗ магазину за місяць — «провалитися» з розрахунку ЗП для аналізу */
function EzSalonSalesModal({ salon, ym, sales, onClose }) {
  const totalAmount = sales.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  const totalProfit = sales.filter((s) => s.status === "confirmed").reduce((a, s) => a + (Number(s.net_profit) || 0), 0);
  const totalTeam = Math.round(totalProfit * 0.2);
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Продажі ЕЗ · {salonLabel(salon)} · {monthLabel(ym)}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="ez-month-kpi">
            <span className="st-cap">На команду за місяць</span>
            <b>{suah(totalTeam)}</b>
            <span className="hint" style={{ width: "auto" }}>оборот {suah(totalAmount)} · {sales.length} прод.</span>
          </div>
          {sales.length === 0 ? <div className="admin-empty">Продажів немає.</div> : (
            <div className="ez-cards">
              {sales.map((s) => {
                const teamShare = s.status === "confirmed" ? Math.round((Number(s.net_profit) || 0) * 0.2) : null;
                return (
                  <div className="ez-card" key={s.id}>
                    <div className="ez-card-ic"><BadgePercent size={17} /></div>
                    <div className="ez-card-main">
                      <div className="ez-card-title">{s.nomenclature || "Без номенклатури"}</div>
                      <div className="ez-card-sub">
                        {s.article && <span>{s.article}</span>}
                        {s.order_no && <span>№ {s.order_no}</span>}
                        <span>{EZ_PAYMENT_METHODS[s.payment_method]}</span>
                        <span>{fmtDate(s.created_at)}</span>
                      </div>
                    </div>
                    <div className="ez-card-nums">
                      <div className="ez-card-amt">{suah(Number(s.amount))}</div>
                      {teamShare != null ? <div className="ez-card-team">на команду <b>{suah(teamShare)}</b></div> : ezStatusBadge(s.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* Аналітика ЕЗ (ТМ/керівник): продажі, прибуток і бонус на команду в розрізі магазину та місяця */
function EzAnalytics({ salons, sales }) {
  const months = useMemo(() => recentMonths(12), []);
  const monthsAsc = useMemo(() => [...months].reverse(), [months]);
  const [salonKey, setSalonKey] = useState(salons[0]?.key || "");
  const [monthF, setMonthF] = useState("all"); // "all" | ym

  const byKeyYm = useMemo(() => {
    const m = {};
    sales.forEach((s) => {
      const k = `${s.salon_key}|${s.ym}`;
      const row = (m[k] ||= { count: 0, amount: 0, profit: 0 });
      row.count += 1;
      row.amount += Number(s.amount) || 0;
      if (s.status === "confirmed") row.profit += Number(s.net_profit) || 0;
    });
    return m;
  }, [sales]);

  const rowsAll = salons.map((sl) => {
    const monthsToSum = monthF === "all" ? months : [monthF];
    let count = 0, amount = 0, profit = 0;
    monthsToSum.forEach((ym) => { const r = byKeyYm[`${sl.key}|${ym}`]; if (r) { count += r.count; amount += r.amount; profit += r.profit; } });
    return { sl, count, amount, profit, team: Math.round(profit * 0.2) };
  }).sort((a, b) => b.profit - a.profit);
  const totals = rowsAll.reduce((a, r) => ({ count: a.count + r.count, amount: a.amount + r.amount, profit: a.profit + r.profit, team: a.team + r.team }), { count: 0, amount: 0, profit: 0, team: 0 });

  const chartData = monthsAsc.map((ym) => {
    const r = byKeyYm[`${salonKey}|${ym}`];
    return { label: monthLabel(ym).replace(" 20", " '"), Прибуток: r ? r.profit : 0, "На команду": r ? Math.round(r.profit * 0.2) : 0 };
  });

  return (
    <div>
      <div className="tm-salon-chips" style={{ marginBottom: 14 }}>
        {salons.map((s) => <button key={s.key} className={`chip ${s.key === salonKey ? "active" : ""}`} onClick={() => setSalonKey(s.key)}>{salonShortName(s)}</button>)}
      </div>

      {chartData.every((d) => d.Прибуток === 0) ? (
        <div className="admin-empty">За {salonKey ? salonLabel(salonByKey(salonKey)) : "цей магазин"} підтверджених продажів ЕЗ поки немає.</div>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="2 5" stroke="#D9D2BE" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A8069" }} tickLine={false} axisLine={{ stroke: "#D9D2BE" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8069" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v) => suah(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Прибуток" fill="#8C846F" radius={[3, 3, 0, 0]} />
              <Bar dataKey="На команду" fill="#DCA94A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="tasks-head" style={{ margin: "18px 0 10px" }}>
        <h4 className="ov-h" style={{ fontSize: 15 }}>По всіх магазинах</h4>
        <select className="inv-toolbar-sel" value={monthF} onChange={(e) => setMonthF(e.target.value)}>
          <option value="all">Усі періоди (12 міс.)</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <div className="grid-scroll">
        <table className="open-log">
          <thead><tr><th>Магазин</th><th>Продажів</th><th>Оборот</th><th>Прибуток</th><th>На команду</th></tr></thead>
          <tbody>
            {rowsAll.map((r) => (
              <tr key={r.sl.key} className={r.sl.key === salonKey ? "trn-row-active" : ""} onClick={() => setSalonKey(r.sl.key)} style={{ cursor: "pointer" }}>
                <td>{salonLabel(r.sl)}</td>
                <td className="open-log-t">{r.count}</td>
                <td className="open-log-t">{suah(r.amount)}</td>
                <td className="open-log-t">{suah(r.profit)}</td>
                <td className="open-log-t"><b>{suah(r.team)}</b></td>
              </tr>
            ))}
            <tr className="open-log-total"><td><b>Разом</b></td><td className="open-log-t"><b>{totals.count}</b></td><td className="open-log-t"><b>{suah(totals.amount)}</b></td><td className="open-log-t"><b>{suah(totals.profit)}</b></td><td className="open-log-t"><b>{suah(totals.team)}</b></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EzSalesModule({ cab }) {
  const isSm = cab.type === "sm";
  const isManagerLike = cab.type === "manager" || cab.key === ADMIN_KEY;
  const scopeSalons = isSm ? [salonByKey(cab.key)].filter(Boolean) : isManagerLike ? SALONS : salonsOfTm(cab.tmKey || cab.key);
  const [ym, setYm] = useState(nowYm());
  const [tab, setTab] = useState(isSm ? "mine" : "pending");
  const [sales, setSales] = useState(null);
  const [add, setAdd] = useState(false);
  const [editSale, setEditSale] = useState(null);
  const months = useMemo(() => recentMonths(12), []);

  const reload = React.useCallback(() => {
    listEzSales({ salonKeys: scopeSalons.map((s) => s.key), ym: isSm ? ym : undefined }).then(setSales).catch(() => setSales([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeSalons.map((s) => s.key).join(","), ym, isSm]);
  useEffect(() => { setSales(null); reload(); }, [reload]);
  useEffect(() => subscribeEzSales(reload), [reload]);

  if (sales === null) return <div className="loading">Завантаження…</div>;

  const pending = sales.filter((s) => s.status === "pending");
  const confirmed = sales.filter((s) => s.status === "confirmed").filter((s) => isSm || s.ym === ym);

  return (
    <div className="tasks-mod">
      <div className="tasks-head">
        <h3 className="ov-h">Продажі ЕЗ</h3>
        {isSm && <button className="btn-primary small" onClick={() => setAdd(true)}><Plus size={14} /> Новий продаж</button>}
      </div>

      {!isSm && (
        <div className="trn-tabs" style={{ marginBottom: 10 }}>
          <button className={tab === "pending" ? "on" : ""} onClick={() => setTab("pending")}>На опрацюванні{pending.length > 0 ? ` (${pending.length})` : ""}</button>
          <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>Історія</button>
          <button className={tab === "analytics" ? "on" : ""} onClick={() => setTab("analytics")}><BarChart3 size={13} /> Аналітика</button>
        </div>
      )}

      {!isSm && tab === "analytics" && <EzAnalytics salons={scopeSalons} sales={sales} />}

      {(isSm || tab === "history") && tab !== "analytics" && (
        <div className="month-row" style={{ marginBottom: 10 }}>
          <select value={ym} onChange={(e) => setYm(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      )}

      {!isSm && tab === "pending" && (
        pending.length === 0
          ? <div className="admin-empty">Немає продажів на опрацюванні.</div>
          : <div className="ez-process-list">{pending.map((s) => <EzProcessRow key={s.id} sale={s} cabKey={cab.key} onDone={reload} />)}</div>
      )}

      {!isSm && tab === "history" && (
        confirmed.length === 0
          ? <div className="admin-empty">Продажів немає.</div>
          : <div className="ez-process-list">{confirmed.map((s) => <EzProcessRow key={s.id} sale={s} cabKey={cab.key} onDone={reload} />)}</div>
      )}

      {isSm && (
        <div className="ez-cards">
          {sales.length === 0 && <div className="admin-empty">Продажів немає.</div>}
          {(() => {
            const monthConfirmed = sales.filter((s) => s.status === "confirmed").reduce((a, s) => a + (Number(s.net_profit) || 0), 0);
            const monthTeam = Math.round(monthConfirmed * 0.2);
            return sales.length > 0 && (
              <div className="ez-month-kpi">
                <span className="st-cap">На команду за {monthLabel(ym).toLowerCase()}</span>
                <b>{suah(monthTeam)}</b>
                <span className="hint" style={{ width: "auto" }}>з підтверджених продажів · тягнеться в ЗП автоматично</span>
              </div>
            );
          })()}
          {sales.map((s) => {
            const teamShare = s.status === "confirmed" ? Math.round((Number(s.net_profit) || 0) * 0.2) : null;
            return (
              <div className="ez-card" key={s.id}>
                <div className="ez-card-ic"><BadgePercent size={17} /></div>
                <div className="ez-card-main">
                  <div className="ez-card-title">{s.nomenclature || "Без номенклатури"}</div>
                  <div className="ez-card-sub">
                    {s.article && <span>{s.article}</span>}
                    {s.order_no && <span>№ {s.order_no}</span>}
                    <span>{EZ_PAYMENT_METHODS[s.payment_method]}</span>
                  </div>
                </div>
                <div className="ez-card-nums">
                  <div className="ez-card-amt">{suah(Number(s.amount))}</div>
                  {teamShare != null
                    ? <div className="ez-card-team">на команду <b>{suah(teamShare)}</b></div>
                    : ezStatusBadge(s.status)}
                </div>
                <div className="ez-card-act">
                  <button className="wh-link" onClick={() => setEditSale(s)}>редагувати</button>
                  <button className="zsu-undo" title="Видалити" onClick={async () => {
                    try {
                      await deleteEzSale(s.id);
                      if (s.status === "confirmed") await recomputeTurnoverEz(s.salon_key, s.ym).catch(() => {});
                      pushToast({ title: "Видалено" }); reload();
                    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
                  }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {add && <EzSaleForm salonKey={cab.key} ym={ym} cabKey={cab.key} onClose={() => setAdd(false)} onCreated={reload} />}
      {editSale && <EzSaleForm salonKey={cab.key} ym={ym} cabKey={cab.key} sale={editSale} onClose={() => setEditSale(null)} onCreated={reload} />}
    </div>
  );
}

/* ==================== АНАЛІТИКА: ПЛАН/ФАКТ ПО МІСЯЦЯХ ==================== */
function AnalyticsPanel({ cab }) {
  const isManagerLike = cab.type === "manager" || cab.key === ADMIN_KEY;
  const scopeSalons = isManagerLike ? SALONS : salonsOfTm(cab.tmKey || cab.key);
  const months = useMemo(() => recentMonths(12).slice().reverse(), []); // від найстарішого до найновішого — для графіка
  const [salonKey, setSalonKey] = useState(scopeSalons[0]?.key);
  const [chartData, setChartData] = useState(null);
  const [ranking, setRanking] = useState(null);

  useEffect(() => {
    if (!salonKey) return;
    let active = true;
    setChartData(null);
    Promise.all([listTurnoverHistory(salonKey, months), listSmPlansForSalon(salonKey, months)]).then(([hist, plans]) => {
      if (!active) return;
      const histByYm = Object.fromEntries(hist.map((h) => [h.ym, h]));
      setChartData(months.map((ym) => ({
        ym: monthLabel(ym).replace(" 20", " '"),
        План: plans[ym]?.turnover_plan || null,
        Факт: histByYm[ym]?.turnover_ex_ez ?? null,
      })));
    });
    return () => { active = false; };
  }, [salonKey, months]);

  useEffect(() => {
    let active = true;
    const keys = scopeSalons.map((s) => s.key);
    Promise.all([listTurnoverHistoryForSalons(keys, months), listSmPlansForSalons(keys, months)]).then(([histBy, plansBy]) => {
      if (!active) return;
      const rows = scopeSalons.map((s) => {
        const hist = histBy[s.key] || {};
        const plans = plansBy[s.key] || {};
        const pairs = months
          .map((ym) => ({ fact: hist[ym]?.turnover_ex_ez, plan: plans[ym]?.turnover_plan }))
          .filter((p) => p.fact != null && p.plan);
        const avgPct = pairs.length ? pairs.reduce((s2, p) => s2 + (p.fact / p.plan) * 100, 0) / pairs.length : null;
        return { salon: s, avgPct, monthsCounted: pairs.length };
      }).filter((r) => r.avgPct != null).sort((a, b) => b.avgPct - a.avgPct);
      setRanking(rows);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeSalons.map((s) => s.key).join(","), months]);

  return (
    <div className="tasks-mod">
      <div className="tasks-head"><h3 className="ov-h">Аналітика: план і факт</h3></div>

      <div className="tm-salon-chips" style={{ marginBottom: 14 }}>
        {scopeSalons.map((s) => (
          <button key={s.key} className={`chip ${s.key === salonKey ? "active" : ""}`} onClick={() => setSalonKey(s.key)}>{salonShortName(s)}</button>
        ))}
      </div>

      {chartData === null ? <div className="loading">Завантаження…</div> : (
        <div style={{ width: "100%", height: 280, marginBottom: 20 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="ym" fontSize={11} />
              <YAxis fontSize={11} width={70} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => (v == null ? "—" : fmt(v))} />
              <Legend />
              <Line type="monotone" dataKey="План" stroke="#BE8A2E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="Факт" stroke="#4E6C97" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="hint" style={{ marginBottom: 20 }}>Факт — оборот без ЕЗ. Місяці без внесеного плану або ще без історії на графіку не з'являються.</p>

      <div className="admin-sub-h" style={{ margin: "6px 0 8px" }}>Рейтинг магазинів за виконанням плану (середнє за наявні місяці)</div>
      {ranking === null ? <div className="loading">Завантаження…</div> : ranking.length === 0 ? (
        <div className="admin-empty">Ще недостатньо даних — потрібен хоча б один місяць із внесеним планом і зафіксованим фактом.</div>
      ) : (
        <div className="salon-list">
          {ranking.map((r) => (
            <div className="salon-row" key={r.salon.key} style={{ cursor: "default" }}>
              <span className="salon-row-main">
                <span className="salon-row-name">{salonLabel(r.salon)}</span>
                <span className="salon-row-sub">{r.monthsCounted} {r.monthsCounted === 1 ? "місяць" : "місяців"} з даними</span>
              </span>
              <b style={{ color: r.avgPct >= 100 ? "var(--positive)" : "var(--negative)" }}>{r.avgPct.toFixed(0)}%</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== РУХ БОНУСІВ ==================== */
const MONTH_SHORT = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
const bnum = (n) => (n == null ? "—" : Math.round(n).toLocaleString("uk-UA"));

function BonusModule({ cab }) {
  const scopeSalons = cab.type === "tm"
    ? salonsOfTm(cab.tmKey || cab.key)
    : cab.type === "sm" ? [salonByKey(cab.key)].filter(Boolean) : SALONS;
  const myKey = cab.tmKey || cab.key;
  const canEdit = (k) => {
    if (cab.type === "sm") return k === cab.key;
    if (cab.type === "tm") return salonTmOn(k) === myKey;
    if (cab.type === "manager") return true;
    return false;
  };

  const [ym, setYm] = useState(nowYm());
  const year = ym.slice(0, 4);
  const months = useMemo(() => recentMonths(15), []);
  const [rows, setRows] = useState(null);
  const [mRows, setMRows] = useState([]); // зафіксована помісячна аналітика
  const [pick, setPick] = useState(scopeSalons[0]?.key);
  const [editCell, setEditCell] = useState(null); // `${salonKey}:${mi}`
  const [busyFix, setBusyFix] = useState(false);
  const localEdit = useRef(0);

  const load = async () => {
    if (Date.now() - localEdit.current < 2500) return;
    setRows(await listBonusYear(year).catch(() => []));
  };
  const loadMonthly = async () => { setMRows(await listBonusMonthly(year).catch(() => [])); };
  useEffect(() => { setRows(null); localEdit.current = 0; load(); loadMonthly(); /* eslint-disable-next-line */ }, [year]);
  useEffect(() => subscribeBonus(() => { load(); loadMonthly(); }), [year]); // eslint-disable-line

  if (rows === null) return <div className="loading">Завантаження…</div>;

  const byDay = new Map();
  for (const r of rows) byDay.set(`${r.salon_key}|${r.work_date}`, r);
  const scopeKeys = scopeSalons.map((s) => s.key);
  const agg = bonusYearAgg(rows, scopeKeys);
  const mMap = bonusMonthlyMap(mRows, scopeKeys);
  const activeSalon = pick && scopeKeys.includes(pick) ? pick : scopeKeys[0];
  const editable = canEdit(activeSalon);
  const curYm = nowYm();
  const canManage = cab.type === "tm" || cab.type === "manager";
  // показник місяця для салону: зафіксований override → інакше пораховане з днів
  const cellVal = (k, mi) => {
    const mo = mMap[k]?.[mi];
    if (mo) return { v: mo.net, frozen: true };
    return { v: agg[k]?.months[mi] ?? null, frozen: false };
  };
  const monthPast = (mi) => `${year}-${String(mi + 1).padStart(2, "0")}` < curYm;

  const saveCell = async (k, mi, val) => {
    setEditCell(null);
    const m = `${year}-${String(mi + 1).padStart(2, "0")}`;
    localEdit.current = Date.now();
    try {
      if (val === "" || val == null) { await deleteBonusMonthly(k, m); }
      else { await upsertBonusMonthly([{ salon_key: k, ym: m, net: val, frozen: true }], cab.key); }
      loadMonthly();
    } catch (e) { pushToast({ title: "Не збережено", body: String(e.message || e) }); }
  };
  const freezeMonth = async () => {
    const mi = Number(ym.slice(5, 7)) - 1;
    const alreadyFrozen = scopeKeys.some((k) => mMap[k]?.[mi]?.frozen);
    if (!confirm(`Зафіксувати аналітику за ${monthLabel(ym)} по ${scopeSalons.length} салон(ах)?${alreadyFrozen ? " Раніше зафіксовані значення буде перезаписано пораху­нком із днів." : ""} Далі щоденні зміни не змінюватимуть цей місяць, доки не перефіксуєте.`)) return;
    setBusyFix(true);
    try {
      const payload = scopeSalons.map((s) => {
        let acc = 0, wr = 0, bn = 0;
        for (let d = 1; d <= bDaysInYm(ym); d++) {
          const r = byDay.get(`${s.key}|${bDateOf(ym, d)}`);
          if (!r) continue;
          acc += Number(r.accrued) || 0; wr += Number(r.writeoff) || 0; bn += Number(r.accrued_bn) || 0;
        }
        return { salon_key: s.key, ym, accrued: acc, writeoff: wr, accrued_bn: bn, net: acc + bn - wr, frozen: true };
      });
      await upsertBonusMonthly(payload, cab.key);
      pushToast({ title: "Місяць зафіксовано", body: monthLabel(ym) });
      loadMonthly();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusyFix(false);
  };
  const unfreezeMonth = async () => {
    const mi = Number(ym.slice(5, 7)) - 1;
    if (!confirm(`Розфіксувати ${monthLabel(ym)}? Показники знову рахуватимуться з щоденних записів.`)) return;
    setBusyFix(true);
    try {
      for (const s of scopeSalons) if (mMap[s.key]?.[mi]) await deleteBonusMonthly(s.key, ym);
      pushToast({ title: "Розфіксовано", body: monthLabel(ym) });
      loadMonthly();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusyFix(false);
  };

  const dim = bDaysInYm(ym);
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const todayD = todayISO();
  const monthWord = MONTH_NAMES[Number(ym.slice(5, 7)) - 1].toLowerCase();

  const commit = async (day, field, val) => {
    const d = bDateOf(ym, day);
    localEdit.current = Date.now();
    const num = val === "" || val == null ? 0 : Number(val) || 0;
    setRows((prev) => {
      const ex = prev.find((r) => r.salon_key === activeSalon && r.work_date === d);
      if (ex) return prev.map((r) => (r === ex ? { ...r, [field]: num } : r));
      return [...prev, { salon_key: activeSalon, work_date: d, accrued: 0, writeoff: 0, accrued_bn: 0, [field]: num }];
    });
    try { await saveBonusDay(activeSalon, d, { [field]: val }, cab.key); }
    catch (e) { pushToast({ title: "Не збережено", body: String(e.message || e) }); }
  };

  const mTot = { accrued: 0, writeoff: 0, accrued_bn: 0 };
  for (const day of days) {
    const r = byDay.get(`${activeSalon}|${bDateOf(ym, day)}`);
    if (!r) continue;
    mTot.accrued += Number(r.accrued) || 0;
    mTot.writeoff += Number(r.writeoff) || 0;
    mTot.accrued_bn += Number(r.accrued_bn) || 0;
  }
  const mNet = mTot.accrued + mTot.accrued_bn - mTot.writeoff;

  return (
    <div className="tm-mod bn-mod">
      <div className="tm-head">
        <h3 className="ov-h">Рух бонусів</h3>
        <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        {canManage && scopeSalons.length > 1 && (() => {
          const mi = Number(ym.slice(5, 7)) - 1;
          const frozenNow = scopeKeys.some((k) => mMap[k]?.[mi]?.frozen);
          return (
            <div className="bn-fix-btns">
              <button className="btn-secondary small" disabled={busyFix} onClick={freezeMonth}>
                {frozenNow ? "Перефіксувати" : "Зафіксувати"} {MONTH_NAMES[mi].toLowerCase()}
              </button>
              {frozenNow && <button className="btn-secondary small" disabled={busyFix} onClick={unfreezeMonth}>Розфіксувати</button>}
            </div>
          );
        })()}
      </div>

      {scopeSalons.length > 1 && (
        <div className="bn-roll-wrap">
          <table className="bn-roll">
            <thead>
              <tr><th>Салон</th>{MONTH_SHORT.map((m, i) => <th key={i}>{m}</th>)}<th>Рік</th></tr>
            </thead>
            <tbody>
              {scopeSalons.map((s) => {
                let yr = 0; let anyYr = false;
                return (
                  <tr key={s.key} className={s.key === activeSalon ? "on" : ""} onClick={() => setPick(s.key)}>
                    <td className="bn-roll-nm">{s.city === "Львів" ? shortAddr(s.addr).split(",")[0] : s.city}</td>
                    {MONTH_SHORT.map((_, i) => {
                      const { v, frozen } = cellVal(s.key, i);
                      if (v != null) { yr += v; anyYr = true; }
                      const key = `${s.key}:${i}`;
                      const canEditThis = canManage && canEdit(s.key) && (frozen || monthPast(i));
                      if (editCell === key) {
                        return (
                          <td key={i} className="num bn-edit" onClick={(e) => e.stopPropagation()}>
                            <NumInput className="bn-edit-in" allowEmpty value={v ?? ""} onChange={(nv) => saveCell(s.key, i, nv)} />
                          </td>
                        );
                      }
                      return (
                        <td key={i}
                          className={`num ${v == null ? "muted" : v < 0 ? "neg" : "pos"} ${frozen ? "bn-frozen" : ""} ${canEditThis ? "bn-cell-edit" : ""}`}
                          title={frozen ? "зафіксовано" : ""}
                          onClick={canEditThis ? (e) => { e.stopPropagation(); setEditCell(key); } : undefined}>
                          {v == null ? "·" : bnum(v)}
                        </td>
                      );
                    })}
                    <td className={`num bn-roll-yr ${!anyYr ? "muted" : yr < 0 ? "neg" : "pos"}`}>{anyYr ? bnum(yr) : "·"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bn-roll-terr">
                <td className="bn-roll-nm">Загально по території</td>
                {MONTH_SHORT.map((_, i) => {
                  let sum = 0; let any = false;
                  for (const k of scopeKeys) { const { v } = cellVal(k, i); if (v != null) { sum += v; any = true; } }
                  return <td key={i} className={`num ${!any ? "muted" : sum < 0 ? "neg" : "pos"}`}>{any ? bnum(sum) : "·"}</td>;
                })}
                {(() => {
                  let sum = 0; let any = false;
                  for (const k of scopeKeys) for (let i = 0; i < 12; i++) { const { v } = cellVal(k, i); if (v != null) { sum += v; any = true; } }
                  return <td className={`num bn-roll-yr ${!any ? "muted" : sum < 0 ? "neg" : "pos"}`}>{any ? bnum(sum) : "·"}</td>;
                })()}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {scopeSalons.length > 1 && (
        <div className="tm-salon-chips">
          {scopeSalons.map((s) => (
            <button key={s.key} className={`chip ${s.key === activeSalon ? "active" : ""}`} onClick={() => setPick(s.key)}>
              {s.city}, {shortAddr(s.addr)}
            </button>
          ))}
        </div>
      )}

      <div className="bn-sum">
        <div className="bn-sum-cell"><span>Нараховано</span><b>{bnum(mTot.accrued)}</b></div>
        <div className="bn-sum-cell"><span>Списано</span><b>{bnum(mTot.writeoff)}</b></div>
        <div className="bn-sum-cell"><span>Нараховано БН</span><b>{bnum(mTot.accrued_bn)}</b></div>
        <div className={`bn-sum-cell hero ${mNet < 0 ? "neg" : "pos"}`}><span>Баланс за {monthWord}</span><b>{bnum(mNet)}</b></div>
      </div>
      {(() => {
        const fs = mMap[activeSalon]?.[Number(ym.slice(5, 7)) - 1];
        return fs ? (
          <p className="hint bn-frozen-note">🔒 Місяць зафіксовано — у помісячній аналітиці по цьому салону стоїть <b>{bnum(fs.net)}</b>. Щоденні зміни нижче не змінюють цей показник, доки ТМ не перефіксує місяць.</p>
        ) : null;
      })()}

      <div className="tm-grid-wrap">
        <table className="tm-grid bn-grid">
          <thead>
            <tr><th className="tm-c-day">День</th><th>Нараховано</th><th>Списано</th><th>Нарах. БН</th><th>Баланс дня</th></tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const d = bDateOf(ym, day);
              const r = byDay.get(`${activeSalon}|${d}`) || {};
              const net = bonusNet(r);
              const filled = r.accrued || r.writeoff || r.accrued_bn;
              return (
                <tr key={day} className={d > todayD ? "tm-future" : ""}>
                  <td className="tm-c-day">{day}</td>
                  {["accrued", "writeoff", "accrued_bn"].map((f) => (
                    <td key={f}>
                      {editable
                        ? <NumInput className="tm-in" allowEmpty value={r[f] || ""} onChange={(v) => commit(day, f, v)} />
                        : <span>{r[f] ? bnum(r[f]) : "—"}</span>}
                    </td>
                  ))}
                  <td className={`num ${!filled ? "muted" : net < 0 ? "neg" : net > 0 ? "pos" : "muted"}`}>{filled ? bnum(net) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="tm-tot">
              <td className="tm-c-day">Разом</td>
              <td className="num">{bnum(mTot.accrued)}</td>
              <td className="num">{bnum(mTot.writeoff)}</td>
              <td className="num">{bnum(mTot.accrued_bn)}</td>
              <td className={`num ${mNet < 0 ? "neg" : "pos"}`}>{bnum(mNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Баланс = (Нараховано + БН) − Списано. Мінус — клієнти списали більше бонусів, ніж набрали. Вносить СМ щодня.
      </p>
    </div>
  );
}

/* ==================== ВИТРАТИ ПО СМ ==================== */
/* Внесення витрати вручну. Доступна СМ (свій магазин), ТМ (своя територія)
   і керівнику — тому магазин обирається, якщо в області видимості їх кілька. */
function ExpenseCreateModal({ salons, defaultSalon, onClose, onSaved }) {
  const [salonKey, setSalonKey] = useState(defaultSalon || salons[0]?.key || "");
  const [category, setCategory] = useState(MANUAL_CATEGORIES[0].key);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [when, setWhen] = useState(() => new Date().toISOString());
  const [file, setFile] = useState(null);
  const [shot, setShot] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = React.useRef(null);

  const pickFile = async (f) => {
    if (!f) return;
    setFile(f);
    try { setShot(await resizeImage(f)); } catch { setShot(""); }
  };

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      let receiptPath = "";
      if (file) receiptPath = await uploadReceipt(salonKey, file);
      await createExpense({
        salonKey, category, title, amount,
        spentOn: when.slice(0, 10),
        receiptPath,
      });
      pushToast({ title: "Витрату внесено", body: `${catOf(category).label} · ${suah(amount)}` });
      window.dispatchEvent(new Event("expenses:changed")); // модуль оновиться, з якого б входу не внесли
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e.message || e));
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal task-modal exp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Нова витрата</h3>
          <button className="modal-x" onClick={onClose} aria-label="Закрити"><X size={18} /></button>
        </div>
        <div className="modal-body">

        {salons.length > 1 && (
          <label className="over-field">
            <span>Магазин</span>
            <select className="inv-toolbar-sel" value={salonKey} onChange={(e) => setSalonKey(e.target.value)}>
              {salons.map((s) => <option key={s.key} value={s.key}>{salonShortName(s)}</option>)}
            </select>
          </label>
        )}

        <div className="over-field">
          <span>Категорія</span>
          <div className="exp-cats-pick">
            {MANUAL_CATEGORIES.map((c) => (
              <button type="button" key={c.key} className={`exp-cat-chip ${category === c.key ? "on" : ""}`}
                onClick={() => setCategory(c.key)}>
                <i style={{ background: c.color }} />{c.label}
              </button>
            ))}
          </div>
        </div>

        <label className="over-field">
          <span>Що саме</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Напр.: інтернет за вересень, Київстар" />
        </label>

        <div className="task-modal-row">
          <label className="over-field">
            <span>Сума, ₴</span>
            <NumInput value={amount} onChange={setAmount} aria-label="Сума витрати" />
          </label>
          <label className="over-field">
            <span>Дата витрати</span>
            <DateTimeField value={when} onChange={setWhen} dateOnly placeholder="Оберіть дату" />
          </label>
        </div>

        <div className="over-field">
          <span>Чек <em className="hint">— необов'язково</em></span>
          <div className="exp-shot">
            <div className="exp-shot-box">
              {shot ? <img src={shot} alt="чек" /> : <Camera size={22} />}
            </div>
            <div className="exp-shot-act">
              <button type="button" className="btn-secondary small" onClick={() => fileRef.current?.click()}>
                <Camera size={13} /> {shot ? "Змінити фото" : "Додати фото"}
              </button>
              {shot && <button type="button" className="wh-link" onClick={() => { setFile(null); setShot(""); }}>прибрати</button>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            </div>
          </div>
        </div>

        {err && <p className="hint" style={{ color: "var(--negative-bright)" }}>{err}</p>}
        </div>
        <div className="modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Скасувати</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Зберігаємо…" : "Зберегти витрату"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ExpensesModule({ cab }) {
  const own = cab.type === "sm" ? cab.key : null;
  const scopeSalons = cab.type === "tm" ? salonsOfTm(cab.tmKey || cab.key) : (own ? [salonByKey(own)].filter(Boolean) : SALONS);
  const [pick, setPick] = useState(own || (scopeSalons.length > 1 ? "all" : scopeSalons[0]?.key));
  const [allLines, setAllLines] = useState(null);   // усі списання (всі статті)
  const [articles, setArticles] = useState(WRITEOFF_ARTICLES_BUILTIN);
  const [items, setItems] = useState({});
  const [openM, setOpenM] = useState(null);
  const [view, setView] = useState("cats"); // cats | cmp | articles
  const months = useMemo(() => recentMonths(12), []);
  const [ym, setYm] = useState(months[0]);
  const [pa, setPa] = useState(months[1]);
  const [pb, setPb] = useState(months[0]);
  const [manual, setManual] = useState(null);        // витрати, внесені вручну
  const [mode, setMode] = useState("month");         // month | quarter | range
  const [rFrom, setRFrom] = useState(() => new Date(`${months[0]}-01T12:00:00`).toISOString());
  const [rTo, setRTo] = useState(() => new Date(`${months[0]}-${pad2(daysInMonth(months[0]))}T12:00:00`).toISOString());
  const [addOpen, setAddOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [receipt, setReceipt] = useState("");

  useEffect(() => {
    listItems({ includeArchived: true }).then((it) => setItems(Object.fromEntries(it.map((i) => [i.id, i]))));
    listWriteoffArticles().then(setArticles).catch(() => {});
    const onChanged = () => setReload((v) => v + 1);
    window.addEventListener("expenses:changed", onChanged);
    return () => window.removeEventListener("expenses:changed", onChanged);
  }, []);
  useEffect(() => {
    const from = `${months[months.length - 1]}-01`;
    const sk = pick === "all" ? undefined : pick;
    writeoffLines({ from, salonKey: sk })
      .then((ls) => ((cab.type === "tm" || cab.type === "manager" || cab.type === "accountant") && pick === "all"
        ? ls.filter((l) => scopeSalons.some((s) => s.key === actSalon(l.act)))
        : ls))
      .then(setAllLines).catch(() => setAllLines([]));
    // eslint-disable-next-line
  }, [pick]);
  useEffect(() => {
    const from = `${months[months.length - 1]}-01`;
    listExpenses({ from, salonKey: pick === "all" ? undefined : pick })
      .then((rows) => (pick === "all" ? rows.filter((r) => scopeSalons.some((s) => s.key === r.salon_key)) : rows))
      .then(setManual).catch(() => setManual([]));
    // eslint-disable-next-line
  }, [pick, reload]);

  if (allLines === null || manual === null) return <div className="loading">Завантаження…</div>;

  const expenseKeys = new Set(articles.filter((a) => a.expense).map((a) => a.key));
  const lines = allLines.filter((l) => expenseKeys.has(l.act?.article || "store"));

  // розбивка всіх списань за статтями (для «аналітики»)
  const byArticle = {};
  for (const l of allLines) {
    const ak = l.act?.article || "store";
    const b = byArticle[ak] = byArticle[ak] || { total: 0, byMonth: {} };
    const v = Number(l.qty) * Number(l.unit_cost);
    b.total += v;
    const ym = (l.act?.created_at || "").slice(0, 7);
    if (ym) b.byMonth[ym] = (b.byMonth[ym] || 0) + v;
  }
  const articleRows = articles
    .map((a) => ({ ...a, ...(byArticle[a.key] || { total: 0, byMonth: {} }) }))
    .concat(Object.keys(byArticle).filter((k) => !articles.some((a) => a.key === k))
      .map((k) => ({ key: k, label: k, expense: false, ...byArticle[k] })))
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  // Період аналізу: місяць / квартал / довільний діапазон
  const qm = quarterMonths(ymToQuarter(ym));
  const dayOf = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const [pFrom, pTo] = mode === "range" ? [dayOf(rFrom), dayOf(rTo)]
    : mode === "quarter" ? [`${qm[0]}-01`, `${qm[2]}-${pad2(daysInMonth(qm[2]))}`]
      : [`${ym}-01`, `${ym}-${pad2(daysInMonth(ym))}`];
  const inPeriod = (d) => !!d && d >= pFrom && d <= pTo;
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("uk-UA") : "");
  const periodLabel = mode === "range" ? `${fmtD(pFrom)} — ${fmtD(pTo)}`
    : mode === "quarter" ? `${monthLabel(qm[0])} — ${monthLabel(qm[2])}` : monthLabel(ym);

  // Джерело 1 — склад: фактичний розхід за статтями, що йдуть у витрати магазину
  const supplyLines = lines.filter((l) => inPeriod((l.act?.created_at || "").slice(0, 10)));
  const supplyTotal = supplyLines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_cost), 0);
  const supplyItems = (() => {
    const by = {};
    for (const l of supplyLines) {
      const it = by[l.item_id] = by[l.item_id] || { qty: 0, sum: 0 };
      it.qty += Number(l.qty);
      it.sum += Number(l.qty) * Number(l.unit_cost);
    }
    return Object.entries(by).map(([id, x]) => ({ name: items[id]?.name || "?", ...x })).sort((a, b) => b.sum - a.sum);
  })();

  // Джерело 2 — внесене вручну магазином, ТМ або керівником
  const manualInP = manual.filter((r) => inPeriod(r.spent_on));
  const categories = EXPENSE_CATEGORIES
    .map((c) => (c.key === "supply"
      ? { ...c, total: supplyTotal, items: supplyItems, rows: [] }
      : {
        ...c,
        total: manualInP.filter((r) => r.category === c.key).reduce((s, r) => s + Number(r.amount), 0),
        items: [],
        rows: manualInP.filter((r) => r.category === c.key).sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1)),
      }))
    .sort((a, b) => b.total - a.total);
  const catTotal = categories.reduce((s, c) => s + c.total, 0);
  const shown = categories.filter((c) => c.total > 0);

  // суми по ВСІХ категоріях за довільний місяць — для вкладки «Порівняти»
  const totalsForMonth = (m) => {
    const a = `${m}-01`;
    const b = `${m}-${pad2(daysInMonth(m))}`;
    const inM = (d) => !!d && d >= a && d <= b;
    const out = {
      supply: lines.filter((l) => inM((l.act?.created_at || "").slice(0, 10)))
        .reduce((s, l) => s + Number(l.qty) * Number(l.unit_cost), 0),
    };
    for (const c of MANUAL_CATEGORIES) {
      out[c.key] = manual.filter((r) => r.category === c.key && inM(r.spent_on))
        .reduce((s, r) => s + Number(r.amount), 0);
    }
    return out;
  };

  const removeRow = async (r) => {
    if (!window.confirm(`Видалити витрату «${r.title}» на ${suah(r.amount)}?`)) return;
    try {
      await deleteExpense(r.id, r.receipt_path);
      pushToast({ title: "Витрату видалено" });
      setReload((v) => v + 1);
    } catch (e) { pushToast({ title: "Не вдалося видалити", body: String(e.message || e) }); }
  };
  const openReceipt = async (r) => {
    try { setReceipt(await receiptUrl(r.receipt_path)); }
    catch { pushToast({ title: "Не вдалося відкрити чек" }); }
  };

  return (
    <div className="tasks-mod">
      <div className="tasks-head">
        <h3 className="ov-h">Витрати по СМ</h3>
        <button className="btn-primary small" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> {own ? "Витрата" : "Витрата за магазин"}
        </button>
      </div>

      {scopeSalons.length > 1 && (
        <div className="tm-salon-chips" style={{ marginBottom: 12 }}>
          <button className={`chip ${pick === "all" ? "active" : ""}`} onClick={() => setPick("all")}>усі</button>
          {scopeSalons.map((s) => <button key={s.key} className={`chip ${pick === s.key ? "active" : ""}`} onClick={() => setPick(s.key)}>{salonShortName(s)}</button>)}
        </div>
      )}
      <div className="inv-viewtabs" style={{ marginBottom: 12 }}>
        <button className={view === "cats" ? "on" : ""} onClick={() => setView("cats")}>Витрати</button>
        <button className={view === "articles" ? "on" : ""} onClick={() => setView("articles")}>Хоз-забезпечення · за статтями</button>
        <button className={view === "cmp" ? "on" : ""} onClick={() => setView("cmp")}>Порівняти</button>
      </div>

      {view === "cats" ? (
        <>
          <div className="exp-period">
            <div className="exp-period-seg">
              {[["month", "Місяць"], ["quarter", "Квартал"], ["range", "Період"]].map(([k, t]) => (
                <button key={k} type="button" className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{t}</button>
              ))}
            </div>
            {mode === "range" ? (
              <span className="exp-period-range">
                <DateTimeField value={rFrom} onChange={setRFrom} dateOnly placeholder="Від" />
                <span>—</span>
                <DateTimeField value={rTo} onChange={setRTo} dateOnly placeholder="До" />
              </span>
            ) : (
              <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            )}
          </div>
          <div className="exp-hero">
            <span className="exp-hero-l">Витрачено за {periodLabel}</span>
            <b className="exp-hero-v">{suah(catTotal)}</b>
          </div>
          <div className="exp-months">
            {shown.length === 0 && <div className="admin-empty">За цей період витрат немає.</div>}
            {shown.map((c) => (
              <div className="exp-month" key={c.key}>
                <button className="exp-month-h" onClick={() => setOpenM(openM === c.key ? null : c.key)}>
                  <i className="exp-dot" style={{ background: c.color }} />
                  <span>{c.label}{c.auto && <em className="exp-art-tag">зі складу</em>}</span>
                  <i className="exp-share"><i style={{ width: `${catTotal ? Math.round((c.total / catTotal) * 100) : 0}%`, background: c.color }} /></i>
                  <b>{suah(c.total)}</b>
                  <ChevronRight size={15} style={{ transform: openM === c.key ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                </button>
                {openM === c.key && (
                  <div className="exp-month-b">
                    {c.auto ? (
                      c.items.length === 0 ? <p className="hint">За цей період списань немає.</p> : c.items.map((r) => (
                        <div className="exp-row" key={r.name}><span>{r.name}</span><span className="mono">{r.qty} · {suahN(r.sum)} ₴</span></div>
                      ))
                    ) : c.rows.length === 0 ? <p className="hint">За цей період порожньо.</p> : c.rows.map((r) => (
                      <div className="exp-entry" key={r.id}>
                        <span className="exp-entry-d mono">{fmtD(r.spent_on)}</span>
                        <span className="exp-entry-t">
                          {r.title}
                          {pick === "all" && <em className="hint"> · {salonShortName(salonByKey(r.salon_key)) || r.salon_key}</em>}
                        </span>
                        {r.receipt_path
                          ? <button type="button" className="wh-link" onClick={() => openReceipt(r)}>чек</button>
                          : <span className="hint">без чека</span>}
                        <span className="mono exp-entry-a">{suahN(r.amount)} ₴</span>
                        <button type="button" className="exp-entry-x" onClick={() => removeRow(r)} aria-label="Видалити витрату"><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : view === "articles" ? (
        articleRows.length === 0 ? <div className="admin-empty">Списань ще немає.</div> : (
          <div className="exp-months">
            {articleRows.map((a) => (
              <div className="exp-month" key={a.key}>
                <button className="exp-month-h" onClick={() => setOpenM(openM === `a-${a.key}` ? null : `a-${a.key}`)}>
                  <span>{a.label}{a.expense ? <span className="exp-art-tag">у витрати магазину</span> : null}</span>
                  <b>{suah(a.total)}</b>
                  <ChevronRight size={15} style={{ transform: openM === `a-${a.key}` ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                </button>
                {openM === `a-${a.key}` && (
                  <div className="exp-month-b">
                    {months.filter((m) => a.byMonth[m]).map((m) => (
                      <div className="exp-row" key={m}><span>{monthLabel(m)}</span><span className="mono">{suahN(a.byMonth[m])} ₴</span></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : view === "cmp" ? (
        <div className="exp-cmp">
          <div className="exp-cmp-pick">
            <select className="inv-toolbar-sel" value={pa} onChange={(e) => setPa(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
            <span>vs</span>
            <select className="inv-toolbar-sel" value={pb} onChange={(e) => setPb(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
          </div>
          {(() => {
            const ta = totalsForMonth(pa);
            const tb = totalsForMonth(pb);
            const sum = (t) => Object.values(t).reduce((s, v) => s + v, 0);
            const rows = EXPENSE_CATEGORIES
              .map((c) => ({ ...c, a: ta[c.key] || 0, b: tb[c.key] || 0 }))
              .filter((r) => r.a || r.b)
              .sort((x, y) => (y.a + y.b) - (x.a + x.b));
            const dCell = (a, b) => {
              const d = b - a;
              if (!d) return <span className="exp-cmp-d">—</span>;
              return <span className={`exp-cmp-d ${d > 0 ? "up" : "down"}`}>{d > 0 ? "+" : "−"}{suahN(Math.abs(d))} ₴</span>;
            };
            return (
              <div className="exp-cmp-tab">
                <div className="exp-cmp-hrow">
                  <span />
                  <span>{monthLabel(pa)}</span>
                  <span>{monthLabel(pb)}</span>
                  <span>різниця</span>
                </div>
                {rows.length === 0 ? <div className="admin-empty">За обидва місяці витрат немає.</div> : rows.map((r) => (
                  <div className="exp-cmp-row" key={r.key}>
                    <span className="exp-cmp-n"><i className="exp-dot" style={{ background: r.color }} />{r.label}</span>
                    <span className="mono">{suahN(r.a)} ₴</span>
                    <span className="mono">{suahN(r.b)} ₴</span>
                    {dCell(r.a, r.b)}
                  </div>
                ))}
                <div className="exp-cmp-row exp-cmp-sum">
                  <span className="exp-cmp-n">Разом</span>
                  <span className="mono">{suahN(sum(ta))} ₴</span>
                  <span className="mono">{suahN(sum(tb))} ₴</span>
                  {dCell(sum(ta), sum(tb))}
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}
      {addOpen && (
        <ExpenseCreateModal
          salons={own ? scopeSalons.filter((s) => s.key === own) : scopeSalons}
          defaultSalon={own || (pick !== "all" ? pick : scopeSalons[0]?.key)}
          onClose={() => setAddOpen(false)}
          onSaved={() => setReload((v) => v + 1)}
        />
      )}
      {receipt && <ImageModal src={receipt} onClose={() => setReceipt("")} />}
    </div>
  );
}

/* Персональне налаштування лівої навігації: порядок, приховані пункти,
   згорнуті групи та перекидання пункту в іншу групу.
   Зберігається локально на пристрої, окремо для кожного кабінету. */
function useNavPrefs(cabKey, itemKeys) {
  const storeKey = `dnipro-m-nav:${cabKey}`;
  const [prefs, setPrefs] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(storeKey) || "{}");
      return {
        order: Array.isArray(p.order) ? p.order : [],
        hidden: Array.isArray(p.hidden) ? p.hidden : [],
        collapsed: Array.isArray(p.collapsed) ? p.collapsed : [],
        groups: p.groups && typeof p.groups === "object" ? p.groups : {},
      };
    } catch { return { order: [], hidden: [], collapsed: [], groups: {} }; }
  });
  const save = (patch) => {
    const next = { order: prefs.order, hidden: prefs.hidden, collapsed: prefs.collapsed, groups: prefs.groups, ...patch };
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
    save({ order: arr });
  };
  const moveTo = (key, targetKey) => {
    if (key === targetKey) return;
    const arr = ordered.filter((k) => k !== key);
    const at = arr.indexOf(targetKey);
    if (at < 0) return;
    arr.splice(at, 0, key);
    save({ order: arr });
  };
  /* кинути пункт у групу group, перед beforeKey (або в кінець, якщо null) — за один запис */
  const dropInGroup = (key, group, beforeKey) => {
    const arr = ordered.filter((k) => k !== key);
    const at = beforeKey && arr.includes(beforeKey) ? arr.indexOf(beforeKey) : arr.length;
    arr.splice(at, 0, key);
    save({ order: arr, groups: { ...prefs.groups, [key]: group } });
  };
  const toggleHidden = (key) => {
    const hidden = prefs.hidden.includes(key)
      ? prefs.hidden.filter((k) => k !== key)
      : [...prefs.hidden, key];
    if (hidden.length >= itemKeys.length) return; // не ховати геть усе
    save({ hidden });
  };
  const toggleCollapsed = (g) => {
    const collapsed = prefs.collapsed.includes(g)
      ? prefs.collapsed.filter((x) => x !== g)
      : [...prefs.collapsed, g];
    save({ collapsed });
  };
  const reset = () => save({ order: [], hidden: [], collapsed: [], groups: {} });

  return {
    ordered, hidden: prefs.hidden, collapsed: prefs.collapsed,
    groupOf: (k) => prefs.groups[k],
    customised: !!(prefs.order.length || prefs.hidden.length || Object.keys(prefs.groups).length),
    move, moveTo, dropInGroup, toggleHidden, toggleCollapsed, reset,
  };
}

const NAV_PINNED_GROUP = "Головне";
const NAV_DEFAULT_GROUP = "Інше";
const ORG_GROUP = "Орг-структура";

/* =========================================================
   МОДУЛЬ «КОДИ ЗСУ −15%»
========================================================= */
function ZsuUsedModal({ code, onClose, onSave }) {
  const [rc, setRc] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!rc.trim() || !date) return;
    setBusy(true);
    try { await onSave(rc.trim(), date); } finally { setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="zsu-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Код використано</h3>
        <p className="hint">Код <b>{code.code}</b> · {salonByKey(code.salon_key)?.city}</p>
        <label className="over-field" style={{ maxWidth: "100%" }}><span>Номер чека</span>
          <input value={rc} onChange={(e) => setRc(e.target.value)} autoFocus placeholder="напр. 7703020742" />
        </label>
        <label className="over-field" style={{ maxWidth: "100%" }}><span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="zsu-modal-f">
          <button className="btn-secondary" onClick={onClose}>Скасувати</button>
          <button className="btn-primary" disabled={busy || !rc.trim() || !date} onClick={save}>{busy ? "…" : "Відмітити"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ZsuCodesModule({ cab }) {
  const isSm = cab.type === "sm";
  const manage = cab.type === "tm" || cab.type === "manager"; // andriy = tm
  const mySalons = useMemo(() => {
    if (isSm) return SALONS.filter((s) => s.key === cab.key);
    if (cab.type === "tm") { const my = cab.tmKey || cab.key; return SALONS.filter((s) => salonTmOn(s.key) === my); }
    return SALONS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cab.key, cab.type, cab.tmKey]);
  const [codes, setCodes] = useState(null);
  const [salonKey, setSalonKey] = useState(mySalons[0]?.key || "");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [usedT, setUsedT] = useState(null);
  const [expand, setExpand] = useState({});

  const reload = React.useCallback(() => {
    listZsuCodes(isSm ? { salonKey: cab.key } : {}).then(setCodes).catch(() => setCodes([]));
  }, [cab.key, isSm]);
  useEffect(() => { reload(); return subscribeZsuCodes(reload); }, [reload]);

  const upload = async () => {
    const list = parseCodes(raw);
    if (!list.length || !salonKey) { pushToast({ title: "Немає кодів", body: "Вставте коди (по одному в рядку)" }); return; }
    if (!confirm(`Вигрузити ${list.length} промокод(ів) у ${salonByKey(salonKey)?.city}?`)) return;
    setBusy(true);
    try {
      const { added, dup } = await uploadZsuCodes(salonKey, list, cab.key);
      if (added) await notify({ recipient: salonKey, kind: "zsu", title: `Вам вигружено ${added} промокод(ів) ЗСУ −15%`, body: "Вкладка «Коди ЗСУ»", actor: cab.key, link: "zsu" }).catch(() => {});
      pushToast({ title: added ? `Вигружено ${added}` : "Нових немає", body: dup ? `${dup} вже були` : "" });
      setRaw("");
      reload();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
    setBusy(false);
  };
  const setUsed = async (rc, date) => {
    try {
      await markZsuUsed(usedT.id, rc, date, cab.key);
      pushToast({ title: "Код відмічено", body: `чек ${rc}` });
      setUsedT(null); reload();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
  };
  // window.confirm ненадійний у мобільному PWA — діємо одразу й показуємо toast
  const undo = async (c) => {
    try { await undoZsuUsed(c.id); pushToast({ title: "Повернуто у невикористані", body: c.code }); reload(); }
    catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
  };
  const remove = async (c) => {
    try { await deleteZsuCode(c.id); pushToast({ title: "Код видалено", body: c.code }); reload(); }
    catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
  };

  if (codes === null) return <div className="loading">Завантаження…</div>;

  const byS = {};
  codes.forEach((c) => { (byS[c.salon_key] ||= []).push(c); });
  const listSalons = isSm ? mySalons : mySalons.filter((s) => byS[s.key]?.length);

  return (
    <div className="tasks-mod zsu-mod">
      <div className="tasks-head"><h3 className="ov-h">Коди ЗСУ −15%</h3></div>
      <div className="zsu-note">
        <ShieldCheck size={14} /> Обов'язкова умова використання — наявність у клієнта посвідчення УБД та надання його до ознайомлення.
        Промокод не діє на товар, який у роздріб неакційний, але діє паралельно з іншими акціями (набори, разом дешевше тощо).
      </div>

      {manage && (
        <div className="zsu-assign">
          <div className="zsu-assign-h">Призначити коди</div>
          <select value={salonKey} onChange={(e) => setSalonKey(e.target.value)}>
            {mySalons.map((s) => <option key={s.key} value={s.key}>{salonLabel(s)}</option>)}
          </select>
          <textarea rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Вставте коди — по одному в рядку або через кому" />
          <div className="zsu-assign-f">
            <span className="hint">{parseCodes(raw).length} код(ів) розпізнано</span>
            <button className="btn-primary" disabled={busy || !parseCodes(raw).length} onClick={upload}>Вигрузити промокоди</button>
          </div>
        </div>
      )}

      {listSalons.map((s) => {
        const list = (byS[s.key] || []).slice().sort((a, b) => Number(a.used) - Number(b.used) || a.code.localeCompare(b.code));
        const used = list.filter((c) => c.used).length;
        const open = isSm || expand[s.key];
        return (
          <div className="zsu-salon" key={s.key}>
            <button className="zsu-salon-h" onClick={() => !isSm && setExpand((x) => ({ ...x, [s.key]: !x[s.key] }))}>
              <span>{salonLabel(s)}</span>
              <span className="zsu-salon-c">{list.length - used} вільних · {used} використано</span>
            </button>
            {open && list.length === 0 && <p className="hint" style={{ padding: "4px 10px" }}>кодів немає</p>}
            {open && list.length > 0 && (
              <div className="zsu-codes">
                {list.map((c) => (
                  <div className={`zsu-code ${c.used ? "used" : ""}`} key={c.id}>
                    <span className="zsu-code-v">{c.code}</span>
                    {c.used ? (
                      <>
                        <span className="zsu-code-rc">чек {c.receipt_no || "—"}{c.used_on ? ` · ${fmtDeadline(c.used_on)}` : ""}</span>
                        {(isSm ? c.salon_key === cab.key : manage) && <button className="zsu-undo" title="Повернути в невикористані" onClick={() => undo(c)}><RefreshCw size={12} /></button>}
                      </>
                    ) : (
                      <>
                        {isSm && c.salon_key === cab.key && <button className="btn-secondary zsu-use" onClick={() => setUsedT(c)}>Використано</button>}
                        {manage && <button className="zsu-undo" title="Видалити код" onClick={() => remove(c)}><Trash2 size={12} /></button>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {usedT && <ZsuUsedModal code={usedT} onClose={() => setUsedT(null)} onSave={setUsed} />}
    </div>
  );
}

/* =========================================================
   МОДУЛЬ «ПРОХОДЖЕННЯ ТЕСТУВАНЬ»
========================================================= */
function TrainingCreateModal({ cabKey, onClose, onDone }) {
  const [title, setTitle] = useState("");
  const [assigned, setAssigned] = useState("");
  const [deadline, setDeadline] = useState("");
  const [shot, setShot] = useState("");
  const [ocr, setOcr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef(null);

  const onFile = async (file) => {
    if (!file) return;
    setOcr("Розпізнаю скріншот…");
    try {
      const url = await resizeImage(file);
      setShot(url);
      const r = await extractTrainingScreenshot(url);
      if (r.title) setTitle(r.title);
      if (r.assigned_on) setAssigned(r.assigned_on);
      if (r.deadline) setDeadline(r.deadline);
      setOcr(r.title || r.deadline ? "Розпізнано — перевірте поля нижче" : "Не вдалося розпізнати, заповніть вручну");
    } catch (e) { setOcr(String(e.message || e)); }
  };
  useEffect(() => {
    const h = (e) => { const f = pasteEventImage(e); if (f) { e.preventDefault(); onFile(f); } };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pasteShot = async () => {
    const f = await readClipboardImage();
    if (f) onFile(f); else setOcr("У буфері немає зображення — скопіюйте скріншот і спробуйте ще");
  };
  const save = async () => {
    if (!title.trim()) return;
    if (assigned && deadline && deadline < assigned) { alert("Дедлайн раніше за дату призначення"); return; }
    setBusy(true);
    try {
      await createTraining({ title: title.trim(), assigned_on: assigned || null, deadline: deadline || null, screenshot: shot || null, created_by: cabKey });
      pushToast({ title: "Тестування додано", body: title.trim() });
      onDone();
    } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); setBusy(false); }
  };
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="trn-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Нове тестування</h3>
        <div className="trn-upl-row">
          <button className="btn-secondary trn-upl" onClick={() => fileRef.current?.click()}><Camera size={14} /> Завантажити скріншот</button>
          <button className="btn-secondary trn-upl" onClick={pasteShot}><ImageIcon size={14} /> Вставити з буфера</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {ocr && <div className="trn-ocr">{ocr}</div>}
        {shot && <img src={shot} alt="" className="trn-shot" />}
        <label className="over-field" style={{ maxWidth: "100%" }}><span>Назва тестування</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Стандарти сервісу" />
        </label>
        <div className="trn-dates">
          <label className="over-field"><span>Призначено</span><input type="date" value={assigned} onChange={(e) => setAssigned(e.target.value)} /></label>
          <label className="over-field"><span>Дедлайн</span><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        </div>
        <div className="trn-modal-f">
          <button className="btn-secondary" onClick={onClose}>Скасувати</button>
          <button className="btn-primary" disabled={busy || !title.trim()} onClick={save}>Додати</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* «Не призначено» — це відповідь СМ (тест цьому співробітнику не потрібен), тож зараховується як опрацьоване, разом із «Виконано».
   Немає запису взагалі — відповіді ще не було. */
const trnCounted = (r) => !!r && (!!r.passed || r.status === "not_assigned");
const TRN_STATUS = {
  passed: ["Виконано", "ok"], failed: ["Провалено", "bad"], not_passed: ["Не пройдено", "warn"], not_assigned: ["Не призначено", ""],
};

/* Тестування: картка відкривається вікном зі статусом проходження по магазинах і співробітниках */
function TrainingDetail({ t, info, resKey, activeEmps, manage, onClose, onDelete, onPhoto }) {
  const [zoom, setZoom] = useState(null);
  const [delArmed, setDelArmed] = useState(false);
  const fileRef = React.useRef(null);
  const { dleft, srows, totT, passT, pctT } = info;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="trn-detail" onClick={(e) => e.stopPropagation()}>
        <div className="trn-card-h">
          <b>{t.title}</b>
          <button className="modal-close" onClick={onClose} aria-label="Закрити"><X size={16} /></button>
        </div>
        <div className="trn-card-meta">
          {t.assigned_on && <span className="trn-pill">призначено {fmtDeadline(t.assigned_on)}</span>}
          <span className="trn-pill">{t.deadline ? `дедлайн ${fmtDeadline(t.deadline)}` : "без дедлайну"}</span>
          {dleft != null && (
            <span className={`trn-pill ${dleft < 0 ? "bad" : dleft <= 3 ? "warn" : "ok"}`}>
              {dleft < 0 ? `прострочено ${-dleft} дн.` : dleft === 0 ? "дедлайн сьогодні" : `${dleft} дн. лишилось`}
            </span>
          )}
        </div>
        {t.screenshot && <button className="trn-detail-shot" onClick={() => setZoom(t.screenshot)}><img src={t.screenshot} alt="" /></button>}
        <div className="trn-terr">
          <span className="trn-terr-lab">Пройшло</span>
          <b className="trn-terr-num">{passT}/{totT}</b>
          <div className="trn-terr-bar"><i className={pctT === 100 ? "full" : ""} style={{ width: `${pctT}%` }} /></div>
          <span className="trn-terr-pct">{pctT}%</span>
        </div>
        <div className="trn-dlist">
          {srows.map(({ s: sl, emps, passed }) => (
            <div className="trn-dsalon" key={sl.key}>
              <div className="trn-dsalon-h">
                <span>{sl.city}, {shortAddr(sl.addr)}</span>
                <b className={passed.length === emps.length ? "ok" : ""}>{passed.length}/{emps.length}</b>
              </div>
              {emps.map((e) => {
                const r = resKey(t.id, e.id) || {};
                const [label, tone] = r.status ? (TRN_STATUS[r.status] || TRN_STATUS.not_assigned) : ["Немає відповіді", "bad"];
                return (
                  <div className="trn-de" key={e.id}>
                    <span className="trn-de-nm">{e.full_name}<span className="trn-role">{empRoleShort[e.role]}</span></span>
                    {r.score != null && r.status !== "not_assigned" && r.status !== "not_passed" && <span className="trn-de-sc">{r.score}</span>}
                    {r.passed && r.passed_on && <span className="trn-de-dt">{fmtDeadline(r.passed_on)}</span>}
                    <span className={`trn-pill ${tone}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {srows.length === 0 && <p className="hint">немає активних співробітників</p>}
        </div>
        {manage && (
          <div className="trn-modal-f">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
            <button className="btn-secondary small" onClick={() => fileRef.current?.click()}><Camera size={13} /> {t.screenshot ? "Змінити фото" : "Додати фото"}</button>
            <span style={{ flex: 1 }} />
            <button className="btn-secondary small" onClick={() => { if (!delArmed) { setDelArmed(true); setTimeout(() => setDelArmed(false), 4000); } else onDelete(); }}>
              <Trash2 size={13} /> {delArmed ? "Точно видалити?" : "Видалити"}
            </button>
          </div>
        )}
      </div>
      {zoom && <ImageModal src={zoom} onClose={() => setZoom(null)} />}
    </div>,
    document.body,
  );
}

function TrainingModule({ cab }) {
  const isSm = cab.type === "sm";
  const manage = cab.type === "tm" || cab.type === "manager";
  const my = cab.tmKey || cab.key;
  const scopeSalons = useMemo(() => {
    if (isSm) return SALONS.filter((s) => s.key === cab.key);
    if (cab.type === "tm") return SALONS.filter((s) => salonTmOn(s.key) === my);
    return SALONS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cab.key, cab.type, my]);
  const [trainings, setTrainings] = useState(null);
  const [results, setResults] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("active");
  const [ym, setYm] = useState(nowYm());
  const [add, setAdd] = useState(false);
  const [openId, setOpenId] = useState(null);
  const months = useMemo(() => recentMonths(12), []);

  const reload = React.useCallback(async () => {
    const [t, e] = await Promise.all([listTrainings({ includeArchived: true }).catch(() => []), listEmployees().catch(() => [])]);
    setTrainings(t); setEmployees(e);
    const r = await listTrainingResults(t.map((x) => x.id)).catch(() => []);
    setResults(r);
  }, []);
  useEffect(() => { reload(); return subscribeTrainings(reload); }, [reload]);

  if (trainings === null) return <div className="loading">Завантаження…</div>;

  const activeEmps = employees.filter((e) => e.status === "active" && scopeSalons.some((s) => s.key === e.salon_key));
  const resKey = (tid, eid) => results.find((r) => r.training_id === tid && r.employee_id === eid);
  const activeTrainings = trainings.filter((t) => !t.archived);

  const setResult = async (t, emp, patch) => {
    const cur = resKey(t.id, emp.id) || {};
    const status = patch.status ?? cur.status ?? "not_assigned";
    const row = {
      training_id: t.id, employee_id: emp.id, salon_key: emp.salon_key,
      status, passed: status === "passed",
      // «Не призначено» і «Не пройдено» — бал не має сенсу, тож не зберігаємо
      score: status === "not_assigned" || status === "not_passed" ? null : (patch.score !== undefined ? patch.score : cur.score ?? null),
      passed_on: status === "passed" ? (cur.passed_on || todayISO()) : null,
      updated_by: cab.key,
    };
    try { await upsertTrainingResult(row); reload(); }
    catch (e) { alert(e.message || e); }
  };

  const addBtn = manage ? <button className="btn-primary" onClick={() => setAdd(true)}><Plus size={14} /> Тестування</button> : null;
  const tabs = manage ? (
    <div className="trn-tabs">
      <button className={tab === "active" ? "on" : ""} onClick={() => setTab("active")}>Активні</button>
      <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>Історія</button>
    </div>
  ) : null;

  const trainingInfo = (t) => {
    const dleft = daysToDeadline(t.deadline);
    const srows = scopeSalons.map((sl) => {
      const emps = activeEmps.filter((e) => e.salon_key === sl.key);
      const passed = emps.filter((e) => trnCounted(resKey(t.id, e.id)));
      return { s: sl, emps, passed, miss: emps.filter((e) => !trnCounted(resKey(t.id, e.id))) };
    }).filter((r) => r.emps.length);
    const totT = srows.reduce((a, r) => a + r.emps.length, 0);
    const passT = srows.reduce((a, r) => a + r.passed.length, 0);
    return { dleft, srows, totT, passT, pctT: totT ? Math.round((passT / totT) * 100) : 0 };
  };

  // ---- ТМ / керівник: дошка тестувань (як «Безнальні рахунки → Дошка») ----
  if (!isSm && tab === "active") {
    const cols = [["over", "Прострочено"], ["run", "У процесі"], ["done", "Пройдено всіма"]];
    const by = { over: [], run: [], done: [] };
    activeTrainings.forEach((t) => {
      const i = trainingInfo(t);
      by[i.totT > 0 && i.passT === i.totT ? "done" : i.dleft != null && i.dleft < 0 ? "over" : "run"].push({ t, i });
    });
    const opened = openId ? activeTrainings.find((x) => x.id === openId) : null;
    return (
      <div className="tasks-mod trn-mod">
        <div className="tasks-head">
          <h3 className="ov-h">Проходження тестувань</h3>
          {tabs}{addBtn}
        </div>
        {activeTrainings.length === 0 && <p className="hint">активних тестувань немає</p>}
        <div className="inv-board">
          {cols.map(([k, title]) => (
            <div className="inv-col" key={k}>
              <div className="inv-col-h"><span>{title}</span><span className="mono">{by[k].length}</span></div>
              <div className="inv-col-body">
                {by[k].length === 0 ? <p className="inv-col-empty">—</p> : by[k].map(({ t, i }) => (
                  <button key={t.id} className={`trn-bcard ${k}`} onClick={() => setOpenId(t.id)}>
                    {t.screenshot && <img className="trn-bcover" src={t.screenshot} alt="" loading="lazy" />}
                    <span className="trn-bcard-b">
                      <span className="trn-bcard-t">{t.title}</span>
                      <span className="trn-card-meta" style={{ margin: 0 }}>
                        <span className="trn-pill">{t.deadline ? `дедлайн ${fmtDeadline(t.deadline)}` : "без дедлайну"}</span>
                        {i.dleft != null && k !== "done" && (
                          <span className={`trn-pill ${i.dleft < 0 ? "bad" : i.dleft <= 3 ? "warn" : "ok"}`}>
                            {i.dleft < 0 ? `прострочено ${-i.dleft} дн.` : i.dleft === 0 ? "сьогодні" : `${i.dleft} дн.`}
                          </span>
                        )}
                      </span>
                      <span className="trn-terr" style={{ margin: 0, padding: "6px 9px" }}>
                        <b className="trn-terr-num">{i.passT}/{i.totT}</b>
                        <span className="trn-terr-bar"><i className={i.pctT === 100 ? "full" : ""} style={{ width: `${i.pctT}%` }} /></span>
                        <span className="trn-terr-pct">{i.pctT}%</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {opened && (
          <TrainingDetail
            t={opened} info={trainingInfo(opened)} resKey={resKey} activeEmps={activeEmps} manage={manage}
            onClose={() => setOpenId(null)}
            onDelete={() => { deleteTraining(opened.id).then(() => { setOpenId(null); reload(); pushToast({ title: "Тестування видалено" }); }).catch((e) => pushToast({ title: "Не вдалося видалити", body: String(e.message || e) })); }}
            onPhoto={async (f) => {
              try { const url = await resizeImage(f); await updateTraining(opened.id, { screenshot: url }); reload(); pushToast({ title: "Фото оновлено" }); }
              catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); }
            }}
          />
        )}
        {add && <TrainingCreateModal cabKey={cab.key} onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload(); }} />}
      </div>
    );
  }

  // ---- СМ: свої співробітники зі статусами ----
  if (isSm) {
    return (
      <div className="tasks-mod trn-mod">
        <div className="tasks-head">
          <h3 className="ov-h">Проходження тестувань</h3>
          {tabs}{addBtn}
        </div>
        {activeTrainings.length === 0 && <p className="hint">активних тестувань немає</p>}
        {activeTrainings.map((t) => {
          const dleft = daysToDeadline(t.deadline);
          const srows = scopeSalons.map((s) => {
            const emps = activeEmps.filter((e) => e.salon_key === s.key);
            const passed = emps.filter((e) => trnCounted(resKey(t.id, e.id)));
            const miss = emps.filter((e) => !trnCounted(resKey(t.id, e.id)));
            return { s, emps, passed, miss };
          }).filter((r) => r.emps.length);
          const totT = srows.reduce((a, r) => a + r.emps.length, 0);
          const passT = srows.reduce((a, r) => a + r.passed.length, 0);
          const pctT = totT ? Math.round((passT / totT) * 100) : 0;
          return (
            <div className={`trn-card ${dleft != null && dleft < 0 ? "overdue" : dleft != null && dleft <= 3 ? "urgent" : ""}`} key={t.id}>
              <div className="trn-card-h">
                <b>{t.title}</b>
                {manage && <button className="trn-del" title="Видалити" onClick={() => { if (confirm("Видалити тестування?")) deleteTraining(t.id).then(reload); }}><Trash2 size={13} /></button>}
              </div>
              <div className="trn-card-meta">
                {t.assigned_on && <span className="trn-pill">призначено {fmtDeadline(t.assigned_on)}</span>}
                <span className="trn-pill">{t.deadline ? `дедлайн ${fmtDeadline(t.deadline)}` : "без дедлайну"}</span>
                {dleft != null && (
                  <span className={`trn-pill ${dleft < 0 ? "bad" : dleft <= 3 ? "warn" : "ok"}`}>
                    {dleft < 0 ? `прострочено ${-dleft} дн.` : dleft === 0 ? "дедлайн сьогодні" : `${dleft} дн. лишилось`}
                  </span>
                )}
              </div>

              {isSm ? (
                <table className="trn-emp-tbl"><tbody>
                  {activeEmps.length === 0 && <tr><td className="hint">немає активних співробітників</td></tr>}
                  {activeEmps.map((e) => {
                    const r = resKey(t.id, e.id) || {};
                    const status = r.status || "";
                    return (
                      <tr key={e.id} className={trnCounted(r) ? "done" : ""}>
                        <td>{e.full_name}<span className="trn-role">{empRoleShort[e.role]}</span></td>
                        <td className="trn-status">
                          <select className="trn-status-sel" value={status} onChange={(ev) => setResult(t, e, { status: ev.target.value })}>
                            {!status && <option value="" disabled>— оберіть —</option>}
                            <option value="not_assigned">Не призначено</option>
                            <option value="passed">Виконано</option>
                            <option value="not_passed">Не пройдено</option>
                            <option value="failed">Провалено</option>
                          </select>
                        </td>
                        <td className="trn-score">
                          {(status === "passed" || status === "failed") && (
                            <NumInput value={r.score ?? ""} allowEmpty placeholder="бал" className="trn-score-in"
                              onChange={(v) => setResult(t, e, { score: v === "" || v == null ? null : Number(v) })} />
                          )}
                        </td>
                        <td className="trn-when">{r.passed && r.passed_on ? fmtDeadline(r.passed_on) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody></table>
              ) : (
                <>
                  <div className="trn-terr">
                    <span className="trn-terr-lab">Пройшло по території</span>
                    <b className="trn-terr-num">{passT}/{totT}</b>
                    <div className="trn-terr-bar"><i className={pctT === 100 ? "full" : ""} style={{ width: `${pctT}%` }} /></div>
                    <span className="trn-terr-pct">{pctT}%</span>
                  </div>
                  <div className="trn-slist">
                    {srows.map(({ s, emps, passed, miss }) => {
                      const state = passed.length === emps.length ? "ok" : passed.length === 0 ? "none" : "part";
                      return (
                        <div className={`trn-srow ${state}`} key={s.key}>
                          <span className="trn-srow-nm">{s.city}, {shortAddr(s.addr)}</span>
                          <span className="trn-dots">
                            {emps.slice(0, 12).map((e, i) => <i key={i} className={`trn-dot ${trnCounted(resKey(t.id, e.id)) ? "on" : ""}`} />)}
                          </span>
                          <span className="trn-srow-n">{passed.length}/{emps.length}</span>
                          {miss.length === 0
                            ? <span className="trn-srow-miss ok">усі пройшли</span>
                            : <span className="trn-srow-miss">{miss.map((e) => e.full_name).join(", ")}</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {add && <TrainingCreateModal cabKey={cab.key} onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload(); }} />}
      </div>
    );
  }

  // ---- історія (ТМ/керівник) ----
  const monthTrainings = trainings.filter((t) => String(t.deadline || t.assigned_on || "").slice(0, 7) === ym);
  return (
    <div className="tasks-mod trn-mod">
      <div className="tasks-head">
        <h3 className="ov-h">Проходження тестувань</h3>
        {tabs}
        <select className="inv-toolbar-sel" value={ym} onChange={(e) => setYm(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="trn-avg">
        <div className="trn-avg-h">Середній бал по СМ · {monthLabel(ym)}</div>
        {scopeSalons.map((s) => {
          const avg = salonMonthAvg(results, s.key, ym);
          return (
            <div className="trn-avg-row" key={s.key}>
              <span>{s.city}, {shortAddr(s.addr)}</span>
              <b>{avg == null ? "—" : avg.toFixed(1)}</b>
            </div>
          );
        })}
      </div>

      {monthTrainings.length === 0 && <p className="hint">за {monthLabel(ym)} тестувань немає</p>}
      {monthTrainings.map((t) => (
        <div className="trn-card" key={t.id}>
          <div className="trn-card-h">
            <b>{t.title}</b>
            <span className="trn-card-meta">дедлайн {t.deadline ? fmtDeadline(t.deadline) : "—"}</span>
          </div>
          <div className="trn-salon-grid">
            {scopeSalons.map((s) => {
              const rs = results.filter((r) => r.training_id === t.id && r.salon_key === s.key);
              const pass = rs.filter(trnCounted).length;
              const scored = rs.filter((r) => r.passed && r.score != null).map((r) => Number(r.score));
              const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
              const tot = Math.max(employees.filter((e) => e.salon_key === s.key && e.status === "active").length, rs.length);
              return (
                <div className="trn-salon-row" key={s.key}>
                  <span className="trn-salon-nm">{s.city}, {shortAddr(s.addr)}</span>
                  <span className="trn-salon-p">{pass}/{tot} пройшли{avg != null ? ` · бал ${avg.toFixed(1)}` : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {add && <TrainingCreateModal cabKey={cab.key} onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload(); }} />}
    </div>
  );
}

/* Реєстр вкладок, які адмін може ДОДАТИ будь-якому кабінету поверх рідних
   (вкладка «Доступ до вкладок» → «Додати вкладку»). Портативні модулі —
   рендеряться від контексту { key, type, tmKey }. «ЗП ТМ»/«ЗП» та інші
   кабінет-специфічні вкладки сюди навмисно не входять. */
const ADDABLE_MODULES = [
  { key: "tasks", label: "Задачі", group: ORG_GROUP, icon: <CheckSquare size={16} />, render: (c) => <TasksModule cab={c} /> },
  { key: "shifts", wide: true, label: "Графік змін", group: ORG_GROUP, icon: <Calendar size={16} />, render: (c) => <ShiftScheduleModule cab={c} /> },
  { key: "kpi", label: "Показники території", group: "Щоденне", icon: <BarChart3 size={16} />, render: (c) => <TerritoryModule cab={c} /> },
  { key: "warehouse", label: "Склад", group: ORG_GROUP, icon: <Warehouse size={16} />, render: (c) => <SupplyModule cab={c} /> },
  { key: "expenses", label: "Витрати по СМ", group: ORG_GROUP, icon: <TrendingDown size={16} />, render: (c) => <ExpensesModule cab={c} /> },
  { key: "bonus", label: "Рух бонусів", group: ORG_GROUP, icon: <Sparkles size={16} />, render: (c) => <BonusModule cab={c} /> },
  { key: "bn", label: "Безнальні рахунки", group: ORG_GROUP, icon: <CreditCard size={16} />, render: (c) => <InvoicesModule cab={c} /> },
  { key: "directory", label: "Довідник", group: ORG_GROUP, icon: <FileText size={16} />, render: (c) => <DirectoryModule cab={c} /> },
  { key: "team", label: "Команда", group: ORG_GROUP, icon: <Users size={16} />, render: (c) => <EmployeesModule cab={c} /> },
  { key: "training", label: "Тестування", group: ORG_GROUP, icon: <GraduationCap size={16} />, render: (c) => <TrainingModule cab={c} /> },
  { key: "zsu", label: "Коди ЗСУ", group: ORG_GROUP, icon: <BadgePercent size={16} />, render: (c) => <ZsuCodesModule cab={c} /> },
  { key: "archive", label: "Архів", group: ORG_GROUP, icon: <ArchiveIcon size={16} />, render: (c) => <EmployeesModule cab={c} archive /> },
  { key: "regionsheet", label: "Офіційні виплати", group: "Ще", icon: <Table size={16} />, render: () => <RegionSheetModule /> },
  { key: "planner", label: "Планер", group: "Ще", icon: <CalendarRange size={16} />, render: (c) => <PlannerModule tmKey={c.tmKey || "andriy"} /> },
];
const ADDABLE_BY_KEY = Object.fromEntries(ADDABLE_MODULES.map((m) => [m.key, m]));

/* Модалка нової задачі: по центру, ~50% екрана, не зникає, поки виконавець
   не натисне «Ознайомлений». Показуємо по одній задачі за раз. */
/* Нова новина від адміністратора — одразу на екран (як нова задача), поки не натиснуть «Зрозуміло» */
function NewsGate({ cabKey }) {
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    let a = true;
    const fresh = (n) => n.kind === "news" && !n.read && Date.now() - new Date(n.created_at).getTime() < 7 * 86400000; // старіші за тиждень не спливають
    listNotifications(60).then((all) => { if (a) setQueue(all.filter(fresh).reverse()); }).catch(() => {});
    const unsub = subscribeNotifications(cabKey, (n) => {
      if (n.kind === "news") setQueue((q) => (q.some((x) => x.id === n.id) ? q : [...q, n]));
    });
    // якщо позначили прочитаним у дзвіночку — прибираємо з черги
    const sync = () => listNotifications(60).then((all) => { if (a) setQueue((q) => q.filter((x) => all.some((y) => y.id === x.id && !y.read))); }).catch(() => {});
    notifBus?.addEventListener("c", sync);
    return () => { a = false; unsub(); notifBus?.removeEventListener("c", sync); };
  }, [cabKey]);

  if (!queue.length) return null;
  const n = queue[0];
  const ok = async () => {
    setQueue((q) => q.filter((x) => x.id !== n.id));
    await markRead(n.id).catch(() => {});
    pokeNotifs();
  };
  return createPortal(
    <div className="taskgate-overlay">
      <div className="taskgate">
        <div className="taskgate-eyebrow">Новина{queue.length > 1 ? ` · ще ${queue.length - 1}` : ""}</div>
        <h2 className="taskgate-title">{n.title}</h2>
        {n.body && <p className="taskgate-desc">{n.body}</p>}
        <div className="taskgate-meta"><span>{fmtDate(n.created_at)}</span></div>
        <button className="btn-primary taskgate-btn" onClick={ok}>Зрозуміло</button>
      </div>
    </div>,
    document.body,
  );
}

function TaskAckGate({ cabKey }) {
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let a = true;
    const reload = () => listTasks().then((all) => {
      if (!a) return;
      setQueue(all.filter((t) => t.assignee === cabKey && t.status !== "done" && !(t.ack || {})[cabKey])
        .sort((x, y) => (x.priority === y.priority ? (x.created_at < y.created_at ? -1 : 1) : x.priority ? -1 : 1)));
    }).catch(() => {});
    reload();
    const unsub = subscribeTasks(reload);
    return () => { a = false; unsub(); };
  }, [cabKey]);

  if (!queue.length) return null;
  const t = queue[0];
  const ack = async () => {
    setBusy(true);
    try { await markTaskAck(t, cabKey); } catch (e) { pushToast({ title: "Не вдалося", body: String(e.message || e) }); setBusy(false); return; }
    setQueue((q) => q.filter((x) => x.id !== t.id));
    setBusy(false);
  };
  return createPortal(
    <div className="taskgate-overlay">
      <div className="taskgate">
        <div className="taskgate-eyebrow">
          {t.priority && <span className="taskgate-pri">Терміново</span>}
          Нова задача{queue.length > 1 ? ` · ще ${queue.length - 1}` : ""}
        </div>
        <h2 className="taskgate-title">{t.title}</h2>
        {t.description && <p className="taskgate-desc">{t.description}</p>}
        <div className="taskgate-meta">
          <span>від {cabName(t.created_by) || t.created_by}</span>
          {t.due_at && <span>· термін до {fmtDate(t.due_at)}</span>}
        </div>
        <button className="btn-primary taskgate-btn" disabled={busy} onClick={ack}>{busy ? "…" : "Ознайомлений"}</button>
      </div>
    </div>,
    document.body,
  );
}

/* Командний рядок: пошук по вкладках + салонах + швидкі дії, керування з клавіатури */
function CommandPalette({ cabKey, items }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  const t = cabType(cabKey);
  const tmKey = t === "tm" ? cabKey : t === "sm" ? salonTmOn(cabKey) : null;
  const hasKpi = items.some((m) => m.key === "kpi");

  const entries = useMemo(() => {
    const out = items.map((m) => ({ id: `m-${m.key}`, label: m.label, group: "Вкладка", run: () => goToModule(m.key) }));
    if (hasKpi) {
      const salons = t === "tm" ? salonsOfTm(tmKey)
        : (t === "manager" || t === "accountant" || t === "office") ? SALONS : [];
      salons.forEach((s) => out.push({
        id: `s-${s.key}`, label: `${s.city}, ${shortAddr(s.addr)}`, group: "Аналітика салону",
        run: () => openSalonAnalytics(s.key),
      }));
    }
    const inv = items.find((m) => m.key === "bn" || m.key === "inv");
    if (inv) out.push({ id: "a-inv", label: "Новий безнальний рахунок", group: "Дія", run: () => goToModule(inv.key) });
    if (items.some((m) => m.key === "warehouse")) out.push({ id: "a-wh", label: "Склад · прихід / акт списання", group: "Дія", run: () => goToModule("warehouse") });
    if (items.some((m) => m.key === "tasks")) out.push({ id: "a-task", label: "Нова задача", group: "Дія", run: () => goToModule("tasks") });
    return out;
  }, [items, hasKpi, t, tmKey]);

  const norm = (s) => String(s || "").toLowerCase();
  const results = useMemo(() => {
    const s = norm(q).trim();
    if (!s) return entries.slice(0, 9);
    return entries
      .map((e) => {
        const l = norm(e.label);
        let score = 0;
        if (l.startsWith(s)) score = 100;
        else if (l.includes(` ${s}`)) score = 70;
        else if (l.includes(s)) score = 40;
        else if (s.split(" ").every((w) => l.includes(w))) score = 20;
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 9)
      .map((x) => x.e);
  }, [q, entries]);

  useEffect(() => {
    const onKey = (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && (ev.key === "k" || ev.key === "K" || ev.key === "л" || ev.key === "Л")) {
        ev.preventDefault();
        setOpen((v) => !v);
      }
      if (ev.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    paletteBus?.addEventListener("open", onOpen);
    return () => { window.removeEventListener("keydown", onKey); paletteBus?.removeEventListener("open", onOpen); };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);
  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;
  const pick = (e) => { if (!e) return; setOpen(false); e.run(); };

  return createPortal(
    <div className="cmdk-overlay" onMouseDown={() => setOpen(false)}>
      <div className="cmdk" onMouseDown={(ev) => ev.stopPropagation()}>
        <input
          ref={inputRef} className="cmdk-input" value={q} placeholder="Перейти до вкладки, салону або дії…"
          onChange={(ev) => setQ(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowDown") { ev.preventDefault(); setSel((i) => Math.min(i + 1, results.length - 1)); }
            else if (ev.key === "ArrowUp") { ev.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
            else if (ev.key === "Enter") { ev.preventDefault(); pick(results[sel]); }
          }}
        />
        <div className="cmdk-list">
          {results.length === 0 && <div className="cmdk-empty">Нічого не знайдено</div>}
          {results.map((e, i) => (
            <button
              key={e.id} className={`cmdk-row ${i === sel ? "sel" : ""}`}
              onMouseEnter={() => setSel(i)} onClick={() => pick(e)}
            >
              <span className="cmdk-label">{e.label}</span>
              <span className="cmdk-tag">{e.group}</span>
            </button>
          ))}
        </div>
        <div className="cmdk-foot"><kbd>↑↓</kbd> вибір · <kbd>↵</kbd> відкрити · <kbd>esc</kbd> закрити</div>
      </div>
    </div>,
    document.body,
  );
}

/* Якщо вкладка кабінету впаде через непередбачену помилку — показуємо це місце
   з кнопкою «Спробувати ще раз» замість того, щоб порожнім лишався весь застосунок
   (без цього одна погана вкладка вимагала повного оновлення сторінки). */
class ModuleErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Помилка у вкладці кабінету:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="mod-crash">
          <AlertTriangle size={22} />
          <h4>Не вдалося показати цей розділ</h4>
          <p className="hint">Сталася непередбачена помилка. Спробуйте ще раз — якщо повториться, зробіть скрін цього повідомлення й перешліть.</p>
          <button className="btn-secondary small" onClick={() => this.setState({ error: null })}>Спробувати ще раз</button>
          <p className="mod-crash-tech">{String(this.state.error?.message || this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function CabinetShell({ title, onExit, onLogout, modules, cabKey, banner }) {
  const nativeModules = modules.filter(Boolean);
  const nativeKeys = nativeModules.map((m) => m.key);

  // адмін-керований доступ: modAccess (вимкнені рідні) + modExtra (додані з реєстру)
  const [modAccess, setModAccess] = useState(null);
  const [modExtra, setModExtra] = useState([]);
  useEffect(() => {
    let a = true;
    const reload = () => Promise.all([getModuleAccess(cabKey), getModuleExtra(cabKey)])
      .then(([acc, ex]) => { if (a) { setModAccess(acc); setModExtra(ex); } })
      .catch(() => { if (a) { setModAccess({}); setModExtra([]); } });
    reload();
    const unsub = subscribeModuleAccess(cabKey, reload);
    return () => { a = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabKey]);

  const cabCtx = React.useMemo(() => {
    const t = cabType(cabKey);
    return { key: cabKey, type: t, tmKey: t === "tm" ? cabKey : t === "sm" ? salonTmOn(cabKey) : null };
  }, [cabKey]);

  // рідні модулі + додані адміном (портативні, з ADDABLE_MODULES, без дублів рідних)
  const extraModules = modExtra
    .filter((k) => !nativeKeys.includes(k) && ADDABLE_BY_KEY[k])
    .map((k) => {
      const d = ADDABLE_BY_KEY[k];
      return { key: k, label: d.label, group: d.group, icon: d.icon, extra: true, render: () => d.render(cabCtx) };
    });
  const allModules = [...nativeModules, ...extraModules];

  const catSig = allModules.map((m) => `${m.key}~${m.label}~${m.group || ""}`).join("|");
  useEffect(() => {
    saveModuleCatalog(cabKey, allModules.map((m) => ({ key: m.key, label: m.label, group: m.group || null, extra: !!m.extra })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabKey, catSig]);

  // перший модуль лишається завжди (не можна замкнути кабінет у ніщо)
  const items = allModules.filter((m, i) => i === 0 || moduleAccessAllows(modAccess, m.key));
  const byKey = React.useMemo(() => Object.fromEntries(items.map((m) => [m.key, m])), [items]);
  const nav = useNavPrefs(cabKey, items.map((m) => m.key));
  const [editNav, setEditNav] = useState(false);
  const [dragKey, setDragKey] = useState(null);

  const orderedItems = nav.ordered.map((k) => byKey[k]).filter(Boolean);
  const visibleItems = orderedItems.filter((m) => !nav.hidden.includes(m.key));
  const shownItems = editNav ? orderedItems : visibleItems;

  const TAB_KEY = `dnipro-m-tab:${cabKey}`;
  const [activeReq, setActive] = useState(() => {
    try {
      const saved = sessionStorage.getItem(TAB_KEY);
      if (saved && nativeModules.some((m) => m.key === saved)) return saved;
    } catch { /* ignore */ }
    return nativeModules[0].key;
  });
  const [navOpen, setNavOpen] = useState(false); // мобільна шухляда
  const [peek, setPeek] = useState(false);          // на комп'ютері меню ховається ліворуч і виїжджає при наведенні на лівий край
  const peekTimer = useRef(null);
  const peekOn = () => { clearTimeout(peekTimer.current); setPeek(true); };
  const peekOff = () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setPeek(false), 3000); }; // закривається не одразу
  const [pinned, setPinned] = useState(() => { try { return localStorage.getItem("dnipro-nav-pinned") === "1"; } catch { return false; } });
  const togglePin = () => setPinned((v) => { const n = !v; try { localStorage.setItem("dnipro-nav-pinned", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  // висота верхньої панелі — щоб меню виїжджало під нею
  useEffect(() => {
    const set = () => document.documentElement.style.setProperty("--tb-h", `${document.querySelector(".topbar")?.offsetHeight || 64}px`);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  // клік по сповіщенню → відкрити відповідний модуль
  useEffect(() => {
    const onNav = (e) => {
      const key = e.detail;
      if (key && byKey[key]) { setActive(key); setNavOpen(false); if (nav.hidden.includes(key)) nav.toggleHidden(key); }
    };
    navBus?.addEventListener("nav", onNav);
    return () => navBus?.removeEventListener("nav", onNav);
  }, [byKey, nav]);
  // якщо обраний пункт приховано — показуємо перший видимий (без ефекту, прямо при рендері)
  const active = (!editNav && !visibleItems.some((m) => m.key === activeReq))
    ? (visibleItems[0]?.key ?? activeReq)
    : activeReq;
  // запамʼятовуємо активну вкладку — щоб оновлення сторінки не викидало на «Огляд»
  useEffect(() => { try { sessionStorage.setItem(TAB_KEY, active); } catch { /* ignore */ } }, [active, TAB_KEY]);
  const mod = byKey[active] || visibleItems[0] || items[0];
  const pick = (key) => { setActive(key); setNavOpen(false); setPeek(false); };

  // --- бейджі: непрочитані сповіщення по вкладках ---
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    const reload = () => listNotifications(100).then(setNotifs).catch(() => {});
    reload();
    const unsub = subscribeNotifications(cabKey, reload);
    notifBus?.addEventListener("c", reload);
    return () => { unsub(); notifBus?.removeEventListener("c", reload); };
  }, [cabKey]);
  // --- прострочені безнальні рахунки (бейдж на вкладці «Безнальні рахунки») ---
  const [invOverdue, setInvOverdue] = useState(0);
  useEffect(() => {
    if (!allModules.some((m) => m.key === "bn" || m.key === "inv")) return undefined;
    const reload = () => listInvoices()
      .then((rs) => setInvOverdue(rs.filter(isInvOverdue).length))
      .catch(() => {});
    reload();
    return subscribeInvoices(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabKey]);

  const badges = {};
  for (const n of notifs) {
    if (n.read) continue;
    const k = moduleKeyForNotif(items, n);
    if (k) badges[k] = (badges[k] || 0) + 1;
  }
  if (invOverdue) for (const m of items) if (m.key === "bn" || m.key === "inv") badges[m.key] = (badges[m.key] || 0) + invOverdue;
  // відкрили вкладку → прочитати її сповіщення (бейдж зникає)
  useEffect(() => {
    const mine = notifs.filter((n) => !n.read && moduleKeyForNotif(items, n) === active);
    if (!mine.length) return;
    setNotifs((ns) => ns.map((n) => (mine.some((m) => m.id === n.id) ? { ...n, read: true } : n)));
    Promise.all(mine.map((n) => markRead(n.id).catch(() => {}))).then(pokeNotifs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, notifs]);

  // --- групи ---
  const effGroup = (m) => nav.groupOf(m.key) || m.group || NAV_DEFAULT_GROUP;
  const groupOrder = (() => {
    const out = [];
    items.forEach((m) => { const g = m.group || NAV_DEFAULT_GROUP; if (!out.includes(g)) out.push(g); });
    // групи, куди користувач перекинув пункти вручну
    shownItems.forEach((m) => { const g = effGroup(m); if (!out.includes(g)) out.push(g); });
    return out;
  })();
  const grouped = groupOrder.length > 1 && items.length > 4;
  const activeGroup = effGroup(byKey[active] || items[0]);

  const rowFor = (m) => {
    const isHidden = nav.hidden.includes(m.key);
    return (
      <div
        key={m.key}
        className={`cab-side-row ${dragKey === m.key ? "dragging" : ""}`}
        draggable={editNav}
        onDragStart={editNav ? () => setDragKey(m.key) : undefined}
        onDragOver={editNav ? (e) => e.preventDefault() : undefined}
        onDrop={editNav ? (e) => { e.stopPropagation(); if (dragKey && dragKey !== m.key) nav.dropInGroup(dragKey, effGroup(m), m.key); setDragKey(null); } : undefined}
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
          {!editNav && badges[m.key] > 0 && m.key !== active && (
            <span className="cab-side-badge">{badges[m.key] > 9 ? "9+" : badges[m.key]}</span>
          )}
          {!editNav && m.badge != null && <span className={`badge ${m.badgeTone || "badge-warn"}`}>{m.badge}</span>}
          {editNav && <span className="cab-side-eye">{isHidden ? <EyeOff size={15} /> : <Eye size={15} />}</span>}
        </button>
      </div>
    );
  };

  const navInner = grouped ? (
    groupOrder.map((g) => {
      const groupItems = shownItems.filter((m) => effGroup(m) === g);
      if (!groupItems.length && !editNav) return null;
      const pinned = g === NAV_PINNED_GROUP;
      const isColl = !editNav && !pinned && nav.collapsed.includes(g) && g !== activeGroup;
      return (
        <div
          key={g}
          className={`cab-grp ${pinned ? "pinned" : ""} ${isColl ? "collapsed" : ""}`}
          onDragOver={editNav ? (e) => e.preventDefault() : undefined}
          onDrop={editNav ? (e) => { e.stopPropagation(); if (dragKey) nav.dropInGroup(dragKey, g, null); setDragKey(null); } : undefined}
        >
          {!pinned && (
            <button
              className="cab-grp-h"
              onClick={editNav ? undefined : () => nav.toggleCollapsed(g)}
              disabled={editNav}
            >
              <span>{g}</span>
              {isColl && groupItems.reduce((s, m) => s + (badges[m.key] || 0), 0) > 0 && (
                <span className="cab-side-badge">{Math.min(9, groupItems.reduce((s, m) => s + (badges[m.key] || 0), 0))}{groupItems.reduce((s, m) => s + (badges[m.key] || 0), 0) > 9 ? "+" : ""}</span>
              )}
              {!editNav && <ChevronRight size={13} className="cab-grp-chev" />}
              {editNav && <span className="cab-grp-count">{groupItems.length}</span>}
            </button>
          )}
          {!isColl && <div className="cab-grp-body">{groupItems.map(rowFor)}</div>}
        </div>
      );
    })
  ) : (
    shownItems.map(rowFor)
  );

  return (
    <div className={`view cab-shell${mod?.wide ? " cab-wide" : ""}`}>
      <TaskAckGate cabKey={cabKey} />
      <NewsGate cabKey={cabKey} />
      <CommandPalette cabKey={cabKey} items={items} />
      <TopBar title={title} onLogout={onLogout} cabKey={cabKey} onMenu={() => setNavOpen((v) => !v)} />
      <div className={`cab-scrim ${navOpen ? "on" : ""}`} onClick={() => setNavOpen(false)} />
      {banner}
      {!pinned && <div className="cab-edge" onMouseEnter={peekOn} onClick={peekOn} aria-hidden="true" />}
      <div className={`cab-layout ${pinned ? "pinned" : ""}`}>
        <nav className={`cab-side ${editNav ? "editing" : ""} ${navOpen ? "open" : ""} ${peek || editNav ? "peek" : ""}`} onMouseEnter={peekOn} onMouseLeave={peekOff}>
          <div className="cab-side-top">
            <span className="cab-side-title">Navigation</span>
            <button className={`cab-pin ${pinned ? "on" : ""}`} onClick={togglePin} title={pinned ? "Відкріпити меню (ховатиметься)" : "Закріпити меню"} aria-label={pinned ? "Відкріпити меню" : "Закріпити меню"} aria-pressed={pinned}>
              <Paperclip size={16} />
            </button>
          </div>
          {navInner}
          <span className="cab-side-sep" />
          <button className="cab-side-cfg" onClick={() => setEditNav((v) => !v)}>
            {editNav ? <><Check size={15} /> Готово</> : <><SlidersHorizontal size={15} /> Налаштувати меню</>}
          </button>
          {editNav && nav.customised && (
            <button className="cab-side-cfg subtle" onClick={nav.reset}>
              <RefreshCw size={14} /> Скинути до типового
            </button>
          )}
          {editNav && <p className="cab-side-tip">Перетягніть пункт у будь-яке місце або в іншу групу. Натисніть пункт, щоб приховати чи повернути.</p>}
        </nav>
        <div className="cab-content"><ModuleErrorBoundary key={active}>{mod.render()}</ModuleErrorBoundary></div>
      </div>
      {(() => {
        const bkeys = ["kpi", "bn", "inv", "tasks", "cash"].filter((k) => byKey[k]);
        const bmods = [items[0], ...bkeys.slice(0, 2).map((k) => byKey[k])].filter(Boolean);
        const a = bmods[0], c = bmods[1], d = bmods[2];
        const cell = (m) => m && (
          <button key={m.key} className={`cbn ${active === m.key ? "on" : ""}`} onClick={() => pick(m.key)}>
            {m.icon}<span>{m.label.split(/[ ·]/)[0]}</span>
            {badges[m.key] > 0 && active !== m.key && <i className="cbn-dot" />}
          </button>
        );
        return (
          <nav className="cab-bottom" aria-label="Швидка навігація">
            {cell(a)}{cell(c)}
            <button className="cbn cbn-plus" onClick={openPalette} aria-label="Пошук і швидкі дії"><Plus size={19} /></button>
            {cell(d)}
            <button className="cbn" onClick={() => setNavOpen(true)}><Menu size={17} /><span>Ще</span></button>
          </nav>
        );
      })()}
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
          if (smSalaryLockedFor(await getSmSalaryLock(), salonKey)) { if (active) setState(null); return; }
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
  const tm = tmByKey(tmKey);
  return (
    <div className="ov">
      <div className="tm-head">
        <h3 className="ov-h">Огляд · {tm?.name || "ТМ"}</h3>
      </div>
      <AttentionQueue cab={{ key: tmKey, type: "tm", tmKey }} />
      <TurnoverRings scopeSalons={SALONS} />
      <SalesTrendChart scopeSalons={SALONS} />
    </div>
  );
}

function SmOverview({ salon }) {
  return (
    <div className="ov">
      <div className="tm-head">
        <h3 className="ov-h">Огляд · {salon.city}, {shortAddr(salon.addr)}</h3>
      </div>
      <AttentionQueue cab={{ key: salon.key, type: "sm", tmKey: salonTmOn(salon.key) }} />
      <TurnoverRings scopeSalons={[salon]} single />
      <SalesTrendChart scopeSalons={[salon]} />
      <AllSalonsRingsToday highlight={salon.key} />
    </div>
  );
}

function TmCabinet({ tmKey, onExit, onLogout }) {
  const tm = tmByKey(tmKey);
  const isAdmin = tmKey === ADMIN_KEY;
  useEffect(() => { warmCalc(); }, []); // прогрів Edge-функції розрахунку ЗП
  const modules = [
    { key: "overview", label: "Огляд", group: "Головне", icon: <LayoutGrid size={16} />, render: () => <TmOverview tmKey={tmKey} /> },
    { key: "salary", label: "Розрахунок ЗП", group: "Головне", icon: <Calculator size={16} />, render: () => <TmView tmKey={tmKey} tmName={tm.name} embedded /> },
    { key: "salons", wide: true, label: "ЗП салонів", group: "Головне", icon: <Store size={16} />, render: () => <SalonReviewPanel tmKey={tmKey} reviewer="tm" /> },
    { key: "plans", label: "План показників", group: "Головне", icon: <TrendingUp size={16} />, render: () => <SmPlanPanel tmKey={tmKey} /> },
    { key: "analytics", label: "Аналітика", group: "Головне", icon: <TrendingUp size={16} />, render: () => <AnalyticsPanel cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "kpi", label: "Показники території", group: "Щоденне", icon: <BarChart3 size={16} />, render: () => <TerritoryModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "ez", label: "ЕЗ", group: "Щоденне", icon: <BadgePercent size={16} />, render: () => <EzSalesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "bonus", label: "Рух бонусів", group: ORG_GROUP, icon: <Sparkles size={16} />, render: () => <BonusModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "expenses", label: "Витрати по СМ", group: ORG_GROUP, icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "warehouse", label: "Склад", group: ORG_GROUP, icon: <Warehouse size={16} />, render: () => <SupplyModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "directory", label: "Довідник", group: ORG_GROUP, icon: <FileText size={16} />, render: () => <DirectoryModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "team", label: "Команда", group: ORG_GROUP, icon: <Users size={16} />, render: () => <EmployeesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "archive", label: "Архів", group: ORG_GROUP, icon: <ArchiveIcon size={16} />, render: () => <EmployeesModule cab={{ key: tmKey, type: "tm", tmKey }} archive /> },
    { key: "tasks", label: "Задачі", group: ORG_GROUP, icon: <CheckSquare size={16} />, render: () => <TasksModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "shifts", wide: true, label: "Графік змін", group: ORG_GROUP, icon: <Calendar size={16} />, render: () => <ShiftScheduleModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "training", label: "Тестування", group: ORG_GROUP, icon: <GraduationCap size={16} />, render: () => <TrainingModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "zsu", label: "Коди ЗСУ", group: ORG_GROUP, icon: <BadgePercent size={16} />, render: () => <ZsuCodesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "bn", label: "Безнальні рахунки", group: ORG_GROUP, icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "regionsheet", label: "Офіційні виплати", group: "Ще", icon: <Table size={16} />, render: () => <RegionSheetModule /> },
    { key: "planner", label: "Планер", group: "Ще", icon: <CalendarRange size={16} />, render: () => <PlannerModule tmKey={tmKey} /> },
    { key: "docs", label: "Документи й стандарти", group: "Ще", icon: <FileText size={16} />, render: () => <ModuleStub name="Документи й стандарти" /> },
    isAdmin ? { key: "admin", label: "Адміністрування", group: "Адміністрування", icon: <User size={16} />, render: () => <AdminPanel /> } : null,
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
    { key: "home", label: "Головна", group: "Головне", icon: <LayoutGrid size={16} />, render: () => <ManagerHome /> },
    { key: "byTm", label: "По ТМ", group: "Головне", icon: <Users size={16} />, render: () => <ManagerView embedded /> },
    { key: "consol", label: "Зведення ЗП", group: "Головне", icon: <Wallet size={16} />, render: () => <ConsolidationPanel role="manager" /> },
    { key: "cash", label: "Готівка", group: "Щоденне", icon: <Banknote size={16} />, render: () => <ManagerCashTab /> },
    { key: "kpi", label: "Показники території", group: "Щоденне", icon: <BarChart3 size={16} />, render: () => <TerritoryModule cab={cab} /> },
    { key: "analytics", label: "Аналітика", group: "Щоденне", icon: <TrendingUp size={16} />, render: () => <AnalyticsPanel cab={cab} /> },
    { key: "ez", label: "ЕЗ", group: "Щоденне", icon: <BadgePercent size={16} />, render: () => <EzSalesModule cab={cab} /> },
    { key: "bonus", label: "Рух бонусів", group: ORG_GROUP, icon: <Sparkles size={16} />, render: () => <BonusModule cab={cab} /> },
    { key: "expenses", label: "Витрати по СМ", group: ORG_GROUP, icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={cab} /> },
    { key: "warehouse", label: "Склад", group: ORG_GROUP, icon: <Warehouse size={16} />, render: () => <SupplyModule cab={cab} /> },
    { key: "directory", label: "Довідник", group: ORG_GROUP, icon: <FileText size={16} />, render: () => <DirectoryModule cab={cab} /> },
    { key: "team", label: "Команда", group: ORG_GROUP, icon: <Users size={16} />, render: () => (<><EmployeesModule cab={cab} /><EmployeesModule cab={cab} archive /></>) },
    { key: "tasks", label: "Задачі", group: ORG_GROUP, icon: <CheckSquare size={16} />, render: () => <TasksModule cab={cab} /> },
    { key: "shifts", wide: true, label: "Графік", group: ORG_GROUP, icon: <Calendar size={16} />, render: () => <ShiftScheduleModule cab={cab} /> },
    { key: "training", label: "Тестування", group: ORG_GROUP, icon: <GraduationCap size={16} />, render: () => <TrainingModule cab={cab} /> },
    { key: "zsu", label: "Коди ЗСУ", group: ORG_GROUP, icon: <BadgePercent size={16} />, render: () => <ZsuCodesModule cab={cab} /> },
    { key: "inv", label: "Рахунки", group: ORG_GROUP, icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={cab} /> },
    { key: "sheet", label: "Офіційні виплати", group: ORG_GROUP, icon: <Table size={16} />, render: () => <RegionSheetModule /> },
  ];
  return <CabinetShell title={MANAGER.name} onExit={onExit} onLogout={onLogout} modules={modules} cabKey="manager" />;
}

function AccountantCabinet({ onExit, onLogout }) {
  const cab = { key: "accountant", type: "accountant" };
  const modules = [
    { key: "consol", label: "Зведення ЗП", group: "Головне", icon: <Wallet size={16} />, render: () => <ConsolidationPanel role="accountant" /> },
    { key: "bonus", label: "Рух бонусів", group: ORG_GROUP, icon: <Sparkles size={16} />, render: () => <BonusModule cab={cab} /> },
    { key: "expenses", label: "Витрати по СМ", group: ORG_GROUP, icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={cab} /> },
    { key: "warehouse", label: "Склад", group: ORG_GROUP, icon: <Warehouse size={16} />, render: () => <SupplyModule cab={cab} /> },
    { key: "directory", label: "Довідник", group: ORG_GROUP, icon: <FileText size={16} />, render: () => <DirectoryModule cab={cab} /> },
    { key: "inv", label: "Безнальні рахунки", group: ORG_GROUP, icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={cab} /> },
  ];
  return <CabinetShell title={ACCOUNTANT.name} onExit={onExit} onLogout={onLogout} modules={modules} cabKey="accountant" />;
}

const checkinFlag = (salonKey) => `dnipro-m-checkin:${salonKey}:${todayISO()}`;
const markCheckedInLocal = (salonKey) => { try { localStorage.setItem(checkinFlag(salonKey), "1"); } catch { /* ignore */ } };

/* «Розрахунок ЗП» у кабінеті СМ під замком, поки адмін не відкриє (Адміністрування → Технічна перерва) */
function SmSalaryGate({ salon }) {
  const [locked, setLocked] = useState(null);
  useEffect(() => {
    let a = true;
    const load = () => getSmSalaryLock().then((v) => { if (a) setLocked(smSalaryLockedFor(v, salon.key)); });
    load();
    const off = subscribeFlags(load);
    return () => { a = false; off(); };
  }, [salon.key]);
  if (locked === null) return <div className="loading">Завантаження…</div>;
  if (locked) {
    return (
      <div className="office-stub">
        <span className="office-stub-ic"><Lock size={26} /></span>
        <h3>Розрахунок ЗП</h3>
        <p>Вибачте, це вікно на доопрацюванні.</p>
      </div>
    );
  }
  return <SmStoreSalary salon={salon} />;
}

function SmCabinet({ salonKey, onExit, onLogout }) {
  const salon = salonByKey(salonKey);
  useEffect(() => { warmCalc(); }, []); // прогрів Edge-функції розрахунку ЗП
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
    { key: "overview", label: "Огляд", group: "Головне", icon: <LayoutGrid size={16} />, render: () => <SmOverview salon={salon} /> },
    { key: "salary", label: "Розрахунок ЗП", group: "Головне", icon: <Calculator size={16} />, wide: true, render: () => <SmSalaryGate salon={salon} /> },
    { key: "cash", label: "Готівка", group: "Щоденне", icon: <Banknote size={16} />, render: () => <CashModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "kpi", label: "Показники магазину", group: "Щоденне", icon: <BarChart3 size={16} />, render: () => <TerritoryModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "ez", label: "ЕЗ", group: "Щоденне", icon: <BadgePercent size={16} />, render: () => <EzSalesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "bonus", label: "Рух бонусів", group: ORG_GROUP, icon: <Sparkles size={16} />, render: () => <BonusModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "expenses", label: "Витрати по СМ", group: ORG_GROUP, icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "warehouse", label: "Склад", group: ORG_GROUP, icon: <Warehouse size={16} />, render: () => <SupplyModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "directory", label: "Довідник", group: ORG_GROUP, icon: <FileText size={16} />, render: () => <DirectoryModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "team", label: "Команда", group: ORG_GROUP, icon: <Users size={16} />, render: () => <EmployeesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "tasks", label: "Задачі й чек-листи", group: ORG_GROUP, icon: <ListChecks size={16} />, render: () => <TasksModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "shifts", wide: true, label: "Графік змін", group: ORG_GROUP, icon: <Calendar size={16} />, render: () => <ShiftScheduleModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "training", label: "Тестування", group: ORG_GROUP, icon: <GraduationCap size={16} />, render: () => <TrainingModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "zsu", label: "Коди ЗСУ", group: ORG_GROUP, icon: <BadgePercent size={16} />, render: () => <ZsuCodesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "bn", label: "Безнальні рахунки", group: ORG_GROUP, icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "standards", label: "Стандарти й навчання", group: "Ще", icon: <GraduationCap size={16} />, render: () => <ModuleStub name="Стандарти й навчання" /> },
    { key: "planner", label: "Планер", group: "Ще", icon: <CalendarRange size={16} />, render: () => <PlannerModule tmKey={salonTmOn(salonKey)} /> },
    { key: "requests", label: "Заявки", group: "Ще", icon: <Package size={16} />, render: () => <ModuleStub name="Заявки" /> },
    { key: "reports", label: "Звіти", group: "Ще", icon: <FileText size={16} />, render: () => <ModuleStub name="Звіти (клінінг, лічильники)" /> },
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
        <TopBar title={person?.name || "Офіс"} onLogout={onLogout} cabKey={cabKey} />
        <div className="loading">Завантаження…</div>
      </div>
    );
  }
  const modules = [
    { key: "home", label: "Кабінет", group: "Головне", icon: <LayoutGrid size={16} />, render: () => (
      <div className="office-stub">
        <span className="office-stub-ic"><Clock size={26} /></span>
        <h3>{person?.name}</h3>
        <p>{caps.length ? "Доступні модулі — у панелі зліва." : "Кабінет у розробці. Додаткові права надає адміністратор."}</p>
      </div>
    ) },
    caps.includes("view_consolidation")
      ? { key: "consol", label: "Зведення ЗП", group: "Головне", icon: <Wallet size={16} />, render: () => <ConsolidationPanel role={caps.includes("manage_payments") ? "accountant" : "viewer"} /> }
      : null,
    cabKey === "olha"
      ? { key: "warehouse", label: "Склад", group: ORG_GROUP, icon: <Warehouse size={16} />, render: () => <SupplyModule cab={{ key: cabKey, type: "office" }} /> }
      : null,
    { key: "expenses", label: "Витрати по СМ", group: ORG_GROUP, icon: <TrendingDown size={16} />, render: () => <ExpensesModule cab={{ key: cabKey, type: "office" }} /> },
    { key: "directory", label: "Довідник", group: ORG_GROUP, icon: <FileText size={16} />, render: () => <DirectoryModule cab={{ key: cabKey, type: "office" }} /> },
    { key: "bn", label: "Безнальні рахунки", group: ORG_GROUP, icon: <CreditCard size={16} />, render: () => <ModuleStub name="Безнальні рахунки" /> },
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
  --line:#E1D9C1; --line-strong:#CFC5A6; --line-dark:rgba(var(--sf),.12);
  --sf:247,244,234;          /* заливка на «шеллі» (навігація/топбар/кнопки) */
  --input-bg:#ffffff;        /* фон полів вводу */
  --hero-tint:#FFFDF6;       /* світлий акцент карток */
  --radius:14px; --radius-md:10px; --radius-sm:8px;
  --sh-1:0 1px 2px rgba(20,15,5,.05), 0 1px 3px rgba(20,15,5,.04);
  --sh-2:0 2px 6px rgba(20,15,5,.06), 0 12px 28px -12px rgba(20,15,5,.18);
  --sh-3:0 8px 24px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.2);
  --ease:cubic-bezier(.32,.72,.28,1);
}

/* === ТЕМНА ТЕМА: контент-картки теж темні (шелл лишається темно-синім) === */
:root[data-theme="dark"] {
  --surface:#1B232E; --surface-alt:#232D39; --surface-sink:#2A3542;
  --ink:#ECE6D7; --ink-soft:#C2BAA6; --muted:#8C846F; --faint:#655F50;
  --line:#333E4A; --line-strong:#3D4854;
  --input-bg:#232D39;
  --hero-tint:#232D39;
  --positive:#5E9C6E; --negative:#D07A6E;
  --gold-ink:#F0E3C4;
  --sh-1:0 1px 2px rgba(0,0,0,.3);
  --sh-2:0 2px 6px rgba(0,0,0,.32), 0 14px 30px -14px rgba(0,0,0,.55);
  --sh-3:0 10px 30px rgba(0,0,0,.5), 0 3px 10px rgba(0,0,0,.4);
}

/* === СВІТЛА ТЕМА: шелл теж світлий (тепле «паперове» тло) === */
:root[data-theme="light"] {
  --bg:#E8E2D2; --bg-2:#F2EDDF;
  --on-dark:#2B2620; --on-dark-2:#5B5443; --on-dark-3:#8A8270;
  --line-dark:rgba(40,30,18,.14);
  --sf:40,30,18;
}
:root[data-theme="light"] .app-root{
  background:
    radial-gradient(1100px 620px at 78% -8%, rgba(190,138,46,.14), transparent 60%),
    radial-gradient(900px 520px at 8% 4%, rgba(120,150,200,.10), transparent 55%),
    linear-gradient(180deg, var(--bg-2), var(--bg));
}
:root[data-theme="light"] .topbar{box-shadow:0 8px 20px -16px rgba(40,30,18,.35);}
:root[data-theme="light"] .toast{background:#242E38;color:#f4f1ea;}

.app-root{
  font-family:'Inter',system-ui,sans-serif;
  color:var(--ink);
  background:
    radial-gradient(1100px 620px at 78% -8%, rgba(190,138,46,.16), transparent 60%),
    radial-gradient(900px 520px at 8% 4%, rgba(120,150,200,.10), transparent 55%),
    linear-gradient(180deg, var(--bg-2), var(--bg));
  background-attachment:fixed;
  min-height:calc(100vh / var(--ui-zoom,1));
  overflow-x:clip;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
/* БЕЗ префікса .app-root: модалки рендеряться через createPortal(...,document.body)
   і фізично лежать ПОЗА .app-root у DOM, тож скопований на .app-root селектор
   їх не бачив — поле показувало чорний текст на темному фоні (нечитабельно). */
*{box-sizing:border-box;}
::selection{background:rgba(190,138,46,.28);}
/* фон за замовч. теж треба — інакше поле без власного background лишається
   білим від браузера, а колір тексту (світлий у темній темі) стає нечитабельним
   на білому фоні; клас з власним background (напр. .field-input{background:none})
   все одно переможе цей загальний фолбек своєю вищою специфічністю селектора */
input,select,textarea{color:var(--ink);background:var(--input-bg);}
input::placeholder,textarea::placeholder{color:var(--muted);opacity:.75;}
select option{background:var(--surface);color:var(--ink);}

/* ---------- role select & pin ---------- */
.role-select{display:flex;align-items:center;justify-content:center;min-height:calc(100vh / var(--ui-zoom,1));padding:32px;}
.role-select-inner{max-width:440px;width:100%;text-align:center;}
.role-eyebrow{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-bright);margin-bottom:14px;padding:5px 12px;border:1px solid var(--line-dark);border-radius:999px;background:rgba(var(--sf),.03);}
.role-select-inner h1{font-family:'Fraunces',serif;font-size:34px;line-height:1.1;color:var(--on-dark);margin:0 0 10px;font-weight:600;letter-spacing:-.015em;}
.role-select-inner p{color:var(--on-dark-2);margin:0 0 30px;font-size:14px;}
.role-cards{display:flex;flex-direction:column;gap:10px;}
.role-card-group{display:flex;flex-direction:column;gap:10px;}
.role-card{width:100%;display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid transparent;border-radius:var(--radius);padding:16px 18px;cursor:pointer;color:var(--ink);text-align:left;box-shadow:var(--sh-2);transition:transform .18s var(--ease),box-shadow .18s var(--ease),border-color .18s var(--ease);}
.role-card:hover{transform:translateY(-3px);box-shadow:var(--sh-3);border-color:var(--gold);}
.role-card:active{transform:translateY(-1px);}
.role-card-manager{background:linear-gradient(180deg,var(--hero-tint),var(--surface-alt));}
.role-card-icon{flex-shrink:0;width:42px;height:42px;border-radius:11px;background:linear-gradient(180deg,var(--surface-alt),var(--surface-sink));display:flex;align-items:center;justify-content:center;color:var(--gold);box-shadow:inset 0 0 0 1px rgba(0,0,0,.04);}
.role-card-text{display:flex;flex-direction:column;gap:3px;min-width:0;}
.role-card-name{font-size:14.5px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.role-card-sub{font-size:11px;color:var(--muted);letter-spacing:.02em;}

.pin-avatar{width:60px;height:60px;border-radius:50%;background:linear-gradient(180deg,var(--hero-tint),var(--surface-alt));color:var(--gold);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-family:'Fraunces',serif;font-size:20px;font-weight:600;box-shadow:var(--sh-2),inset 0 0 0 1px rgba(0,0,0,.05);}
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
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;
  padding:calc(16px + env(safe-area-inset-top)) calc(22px + env(safe-area-inset-right)) 14px calc(22px + env(safe-area-inset-left));
  margin:calc(-1 * env(safe-area-inset-top)) -22px 10px;min-height:58px;
  background:var(--bg-2);border-bottom:1px solid var(--line-dark);box-shadow:0 10px 22px -14px rgba(0,0,0,.6);}
.topbar-menu{display:none;background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
.topbar-menu:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.cab-scrim{display:none;position:fixed;inset:0;z-index:65;background:rgba(6,10,14,.6);opacity:0;pointer-events:none;transition:opacity .2s var(--ease);}
.cab-scrim.on{opacity:1;pointer-events:auto;}
.topbar-back{background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark-2);display:flex;align-items:center;gap:3px;cursor:pointer;font-size:12.5px;padding:7px 12px 7px 8px;border-radius:999px;transition:background .15s var(--ease),color .15s var(--ease);}
.topbar-back:hover{background:rgba(var(--sf),.1);color:var(--on-dark);}
.topbar-title{font-family:'Fraunces',serif;font-size:21px;color:var(--on-dark);font-weight:600;letter-spacing:-.01em;}
.topbar-title-btn{background:none;border:0;cursor:pointer;display:flex;align-items:center;gap:9px;padding:4px 8px 4px 0;font-family:inherit;text-align:left;min-width:0;}
.topbar-title-btn>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.topbar-title-btn:hover .topbar-kbd{border-color:rgba(var(--sf),.3);color:var(--on-dark-2);}
.topbar-kbd{flex-shrink:0;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:var(--on-dark-3);border:1px solid var(--line-dark);border-radius:6px;padding:2px 6px;}
@media(max-width:640px){.topbar-kbd{display:none;} .topbar-title-btn{flex:1;}}

.cmdk-overlay{position:fixed;inset:0;z-index:10040;background:rgba(6,10,14,.5);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px;animation:fadeIn .12s ease both;}
.cmdk{width:min(560px,100%);background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius);box-shadow:0 40px 100px -24px rgba(0,0,0,.6);overflow:hidden;}
.cmdk-input{width:100%;border:0;background:transparent;color:var(--ink);font-family:'Inter',sans-serif;font-size:16px;padding:16px 18px;border-bottom:1px solid var(--line);outline:none;}
.cmdk-input::placeholder{color:var(--muted);}
.cmdk-list{max-height:min(56vh,380px);overflow-y:auto;padding:6px;}
.cmdk-row{width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border:0;background:none;border-radius:9px;cursor:pointer;font-family:'Inter',sans-serif;text-align:left;color:var(--ink-soft);}
.cmdk-row.sel{background:var(--surface-alt);color:var(--ink);}
.cmdk-label{flex:1;min-width:0;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cmdk-tag{flex-shrink:0;font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);border:1px solid var(--line);border-radius:5px;padding:2px 7px;}
.cmdk-empty{padding:18px 14px;color:var(--muted);font-size:13px;font-family:'Inter',sans-serif;}
.cmdk-foot{border-top:1px solid var(--line);padding:8px 14px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--faint);display:flex;gap:8px;}
.cmdk-foot kbd{border:1px solid var(--line);border-radius:4px;padding:1px 5px;}

.month-picker,.month-row{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;}
.month-picker select,.month-row select{appearance:none;-webkit-appearance:none;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23BE8A2E' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 12px center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:9px 32px 9px 13px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);cursor:pointer;box-shadow:var(--sh-1);}
.month-picker select:focus,.month-row select:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(190,138,46,.2);}

.badge-ok,.badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:5px 11px;border-radius:999px;background:rgba(63,107,74,.2);color:var(--positive-bright);font-weight:600;letter-spacing:.01em;border:1px solid rgba(127,191,143,.2);}
.badge-off{background:rgba(160,58,42,.18);color:var(--negative-bright);border-color:rgba(224,145,127,.2);}
.badge-warn{background:rgba(190,138,46,.18);color:var(--gold-bright);border-color:rgba(220,169,74,.22);}

.grade-picker{display:flex;align-items:center;gap:7px;color:var(--on-dark-2);font-size:12.5px;}
.grade-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--line-dark);background:rgba(var(--sf),.04);color:var(--on-dark-2);cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:13px;transition:all .15s var(--ease);}
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
.block-header-n{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--gold-bright);letter-spacing:.12em;text-transform:uppercase;padding:4px 9px;border:1px solid var(--line-dark);border-radius:999px;background:rgba(var(--sf),.03);}
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
.field-input-wrap{display:flex;align-items:center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--input-bg);padding:7px 11px;transition:border-color .14s var(--ease),box-shadow .14s var(--ease);}
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
.salon-pct-inputwrap{display:flex;align-items:center;gap:5px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--input-bg);padding:6px 10px;}
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
.item-flag-editor textarea{width:100%;padding:9px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12.5px;resize:vertical;background:var(--input-bg);}
.item-flag-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}
.item-flag-note{background:rgba(160,58,42,.08);border-left:3px solid var(--negative);border-radius:var(--radius-sm);padding:9px 12px;font-size:12.5px;color:var(--ink-soft);margin-bottom:12px;line-height:1.45;}
.item-flag-note b{color:var(--negative);}
.flag-list{display:flex;flex-direction:column;gap:7px;margin-bottom:16px;}
.flag-list-row{display:flex;gap:10px;background:rgba(160,58,42,.06);border:1px solid rgba(160,58,42,.18);border-radius:var(--radius-sm);padding:9px 12px;}
.flag-list-num{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--negative);flex-shrink:0;}
.flag-list-comment{font-size:12.5px;color:var(--ink-soft);line-height:1.4;}

.ez-sub{display:flex;flex-wrap:wrap;gap:8px 18px;width:100%;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink-soft);border-top:1px dashed var(--line-strong);padding-top:10px;margin-top:6px;}
.calls-hint{display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;background:var(--surface-alt);border:1px solid var(--line);border-radius:8px;padding:7px 11px;font-size:11.5px;color:var(--ink-soft);margin-bottom:8px;}
.calls-hint-use{background:none;border:1px solid var(--gold);color:var(--gold-ink,var(--ink));border-radius:999px;padding:3px 11px;font-size:11px;font-family:inherit;cursor:pointer;}

/* ---------- buttons ---------- */
.save-bar{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:24px;flex-wrap:wrap;}
.save-hint{margin-right:auto;font-size:11.5px;color:var(--on-dark-3);font-family:'IBM Plex Mono',monospace;}
.btn-primary{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);border:none;border-radius:var(--radius-sm);padding:13px 26px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;box-shadow:0 6px 18px -4px rgba(190,138,46,.5),inset 0 1px 0 rgba(255,255,255,.28);letter-spacing:.01em;transition:transform .14s var(--ease),box-shadow .16s var(--ease),filter .16s var(--ease);}
.btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 26px -6px rgba(190,138,46,.55),inset 0 1px 0 rgba(255,255,255,.3);filter:brightness(1.03);}
.btn-primary:active:not(:disabled){transform:translateY(0);}
.btn-primary:disabled{opacity:.55;cursor:default;}
.btn-secondary{background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark);border-radius:var(--radius-sm);padding:11px 18px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s var(--ease);}
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
.img-modal-tools button{width:28px;height:28px;border:none;border-radius:50%;background:rgba(var(--sf),.1);color:var(--on-dark);font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}
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
.inner-tabs{display:flex;gap:3px;margin-bottom:20px;background:rgba(var(--sf),.05);border:1px solid var(--line-dark);border-radius:10px;padding:4px;width:fit-content;max-width:100%;}
.inner-tabs button{background:none;border:none;color:var(--on-dark-2);padding:8px 15px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;font-family:inherit;white-space:nowrap;transition:background .15s var(--ease),color .15s var(--ease);}
.inner-tabs button:hover{color:var(--on-dark);}
.inner-tabs button.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);box-shadow:0 3px 10px rgba(190,138,46,.32);}

.status-line{font-size:12px;color:var(--on-dark-2);margin-bottom:12px;letter-spacing:.01em;}
.reply-banner{background:rgba(190,138,46,.12);color:var(--gold-bright);border:1px solid rgba(220,169,74,.2);border-radius:var(--radius-md);padding:11px 15px;font-size:13px;margin-bottom:14px;line-height:1.45;}
.edit-toggle-bar{display:flex;justify-content:flex-end;margin-bottom:14px;}
.correction-bar{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-bottom:16px;box-shadow:var(--sh-2);}
.correction-bar textarea{width:100%;padding:9px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;resize:vertical;background:var(--input-bg);}
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
.adj-comment{flex:1;padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--input-bg);font-size:12px;font-family:inherit;}
.adj-amount{width:104px;padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--input-bg);font-family:'IBM Plex Mono',monospace;font-size:13px;}

/* ---------- chart & quarter ---------- */
.chart-wrap{background:var(--surface);border-radius:var(--radius);padding:22px;border:1px solid var(--line);box-shadow:var(--sh-2);overflow:hidden;min-width:0;}
.chart-note{font-size:11px;color:var(--muted);margin-top:10px;line-height:1.45;}
.quarter-panel{background:var(--surface);border-radius:var(--radius);padding:22px;border:1px solid var(--line);box-shadow:var(--sh-2);}
.quarter-panel h3{font-family:'Fraunces',serif;font-size:19px;margin:0 0 4px;color:var(--ink);}
.quarter-row{border-top:1px solid var(--line);padding:16px 0;}
.quarter-row-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;font-weight:600;font-size:14px;}
.over-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted);margin-bottom:8px;max-width:240px;}
.over-field input,.over-field textarea{padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:'IBM Plex Mono',monospace;background:var(--input-bg);font-size:13px;}
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
/* без .app-root — інакше не діє в модалках-порталах (див. коментар вище) */
*:focus-visible{outline:2px solid var(--gold-bright);outline-offset:2px;border-radius:3px;}
button{transition:transform .12s var(--ease),box-shadow .12s var(--ease),background .15s var(--ease),border-color .15s var(--ease),color .15s var(--ease);}
button:active:not(:disabled){transform:scale(.985);}
.tm-tab,.inner-tabs button{min-height:38px;}
.grade-btn,.store-remove,.shot-remove{min-width:28px;}

::-webkit-scrollbar{width:10px;height:10px;}
::-webkit-scrollbar-thumb{background:rgba(var(--sf),.14);border-radius:999px;border:2px solid transparent;background-clip:content-box;}
::-webkit-scrollbar-thumb:hover{background:rgba(var(--sf),.24);background-clip:content-box;}

@media (prefers-reduced-motion:reduce){
  .app-root *,.app-root *::before,.app-root *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}
}

/* ---------- responsive ---------- */
@media (max-width:640px){
  .view{padding:4px 13px 84px;}
  .topbar{padding:calc(12px + env(safe-area-inset-top)) calc(13px + env(safe-area-inset-right)) 12px calc(13px + env(safe-area-inset-left));margin:calc(-1 * env(safe-area-inset-top)) -13px 10px;gap:8px;}
  .topbar-title{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1;}
  .topbar .topbar-back{padding:9px 10px;font-size:0;flex-shrink:0;}
  .topbar-back svg{width:18px;height:18px;}
  .topbar-right{gap:8px;flex-shrink:0;}
  .topbar .topbar-fb,.topbar .topbar-theme,.topbar .topbar-quick,.topbar .notif-bell,.topbar .topbar-menu{width:40px;height:40px;}
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
.deck-tile{background:rgba(var(--sf),.035);border:1px solid var(--line-dark);border-radius:16px;padding:17px;display:flex;flex-direction:column;text-align:left;color:var(--on-dark);transition:transform .18s var(--ease),border-color .18s var(--ease),box-shadow .18s var(--ease);}
button.deck-tile,.deck-tile button{cursor:pointer;font-family:inherit;}
button.deck-tile:hover,.deck-orow:hover,.deck-tm-top:hover{transform:translateY(-2px);border-color:var(--line-strong);}

.deck-ic{flex-shrink:0;display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(180deg,var(--surface-alt),var(--surface-sink));color:var(--gold-ink);}
.deck-ic-sm{width:30px;height:30px;border-radius:9px;}
.deck-ic-gold{width:50px;height:50px;background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);box-shadow:0 8px 22px -8px rgba(190,138,46,.5);}
.deck-name{font-weight:700;font-size:13.5px;letter-spacing:-.01em;color:var(--on-dark);line-height:1.25;text-align:left;}
.deck-grid .deck-name,.deck-grid .deck-role,.deck-grid .deck-orow-body,.deck-grid .deck-hd{text-align:left;}
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
.deck-orow{display:flex;align-items:center;gap:11px;background:rgba(var(--sf),.03);border:1px solid var(--line-dark);border-radius:11px;padding:13px;text-align:left;transition:transform .16s var(--ease),border-color .16s var(--ease);}
.deck-orow-body{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left;}
.deck-orow .deck-name,.deck-orow .deck-role{text-align:left;}

.deck-tm{grid-column:span 4;gap:13px;}
.deck-tm-top{display:flex;align-items:center;gap:12px;background:none;border:1px solid transparent;border-radius:11px;margin:-4px;padding:4px;text-align:left;transition:transform .16s var(--ease);}
.deck-chips{display:flex;flex-wrap:wrap;gap:8px;}
.deck-chip{display:inline-flex;align-items:baseline;gap:7px;font-size:12px;color:var(--on-dark);background:rgba(var(--sf),.04);border:1px solid var(--line-dark);border-radius:9px;padding:8px 12px;cursor:pointer;font-family:inherit;transition:border-color .15s var(--ease),background .15s var(--ease);}
.deck-chip:hover{border-color:var(--gold);background:rgba(190,138,46,.1);}
.deck-chip b{font-weight:600;}
.deck-chip span{color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:10px;}

/* ---------- заглушка кабінету офісу ---------- */
.office-stub{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:44px 28px;text-align:center;box-shadow:var(--sh-2);}
.office-stub-ic{display:inline-grid;place-items:center;width:56px;height:56px;border-radius:16px;background:linear-gradient(180deg,var(--surface-alt),var(--surface-sink));color:var(--gold);margin-bottom:16px;}
.office-stub h3{font-family:'Fraunces',serif;font-size:19px;color:var(--ink);margin:0 0 8px;font-weight:600;}
.office-stub p{color:var(--muted);font-size:13px;max-width:42ch;margin:0 auto;line-height:1.5;}
.cab-bottom{display:none;}
@media (max-width:880px){
  .deck-grid{grid-template-columns:repeat(2,1fr);}
  .deck-lead,.deck-office{grid-column:span 2;grid-row:auto;}
  .deck-tm{grid-column:span 2;}
  .deck-office{flex-direction:row;flex-wrap:wrap;}
  .deck-office .deck-hd{width:100%;}
  .deck-orow{flex:1 1 180px;}
  .cab-shell .cab-layout{grid-template-columns:1fr;gap:0;}
  .topbar-menu{display:flex;}
  .cab-scrim{display:block;}
  .cab-content{padding-bottom:72px;}
  .cab-bottom{
    display:flex;position:fixed;left:0;right:0;bottom:0;z-index:60;
    background:var(--bg-2);border-top:1px solid var(--line-dark);
    padding:6px 4px calc(6px + env(safe-area-inset-bottom));
    box-shadow:0 -8px 24px -14px rgba(0,0,0,.5);
  }
  .cbn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;
    color:var(--on-dark-3);font-family:inherit;font-size:9.5px;font-weight:600;cursor:pointer;padding:5px 2px;position:relative;min-width:0;}
  .cbn span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .cbn svg{flex-shrink:0;}
  .cbn.on{color:var(--gold-bright);}
  .cbn-dot{position:absolute;top:3px;right:calc(50% - 15px);width:7px;height:7px;border-radius:50%;background:var(--negative-bright);}
  .cbn-plus{color:var(--gold-ink);}
  .cbn-plus svg{background:linear-gradient(180deg,var(--gold-bright),var(--gold));border-radius:12px;width:38px;height:38px;padding:9px;margin-top:-16px;box-shadow:0 8px 18px -6px rgba(220,169,74,.55);}
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

/* комп'ютер: меню ховається ліворуч і виїжджає, коли навести мишу на лівий край екрана */
.cab-edge{display:none;}
@media (min-width:881px){
  .cab-shell .cab-layout{grid-template-columns:1fr;gap:0;}
  .cab-edge{display:block;position:fixed;left:0;top:0;bottom:0;width:12px;z-index:69;}
  .cab-edge::after{content:"";position:absolute;left:0;top:50%;width:4px;height:72px;transform:translateY(-50%);border-radius:0 4px 4px 0;background:var(--gold);opacity:.55;transition:opacity .2s var(--ease);}
  .cab-edge:hover::after{opacity:1;}
  .cab-shell .cab-side{
    position:fixed;top:0;left:0;bottom:0;z-index:70;width:280px;overflow-y:auto;
    border-radius:0;border:none;border-right:1px solid var(--line-dark);
    background:linear-gradient(180deg,var(--bg-2),var(--bg));
    box-shadow:0 0 60px rgba(0,0,0,.5);
    padding:18px 10px 16px;
    transform:translateX(-102%);
    transition:transform .22s var(--ease);
  }
  .cab-shell .cab-side.peek{transform:translateX(0);}
  /* закріплене меню — як раніше: постійна колонка ліворуч */
  .cab-shell .cab-layout.pinned{grid-template-columns:232px 1fr;gap:22px;}
  .cab-shell .cab-layout.pinned .cab-side{position:sticky;top:78px;bottom:auto;z-index:auto;width:auto;overflow:visible;border-radius:var(--radius-md);border:1px solid var(--line-dark);background:rgba(var(--sf),.03);box-shadow:none;padding:8px;transform:none;}
}
.cab-side-top{display:none;}
.cab-pin{display:none;}
@media (min-width:881px){
  .cab-side-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 4px 6px 12px;}
  .cab-side-title{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--on-dark-3);}
  .cab-pin{display:flex;align-items:center;justify-content:center;margin:0;width:32px;height:32px;padding:0;border:1px solid var(--line-dark);border-radius:999px;background:none;color:var(--on-dark-3);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease),background .15s var(--ease);}
  .cab-pin:hover{color:var(--on-dark);border-color:var(--gold);}
  .cab-pin.on{color:var(--gold-ink);background:linear-gradient(180deg,var(--gold-bright),var(--gold));border-color:var(--gold);}
  .cab-pin svg{transform:rotate(-45deg);}
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
.lg-recover-in{width:100%;padding:10px 12px;border:1px solid var(--line-dark);border-radius:var(--radius-sm);background:rgba(var(--sf),.05);color:var(--on-dark);font-family:inherit;font-size:13px;}
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
.topbar-logout{background:rgba(var(--sf),.06);border:1px solid var(--line-dark);color:var(--on-dark-2);font-size:12px;padding:7px 13px;border-radius:999px;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease);}
.topbar-logout:hover{color:var(--negative-bright);border-color:rgba(224,145,127,.4);}

.qc-wrap{position:relative;}
.topbar-quick{background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease),transform .15s var(--ease);}
.topbar-quick:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);transform:rotate(90deg);}
.qc-panel{position:absolute;top:46px;right:0;min-width:190px;z-index:61;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 24px 60px -18px rgba(0,0,0,.55);padding:6px;display:flex;flex-direction:column;gap:2px;}
.qc-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;background:none;border:none;color:var(--on-dark);font-size:13px;text-align:left;cursor:pointer;transition:background .12s var(--ease);}
.qc-item:hover{background:rgba(var(--sf),.08);}
.qc-item svg{color:var(--gold-bright);flex-shrink:0;}

/* ---------- сповіщення ---------- */
.notif-wrap{position:relative;}
.notif-bell{position:relative;background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease);}
.notif-bell:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.notif-dot{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--negative-bright);color:#1a0f0d;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg-2);}
.notif-backdrop{position:fixed;inset:0;z-index:60;}
.notif-panel{position:absolute;top:46px;right:0;width:min(340px,86vw);max-height:70vh;overflow:auto;z-index:61;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 24px 60px -18px rgba(0,0,0,.55);}
.notif-panel-head{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--line);font-family:'Fraunces',serif;font-size:15px;color:var(--ink);font-weight:600;}
.notif-clear{background:none;border:none;color:var(--gold);font-size:12px;cursor:pointer;font-family:inherit;}
.notif-push{display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--ink-soft);font-family:inherit;font-size:12.5px;cursor:pointer;text-align:left;}
.notif-push:hover:not(:disabled){background:var(--surface-alt);}
.notif-push:disabled{cursor:default;opacity:.7;}
.notif-push>span:first-of-type{flex:1;}
.notif-push.on{color:var(--ink);}
.notif-push svg{color:var(--muted);flex-shrink:0;}
.notif-push.on svg{color:var(--gold);}
.notif-push-sw{width:32px;height:18px;border-radius:999px;background:var(--surface-sink);position:relative;flex-shrink:0;transition:background .15s;}
.notif-push-sw::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--input-bg);box-shadow:var(--sh-1);transition:transform .16s var(--ease);}
.notif-push-sw.on{background:var(--gold);}
.notif-push-sw.on::after{transform:translateX(14px);}
.notif-list{display:flex;flex-direction:column;}
.notif-empty{padding:26px 15px;text-align:center;color:var(--muted);font-size:13px;}
.notif-item{display:flex;gap:10px;padding:12px 15px;border-bottom:1px solid var(--line);align-items:flex-start;width:100%;text-align:left;background:none;border-left:none;border-right:none;border-top:none;font-family:inherit;cursor:default;}
.notif-item:last-child{border-bottom:none;}
.notif-item.notif-unread{background:rgba(190,138,46,.07);}
.notif-item.is-link{cursor:pointer;}
.notif-item.is-link:hover{background:rgba(190,138,46,.12);}
.notif-item.is-link .notif-body time{color:var(--gold);}
.notif-ic{color:var(--gold);flex-shrink:0;margin-top:1px;}
.notif-body{min-width:0;}
.notif-body b{display:block;font-size:13px;color:var(--ink);font-weight:600;}
.notif-body p{margin:2px 0 0;font-size:12.5px;color:var(--ink-soft);}
.notif-body time{font-size:11px;color:var(--muted);}
.toast-stack{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;width:max-content;max-width:92vw;}
.taskgate-overlay{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(6,10,14,.72);backdrop-filter:blur(3px);padding:20px;animation:fadeIn .2s ease both;}
.taskgate{width:50vw;min-width:min(340px,92vw);max-width:620px;min-height:42vh;display:flex;flex-direction:column;justify-content:center;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 40px 120px -20px rgba(0,0,0,.7);padding:34px 32px;color:var(--ink);text-align:center;}
.taskgate-eyebrow{display:flex;align-items:center;justify-content:center;gap:8px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-bright);}
.taskgate-pri{background:rgba(160,58,42,.18);color:var(--negative-bright);padding:2px 8px;border-radius:999px;letter-spacing:.04em;}
.taskgate-title{font-family:'Fraunces',serif;font-size:1.7rem;font-weight:600;line-height:1.2;color:var(--ink);text-wrap:balance;}
.taskgate-desc{font-size:14px;line-height:1.55;color:var(--ink-soft);white-space:pre-wrap;max-height:32vh;overflow:auto;}
.taskgate-meta{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--muted);display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.taskgate-btn{align-self:center;margin-top:6px;padding:12px 32px;font-size:14px;}
@media(max-width:640px){.taskgate{width:92vw;min-height:46vh;padding:26px 20px;}.taskgate-title{font-size:1.4rem;}}
.update-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));z-index:10000;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:999px;background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);box-shadow:0 16px 40px -12px rgba(0,0,0,.5);font-size:13px;font-weight:600;}
.update-banner button{display:inline-flex;align-items:center;gap:5px;border:none;background:rgba(20,16,8,.16);color:inherit;font:inherit;padding:6px 12px;border-radius:999px;cursor:pointer;}
.update-banner button:hover{background:rgba(20,16,8,.28);}
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

.admin-subnav{display:flex;gap:4px;margin-bottom:16px;background:rgba(var(--sf),.05);border:1px solid var(--line-dark);border-radius:10px;padding:4px;width:fit-content;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.admin-subnav button{background:none;border:none;color:var(--on-dark-2);padding:8px 14px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;transition:background .15s var(--ease),color .15s var(--ease);}
.admin-subnav button:hover{color:var(--on-dark);}
.admin-subnav button.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);}
.admin-panel + .admin-panel{margin-top:14px;}
.admin-access-row{display:flex;align-items:center;gap:12px;background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);padding:11px 14px;flex-wrap:wrap;}
.admin-pass-input{flex:1;min-width:140px;padding:8px 11px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--input-bg);font-family:'IBM Plex Mono',monospace;font-size:13px;}
.admin-reassign-form{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:14px 0;padding:14px;background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);}
.admin-reassign-form .over-field{max-width:none;flex:1 1 200px;margin-bottom:0;}
.admin-reassign-form select{width:100%;}
.admin-reassign-form input[type=date],.admin-reassign-form input[type=text],.admin-reassign-form input:not([type]){width:100%;padding:8px 10px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;background:var(--surface);color:var(--ink);}
.admin-sub-h{font-family:'Fraunces',serif;font-size:14px;font-weight:600;color:var(--ink);margin:22px 0 10px;}
.dir-mod{display:flex;flex-direction:column;gap:6px;}
.dir-sec{margin-bottom:4px;}
.dir-hist{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;}
.dir-hist-row{display:grid;grid-template-columns:1fr 1.4fr auto;gap:10px;padding:9px 12px;font-size:12.5px;border-bottom:1px solid var(--line);background:var(--surface);}
.dir-hist-row:last-child{border-bottom:none;}
.dir-hist-salon{font-weight:600;color:var(--ink);}
.dir-hist-fop{color:var(--ink-soft);}
.dir-hist-from{font-family:'IBM Plex Mono',monospace;color:var(--muted);white-space:nowrap;}
.modacc-cab{border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);}
.modacc-head{width:100%;display:flex;align-items:center;gap:9px;padding:11px 13px;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;color:var(--ink);}
.modacc-head:hover{background:var(--surface-alt);}
.modacc-chev{flex-shrink:0;transition:transform .15s var(--ease);color:var(--muted);}
.modacc-chev.open{transform:rotate(90deg);}
.modacc-name{flex:1;font-weight:600;font-size:13px;}
.modacc-count{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);}
.modacc-body{padding:6px 13px 12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:2px;}
.modacc-group{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:9px 0 3px;}
.modacc-row{display:flex;align-items:center;gap:9px;padding:6px 4px;font-size:13px;color:var(--ink);cursor:pointer;border-radius:6px;}
.modacc-row:hover{background:var(--surface-alt);}
.modacc-row.locked{cursor:default;color:var(--muted);}
.modacc-row input{width:16px;height:16px;flex-shrink:0;accent-color:var(--gold);}
.modacc-lock{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--faint);}
.modacc-badge{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-bright);background:rgba(190,138,46,.14);padding:2px 6px;border-radius:999px;}
.modacc-rm{margin-left:auto;background:none;border:none;color:var(--negative-bright);font-size:11px;cursor:pointer;font-family:inherit;padding:2px 4px;}
.modacc-rm:hover{text-decoration:underline;}
.modacc-add{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);}
.modacc-add-lbl{font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;margin-right:2px;}
.modacc-add-chip{display:inline-flex;align-items:center;gap:4px;background:rgba(var(--sf),.06);border:1px solid var(--line-dark);border-radius:999px;padding:5px 10px;font-size:12px;color:var(--ink);cursor:pointer;font-family:inherit;}
.modacc-add-chip:hover{background:rgba(190,138,46,.12);border-color:rgba(220,169,74,.35);}
.modacc-add-chip:disabled{opacity:.5;cursor:default;}
.admin-rights{display:flex;flex-direction:column;gap:14px;margin-top:14px;}
.admin-rights-person{background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;}
.admin-rights-name{font-weight:700;font-size:13.5px;color:var(--ink);margin-bottom:9px;}
.admin-rights-caps{display:flex;flex-direction:column;gap:7px;}
.admin-cap{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink-soft);cursor:pointer;}
.admin-cap input[type=checkbox]{width:15px;height:15px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;}
.admin-logrows{display:flex;flex-direction:column;margin-top:10px;}
.admin-logrow{display:grid;grid-template-columns:150px 1fr 1fr 1fr;gap:12px;padding:8px 0;border-bottom:1px dashed var(--line);font-size:11.5px;}
.admin-log-time{font-family:'IBM Plex Mono',monospace;color:var(--muted);}
.admin-log-act{color:var(--ink-soft);font-weight:600;}
.admin-log-detail{color:var(--muted);}
.admin-log-actor{color:var(--ink-soft);text-align:right;}

/* ---------- модуль «Задачі» ---------- */
/* індикатор перерахунку — у шапці біля дзвіночка, завжди в потоці (без стрибків) */
.calc-busy-dot{width:14px;height:14px;flex:0 0 14px;border-radius:50%;border:2px solid var(--line-dark);border-top-color:var(--gold-bright);opacity:0;transition:opacity .2s var(--ease);}
.calc-busy-dot.on{opacity:1;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.tasks-mod{animation:fadeIn .28s ease both;}
.tasks-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.tasks-head .ov-h{margin:0;}
.btn-primary.small,.btn-secondary.small{padding:7px 13px;font-size:12px;}
.task-input{width:100%;padding:10px 12px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;background:var(--input-bg);resize:vertical;}

/* міні-дашборд + фільтр */
.tasks-dash{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-bottom:14px;padding:10px 14px;background:rgba(var(--sf),.03);border:1px solid var(--line-dark);border-radius:var(--radius-md);font-size:12px;color:var(--on-dark-2);}
.tasks-dash b{color:var(--on-dark);font-size:14px;font-weight:700;margin-right:3px;}
.tasks-dash-alert{color:var(--gold-bright);}
.tasks-filter{margin-left:auto;display:flex;align-items:center;gap:5px;background:none;border:1px solid var(--line-dark);color:var(--on-dark-2);border-radius:999px;padding:6px 12px;font-size:11.5px;font-family:inherit;cursor:pointer;transition:all .14s var(--ease);}
.tasks-filter.on{background:rgba(220,169,74,.16);color:var(--gold-bright);border-color:rgba(220,169,74,.4);}

/* компактні картки */
.task-list{display:flex;flex-direction:column;gap:7px;}
.task-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--sh-1);overflow:hidden;color:var(--ink);}
.task-card.task-card-focus{animation:taskFocusPulse 1.6s ease-out 2;border-color:var(--gold);}
@keyframes taskFocusPulse{0%{box-shadow:0 0 0 0 rgba(220,169,74,.5);}100%{box-shadow:0 0 0 10px rgba(220,169,74,0);}}
.task-card.task-overdue{border-color:rgba(160,58,42,.5);}
.task-card.task-card-done{opacity:.6;}
.task-card-main{width:100%;display:flex;align-items:flex-start;gap:10px;padding:11px 14px;background:none;border:none;font-family:inherit;text-align:left;cursor:pointer;}
.task-card-main:hover{background:rgba(190,138,46,.05);}
.task-star{color:var(--gold);flex-shrink:0;}
.task-card-main .task-title{font-weight:600;font-size:13px;line-height:1.4;color:var(--ink);white-space:normal;overflow-wrap:anywhere;flex:1 1 0;min-width:0;}
.task-card-sub{font-size:11px;line-height:1.4;color:var(--muted);font-family:'IBM Plex Mono',monospace;white-space:normal;text-align:right;margin-left:auto;flex:0 1 auto;max-width:42%;}
@media(max-width:640px){.task-card-main{flex-wrap:wrap;}.task-card-sub{order:3;flex-basis:100%;max-width:100%;text-align:left;margin-left:0;}}
.task-due-over{color:var(--negative);font-weight:600;}
.task-dot{width:10px;height:10px;margin-top:4px;border-radius:999px;flex-shrink:0;background:var(--muted);}
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

/* задача, поставлена мені особисто і ще не виконана — підсвічуємо синім, щоб впадала в очі в спільному списку */
.task-card.task-card-mine{border-left:3px solid #4E6C97;background:rgba(78,108,151,.06);}
/* задача одразу кільком отримувачам — одна картка замість N однакових */
.task-group-progress{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--muted);background:var(--surface-alt);border-radius:999px;padding:2px 9px;flex-shrink:0;}
.task-group-list{display:flex;flex-direction:column;gap:4px;margin-top:10px;}
.task-group-row{padding:6px 10px;border-radius:8px;font-size:12.5px;background:var(--surface-alt);}
.tg-row-main{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.task-group-row .tg-name{font-weight:600;color:var(--ink);}
.task-group-row .tg-status{font-size:11px;font-family:'IBM Plex Mono',monospace;}
.tg-comment{margin:5px 0 0;font-size:12px;color:var(--ink-soft);background:rgba(190,138,46,.07);border-radius:6px;padding:6px 9px;}
.task-group-row.tg-done{background:rgba(63,107,74,.1);}
.task-group-row.tg-done .tg-status{color:var(--positive);}
.task-group-row.tg-open .tg-status{color:var(--negative);}
.task-group-row.tg-mine{outline:1.5px solid #4E6C97;background:rgba(78,108,151,.1);}
.task-group-row.tg-mine .tg-status{color:#4E6C97;}

/* ---------- безнальні рахунки ---------- */
/* ---------- команда / співробітники ---------- */
/* ---------- графік змін ---------- */
.inv-toolbar-sel{appearance:none;-webkit-appearance:none;background:var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23BE8A2E' d='M1 1l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 28px 7px 11px;font-family:inherit;font-size:12.5px;color:var(--ink);cursor:pointer;}
.shift-lock{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:12px;}
.shift-lock-h{font-weight:700;font-size:13px;color:var(--gold-bright);}
.shift-lock .hint{margin:3px 0 0;}
.shift-lock-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 0;border-top:1px solid var(--line);margin-top:8px;}
.shift-lock-row .sl-salon{font-weight:600;font-size:12.5px;min-width:170px;}
.shift-lock-row .sl-state.ok{color:var(--positive);font-size:12px;}
.shift-lock-row .sl-state.wait{color:var(--gold-bright);font-size:12px;}
.shift-lock-row .sl-gaps{color:var(--negative-bright);font-size:11.5px;}
.shift-lock-row .sl-note{font-style:italic;color:var(--on-dark-2);font-size:12px;}
.shift-lock-row button{padding:5px 12px;font-size:11.5px;}
.shift-lock-reqs{margin-top:10px;}
.shift-lock-reqs .sl-sub{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);}
.shlock-list{display:flex;flex-direction:column;gap:6px;}
.shlock-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);}
.shlock-row.on{border-color:rgba(160,58,42,.4);background:rgba(160,58,42,.06);}
.shlock-nm{font-weight:600;font-size:12.5px;flex:1;min-width:150px;}
.shlock-state{font-size:11.5px;}
.shlock-state.bad{color:var(--negative-bright);}
.shlock-state.ok{color:var(--muted);}
.shlock-row button.small{padding:5px 12px;font-size:11.5px;}
.open-tally{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
.open-tally-chip{background:var(--surface-alt);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:11.5px;}
table.open-log{width:100%;border-collapse:collapse;font-size:12.5px;}
table.open-log th{text-align:left;font-weight:600;color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;padding:4px 8px;border-bottom:1px solid var(--line);}
table.open-log td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;}
table.open-log .open-log-t{font-variant-numeric:tabular-nums;color:var(--negative-bright);font-weight:600;white-space:nowrap;}

/* --- Коди ЗСУ --- */
.zsu-note{display:flex;gap:7px;align-items:flex-start;background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--radius-md);padding:9px 12px;font-size:11.5px;color:var(--ink-soft);line-height:1.4;margin-bottom:12px;}
.zsu-note svg{flex:none;margin-top:1px;color:var(--gold-bright);}
.zsu-assign{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px;}
.zsu-assign-h{font-weight:700;font-size:12px;}
.zsu-assign select,.zsu-assign textarea{width:100%;background:var(--surface-alt);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12.5px;color:var(--ink);}
.zsu-assign textarea{resize:vertical;font-family:var(--mono,monospace);}
.zsu-assign-f{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.zsu-salon{border:1px solid var(--line);border-radius:var(--radius-md);margin-bottom:8px;overflow:hidden;background:var(--surface);}
.zsu-salon-h{width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--surface-alt);border:none;padding:9px 12px;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;text-align:left;}
.zsu-salon-c{font-weight:500;font-size:11px;color:var(--muted);}
.zsu-codes{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;}
.zsu-code{display:flex;align-items:center;gap:8px;background:var(--surface-alt);border:1px solid var(--line);border-radius:8px;padding:5px 9px;font-size:12px;}
.zsu-code-v{font-family:var(--mono,monospace);font-weight:600;letter-spacing:.02em;}
.zsu-code.used .zsu-code-v{text-decoration:line-through;opacity:.55;}
.zsu-code-rc{font-size:10.5px;color:var(--muted);}
.zsu-use{padding:3px 10px!important;font-size:10.5px!important;}
.zsu-undo{background:none;border:none;color:var(--muted);cursor:pointer;display:flex;padding:2px;}
.zsu-undo:hover{color:var(--negative-bright);}

/* --- Продажі ЕЗ --- */
.ez-process-list{display:flex;flex-direction:column;gap:10px;}
.ez-process-row{border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;background:var(--surface);}
.ez-process-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;}
.ez-process-head b:last-child{margin-left:auto;}
.ez-process-foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12.5px;}
.ez-sale-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);margin-bottom:6px;}
.ez-sale-row > span:nth-child(2){margin-left:auto;font-weight:600;}

/* --- СМ: розрахунок ЗП магазину (одна таблиця) --- */
.st-page{max-width:max(1400px,calc(578px + var(--st-n,3) * 190px));margin:0 auto;}
.st-title{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:var(--on-dark);}
.st-strip{padding:14px 0;display:flex;flex-wrap:nowrap;align-items:stretch;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--sh-1);margin-bottom:12px;}
.st-cell{flex:0 0 auto;padding:0 18px;display:flex;flex-direction:column;gap:6px;border-right:1px solid var(--line);min-width:0;}
.st-cell:first-child{flex:1 1 470px;min-width:470px;padding-left:24px;}
.st-plan,.st-plan label,.st-adjs label,.st-adjs span{white-space:nowrap;}
.st-cell.st-total{border-right:none;margin-left:auto;align-items:flex-end;text-align:right;justify-content:center;}
@media (max-width:1150px){.st-strip{flex-wrap:wrap;row-gap:14px;}.st-cell:first-child{flex:1 1 100%;}}
.st-cap{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--st-cap);}
.st-plan{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-family:'IBM Plex Mono',monospace;color:var(--ink);}
.st-plan em,.st-adjs em{font-style:normal;font-family:'Inter',sans-serif;font-size:11px;color:var(--muted);margin-right:5px;}
.st-plan b{font-size:18px;font-weight:600;}
.st-plan label,.st-adjs label{display:inline-flex;align-items:center;}
.st-pct{font-size:24px;font-weight:600;color:var(--st-neg);}
.st-pct.ok{color:var(--st-pos);}
.st-adjs{display:flex;gap:14px;align-items:center;flex-wrap:wrap;}
.st-rate{font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;color:var(--st-gold);}
.st-hint{font-size:12.5px;color:var(--st-hint);font-weight:400;font-family:'Inter',sans-serif;}
.st-warn{color:var(--st-neg);}
.st-wrap{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--sh-1);overflow-x:auto;}
.st{width:100%;min-width:calc(572px + var(--st-n,3) * 190px);border-collapse:collapse;table-layout:fixed;font-size:13.5px;color:var(--ink);}
.st td,.st th{padding:0 14px;height:40px;border-bottom:1px solid var(--line);vertical-align:middle;}
.st th{height:auto;padding:14px 14px 14px;text-align:left;font-weight:500;border-bottom:1px solid var(--line-strong);}
.st-hl{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--st-cap);vertical-align:bottom;}
.st-he{text-align:right !important;}
.st-en{font-size:15.5px;font-weight:600;color:var(--ink);}
.st-er{font-size:12.5px;color:var(--muted);margin-top:3px;display:flex;justify-content:flex-end;align-items:center;gap:5px;flex-wrap:wrap;}
.st tr.st-gt td{border-top:1px solid var(--line-strong);}
.st-g-in{display:block;white-space:nowrap;}
.st-g{position:relative;vertical-align:top !important;padding-top:12px !important;line-height:16px;}
.st-info{position:absolute;top:11px;right:9px;display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;border:1.3px solid var(--st-cap);color:var(--st-cap);cursor:pointer;flex-shrink:0;text-transform:none;transition:color .15s var(--ease),border-color .15s var(--ease),background .15s var(--ease);}
.st-info:hover,.st-info:focus-visible{color:var(--st-gold);border-color:var(--st-gold);background:rgba(190,138,46,.12);outline:none;}
.cond-h{margin:16px 0 6px;font-family:'Fraunces',serif;font-size:14.5px;font-weight:600;color:var(--ink);}
.st-g{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);background:var(--surface-alt);border-right:1px solid var(--line);}
.st-lab{font-weight:500;}
.st-rule{color:var(--muted);font-size:12.5px;line-height:1.35;}
.st-num{text-align:right;font-size:14.5px;font-family:'IBM Plex Mono',monospace;font-weight:500;font-variant-numeric:tabular-nums;}
.st-mute{color:var(--faint);}
.st-neg{color:var(--st-neg);}
.st tr.st-dim td:not(.st-g){opacity:.55;}
.st-in{width:100%;box-sizing:border-box;height:32px;border-radius:8px;border:1px solid var(--line-strong);background:var(--input-bg);color:var(--ink);font:500 14px 'IBM Plex Mono',monospace;text-align:right;padding:0 10px;}
.st-in:focus{outline:2px solid var(--st-gold);outline-offset:0;border-color:var(--st-gold);}
.st-in-w{max-width:170px;display:block;margin-left:auto;}
.st-in-m{width:96px;}.st-in-s{width:110px;}.st-in-xs{width:56px;}.st-in.off{opacity:.5;}
.st-plan .st-in-w{width:112px;}
.st-ck{display:inline-flex;align-items:center;justify-content:flex-end;gap:8px;width:100%;}
.st-ck>:last-child{flex:none;width:96px;text-align:right;}
.st-ck.st-ck-flex{width:auto;}
.st-ck.st-ck-flex>:last-child{width:auto;}
.st-inp .st-in{max-width:300px;}
.st-inp .st-two{max-width:440px;}
/* тонка вертикальна лінія між співробітниками */
.st td.st-num,.st th.st-he{border-left:1px solid var(--line-strong);}
.st-cb{position:relative;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;cursor:pointer;flex-shrink:0;user-select:none;}
.st-cb.txt{width:auto;padding:0 10px 0 4px;gap:8px;}
.st-cb input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;}
.st-cb-box{width:24px;height:24px;border-radius:7px;border:1.5px solid var(--line-strong);background:var(--input-bg);display:flex;align-items:center;justify-content:center;color:transparent;transition:background .14s var(--ease),border-color .14s var(--ease),box-shadow .14s var(--ease),transform .14s var(--ease);pointer-events:none;flex-shrink:0;}
.st-cb:hover .st-cb-box{border-color:var(--st-gold);box-shadow:0 0 0 3px rgba(190,138,46,.18);}
.st-cb:active .st-cb-box{transform:scale(.92);}
.st-cb.on .st-cb-box{background:linear-gradient(180deg,var(--st-gold),var(--st-gold));border-color:var(--st-gold);color:var(--gold-ink);}
.st-cb input:focus-visible + .st-cb-box{outline:2px solid var(--st-gold);outline-offset:2px;}
.st-cb-t{font-size:13.5px;color:var(--ink);white-space:nowrap;pointer-events:none;}
.st-reset{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--line-strong);border-radius:6px;background:var(--input-bg);color:var(--st-gold);cursor:pointer;padding:0;}
.st-reset:hover{border-color:var(--st-gold);}
.st-ez-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:0;font:inherit;color:inherit;cursor:pointer;}
.st-ez-btn:hover .st-ezv{text-decoration:underline;}
.st-ez-btn svg{color:var(--muted);}
.st-ezv{font-family:'IBM Plex Mono',monospace;font-size:17px;}
.st-ez-sum{color:var(--ink);}
.st-pct-sm{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--st-neg);}
.st-pct-sm.ok{color:var(--st-pos);}
.st tr.st-gross td{background:var(--surface-alt);border-top:1px solid var(--line-strong);}
.st-lbl{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink);white-space:nowrap;}
.st-two{display:flex;gap:6px;align-items:center;}
.st-two .st-in{flex:1 1 0;min-width:0;}
.st-two .st-in-xs{flex:none;width:44px;}
.st-seg{display:inline-flex;gap:3px;vertical-align:middle;margin-right:6px;flex-wrap:wrap;}
.st-seg i,.st-seg button{font-style:normal;font:inherit;font-size:12.5px;padding:3px 10px;border-radius:7px;border:1px solid var(--line-strong);color:var(--muted);background:none;}
.st-seg button{cursor:pointer;}
.st-seg .on{border-color:var(--st-gold);background:rgba(190,138,46,.16);color:var(--st-gold);font-weight:600;}
.st-pill{display:inline-block;padding:3px 11px;border-radius:999px;background:rgba(190,138,46,.16);color:var(--st-gold);font-size:13px;font-weight:600;}
.st-sel{width:100%;height:32px;border-radius:8px;border:1px solid var(--line-strong);background:var(--input-bg);color:var(--ink);font-size:13.5px;padding:0 8px;}
.st tr.st-sub td{background:color-mix(in srgb,var(--surface) 65%,var(--surface-alt));font-weight:600;font-size:15px;height:46px;}
.st tr.st-pay td{background:var(--surface-alt);height:56px;border-bottom:none;font-weight:600;font-size:16px;}
.st-payv{font-family:'IBM Plex Mono',monospace;font-size:23px;font-weight:600;color:var(--st-gold);}
.st-shots{margin:12px 0;}
.st-shots-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px;}
.st-shot{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:10px;}
.st-shot-t{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:6px;}
.st-corr{margin-bottom:18px;}
.st-corr h4{color:var(--on-dark);margin:0 0 8px;font-size:14px;}
.st-plan em,.st-adjs em{font-size:13px !important;}
.st-wrap{overflow:visible;}
.st thead th{position:sticky;top:var(--tb-h,64px);z-index:5;background:var(--surface);box-shadow:0 1px 0 var(--line-strong);}
.st-shots .btn-secondary{font-size:13.5px;padding:9px 14px;}
.st-review-bar .btn-secondary,.st-review-bar .btn-primary,.st-head .btn-secondary,.st-head .btn-primary{font-size:14px;padding:11px 18px;}
@media (max-width:1000px){.st-wrap{overflow-x:auto;}.st thead th{position:static;}}
.btn-primary.st-armed{background:var(--st-neg);color:#fff;}
.st-page{--st-gold:var(--gold);--st-pos:var(--positive);--st-neg:var(--negative);--st-cap:var(--muted);--st-hint:var(--muted);}
:root[data-theme="dark"] .st-page{--st-gold:var(--gold-bright);--st-pos:var(--positive-bright);--st-neg:var(--negative-bright);--st-cap:#A79F8A;--st-hint:#7C8794;}
.st-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px;}
.st-h1{margin:0;font-family:'Fraunces',serif;font-weight:600;font-size:30px;letter-spacing:-.01em;color:var(--on-dark);}
.st-spacer{flex:1;}
.st-monthchip{padding:9px 14px;border-radius:10px;background:var(--surface-alt);border:1px solid var(--line);font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--ink);}
.st-status{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:999px;font-size:13px;font-weight:600;}
.st-status.ok{background:rgba(127,191,143,.16);color:var(--st-pos);}
.st-status.warn{background:rgba(220,169,74,.14);color:var(--st-gold);}
.st-status.info{background:rgba(111,143,191,.16);color:#8FB0E0;}
.st-legend{justify-content:center;gap:6px;font-size:12.5px;color:var(--st-hint);}
.st-legend>div{display:flex;align-items:center;gap:8px;}
.st-lg-box{display:inline-block;width:22px;height:14px;border-radius:4px;border:1px solid var(--line-strong);background:var(--input-bg);}
.st-lg-num{display:inline-block;width:22px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink);}
.st-fs{border:0;padding:0;margin:0;min-width:0;}
.st-fs:disabled .st-in,.st-fs:disabled .st-sel{opacity:1;color:var(--ink);-webkit-text-fill-color:var(--ink);cursor:default;}
.st-fs:disabled .st-cb,.st-fs:disabled .st-cb input{cursor:default;}
.st-pay-strip{margin-top:16px;padding:12px 16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);}
.st-pay-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--line);}
.st-pay-row:first-of-type{border-top:none;}
.st-pay-nm{font-size:15px;font-weight:600;color:var(--ink);min-width:170px;}
.st-pay-sum{font-family:'IBM Plex Mono',monospace;font-size:17px;font-weight:600;color:var(--gold);white-space:nowrap;}
.st-review-bar{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:14px 0;}

.inv-issuer{display:flex;gap:8px;}
.inv-issuer button{flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--line-strong);background:var(--input-bg);color:var(--ink-soft);font-size:13px;font-family:inherit;cursor:pointer;}
.inv-issuer button.on{border-color:var(--gold);background:rgba(190,138,46,.14);color:var(--gold);font-weight:600;}
/* --- Тестування: дошка --- */
.trn-bcard{display:flex;flex-direction:column;width:100%;text-align:left;padding:0;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);color:var(--ink);cursor:pointer;overflow:hidden;font-family:inherit;transition:border-color .15s var(--ease),box-shadow .15s var(--ease);}
.trn-bcard:hover{border-color:var(--gold);box-shadow:var(--sh-2);}
.trn-bcard.over{border-left:3px solid var(--negative-bright);}
.trn-bcard.done{opacity:.8;}
.trn-bcover{width:100%;height:96px;object-fit:cover;object-position:top;display:block;background:var(--surface-alt);}
.trn-bcard-b{display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;}
.trn-bcard-t{font-family:'Fraunces',serif;font-size:14px;font-weight:600;line-height:1.28;letter-spacing:-.01em;}
.trn-detail{background:var(--surface);color:var(--ink);border-radius:var(--radius);width:min(660px,94vw);max-height:90vh;overflow:auto;padding:18px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--sh-3);}
.trn-detail-shot{padding:0;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface-alt);cursor:zoom-in;overflow:hidden;}
.trn-detail-shot img{display:block;width:100%;max-height:220px;object-fit:cover;object-position:top;}
.trn-dlist{display:flex;flex-direction:column;gap:10px;}
.trn-dsalon{border:1px solid var(--line);border-radius:var(--radius-md);padding:8px 12px;}
.trn-dsalon-h{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;font-weight:600;padding-bottom:6px;border-bottom:1px solid var(--line);margin-bottom:4px;}
.trn-dsalon-h b{font-variant-numeric:tabular-nums;color:var(--muted);}
.trn-dsalon-h b.ok{color:var(--positive);}
.trn-de{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:12.5px;}
.trn-de-nm{flex:1;min-width:0;}
.trn-de-sc{font-family:'IBM Plex Mono',monospace;font-weight:600;}
.trn-de-dt{font-size:11px;color:var(--muted);}

.over-err input,.over-err select,.over-err textarea{border-color:var(--negative)!important;box-shadow:0 0 0 3px rgba(160,58,42,.22);}
/* --- ЗП салонів (ТМ): картки магазинів --- */
.sr-summary{display:flex;gap:36px;flex-wrap:wrap;align-items:flex-end;margin:6px 0 20px;}
.sr-summary>div{display:flex;flex-direction:column;gap:6px;}
.sr-sum-v{font-family:'IBM Plex Mono',monospace;font-size:30px;font-weight:600;color:var(--gold-bright);line-height:1;}
.sr-sum-v small{font-size:16px;color:var(--on-dark-2);font-weight:500;}
.sr-summary .st-cap{color:var(--on-dark-3);}
.sr-legend{margin-left:auto;align-items:flex-end;}
.sr-legend .cat-badge{font-size:12px;padding:3px 10px;}
.sr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px;}
.sr-card{display:flex;flex-direction:column;gap:14px;text-align:left;padding:20px 22px 18px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .16s var(--ease),box-shadow .16s var(--ease),transform .16s var(--ease);}
.sr-card:hover{border-color:var(--gold);box-shadow:var(--sh-2);transform:translateY(-2px);}
.sr-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
.sr-nm{display:flex;flex-direction:column;gap:3px;min-width:0;}
.sr-name{font-family:'Fraunces',serif;font-size:22px;font-weight:600;letter-spacing:-.01em;line-height:1.15;}
.sr-addr{font-size:13px;color:var(--muted);}
.sr-cat.cat-badge{font-size:16px;font-weight:700;min-width:38px;height:38px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;flex-shrink:0;}
.sr-total{font-family:'IBM Plex Mono',monospace;font-size:32px;font-weight:600;color:var(--gold);line-height:1;}
:root[data-theme="dark"] .sr-total{color:var(--gold-bright);}
.sr-total small{font-size:17px;color:var(--muted);font-weight:500;}
.sr-dots{display:flex;gap:7px;flex-wrap:wrap;}
.sr-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--line-strong);box-sizing:border-box;}
.sr-dot.submitted{background:var(--positive-bright);border-color:var(--positive-bright);}
.sr-dot.corrected{background:var(--gold-bright);border-color:var(--gold-bright);}
.sr-dot.appr{background:#8FB0E0;border-color:#8FB0E0;}
.sr-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line);font-size:13.5px;}
.sr-state{font-weight:600;color:var(--muted);}
.sr-state.ok{color:var(--positive);}
:root[data-theme="dark"] .sr-state.ok{color:var(--positive-bright);}
.sr-state.part{color:var(--gold);}
:root[data-theme="dark"] .sr-state.part{color:var(--gold-bright);}
.sr-state.none{color:var(--negative);}
:root[data-theme="dark"] .sr-state.none{color:var(--negative-bright);}
.sr-appr{font-size:12.5px;color:var(--muted);}

/* --- Продажі ЕЗ: картки (СМ) --- */
.ez-cards{display:flex;flex-direction:column;gap:10px;}
.ez-month-kpi{display:flex;align-items:baseline;gap:10px;padding:12px 16px;border-radius:var(--radius-md);background:rgba(190,138,46,.1);border:1px solid rgba(190,138,46,.3);margin-bottom:2px;}
.ez-month-kpi b{font-family:'IBM Plex Mono',monospace;font-size:19px;color:var(--gold);}
:root[data-theme="dark"] .ez-month-kpi b{color:var(--gold-bright);}
.ez-card{display:flex;align-items:center;gap:14px;padding:12px 16px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);}
.ez-card-ic{flex-shrink:0;width:38px;height:38px;border-radius:10px;background:rgba(190,138,46,.12);color:var(--gold);display:flex;align-items:center;justify-content:center;}
.ez-card-main{flex:1;min-width:0;}
.ez-card-title{font-weight:600;font-size:13.5px;color:var(--ink);}
.ez-card-sub{display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin-top:2px;}
.ez-card-nums{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;text-align:right;}
.ez-card-amt{font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;color:var(--ink);}
.ez-card-team{font-size:11.5px;color:var(--muted);}
.ez-card-team b{font-family:'IBM Plex Mono',monospace;color:var(--positive);}
:root[data-theme="dark"] .ez-card-team b{color:var(--positive-bright);}
.ez-card-act{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.open-log-total td{border-top:2px solid var(--line-strong);}
.trn-row-active td:first-child{color:var(--gold);font-weight:600;}
:root[data-theme="dark"] .trn-row-active td:first-child{color:var(--gold-bright);}
.ez-team-num{color:var(--positive);}
:root[data-theme="dark"] .ez-team-num{color:var(--positive-bright);}

/* --- Контроль видаткових накладних --- */
.dc-list{display:flex;flex-direction:column;gap:10px;}
.dc-row{display:flex;flex-direction:column;gap:12px;padding:14px 16px;border-radius:var(--radius-md);background:var(--surface);border:1px solid var(--line);}
.dc-row.done{opacity:.62;}
.dc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
.dc-main{display:flex;flex-direction:column;gap:3px;min-width:0;}
.dc-name{font-size:14.5px;font-weight:600;color:var(--ink);}
.dc-sub{font-size:12px;color:var(--muted);}
.dc-amt{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:16px;color:var(--ink);white-space:nowrap;}
.dc-bottom{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.dc-spacer{flex-grow:1;}
.dc-pill{padding:4px 10px;border-radius:999px;font-size:11.5px;font-weight:600;}
.dc-pill.warn{background:rgba(220,169,74,.14);color:var(--gold-bright);}
.dc-pill.bad{background:rgba(224,145,127,.14);color:var(--negative-bright);}
.dc-pill.info{background:rgba(111,143,191,.16);color:#8FB0E0;}
.dc-pill.ok{background:rgba(127,191,143,.16);color:var(--positive-bright);}
.dc-warnbtn{border-color:rgba(224,145,127,.5)!important;color:var(--negative-bright)!important;}

/* --- Тестування --- */
.trn-tabs{display:inline-flex;gap:4px;}
.trn-tabs button{background:none;border:1px solid var(--line-dark);color:var(--on-dark-2);border-radius:999px;padding:4px 12px;font-size:11px;font-family:inherit;cursor:pointer;}
.trn-tabs button.on{background:rgba(220,169,74,.16);color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.trn-card{border:1px solid var(--line);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:10px;background:var(--surface);}
.trn-card.urgent{border-left:3px solid var(--gold);}
.trn-card.overdue{border-left:3px solid var(--negative-bright);}
.trn-card-h{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;}
.trn-card-h b{font-family:'Fraunces',serif;font-size:15px;font-weight:600;line-height:1.28;letter-spacing:-.01em;flex:1;}
.trn-del{background:none;border:none;color:var(--faint);cursor:pointer;padding:2px;flex:none;}
.trn-del:hover{color:var(--negative-bright);}
.trn-card-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
.trn-pill{font-size:10.5px;padding:2px 9px;border-radius:999px;background:var(--surface-alt);color:var(--muted);border:1px solid var(--line);white-space:nowrap;}
.trn-pill.ok{color:var(--positive);border-color:rgba(63,107,74,.4);}
.trn-pill.warn{color:var(--gold-bright);border-color:rgba(220,169,74,.45);background:rgba(220,169,74,.1);}
.trn-pill.bad{color:var(--negative-bright);border-color:rgba(160,58,42,.45);background:rgba(160,58,42,.1);}
.trn-terr{display:flex;align-items:center;gap:10px;padding:8px 11px;background:var(--surface-alt);border-radius:8px;margin-bottom:8px;}
.trn-terr-lab{font-size:11px;color:var(--muted);white-space:nowrap;}
.trn-terr-num{font-size:13px;font-variant-numeric:tabular-nums;}
.trn-terr-bar{flex:1;height:6px;border-radius:999px;background:rgba(0,0,0,.1);overflow:hidden;min-width:60px;}
.trn-terr-bar i{display:block;height:100%;border-radius:999px;background:var(--gold);transition:width .3s ease;}
.trn-terr-bar i.full{background:var(--positive);}
.trn-terr-pct{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;min-width:32px;text-align:right;}
.trn-slist{display:flex;flex-direction:column;}
.trn-srow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 0;border-top:1px solid var(--line);font-size:12px;}
.trn-srow:first-child{border-top:none;}
.trn-srow-nm{font-weight:600;min-width:150px;padding-left:13px;position:relative;}
.trn-srow-nm::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:6px;height:6px;border-radius:50%;background:var(--faint);}
.trn-srow.ok .trn-srow-nm::before{background:var(--positive);}
.trn-srow.part .trn-srow-nm::before{background:var(--gold);}
.trn-srow.none .trn-srow-nm::before{background:var(--negative-bright);}
.trn-dots{display:inline-flex;gap:3px;}
.trn-dot{width:7px;height:7px;border-radius:50%;border:1.5px solid var(--faint);box-sizing:border-box;}
.trn-dot.on{background:var(--positive);border-color:var(--positive);}
.trn-srow-n{font-variant-numeric:tabular-nums;color:var(--muted);}
.trn-srow-miss{flex:1 1 100%;font-size:11px;color:var(--negative-bright);padding-left:13px;}
.trn-srow-miss.ok{color:var(--positive);}
.trn-emp-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}
.trn-emp-tbl td{padding:5px 6px;border-top:1px solid var(--line);}
.trn-emp-tbl tr.done td{opacity:.72;}
.trn-role{color:var(--muted);font-size:10.5px;margin-left:6px;}
.trn-chk{width:34px;text-align:center;}
.trn-emp-tbl .chk{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line-strong,var(--line));background:none;cursor:pointer;}
.trn-emp-tbl .chk.on{background:var(--positive);border-color:var(--positive);}
.trn-score-in{width:56px;background:var(--surface-alt);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font-family:inherit;font-size:12px;text-align:center;}
.trn-status{width:132px;}
.trn-status-sel{width:100%;background:var(--surface-alt);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font-family:inherit;font-size:12px;color:var(--ink);}
.trn-when{font-size:10.5px;color:var(--muted);white-space:nowrap;}
.trn-salon-grid{display:flex;flex-direction:column;gap:4px;}
.trn-salon-row{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:12px;padding:3px 0;}
.trn-salon-row.ok .trn-salon-p{color:var(--positive);}
.trn-salon-nm{font-weight:600;min-width:150px;}
.trn-salon-p{font-variant-numeric:tabular-nums;}
.trn-salon-miss{font-size:11px;color:var(--negative-bright);}
.trn-avg{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:10px 13px;margin-bottom:12px;}
.trn-avg-h{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px;}
.trn-avg-row{display:flex;justify-content:space-between;font-size:12.5px;padding:2px 0;}
.trn-modal,.zsu-modal{background:var(--surface);color:var(--ink);border-radius:var(--radius-md);padding:18px 20px;width:min(440px,92vw);max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:10px;}
.trn-modal h3,.zsu-modal h3{margin:0;font-size:15px;}
.trn-upl{align-self:flex-start;}
.trn-ocr{font-size:11.5px;color:var(--muted);background:var(--surface-alt);border-radius:6px;padding:6px 9px;}
.trn-shot{width:100%;border-radius:8px;border:1px solid var(--line);max-height:180px;object-fit:contain;background:var(--surface-alt);}
.trn-dates{display:flex;gap:10px;}
.trn-dates .over-field{flex:1;}
.trn-modal-f,.zsu-modal-f{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}
.trn-modal input[type=date],.zsu-modal input[type=date],.zsu-modal input[type=text],.zsu-modal input:not([type]){background:var(--surface-alt);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12.5px;color:var(--ink);width:100%;}
/* без горизонтального скролу — таблиця фіксованого макета розтягується на всю ширину,
   стовпці днів рівномірно ділять залишок після колонки імені й підсумку (мал. екрани — медіа нижче) */
.grid-scroll{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);}
/* графік змін: окремі плитки з проміжком, як на макеті */
.grid-scroll.sched-wrap{background:transparent;border:none;border-radius:0;overflow:visible;}
table.sched{table-layout:fixed;width:100%;border-collapse:separate;border-spacing:2px;font-family:'IBM Plex Mono',monospace;font-size:11px;}
table.sched th,table.sched td{border:none;text-align:center;padding:0;}
table.sched thead th{position:sticky;top:var(--sched-top,64px);z-index:6;background:var(--bg-2);box-shadow:0 0 0 1px var(--bg-2);color:var(--muted);font-weight:700;font-size:12.5px;padding:2px 0 6px;line-height:1.2;}
table.sched thead th.we{color:var(--positive);}
table.sched .wd{display:block;font-size:9.5px;font-weight:500;opacity:.8;}
table.sched .rh{width:118px;text-align:left;padding:0 10px;background:transparent;font-family:'Inter',sans-serif;line-height:1.2;overflow:hidden;}
table.sched .rh .nm{font-size:12.5px;font-weight:600;color:var(--ink);word-break:break-word;}
table.sched .rh .rl{font-size:10.5px;color:var(--muted);font-weight:400;}
table.sched .grp td{background:var(--surface-alt);text-align:left;padding:8px 10px;font-size:12px;font-weight:500;letter-spacing:.04em;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
table.sched tr.grp:not(:first-child) td{border-top:6px solid transparent;background-clip:padding-box;}
td.sh{height:36px;background:var(--surface);color:var(--ink);overflow:hidden;white-space:nowrap;text-overflow:clip;font-size:12.5px;font-weight:700;}
td.sh-edit{cursor:pointer;}
td.sh-edit:hover{filter:brightness(1.35);}
td.sh-off{background:linear-gradient(rgba(190,138,46,.24),rgba(190,138,46,.24)),var(--surface);}
td.sh-vac{background:linear-gradient(rgba(160,58,42,.42),rgba(160,58,42,.42)),var(--surface)!important;color:var(--negative-bright)!important;font-weight:700;}
td.sh-closed{background:repeating-linear-gradient(45deg,var(--surface-sink),var(--surface-sink) 3px,transparent 3px,transparent 6px);}
td.sh-subst{background:#2F5AA6;color:#F2F7FF;font-weight:700;font-size:9.5px;letter-spacing:0;}
td.sh-absent{background:linear-gradient(rgba(160,58,42,.16),rgba(160,58,42,.16)),var(--surface);color:var(--negative);}
td.sh-fill{background:#0B0F14;color:#ECE6D7;font-weight:700;}
td.sh-fill-plan{background:linear-gradient(135deg,#0B0F14 0 46%,transparent 46%);}
td.sh-fill.sh-edit:hover{background:#26303B;filter:none;}
td.sh-today{outline:2px solid var(--gold);outline-offset:-2px;}
td.sh-sum,th.sh-sum-h{width:170px;background:var(--surface);font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted);padding:0 12px;text-align:left;line-height:1.2;white-space:nowrap;}
th.sh-sum-h{font-size:11px;letter-spacing:.06em;text-transform:uppercase;}
td.sh-sum b{color:var(--ink);font-weight:600;}
.shift-legend{display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;font-size:12px;color:var(--on-dark-2);}
.shift-legend span{display:flex;align-items:center;gap:6px;}
.shift-legend .sw{width:20px;height:20px;border-radius:5px;border:none;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--pos);font-style:normal;font-family:'IBM Plex Mono',monospace;}
.shift-legend .sw.sh-plan{color:var(--muted);}
.shift-legend .sw.sh-subst{color:#F2F7FF;background:#2F5AA6;}
.shift-legend .sw.sh-off{background:linear-gradient(rgba(190,138,46,.24),rgba(190,138,46,.24)),var(--surface);}
.shift-legend .sw.sh-vac{background:linear-gradient(rgba(160,58,42,.42),rgba(160,58,42,.42)),var(--surface);}
.shift-legend .sw.sh-absent{background:linear-gradient(rgba(160,58,42,.16),rgba(160,58,42,.16)),var(--surface);}
.shift-menu{position:fixed;z-index:301;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 20px 50px -14px rgba(0,0,0,.5);padding:10px;width:200px;animation:fadeIn .14s ease both;}
/* палітра — клік по клітинці спершу пропонує обрати КОЛІР (стан), як на паперовому графіку */
.shift-swatches{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;}
.sw-btn{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface-alt);font-family:inherit;font-size:12px;color:var(--ink-soft);cursor:pointer;text-align:left;}
.sw-btn:hover{background:rgba(190,138,46,.14);color:var(--ink);}
.sw-ic{width:14px;height:14px;border-radius:4px;flex-shrink:0;border:1px solid var(--line-strong);}
.sw-ic-black{background:#0a0a0a;}
.sw-ic-amber{background:rgba(190,138,46,.55);}
.sw-ic-red{background:#D9433B;}
.sw-ic-blue{background:#4E6C97;}
.sw-ic-clear{background:transparent;background-image:linear-gradient(45deg,transparent 45%,var(--negative) 45%,var(--negative) 55%,transparent 55%);}
.shift-menu-row{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;align-items:center;}
.shift-menu-row button{flex:1;min-width:38px;padding:6px 4px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface-alt);font-family:inherit;font-size:11.5px;color:var(--ink-soft);cursor:pointer;}
.shift-menu-row button:hover{background:rgba(190,138,46,.14);}
.shift-menu-subst{font-size:11px;color:var(--muted);}
.shift-menu-subst select{flex:1;min-width:0;padding:5px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-size:11px;}
.shift-menu-hours input{width:52px;flex:none;padding:6px 5px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:11.5px;color:var(--ink);background:var(--surface-alt);text-align:center;}
.shift-menu-hours button{flex:1;}
.shift-menu-hint{font-size:10px;color:var(--muted);text-align:center;font-family:'IBM Plex Mono',monospace;}
.shift-search-menu{width:236px;}
.shift-search-input{width:100%;padding:7px 9px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:12.5px;background:var(--surface-alt);color:var(--ink);margin-bottom:8px;}
.shift-search-list{max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;}
.shift-search-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 9px;border-radius:6px;border:none;background:var(--surface-alt);font-family:inherit;font-size:12px;color:var(--ink);cursor:pointer;text-align:left;}
.shift-search-item:hover{background:rgba(190,138,46,.16);}
.ssi-from{color:var(--muted);font-size:10.5px;flex-shrink:0;}
.shift-search-empty{padding:10px;text-align:center;color:var(--muted);font-size:12px;}
@media (max-width:640px){
  .grid-scroll.sched-wrap{overflow-x:auto;}
  table.sched thead th{position:static;}
  table.sched{font-size:8px;border-spacing:1px;min-width:720px;}
  table.sched .rh{width:74px;padding:0 4px;}
  table.sched .rh .nm{font-size:10px;}
  table.sched thead th{font-size:10px;}
  td.sh{height:28px;font-size:10px;}
  td.sh-subst{font-size:8px;}
  td.sh-sum,th.sh-sum-h{width:90px;font-size:9px;padding:0 6px;}
}

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
.medok-panel{border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);margin-bottom:14px;overflow:hidden;}
.medok-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:none;border:none;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;}
.medok-toggle svg{transition:transform .15s var(--ease);}
.medok-toggle svg.rot{transform:rotate(90deg);}
.medok-body{padding:0 13px 13px;display:flex;flex-direction:column;gap:8px;}
.medok-add{display:flex;gap:8px;}
.medok-suggest{position:absolute;top:calc(100% + 4px);left:0;right:78px;z-index:20;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:var(--sh-2);max-height:220px;overflow-y:auto;}
.medok-suggest-item{display:block;width:100%;text-align:left;background:none;border:none;padding:8px 11px;font-family:inherit;font-size:12px;color:var(--ink);cursor:pointer;border-bottom:1px solid var(--line);}
.medok-suggest-item:last-child{border-bottom:none;}
.medok-suggest-item:hover{background:var(--surface-alt);}
.medok-add input{flex:1;background:var(--surface-alt);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-family:inherit;font-size:12.5px;color:var(--ink);}
.medok-list{display:flex;flex-wrap:wrap;gap:6px;}
.medok-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface-alt);border:1px solid var(--line);border-radius:999px;padding:4px 6px 4px 11px;font-size:12px;}
.medok-chip button{background:none;border:none;color:var(--muted);cursor:pointer;display:flex;padding:2px;}
.medok-chip button:hover{color:var(--negative-bright);}
.inv-viewtabs button{background:none;border:none;border-bottom:2px solid transparent;padding:8px 14px;font-size:12.5px;font-weight:600;color:var(--on-dark-2);cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;margin-bottom:-1px;}
.inv-viewtabs button:hover{color:var(--on-dark);}
.inv-viewtabs button.on{color:var(--gold-bright);border-bottom-color:var(--gold);}
.inv-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}
.inv-search{display:flex;align-items:center;gap:7px;flex:1;min-width:220px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:0 10px;color:var(--muted);}
.inv-search input{flex:1;border:none;background:none;padding:8px 0;font-family:inherit;font-size:12.5px;color:var(--ink);}
.inv-search input:focus{outline:none;}
.inv-search-clear{background:none;border:none;color:var(--muted);cursor:pointer;display:flex;padding:2px;}
.inv-search-clear:hover{color:var(--negative-bright);}
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
.inv-fchip-over{font-weight:700;}
.inv-fchip-over.on{background:rgba(160,58,42,.18);color:var(--negative-bright);border-color:rgba(224,145,127,.45);}
.inv-fchip-over.glow{color:var(--negative-bright);border-color:rgba(224,145,127,.5);background:rgba(160,58,42,.12);animation:glowpulse-red 1.7s ease-in-out infinite;}
@keyframes glowpulse-red{0%,100%{box-shadow:0 0 0 0 rgba(224,145,127,.5);}50%{box-shadow:0 0 0 6px rgba(224,145,127,0);}}
.inv-dash-over{color:var(--negative-bright);}
.inv-dash-over b{color:var(--negative-bright);}
.inv-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--sh-1);overflow:hidden;color:var(--ink);}
.inv-card.inv-overdue{border-color:rgba(224,145,127,.45);box-shadow:inset 3px 0 0 var(--negative);}
.inv-badge-over{white-space:nowrap;}

.sal-sticky{position:sticky;top:calc(env(safe-area-inset-top) + 54px);z-index:15;display:flex;align-items:center;gap:8px 18px;flex-wrap:wrap;
  margin:0 0 16px;padding:12px 16px;background:var(--bg-2);border:1px solid var(--line-dark);border-radius:var(--radius-md);box-shadow:0 12px 26px -16px rgba(0,0,0,.5);}
.ss-main{display:flex;flex-direction:column;gap:1px;}
.ss-lab{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--on-dark-3);}
.ss-big{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:600;color:var(--on-dark);line-height:1;}
.ss-sub{display:flex;gap:14px;font-size:12px;color:var(--on-dark-3);font-family:'Inter',sans-serif;}
.ss-sub b{font-family:'IBM Plex Mono',monospace;color:var(--on-dark-2);font-weight:600;}
.ss-st{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:4px 11px;border-radius:999px;background:var(--surface-alt);color:var(--on-dark-3);}
.ss-st.ok{background:rgba(63,107,74,.2);color:var(--positive-bright);}
.ss-st.warn{background:rgba(160,58,42,.2);color:var(--negative-bright);}
@media(max-width:560px){.ss-big{font-size:1.25rem;} .sal-sticky{gap:6px 12px;padding:10px 12px;}}

.inv-board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,1fr);gap:12px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;}
.inv-col{background:rgba(var(--sf),.03);border:1px solid var(--line-dark);border-radius:var(--radius-md);padding:10px;min-height:200px;}
.inv-col-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:2px 4px 10px;font-size:12px;font-weight:700;color:var(--on-dark);}
.inv-col-h .mono{font-size:10px;color:var(--on-dark-3);font-weight:500;}
.inv-col-body{display:flex;flex-direction:column;gap:8px;}
.inv-col-empty{text-align:center;color:var(--faint);font-size:12px;padding:10px 0;margin:0;}
.inv-card-compact .inv-card-expand{flex-wrap:wrap;gap:5px 8px;padding:9px 10px;}
.inv-card-compact .inv-cp-wrap{flex-basis:100%;}
.inv-card-compact .inv-amount{margin-left:0;}
.inv-card-compact .inv-badge{margin-left:auto;}
.inv-card-compact .inv-fop-line{padding:0 10px 7px 10px;}
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
.inv-fop-line{padding:0 14px 8px 36px;margin-top:-4px;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
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
.inv-shot-preview img{max-width:100%;max-height:260px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);object-fit:contain;background:var(--input-bg);}
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
.dtf-trigger{width:100%;display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--input-bg);font-family:inherit;font-size:13px;color:var(--muted);cursor:pointer;transition:border-color .14s var(--ease),box-shadow .14s var(--ease);text-align:left;}
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
.dtf-time select{appearance:none;-webkit-appearance:none;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--input-bg);padding:5px 8px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--ink);cursor:pointer;}
.dtf-time select:focus{outline:none;border-color:var(--gold);}
.dtf-ok{margin-left:auto;padding:6px 14px;border:none;border-radius:var(--radius-sm);background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);font-family:inherit;font-weight:700;font-size:12px;cursor:pointer;}
.task-priority-toggle{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-soft);cursor:pointer;padding-bottom:9px;}
.task-priority-toggle svg{color:var(--gold);}
.task-modal-label{font-size:12px;font-weight:700;color:var(--ink);text-transform:uppercase;letter-spacing:.04em;margin-top:2px;}
.task-modal-count{font-size:12px;color:var(--muted);}
.form-err{color:var(--negative);font-size:12.5px;margin:0;}

/* ієрархічний вибір «кому» */
.assignee-picker{border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:10px 12px;max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:4px;background:var(--input-bg);}
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
.cab-shell.cab-wide{max-width:none;}
.cab-layout{display:grid;grid-template-columns:232px 1fr;gap:22px;align-items:start;}
.cab-side{position:sticky;top:78px;display:flex;flex-direction:column;gap:2px;padding:8px;background:rgba(var(--sf),.03);border:1px solid var(--line-dark);border-radius:var(--radius-md);}
.cab-side-item{display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:none;border-radius:var(--radius-sm);background:none;color:var(--on-dark-2);font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;text-align:left;transition:background .14s var(--ease),color .14s var(--ease);}
.cab-side-item:hover{background:rgba(var(--sf),.05);color:var(--on-dark);}
.cab-side-item.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);font-weight:600;}
.cab-side-item svg{flex-shrink:0;}
.cab-side-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cab-side-item .badge{margin-left:auto;flex-shrink:0;}
.cab-side-badge{margin-left:auto;flex-shrink:0;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--negative-bright);color:#1a0f0d;font-size:10.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;}
.cab-side-item.active .cab-side-badge{background:rgba(20,15,8,.28);color:var(--gold-ink);}
.cab-side-sep{height:1px;background:var(--line-dark);margin:7px 6px;}
.cab-content{min-width:0;}
.mod-crash{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:28px 24px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);color:var(--negative);max-width:520px;}
.mod-crash h4{margin:0;color:var(--ink);font-size:15px;}
.mod-crash-tech{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--faint);word-break:break-word;}
.cab-content .embedded{animation:none;}

/* групи навігації */
.cab-grp{display:flex;flex-direction:column;}
.cab-grp.pinned{padding-bottom:6px;margin-bottom:2px;border-bottom:1px solid var(--line-dark);}
.cab-grp-h{display:flex;align-items:center;gap:7px;width:100%;padding:9px 12px 6px;border:none;background:none;color:var(--on-dark-3);font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;text-align:left;}
.cab-grp-h:hover:not(:disabled){color:var(--on-dark-2);}
.cab-grp-h:disabled{cursor:default;}
.cab-grp-h>span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.cab-grp-chev{flex-shrink:0;transform:rotate(90deg);transition:transform .16s var(--ease);opacity:.7;}
.cab-grp.collapsed .cab-grp-chev{transform:rotate(0deg);}
.cab-grp-count{flex-shrink:0;background:rgba(var(--sf),.08);border-radius:999px;padding:1px 6px;font-size:9.5px;}
.cab-grp-body{display:flex;flex-direction:column;gap:2px;}
.cab-side.editing .cab-grp{border:1px dashed transparent;border-radius:var(--radius-sm);}
.cab-side.editing .cab-grp:hover{border-color:var(--line-dark);}

/* налаштування навігації */
.cab-side-row{display:flex;align-items:center;gap:2px;border-radius:var(--radius-sm);}
.cab-side-row .cab-side-item{flex:1;}
.cab-side.editing .cab-side-row{background:rgba(var(--sf),.03);cursor:grab;}
.cab-side.editing .cab-side-row.dragging{opacity:.4;}
.cab-side-grip{display:flex;align-items:center;color:var(--on-dark-3);padding-left:4px;flex-shrink:0;}
.cab-side-eye{margin-left:auto;display:flex;align-items:center;color:var(--on-dark-3);flex-shrink:0;}
.cab-side-item.is-hidden{opacity:.4;}
.cab-side-item.is-hidden .cab-side-label{text-decoration:line-through;}
.cab-side.editing .cab-side-item:hover{background:rgba(var(--sf),.06);}
.cab-side-cfg{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-radius:var(--radius-sm);background:none;color:var(--on-dark-3);font-family:inherit;font-size:11.5px;font-weight:500;cursor:pointer;text-align:left;transition:color .14s var(--ease),background .14s var(--ease);}
.cab-side-cfg:hover{background:rgba(var(--sf),.05);color:var(--on-dark);}
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
.planner-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark-2);border-radius:999px;padding:7px 13px;font-size:12px;font-family:inherit;cursor:pointer;text-decoration:none;transition:border-color .15s var(--ease),color .15s var(--ease);}
.planner-btn:hover{border-color:var(--gold);color:var(--gold-bright);}
.planner-frame{width:100%;height:calc(100vh / var(--ui-zoom,1) - 210px);min-height:520px;border:1px solid var(--line-dark);border-radius:var(--radius-md);background:var(--input-bg);box-shadow:var(--sh-2);}
@media (max-width:720px){.planner-frame{height:calc(100vh / var(--ui-zoom,1) - 260px);}}

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
.tm-all-tbl td.dev{font-weight:700;}
.tm-all-tbl td.dev.pos{color:var(--positive-bright);}
.tm-all-tbl td.dev.neg{color:var(--negative-bright);}
:root[data-theme="light"] .tm-all-tbl td.dev.pos{color:var(--positive);}
:root[data-theme="light"] .tm-all-tbl td.dev.neg{color:var(--negative);}
.tm-all-tbl td.muted{color:var(--muted);}
.tm-all-tbl tr:last-child td{border-bottom:none;}
.tm-all-tbl tbody tr{cursor:pointer;}
.tm-all-tbl tbody tr:hover{background:var(--surface-alt);}
.tm-all-tbl tbody tr.active{background:rgba(190,138,46,.1);}
.tm-salon-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
.tm-salon-chips .chip{font-size:11.5px;padding:6px 11px;border-radius:999px;border:1px solid var(--line-dark);background:rgba(var(--sf),.04);color:var(--on-dark-2);cursor:pointer;}
.tm-salon-chips .chip.active{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:var(--gold-ink);border-color:transparent;font-weight:600;}
.tm-grid-cap{font-size:12px;color:var(--on-dark-2);margin:0 0 8px;}
.tm-grid-wrap{overflow:auto;max-height:calc(100vh / var(--ui-zoom,1) - 340px);border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);}
.tm-grid{width:100%;border-collapse:collapse;font-size:12.5px;}
.tm-grid th{position:sticky;top:0;z-index:1;background:var(--surface-alt);color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase;padding:8px 8px;text-align:right;border-bottom:1px solid var(--line-strong);}
.tm-grid th.tm-c-day{text-align:left;left:0;z-index:2;}
.tm-grid td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;color:var(--ink);font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.tm-grid td.tm-c-day{position:sticky;left:0;background:var(--surface);text-align:left;color:var(--muted);font-weight:600;}
.tm-grid td.muted{color:var(--muted);}
.tm-grid tr.tm-future td{opacity:.5;}
.tm-in{width:78px;border:1px solid transparent;background:none;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink);text-align:right;padding:5px 6px;border-radius:6px;}
.tm-in:hover{border-color:var(--line-strong);}
.tm-in:focus{outline:none;border-color:var(--gold);background:var(--input-bg);}
.tm-grid td.tm-edited{background:rgba(190,138,46,.12);}
.tm-grid td.tm-edited .tm-in{color:var(--gold-ink);font-weight:600;}
.tm-c-rst{width:26px;padding:0;}
.tm-rst{border:none;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;}
.tm-rst:hover{color:var(--gold);background:rgba(190,138,46,.12);}
.tm-grid tfoot td{position:sticky;bottom:0;background:var(--surface-alt);border-top:2px solid var(--line-strong);border-bottom:none;}
.tm-grid tfoot tr.tm-tot td{font-weight:700;color:var(--ink);}
.tm-grid tfoot tr.tm-plan td{color:var(--muted);font-weight:500;border-top:1px solid var(--line);}
.tm-grid td.num{text-align:right;}
.tm-grid td.neg{color:var(--negative);font-weight:600;}
.tm-grid td.pos{color:var(--positive);}

/* ---------- рух бонусів ---------- */
.bn-roll-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);margin-bottom:14px;}
.bn-roll{border-collapse:collapse;font-size:11.5px;width:100%;font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.bn-roll th{background:var(--surface-alt);color:var(--muted);font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;padding:7px 8px;text-align:right;border-bottom:1px solid var(--line-strong);white-space:nowrap;}
.bn-roll th:first-child{text-align:left;}
.bn-roll td{padding:6px 8px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap;}
.bn-roll tr{cursor:pointer;}
.bn-roll tr:hover td{background:var(--surface-alt);}
.bn-roll tr.on td{background:rgba(190,138,46,.13);}
.bn-roll td.bn-roll-nm{text-align:left;color:var(--ink);font-weight:600;font-family:inherit;position:sticky;left:0;background:var(--surface);}
.bn-roll tr.on td.bn-roll-nm{background:rgba(190,138,46,.13);}
.bn-roll td.neg{color:var(--negative);}
.bn-roll td.pos{color:var(--positive);}
.bn-roll td.muted{color:var(--faint);}
.bn-roll td.bn-roll-yr{font-weight:700;border-left:2px solid var(--line-strong);}
.bn-roll tfoot td{border-top:2px solid var(--line-strong);border-bottom:none;font-weight:700;background:var(--surface-alt);}
.bn-roll tfoot .bn-roll-nm{font-family:inherit;}
.bn-roll td.bn-frozen{box-shadow:inset 0 0 0 1px rgba(220,169,74,.4);border-radius:4px;}
.bn-roll td.bn-cell-edit{cursor:text;}
.bn-roll td.bn-cell-edit:hover{background:rgba(220,169,74,.12);}
.bn-edit-in{width:58px;background:var(--surface);border:1px solid var(--gold);border-radius:4px;padding:3px 4px;font-family:'IBM Plex Mono',monospace;font-size:11px;text-align:right;}
.bn-fix-btns{display:flex;gap:6px;flex-wrap:wrap;}
.bn-frozen-note{margin:-6px 0 14px;background:rgba(220,169,74,.08);border:1px solid rgba(220,169,74,.28);border-radius:8px;padding:8px 11px;}
.bn-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}
.bn-sum-cell{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:11px 13px;}
.bn-sum-cell span{display:block;font-size:11px;color:var(--muted);}
.bn-sum-cell b{font-family:'IBM Plex Mono',monospace;font-size:1.15rem;color:var(--ink);font-variant-numeric:tabular-nums;}
.bn-sum-cell.hero{border-left:3px solid var(--gold);}
.bn-sum-cell.hero.neg{border-left-color:var(--negative);}
.bn-sum-cell.hero.neg b{color:var(--negative);}
.bn-sum-cell.hero.pos b{color:var(--positive);}
.bn-grid .tm-in{width:92px;}
@media(max-width:640px){.bn-sum{grid-template-columns:repeat(2,1fr);}}

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
.maint-switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:var(--input-bg);box-shadow:var(--sh-1);transition:transform .18s var(--ease);}
.maint-toggle.on .maint-switch{background:var(--negative);}
.maint-toggle.on .maint-switch::after{transform:translateX(18px);}
.maint-label{font-size:13px;font-weight:600;color:var(--ink);}
.maint-label em{font-style:normal;font-weight:500;color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:11px;}

/* ---------- звернення ---------- */
.topbar-fb{position:relative;background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease);}
.topbar-fb:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);}
.topbar-theme{background:rgba(var(--sf),.05);border:1px solid var(--line-dark);color:var(--on-dark-2);width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:color .15s var(--ease),border-color .15s var(--ease),transform .2s var(--ease);}
.topbar-theme:hover{color:var(--gold-bright);border-color:rgba(220,169,74,.4);transform:rotate(-18deg);}
.fb-modal{position:relative;background:var(--surface);border-radius:var(--radius);max-width:440px;width:100%;box-shadow:var(--sh-3);overflow:hidden;animation:fadeIn .2s ease both;}
.fb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line);font-family:'Fraunces',serif;font-size:16px;color:var(--ink);font-weight:600;}
.fb-modal-head .modal-close{position:static;width:28px;height:28px;top:auto;right:auto;}
.fb-modal-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:12px;}
.fb-kind{display:flex;gap:8px;}
.fb-kind button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface-alt);color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;}
.fb-kind button.active{border-color:var(--gold);background:rgba(190,138,46,.1);color:var(--gold);}
.fb-ta{width:100%;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;background:var(--input-bg);color:var(--ink);}
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
.fb-resolve textarea{width:100%;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:9px 11px;font-family:inherit;font-size:12.5px;resize:vertical;background:var(--input-bg);color:var(--ink);}
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
.cash-in{width:100%;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:10px 12px;font-family:'IBM Plex Mono',monospace;font-size:17px;color:var(--ink);background:var(--input-bg);text-align:right;}
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

/* оборот салонів — кільцевий дашборд (головний екран Віктора / ТМ) */
.rg-mod{margin-bottom:30px;animation:fadeIn .28s ease both;}
.attn{margin:6px 0 26px;}
.attn-h{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--on-dark-3);margin:0 0 10px;font-weight:500;}
.attn-rows{display:flex;flex-direction:column;gap:8px;}
.attn-row{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;cursor:pointer;font-family:inherit;transition:border-color .14s var(--ease),transform .12s var(--ease);}
.attn-row:hover{transform:translateX(2px);}
.attn-row.crit{border-left:3px solid var(--negative);}
.attn-row.warn{border-left:3px solid var(--gold);}
.attn-row.info{border-left:3px solid var(--info,#6FB0D6);}
.attn-n{font-family:'IBM Plex Mono',monospace;font-weight:800;font-size:1.15rem;color:var(--on-dark);min-width:26px;text-align:center;}
.attn-row.crit .attn-n{color:var(--negative-bright);}
.attn-row.warn .attn-n{color:var(--gold-bright);}
.attn-lead{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.attn-lead b{font-size:13.5px;color:var(--on-dark);font-weight:600;}
.attn-lead em{font-style:normal;font-size:11.5px;color:var(--on-dark-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.attn-go{color:var(--gold-bright);font-size:15px;flex-shrink:0;}
.rg-head{display:flex;align-items:center;justify-content:space-between;gap:10px 12px;flex-wrap:wrap;margin-bottom:18px;}
.rg-head-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ez-toggle{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--on-dark-2);cursor:pointer;user-select:none;white-space:nowrap;}
.ez-toggle input{width:15px;height:15px;accent-color:var(--gold);cursor:pointer;}
.rg-refresh{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(180deg,var(--gold-bright),var(--gold));border:0;color:#20170a;border-radius:999px;padding:7px 14px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px -4px rgba(190,138,46,.5);transition:transform .12s var(--ease),box-shadow .12s var(--ease);}
.rg-refresh:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 7px 20px -4px rgba(190,138,46,.6);}
.rg-refresh:disabled{opacity:.75;cursor:default;}
.rg-refresh.spin svg{animation:rgspin .9s linear infinite;}
.rg-toggle{display:inline-flex;background:rgba(var(--sf),.06);border:1px solid var(--line-dark);border-radius:999px;padding:3px;gap:2px;}
.rg-toggle button{border:0;background:none;color:var(--on-dark-3);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 13px;border-radius:999px;cursor:pointer;letter-spacing:.02em;}
.rg-toggle button.on{background:var(--gold);color:var(--gold-ink);font-weight:600;}
.rg-range{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;font-size:12px;color:var(--on-dark-3);}
.rg-range label{display:inline-flex;align-items:center;gap:6px;}
.rg-range input[type=date]{background:rgba(var(--sf),.06);border:1px solid var(--line-dark);color:var(--on-dark);border-radius:8px;padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color-scheme:dark;}
:root[data-theme="light"] .rg-range input[type=date]{color-scheme:light;}
.rg-range-n{font-family:'IBM Plex Mono',monospace;color:var(--on-dark-2);}
.rg-ring{position:relative;width:100%;max-width:var(--rg-max,82px);aspect-ratio:1;margin:0 auto;flex-shrink:0;container-type:inline-size;}
.rg-ring svg{display:block;width:100%;height:100%;}
.rg-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;}
.rg-center b{font-family:'IBM Plex Mono',monospace;font-size:14px;font-size:clamp(11px,17cqi,16px);font-weight:600;color:var(--on-dark);font-variant-numeric:tabular-nums;}
.rg-center i{font-style:normal;font-size:10px;font-size:clamp(8px,11cqi,11px);margin-top:3px;font-family:'IBM Plex Mono',monospace;}
.rg-track{stroke:rgba(var(--sf),.10);}
.rg-prog{transition:stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1);}
.rg-prog.lo{stroke:var(--negative-bright);} .rg-prog.mid{stroke:var(--gold-bright);} .rg-prog.ok{stroke:var(--positive-bright);} .rg-prog.over{stroke:var(--gold-bright);}
.rg-pct.lo{color:var(--negative-bright);} .rg-pct.mid{color:var(--gold-bright);} .rg-pct.ok{color:var(--positive-bright);} .rg-pct.over{color:var(--gold-bright);}
.rg-hero{display:flex;flex-direction:column;gap:10px;margin-bottom:24px;padding:15px 17px;border:1px solid var(--line-dark);border-radius:var(--radius-md);background:rgba(var(--sf),.03);}
.rg-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
.rg-hero-meta{min-width:0;}
.rg-hero-val{font-family:'Fraunces',serif;font-size:1.7rem;font-weight:600;color:var(--on-dark);font-variant-numeric:tabular-nums;line-height:1;}
.rg-hero-lab{font-size:.83rem;color:var(--on-dark-3);margin-top:6px;}
.rg-hero-pct{font-family:'IBM Plex Mono',monospace;font-size:1.15rem;font-weight:700;line-height:1;}
.rg-hero-pct.lo{color:var(--negative-bright);} .rg-hero-pct.mid{color:var(--gold-bright);} .rg-hero-pct.ok{color:var(--positive-bright);} .rg-hero-pct.over{color:var(--gold-bright);}
.rg-hero-bar{height:14px;margin:2px 0 0;}
.rg-hero-norm{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--on-dark-2);}
.rg-hero-norm b{color:var(--on-dark);}
.rg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:20px 12px;}
.rg-cell{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;background:none;border:0;cursor:pointer;padding:6px 2px;font-family:inherit;transition:transform .13s;}
.rg-cell:hover{transform:translateY(-2px);}
.rg-cell:hover .rg-nm{color:var(--on-dark);}
.rg-cell-static{cursor:default;}
.rg-cell-static:hover{transform:none;}
.rg-cell-static:hover .rg-nm{color:var(--on-dark-2);}
.rg-cell-me{background:rgba(190,138,46,.1);border-radius:var(--radius-md);padding:8px 2px;}
.rg-cell-me .rg-nm{color:var(--gold-bright);font-weight:700;}
.rg-allsum{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--on-dark-3);}
.rg-nm{font-size:12px;color:var(--on-dark-2);font-weight:500;text-align:center;line-height:1.2;}
.rg-pct{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;}
.rg-note{font-size:.78rem;color:var(--on-dark-3);margin-top:16px;line-height:1.5;}
.rg-terr{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:24px;}
.rg-terr-card{border:1px solid var(--line-dark);border-radius:var(--radius-md);padding:14px 16px;background:rgba(var(--sf),.03);}
.rg-terr-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-family:'Fraunces',serif;font-size:1rem;font-weight:600;color:var(--on-dark);}
.rg-terr-done{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:var(--gold-bright);}
.rg-terr-done.lo{color:var(--negative-bright);} .rg-terr-done.mid{color:var(--gold-bright);} .rg-terr-done.ok{color:var(--positive-bright);} .rg-terr-done.over{color:var(--gold-bright);}
.rg-terr-bar{position:relative;height:12px;border-radius:4px;background:rgba(var(--sf),.10);margin:11px 0 13px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(var(--sf),.06);}
.rg-terr-fill{position:absolute;left:0;top:0;bottom:0;border-radius:4px;transition:width .8s cubic-bezier(.2,.8,.2,1);}
.rg-terr-fill.lo{background:var(--negative-bright);} .rg-terr-fill.mid{background:var(--gold-bright);} .rg-terr-fill.ok{background:var(--positive-bright);} .rg-terr-fill.over{background:var(--gold-bright);}
.rg-terr-mark{position:absolute;top:0;bottom:0;width:2px;background:var(--on-dark);opacity:.55;}
.rg-terr-rows{display:flex;flex-direction:column;gap:7px;}
.rg-terr-rows>div{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12px;color:var(--on-dark-3);}
.rg-terr-rows b{font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:600;color:var(--on-dark);text-align:right;font-variant-numeric:tabular-nums;}
.rg-terr-rows b.neg{color:var(--negative-bright);}
.rg-terr-rows b.pos{color:var(--positive-bright);}
@media(max-width:560px){.rg-terr{grid-template-columns:1fr;}}
/* ---------- віджет-екран показників (PWA) ---------- */
.tw-screen{max-width:480px;margin:0 auto;min-height:100vh;padding:22px 18px calc(28px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;cursor:pointer;}
.tw-head{display:flex;align-items:center;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--on-dark-3);}
.tw-refresh{background:rgba(var(--sf),.06);border:1px solid var(--line-dark);color:var(--on-dark-2);width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.tw-total{text-align:center;padding:8px 0 14px;border-bottom:1px solid var(--line-dark);}
.tw-total-val{font-family:'Fraunces',serif;font-size:2.2rem;font-weight:600;color:var(--on-dark);line-height:1;font-variant-numeric:tabular-nums;}
.tw-total-lab{font-size:.8rem;color:var(--on-dark-3);margin-top:6px;}
.tw-total-mtd{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--on-dark-2);margin-top:10px;}
.tw-card{border:1px solid var(--line-dark);border-radius:14px;padding:15px 16px;background:rgba(var(--sf),.03);}
.tw-card-h{display:flex;align-items:baseline;justify-content:space-between;font-family:'Fraunces',serif;font-size:1.05rem;font-weight:600;color:var(--on-dark);}
.tw-card-h b{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--gold-bright);}
.tw-bar{position:relative;height:9px;border-radius:999px;background:rgba(var(--sf),.1);margin:12px 0 13px;}
.tw-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;transition:width .8s cubic-bezier(.2,.8,.2,1);}
.tw-fill.behind{background:var(--negative-bright);} .tw-fill.ahead{background:var(--positive-bright);}
.tw-mark{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--on-dark);opacity:.7;border-radius:2px;}
.tw-rows{display:flex;flex-direction:column;gap:8px;}
.tw-rows>div{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--on-dark-3);}
.tw-rows b{font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:600;color:var(--on-dark);text-align:right;}
.tw-rows b.neg{color:var(--negative-bright);} .tw-rows b.pos{color:var(--positive-bright);}
.tw-foot{margin-top:auto;text-align:center;font-size:10.5px;color:var(--on-dark-3);font-family:'IBM Plex Mono',monospace;padding-top:12px;}
.tw-noauth{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:24px;}
.tw-noauth h1{font-family:'Fraunces',serif;font-size:1.5rem;color:var(--on-dark);font-weight:600;}
.tw-noauth p{color:var(--on-dark-2);font-size:.9rem;max-width:34ch;}
.tw-logo{width:56px;height:56px;border-radius:16px;background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:#20170a;display:flex;align-items:center;justify-content:center;margin-bottom:6px;}

.rg-spin{animation:rgspin .9s linear infinite;}
@keyframes rgspin{to{transform:rotate(360deg);}}
@media(max-width:560px){
  .rg-grid{grid-template-columns:repeat(3,1fr);gap:16px 8px;}
  .rg-cell .rg-ring{max-width:88px;}
  .rg-hero-val{font-size:1.3rem;}
  .rg-hero-pct{font-size:1rem;}
  .rg-nm{font-size:11.5px;}
}
@media(max-width:380px){
  .rg-grid{gap:14px 6px;}
  .rg-cell .rg-ring{max-width:74px;}
}

/* графік продажів день-у-день */
.trend-wrap{margin-top:16px;}
.trend-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
.trend-head .ov-card-h{margin:0;}
.trend-head .ez-toggle{color:var(--ink-soft);}
.trend-head .ez-toggle input{accent-color:var(--gold);}
.trend-filters{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.trend-dates{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;}
.trend-dates input[type=date]{background:var(--input-bg);border:1px solid var(--line-strong);color:var(--ink);border-radius:8px;padding:6px 9px;font-family:'IBM Plex Mono',monospace;font-size:12px;}
.trend-dates b{font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--ink);}
.trend-dates .pos{color:var(--positive);} .trend-dates .neg{color:var(--negative);}
.trend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.trend-dot.a{background:var(--gold);}
.trend-dot.b{background:var(--muted);}
.trend-salons{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
.trend-salons .chip{font-size:11px;padding:5px 10px;border-radius:999px;border:1px solid var(--line-strong);background:var(--surface-alt);color:var(--muted);cursor:pointer;}
.trend-salons .chip.active{background:var(--gold);color:var(--gold-ink);border-color:var(--gold);font-weight:600;}
@media (max-width:400px){
  .topbar{gap:6px;padding:calc(11px + env(safe-area-inset-top)) 11px 11px;margin:calc(-1 * env(safe-area-inset-top)) -11px 10px;}
  .topbar-logout{padding:6px 9px;font-size:0;}
  .topbar-logout::before{content:"⎋";font-size:15px;}
  .view{padding:4px 11px 84px;}
}

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
.cash-tile.lvl0{background:rgba(var(--sf),.04);border-color:var(--line-dark);color:var(--on-dark-2);}
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
.wh-search{flex:1;min-width:150px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:8px 12px;font-family:inherit;font-size:13px;background:var(--input-bg);color:var(--ink);}
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
.wh-price:focus{outline:none;border-color:var(--gold);background:var(--input-bg);}
.wh-h4{font-family:Inter,sans-serif;font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin:20px 0 10px;}
.wh-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px;}
.wh-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;}
.wh-kpi span{font-size:11px;color:var(--muted);}
.wh-kpi b{display:block;font-family:'IBM Plex Mono',monospace;font-size:17px;color:var(--ink);margin-top:3px;}
.wh-kpi.attn{border-color:rgba(220,169,74,.35);background:linear-gradient(180deg,rgba(190,138,46,.1),var(--surface));}
.wh-kpi.attn b{color:var(--gold);}

.wh-modal{position:relative;background:var(--surface);border-radius:var(--radius);max-width:560px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:var(--sh-3);overflow:hidden;animation:fadeIn .2s ease both;}
.pday-modal{position:relative;background:var(--surface);color:var(--ink);border-radius:var(--radius);max-width:640px;width:100%;max-height:88vh;overflow:auto;box-shadow:var(--sh-3);animation:fadeIn .2s ease both;padding:18px 20px;display:flex;flex-direction:column;gap:12px;}
.pday-h{display:flex;align-items:center;justify-content:space-between;font-family:'Fraunces',serif;font-size:15px;font-weight:600;}
.pday-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.pday-nav input[type=date]{background:var(--surface-alt);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-family:inherit;font-size:12.5px;color:var(--ink);}
.pday-tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius-md);}
.pday-tbl{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums;}
.pday-tbl th{background:var(--surface-alt);color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:right;border-bottom:1px solid var(--line-strong);}
.pday-tbl th:first-child{text-align:left;}
.pday-tbl td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--line);}
.pday-tbl td:first-child{text-align:left;font-weight:600;}
.pday-tbl tr.muted td{color:var(--faint);}
.pday-tbl tr:last-child td{border-bottom:none;}
.pday-extra{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12px;color:var(--ink-soft);background:var(--surface-alt);border-radius:8px;padding:8px 12px;}
.pday-notes{font-size:12px;color:var(--ink-soft);display:flex;flex-direction:column;gap:4px;}
.pday-notes p{margin:0;}
.wh-modal-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line);font-family:'Fraunces',serif;font-size:16px;color:var(--ink);font-weight:600;}
.wh-modal-h .modal-close{position:static;width:28px;height:28px;top:auto;right:auto;}
.wh-modal-b{padding:16px 18px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;}
.wh-lines{display:flex;flex-direction:column;gap:7px;}
.stocktake-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--line);}
.stocktake-row:last-child{border-bottom:none;}
.stocktake-nm{flex:1;font-size:12.5px;}
.stocktake-row .tm-in{width:80px;}
.stocktake-unit{font-size:11px;color:var(--muted);min-width:24px;}
.wh-line{display:flex;gap:6px;align-items:center;}
.wh-line select{flex:1;min-width:0;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 9px;font-family:inherit;font-size:12.5px;background:var(--input-bg);color:var(--ink);}
.wh-pick{position:relative;flex:1;min-width:0;}
.wh-pick-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 9px;font-family:inherit;font-size:12.5px;background:var(--input-bg);color:var(--ink);cursor:pointer;}
.wh-pick-btn.empty{color:var(--muted);}
.wh-pick-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.wh-pick-btn svg{flex-shrink:0;color:var(--gold);}
.wh-pick-in{width:100%;box-sizing:border-box;border:1px solid var(--gold);border-radius:var(--radius-sm);padding:7px 9px;font-family:inherit;font-size:12.5px;background:var(--input-bg);color:var(--ink);outline:none;box-shadow:0 0 0 3px rgba(190,138,46,.2);}
.wh-pick-list{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 4px);max-height:260px;overflow-y:auto;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius-sm);box-shadow:var(--sh-2);padding:4px;}
.wh-pick-opt{display:block;width:100%;text-align:left;border:none;background:none;padding:8px 10px;border-radius:6px;font-family:inherit;font-size:12.5px;color:var(--ink);cursor:pointer;}
.wh-pick-opt.hi{background:rgba(190,138,46,.16);}
.wh-pick-opt.cur{font-weight:700;color:var(--gold);}
.wh-pick-none{padding:10px;font-size:12px;color:var(--muted);}
.wh-tbl td.wh-cs{font-weight:700;color:var(--ink);}
.wh-line-qty{width:72px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:7px 8px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;text-align:right;background:var(--input-bg);color:var(--ink);}
.wh-line-x{background:none;border:none;color:var(--faint);cursor:pointer;padding:4px;flex-shrink:0;}
.wh-line-x:hover{color:var(--negative);}
.wh-line-qty.wh-over{border-color:var(--negative);color:var(--negative-bright);background:rgba(160,58,42,.1);}
.wh-line-avail{font-size:10.5px;font-family:'IBM Plex Mono',monospace;color:var(--faint);flex-shrink:0;min-width:52px;}
.wh-line-avail.over{color:var(--negative-bright);font-weight:700;}
.wh-warn{margin:8px 0 0;font-size:12px;color:var(--negative-bright);}
.wh-add{align-self:flex-start;background:none;border:1px dashed var(--line-strong);border-radius:var(--radius-sm);color:var(--muted);font-size:12px;padding:6px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;}
.wh-add:hover{border-color:var(--gold);color:var(--gold);}
.wh-modal-foot{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-family:'IBM Plex Mono',monospace;}
.wh-modal-foot b{font-size:15px;color:var(--ink);}

.wh-form{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:16px 18px;margin-bottom:16px;}
.wh-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;}
@media(max-width:640px){.wh-form-grid{grid-template-columns:1fr;}}
.wh-form-grid select{padding:8px 10px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;background:var(--input-bg);font-size:13px;color:var(--ink);}
.wh-form-act{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}

.wh-ord-list{display:flex;flex-direction:column;gap:8px;}
.wh-ord{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:11px 14px;}
.wh-ord.submitted{border-left:3px solid var(--gold);}
.wh-ord.ordered{border-left:3px solid #3c8dc9;}
.wh-ord.shipped{border-left:3px solid var(--positive);}
.wh-ord-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
.wh-ord-nm{font-weight:600;color:var(--ink);font-size:13px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.wh-ord-cnt{font-weight:400;color:var(--faint);font-family:'IBM Plex Mono',monospace;font-size:11px;}
.wh-ord-warn{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;color:var(--negative);background:rgba(179,58,58,.12);padding:2px 7px;border-radius:999px;text-transform:uppercase;letter-spacing:.02em;}
.wh-ord-st{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--surface-alt);color:var(--muted);text-transform:uppercase;letter-spacing:.04em;}
.wh-ord-st.st-draft{background:var(--surface-alt);color:var(--faint);}
.wh-ord-st.st-sub{background:rgba(190,138,46,.16);color:var(--gold);}
.wh-ord-st.st-ordered{background:rgba(46,120,180,.16);color:#3c8dc9;}
.wh-ord-st.st-ship{background:rgba(46,120,180,.16);color:#3c8dc9;}
.wh-ord-st.st-recv{background:rgba(60,107,74,.16);color:var(--positive);}
.btn-glow{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:999px;padding:7px 14px;font:inherit;font-weight:700;font-size:12px;cursor:pointer;color:var(--gold-ink);background:linear-gradient(180deg,var(--gold-bright),var(--gold));box-shadow:0 0 0 0 rgba(220,169,74,.55);animation:glowpulse 1.8s ease-in-out infinite;}
.btn-glow:disabled{opacity:.6;animation:none;cursor:default;}
@keyframes glowpulse{0%,100%{box-shadow:0 0 0 0 rgba(220,169,74,.5);}50%{box-shadow:0 0 0 6px rgba(220,169,74,0);}}
.wh-ocr{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:2px 0 10px;}
.wh-ocr-hint{font-size:10.5px;color:var(--muted);}
.trn-upl-row{display:flex;flex-wrap:wrap;gap:8px;}
.wh-ocr-note{font-size:11.5px;color:var(--muted);}
.wh-ocr-note.ok{color:var(--positive-bright);}
.wh-ocr-note.fail{color:var(--negative-bright);}
.wh-ocr-note.run{color:var(--gold-bright);}
.wh-ord-at{margin-left:auto;font-size:11px;color:var(--faint);font-family:'IBM Plex Mono',monospace;}
.wh-ord-act{display:flex;gap:10px;align-items:center;margin-top:7px;}
.wh-mismatch>td{background:rgba(179,58,58,.09);color:var(--negative);}
.wh-mismatch-note{display:flex;align-items:center;gap:6px;color:var(--negative);}
.wh-arch{opacity:.5;}
.wh-row-act{display:flex;gap:8px;justify-content:flex-end;}
.wh-link.danger{color:var(--negative);}

.wh-acts{display:flex;flex-direction:column;gap:6px;}
.wh-act{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:10px 13px;cursor:pointer;}
.wh-act.k-writeoff{border-left:3px solid var(--negative);}
.wh-act.k-receipt{border-left:3px solid var(--positive);}
.wh-act.k-shipment{border-left:3px solid var(--gold);}
.wh-act-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12.5px;}
.wh-act-kind{font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);}
.wh-act-sum{font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--ink);}
.wh-act-article{font-size:10.5px;font-weight:700;letter-spacing:.02em;padding:2px 8px;border-radius:999px;background:rgba(190,138,46,.14);color:var(--gold-ink);white-space:nowrap;}
.wh-act-reason{color:var(--ink-soft);flex:1;min-width:0;}
.wh-act-at{margin-left:auto;font-size:11px;color:var(--faint);font-family:'IBM Plex Mono',monospace;}
.exp-art-tag{margin-left:8px;font-size:10px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--positive-bright);background:rgba(63,107,74,.16);padding:1px 6px;border-radius:999px;}
.art-name{flex:1;min-width:0;padding:6px 9px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);font-family:inherit;font-size:13px;background:var(--surface);color:var(--ink);}
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
.exp-total{margin-top:6px;padding:10px 15px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);font-size:13px;font-weight:600;color:var(--ink);}
.exp-total b{font-family:'IBM Plex Mono',monospace;}
.exp-row .mono{font-family:'IBM Plex Mono',monospace;color:var(--muted);}
.exp-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.exp-share{flex-grow:1;height:5px;border-radius:3px;background:var(--surface-sink);overflow:hidden;min-width:40px;}
.exp-share i{display:block;height:5px;border-radius:3px;}
.exp-month-h b{margin-left:0;}
.exp-period{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
.exp-period-seg{display:flex;gap:3px;padding:3px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);}
.exp-period-seg button{height:28px;padding:0 12px;border:none;border-radius:var(--radius-sm);background:none;font-family:inherit;font-size:12px;color:var(--muted);cursor:pointer;}
.exp-period-seg button.on{background:var(--surface-sink);color:var(--ink);font-weight:600;}
.exp-period-range{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);}
.exp-hero{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:16px 18px;margin-bottom:12px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);}
.exp-hero-l{font-size:12.5px;color:var(--muted);}
.exp-hero-v{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:600;line-height:1;color:var(--gold);letter-spacing:-.01em;}
.exp-cmp-tab{display:flex;flex-direction:column;}
.exp-cmp-hrow,.exp-cmp-row{display:grid;grid-template-columns:1fr 110px 110px 120px;gap:10px;align-items:center;padding:9px 14px;}
.exp-cmp-hrow{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
.exp-cmp-hrow span:not(:first-child){text-align:right;}
.exp-cmp-row{border-top:1px solid var(--line);font-size:13px;color:var(--ink-soft);}
.exp-cmp-row .mono{font-family:'IBM Plex Mono',monospace;text-align:right;color:var(--ink);}
.exp-cmp-n{display:flex;align-items:center;gap:9px;color:var(--ink);}
.exp-cmp-d{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--muted);}
.exp-cmp-d.up{color:var(--negative-bright);}
.exp-cmp-d.down{color:var(--positive-bright);}
.exp-cmp-sum{border-top:1px solid var(--line-strong);font-weight:600;background:var(--surface-alt);border-radius:0 0 var(--radius-md) var(--radius-md);}
.exp-entry{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:12.5px;color:var(--ink-soft);}
.exp-entry:last-child{border-bottom:none;}
.exp-entry-d{width:78px;flex-shrink:0;color:var(--muted);font-size:11.5px;}
.exp-entry-t{flex-grow:1;min-width:0;}
.exp-entry-a{margin-left:auto;font-family:'IBM Plex Mono',monospace;color:var(--ink);}
.exp-entry-x{width:24px;height:24px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:none;border-radius:var(--radius-sm);background:none;color:var(--faint);cursor:pointer;}
.exp-entry-x:hover{background:rgba(160,58,42,.12);color:var(--negative-bright);}
.exp-modal{width:min(560px,100%);}
.exp-modal .over-field{max-width:none;}
.exp-cats-pick{display:flex;flex-wrap:wrap;gap:7px;}
.exp-cat-chip{display:flex;align-items:center;gap:7px;height:34px;padding:0 13px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface);font-family:inherit;font-size:12.5px;color:var(--muted);cursor:pointer;}
.exp-cat-chip i{width:8px;height:8px;border-radius:50%;}
.exp-cat-chip.on{border-color:var(--gold);color:var(--ink);font-weight:600;background:rgba(190,138,46,.10);}
.exp-shot{display:flex;gap:12px;align-items:center;}
.exp-shot-box{width:84px;height:84px;flex-shrink:0;border:1px solid var(--line-strong);border-radius:var(--radius-md);background:var(--surface-alt);display:flex;align-items:center;justify-content:center;color:var(--faint);overflow:hidden;}
.exp-shot-box img{width:100%;height:100%;object-fit:cover;}
.exp-shot-act{display:flex;flex-direction:column;align-items:flex-start;gap:8px;}
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
.salon-cat-legend{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 2px 2px;}
.cat-badge{display:inline-flex;align-items:center;justify-content:center;min-width:26px;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;font-family:'IBM Plex Mono',monospace;}
.cat-badge.cat-Ap{background:rgba(63,107,74,.18);color:var(--positive);}
.cat-badge.cat-A{background:rgba(63,107,74,.12);color:var(--positive);}
.cat-badge.cat-B{background:rgba(220,169,74,.16);color:var(--gold-bright,var(--gold));}
.cat-badge.cat-C{background:rgba(160,58,42,.14);color:var(--negative-bright,var(--negative));}

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

/* ============ ВІДЖЕТ-ЕКРАН: показники території (для PWA-ярлика) ============ */
function areaKeys(area) { return SALONS.filter((s) => s.area === area).map((s) => s.key); }
function widgetTerritoryStats(rows, plans, ym) {
  const dim = daysInYm(ym);
  const dayCount = Math.min(new Date().getDate(), dim);
  const today = todayISO();
  const byKey = {};
  for (const r of rows) {
    const e = effective(r);
    const b = (byKey[r.salon_key] = byKey[r.salon_key] || { today: 0, mtd: 0 });
    if (r.work_date === today) b.today = e.assort;
    b.mtd += e.assort;
  }
  const areas = [
    { label: "Територія · місто", area: "місто" },
    { label: "Територія · область", area: "область" },
  ].map((t) => {
    const keys = areaKeys(t.area);
    const done = keys.reduce((a, k) => a + (byKey[k]?.mtd || 0), 0);
    const doneToday = keys.reduce((a, k) => a + (byKey[k]?.today || 0), 0);
    const plan = keys.reduce((a, k) => a + (planOf(plans, k).assort || 0), 0);
    const normToday = plan ? (plan / dim) * dayCount : 0;
    return {
      ...t, done, doneToday, plan, normToday,
      donePct: plan ? (done / plan) * 100 : 0,
      gap: done - normToday,
      gapPct: normToday ? ((done - normToday) / normToday) * 100 : 0,
      remain: Math.max(0, plan - done),
    };
  });
  return {
    areas,
    totalToday: areas.reduce((a, x) => a + x.doneToday, 0),
    totalDone: areas.reduce((a, x) => a + x.done, 0),
    totalPlan: areas.reduce((a, x) => a + x.plan, 0),
    dayCount, dim,
  };
}

function TerritoryWidget() {
  const [state, setState] = useState("boot"); // boot | noauth | ready
  const [data, setData] = useState(null);
  const [at, setAt] = useState(null);
  const ym = nowYm();

  const load = async () => {
    try {
      const [rows, plans] = await Promise.all([listMetrics(ym), listPlans()]);
      setData(widgetTerritoryStats(rows, plans, ym));
      setAt(new Date());
      setState("ready");
    } catch { setState("noauth"); }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const cab = await currentCabinet();
      if (!alive) return;
      if (!cab) { setState("noauth"); return; }
      await initAfterAuth();
      load();
    })();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 5 * 60 * 1000);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openApp = () => { window.location.href = "/"; };

  if (state === "noauth") {
    return (
      <div className="tw-screen">
        <div className="tw-noauth">
          <span className="tw-logo"><BarChart3 size={30} /></span>
          <h1>Показники території</h1>
          <p>Спочатку увійдіть у застосунок — далі віджет працюватиме сам.</p>
          <button className="btn-primary" onClick={() => (window.location.href = "/")}>Відкрити застосунок</button>
        </div>
      </div>
    );
  }
  if (state === "boot" || !data) return <div className="tw-screen"><div className="loading" style={{ paddingTop: 100 }}>Завантаження…</div></div>;

  const totPct = data.totalPlan ? (data.totalDone / data.totalPlan) * 100 : 0;
  return (
    <div className="tw-screen" onClick={openApp} role="button" title="Відкрити застосунок">
      <div className="tw-head">
        <span>Показники території</span>
        <button className="tw-refresh" onClick={(e) => { e.stopPropagation(); load(); }} aria-label="Оновити"><RefreshCw size={15} /></button>
      </div>

      <div className="tw-total">
        <div className="tw-total-val">{fmt(data.totalToday)}</div>
        <div className="tw-total-lab">оборот мережі сьогодні</div>
        <div className="tw-total-mtd">{Math.round(totPct)}% місячного плану · {fmt(data.totalDone)}</div>
      </div>

      {data.areas.map((x) => (
        <div className="tw-card" key={x.area}>
          <div className="tw-card-h">{x.label}<b>{Math.round(x.donePct)}%</b></div>
          <div className="tw-bar"><div className={`tw-fill ${x.gap < 0 ? "behind" : "ahead"}`} style={{ width: `${Math.min(100, Math.max(0, x.donePct))}%` }} />
            <span className="tw-mark" style={{ left: `${Math.min(100, x.plan ? (x.normToday / x.plan) * 100 : 0)}%` }} /></div>
          <div className="tw-rows">
            <div><span>{x.gap < 0 ? "Відставання від норми" : "Випередження норми"}</span>
              <b className={x.gap < 0 ? "neg" : "pos"}>{x.gap < 0 ? "−" : "+"}{fmt(Math.abs(x.gap))} · {Math.abs(Math.round(x.gapPct))}%</b></div>
            <div><span>Залишок до плану</span><b>{fmt(x.remain)}</b></div>
          </div>
        </div>
      ))}

      <div className="tw-foot">{at ? `оновлено ${at.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}` : ""} · тап — відкрити застосунок</div>
    </div>
  );
}

function UpdateBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => onUpdateReady(() => setShow(true)), []);
  if (!show) return null;
  return (
    <div className="update-banner">
      <span>Доступна нова версія</span>
      <button onClick={() => applyUpdate()}><RefreshCw size={13} /> Оновити</button>
    </div>
  );
}

export default function App() {
  const isWidget = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("w") === "1";
  if (isWidget) {
    return (
      <div className="app-root" data-widget="1">
        <style>{CSS}</style>
        <TerritoryWidget />
      </div>
    );
  }
  return <AppMain />;
}

function AppMain() {
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
      // Дека вибору кабінету рендериться ДО входу — без цього виклику лічильник
      // магазинів на тайлі ТМ показував лише БАЗОВЕ призначення (org.js SALONS),
      // ігноруючи реальні перепризначення між ТМ. Кеш вантажиться асинхронно,
      // тож після завантаження форсуємо ре-рендер, щоб дека одразу оновилась.
      loadReassignCache().then(() => { if (active) bumpRefs(); }).catch(() => {});
      // вхід зберігається до натискання «Вийти»: оновлення сторінки, нова вкладка чи перезапуск не розлогінюють
      const keep = true;
      const cab = await currentCabinet();
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

  const enter = (cab) => {
    setSession(cab);
    setPending(null);
    localStorage.setItem(KEEP_KEY, "1"); // лишаємось у кабінеті до «Вийти»
    sessionStorage.setItem(ALIVE_KEY, "1");
    setRemembered(cab);
    loadCalcRefs().then(bumpRefs);
  };
  const goHome = () => setSession(null);            // на головну, сесія Supabase лишається

  // з кабінету виходимо лише кнопкою «Вийти»: кнопка «Назад» браузера / жест назад на телефоні нікуди не веде
  const inCab = !!session;
  useEffect(() => {
    if (!inCab) return undefined;
    const guard = () => window.history.pushState({ cab: 1 }, "", window.location.href);
    guard();
    window.addEventListener("popstate", guard);
    return () => window.removeEventListener("popstate", guard);
  }, [inCab]);
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
      <UpdateBanner />
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
          onSuccess={() => enter(pending)}
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
