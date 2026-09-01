-- =========================================================
--  Dnipro-M — звернення (проблеми / пропозиції)
--  Будь-хто подає; бачить і опрацьовує лише адміністратор (кабінет 'andriy').
--  Виконати в Supabase → SQL Editor. Ідемпотентно.
-- =========================================================

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'problem',     -- problem | proposal
  body        text not null default '',
  screenshot  text,                                -- data:image/jpeg;base64,...
  from_cabinet text not null default '',
  from_type   text not null default '',
  status       text not null default 'new',        -- new | done
  admin_comment text not null default '',           -- коментар адміністратора при опрацюванні
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- подати може будь-який автентифікований користувач
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert with check (auth.uid() is not null);

-- бачити / змінювати / видаляти — лише адміністратор
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback for select using (
  auth.uid() is not null and public.my_cabinet_key() = 'andriy'
);
drop policy if exists feedback_admin_write on public.feedback;
create policy feedback_admin_write on public.feedback for update using (
  auth.uid() is not null and public.my_cabinet_key() = 'andriy'
) with check (auth.uid() is not null and public.my_cabinet_key() = 'andriy');
drop policy if exists feedback_admin_delete on public.feedback;
create policy feedback_admin_delete on public.feedback for delete using (
  auth.uid() is not null and public.my_cabinet_key() = 'andriy'
);

-- realtime (щоб адмін бачив нові звернення одразу)
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback') then
    alter publication supabase_realtime add table public.feedback;
  end if;
end $$;
