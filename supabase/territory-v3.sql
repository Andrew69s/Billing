-- Показники території — лише читання. Дані тягне з планера edge-функція
-- planner-sync через RPC tmet_apply_planner (security definer). Прямих
-- записів у territory_metrics більше немає — прибираємо політику запису.
drop policy if exists tmet_write on public.territory_metrics;

-- ручні корективи більше не потрібні — чистимо накопичене (planner лишається)
update public.territory_metrics set manual = '{}'::jsonb where manual <> '{}'::jsonb;
