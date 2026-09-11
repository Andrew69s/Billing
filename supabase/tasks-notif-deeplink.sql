-- Сповіщення про задачу тепер несуть id задачі (link = 'tasks:<uuid>'),
-- щоб клік відкривав саме її, а не просто вкладку «Задачі».
create or replace function public.notify_task_new()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.notifications(recipient, kind, title, body, actor, link)
  values (new.assignee, 'task_new', 'Нова задача', new.title, new.created_by, 'tasks:' || new.id);
  return new;
end $$;

create or replace function public.notify_task_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = old.status then return new; end if;
  insert into public.notifications(recipient, kind, title, body, actor, link)
  values (new.created_by, 'task_status',
    case new.status when 'in_progress' then 'Взято в роботу'
                    when 'done' then 'Задачу виконано'
                    else 'Статус змінено' end,
    new.title, new.assignee, 'tasks:' || new.id);
  return new;
end $$;
