-- =========================================================
--  Графік змін v3 — замок планування + запити на коригування факту
--  Правило: графік на місяць подається у перші дні цього ж місяця — до
--  3 числа включно (напр. графік на вересень — до 3 вересня). Далі ПЛАН
--  замикається назавжди. ФАКТ поточного місяця вноситься вільно; факт
--  завершеного місяця замикається — магазин подає запит, ТМ/адмін
--  підтверджує, і магазин коригує факт до кінця того дня.
-- =========================================================

create table if not exists public.shift_edit_requests (
  id           uuid primary key default gen_random_uuid(),
  salon_key    text not null,
  ym           text not null,
  status       text not null default 'pending' check (status in ('pending','approved','declined')),
  note         text not null default '',
  requested_by text not null default '',
  requested_at timestamptz not null default now(),
  resolved_by  text,
  resolved_at  timestamptz
);
create index if not exists shift_edit_requests_salon_ym on public.shift_edit_requests(salon_key, ym);

alter table public.shift_edit_requests enable row level security;

drop policy if exists ser_select on public.shift_edit_requests;
create policy ser_select on public.shift_edit_requests for select
  using (public.can_view_salon(salon_key));

drop policy if exists ser_insert on public.shift_edit_requests;
create policy ser_insert on public.shift_edit_requests for insert
  with check (
    auth.uid() is not null and status = 'pending' and (
      salon_key = public.my_cabinet_key()
      or public.is_manager_or_admin()
      or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
    )
  );

drop policy if exists ser_update on public.shift_edit_requests;
create policy ser_update on public.shift_edit_requests for update
  using (
    public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
  with check (
    public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  );

-- ---- Замок на таблиці shifts -----------------------------------------------
create or replace function public.shifts_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  wd        date        := coalesce(NEW.work_date, OLD.work_date);
  m_ym      text        := to_char(wd, 'YYYY-MM');
  plan_deadline timestamptz := date_trunc('month', wd::timestamp) + interval '3 days';
  cur_month date        := date_trunc('month', (now() at time zone 'Europe/Kyiv'))::date;
  plan_lock boolean     := now() > plan_deadline;             -- план місяця замикається після 3 числа
  fact_lock boolean     := wd < cur_month;                    -- факт замикається лише коли місяць завершився
  has_grant boolean;
begin
  if public.is_manager_or_admin() then return coalesce(NEW, OLD); end if;

  -- у замкненому місяці план не змінюється взагалі (факт поточного місяця — вільно)
  if plan_lock then
    if TG_OP = 'INSERT' then
      if NEW.plan_h is not null then raise exception 'plan_locked'; end if;
    elsif TG_OP = 'UPDATE' then
      if coalesce(NEW.plan_h::text, '') is distinct from coalesce(OLD.plan_h::text, '') then
        raise exception 'plan_locked';
      end if;
    elsif TG_OP = 'DELETE' then
      if OLD.plan_h is not null and not fact_lock then raise exception 'plan_locked'; end if;
    end if;
  end if;

  -- факт завершеного місяця — лише за активним дозволом ТМ на сьогодні
  if fact_lock then
    select exists (
      select 1 from public.shift_edit_requests r
      where r.salon_key = coalesce(NEW.salon_key, OLD.salon_key)
        and r.ym = m_ym and r.status = 'approved'
        and (r.resolved_at at time zone 'Europe/Kyiv')::date = (now() at time zone 'Europe/Kyiv')::date
    ) into has_grant;
    if not has_grant then raise exception 'fact_locked'; end if;
  end if;

  return coalesce(NEW, OLD);
end $$;

drop trigger if exists shifts_guard_t on public.shifts;
create trigger shifts_guard_t before insert or update or delete on public.shifts
  for each row execute function public.shifts_guard();
