-- =========================================================
--  Hto не бере участь у командних бонусах/ЕЗ цього місяця
--  (стажери тощо) — за замовчуванням усі активні діляться порівну,
--  тут лише ВИНЯТКИ. Керуючий вмикає/вимикає шестернею в розрахунку ЗП.
--  Виконати в Supabase → SQL Editor → Run (після schema.sql, employees.sql).
--  Ідемпотентно.
-- =========================================================

create table if not exists public.bonus_team_exclude (
  salon_key   text not null,
  ym          text not null,                 -- 'YYYY-MM'
  employee_id uuid not null,
  updated_by  text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (salon_key, ym, employee_id)
);
create index if not exists bte_salon_ym_idx on public.bonus_team_exclude (salon_key, ym);

alter table public.bonus_team_exclude enable row level security;

drop policy if exists bte_select on public.bonus_team_exclude;
create policy bte_select on public.bonus_team_exclude for select
  using (public.can_touch_salon(salon_key));

drop policy if exists bte_write on public.bonus_team_exclude;
create policy bte_write on public.bonus_team_exclude for all
  using (public.can_touch_salon(salon_key))
  with check (public.can_touch_salon(salon_key));

-- автора проставляє сервер, не клієнт
create or replace function public.bonus_team_exclude_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := coalesce(public.my_cabinet_key(), '');
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_bte_stamp on public.bonus_team_exclude;
create trigger trg_bte_stamp before insert or update on public.bonus_team_exclude
  for each row execute function public.bonus_team_exclude_stamp();

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bonus_team_exclude'
  ) then
    alter publication supabase_realtime add table public.bonus_team_exclude;
  end if;
end $$;
