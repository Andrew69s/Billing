-- =========================================================
--  Dnipro-M — глобальні прапори застосунку (технічна перерва тощо)
--  Виконати в Supabase → SQL Editor. Ідемпотентно.
-- =========================================================

create table if not exists public.app_flags (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_flags enable row level security;

-- читати може будь-хто (прапор не чутливий; потрібен ще до входу)
drop policy if exists app_flags_read on public.app_flags;
create policy app_flags_read on public.app_flags for select using (true);

-- писати — лише адміністратор (кабінет 'andriy')
drop policy if exists app_flags_write on public.app_flags;
create policy app_flags_write on public.app_flags for all using (
  auth.uid() is not null and public.my_cabinet_key() = 'andriy'
) with check (
  auth.uid() is not null and public.my_cabinet_key() = 'andriy'
);

-- realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_flags') then
    alter publication supabase_realtime add table public.app_flags;
  end if;
end $$;

insert into public.app_flags (key, value) values ('maintenance', '{"on": false, "message": ""}'::jsonb)
  on conflict (key) do nothing;
