/* =========================================================
   РОЗРАХУНОК ЗП САЛОНУ МАЙСТЕРНОСТІ (СМ)
   Джерело: скріншоти «Мотивація СМ» (актуальна командна мотивація).
   Логіка ТМ тут НЕ використовується і не змінюється.
========================================================= */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const daysInMonthOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

/* ---------- 1. Основна частина за виконання плану ---------- */
/* Категорія салону — відносно середнього ТО за останні 3 місяці */
export const SM_CATEGORIES = [
  { key: "A+", min: 1_800_000, note: "від 1.8 млн" },
  { key: "A",  min: 1_300_000, note: "1.3 – 1.8 млн" },
  { key: "B",  min: 800_000,   note: "800 тис – 1.3 млн" },
  { key: "C",  min: 0,         note: "до 800 тис" },
];
export function categoryOf(avg3To) {
  return (SM_CATEGORIES.find((c) => (avg3To || 0) >= c.min) || SM_CATEGORIES[3]).key;
}

/* Брекети: 0:<90%  1:90–100%  2:100–110%  3:110–120%  4:120%+ */
export const PLAN_BRACKETS = ["до 90%", "90–100%", "100–110%", "110–120%", "120%+"];
export function planBracket(pct) {
  const p = pct || 0;
  if (p < 90) return 0;
  if (p < 100) return 1;
  if (p < 110) return 2;
  if (p < 120) return 3;
  return 4;
}

/* [категорія][брекет] */
export const SM_BASE_TABLE = {
  "A+": [24000, 27000, 30000, 33000, 36000],
  "A":  [22000, 24000, 27000, 30000, 33000],
  "B":  [20000, 22000, 24000, 27000, 30000],
  "C":  [18000, 20000, 22000, 25000, 28000],
};

export function normDaysOff(area) {
  return area === "місто" ? 10 : 9;
}

/* Бонусна частина коригується по відпрацьованих змінах.
   Норма змін = дні місяця − норма вихідних. Переробіток базу не збільшує
   (за нього — окремий бонус «заміна на іншому магазині»). */
export function shiftFactor({ daysInMonth, daysOff, area }) {
  const normWorked = Math.max(1, daysInMonth - normDaysOff(area));
  const worked = clamp((daysInMonth || 0) - (daysOff || 0), 0, daysInMonth || 0);
  return clamp(worked / normWorked, 0, 1);
}

/* ---------- 2. Мотивація керуючого ---------- */
export const MANAGER_COEFS = [
  { key: "1.2", value: 1.2, label: "Керуючий (1.2)" },
  { key: "1.1", value: 1.1, label: "В.О. керуючого (1.1)" },
  { key: "1.0", value: 1.0, label: "— (без коефіцієнта)" },
];

export function calcManagerBlock(m, baseRate) {
  const attest = m.attestationAll ? 1000 : 0;
  let standards;
  if (m.noRemarks) {
    standards = 2000;
  } else {
    // штраф виявленого та виправленого зауваження не сумується
    const penalty = 200 * (m.remarksFound || 0) + 400 * (m.remarksUnfixed || 0);
    standards = -Math.min(2000, penalty);
  }
  const coef = Number(m.coef || 1);
  // додатковий бонус по коефіцієнту від ставки згідно категоризації
  const coefBonus = Math.round(baseRate * (coef - 1));
  return { attest, standards, coefBonus, subtotal: attest + standards + coefBonus };
}

/* ---------- 3. Бонусна частина ---------- */
function tierBonus(value, thresholds, bonuses) {
  const v = value || 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (thresholds[i] && v >= thresholds[i]) return bonuses[i];
  }
  return 0;
}

export function calcBonusBlock(b, dailyRate) {
  // Додаткова командна мотивація за обіг з дзвінків.
  // План по обороту з дзвінків = 10% від загального плану по ТО на місяць.
  let callsPct = 0;
  if (b.callsCountDone && b.callsRevenueDone) callsPct = 5;
  else if (b.callsCountDone) callsPct = 3;
  const callsPlanRevenue = (b.monthlyToPlan || 0) * 0.1;
  const calls = Math.round((b.callsRevenue || 0) * (callsPct / 100));

  // Заміна на іншому магазині: за 1 день 20% до денної ставки на своєму магазині
  const replacement = Math.round((b.replacementDays || 0) * 0.2 * (dailyRate || 0));

  // Середній чек / довжина чека — пороги (N) на місяць надає ТМ
  const avgCheck = tierBonus(b.avgCheckFact, [b.scN1, b.scN2, b.scN3], [700, 1500, 2000]);
  const checkLen = tierBonus(b.checkLenFact, [b.clN1, b.clN2, b.clN3], [700, 1500, 2000]);

  // Атестація: 500 грн при проходженні від 98% середньо-місячних курсів
  const courses = b.coursesOk ? 500 : 0;

  // Продажі із сайту через НП / продаж по БН — 4% на команду
  const siteNp = Math.round((b.siteNpRevenue || 0) * 0.04);
  const bn = Math.round((b.bnRevenue || 0) * 0.04);

  return {
    callsPct, callsPlanRevenue, calls, replacement, avgCheck, checkLen, courses, siteNp, bn,
    subtotal: calls + replacement + avgCheck + checkLen + courses + siteNp + bn,
  };
}

/* ---------- 4. Продаж PPI ---------- */
export function calcPpi(p) {
  const pct = p.planClosed ? 3 : 1;
  return { pct, bonus: Math.round((p.ppiRevenue || 0) * (pct / 100)) };
}

/* ---------- 5. Бонус за рекордні показники ---------- */
export function recordThreshold(prevRecord) {
  // мінімальна планка від 1 млн; наступний рекорд — крок 10% від попереднього
  return Math.max(1_000_000, Math.round((prevRecord || 0) * 1.1));
}
export function calcRecord(r) {
  const threshold = recordThreshold(r.prevRecord);
  const beaten = (r.monthlyTo || 0) >= threshold && (r.monthlyTo || 0) > 0;
  return { threshold, beaten, bonus: beaten ? Math.round((r.monthlyTo || 0) * 0.01) : 0 };
}

/* ---------- 5. Квартальна премія ---------- */
export function calcQuarterly(q) {
  // 10% від суми трьох останніх ЗП, якщо 3/3 місяці план по обороту закрито
  if (!q.threeOfThree) return 0;
  return Math.round((q.last3SalarySum || 0) * 0.1);
}

/* =========================================================
   ЗВЕДЕНИЙ РОЗРАХУНОК
========================================================= */
export function calcSmAll(data, ctx) {
  const { ym, area } = ctx;
  const daysInMonth = daysInMonthOf(ym);

  const avg3 = data.base.avg3To || 0;
  const category = data.base.categoryOverride || categoryOf(avg3);
  const bracket = planBracket(data.base.planPercent);
  const baseRaw = SM_BASE_TABLE[category][bracket];

  const factor = shiftFactor({ daysInMonth, daysOff: data.base.daysOff, area });
  const baseAdjusted = Math.round(baseRaw * factor);
  const dailyRate = Math.round(baseRaw / Math.max(1, daysInMonth - normDaysOff(area)));

  const mgr = calcManagerBlock(data.manager, baseRaw);
  const bonus = calcBonusBlock(data.bonus, dailyRate);
  const ppi = calcPpi(data.ppi);
  const record = calcRecord(data.record);
  const quarterly = calcQuarterly(data.quarterly);

  const adj = data.adj?.amount || 0;
  const advance = data.adj?.advance || 0;

  const total =
    baseAdjusted + mgr.subtotal + bonus.subtotal + ppi.bonus + record.bonus + quarterly + adj - advance;

  return {
    daysInMonth, category, bracket, baseRaw, factor, baseAdjusted, dailyRate,
    mgr, bonus, ppi, record, quarterly, adj, advance, total,
  };
}

/* =========================================================
   ПОРОЖНІ ДАНІ + МЕТА
========================================================= */
export function emptySmData() {
  return {
    base: {
      avg3To: 0,
      categoryOverride: "", // "" → авто за avg3To
      planPercent: 0,
      daysOff: 0,
    },
    manager: {
      attestationAll: false,
      noRemarks: false,
      remarksFound: 0,
      remarksUnfixed: 0,
      coef: 1,
    },
    bonus: {
      monthlyToPlan: 0,
      callsCountDone: false,
      callsRevenueDone: false,
      callsRevenue: 0,
      replacementDays: 0,
      avgCheckFact: 0, scN1: 0, scN2: 0, scN3: 0,
      checkLenFact: 0, clN1: 0, clN2: 0, clN3: 0,
      coursesOk: false,
      siteNpRevenue: 0,
      bnRevenue: 0,
    },
    ppi: { ppiRevenue: 0, planClosed: false },
    record: { monthlyTo: 0, prevRecord: 0 },
    quarterly: { threeOfThree: false, last3SalarySum: 0 },
    adj: { amount: 0, comment: "", advance: 0 },

    screenshots: {},
    submittedAt: null,
    status: "draft", // draft | submitted | corrected
    smSnapshot: null,
    tmComment: "",
    correctionDiff: [],
    correctedAt: null,
    smReplyComment: "",
    smRepliedAt: null,
    tmApproved: false, // ТМ підтвердив і передав керівнику
    tmApprovedAt: null,
    paymentStatus: "none", // none | to_pay | paid
    paymentStatusAt: null,
  };
}

export const SM_FIELD_LABELS = {
  "base.avg3To": "Середній ТО за 3 міс",
  "base.categoryOverride": "Категорія (ручна)",
  "base.planPercent": "% виконання плану ТО",
  "base.daysOff": "Вихідних за місяць",
  "manager.attestationAll": "Атестація всіма ≥ 98%",
  "manager.noRemarks": "Без зауважень по стандартах",
  "manager.remarksFound": "Виявлені зауваження",
  "manager.remarksUnfixed": "Невиправлені зауваження",
  "manager.coef": "Коефіцієнт керуючого",
  "bonus.monthlyToPlan": "Загальний план ТО на місяць",
  "bonus.callsCountDone": "Виконано кількість дзвінків",
  "bonus.callsRevenueDone": "Виконано оборот з дзвінків",
  "bonus.callsRevenue": "Факт. оборот з дзвінків",
  "bonus.replacementDays": "Днів заміни на іншому магазині",
  "bonus.avgCheckFact": "Факт. середній чек",
  "bonus.checkLenFact": "Факт. довжина чека",
  "bonus.coursesOk": "Курси ≥ 98% без перепризначення",
  "bonus.siteNpRevenue": "Продажі із сайту через НП",
  "bonus.bnRevenue": "Продаж по БН",
  "ppi.ppiRevenue": "Оборот по категорії PPI",
  "ppi.planClosed": "План PPI закрито",
  "record.monthlyTo": "Оборот ТО за місяць (команда)",
  "record.prevRecord": "Попередній рекорд ТО",
  "quarterly.threeOfThree": "3/3 місяці план закрито",
  "quarterly.last3SalarySum": "Сума 3 останніх ЗП",
};
