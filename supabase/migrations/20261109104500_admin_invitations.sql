create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at timestamptz,
  revoked_at timestamptz
);

create table public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  invite_id uuid not null unique references public.admin_invitations(id)
);

create index admin_invitations_pending_email on public.admin_invitations (email)
  where used_at is null and revoked_at is null;

alter table public.admin_invitations enable row level security;
alter table public.admin_memberships enable row level security;
revoke all on public.admin_invitations, public.admin_memberships from public, anon, authenticated, service_role;
grant select, insert on public.admin_invitations, public.admin_memberships to service_role;
grant update (used_at, revoked_at) on public.admin_invitations to service_role;
grant update (email, invite_id, granted_at, revoked_at) on public.admin_memberships to service_role;

create or replace function public.claim_admin_invitation(p_token_hash text, p_user_id uuid, p_verified_email text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  update public.admin_invitations
    set used_at = now()
    where token_hash = p_token_hash and email = p_verified_email and used_at is null
      and revoked_at is null and expires_at > now()
    returning id into claimed_id;
  if claimed_id is null then return false; end if;

  insert into public.admin_memberships (user_id, email, invite_id)
    values (p_user_id, p_verified_email, claimed_id)
    on conflict (user_id) do update set email = excluded.email, invite_id = excluded.invite_id,
      granted_at = now(), revoked_at = null
    where public.admin_memberships.revoked_at is not null;
  return true;
end;
$$;

revoke all on function public.claim_admin_invitation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_admin_invitation(text, uuid, text) to service_role;

create or replace function public.revoke_admin_membership(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_email text;
begin
  select email into target_email from public.admin_memberships
    where user_id = p_user_id and revoked_at is null;
  if target_email is null then return false; end if;
  update public.admin_invitations set revoked_at = now()
    where email = target_email and used_at is null and revoked_at is null;
  update public.admin_memberships set revoked_at = now()
    where user_id = p_user_id and revoked_at is null;
  return found;
end;
$$;

revoke all on function public.revoke_admin_membership(uuid) from public, anon, authenticated;
grant execute on function public.revoke_admin_membership(uuid) to service_role;
