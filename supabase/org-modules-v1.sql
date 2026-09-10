-- =========================================================
--  Орг-структура: модулі «Проходження тестувань» + «Коди ЗСУ −15%»
-- =========================================================

-- ---- Тестування ------------------------------------------------------------
create table if not exists public.trainings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  assigned_on date,
  deadline    date,
  screenshot  text,
  note        text not null default '',
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  archived    boolean not null default false
);
alter table public.trainings enable row level security;

drop policy if exists trn_select on public.trainings;
create policy trn_select on public.trainings for select using (auth.uid() is not null);

drop policy if exists trn_write on public.trainings;
create policy trn_write on public.trainings for all
  using  (public.is_manager_or_admin() or public.my_cabinet_type() in ('tm','manager'))
  with check (public.is_manager_or_admin() or public.my_cabinet_type() in ('tm','manager'));

create table if not exists public.training_results (
  id          uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  employee_id uuid not null,
  salon_key   text not null,
  passed      boolean not null default false,
  score       numeric,
  passed_on   date,
  updated_by  text not null default '',
  updated_at  timestamptz not null default now(),
  unique (training_id, employee_id)
);
alter table public.training_results enable row level security;

drop policy if exists trr_select on public.training_results;
create policy trr_select on public.training_results for select using (auth.uid() is not null);

drop policy if exists trr_write on public.training_results;
create policy trr_write on public.training_results for all
  using (
    public.is_manager_or_admin()
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
  with check (
    public.is_manager_or_admin()
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  );

-- нагадування за 3 дні до дедлайну (pg_cron, щоденно 07:00 UTC)
create or replace function public.notify_training_due() returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  t   record;
  s   record;
  tm  record;
  miss_cnt int;
  miss_nm  text;
begin
  for t in
    select * from public.trainings
    where not archived and deadline is not null
      and deadline >= current_date and deadline <= current_date + 3
  loop
    -- по салонах
    for s in select distinct salon_key from public.employees where status = 'active' loop
      select count(*), string_agg(e.full_name, ', ' order by e.full_name)
        into miss_cnt, miss_nm
      from public.employees e
      where e.salon_key = s.salon_key and e.status = 'active'
        and not exists (
          select 1 from public.training_results r
          where r.training_id = t.id and r.employee_id = e.id and r.passed
        );
      if coalesce(miss_cnt, 0) > 0
         and not exists (
           select 1 from public.notifications n
           where n.recipient = s.salon_key and n.kind = 'training'
             and n.title = 'Пройдіть тестування: ' || t.title
             and n.created_at > now() - interval '20 hours'
         ) then
        insert into public.notifications(recipient, kind, title, body, actor, link)
        values (s.salon_key, 'training', 'Пройдіть тестування: ' || t.title,
                'Дедлайн ' || to_char(t.deadline, 'DD.MM') || '. Не пройшли: ' || miss_nm,
                'system', 'training');
      end if;
    end loop;

    -- зведення по ТМ (+ адмін-ТМ andriy автоматично як ТМ своєї території)
    for tm in
      select public.current_salon_tm(salon_key) tmk, count(*) filter (where true) x
      from public.employees where status = 'active'
      group by public.current_salon_tm(salon_key)
    loop
      select count(*) into miss_cnt
      from public.employees e
      where e.status = 'active'
        and public.current_salon_tm(e.salon_key) = tm.tmk
        and not exists (
          select 1 from public.training_results r
          where r.training_id = t.id and r.employee_id = e.id and r.passed
        );
      if coalesce(miss_cnt, 0) > 0
         and not exists (
           select 1 from public.notifications n
           where n.recipient = tm.tmk and n.kind = 'training'
             and n.title = 'Тестування «' || t.title || '»: не пройшли ' || miss_cnt
             and n.created_at > now() - interval '20 hours'
         ) then
        insert into public.notifications(recipient, kind, title, body, actor, link)
        values (tm.tmk, 'training',
                'Тестування «' || t.title || '»: не пройшли ' || miss_cnt,
                'Дедлайн ' || to_char(t.deadline, 'DD.MM') || '. Перегляньте зведення по території.',
                'system', 'training');
      end if;
    end loop;
  end loop;
end $$;

select cron.unschedule('training-due-daily')
where exists (select 1 from cron.job where jobname = 'training-due-daily');
select cron.schedule('training-due-daily', '0 7 * * *', 'select public.notify_training_due()');

-- ---- Коди ЗСУ −15% --------------------------------------------------------
create table if not exists public.zsu_codes (
  id          uuid primary key default gen_random_uuid(),
  salon_key   text not null,
  code        text not null,
  batch_id    text not null default '',
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  used        boolean not null default false,
  receipt_no  text not null default '',
  used_on     date,
  used_at     timestamptz,
  used_by     text not null default '',
  unique (salon_key, code)
);
alter table public.zsu_codes enable row level security;

drop policy if exists zsu_select on public.zsu_codes;
create policy zsu_select on public.zsu_codes for select using (
  public.is_manager_or_admin()
  or public.my_cabinet_type() = 'accountant'
  or salon_key = public.my_cabinet_key()
  or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
);

drop policy if exists zsu_insert on public.zsu_codes;
create policy zsu_insert on public.zsu_codes for insert with check (
  public.is_manager_or_admin()
  or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
);

drop policy if exists zsu_update on public.zsu_codes;
create policy zsu_update on public.zsu_codes for update
  using (
    public.is_manager_or_admin()
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  )
  with check (
    public.is_manager_or_admin()
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
  );

drop policy if exists zsu_delete on public.zsu_codes;
create policy zsu_delete on public.zsu_codes for delete using (
  public.is_manager_or_admin()
  or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
);

-- realtime
alter publication supabase_realtime add table public.trainings;
alter publication supabase_realtime add table public.training_results;
alter publication supabase_realtime add table public.zsu_codes;
alter publication supabase_realtime add table public.shift_edit_requests;
