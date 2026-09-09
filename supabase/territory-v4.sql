-- =========================================================
--  Показники території — СМ бачить денний оборот УСІХ магазинів
--  (кружечки «Усі магазини · сьогодні» в Огляді СМ). 2026-09-09.
--  Лише читання; редагувати ніхто не може (дані з планера).
-- =========================================================
drop policy if exists tmet_select on public.territory_metrics;
create policy tmet_select on public.territory_metrics for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() in ('accountant', 'tm', 'sm', 'office')
    or salon_key = public.my_cabinet_key()
  )
);

drop policy if exists tplan_select on public.territory_plans;
create policy tplan_select on public.territory_plans for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() in ('accountant', 'tm', 'sm', 'office')
    or salon_key = public.my_cabinet_key()
  )
);
