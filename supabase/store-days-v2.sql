-- store_days v2 — облік вчасності відкриття магазину (ранковий чек-ін СМ)
alter table public.store_days
  add column if not exists open_on_time     boolean,
  add column if not exists open_actual_time text,
  add column if not exists late_reason      text;
