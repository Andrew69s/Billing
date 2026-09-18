-- =========================================================
--  Продажі ЕЗ: магазин (СМ) і ТМ можуть редагувати/видаляти те, що
--  внесли, а не лише в статусі «на опрацюванні».
-- =========================================================
drop policy if exists ez_sales_update on public.ez_sales;
create policy ez_sales_update on public.ez_sales for update
  using (
    auth.uid() is not null and (
      public.is_manager_or_admin()
      or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
      or salon_key = public.my_cabinet_key()
    )
  );

drop policy if exists ez_sales_delete on public.ez_sales;
create policy ez_sales_delete on public.ez_sales for delete
  using (
    auth.uid() is not null and (
      public.is_manager_or_admin()
      or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(salon_key) = public.my_cabinet_key())
      or salon_key = public.my_cabinet_key()
    )
  );

-- СМ не має напряму міняти поля опрацювання ТМ (статус/собівартість/прибуток) —
-- лише свою частину (номенклатура/сума/спосіб оплати тощо). Якщо СМ змінює суму
-- чи спосіб оплати ВЖЕ підтвердженого продажу — стара собівартість ТМ більше не
-- відповідає новій сумі, тож скидаємо назад «на опрацювання».
create or replace function public.ez_sales_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  is_tm_or_admin boolean;
begin
  is_tm_or_admin := public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm' and public.current_salon_tm(new.salon_key) = public.my_cabinet_key());
  if tg_op = 'UPDATE' and not is_tm_or_admin then
    new.status := old.status;
    new.cost_price := old.cost_price;
    new.cost_np := old.cost_np;
    new.cost_acquiring := old.cost_acquiring;
    new.cost_vat := old.cost_vat;
    new.extra_costs := old.extra_costs;
    new.net_profit := old.net_profit;
    new.processed_by := old.processed_by;
    new.processed_at := old.processed_at;
    if old.status = 'confirmed'
       and (new.amount is distinct from old.amount or new.payment_method is distinct from old.payment_method) then
      new.status := 'pending';
      new.cost_price := null; new.cost_np := null; new.cost_acquiring := null; new.cost_vat := null;
      new.extra_costs := null; new.net_profit := null; new.processed_by := null; new.processed_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ez_sales_guard_trg on public.ez_sales;
create trigger ez_sales_guard_trg
  before update on public.ez_sales
  for each row execute function public.ez_sales_guard();
