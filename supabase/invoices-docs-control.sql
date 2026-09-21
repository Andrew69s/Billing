-- =========================================================
--  БН-рахунки: контроль видаткових накладних бухгалтером.
--  Юля бачить усі «Пропечатано», позначає «Передали на офіс» і може
--  повідомити СМ (створюється задача з екраном «Ознайомлений»,
--  її id зберігаємо, щоб бачити, чи СМ ознайомився).
--  RLS не змінюємо: invoices_update вже дозволяє бухгалтеру/адміну.
-- =========================================================
alter table public.invoices add column if not exists docs_office_at timestamptz;
alter table public.invoices add column if not exists docs_office_by text not null default '';
alter table public.invoices add column if not exists docs_notified_at timestamptz;
alter table public.invoices add column if not exists docs_notify_count int not null default 0;
alter table public.invoices add column if not exists docs_task_id uuid;
