import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import _ from "lodash";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Camera, X, ChevronLeft, Check, AlertTriangle, TrendingUp, Users, ClipboardList, Pencil,
  Store, Calculator, LogIn, Wallet, User, Clock,
  LayoutGrid, FileText, Calendar, Package, BarChart3, CreditCard, CheckSquare, ListChecks, GraduationCap,
  Bell, Star, Trash2, Plus, ChevronRight, Sparkles, Image as ImageIcon,
  Cake, UserPlus, UserMinus, Archive as ArchiveIcon,
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
  listNotifications, markRead, markAllRead, notify, subscribeNotifications,
} from "./lib/notifications.js";

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
    onChange(parseNum(ref.current.value, allowEmpty));
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
function CalcBusyDot() {
  const [busy, setBusy] = useState(calcBusyNow());
  useEffect(() => subscribeCalcBusy(setBusy), []);
  return <span className={`calc-busy-dot ${busy ? "on" : ""}`} title="Перерахунок мотивації…" aria-hidden={!busy} />;
}

function TopBar({ title, onBack, onLogout, cabKey }) {
  return (
    <div className="topbar">
      <button className="topbar-back" onClick={onBack}><ChevronLeft size={16} /> Назад</button>
      <span className="topbar-title">{title}</span>
      <div className="topbar-right">
        <CalcBusyDot />
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
  const [ym, setYm] = useState(nowYm());
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
    const ok = await verify(login, password);
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
function SmView({ salon, embedded }) {
  const [ym, setYm] = useState(nowYm());
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTab("form");
    skipSave.current = true;
    loadSmData(salon.key, ym).then((d) => { if (active) { setData(d); setLoading(false); } });
    return () => { active = false; };
  }, [salon.key, ym]);

  const update = (path, value) => setData((prev) => _.set(_.cloneDeep(prev), path, value));
  const onAddShot = makeAddShot(setData);
  const onRemoveShot = makeRemoveShot(setData);
  const toggleBlock = (id) => setExpandedBlock((p) => (p === id ? null : id));

  const saveDraft = async () => {
    setSaving(true);
    await saveSmData(salon.key, ym, data);
    setSaving(false);
    setSavedAt(new Date());
  };
  useEffect(() => {
    if (loading) return undefined;
    if (skipSave.current) { skipSave.current = false; return undefined; }
    const t = setTimeout(async () => { await saveSmData(salon.key, ym, data); setSavedAt(new Date()); }, 2500);
    return () => clearTimeout(t);
  }, [data, loading, salon.key, ym]);

  const { calc } = useSmCalc(data, salon.key, ym);

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

  const dl = deadlineInfo(ym);
  const showBanner = !dl.future && (data.status === "draft" || data.status === "corrected");
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

  const { calc } = useSmCalc(data, salon.key, ym);

  const saveAdjOnly = async () => { setSaving(true); await saveSmData(salon.key, ym, data); setSaving(false); };
  const setPaymentStatus = async (status) => {
    const next = { ...data, paymentStatus: status, paymentStatusAt: new Date().toISOString() };
    setData(next);
    await saveSmData(salon.key, ym, next);
    if (status === "to_pay") notify({ recipient: salon.key, kind: "salary", title: "ЗП призначено до виплати", body: monthLabel(ym), actor: "manager", link: "salary" });
    if (status === "paid") notify({ recipient: salon.key, kind: "salary", title: "ЗП виплачено", body: monthLabel(ym), actor: "manager", link: "salary" });
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
    notify({ recipient: salon.key, kind: "salary", title: "ТМ вніс корективи у вашу ЗП", body: monthLabel(ym), actor: "tm", link: "salary" });
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

      {loading || !calc ? <div className="loading">Завантаження…</div> : (
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
  const [ym, setYm] = useState(nowYm());
  const salons = useMemo(() => salonsOfTm(tmKey, ym), [tmKey, ym]);
  const [rows, setRows] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  const months = useMemo(() => {
    return recentMonths(12);
  }, []);

  useEffect(() => {
    let active = true;
    setRows(null);
    (async () => {
      const datas = await Promise.all(salons.map((s) => loadSmData(s.key, ym)));
      const calcs = salons.length
        ? await calcSmBatch(salons.map((s, i) => ({ data: datas[i], salonKey: s.key, ym })))
        : [];
      const out = {};
      salons.forEach((s, i) => { out[s.key] = { data: datas[i], total: calcs[i].total }; });
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
  const calc = await calcTm(d, g, tmKey, ym);
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
      const smDatas = await Promise.all(SALONS.map((s) => loadSmData(s.key, ym)));
      const smCalcs = await calcSmBatch(SALONS.map((s, i) => ({ data: smDatas[i], salonKey: s.key, ym })));
      const smRows = SALONS.map((s, i) => ({
        kind: "sm", key: s.key, name: salonLabel(s), tm: salonTmOn(s.key, ym),
        data: smDatas[i], total: smCalcs[i].total,
        status: smDatas[i].status, paymentStatus: smDatas[i].paymentStatus, tmApproved: smDatas[i].tmApproved,
      }));
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
    if (status === "to_pay" || status === "paid") {
      notify({
        recipient: row.key, kind: "salary",
        title: status === "to_pay" ? "ЗП призначено до виплати" : "ЗП виплачено",
        body: monthLabel(ym), actor: role === "accountant" ? "accountant" : "manager", link: "salary",
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

function AdminPanel() {
  const [tab, setTab] = useState("recovery");
  const tabs = [
    ["recovery", "Відновлення паролю"],
    ["access", "Доступи"],
    ["reassign", "Магазини й ТМ"],
    ["rights", "Права"],
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

  const list = rows.filter((e) => (archive ? e.status === "fired" : e.status === "active"));
  const bySalon = salons.map((s) => ({
    salon: s,
    emps: list.filter((e) => e.salon_key === s.key)
      .sort((a, b) => EMP_ROLE_ORDER.indexOf(a.role) - EMP_ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)),
  }));
  const orphan = list.filter((e) => !salons.some((s) => s.key === e.salon_key));

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

function CabinetShell({ title, onExit, onLogout, modules, cabKey }) {
  const items = modules.filter(Boolean);
  const [active, setActive] = useState(items[0].key);
  const mod = items.find((m) => m.key === active) || items[0];
  return (
    <div className="view cab-shell">
      <TopBar title={title} onBack={onExit} onLogout={onLogout} cabKey={cabKey} />
      <div className="cab-layout">
        <nav className="cab-side">
          {items.map((m) => (
            <React.Fragment key={m.key}>
              {m.divider && <span className="cab-side-sep" />}
              <button className={`cab-side-item ${m.key === active ? "active" : ""}`} onClick={() => setActive(m.key)}>
                {m.icon}
                <span className="cab-side-label">{m.label}</span>
                {m.badge != null && <span className={`badge ${m.badgeTone || "badge-warn"}`}>{m.badge}</span>}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="cab-content">{mod.render()}</div>
      </div>
    </div>
  );
}

function TmOverview({ tmKey }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let active = true;
    const ym = nowYm();
    (async () => {
      const [d, g, invoices] = await Promise.all([
        loadData(tmKey, ym), loadGrade(tmKey, ymToQuarter(ym)), listInvoices().catch(() => []),
      ]);
      const salons = salonsOfTm(tmKey, ym);
      let submitted = 0;
      for (const sl of salons) {
        const sd = await loadSmData(sl.key, ym);
        if (sd.status === "submitted" || sd.status === "corrected") submitted += 1;
      }
      const calc = await calcTm(d, g, tmKey, ym);
      const invM = invoices.filter((inv) => invMonth(inv) === ym && inv.status !== "cancelled");
      const invIssued = invM.reduce((a, i) => a + Number(i.amount || 0), 0);
      const invPaid = invM.filter((i) => i.status !== "issued").reduce((a, i) => a + Number(i.amount || 0), 0);
      if (active) setS({ status: d.status, total: calc.floored, pct: calc.b1.d.sales.pct, submitted, salonTotal: salons.length, dl: deadlineInfo(ym), invIssued, invPaid, invCount: invM.length });
    })();
    return () => { active = false; };
  }, [tmKey]);
  if (!s) return <div className="loading">Завантаження…</div>;
  const st = { draft: "чернетка", submitted: "на розгляді", corrected: "потребує коректив", approved: "погоджено" }[s.status] || "—";
  const nagged = (s.status === "draft" || s.status === "corrected") && !s.dl.future;
  return (
    <div className="ov">
      <h3 className="ov-h">Огляд</h3>
      <p className="ov-sub">{monthLabel(nowYm())}</p>
      <div className="ov-tiles">
        <div className="ov-tile"><b>{fmt(s.total)}</b><span>моя ЗП · {st}</span></div>
        <div className="ov-tile"><b>{s.submitted} / {s.salonTotal}</b><span>салони подали ЗП</span></div>
        <div className="ov-tile"><b>{s.pct.toFixed(0)}%</b><span>план по ТО</span></div>
        <div className="ov-tile"><b>{invMoney(s.invIssued)}</b><span>безнал за місяць · {s.invCount} рах.</span></div>
        <div className="ov-tile"><b>{invMoney(s.invPaid)}</b><span>з них оплачено+</span></div>
      </div>
      {nagged && (
        <div className={`banner ${s.dl.overdue ? "banner-late" : "banner-warn"}`}>
          <AlertTriangle size={16} />
          {s.dl.overdue ? `Термін подачі ЗП минув (був до ${s.dl.dueLabel})` : `Подайте ЗП за ${monthLabel(nowYm())} до ${s.dl.dueLabel}`}
        </div>
      )}
    </div>
  );
}

function SmOverview({ salon }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let active = true;
    const ym = nowYm();
    (async () => {
      const [d, invoices] = await Promise.all([loadSmData(salon.key, ym), listInvoices().catch(() => [])]);
      const calc = await calcSm(d, salon.key, ym);
      if (!active) return;
      const invM = invoices.filter((i) => invMonth(i) === ym && i.status !== "cancelled");
      setS({
        status: d.status, total: calc.total, category: calc.category, dl: deadlineInfo(ym),
        invSum: invM.reduce((a, i) => a + Number(i.amount || 0), 0), invCount: invM.length,
      });
    })();
    return () => { active = false; };
  }, [salon.key]);
  if (!s) return <div className="loading">Завантаження…</div>;
  const st = { draft: "чернетка", submitted: "на розгляді в ТМ", corrected: "ТМ вніс корективи" }[s.status] || "—";
  const nagged = (s.status === "draft" || s.status === "corrected") && !s.dl.future;
  return (
    <div className="ov">
      <h3 className="ov-h">Огляд</h3>
      <p className="ov-sub">{monthLabel(nowYm())}</p>
      <div className="ov-tiles">
        <div className="ov-tile"><b>{fmt(s.total)}</b><span>ЗП · {st}</span></div>
        <div className="ov-tile"><b>{s.category}</b><span>категорія салону</span></div>
        <div className="ov-tile"><b>{invMoney(s.invSum)}</b><span>безнал за місяць · {s.invCount} рах.</span></div>
      </div>
      {nagged && (
        <div className={`banner ${s.dl.overdue ? "banner-late" : "banner-warn"}`}>
          <AlertTriangle size={16} />
          {s.dl.overdue ? `Термін подачі минув (був до ${s.dl.dueLabel})` : `Подайте ЗП до ${s.dl.dueLabel}`}
        </div>
      )}
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
    { key: "kpi", label: "Показники території", icon: <BarChart3 size={16} />, render: () => <ModuleStub name="Показники території" /> },
    { key: "team", label: "Команда", icon: <Users size={16} />, divider: true, render: () => <EmployeesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    { key: "archive", label: "Архів", icon: <ArchiveIcon size={16} />, render: () => <EmployeesModule cab={{ key: tmKey, type: "tm", tmKey }} archive /> },
    { key: "docs", label: "Документи й стандарти", icon: <FileText size={16} />, divider: true, render: () => <ModuleStub name="Документи й стандарти" /> },
    { key: "bn", label: "Безнальні рахунки", icon: <CreditCard size={16} />, render: () => <InvoicesModule cab={{ key: tmKey, type: "tm", tmKey }} /> },
    isAdmin ? { key: "admin", label: "Адміністрування", icon: <User size={16} />, divider: true, render: () => <AdminPanel /> } : null,
  ];
  return <CabinetShell title={`ТМ · ${tm.name}`} onExit={onExit} onLogout={onLogout} modules={modules} cabKey={tmKey} />;
}

function ManagerCabinet({ onExit, onLogout }) {
  const [tab, setTab] = useState("byTm");
  return (
    <div className="view">
      <TopBar title={MANAGER.name} onBack={onExit} onLogout={onLogout} cabKey="manager" />
      <div className="cab-nav">
        <button className={tab === "byTm" ? "active" : ""} onClick={() => setTab("byTm")}><Users size={14} /> По ТМ</button>
        <button className={tab === "consol" ? "active" : ""} onClick={() => setTab("consol")}><Wallet size={14} /> Зведення ЗП</button>
        <button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}><CheckSquare size={14} /> Задачі</button>
        <button className={tab === "inv" ? "active" : ""} onClick={() => setTab("inv")}><CreditCard size={14} /> Рахунки</button>
        <button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}><Users size={14} /> Команда</button>
      </div>
      {tab === "byTm" && <ManagerView embedded />}
      {tab === "consol" && <ConsolidationPanel role="manager" />}
      {tab === "tasks" && <TasksModule cab={{ key: "manager", type: "manager" }} />}
      {tab === "inv" && <InvoicesModule cab={{ key: "manager", type: "manager" }} />}
      {tab === "team" && (
        <>
          <EmployeesModule cab={{ key: "manager", type: "manager" }} />
          <EmployeesModule cab={{ key: "manager", type: "manager" }} archive />
        </>
      )}
    </div>
  );
}

function AccountantCabinet({ onExit, onLogout }) {
  const [tab, setTab] = useState("consol");
  return (
    <div className="view">
      <TopBar title={ACCOUNTANT.name} onBack={onExit} onLogout={onLogout} cabKey="accountant" />
      <div className="cab-nav">
        <button className={tab === "consol" ? "active" : ""} onClick={() => setTab("consol")}><Wallet size={14} /> Зведення ЗП</button>
        <button className={tab === "inv" ? "active" : ""} onClick={() => setTab("inv")}><CreditCard size={14} /> Безнальні рахунки</button>
      </div>
      {tab === "consol" && <ConsolidationPanel role="accountant" />}
      {tab === "inv" && <InvoicesModule cab={{ key: "accountant", type: "accountant" }} />}
    </div>
  );
}

function SmCabinet({ salonKey, onExit, onLogout }) {
  const salon = salonByKey(salonKey);
  const modules = [
    { key: "overview", label: "Огляд", icon: <LayoutGrid size={16} />, render: () => <SmOverview salon={salon} /> },
    { key: "salary", label: "Розрахунок ЗП", icon: <Calculator size={16} />, render: () => <SmView salon={salon} embedded /> },
    { key: "tasks", label: "Задачі й чек-листи", icon: <ListChecks size={16} />, render: () => <TasksModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "team", label: "Команда", icon: <Users size={16} />, render: () => <EmployeesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
    { key: "shifts", label: "Графік змін", icon: <Calendar size={16} />, render: () => <ModuleStub name="Графік змін" /> },
    { key: "requests", label: "Заявки", icon: <Package size={16} />, render: () => <ModuleStub name="Заявки" /> },
    { key: "reports", label: "Звіти", icon: <FileText size={16} />, render: () => <ModuleStub name="Звіти (клінінг, лічильники)" /> },
    { key: "standards", label: "Стандарти й навчання", icon: <GraduationCap size={16} />, render: () => <ModuleStub name="Стандарти й навчання" /> },
    { key: "bn", label: "Безнальні рахунки", icon: <CreditCard size={16} />, divider: true, render: () => <InvoicesModule cab={{ key: salonKey, type: "sm", tmKey: salonTmOn(salonKey) }} /> },
  ];
  return <CabinetShell title={`Салон · ${salonLabel(salon)}`} onExit={onExit} onLogout={onLogout} modules={modules} cabKey={salonKey} />;
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
  .cab-layout{grid-template-columns:1fr;gap:14px;}
  .cab-side{position:static;flex-direction:row;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:6px;}
  .cab-side-item{white-space:nowrap;flex-shrink:0;}
  .cab-side-item .badge{margin-left:6px;}
  .cab-side-sep{display:none;}
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
.cab-shell{max-width:1120px;}
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

/* ---------- огляд ---------- */
.ov{animation:fadeIn .28s ease both;}
.ov-h{font-family:'Fraunces',serif;font-size:20px;font-weight:600;color:var(--on-dark);margin:0 0 2px;}
.ov-sub{font-size:12px;color:var(--on-dark-3);margin:0 0 18px;}
.ov-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;}
.ov-tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:16px;box-shadow:var(--sh-1);}
.ov-tile b{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:var(--ink);display:block;font-variant-numeric:tabular-nums;}
.ov-tile span{font-size:11px;color:var(--muted);}

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

export default function App() {
  const [session, setSession] = useState(null);      // активний кабінет { key, type, tmKey, label }
  const [remembered, setRemembered] = useState(null); // збережений вхід (для смужки на головній)
  const [pending, setPending] = useState(null);
  const [ready, setReady] = useState(false);

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
        loadCalcRefs();
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
    loadCalcRefs();
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
      {ready && session && (
        <CabinetRouter cabinet={session} onExit={goHome} onLogout={logout} />
      )}
    </div>
  );
}
