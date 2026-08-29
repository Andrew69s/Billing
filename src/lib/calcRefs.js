import { getConditions, getCalcMeta } from "./calc.js";

/* Тексти «Умови» та лейбли (брекети/категорії/коефіцієнти) — з сервера.
   Вантажимо один раз після входу; компоненти читають синхронно. */
let _conditions = null; // { tm: {...}|null, sm: {...} }
let _meta = null;       // { planBrackets, smCategories, managerCoefs }
let _loading = null;

export async function loadCalcRefs(force = false) {
  if (_loading && !force) return _loading;
  _loading = (async () => {
    try {
      const [c, m] = await Promise.all([getConditions(), getCalcMeta()]);
      _conditions = c;
      _meta = m;
    } catch (e) {
      console.error("calcRefs:", e.message);
    }
    return { conditions: _conditions, meta: _meta };
  })();
  return _loading;
}

export const tmCond = (num) => _conditions?.tm?.[num] || null;
export const smCond = (num) => _conditions?.sm?.[num] || null;

export const planBracketLabel = (i) => _meta?.planBrackets?.[i] ?? `брекет ${i}`;
export const smCategoryOptions = () => _meta?.smCategories || [];
export const managerCoefOptions = () => _meta?.managerCoefs || [];
