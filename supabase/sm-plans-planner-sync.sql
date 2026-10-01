-- =========================================================
--  План обороту СМ (sm_plans.turnover_plan) — автопідтяжка з планера.
--  Раніше це поле вносив ТМ вручну; тепер planner-sync (Edge Function,
--  pg_cron «planner-sync-daily») пише його сюди сам, разом із territory_plans.
--  Виконати в Supabase → SQL Editor (після sm-plans-turnover-ez.sql, territory.sql).
--  Ідемпотентно.
-- =========================================================

alter table public.sm_plans add column if not exists ez_plan numeric not null default 0;

create or replace function public.smplan_apply_planner(rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into public.sm_plans (salon_key, ym, turnover_plan, ez_plan, updated_by)
    values (r->>'salon_key', r->>'ym', (r->>'turnover_plan')::numeric, coalesce((r->>'ez_plan')::numeric, 0), 'planner')
    on conflict (salon_key, ym) do update
      set turnover_plan = excluded.turnover_plan, ez_plan = excluded.ez_plan, updated_by = 'planner', updated_at = now()
      -- не чіпаємо вже заблокований (виплачений) місяць — locked ставить керівник саме для цього
      where public.sm_plans.locked = false;
    n := n + 1;
  end loop;
  return n;
end $$;
