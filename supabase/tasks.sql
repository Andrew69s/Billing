-- =========================================================
--  Dnipro-M — модуль «Задачі»
--  Виконати в Supabase → SQL Editor → Run (після schema.sql).
-- =========================================================

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  created_by  text not null,                       -- cabinet_key автора
  assignee    text not null,                       -- cabinet_key виконавця (ТМ або салон)
  status      text not null default 'open',        -- open | in_progress | done
  due_date    date,
  comment     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists tasks_assignee_idx on public.tasks (assignee, status);
create index if not exists tasks_creator_idx  on public.tasks (created_by);

alter table public.tasks enable row level security;

-- бачити: керівник/адмін — усе; автор — свої; виконавець — свої;
-- ТМ — задачі своїх салонів (за базовим підпорядкуванням)
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or created_by = public.my_cabinet_key()
    or assignee   = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.salon_base_tm(assignee) = public.my_cabinet_key())
  )
);

-- ставити: керівник — кому завгодно; ТМ — собі або своєму салону
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (
  auth.uid() is not null
  and created_by = public.my_cabinet_key()
  and (
    public.is_manager_or_admin()
    or (public.my_cabinet_type() = 'tm' and (
          assignee = public.my_cabinet_key()
          or public.salon_base_tm(assignee) = public.my_cabinet_key()
        ))
  )
);

-- змінювати: керівник/адмін, автор, виконавець, або ТМ салону-виконавця
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (
  auth.uid() is not null and (
    public.is_manager_or_admin()
    or created_by = public.my_cabinet_key()
    or assignee   = public.my_cabinet_key()
    or (public.my_cabinet_type() = 'tm' and public.salon_base_tm(assignee) = public.my_cabinet_key())
  )
);

-- видаляти: керівник/адмін або автор
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete using (
  auth.uid() is not null and (public.is_manager_or_admin() or created_by = public.my_cabinet_key())
);

-- realtime
alter publication supabase_realtime add table public.tasks;
