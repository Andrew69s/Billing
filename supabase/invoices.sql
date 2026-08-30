-- =========================================================
--  Dnipro-M — модуль «Безнальні рахунки»
--  Виконати в Supabase → SQL Editor → Run (після schema.sql, tasks2.sql).
--  Ідемпотентно.
-- =========================================================

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  created_by   text not null,                       -- кабінет-магазин, що виставив
  counterparty text not null default '',            -- ПОКУПЕЦЬ (клієнт, кому виставлено)
  issuer       text not null default '',            -- ПОСТАЧАЛЬНИК (юр-особа Дніпро-М: Будвік / ФОП)
  vat          boolean not null default false,      -- з ПДВ / без ПДВ
  items        jsonb not null default '[]'::jsonb,  -- [{code, name, qty}]
  amount       numeric(12,2) not null default 0,    -- сума, грн
  invoice_no   text not null default '',            -- № рахунку
  screenshot   text not null default '',            -- скрін з 1С (dataURL)
  status       text not null default 'issued',      -- issued|paid|shipped|documented|cancelled
  comment      text not null default '',
  history      jsonb not null default '[]'::jsonb,   -- [{status, at, by}]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- якщо таблиця вже існує:
alter table public.invoices add column if not exists issuer text not null default '';
alter table public.invoices add column if not exists vat    boolean not null default false;
alter table public.invoices add column if not exists items  jsonb not null default '[]'::jsonb;
create index if not exists invoices_creator_idx on public.invoices (created_by, status);
create index if not exists invoices_status_idx  on public.invoices (status, created_at desc);

alter table public.invoices enable row level security;

-- ---------- RLS ----------
-- бачити: керівник/адмін і бухгалтер — усе; магазин — свої;
-- ТМ — рахунки салонів своєї території (з урахуванням перепризначень)
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or created_by = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm'
        and public.current_salon_tm(created_by) = public.my_cabinet_key())
  )
);

-- виставляти рахунок може лише магазин — на себе
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert with check (
  auth.uid() is not null
  and public.my_cabinet_type() = 'sm'
  and created_by = public.my_cabinet_key()
);

-- змінювати (статус/коментар): бухгалтер, керівник/адмін, ТМ своєї території,
-- або сам магазин (коментар / скасування своєї чернетки — контролюється в UI)
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or created_by = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm'
        and public.current_salon_tm(created_by) = public.my_cabinet_key())
  )
);

-- видаляти: адмін/керівник або автор (у UI — лише поки «Виставлено»)
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete using (
  auth.uid() is not null and (public.is_manager_or_admin() or created_by = public.my_cabinet_key())
);

-- ---------- тригери → сповіщення ----------
-- новий рахунок → бухгалтеру і ТМ салону
create or replace function public.notify_invoice_new()
returns trigger language plpgsql security definer set search_path = public as $$
declare tm text;
begin
  insert into public.notifications (recipient, kind, title, body, actor, link)
  values ('accountant', 'invoice',
          'Новий безнальний рахунок',
          coalesce(nullif(new.counterparty,''), 'без назви') || ' · ' || to_char(new.amount, 'FM999G999G990D00') || ' грн',
          new.created_by, 'invoices');

  tm := public.current_salon_tm(new.created_by);
  if tm is not null then
    insert into public.notifications (recipient, kind, title, body, actor, link)
    values (tm, 'invoice',
            'Новий рахунок салону',
            coalesce(nullif(new.counterparty,''), 'без назви') || ' · ' || to_char(new.amount, 'FM999G999G990D00') || ' грн',
            new.created_by, 'invoices');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_invoice_new on public.invoices;
create trigger trg_notify_invoice_new after insert on public.invoices
  for each row execute function public.notify_invoice_new();

-- зміна статусу → магазину-автору
create or replace function public.notify_invoice_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare lbl text;
begin
  if new.status is distinct from old.status then
    lbl := case new.status
      when 'paid'       then 'оплачено'
      when 'shipped'    then 'відвантажено'
      when 'documented' then 'документи пропечатано'
      when 'cancelled'  then 'скасовано'
      else 'оновлено'
    end;
    insert into public.notifications (recipient, kind, title, body, actor, link)
    values (new.created_by, 'invoice',
            'Рахунок ' || lbl,
            coalesce(nullif(new.counterparty,''), 'без назви') || ' · ' || to_char(new.amount, 'FM999G999G990D00') || ' грн',
            public.my_cabinet_key(), 'invoices');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_invoice_status on public.invoices;
create trigger trg_notify_invoice_status after update on public.invoices
  for each row execute function public.notify_invoice_status();

-- realtime
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'invoices'
  ) then
    alter publication supabase_realtime add table public.invoices;
  end if;
end $$;
