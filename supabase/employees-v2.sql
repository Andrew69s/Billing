-- Будь-який СМ може читати склад команди всіх салонів (для графіка змін і підмін).
-- Клієнт у вкладці «Команда» все одно фільтрує до своєї території; повний список
-- потрібен лише сітці графіка.
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or salon_key = public.my_cabinet_key()
    or public.my_cabinet_type() = 'tm'
    or public.my_cabinet_type() = 'sm'
  )
);
