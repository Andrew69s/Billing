-- =========================================================
--  Рух бонусів — зафіксована помісячна аналітика по кожному СМ
--  Дозволяє «заморозити» місяць (щоденні зміни більше не впливають на
--  показник) та вносити історичні місяці, де щоденних даних немає.
-- =========================================================
create table if not exists public.bonus_monthly (
  salon_key  text not null,
  ym         text not null,                 -- 'YYYY-MM'
  net        numeric not null default 0,     -- (Нараховано + БН) − Списано
  accrued    numeric not null default 0,
  writeoff   numeric not null default 0,
  accrued_bn numeric not null default 0,
  frozen     boolean not null default true,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  primary key (salon_key, ym)
);
alter table public.bonus_monthly enable row level security;

drop policy if exists bm_select on public.bonus_monthly;
create policy bm_select on public.bonus_monthly for select using (public.can_view_salon(salon_key));

drop policy if exists bm_write on public.bonus_monthly;
create policy bm_write on public.bonus_monthly for all
  using (public.can_touch_salon(salon_key))
  with check (public.can_touch_salon(salon_key));

alter publication supabase_realtime add table public.bonus_monthly;
