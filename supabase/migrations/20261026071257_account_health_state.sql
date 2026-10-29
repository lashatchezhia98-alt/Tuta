-- The cycle and journal are a private, versioned snapshot shared by web and mobile.
-- Predictions are computed on each client; no predicted health data is stored.
create table public.health_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"version":1,"lang":"ka","name":"","cycleLength":28,"periods":[],"logs":[]}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint health_state_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint health_state_payload_size check (octet_length(payload::text) <= 524288)
);

alter table public.health_state enable row level security;

create policy "Read own health state" on public.health_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own health state" on public.health_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own health state" on public.health_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own health state" on public.health_state
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.health_state to authenticated;

-- Realtime only notifies the owner: its subscription is filtered by user_id
-- and Supabase checks the row's SELECT policy before broadcasting.
alter publication supabase_realtime add table public.health_state;
