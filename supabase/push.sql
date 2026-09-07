-- =========================================================
--  WEB PUSH — підписки пристроїв на сповіщення (ранковий підсумок)
-- =========================================================
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  cabinet_key text not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  ua          text not null default '',
  created_at  timestamptz not null default now(),
  last_sent   timestamptz,
  last_error  text
);
create index if not exists push_sub_cab_idx on public.push_subscriptions (cabinet_key);

alter table public.push_subscriptions enable row level security;

-- пристрій керує лише своїми підписками (свій кабінет)
drop policy if exists push_sub_all on public.push_subscriptions;
create policy push_sub_all on public.push_subscriptions for all
  using (auth.uid() is not null and cabinet_key = public.my_cabinet_key())
  with check (auth.uid() is not null and cabinet_key = public.my_cabinet_key());

-- ---------- pg_cron: щоранку кличемо edge function push-send ----------
create extension if not exists pg_net;

create or replace function public.push_send_kick()
returns void language plpgsql security definer set search_path = public as $$
declare anon text := '<VITE_SUPABASE_ANON_KEY>';  -- anon-ключ проєкту (публічний)
begin
  perform net.http_post(
    url := 'https://taiqrxlehnfkuvokgwqu.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon,'apikey',anon),
    body := '{}'::jsonb
  );
end $$;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'push-morning') then
    perform cron.unschedule('push-morning');
  end if;
end $$;
-- 05:10 UTC ≈ 08:10 за Києвом (літо)
select cron.schedule('push-morning', '10 5 * * *', $$select public.push_send_kick()$$);
