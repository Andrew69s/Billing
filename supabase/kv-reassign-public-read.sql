-- =========================================================
--  Дека (екран вибору кабінету) рендериться ДО входу — auth.uid() ще null,
--  тож попередня політика kv_select ("auth.uid() IS NOT NULL AND (...)")
--  блокувала читання reassign:list і кількість магазинів на тайлах ТМ
--  завжди показувала БАЗОВЕ призначення (SALONS[].tm), ігноруючи реальні
--  перепризначення. Звідси і «зникли» 5 магазинів Андрія на деці, і
--  раніше — «зайві» 5 магазинів у Івана. reassign:list не містить нічого
--  чутливого (лише мапа магазин→ТМ), тож дозволяємо читати його без входу.
-- =========================================================
drop policy if exists kv_select on public.kv;
create policy kv_select on public.kv for select using (
  (key = 'reassign:list')
  or (
    (auth.uid() is not null) and (
      is_manager_or_admin()
      or (kv_owner(key) = my_cabinet_key())
      or ((key like 'smdata:%') and (my_cabinet_type() = 'tm') and (current_salon_tm(kv_owner(key)) = my_cabinet_key()))
      or (key like 'fop:%')
      or (key = 'supply:articles')
      or (key = ('modaccess:' || my_cabinet_key()))
      or (key = ('modcatalog:' || my_cabinet_key()))
      or (key = ('modextra:' || my_cabinet_key()))
      or ((key like 'caps:%') and (split_part(key, ':', 2) = my_cabinet_key()))
      or (key = 'auditlog')
    )
  )
);
