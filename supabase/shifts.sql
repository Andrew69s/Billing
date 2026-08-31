-- =========================================================
--  Dnipro-M — модуль «Графік змін»
--  Виконати в Supabase → SQL Editor (після employees.sql).
--  Ідемпотентно.
-- =========================================================

-- одна зміна = (співробітник, день). salon_key = ДЕ фактично працював.
create table if not exists public.shifts (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  work_date      date not null,
  salon_key      text not null,                     -- магазин, де працював (може ≠ домашній → заміна)
  plan_h         numeric(4,1),                      -- планові години
  fact_h         numeric(4,1),                      -- фактичні (null поки не підтверджено)
  state          text not null default 'work',      -- work | off | absent | closed
  absence_reason text not null default '',          -- vacation | sick | dayoff | noshow | training
  is_senior      boolean not null default false,    -- старший зміни
  note           text not null default '',
  updated_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, work_date)
);
create index if not exists shifts_salon_date_idx on public.shifts (salon_key, work_date);
create index if not exists shifts_emp_idx on public.shifts (employee_id, work_date);

-- відмітка «вхід у зміну» магазину за день
create table if not exists public.store_days (
  salon_key     text not null,
  work_date     date not null,
  opened_at     timestamptz,
  opened_by     text not null default '',
  closed        boolean not null default false,
  closed_reason text not null default '',
  senior_id     uuid,
  updated_at    timestamptz not null default now(),
  primary key (salon_key, work_date)
);

alter table public.shifts enable row level security;
alter table public.store_days enable row level security;

-- helper: чи це магазин моєї території / мій магазин / керівник
create or replace function public.can_touch_salon(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or k = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(k) = public.my_cabinet_key())
  );
$$;

drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select using (public.can_touch_salon(salon_key));
drop policy if exists shifts_write on public.shifts;
create policy shifts_write on public.shifts for all
  using (public.can_touch_salon(salon_key)) with check (public.can_touch_salon(salon_key));

drop policy if exists store_days_select on public.store_days;
create policy store_days_select on public.store_days for select using (public.can_touch_salon(salon_key));
drop policy if exists store_days_write on public.store_days;
create policy store_days_write on public.store_days for all
  using (public.can_touch_salon(salon_key)) with check (public.can_touch_salon(salon_key));

-- realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shifts') then
    alter publication supabase_realtime add table public.shifts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='store_days') then
    alter publication supabase_realtime add table public.store_days;
  end if;
end $$;
