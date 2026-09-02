-- =========================================================
--  Dnipro-M — модуль «Склад господарських потреб»
--  Виконати в Supabase → SQL Editor (після schema.sql). Ідемпотентно.
--
--  Ролі: керує складом — кабінет lviv-lypynskoho (там фізично центральний
--  склад) + olha (робить прихід/ціни/довідник) + керівник/адмін.
--  СМ: формує замовлення, приймає постачання, робить акти списання.
-- =========================================================

-- ---------- довідник товарів ----------
create table if not exists public.supply_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'інше',   -- напої | гігієна | канцелярія | прибирання | пакування | інше
  unit        text not null default 'шт',     -- шт | уп | кг | л
  unit_cost   numeric(12,2) not null default 0,
  min_central numeric(10,2) not null default 0,
  min_salon   numeric(10,2) not null default 0,
  active      boolean not null default true,
  sort        int not null default 100,
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists supply_items_active_idx on public.supply_items (active, sort, name);

create table if not exists public.supply_price_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.supply_items(id) on delete cascade,
  unit_cost numeric(12,2) not null,
  at timestamptz not null default now(),
  by text not null default ''
);

-- ---------- залишки: склад × товар ----------
create table if not exists public.supply_stock (
  warehouse  text not null,                   -- 'central' | <salon_key>
  item_id    uuid not null references public.supply_items(id) on delete cascade,
  qty        numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (warehouse, item_id)
);

-- ---------- складські акти (журнал руху) ----------
create table if not exists public.supply_acts (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,                 -- receipt | writeoff | shipment | receive | adjust
  warehouse    text not null,                 -- основний склад акта
  counterparty text not null default '',      -- постачальник/накладна (receipt) або інший склад
  reason       text not null default '',      -- writeoff: вільний текст (один на акт)
  order_id     uuid,                          -- shipment/receive: зв'язок із замовленням
  total        numeric(14,2) not null default 0,
  created_by   text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists supply_acts_wh_idx on public.supply_acts (warehouse, created_at desc);
create index if not exists supply_acts_kind_idx on public.supply_acts (kind, created_at desc);

create table if not exists public.supply_act_lines (
  act_id    uuid not null references public.supply_acts(id) on delete cascade,
  item_id   uuid not null references public.supply_items(id) on delete restrict,
  qty       numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  primary key (act_id, item_id)
);

-- ---------- замовлення салону ----------
create table if not exists public.supply_orders (
  id           uuid primary key default gen_random_uuid(),
  salon_key    text not null,
  status       text not null default 'draft', -- draft | submitted | shipped | received
  note         text not null default '',
  created_by   text not null default '',
  created_at   timestamptz not null default now(),
  submitted_at timestamptz,
  shipped_at   timestamptz,
  received_at  timestamptz
);
create index if not exists supply_orders_salon_idx on public.supply_orders (salon_key, status, created_at desc);

create table if not exists public.supply_order_lines (
  order_id    uuid not null references public.supply_orders(id) on delete cascade,
  item_id     uuid not null references public.supply_items(id) on delete restrict,
  qty_req     numeric(12,2) not null default 0,
  qty_shipped numeric(12,2),
  primary key (order_id, item_id)
);

-- =========================================================
--  ДОПОМІЖНІ
-- =========================================================
create or replace function public.supply_wh_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.my_cabinet_key() in ('lviv-lypynskoho', 'olha')
  );
$$;

-- перегляд складу: central — керує складом / ТМ / бухгалтер;
-- салон — свій / його ТМ / керує складом / бухгалтер
create or replace function public.supply_can_view(w text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_manager_or_admin()
    or public.supply_wh_manage()
    or public.my_cabinet_type() = 'accountant'
    or (w = 'central' and public.my_cabinet_type() = 'tm')
    or (w <> 'central' and w = public.my_cabinet_key())
    or (w <> 'central' and public.my_cabinet_type() = 'tm'
        and public.current_salon_tm(w) = public.my_cabinet_key())
  );
$$;

-- =========================================================
--  RLS
-- =========================================================
alter table public.supply_items      enable row level security;
alter table public.supply_price_log  enable row level security;
alter table public.supply_stock      enable row level security;
alter table public.supply_acts       enable row level security;
alter table public.supply_act_lines  enable row level security;
alter table public.supply_orders     enable row level security;
alter table public.supply_order_lines enable row level security;

drop policy if exists supply_items_read on public.supply_items;
create policy supply_items_read on public.supply_items for select using (auth.uid() is not null);
drop policy if exists supply_items_write on public.supply_items;
create policy supply_items_write on public.supply_items for all
  using (public.supply_wh_manage()) with check (public.supply_wh_manage());

drop policy if exists supply_price_log_read on public.supply_price_log;
create policy supply_price_log_read on public.supply_price_log for select using (auth.uid() is not null);

drop policy if exists supply_stock_read on public.supply_stock;
create policy supply_stock_read on public.supply_stock for select using (public.supply_can_view(warehouse));

drop policy if exists supply_acts_read on public.supply_acts;
create policy supply_acts_read on public.supply_acts for select using (public.supply_can_view(warehouse));
drop policy if exists supply_act_lines_read on public.supply_act_lines;
create policy supply_act_lines_read on public.supply_act_lines for select using (
  exists (select 1 from public.supply_acts a where a.id = act_id and public.supply_can_view(a.warehouse))
);

drop policy if exists supply_orders_read on public.supply_orders;
create policy supply_orders_read on public.supply_orders for select using (public.supply_can_view(salon_key));
drop policy if exists supply_orders_write on public.supply_orders;
create policy supply_orders_write on public.supply_orders for all using (
  auth.uid() is not null and (public.supply_wh_manage() or salon_key = public.my_cabinet_key())
) with check (
  auth.uid() is not null and (public.supply_wh_manage() or salon_key = public.my_cabinet_key())
);
drop policy if exists supply_order_lines_rw on public.supply_order_lines;
create policy supply_order_lines_rw on public.supply_order_lines for all using (
  exists (select 1 from public.supply_orders o where o.id = order_id
    and (public.supply_wh_manage() or o.salon_key = public.my_cabinet_key() or public.supply_can_view(o.salon_key)))
) with check (
  exists (select 1 from public.supply_orders o where o.id = order_id
    and (public.supply_wh_manage() or o.salon_key = public.my_cabinet_key()))
);

-- realtime
do $$ begin
  perform 1;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='supply_stock') then alter publication supabase_realtime add table public.supply_stock; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='supply_acts') then alter publication supabase_realtime add table public.supply_acts; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='supply_orders') then alter publication supabase_realtime add table public.supply_orders; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='supply_items') then alter publication supabase_realtime add table public.supply_items; end if;
end $$;

-- =========================================================
--  RPC: єдина точка руху товару (security definer, робить всю математику)
--  payload = { kind, warehouse, counterparty, reason, order_id,
--              lines: [ { item_id, qty, unit_cost? } ] }
--  kind: receipt(+wh) | writeoff(-wh) | shipment(-central, ставить order.shipped)
--        | receive(+salon, ставить order.received) | adjust(встановлює абсолютну qty)
-- =========================================================
create or replace function public.supply_act(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_kind text := payload->>'kind';
  v_wh   text := payload->>'warehouse';
  v_cp   text := coalesce(payload->>'counterparty','');
  v_reason text := coalesce(payload->>'reason','');
  v_order uuid := nullif(payload->>'order_id','')::uuid;
  v_by   text := coalesce(public.my_cabinet_key(),'');
  v_act  uuid;
  v_total numeric := 0;
  ln jsonb;
  v_item uuid; v_qty numeric; v_cost numeric; v_cur numeric;
  allowed boolean;
begin
  if auth.uid() is null then raise exception 'unauth'; end if;

  -- дозволи
  allowed := case
    when v_kind in ('receipt','shipment','adjust') then public.supply_wh_manage()
    when v_kind = 'writeoff' then public.supply_wh_manage() or v_wh = public.my_cabinet_key()
    when v_kind = 'receive'  then public.supply_wh_manage()
      or (v_order is not null and exists (select 1 from public.supply_orders o where o.id=v_order and o.salon_key=public.my_cabinet_key()))
    else false end;
  if not allowed then raise exception 'forbidden'; end if;

  insert into public.supply_acts (kind, warehouse, counterparty, reason, order_id, created_by)
  values (v_kind, v_wh, v_cp, v_reason, v_order, v_by)
  returning id into v_act;

  for ln in select * from jsonb_array_elements(payload->'lines')
  loop
    v_item := (ln->>'item_id')::uuid;
    v_qty  := coalesce((ln->>'qty')::numeric, 0);
    if v_item is null then continue; end if;
    select unit_cost into v_cost from public.supply_items where id = v_item;
    -- прихід може задавати нову ціну
    if v_kind = 'receipt' and (ln ? 'unit_cost') and (ln->>'unit_cost') <> '' then
      v_cost := (ln->>'unit_cost')::numeric;
      if v_cost is distinct from (select unit_cost from public.supply_items where id=v_item) then
        update public.supply_items set unit_cost = v_cost, updated_at = now() where id = v_item;
        insert into public.supply_price_log (item_id, unit_cost, by) values (v_item, v_cost, v_by);
      end if;
    end if;
    v_cost := coalesce(v_cost, 0);

    insert into public.supply_act_lines (act_id, item_id, qty, unit_cost)
    values (v_act, v_item, v_qty, v_cost)
    on conflict (act_id, item_id) do update set qty = excluded.qty, unit_cost = excluded.unit_cost;
    v_total := v_total + v_qty * v_cost;

    -- рух залишку
    if v_kind = 'adjust' then
      insert into public.supply_stock (warehouse, item_id, qty, updated_at)
      values (v_wh, v_item, v_qty, now())
      on conflict (warehouse, item_id) do update set qty = excluded.qty, updated_at = now();
    else
      declare d numeric;
      begin
        d := case
          when v_kind = 'receipt'  then v_qty
          when v_kind = 'receive'  then v_qty
          when v_kind = 'writeoff' then -v_qty
          when v_kind = 'shipment' then -v_qty
        end;
        insert into public.supply_stock (warehouse, item_id, qty, updated_at)
        values (case when v_kind='shipment' then 'central' else v_wh end, v_item, d, now())
        on conflict (warehouse, item_id) do update set qty = public.supply_stock.qty + d, updated_at = now();
      end;
    end if;
  end loop;

  update public.supply_acts set total = v_total where id = v_act;

  -- статуси замовлення
  if v_kind = 'shipment' and v_order is not null then
    update public.supply_orders set status='shipped', shipped_at=now() where id = v_order;
    for ln in select * from jsonb_array_elements(payload->'lines') loop
      update public.supply_order_lines set qty_shipped = coalesce((ln->>'qty')::numeric,0)
      where order_id = v_order and item_id = (ln->>'item_id')::uuid;
    end loop;
  elsif v_kind = 'receive' and v_order is not null then
    update public.supply_orders set status='received', received_at=now() where id = v_order;
  end if;

  return v_act;
end $$;

-- зміна ціни (Липинського/Оля/керівник)
create or replace function public.supply_set_price(p_item uuid, p_cost numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.supply_wh_manage() then raise exception 'forbidden'; end if;
  update public.supply_items set unit_cost = p_cost, updated_at = now() where id = p_item;
  insert into public.supply_price_log (item_id, unit_cost, by) values (p_item, p_cost, coalesce(public.my_cabinet_key(),''));
end $$;

grant execute on function public.supply_act(jsonb) to authenticated;
grant execute on function public.supply_set_price(uuid, numeric) to authenticated;
