-- =========================================================
--  Гігієна бази, частина 2:
--  1) Скріни в розрахунках ЗП (kv: data:<tm>:<ym> / smdata:<salon>:<emp>:<ym>)
--     — зберігаємо 3 місяці, далі приберається лише ключ "screenshots"
--     (сам розрахунок і всі цифри лишаються назавжди).
--  2) Скріни до звернень — прибираються одразу, як тільки адміністратор
--     позначив звернення опрацьованим (status = 'done').
-- =========================================================

create or replace function public.purge_old_salary_screenshots() returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  cutoff text := to_char((now() at time zone 'Europe/Kyiv') - interval '3 months', 'YYYY-MM');
begin
  update public.kv
    set value = value - 'screenshots'
  where value ? 'screenshots'
    and (
      (key like 'data:%'   and split_part(key, ':', 3) < cutoff)
      or (key like 'smdata:%' and split_part(key, ':', 4) < cutoff)
    );
end $$;

select cron.unschedule('purge-old-salary-shots')
where exists (select 1 from cron.job where jobname = 'purge-old-salary-shots');
select cron.schedule('purge-old-salary-shots', '0 4 * * *', 'select public.purge_old_salary_screenshots()');
select public.purge_old_salary_screenshots();

-- ---- Звернення: скрін геть одразу після "опрацьовано" -----------------
create or replace function public.feedback_clear_shot_on_resolve() returns trigger
language plpgsql as $$
begin
  if NEW.status = 'done' and NEW.screenshot is not null then
    NEW.screenshot := null;
  end if;
  return NEW;
end $$;

drop trigger if exists feedback_clear_shot_t on public.feedback;
create trigger feedback_clear_shot_t before update on public.feedback
  for each row execute function public.feedback_clear_shot_on_resolve();

-- прибрати вже опрацьовані звернення, де скрін ще лежить
update public.feedback set screenshot = null where status = 'done' and screenshot is not null;
