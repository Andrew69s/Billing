-- =========================================================
--  Продажі ЕЗ: комбінована оплата (частина готівкою, частина карткою тощо)
-- =========================================================
alter table public.ez_sales drop constraint if exists ez_sales_payment_method_check;
alter table public.ez_sales add constraint ez_sales_payment_method_check
  check (payment_method in ('cash', 'card', 'transfer', 'installment', 'combined'));
alter table public.ez_sales add column if not exists payment_breakdown jsonb;
