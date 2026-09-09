-- =========================================================
--  СКЛАД · захисти від нелогічних операцій (2026-09-09)
--  • не можна списати / відправити більше, ніж є на складі
--  • не можна списувати кількість <= 0
--  • інвентаризація не може бути відʼємною
--  Помилка: 'not_enough:<назва>:<є>:<просять>' — клієнт показує зрозуміло.
-- =========================================================
drop function if exists public.supply_act(jsonb);
create or replace function public.supply_act(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_kind text := payload->>'kind';
  v_wh   text := payload->>'warehouse';
  v_cp   text := coalesce(payload->>'counterparty','');
  v_reason text := coalesce(payload->>'reason','');
  v_article text := coalesce(payload->>'article','');
  v_order uuid := nullif(payload->>'order_id','')::uuid;
  v_by   text := coalesce(public.my_cabinet_key(),'');
  v_act  uuid;
  v_total numeric := 0;
  ln jsonb;
  v_item uuid; v_qty numeric; v_cost numeric; v_old_cost numeric;
  v_recv_cost numeric; v_have numeric; v_new_cost numeric;
  v_src_wh text; v_iname text;
  v_price_changes jsonb := '[]'::jsonb;
  allowed boolean;
begin
  if auth.uid() is null then raise exception 'unauth'; end if;

  allowed := case
    when v_kind in ('receipt','shipment','adjust') then public.supply_wh_manage()
    when v_kind = 'writeoff' then public.supply_wh_manage() or v_wh = public.my_cabinet_key()
    when v_kind = 'receive'  then public.supply_wh_manage()
      or (v_order is not null and exists (select 1 from public.supply_orders o where o.id=v_order and o.salon_key=public.my_cabinet_key()))
    else false end;
  if not allowed then raise exception 'forbidden'; end if;

  if v_kind = 'writeoff' and coalesce(v_article,'') = '' then v_article := 'store'; end if;

  insert into public.supply_acts (kind, warehouse, counterparty, reason, article, order_id, created_by)
  values (v_kind, v_wh, v_cp, v_reason, v_article, v_order, v_by)
  returning id into v_act;

  for ln in select * from jsonb_array_elements(payload->'lines')
  loop
    v_item := (ln->>'item_id')::uuid;
    v_qty  := coalesce((ln->>'qty')::numeric, 0);
    if v_item is null then continue; end if;
    if v_kind <> 'adjust' and v_qty <= 0 then continue; end if;
    if v_kind = 'adjust' and v_qty < 0 then
      raise exception 'negative_adjust';
    end if;

    select unit_cost, name into v_old_cost, v_iname from public.supply_items where id = v_item;
    v_cost := v_old_cost;

    -- склад, з якого йде рух (для shipment — центральний)
    v_src_wh := case when v_kind = 'shipment' then 'central' else v_wh end;

    -- захист: не можна винести більше, ніж є (списання / відправлення)
    if v_kind in ('writeoff','shipment') then
      select coalesce(qty,0) into v_have from public.supply_stock
       where warehouse = v_src_wh and item_id = v_item;
      v_have := coalesce(v_have, 0);
      if v_qty > v_have then
        raise exception 'not_enough:%:%:%', coalesce(v_iname,'позиція'), v_have, v_qty;
      end if;
    end if;

    -- прихід по вказаній ціні → середньозважена по складу-одержувачу
    if v_kind = 'receipt' and (ln ? 'unit_cost') and (ln->>'unit_cost') <> '' then
      v_recv_cost := (ln->>'unit_cost')::numeric;
      select coalesce(qty,0) into v_have from public.supply_stock where warehouse = v_wh and item_id = v_item;
      v_have := coalesce(v_have, 0);
      if v_have > 0 and v_qty > 0 then
        v_new_cost := round((v_have * coalesce(v_old_cost,0) + v_qty * v_recv_cost) / (v_have + v_qty), 2);
      else
        v_new_cost := v_recv_cost;
      end if;
      v_cost := v_recv_cost;
      if v_new_cost is distinct from v_old_cost then
        update public.supply_items set unit_cost = v_new_cost, updated_at = now() where id = v_item;
        insert into public.supply_price_log (item_id, unit_cost, by) values (v_item, v_new_cost, v_by);
        v_price_changes := v_price_changes || jsonb_build_object(
          'item_id', v_item, 'name', v_iname,
          'old', coalesce(v_old_cost,0), 'new', v_new_cost);
      end if;
    end if;
    v_cost := coalesce(v_cost, 0);

    insert into public.supply_act_lines (act_id, item_id, qty, unit_cost)
    values (v_act, v_item, v_qty, v_cost)
    on conflict (act_id, item_id) do update set qty = excluded.qty, unit_cost = excluded.unit_cost;
    v_total := v_total + v_qty * v_cost;

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
        values (v_src_wh, v_item, d, now())
        on conflict (warehouse, item_id) do update set qty = public.supply_stock.qty + d, updated_at = now();
      end;
    end if;
  end loop;

  update public.supply_acts set total = v_total where id = v_act;

  if v_kind = 'shipment' and v_order is not null then
    update public.supply_orders set status='shipped', shipped_at=now() where id = v_order;
    for ln in select * from jsonb_array_elements(payload->'lines') loop
      update public.supply_order_lines set qty_shipped = coalesce((ln->>'qty')::numeric,0)
      where order_id = v_order and item_id = (ln->>'item_id')::uuid;
    end loop;
  elsif v_kind = 'receive' and v_order is not null then
    update public.supply_orders set status='received', received_at=now() where id = v_order;
  end if;

  return jsonb_build_object('act_id', v_act, 'total', v_total, 'price_changes', v_price_changes);
end $$;
