-- =========================================================
--  Dnipro-M — модуль «Співробітники» + нагадування про ДН
--  Виконати в Supabase → SQL Editor → Run (після schema.sql, tasks2.sql).
--  Ідемпотентно.
-- =========================================================

create table if not exists public.employees (
  id           uuid primary key default gen_random_uuid(),
  salon_key    text not null,                       -- поточний магазин
  full_name    text not null,
  phone        text not null default '',
  dob          date,                                -- день народження
  hired_at     date,
  role         text not null default 'seller',      -- seller | manager | acting_manager | intern
  status       text not null default 'active',      -- active | fired
  fired_at     date,
  fired_reason text not null default '',
  note         text not null default '',
  history      jsonb not null default '[]'::jsonb,  -- [{at, by, action, ...}]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists employees_salon_idx  on public.employees (salon_key, status);
create index if not exists employees_status_idx on public.employees (status);

alter table public.employees enable row level security;

-- бачити: керівник/адмін/бухгалтер — усе; ТМ — своя територія;
-- салон — свій штат + штат усієї своєї території (для графіка змін)
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm'
        and public.current_salon_tm(salon_key) = public.my_cabinet_key())
    or (public.my_cabinet_type() = 'sm'
        and public.current_salon_tm(salon_key) = public.current_salon_tm(public.my_cabinet_key()))
  )
);

-- прийом/звільнення/переведення: ТМ своєї території або керівник/адмін
drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees for all using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm'
        and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
) with check (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm'
        and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
);

-- realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employees') then
    alter publication supabase_realtime add table public.employees;
  end if;
end $$;

-- =========================================================
--  НАГАДУВАННЯ ПРО ДЕНЬ НАРОДЖЕННЯ (щодня, за 3 дні і в день ДН)
-- =========================================================
create or replace function public.notify_birthdays()
returns void language plpgsql security definer set search_path = public as $$
declare
  e   record;
  cab record;
  bday date;
  d   int;
  msg text;
begin
  for e in
    select id, full_name, dob, salon_key from public.employees
    where status = 'active' and dob is not null
  loop
    begin
      bday := make_date(extract(year from current_date)::int, extract(month from e.dob)::int, extract(day from e.dob)::int);
    exception when others then
      -- напр. 29 лютого в невисокосний рік → 28 лютого
      bday := make_date(extract(year from current_date)::int, extract(month from e.dob)::int, 28);
    end;

    d := bday - current_date;
    if d < 0 or d > 3 then
      continue;
    end if;

    msg := case d
      when 0 then 'У ' || e.full_name || ' сьогодні день народження — привітайте колегу!'
      when 1 then 'У ' || e.full_name || ' день народження завтра'
      else 'У ' || e.full_name || ' день народження через ' || d || ' дні'
    end;

    for cab in select cabinet_key from public.cab_map loop
      -- не дублювати в межах дня
      if not exists (
        select 1 from public.notifications
        where recipient = cab.cabinet_key and kind = 'birthday'
          and title = msg and created_at::date = current_date
      ) then
        insert into public.notifications (recipient, kind, title, body, actor, link)
        values (cab.cabinet_key, 'birthday', msg,
                coalesce((select salon_key from public.employees where id = e.id), ''),
                'system', 'team');
      end if;
    end loop;
  end loop;
end;
$$;

-- pg_cron: щодня о 06:00 UTC (~09:00 Київ)
create extension if not exists pg_cron;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'birthdays-daily') then
    perform cron.unschedule('birthdays-daily');
  end if;
end $$;
select cron.schedule('birthdays-daily', '0 6 * * *', $$select public.notify_birthdays()$$);
