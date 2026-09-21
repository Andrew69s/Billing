-- =========================================================
--  БН-рахунки: рахунок, доданий вручну бухгалтером (Юлею) на будь-який магазин —
--  для документів за старі періоди, яких магазин не виставляв.
--  manual = true; invoice_date — дата самого рахунку; created_at ставимо датою рахунку.
-- =========================================================
alter table public.invoices add column if not exists manual boolean not null default false;
alter table public.invoices add column if not exists invoice_date date;

-- вставка: магазин — на себе (як раніше); бухгалтер/керівник/адмін — лише ручні рахунки на будь-який магазин
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert with check (
  auth.uid() is not null and (
    (public.my_cabinet_type() = 'sm' and created_by = public.my_cabinet_key() and manual = false)
    or ((public.my_cabinet_type() = 'accountant' or public.is_manager_or_admin()) and manual = true)
  )
);

-- видалення: як раніше + бухгалтер може видалити ручний рахунок (помилково доданий)
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or created_by = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'accountant' and manual = true)
  )
);

-- ручний рахунок не шле сповіщення «Новий безнальний рахунок» (його додає сама бухгалтерія)
create or replace function public.notify_invoice_new()
returns trigger language plpgsql security definer set search_path = public as $$
declare tm text;
begin
  if new.manual then return new; end if;
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
