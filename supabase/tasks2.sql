-- =========================================================
--  Dnipro-M — модуль «Задачі» v2 + «Сповіщення»
--  Виконати в Supabase → SQL Editor → Run (після schema.sql і tasks.sql).
--  Ідемпотентно — можна запускати повторно.
-- =========================================================

-- ---------- helpers ----------

-- тип кабінету за ключем
create or replace function public.cab_type_of(k text)
returns text language sql stable security definer set search_path = public as $$
  select cabinet_type from public.cab_map where cabinet_key = k limit 1;
$$;

-- поточний ТМ салону з урахуванням перепризначень (kv['reassign:list'])
create or replace function public.current_salon_tm(salon_key text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  base   text;
  reass  jsonb;
  best   text;
  best_from text := '';
  rec    jsonb;
begin
  base := public.salon_base_tm(salon_key);
  if base is null then
    return null;
  end if;

  select value into reass from public.kv where key = 'reassign:list';
  if reass is null then
    return base;
  end if;

  best := base;
  for rec in select * from jsonb_array_elements(reass) loop
    if rec->>'salonKey' = salon_key
       and coalesce(rec->>'fromYm','') <= to_char(now(),'YYYY-MM')
       and coalesce(rec->>'fromYm','') >= best_from then
      best := rec->>'toTm';
      best_from := coalesce(rec->>'fromYm','');
    end if;
  end loop;

  return best;
end;
$$;

-- ---------- tasks: нові колонки ----------
alter table public.tasks add column if not exists priority boolean not null default false;
alter table public.tasks add column if not exists seen     jsonb   not null default '{}'::jsonb;

-- ---------- tasks: RLS v2 ----------
-- бачити задачу можуть ЛИШЕ постановник і виконавець
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  auth.uid() is not null and (
    created_by = public.my_cabinet_key()
    or assignee = public.my_cabinet_key()
  )
);

-- ставити задачу — за матрицею підпорядкування
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (
  auth.uid() is not null
  and created_by = public.my_cabinet_key()
  and case public.my_cabinet_type()
        when 'manager'    then true
        when 'accountant' then true
        when 'office'     then true
        when 'tm' then
          public.cab_type_of(assignee) <> 'sm'
          or public.current_salon_tm(assignee) = public.my_cabinet_key()
        when 'sm' then
          public.cab_type_of(assignee) in ('sm','office','accountant')
          or assignee = public.current_salon_tm(public.my_cabinet_key())
        else false
      end
);

-- змінювати статус/seen — постановник або виконавець
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (
  auth.uid() is not null and (
    created_by = public.my_cabinet_key()
    or assignee = public.my_cabinet_key()
  )
);

-- видаляти — лише постановник
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete using (
  auth.uid() is not null and created_by = public.my_cabinet_key()
);

-- =========================================================
--  СПОВІЩЕННЯ
-- =========================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  recipient  text not null,                    -- cabinet_key одержувача
  kind       text not null default 'info',     -- task_new | task_status | salary | info
  title      text not null,
  body       text not null default '',
  actor      text not null default '',         -- cabinet_key ініціатора
  link       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_recipient_idx on public.notifications (recipient, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select using (
  auth.uid() is not null and recipient = public.my_cabinet_key()
);

drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (
  auth.uid() is not null and recipient = public.my_cabinet_key()
);

-- вставку сповіщень роблять тригери (security definer) та клієнт (авто-події ЗП)
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert with check (auth.uid() is not null);

-- одержувач може видаляти свої сповіщення
drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications for delete using (
  auth.uid() is not null and recipient = public.my_cabinet_key()
);

-- ---------- тригери задач → сповіщення ----------
create or replace function public.notify_task_new()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient, kind, title, body, actor, link)
  values (new.assignee, 'task_new',
          'Нова задача: ' || new.title,
          coalesce(nullif(new.description,''), ''),
          new.created_by, 'tasks');
  return new;
end;
$$;
drop trigger if exists trg_notify_task_new on public.tasks;
create trigger trg_notify_task_new after insert on public.tasks
  for each row execute function public.notify_task_new();

create or replace function public.notify_task_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (recipient, kind, title, body, actor, link)
    values (new.created_by, 'task_status',
            case new.status
              when 'in_progress' then 'Взято в роботу: ' || new.title
              when 'done'        then 'Задачу виконано: ' || new.title
              else 'Задача повернута: ' || new.title
            end,
            coalesce(nullif(new.comment,''), ''),
            new.assignee, 'tasks');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_task_status on public.tasks;
create trigger trg_notify_task_status after update on public.tasks
  for each row execute function public.notify_task_status();

-- realtime (ідемпотентно)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- =========================================================
--  kv_select: видимість smdata за поточним ТМ (перепризначення)
-- =========================================================
drop policy if exists kv_select on public.kv;
create policy kv_select on public.kv for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() in ('accountant','office')
    or key like 'reassign:%'
    or (key like 'data:'   || public.my_cabinet_key() || ':%')
    or (key like 'adj:'    || public.my_cabinet_key() || ':%')
    or (key like 'grade:'  || public.my_cabinet_key() || ':%')
    or (key like 'qbonus:' || public.my_cabinet_key() || ':%')
    or (key like 'smdata:' || public.my_cabinet_key() || ':%')
    or (
      public.my_cabinet_type() = 'tm'
      and key like 'smdata:%'
      and public.current_salon_tm(split_part(key, ':', 2)) = public.my_cabinet_key()
    )
  )
);
