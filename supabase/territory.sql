-- =========================================================
--  Dnipro-M — модуль «Показники території»
--  Денні показники салонів: тягнуться з планера + ручні корективи ТМ.
--  Виконати в Supabase → SQL Editor (після schema.sql, shifts.sql).
--  Ідемпотентно.
-- =========================================================

create table if not exists public.territory_metrics (
  salon_key   text not null,
  work_date   date not null,
  planner     jsonb not null default '{}'::jsonb,  -- {assort,ez,cheky,bn,dzvinky} з планера
  manual      jsonb not null default '{}'::jsonb,  -- ручні корективи ТМ (перекривають planner по ключах)
  note        text  not null default '',
  updated_by  text  not null default '',
  updated_at  timestamptz not null default now(),
  primary key (salon_key, work_date)
);
create index if not exists tmet_date_idx on public.territory_metrics (work_date);

alter table public.territory_metrics enable row level security;

-- ПЕРЕГЛЯД: керівник/бухгалтер — усе; ТМ — своя територія; СМ — лише свій магазин
drop policy if exists tmet_select on public.territory_metrics;
create policy tmet_select on public.territory_metrics for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
);

-- РЕДАГУВАННЯ: керівник/адмін або ТМ своєї території (СМ не редагує)
drop policy if exists tmet_write on public.territory_metrics;
create policy tmet_write on public.territory_metrics for all using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
) with check (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
);

-- realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'territory_metrics') then
    alter publication supabase_realtime add table public.territory_metrics;
  end if;
end $$;

-- =========================================================
--  Місячні плани салонів (тягнуться з планера: plans:Боровик)
-- =========================================================
create table if not exists public.territory_plans (
  salon_key  text primary key,
  plan       jsonb not null default '{}'::jsonb,   -- {assort,ez,cheky,bn,dzvinky}
  updated_at timestamptz not null default now()
);
alter table public.territory_plans enable row level security;
drop policy if exists tplan_select on public.territory_plans;
create policy tplan_select on public.territory_plans for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
);
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'territory_plans') then
    alter publication supabase_realtime add table public.territory_plans;
  end if;
end $$;

create or replace function public.tplan_apply(rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into public.territory_plans (salon_key, plan, updated_at)
    values (r->>'salon_key', r->'plan', now())
    on conflict (salon_key) do update set plan = excluded.plan, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- =========================================================
--  Синхронізація з планером: upsert лише поля planner, manual не чіпаємо.
--  Викликає Edge Function planner-sync (service role).
-- =========================================================
create or replace function public.tmet_apply_planner(rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  for r in select * from jsonb_array_elements(rows)
  loop
    insert into public.territory_metrics (salon_key, work_date, planner, updated_by, updated_at)
    values (r->>'salon_key', (r->>'work_date')::date, r->'planner', 'planner', now())
    on conflict (salon_key, work_date)
      do update set planner = excluded.planner, updated_at = now()
      where public.territory_metrics.planner is distinct from excluded.planner;
    n := n + 1;
  end loop;
  return n;
end $$;

-- =========================================================
--  Щоденна автосинхронізація (pg_cron + pg_net).
--  Тягне поточний і попередній місяць о 05:10 UTC (~08:10 Київ).
--  Edge Function planner-sync приймає виклик з anon-ключем (пише лише
--  публічні дані планера через security-definer tmet_apply_planner).
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.planner_sync_kick()
returns void language plpgsql security definer set search_path = public as $$
declare
  anon text := '<VITE_SUPABASE_ANON_KEY>';   -- підставити anon-ключ проєкту (він публічний)
  months jsonb := jsonb_build_array(to_char(now(),'YYYY-MM'), to_char(now() - interval '1 month','YYYY-MM'));
begin
  perform net.http_post(
    url := 'https://taiqrxlehnfkuvokgwqu.supabase.co/functions/v1/planner-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon,'apikey',anon),
    body := jsonb_build_object('months', months)
  );
end $$;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'planner-sync-daily') then
    perform cron.unschedule('planner-sync-daily');
  end if;
end $$;
select cron.schedule('planner-sync-daily', '10 5 * * *', $$select public.planner_sync_kick()$$);
