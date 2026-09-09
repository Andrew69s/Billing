-- =========================================================
--  ДОСТУП ДО ВКЛАДОК (модулів кабінету)
--  modaccess:<cabKey>  — { moduleKey: false } — пише лише адмін/керівник,
--                        читає власник кабінету (щоб приховати вимкнені вкладки).
--  modcatalog:<cabKey> — [{key,label,group}] — самореєстрація: пише власник
--                        кабінету при вході, читають адмін/керівник (і власник).
--  Повторюємо поточні живі політики kv + нові гілки.
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
    or key = ('modaccess:'  || public.my_cabinet_key())
    or key = ('modcatalog:' || public.my_cabinet_key())
    or key = ('modextra:'   || public.my_cabinet_key())
    or (key like 'caps:%' and split_part(key, ':', 2) = public.my_cabinet_key())
    or key = 'auditlog'
  )
);

drop policy if exists kv_write on public.kv;
create policy kv_write on public.kv for all using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.kv_owner(key) = public.my_cabinet_key()
    or (key like 'smdata:%'
        and public.my_cabinet_type() = 'tm'
        and public.salon_base_tm(public.kv_owner(key)) = public.my_cabinet_key())
    or key = 'auditlog'
    or key like 'recovery:%'
    or key = ('modcatalog:' || public.my_cabinet_key())
    or public.my_cabinet_key() = 'andriy'
  )
) with check (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.kv_owner(key) = public.my_cabinet_key()
    or (key like 'smdata:%'
        and public.my_cabinet_type() = 'tm'
        and public.salon_base_tm(public.kv_owner(key)) = public.my_cabinet_key())
    or key = 'auditlog'
    or key like 'recovery:%'
    or key = ('modcatalog:' || public.my_cabinet_key())
    or public.my_cabinet_key() = 'andriy'
  )
);
