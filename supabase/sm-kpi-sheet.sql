-- =========================================================
--  KPI СМ — зведений лист (усі магазини ТМ одним екраном):
--   1) sm_plans: план «зафіксувати» від ТМ (plan_fixed) — окремо від
--      адмінського місячного замка (locked); план/факт долі RRI.
--   2) store_turnover_history: історія для «ТО за 3 місяці» рахувалась
--      НЕПРАВИЛЬНО — віднімала лише ez_confirmed_sum (який взагалі ніхто
--      не писав, завжди 0) і НЕ віднімала чеки Віктора/НРТ. Виправлено на
--      ту саму формулу, що й factAdjusted («основна група»): monthFact −
--      viktorChecks − lowMarginChecks·0.5 − ЕЗ (усі продажі, без фільтра
--      по статусу). Існуючі рядки перераховано.
--  Виконати в Supabase → SQL Editor (після sm-plans-planner-sync.sql).
--  Ідемпотентно.
-- =========================================================

-- ---------- 1. sm_plans: самостійна фіксація плану ТМ + доля RRI ----------
alter table public.sm_plans add column if not exists plan_fixed boolean not null default false;
alter table public.sm_plans add column if not exists rri_plan numeric not null default 0;
alter table public.sm_plans add column if not exists rri_fact numeric not null default 0;

-- planner-sync більше не чіпає план, щойно ТМ сам натиснув «Зафіксувати»
-- (plan_fixed) — окремо від адмінського закриття місяця (locked). На
-- відміну від locked, plan_fixed НЕ блокує подальше редагування порогів/
-- RRI в цьому ж рядку (guard-тригер дивиться лише на locked).
create or replace function public.smplan_apply_planner(rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into public.sm_plans (salon_key, ym, turnover_plan, ez_plan, updated_by)
    values (r->>'salon_key', r->>'ym', (r->>'turnover_plan')::numeric, coalesce((r->>'ez_plan')::numeric, 0), 'planner')
    on conflict (salon_key, ym) do update
      set turnover_plan = excluded.turnover_plan, ez_plan = excluded.ez_plan, updated_by = 'planner', updated_at = now()
      -- не чіпаємо вже заблокований (виплачений) місяць, і не чіпаємо план,
      -- який ТМ сам зафіксував вручну (plan_fixed) — обидва мають пріоритет
      -- над автопідтяжкою з планера.
      where public.sm_plans.locked = false and public.sm_plans.plan_fixed = false;
    n := n + 1;
  end loop;
  return n;
end $$;

-- фіксація плану ТМ: тільки true, тільки на своєму магазині (звичайний
-- UPDATE через RLS sm_plans_write; guard-тригер locked тут не заважає,
-- бо ми не чіпаємо locked) — для розблокування назад потрібен адмін/керівник
-- (прямий UPDATE locked/plan_fixed ними ж, за потреби окремим запитом).
create or replace function public.fix_sm_plan(p_salon_key text, p_ym text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_touch_salon(p_salon_key) then
    raise exception 'forbidden';
  end if;
  update public.sm_plans
    set plan_fixed = true, updated_by = coalesce(public.my_cabinet_key(), updated_by), updated_at = now()
    where salon_key = p_salon_key and ym = p_ym and locked = false;
end $$;
grant execute on function public.fix_sm_plan(text, text) to authenticated;

-- ---------- 2. store_turnover_history: правильна формула «основної групи» ----------
alter table public.store_turnover_history add column if not exists viktor_checks numeric not null default 0;
alter table public.store_turnover_history add column if not exists low_margin_checks numeric not null default 0;
alter table public.store_turnover_history add column if not exists ez_sum_total numeric not null default 0;

alter table public.store_turnover_history drop column if exists turnover_ex_ez;
alter table public.store_turnover_history add column turnover_ex_ez numeric
  generated always as (greatest(0, month_fact - viktor_checks - low_margin_checks * 0.5 - ez_sum_total)) stored;

-- старий ez_confirmed_sum ніхто фактично не писав (мертвий RPC) — прибираємо
alter table public.store_turnover_history drop column if exists ez_confirmed_sum;

drop function if exists public.upsert_turnover_ez_sum(text, text, numeric);
drop function if exists public.upsert_turnover_month_fact(text, text, numeric);

create or replace function public.upsert_turnover_fact(
  p_salon_key text, p_ym text, p_month_fact numeric,
  p_viktor_checks numeric default 0, p_low_margin_checks numeric default 0
)
returns void language plpgsql security definer set search_path = public as $$
declare v_ez numeric;
begin
  if not public.can_touch_salon(p_salon_key) then
    raise exception 'forbidden';
  end if;
  -- усі продажі ЕЗ незалежно від статусу — те саме число, що й факт ЕЗ у
  -- шапці ЗП (ez.total / ezTotalSum на сервері calc), а не лише підтверджені
  select coalesce(sum(amount), 0) into v_ez from public.ez_sales
    where salon_key = p_salon_key and ym = p_ym;
  insert into public.store_turnover_history
    (salon_key, ym, month_fact, viktor_checks, low_margin_checks, ez_sum_total, updated_by, updated_at)
  values (p_salon_key, p_ym, p_month_fact, p_viktor_checks, p_low_margin_checks, v_ez, coalesce(public.my_cabinet_key(), ''), now())
  on conflict (salon_key, ym) do update
    set month_fact = excluded.month_fact, viktor_checks = excluded.viktor_checks,
        low_margin_checks = excluded.low_margin_checks, ez_sum_total = excluded.ez_sum_total,
        updated_by = excluded.updated_by, updated_at = now();
end $$;
grant execute on function public.upsert_turnover_fact(text, text, numeric, numeric, numeric) to authenticated;

-- лише освіжити суму ЕЗ на вже існуючому рядку історії (викликається після
-- підтвердження/редагування/видалення продажу ЕЗ — на відміну від старого
-- upsert_turnover_ez_sum, рахує УСІ продажі незалежно від статусу, як і
-- factAdjusted; якщо рядка за цей місяць ще нема — нічого не робить, його
-- створить перший upsert_turnover_fact)
create or replace function public.refresh_turnover_ez(p_salon_key text, p_ym text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_touch_salon(p_salon_key) then
    raise exception 'forbidden';
  end if;
  update public.store_turnover_history
    set ez_sum_total = (select coalesce(sum(amount), 0) from public.ez_sales where salon_key = p_salon_key and ym = p_ym),
        updated_at = now()
    where salon_key = p_salon_key and ym = p_ym;
end $$;
grant execute on function public.refresh_turnover_ez(text, text) to authenticated;

-- ---------- 3. перерахунок уже записаної історії за правильною формулою ----------
-- для кожного (salon_key, ym) беремо один узгоджений документ (по одному
-- співробітнику магазину — monthFact/viktorChecks/lowMarginChecks спільні
-- для всіх, як у шапці ЗП), а не max() по кожному стовпцю окремо (щоб не
-- зліпити докупи поля з різних документів, якщо вони колись розійшлись)
with latest_doc as (
  select
    split_part(key, ':', 2) as salon_key,
    split_part(key, ':', 4) as ym,
    coalesce((value->'base'->>'monthFact')::numeric, 0) as month_fact,
    coalesce((value->'base'->>'viktorChecks')::numeric, 0) as viktor_checks,
    coalesce((value->'base'->>'lowMarginChecks')::numeric, 0) as low_margin_checks,
    row_number() over (
      partition by split_part(key, ':', 2), split_part(key, ':', 4)
      order by (value->>'submittedAt') desc nulls last, key desc
    ) as rn
  from public.kv
  where key like 'smdata:%' and value->>'status' in ('submitted', 'corrected')
),
ez_by_month as (
  select salon_key, ym, sum(amount) as ez_sum_total from public.ez_sales group by salon_key, ym
)
insert into public.store_turnover_history (salon_key, ym, month_fact, viktor_checks, low_margin_checks, ez_sum_total, updated_by)
select d.salon_key, d.ym, d.month_fact, d.viktor_checks, d.low_margin_checks, coalesce(e.ez_sum_total, 0), 'backfill-fix'
from latest_doc d
left join ez_by_month e on e.salon_key = d.salon_key and e.ym = d.ym
where d.rn = 1 and d.month_fact > 0
on conflict (salon_key, ym) do update
  set month_fact = excluded.month_fact, viktor_checks = excluded.viktor_checks,
      low_margin_checks = excluded.low_margin_checks, ez_sum_total = excluded.ez_sum_total,
      updated_by = excluded.updated_by, updated_at = now();

-- салони/місяці, де ЕЗ з'явився пізніше (вже є рядок історії, але суму ЕЗ
-- тоді ще не додали) — підтягуємо суму ЕЗ окремо, не чіпаючи інші поля
update public.store_turnover_history t
set ez_sum_total = e.total, updated_at = now()
from (select salon_key, ym, sum(amount) as total from public.ez_sales group by salon_key, ym) e
where t.salon_key = e.salon_key and t.ym = e.ym and t.ez_sum_total is distinct from e.total;
