-- =========================================================
--  Тестування: замість одного чекбокса «пройшов» — три явні статуси,
--  як у зовнішній таблиці АКО: Виконано / Провалено / Не призначено.
--  passed (boolean) лишаємо синхронізованим зі status — щоб не чіпати
--  наявні місця, які вже рахують .passed (територіальний прогрес,
--  середній бал по СМ).
-- =========================================================
alter table public.training_results
  add column if not exists status text not null default 'not_assigned'
    check (status in ('passed', 'failed', 'not_assigned'));

update public.training_results set status = 'passed' where passed = true and status = 'not_assigned';
