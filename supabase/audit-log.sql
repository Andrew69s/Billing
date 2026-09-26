-- =========================================================
--  Dnipro-M — журнал дій: окрема append-only таблиця
--  Виконати в Supabase → SQL Editor → Run (після schema.sql).
--  Ідемпотентно.
--
--  Було: один ключ kv:auditlog з масивом JSON. Політики kv давали
--  `key = 'auditlog'` у `for all` — тобто БУДЬ-ЯКИЙ автентифікований кабінет
--  міг прочитати весь журнал і стерти його цілком одним запитом.
--  Стало: дописувати може кожен, читати — лише керівник/адмін,
--  правити й видаляти — ніхто (політик update/delete немає взагалі).
-- =========================================================

create table if not exists public.audit_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text not null default '',            -- кабінет, що виконав дію (ставить сервер, не клієнт)
  user_id uuid default auth.uid(),
  action  text not null,
  detail  jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;

-- Автора підставляє сервер, щоб кабінет не міг записати дію від чужого імені.
-- Під час міграції/сервісних вставок auth.uid() порожній — тоді поля лишаємо
-- як передані, інакше втратили б оригінальні дати старих записів.
create or replace function public.audit_log_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.actor   := coalesce(public.my_cabinet_key(), '');
    new.user_id := auth.uid();
    new.at      := now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_audit_log_stamp on public.audit_log;
create trigger trg_audit_log_stamp before insert on public.audit_log
  for each row execute function public.audit_log_stamp();

-- дописувати — будь-який автентифікований кабінет
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert
  with check (auth.uid() is not null);

-- читати — лише керівник/адмін
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select
  using (public.is_manager_or_admin());

-- update / delete: політик немає → заборонено всім ролям, крім service_role.
-- Якщо колись лишились із попередніх версій — прибираємо.
drop policy if exists audit_log_update on public.audit_log;
drop policy if exists audit_log_delete on public.audit_log;

-- ---------- перенесення старого журналу з kv ----------
-- Дати зберігаємо (тригер їх не чіпає, бо auth.uid() тут порожній).
-- Автор невідомий: у старому форматі поля «хто» не було взагалі.
insert into public.audit_log (at, actor, action, detail)
select (e->>'at')::timestamptz,
       '',
       coalesce(e->>'action', ''),
       coalesce(e->'detail', '{}'::jsonb)
from public.kv, lateral jsonb_array_elements(value) as e
where key = 'auditlog'
  and e ? 'at'
  and not exists (select 1 from public.audit_log);
