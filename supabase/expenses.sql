-- =========================================================
--  Dnipro-M — витрати магазину, що вносяться вручну
--  Доповнюють авто-витрати зі складу (акти списання за статтями expense:true),
--  які модуль «Витрати по СМ» рахував досі як єдине джерело.
--  Виконати в Supabase → SQL Editor → Run (після schema.sql, shifts.sql).
--  Ідемпотентно.
-- =========================================================

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  salon_key    text not null,                      -- чия витрата
  spent_on     date not null,                      -- дата самої витрати, не внесення
  category     text not null default 'other',      -- ключ категорії (довідник на клієнті)
  title        text not null default '',           -- «що саме»
  amount       numeric(12,2) not null default 0,
  receipt_path text not null default '',           -- шлях у Storage-бакеті, НЕ base64
  created_by   text not null default '',           -- кабінет, що вніс (СМ, або ТМ/керівник за магазин)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists expenses_salon_idx on public.expenses (salon_key, spent_on desc);
create index if not exists expenses_date_idx  on public.expenses (spent_on desc);

alter table public.expenses enable row level security;

-- Область видимості та редагування збігається з рештою модулів магазину:
-- керівник/адмін/бухгалтер — усе, ТМ — своя територія, СМ — свій магазин.
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select
  using (public.can_touch_salon(salon_key));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert
  with check (public.can_touch_salon(salon_key));

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update
  using (public.can_touch_salon(salon_key))
  with check (public.can_touch_salon(salon_key));

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete
  using (public.can_touch_salon(salon_key));

-- автора й час проставляє сервер
create or replace function public.expenses_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := coalesce(public.my_cabinet_key(), '');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_expenses_stamp on public.expenses;
create trigger trg_expenses_stamp before insert or update on public.expenses
  for each row execute function public.expenses_stamp();

-- ---------- сховище чеків ----------
-- Приватний бакет: фото лежить файлом, у рядку — лише шлях. Так чек не роздуває
-- базу і не тягнеться щоразу зі списком (на відміну від base64-скрінів рахунків).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Ключ файлу: <salon_key>/<uuid>.jpg — перший сегмент вирішує доступ.
drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select
  using (bucket_id = 'receipts' and public.can_touch_salon((storage.foldername(name))[1]));

drop policy if exists receipts_write on storage.objects;
create policy receipts_write on storage.objects for insert
  with check (bucket_id = 'receipts' and public.can_touch_salon((storage.foldername(name))[1]));

drop policy if exists receipts_remove on storage.objects;
create policy receipts_remove on storage.objects for delete
  using (bucket_id = 'receipts' and public.can_touch_salon((storage.foldername(name))[1]));
