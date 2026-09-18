-- =========================================================
--  Продажі ЕЗ: затрати при опрацюванні ТМ розбиваємо на конкретні статті
--  (як у власному блоці ЕЗ ТМ) замість одного поля «затрати».
-- =========================================================
alter table public.ez_sales add column if not exists cost_np numeric;
alter table public.ez_sales add column if not exists cost_acquiring numeric;
alter table public.ez_sales add column if not exists cost_vat numeric;
