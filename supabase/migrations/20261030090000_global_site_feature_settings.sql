create table if not exists public.site_settings (
  id text primary key check (id = 'global'),
  features jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;

drop policy if exists "Anyone can read public site feature flags" on public.site_settings;
create policy "Anyone can read public site feature flags"
  on public.site_settings for select
  to anon, authenticated
  using (id = 'global');

insert into public.site_settings (id, features)
values (
  'global',
  '{"community":true,"period":true,"dailyLog":true,"insights":true,"library":true,"premium":true,"doctorConsultation":true,"doctorReport":true}'::jsonb
)
on conflict (id) do nothing;
