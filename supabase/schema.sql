-- =========================================================
--  Dnipro-M — схема Supabase (крок 1)
--  Виконати в Supabase → SQL Editor → Run.
--  Безпечно запускати повторно (idempotent).
-- =========================================================

-- ---------- 1. Мапа: користувач Supabase → кабінет ----------
create table if not exists public.cab_map (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  cabinet_key  text not null unique,
  cabinet_type text not null,           -- manager | accountant | office | tm | sm
  tm_key       text,                    -- для sm: базовий ТМ; для tm: власний ключ; інакше null
  created_at   timestamptz not null default now()
);
alter table public.cab_map enable row level security;

drop policy if exists cab_map_read_own on public.cab_map;
create policy cab_map_read_own on public.cab_map
  for select using (user_id = auth.uid());

-- ---------- 2. Помічники (security definer — обходять RLS) ----------
create or replace function public.my_cabinet_key() returns text
  language sql stable security definer set search_path = public as $$
  select cabinet_key from public.cab_map where user_id = auth.uid()
$$;

create or replace function public.my_cabinet_type() returns text
  language sql stable security definer set search_path = public as $$
  select cabinet_type from public.cab_map where user_id = auth.uid()
$$;

create or replace function public.salon_base_tm(salon_key text) returns text
  language sql stable security definer set search_path = public as $$
  select tm_key from public.cab_map where cabinet_key = salon_key limit 1
$$;

create or replace function public.is_manager_or_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cab_map
    where user_id = auth.uid()
      and (cabinet_type = 'manager' or cabinet_key = 'andriy')
  )
$$;

-- ---------- 3. KV-сховище (дзеркало window.storage) ----------
create table if not exists public.kv (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.kv enable row level security;

-- власник salary-ключа: 'data:<tm>:<ym>' / 'smdata:<salon>:<ym>' / 'adj:' / 'grade:' / 'qbonus:'
create or replace function public.kv_owner(k text) returns text
  language sql immutable as $$
  select case
    when k like 'data:%'   then split_part(k, ':', 2)
    when k like 'adj:%'    then split_part(k, ':', 2)
    when k like 'grade:%'  then split_part(k, ':', 2)
    when k like 'qbonus:%' then split_part(k, ':', 2)
    when k like 'smdata:%' then split_part(k, ':', 2)
    else null
  end
$$;

drop policy if exists kv_select on public.kv;
create policy kv_select on public.kv for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.kv_owner(key) = public.my_cabinet_key()
    or (key like 'smdata:%'
        and public.my_cabinet_type() = 'tm'
        and public.salon_base_tm(public.kv_owner(key)) = public.my_cabinet_key())
    or key = 'reassign:list'
    or (key like 'caps:%' and split_part(key, ':', 2) = public.my_cabinet_key())
    or key = 'auditlog'
  )
);

drop policy if exists kv_write on public.kv;
create policy kv_write on public.kv for all using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.kv_owner(key) = public.my_cabinet_key()
    or (key like 'smdata:%'
        and public.my_cabinet_type() = 'tm'
        and public.salon_base_tm(public.kv_owner(key)) = public.my_cabinet_key())
    or key = 'auditlog'                         -- журнал дописують усі
    or (key like 'recovery:%')                  -- запити відновлення
    or (public.my_cabinet_key() = 'andriy')     -- адмін: усе
  )
) with check (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.kv_owner(key) = public.my_cabinet_key()
    or (key like 'smdata:%'
        and public.my_cabinet_type() = 'tm'
        and public.salon_base_tm(public.kv_owner(key)) = public.my_cabinet_key())
    or key = 'auditlog'
    or (key like 'recovery:%')
    or (public.my_cabinet_key() = 'andriy')
  )
);

-- автооновлення updated_at
create or replace function public.kv_touch() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists kv_touch_trg on public.kv;
create trigger kv_touch_trg before insert or update on public.kv
  for each row execute function public.kv_touch();

-- ---------- 4. Realtime для kv ----------
alter publication supabase_realtime add table public.kv;
