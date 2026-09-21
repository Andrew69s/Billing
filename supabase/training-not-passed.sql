-- Тестування: додатковий статус «Не пройдено» (призначено, але ще не пройдено; бал не вказується)
alter table public.training_results drop constraint if exists training_results_status_check;
alter table public.training_results
  add constraint training_results_status_check
  check (status in ('passed', 'failed', 'not_assigned', 'not_passed'));
