create table if not exists public.market_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  description text not null check (char_length(description) between 1 and 500),
  category text not null check (category in ('period-care','body-care','nutrition','accessories')),
  price_tetri integer not null check (price_tetri > 0),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total_tetri integer not null check (total_tetri > 0),
  recipient_name text not null check (char_length(recipient_name) between 2 and 120),
  address text not null check (char_length(address) between 5 and 500),
  latitude double precision,
  longitude double precision,
  status text not null default 'pending' check (status in ('pending','approved','declined','expired','reversed','processing','created')),
  payment_id text,
  mode text not null default 'test' check (mode = 'test'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create index if not exists market_products_active_sort_idx on public.market_products (is_active, sort_order, created_at desc);
create index if not exists market_orders_user_created_idx on public.market_orders (user_id, created_at desc);
create index if not exists market_orders_payment_idx on public.market_orders (order_id, status);

alter table public.market_products enable row level security;
alter table public.market_orders enable row level security;
revoke all on public.market_products, public.market_orders from anon, authenticated;
grant all on public.market_products, public.market_orders to service_role;
