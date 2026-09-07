-- Показники території: будь-який ТМ бачить дані ОБОХ територій (крос-аналітика
-- на дашборді). Редагування лишається по своїй території (tmet_write без змін).
drop policy if exists tmet_select on public.territory_metrics;
create policy tmet_select on public.territory_metrics for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or public.my_cabinet_type() = 'tm'
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'sm'
        and public.current_salon_tm(salon_key) = public.current_salon_tm(public.my_cabinet_key()))
  )
);

drop policy if exists tplan_select on public.territory_plans;
create policy tplan_select on public.territory_plans for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or public.my_cabinet_type() = 'tm'
    or salon_key = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'sm'
        and public.current_salon_tm(salon_key) = public.current_salon_tm(public.my_cabinet_key()))
  )
);
