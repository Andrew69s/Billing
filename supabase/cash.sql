-- =========================================================
--  Dnipro-M — облік готівки по СМ по днях
--  СМ вносить наторговану готівку за день; незабрані дні сумуються.
--  Віктор бачить «до видачі» по кожному магазину.
--  Виконати в Supabase → SQL Editor (після schema.sql, shifts.sql). Ідемпотентно.
-- =========================================================

-- денна готівка магазину
create table if not exists public.cash_days (
  salon_key    text not null,
  work_date    date not null,
  amount       numeric(12,2) not null default 0,   -- наторгована готівка за день
  collected    boolean not null default false,     -- Віктор забрав
  collected_at timestamptz,
  collected_by text not null default '',
  note         text not null default '',
  updated_by   text not null default '',
  updated_at   timestamptz not null default now(),
  primary key (salon_key, work_date)
);
create index if not exists cash_days_open_idx on public.cash_days (salon_key) where not collected;

-- журнал видач (для аналітики)
create table if not exists public.cash_handovers (
  id          uuid primary key default gen_random_uuid(),
  salon_key   text not null,
  amount      numeric(12,2) not null default 0,
  happened_at timestamptz not null default now(),
  by_cabinet  text not null default '',
  covers_from date,
  covers_to   date,
  note        text not null default ''
);
create index if not exists cash_handovers_salon_idx on public.cash_handovers (salon_key, happened_at desc);

alter table public.cash_days enable row level security;
alter table public.cash_handovers enable row level security;

-- ПЕРЕГЛЯД: керівник/бухгалтер — усе; ТМ — своя територія; СМ — свій магазин
create or replace function public.cash_can_view(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or k = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(k) = public.my_cabinet_key())
  );
$$;
-- РЕДАГУВАННЯ: СМ свій магазин або керівник/адмін (ТМ не редагує касу)
create or replace function public.cash_can_edit(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_manager_or_admin() or k = public.my_cabinet_key()
  );
$$;

drop policy if exists cash_days_select on public.cash_days;
create policy cash_days_select on public.cash_days for select using (public.cash_can_view(salon_key));
drop policy if exists cash_days_write on public.cash_days;
create policy cash_days_write on public.cash_days for all
  using (public.cash_can_edit(salon_key)) with check (public.cash_can_edit(salon_key));

drop policy if exists cash_handovers_select on public.cash_handovers;
create policy cash_handovers_select on public.cash_handovers for select using (public.cash_can_view(salon_key));
drop policy if exists cash_handovers_write on public.cash_handovers;
create policy cash_handovers_write on public.cash_handovers for all
  using (public.cash_can_edit(salon_key)) with check (public.cash_can_edit(salon_key));

-- realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cash_days') then
    alter publication supabase_realtime add table public.cash_days;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cash_handovers') then
    alter publication supabase_realtime add table public.cash_handovers;
  end if;
end $$;

-- =========================================================
--  Видача готівки: позначити всі незабрані дні магазину як забрані
--  + записати в журнал. Повертає забрану суму.
-- =========================================================
create or replace function public.cash_handover(p_salon text, p_by text, p_note text default '')
returns numeric language plpgsql security definer set search_path = public as $$
declare
  s numeric := 0;
  d_from date;
  d_to date;
begin
  if not public.cash_can_edit(p_salon) then
    raise exception 'forbidden';
  end if;
  select coalesce(sum(amount),0), min(work_date), max(work_date)
    into s, d_from, d_to
  from public.cash_days
  where salon_key = p_salon and not collected;

  update public.cash_days
    set collected = true, collected_at = now(), collected_by = p_by, updated_at = now()
  where salon_key = p_salon and not collected;

  if s > 0 then
    insert into public.cash_handovers (salon_key, amount, by_cabinet, covers_from, covers_to, note)
    values (p_salon, s, p_by, d_from, d_to, coalesce(p_note,''));
  end if;
  return s;
end $$;
