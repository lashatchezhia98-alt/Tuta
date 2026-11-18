begin;

alter table public.market_products
  add column stock_quantity integer check (stock_quantity >= 0);
alter table public.market_orders
  add column recipient_phone text check (recipient_phone ~ '^[+]?[0-9]{7,15}$'),
  add column order_number bigint,
  add column delivery_fee_tetri integer not null default 0 check (delivery_fee_tetri >= 0);

create sequence public.market_order_number_seq;
alter sequence public.market_order_number_seq owned by public.market_orders.order_number;
with numbered as (
  select id, row_number() over (order by created_at, id) as number from public.market_orders
)
update public.market_orders o set order_number = numbered.number from numbered where numbered.id = o.id;
select setval('public.market_order_number_seq', coalesce((select max(order_number) from public.market_orders), 0) + 1, false);
alter table public.market_orders alter column order_number set default nextval('public.market_order_number_seq'),
  alter column order_number set not null;
create unique index market_orders_number_idx on public.market_orders(order_number);
grant usage on sequence public.market_order_number_seq to service_role;

-- Reserve in the same transaction that creates the order. Sort UUID locks to
-- avoid deadlocks between carts containing the same products in different order.
create function private.market_order_inventory() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  product_id uuid;
  quantity integer;
  available integer;
  active boolean;
  reserved boolean;
  next_items jsonb := '[]'::jsonb;
  reserve_now boolean := false;
  release_now boolean := false;
begin
  if tg_op = 'INSERT' then
    reserve_now := true;
  elsif old.status <> new.status then
    release_now := new.status in ('declined','expired') and old.status not in ('declined','expired','approved','reversed');
    reserve_now := new.status = 'approved' and old.status in ('declined','expired')
      and exists (select 1 from jsonb_array_elements(old.items) i where i ? 'stockReserved');
  end if;
  if not reserve_now and not release_now then return new; end if;
  for item in select value from jsonb_array_elements(new.items) order by (value->>'productId')::uuid
  loop
    product_id := (item->>'productId')::uuid;
    quantity := (item->>'quantity')::integer;
    reserved := coalesce((item->>'stockReserved')::boolean, false);
    if release_now and reserved then
      update public.market_products set stock_quantity = stock_quantity + quantity
        where id = product_id and stock_quantity is not null;
      item := item || '{"stockReserved":false}'::jsonb;
    elsif reserve_now then
      select p.stock_quantity, p.is_active into available, active
        from public.market_products p where p.id = product_id for update;
      if not found or not active or quantity is null or quantity < 1 or quantity > 20
        or (available is not null and available < quantity) then
        raise exception 'Market product unavailable' using errcode = 'P0001';
      end if;
      if available is not null then
        update public.market_products set stock_quantity = available - quantity where id = product_id;
      end if;
      item := item || jsonb_build_object('stockReserved', available is not null);
    end if;
    next_items := next_items || jsonb_build_array(item);
  end loop;
  new.items := next_items;
  return new;
end;
$$;
revoke all on function private.market_order_inventory() from public, anon, authenticated;
grant execute on function private.market_order_inventory() to service_role;
create trigger market_order_inventory before insert or update of status on public.market_orders
for each row execute function private.market_order_inventory();

commit;
