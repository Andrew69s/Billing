-- =========================================================
--  ОБЛІК РУХУ БОНУСІВ (лояльність) — щоденне введення СМ
--  Нараховано / Списано / Нараховано БН (безготівка) по салону на дату.
-- =========================================================
create table if not exists public.bonus_moves (
  salon_key   text not null,
  work_date   date not null,
  accrued     numeric(12,2) not null default 0,  -- Нараховано
  writeoff    numeric(12,2) not null default 0,  -- Списано
  accrued_bn  numeric(12,2) not null default 0,  -- Нараховано БН (безготівка)
  updated_by  text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (salon_key, work_date)
);
create index if not exists bonus_moves_date_idx on public.bonus_moves (work_date);

alter table public.bonus_moves enable row level security;

-- перегляд: керівник/адмін/бухгалтер — усе; ТМ — усе; СМ — усі салони
-- (така сама логіка, як у графіка/показників — can_view_salon)
drop policy if exists bonus_select on public.bonus_moves;
create policy bonus_select on public.bonus_moves for select
  using (public.can_view_salon(salon_key));

-- введення/правки: СМ свій салон, ТМ своя територія, керівник/адмін
drop policy if exists bonus_write on public.bonus_moves;
create policy bonus_write on public.bonus_moves for all
  using (public.can_touch_salon(salon_key))
  with check (public.can_touch_salon(salon_key));

-- realtime (ідемпотентно)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bonus_moves'
  ) then
    alter publication supabase_realtime add table public.bonus_moves;
  end if;
end $$;
