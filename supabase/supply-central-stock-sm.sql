-- =========================================================
--  Склад: магазини (СМ) бачать залишки Основного (розподільчого) складу,
--  щоб при замовленні знати, скільки є в наявності. Лише читання таблиці
--  залишків; акти й рух Основного складу СМ, як і раніше, не бачать.
--  (ТМ, керівник і складські вже бачать його через supply_can_view.)
-- =========================================================
drop policy if exists supply_stock_read_central on public.supply_stock;
create policy supply_stock_read_central on public.supply_stock for select using (
  auth.uid() is not null
  and warehouse = 'central'
  and public.my_cabinet_type() = 'sm'
);
