// =========================================================
//  Dnipro-M — Edge Function «calc»
//  Рушій мотивації ТМ і СМ + тексти «Умови».
//  Уся логіка нарахувань живе ТУТ (сервер), у браузер не потрапляє.
//
//  Деплой: Supabase Dashboard → Edge Functions → Deploy new function
//          назва: calc  →  вставити цей файл  →  Deploy.
//  (або: supabase functions deploy calc --no-verify-jwt=false)
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- довідники (не таємниця: є і в клієнті) ----------
const SALONS: Record<string, { tm: string; area: string }> = {
  "gorodok-peremyshlska": { tm: "andriy", area: "область" },
  "mostyska-rynok": { tm: "andriy", area: "область" },
  "turka-sheptytskoho": { tm: "andriy", area: "область" },
  "lviv-lypynskoho": { tm: "ivan", area: "місто" },
  "lviv-shyretska": { tm: "ivan", area: "місто" },
  "lviv-shevchenka": { tm: "ivan", area: "місто" },
  "lviv-kavaleridze": { tm: "ivan", area: "місто" },
  "lviv-vashyngtona": { tm: "ivan", area: "місто" },
};
const TM_KEYS = ["andriy", "ivan"];
const ADMIN_KEY = "andriy";

// ---------- helpers ----------
const pad = (n: number) => String(n).padStart(2, "0");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

async function reassignList(svc: any): Promise<any[]> {
  const { data } = await svc.from("kv").select("value").eq("key", "reassign:list").maybeSingle();
  const v = data?.value;
  return Array.isArray(v) ? v : [];
}
function salonTmOn(salonKey: string, ym: string, reass: any[]): string | null {
  const base = SALONS[salonKey];
  if (!base) return null;
  const m = ym || `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
  const applicable = reass
    .filter((r) => r.salonKey === salonKey && String(r.fromYm) <= m)
    .sort((a, b) => (String(a.fromYm) < String(b.fromYm) ? -1 : String(a.fromYm) > String(b.fromYm) ? 1 : (a.id - b.id)));
  return applicable.length ? applicable[applicable.length - 1].toTm : base.tm;
}
function salonsOfTm(tmKey: string, ym: string, reass: any[]): string[] {
  return Object.keys(SALONS).filter((k) => salonTmOn(k, ym, reass) === tmKey);
}

// =========================================================
//  РУШІЙ МОТИВАЦІЇ ТМ  (перенесено з src/App.jsx — таємниця)
// =========================================================
function rowOf(v: number, edges: number[]) { return v < edges[0] ? 0 : v < edges[1] ? 1 : v <= edges[2] ? 2 : 3; }
const GI = (grade: number) => clamp((grade || 2) - 1, 0, 2);

const SALES_TABLE = [[15000, 10000, 5000], [20000, 15000, 10000], [25000, 20000, 15000], [30000, 25000, 20000]];
const LFL_TABLE = [[4000, 3000, 2000], [10000, 8000, 6000], [20000, 16000, 12000], [25000, 20000, 15000]];
const SM13_TABLE = [[3000, 2000, 1000], [10000, 8000, 6000], [16000, 14000, 12000], [20000, 18000, 16000]];
const TM_GRADE_MIN: Record<number, number> = { 1: 60000, 2: 50000, 3: 45000 };

function calcSales(b1: any, grade: number) {
  const factNet = (b1.salesFact || 0) - (b1.salesEz || 0);
  const pct = b1.salesPlan > 0 ? (factNet / b1.salesPlan) * 100 : 0;
  const bonus = SALES_TABLE[rowOf(pct, [90, 100, 110])][GI(grade)];
  return { factNet, pct, bonus };
}
function calcLfl(b1: any, grade: number) {
  const growth = (b1.lflCurrent || 0) - (b1.lflPrev || 0);
  const pct = b1.lflPrev > 0 ? (growth / b1.lflPrev) * 100 : 0;
  const bonus = LFL_TABLE[rowOf(pct, [25, 35, 45])][GI(grade)];
  return { growth, pct, bonus };
}
function calcSm13(b1: any, grade: number, salonKeys: string[]) {
  const total = salonKeys.length;
  const met = salonKeys.filter((k) => b1.smPlanMet?.[k]).length;
  const pct = total > 0 ? (met / total) * 100 : 0;
  const bonus = SM13_TABLE[rowOf(pct, [50, 75, 100])][GI(grade)];
  return { total, met, pct, bonus };
}
function calcCalls(b2: any) {
  if (!b2.callsPlanMet || !b2.callsFact || !b2.callsCostNorm) return { avgCost: 0, ratio: 0, pct: 0, bonus: 0 };
  const avgCost = (b2.callsRevenue || 0) / b2.callsFact;
  const ratio = (avgCost / b2.callsCostNorm) * 100;
  const pct = ratio < 90 ? 0.5 : ratio <= 110 ? 1 : 1.5;
  return { avgCost, ratio, pct, bonus: (b2.callsRevenue || 0) * (pct / 100) };
}
function calcRent(b2: any, salonKeys: string[]) {
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
function calcPbi(b2: any) {
  const total = b2.pbiTotalRevenue || 0;
  const pbiRev = b2.pbiRevenue || 0;
  const percent = total > 0 ? (pbiRev / total) * 100 : 0;
  const bp = percent < 15 ? 0.2 : percent <= 20 ? 0.5 : 0.7;
  return { percent, bonus: pbiRev * (bp / 100) }; // % береться від обороту PBI
}
function calcStores(b2: any, salonKeys: string[]) {
  return salonKeys.reduce((sum, k) => {
    const p = Number(b2.profitByStore?.[k]) || 0;
    return sum + (p < 0 ? -2000 : p <= 5 ? 0 : p <= 10 ? 2000 : 5000);
  }, 0);
}
function calcStaff(b3: any) {
  const pct = b3.staffPlan > 0 ? ((b3.staffFact || 0) / b3.staffPlan) * 100 : 0;
  const bonus = pct < 75 ? 0 : pct <= 90 ? 2000 : pct <= 99 ? 4000 : 8000;
  return { pct, bonus };
}
/* 0 порушень → +1000; ≥1 → +1000 не нараховується, лише штраф −200/шт (до −1000) */
function calcZeroOrPenalty(count: number) {
  const c = count || 0;
  return c === 0 ? 1000 : Math.max(-1000, -200 * c);
}
function calcCapped1000(count: number) { return clamp(1000 - 200 * (count || 0), -1000, 1000); }
function calcSmState(smCount: number, found: number, unfixed: number) { return 500 * smCount - 100 * (found || 0) - 200 * (unfixed || 0); }
function calcTraining(score: number) {
  if (score < 90) return -1000;
  if (score < 95) return 0;
  if (score < 100) return 1000;
  return 2000;
}
function calcBlock3(b3: any, salonCount: number) {
  const staff = calcStaff(b3).bonus;
  const violations = calcZeroOrPenalty(b3.violationsCount);      // 3.2
  const schedule = calcZeroOrPenalty(b3.scheduleViolationsCount); // 3.3 — та сама умова, що й 3.2
  const smState = calcSmState(salonCount, b3.smViolationsFound, b3.smViolationsUnfixed);
  const merch = calcCapped1000(b3.merchViolationsCount);         // 3.5
  const training = calcTraining(b3.trainingScore);
  const rawSubtotal = staff + violations + schedule + smState + merch + training;
  return { staff, violations, schedule, smState, merch, training, rawSubtotal, subtotal: Math.min(rawSubtotal, 15000) };
}
function calcEz(ez: any) {
  const netProfit = (ez.revenue || 0) * ((ez.profitabilityPercent || 0) / 100);
  const ezValue = netProfit - (ez.och || 0) - (ez.np || 0) - (ez.acquiring || 0) - (ez.taxes || 0);
  // бонус лише додатний — відʼємне ЕЗ не віднімається від ЗП
  return { netProfit, ezValue, bonus: Math.max(0, ezValue * 0.10) };
}
function calcTmAll(data: any, grade: number, tmKey: string, ym: string, reass: any[]) {
  const salonKeys = salonsOfTm(tmKey || TM_KEYS[0], ym, reass);
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

  const b3: any = calcBlock3(data.block3, salonCount);
  const staff = calcStaff(data.block3);
  b3.d = { staff };

  const ez = calcEz(data.ez);
  const beforeFloor = b1.subtotal + b2.subtotal + b3.subtotal + ez.bonus;
  const min = TM_GRADE_MIN[grade] || TM_GRADE_MIN[2];
  const floored = Math.max(beforeFloor, min);
  return { b1, b2, b3, ez, beforeFloor, floored, floorApplied: beforeFloor < min, min, salonKeys, salonCount };
}

// =========================================================
//  РУШІЙ МОТИВАЦІЇ СМ  (перенесено з src/smCalc.js — таємниця)
// =========================================================
const daysInMonthOf = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const SM_CATEGORIES = [
  { key: "A+", min: 1_800_000, note: "від 1.8 млн" },
  { key: "A", min: 1_300_000, note: "1.3 – 1.8 млн" },
  { key: "B", min: 800_000, note: "800 тис – 1.3 млн" },
  { key: "C", min: 0, note: "до 800 тис" },
];
const categoryOf = (avg3To: number) => (SM_CATEGORIES.find((c) => (avg3To || 0) >= c.min) || SM_CATEGORIES[3]).key;
const PLAN_BRACKETS = ["до 90%", "90–100%", "100–110%", "110–120%", "120%+"];
const planBracket = (pct: number) => { const p = pct || 0; if (p < 90) return 0; if (p < 100) return 1; if (p < 110) return 2; if (p < 120) return 3; return 4; };
const SM_BASE_TABLE: Record<string, number[]> = {
  "A+": [24000, 27000, 30000, 33000, 36000],
  "A": [22000, 24000, 27000, 30000, 33000],
  "B": [20000, 22000, 24000, 27000, 30000],
  "C": [18000, 20000, 22000, 25000, 28000],
};
const normDaysOff = (area: string) => (area === "місто" ? 10 : 9);
function shiftFactor({ daysInMonth, daysOff, area }: any) {
  const normWorked = Math.max(1, daysInMonth - normDaysOff(area));
  const worked = clamp((daysInMonth || 0) - (daysOff || 0), 0, daysInMonth || 0);
  return clamp(worked / normWorked, 0, 1);
}
const SM_MANAGER_COEFS: Record<string, number> = { "1.2": 1.2, "1.1": 1.1, "1.0": 1.0 };
const MANAGER_COEF_META = [
  { key: "1.2", label: "Керуючий (1.2)" },
  { key: "1.1", label: "В.О. керуючого (1.1)" },
  { key: "1.0", label: "— (без коефіцієнта)" },
];
function calcManagerBlock(m: any, baseRate: number) {
  const attest = m.attestationAll ? 1000 : 0;
  let standards;
  if (m.noRemarks) standards = 2000;
  else {
    const penalty = 200 * (m.remarksFound || 0) + 400 * (m.remarksUnfixed || 0);
    standards = -Math.min(2000, penalty);
  }
  const coefNum = SM_MANAGER_COEFS[String(m.coef)] ?? Number(m.coef || 1) ?? 1;
  const coefBonus = Math.round(baseRate * (coefNum - 1));
  return { attest, standards, coefBonus, subtotal: attest + standards + coefBonus };
}
function tierBonus(value: number, thresholds: number[], bonuses: number[]) {
  const v = value || 0;
  for (let i = thresholds.length - 1; i >= 0; i--) if (thresholds[i] && v >= thresholds[i]) return bonuses[i];
  return 0;
}
function calcBonusBlock(b: any, dailyRate: number, teamSize = 1) {
  const team = Math.max(1, teamSize || 1);
  let callsPct = 0;
  if (b.callsCountDone && b.callsRevenueDone) callsPct = 5;
  else if (b.callsCountDone) callsPct = 3;
  const callsPlanRevenue = (b.monthlyToPlan || 0) * 0.1;
  const calls = Math.round((b.callsRevenue || 0) * (callsPct / 100));
  const replacement = Math.round((b.replacementDays || 0) * 0.2 * (dailyRate || 0));
  const avgCheck = tierBonus(b.avgCheckFact, [b.scN1, b.scN2, b.scN3], [700, 1500, 2000]);
  const checkLen = tierBonus(b.checkLenFact, [b.clN1, b.clN2, b.clN3], [700, 1500, 2000]);
  const courses = b.coursesOk ? 500 : 0;
  // 3.6 НП і 3.7 БН — командні: 4% від обороту ділиться на всю команду салону
  const siteNpTeam = Math.round((b.siteNpRevenue || 0) * 0.04);
  const bnTeam = Math.round((b.bnRevenue || 0) * 0.04);
  const siteNp = Math.round(siteNpTeam / team);
  const bn = Math.round(bnTeam / team);
  return {
    callsPct, callsPlanRevenue, calls, replacement, avgCheck, checkLen, courses,
    siteNp, bn, siteNpTeam, bnTeam, team,
    subtotal: calls + replacement + avgCheck + checkLen + courses + siteNp + bn,
  };
}
function calcPpi(p: any, teamSize = 1) {
  const team = Math.max(1, teamSize || 1);
  const pct = p.planClosed ? 3 : 1;
  const teamBonus = Math.round((p.ppiRevenue || 0) * (pct / 100));
  return { pct, team, teamBonus, bonus: Math.round(teamBonus / team) };
}
const recordThreshold = (prev: number) => Math.max(1_000_000, Math.round((prev || 0) * 1.1));
function calcRecord(r: any, teamSize = 1) {
  const team = Math.max(1, teamSize || 1);
  const threshold = recordThreshold(r.prevRecord);
  const beaten = (r.monthlyTo || 0) >= threshold && (r.monthlyTo || 0) > 0;
  const teamBonus = beaten ? Math.round((r.monthlyTo || 0) * 0.01) : 0;
  return { threshold, beaten, team, teamBonus, bonus: Math.round(teamBonus / team) };
}
function calcQuarterly(q: any) { if (!q.threeOfThree) return 0; return Math.round((q.last3SalarySum || 0) * 0.1); }
function calcSmAll(data: any, ym: string, area: string, teamSize = 1) {
  const daysInMonth = daysInMonthOf(ym);
  const avg3 = data.base.avg3To || 0;
  const autoCategory = categoryOf(avg3);
  const category = data.base.categoryOverride || autoCategory;
  const bracket = planBracket(data.base.planPercent);
  const baseRaw = SM_BASE_TABLE[category][bracket];
  const factor = shiftFactor({ daysInMonth, daysOff: data.base.daysOff, area });
  const baseAdjusted = Math.round(baseRaw * factor);
  const dailyRate = Math.round(baseRaw / Math.max(1, daysInMonth - normDaysOff(area)));
  const mgr = calcManagerBlock(data.manager, baseRaw);
  const bonus = calcBonusBlock(data.bonus, dailyRate, teamSize);
  const ppi = calcPpi(data.ppi, teamSize);
  const record = calcRecord(data.record, teamSize);
  const quarterly = calcQuarterly(data.quarterly);
  const adj = data.adj?.amount || 0;
  const advance = data.adj?.advance || 0;
  const total = baseAdjusted + mgr.subtotal + bonus.subtotal + ppi.bonus + record.bonus + quarterly + adj - advance;
  return { daysInMonth, teamSize: Math.max(1, teamSize || 1), category, autoCategory, bracket, baseRaw, factor, baseAdjusted, dailyRate, mgr, bonus, ppi, record, quarterly, adj, advance, total };
}

// ---------- тексти «Умови» (заповнюються з src/conditions.js) ----------
import { TM_CONDITIONS, SM_CONDITIONS } from "./conditions.ts";

// =========================================================
//  HTTP
// =========================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "no auth" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const svc = createClient(SUPABASE_URL, SERVICE);

  const { data: ures } = await userClient.auth.getUser();
  if (!ures?.user) return json({ error: "unauthorized" }, 401);

  const { data: me } = await userClient.from("cab_map").select("cabinet_key,cabinet_type,tm_key").maybeSingle();
  if (!me) return json({ error: "no cabinet" }, 403);

  const isAdmin = me.cabinet_key === ADMIN_KEY;
  const isManager = me.cabinet_type === "manager" || isAdmin;
  const isAccountant = me.cabinet_type === "accountant";

  async function officeCanConsolidate() {
    if (me.cabinet_type !== "office") return false;
    const { data } = await svc.from("kv").select("value").eq("key", `caps:${me.cabinet_key}`).maybeSingle();
    const caps = Array.isArray(data?.value) ? data!.value : [];
    return caps.includes("view_consolidation");
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const op = body.op;

  const reass = await reassignList(svc);

  // ---- TM ----
  if (op === "tm" || op === "tm-batch") {
    const items = op === "tm" ? [body] : (body.items || []);
    const officeOk = await officeCanConsolidate();
    for (const it of items) {
      const allowed = isManager || isAccountant || officeOk ||
        (me.cabinet_type === "tm" && me.cabinet_key === it.tmKey);
      if (!allowed) return json({ error: "forbidden" }, 403);
    }
    const out = items.map((it: any) => calcTmAll(it.data, it.grade, it.tmKey, it.ym, reass));
    return json(op === "tm" ? out[0] : out);
  }

  // ---- SM ----
  if (op === "sm" || op === "sm-batch") {
    const items = op === "sm" ? [body] : (body.items || []);
    const officeOk = await officeCanConsolidate();
    for (const it of items) {
      const sk = it.salonKey;
      const allowed = isManager || isAccountant || officeOk ||
        me.cabinet_key === sk ||
        (me.cabinet_type === "tm" && salonTmOn(sk, it.ym, reass) === me.cabinet_key);
      if (!allowed) return json({ error: "forbidden" }, 403);
    }
    // розмір команди по кожному салону (активні співробітники) — для командних бонусів
    const salonKeys = [...new Set(items.map((it: any) => it.salonKey).filter(Boolean))];
    const teamBySalon: Record<string, number> = {};
    if (salonKeys.length) {
      const { data: emps } = await svc.from("employees")
        .select("salon_key").eq("status", "active").in("salon_key", salonKeys);
      for (const e of emps || []) teamBySalon[e.salon_key] = (teamBySalon[e.salon_key] || 0) + 1;
    }
    const out = items.map((it: any) => {
      const area = SALONS[it.salonKey]?.area || "область";
      return calcSmAll(it.data, it.ym, area, teamBySalon[it.salonKey] || 1);
    });
    return json(op === "sm" ? out[0] : out);
  }

  // ---- conditions ----
  if (op === "conditions") {
    const canTm = isManager || isAccountant || me.cabinet_type === "tm" || me.cabinet_type === "office";
    return json({ tm: canTm ? TM_CONDITIONS : null, sm: SM_CONDITIONS });
  }

  // ---- meta (лейбли для UI) ----
  if (op === "meta") {
    return json({
      planBrackets: PLAN_BRACKETS,
      smCategories: SM_CATEGORIES.map((c) => ({ key: c.key, note: c.note })),
      managerCoefs: MANAGER_COEF_META,
    });
  }

  return json({ error: "unknown op" }, 400);
});
