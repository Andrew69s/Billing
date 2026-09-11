-- =========================================================
--  Компанії з договором Medok — при переході рахунку в «Відвантажено»
--  попереджаємо, що документи пропечатувати не потрібно.
--  Керує списком лише бухгалтер (Юля); бачать усі, хто рухає статуси.
-- =========================================================
create table if not exists public.medok_companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  note       text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
alter table public.medok_companies enable row level security;

drop policy if exists medok_select on public.medok_companies;
create policy medok_select on public.medok_companies for select using (auth.uid() is not null);

drop policy if exists medok_write on public.medok_companies;
create policy medok_write on public.medok_companies for all
  using (public.my_cabinet_type() = 'accountant' or public.is_manager_or_admin())
  with check (public.my_cabinet_type() = 'accountant' or public.is_manager_or_admin());

alter publication supabase_realtime add table public.medok_companies;
