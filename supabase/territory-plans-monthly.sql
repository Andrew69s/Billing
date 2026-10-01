-- =========================================================
--  territory_plans: план стає знімком ПО МІСЯЦЮ (salon_key, ym), як sm_plans,
--  а не єдиним "живим" числом на магазин. До цього перегляд будь-якого
--  минулого місяця (аналітика, «Показники території») завжди показував
--  СЬОГОДНІШНІЙ план, бо іншого просто не існувало — і будь-яка зміна плану
--  в планері заднім числом тихо міняла історичні звіти.
--  Виконати в Supabase → SQL Editor (після territory.sql). Ідемпотентно
--  (повторний запуск, коли таблиця вже на новій схемі, — no-op по даних).
-- =========================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'territory_plans' and column_name = 'ym'
  ) then
    return; -- вже мігровано
  end if;

  alter table public.territory_plans rename to territory_plans_old;

  create table public.territory_plans (
    salon_key  text not null,
    ym         text not null,
    plan       jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (salon_key, ym)
  );

  -- бекфіл: стара "жива" цифра стає планом для ПОТОЧНОГО місяця — найкраще,
  -- що є в наявності; історії за минулі місяці до цього моменту не існувало.
  insert into public.territory_plans (salon_key, ym, plan, updated_at)
  select salon_key, to_char(now(), 'YYYY-MM'), plan, updated_at from public.territory_plans_old;

  drop table public.territory_plans_old;
end $$;

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
    insert into public.territory_plans (salon_key, ym, plan, updated_at)
    values (r->>'salon_key', r->>'ym', r->'plan', now())
    on conflict (salon_key, ym) do update set plan = excluded.plan, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
