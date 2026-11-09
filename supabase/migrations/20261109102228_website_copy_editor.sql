create table public.website_copy (
  id text primary key check (id = 'global'),
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  published jsonb not null default '{}'::jsonb check (jsonb_typeof(published) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  published_at timestamptz
);

alter table public.website_copy enable row level security;
revoke all on table public.website_copy from public, anon, authenticated;
grant select, update on table public.website_copy to service_role;
insert into public.website_copy (id) values ('global');
