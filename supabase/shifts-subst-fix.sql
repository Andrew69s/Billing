-- =========================================================
--  Графік змін: дозволити СМ записувати заміну свого співробітника
--  в ІНШОМУ магазині. can_touch_salon(salon_key) для СМ дозволяє лише
--  k = my_cabinet_key() — тож запис рядка з salon_key чужого магазину
--  (заміна) завжди відхилявся RLS («недостатньо прав»), навіть якщо
--  employee_id належить самому СМ. Додаємо окрему permissive-політику,
--  що дозволяє це вузько — лише для власних співробітників.
-- =========================================================
drop policy if exists shifts_write_subst on public.shifts;
create policy shifts_write_subst on public.shifts for all
  using (
    public.my_cabinet_type() = 'sm'
    and exists (select 1 from public.employees e where e.id = shifts.employee_id and e.salon_key = public.my_cabinet_key())
  )
  with check (
    public.my_cabinet_type() = 'sm'
    and exists (select 1 from public.employees e where e.id = shifts.employee_id and e.salon_key = public.my_cabinet_key())
  );
