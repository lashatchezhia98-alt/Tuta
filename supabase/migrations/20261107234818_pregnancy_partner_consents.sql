begin;
create table public.partner_shares (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 partner_id uuid references auth.users(id) on delete cascade,
 token_hash text not null unique check(length(token_hash)=64),
 scopes jsonb not null check(jsonb_typeof(scopes)='object' and scopes ?& array['cycle','pregnancy'] and jsonb_typeof(scopes->'cycle')='boolean' and jsonb_typeof(scopes->'pregnancy')='boolean' and (scopes->>'cycle'='true' or scopes->>'pregnancy'='true')),
 label text not null check(length(btrim(label)) between 1 and 60),
 expires_at timestamptz not null,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 check(owner_id is distinct from partner_id),
 check((partner_id is null)=(accepted_at is null))
);
create index partner_shares_owner_idx on public.partner_shares(owner_id,created_at desc);
create index partner_shares_partner_idx on public.partner_shares(partner_id) where revoked_at is null;
alter table public.partner_shares enable row level security;
revoke all on public.partner_shares from public,anon,authenticated;
grant all on public.partner_shares to service_role;
-- No direct partner access to health_state. Participant-scoped server projections only.

create table public.doctor_enrollments (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check(length(email)<=254 and email=lower(btrim(email))),
 first_name text not null check(length(btrim(first_name)) between 2 and 60),
 last_name text not null check(length(btrim(last_name)) between 2 and 60),
 specialty text not null check(length(btrim(specialty)) between 1 and 120),
 bio text not null default '' check(length(bio)<=2000),
 license_reference text not null check(length(btrim(license_reference)) between 2 and 200),
 consent_confirmed boolean not null check(consent_confirmed),
 user_id uuid references auth.users(id) on delete set null,
 status text not null default 'draft' check(status in ('draft','invited','verified')),
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create index doctor_enrollments_user_idx on public.doctor_enrollments(user_id);
alter table public.doctor_enrollments enable row level security;
revoke all on public.doctor_enrollments from public,anon,authenticated;
grant all on public.doctor_enrollments to service_role;
-- Registration details and certificate references never appear in the public doctor directory.
commit;
