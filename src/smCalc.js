/* =========================================================
   СМ — порожні дані форми + мета-лейбли.
   Розрахунок ЗП (формула, таблиці, коефіцієнти) перенесено на сервер:
   Edge Function «calc» (supabase/functions/calc/index.ts).
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
      coef: "1.0",
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
    adj: { amount: 0, comment: "", advance: 0, official: 0, birthdays: 0 },

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
