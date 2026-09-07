-- =========================================================
--  ФОП по СМ: історія відповідності ФОП ↔ магазин.
--  Зберігається в kv під ключем 'fop:history' (єдиний JSON-масив
--  [{id, salonKey, fop, fromDate, at}]). Пише лише адмін (andriy) /
--  керівник, читають усі кабінети (потрібно для вкладки «Довідник»
--  і підписів на плитках рахунків).
--
--  Повторює ПОТОЧНУ живу версію kv_select + дозвіл на читання 'fop:%'.
--  kv_write не чіпаємо — там уже є (my_cabinet_key() = 'andriy').
-- =========================================================
drop policy if exists kv_select on public.kv;
create policy kv_select on public.kv for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.kv_owner(key) = public.my_cabinet_key()
    or (key like 'smdata:%'
        and public.my_cabinet_type() = 'tm'
        and public.current_salon_tm(public.kv_owner(key)) = public.my_cabinet_key())
    or key = 'reassign:list'
    or key like 'fop:%'
    or (key like 'caps:%' and split_part(key, ':', 2) = public.my_cabinet_key())
    or key = 'auditlog'
  )
);
