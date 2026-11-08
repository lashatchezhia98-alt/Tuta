-- Payment state stays controlled exclusively by the signed Flitt callback.
alter table public.market_orders
  add column if not exists fulfillment_status text not null default 'new'
    check (fulfillment_status in ('new','packing','shipped','delivered','cancelled'));
create index if not exists market_orders_created_idx on public.market_orders(created_at desc);
-- Existing RLS and service-role-only grants are deliberately unchanged.
