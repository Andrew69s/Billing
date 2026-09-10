-- =========================================================
--  Графік змін v4 — ручний замок від адміністратора (Шах)
--  Замість автоматичного замку «до 3 числа» — Шах у Адмініструванні
--  вмикає/вимикає замок коригувань графіка кожному СМ окремо.
--  Нагадування «Заблокуйте коригування графіків» — 5 числа місяця.
-- =========================================================

create table if not exists public.schedule_locks (
  salon_key  text primary key,
  locked     boolean not null default false,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.schedule_locks enable row level security;

drop policy if exists sl_select on public.schedule_locks;
create policy sl_select on public.schedule_locks for select using (auth.uid() is not null);

drop policy if exists sl_write on public.schedule_locks;
create policy sl_write on public.schedule_locks for all
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

alter publication supabase_realtime add table public.schedule_locks;

-- ---- Замок на таблиці shifts (без дат) ------------------------------------
create or replace function public.shifts_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  actor  text := coalesce(NEW.updated_by, OLD.updated_by, NEW.salon_key, OLD.salon_key);
  is_locked boolean;
begin
  if public.is_manager_or_admin() then return coalesce(NEW, OLD); end if;
  select l.locked into is_locked from public.schedule_locks l where l.salon_key = actor;
  if coalesce(is_locked, false) then
    raise exception 'schedule_locked';
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists shifts_guard_t on public.shifts;
create trigger shifts_guard_t before insert or update or delete on public.shifts
  for each row execute function public.shifts_guard();

-- ---- Нагадування Шаху 5 числа --------------------------------------------
create or replace function public.notify_schedule_lock_reminder() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (
    select 1 from public.notifications
    where recipient = 'andriy' and kind = 'shifts'
      and title = 'Заблокуйте коригування графіків'
      and created_at > now() - interval '25 days'
  ) then
    insert into public.notifications(recipient, kind, title, body, actor, link)
    values ('andriy', 'shifts', 'Заблокуйте коригування графіків',
            'Новий місяць — час у Адмініструванні заблокувати СМ коригування графіків за минулий місяць.',
            'system', '');
  end if;
end $$;

select cron.unschedule('schedule-lock-reminder')
where exists (select 1 from cron.job where jobname = 'schedule-lock-reminder');
select cron.schedule('schedule-lock-reminder', '0 8 5 * *', 'select public.notify_schedule_lock_reminder()');
