-- Графік змін: будь-який СМ бачить усі 8 салонів (координація/підміни).
-- Редагування лишається по своїй території (can_touch_salon без змін).
create or replace function public.can_view_salon(k text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_type() = 'accountant'
    or k = public.my_cabinet_key()
    or public.my_cabinet_type() = 'tm'
    or public.my_cabinet_type() = 'sm'
  );
$$;
