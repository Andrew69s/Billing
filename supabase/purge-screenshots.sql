-- =========================================================
--  Довгострокова гігієна бази: скріншоти рахунків і тестувань потрібні
--  лише щоб зручно розпізнати/перевірити дані при внесенні. Не тримаємо
--  їх довше 60 днів — інакше база роздувається базою64-картинками, а не
--  реальною аналітикою (invoices: ~170КБ/рядок на скрін).
-- =========================================================
create or replace function public.purge_old_screenshots() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update public.invoices set screenshot = null
    where screenshot is not null and created_at < now() - interval '60 days';
  update public.trainings set screenshot = null
    where screenshot is not null and created_at < now() - interval '60 days';
end $$;

select cron.unschedule('purge-old-screenshots')
where exists (select 1 from cron.job where jobname = 'purge-old-screenshots');
select cron.schedule('purge-old-screenshots', '30 3 * * *', 'select public.purge_old_screenshots()');

-- прибрати вже застаріле просто зараз (на випадок, якщо таке є)
select public.purge_old_screenshots();
