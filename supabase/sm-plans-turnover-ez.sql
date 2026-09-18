-- =========================================================
--  Планування показників СМ + автокатегоризація + продажі ЕЗ
--  (детальний контекст: /Users/andriyshakh/.claude/plans/indexed-discovering-wreath.md)
-- =========================================================

-- ---------- 1. План ТМ на місяць (оборот + пороги чека) ----------
create table if not exists public.sm_plans (
  salon_key text not null,
  ym text not null,
  turnover_plan numeric not null default 0,
  avg_check_t1 numeric not null default 0,
  avg_check_t2 numeric not null default 0,
  avg_check_t3 numeric not null default 0,
  check_len_t1 numeric not null default 0,
  check_len_t2 numeric not null default 0,
  check_len_t3 numeric not null default 0,
  locked boolean not null default false,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  primary key (salon_key, ym)
);
alter table public.sm_plans enable row level security;

drop policy if exists sm_plans_select on public.sm_plans;
create policy sm_plans_select on public.sm_plans for select using (public.can_touch_salon(salon_key));

drop policy if exists sm_plans_write on public.sm_plans;
create policy sm_plans_write on public.sm_plans for all
  using (
    auth.uid() is not null and (
      public.is_manager_or_admin()
      or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
    )
  )
  with check (
    auth.uid() is not null and (
      public.is_manager_or_admin()
      or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
    )
  );

-- замок: адмін/керівник завжди можуть; ТМ — лише поки locked=false, і сам locked=true виставити не може
create or replace function public.sm_plans_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_manager_or_admin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and old.locked then
    raise exception 'plan_locked';
  end if;
  if new.locked then
    raise exception 'plan_locked';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists sm_plans_guard_trg on public.sm_plans;
create trigger sm_plans_guard_trg
  before insert or update on public.sm_plans
  for each row execute function public.sm_plans_guard();

-- ---------- 2. Історія реального обороту (для авто-категоризації) ----------
create table if not exists public.store_turnover_history (
  salon_key text not null,
  ym text not null,
  month_fact numeric not null default 0,
  ez_confirmed_sum numeric not null default 0,
  turnover_ex_ez numeric generated always as (month_fact - ez_confirmed_sum) stored,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  primary key (salon_key, ym)
);
alter table public.store_turnover_history enable row level security;

drop policy if exists sth_select on public.store_turnover_history;
create policy sth_select on public.store_turnover_history for select using (public.can_touch_salon(salon_key));
-- запис лише через SECURITY DEFINER функції нижче — прямого INSERT/UPDATE policy немає навмисно

create or replace function public.upsert_turnover_month_fact(p_salon_key text, p_ym text, p_month_fact numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.can_touch_salon(p_salon_key) then
    raise exception 'forbidden';
  end if;
  insert into public.store_turnover_history (salon_key, ym, month_fact, updated_by, updated_at)
  values (p_salon_key, p_ym, p_month_fact, coalesce(public.my_cabinet_key(), ''), now())
  on conflict (salon_key, ym) do update
    set month_fact = excluded.month_fact, updated_by = excluded.updated_by, updated_at = now();
end $$;
grant execute on function public.upsert_turnover_month_fact(text, text, numeric) to authenticated;

create or replace function public.upsert_turnover_ez_sum(p_salon_key text, p_ym text, p_ez_sum numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.can_touch_salon(p_salon_key) then
    raise exception 'forbidden';
  end if;
  insert into public.store_turnover_history (salon_key, ym, ez_confirmed_sum, updated_by, updated_at)
  values (p_salon_key, p_ym, p_ez_sum, coalesce(public.my_cabinet_key(), ''), now())
  on conflict (salon_key, ym) do update
    set ez_confirmed_sum = excluded.ez_confirmed_sum, updated_by = excluded.updated_by, updated_at = now();
end $$;
grant execute on function public.upsert_turnover_ez_sum(text, text, numeric) to authenticated;

-- бекфіл: наповнюємо історію з уже поданих форм ЗП СМ (kv smdata:*), щоб авто-категоризація
-- запрацювала одразу, а не з нуля. monthFact однаковий для всіх співробітників салону за той
-- місяць — беремо будь-який (max).
insert into public.store_turnover_history (salon_key, ym, month_fact, updated_by)
select salon_key, ym, max(month_fact) as month_fact, 'backfill'
from (
  select
    split_part(key, ':', 2) as salon_key,
    split_part(key, ':', 4) as ym,
    coalesce((value->'base'->>'monthFact')::numeric, 0) as month_fact,
    value->>'status' as status
  from public.kv
  where key like 'smdata:%'
) s
where status in ('submitted', 'corrected') and month_fact > 0
group by salon_key, ym
on conflict (salon_key, ym) do nothing;

-- ---------- 3. Продажі ЕЗ (генератори/електроінструмент) по магазину ----------
create table if not exists public.ez_sales (
  id uuid primary key default gen_random_uuid(),
  salon_key text not null,
  ym text not null,
  nomenclature text not null default '',
  article text not null default '',
  order_no text not null default '',
  amount numeric not null,
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'installment')),
  np_delivery_paid boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  cost_price numeric,
  extra_costs numeric,
  net_profit numeric,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  processed_by text,
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ez_sales enable row level security;

drop policy if exists ez_sales_select on public.ez_sales;
create policy ez_sales_select on public.ez_sales for select using (public.can_touch_salon(salon_key));

drop policy if exists ez_sales_insert on public.ez_sales;
create policy ez_sales_insert on public.ez_sales for insert
  with check (
    auth.uid() is not null and (salon_key = public.my_cabinet_key() or public.is_manager_or_admin())
  );

drop policy if exists ez_sales_update on public.ez_sales;
create policy ez_sales_update on public.ez_sales for update
  using (
    auth.uid() is not null and (
      public.is_manager_or_admin()
      or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
    )
  );

drop policy if exists ez_sales_delete on public.ez_sales;
create policy ez_sales_delete on public.ez_sales for delete
  using (
    auth.uid() is not null and (
      public.is_manager_or_admin()
      or (salon_key = public.my_cabinet_key() and status = 'pending')
    )
  );

-- ---------- realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sm_plans') then
    alter publication supabase_realtime add table public.sm_plans;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='store_turnover_history') then
    alter publication supabase_realtime add table public.store_turnover_history;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ez_sales') then
    alter publication supabase_realtime add table public.ez_sales;
  end if;
end $$;
