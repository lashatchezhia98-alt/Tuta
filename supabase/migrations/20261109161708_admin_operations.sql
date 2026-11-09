alter table public.admin_memberships
  add column access_role text not null default 'admin'
    check (access_role in ('admin', 'content_editor', 'support'));
grant select (access_role), update (access_role) on public.admin_memberships to service_role;
alter table public.admin_invitations
  add column access_role text not null default 'admin'
    check (access_role in ('admin', 'content_editor', 'support'));

create or replace function public.claim_admin_invitation(p_token_hash text, p_user_id uuid, p_verified_email text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  claimed_id uuid;
  claimed_role text;
begin
  update public.admin_invitations
    set used_at = now()
    where token_hash = p_token_hash and email = p_verified_email and used_at is null
      and revoked_at is null and expires_at > now()
    returning id, access_role into claimed_id, claimed_role;
  if claimed_id is null then return false; end if;
  insert into public.admin_memberships (user_id, email, invite_id, access_role)
    values (p_user_id, p_verified_email, claimed_id, claimed_role)
    on conflict (user_id) do update set email = excluded.email, invite_id = excluded.invite_id,
      granted_at = now(), revoked_at = null, access_role = excluded.access_role
    where public.admin_memberships.revoked_at is not null;
  return true;
end;
$$;

create table public.premium_admin_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index premium_admin_grants_user_idx on public.premium_admin_grants (user_id, expires_at desc) where revoked_at is null;

create table public.member_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  audience text not null check (audience in ('all', 'free', 'premium')),
  created_at timestamptz not null default now(),
  scheduled_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index member_announcements_due_idx on public.member_announcements (scheduled_at desc, id) where cancelled_at is null;
create table public.member_announcement_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.member_announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.premium_admin_grants enable row level security;
alter table public.member_announcements enable row level security;
alter table public.member_announcement_reads enable row level security;
revoke all on public.premium_admin_grants, public.member_announcements, public.member_announcement_reads from public, anon, authenticated, service_role;
grant select, insert on public.premium_admin_grants, public.member_announcements, public.member_announcement_reads to service_role;
grant update (revoked_at) on public.premium_admin_grants to service_role;
grant update (cancelled_at) on public.member_announcements to service_role;

create function public.tuta_premium_expiry(p_user_id uuid)
returns timestamptz language sql stable security invoker set search_path = '' as $$
  select greatest(
    (select expires_at from public.premium_memberships where user_id = p_user_id),
    (select max(expires_at) from public.premium_admin_grants where user_id = p_user_id and revoked_at is null)
  );
$$;

-- Only a fixed set of account fields leaves the Auth schema. The elevated function
-- is executable exclusively by the server role; no health records are joined.
create function public.tuta_admin_users(p_query text, p_plan text, p_offset integer, p_joined_days integer)
returns table (id uuid, email text, name text, joined_at timestamptz, last_active timestamptz,
  blocked boolean, confirmed boolean, premium boolean, access_role text, doctor boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, n.name, u.created_at, u.last_sign_in_at,
    coalesce(u.banned_until > now(), false), u.email_confirmed_at is not null,
    plan.premium, a.access_role, d.user_id is not null
  from auth.users u
  cross join lateral (select left(btrim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), 120) as name) n
  left join public.admin_memberships a on a.user_id = u.id and a.revoked_at is null
  left join public.verified_doctors d on d.user_id = u.id
  left join public.premium_memberships m on m.user_id = u.id
  cross join lateral (
    select coalesce(m.expires_at > now(), false) or exists (
      select 1 from public.premium_admin_grants g where g.user_id = u.id and g.revoked_at is null and g.expires_at > now()
    ) as premium
  ) plan
  where not coalesce(u.is_anonymous, false)
    and (p_joined_days = 0 or u.created_at >= now() - make_interval(days => p_joined_days))
    and (p_query = '' or strpos(lower(coalesce(u.email, '')), lower(left(p_query, 120))) > 0
      or strpos(lower(n.name), lower(left(p_query, 120))) > 0 or u.id::text = p_query)
    and (p_plan = 'all' or (p_plan = 'premium' and plan.premium) or (p_plan = 'free' and not plan.premium))
  order by u.created_at desc nulls last, u.id
  limit 26 offset greatest(p_offset, 0);
$$;

create function public.tuta_admin_billing_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'active', (select count(*) from (
      select user_id from public.premium_memberships where expires_at > now()
      union select user_id from public.premium_admin_grants where revoked_at is null and expires_at > now()
    ) as active),
    'testTotal', coalesce(sum(amount) filter (where status = 'approved'), 0),
    'testApproved', count(*) filter (where status = 'approved'),
    'testUnsuccessful', count(*) filter (where status in ('declined','expired','failed','reversed'))
  )
  from public.premium_payments where mode = 'test' and created_at >= now() - interval '30 days';
$$;
create index premium_payments_created_idx on public.premium_payments (created_at desc, order_id);

create function public.tuta_member_announcements(p_user_id uuid)
returns table (id uuid, title text, body text, scheduled_at timestamptz, read_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  with tier as (select case when public.tuta_premium_expiry(p_user_id) > now() then 'premium' else 'free' end as name)
  select a.id, a.title, a.body, a.scheduled_at, r.read_at
  from public.member_announcements a
  cross join tier
  left join public.member_announcement_reads r on r.user_id = p_user_id and r.announcement_id = a.id
  where a.cancelled_at is null and a.scheduled_at <= now()
    and a.scheduled_at > now() - interval '30 days'
    and a.audience in ('all', tier.name)
  order by a.scheduled_at desc, a.id
  limit 50;
$$;

-- The only output is a coarse population statistic; no identifiers or free text.
create function public.tuta_admin_health_aggregates(p_symptoms text[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  with today as (select (now() at time zone 'Asia/Tbilisi')::date as day),
  raw_logs as (
    select h.user_id, case when l->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and pg_catalog.pg_input_is_valid(l->>'date', 'date') then (l->>'date')::date end as day, l->'symptoms' as symptoms
    from public.health_state h
    cross join lateral jsonb_array_elements(case when jsonb_typeof(h.payload->'logs') = 'array' then h.payload->'logs' else '[]'::jsonb end) l
  ), monthly as (
    select s.value as symptom, count(distinct (l.user_id, l.day)) as frequency
    from raw_logs l cross join today
    cross join lateral jsonb_array_elements_text(case when jsonb_typeof(l.symptoms) = 'array' then l.symptoms else '[]'::jsonb end) s(value)
    where l.day between date_trunc('month', today.day::timestamp)::date and today.day and s.value = any(p_symptoms)
    group by s.value having count(distinct l.user_id) >= 10 order by frequency desc, s.value limit 10
  ), raw_starts as (
    select h.user_id, case when p->>'start' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and pg_catalog.pg_input_is_valid(p->>'start', 'date') then (p->>'start')::date end as day
    from public.health_state h
    cross join lateral jsonb_array_elements(case when jsonb_typeof(h.payload->'periods') = 'array' then h.payload->'periods' else '[]'::jsonb end) p
  ), starts as (
    select distinct user_id, raw_starts.day from raw_starts cross join today
    where raw_starts.day between today.day - 365 and today.day
  ), deltas as (
    select user_id, day - lag(day) over (partition by user_id order by day) as days from starts
  ), per_user as (
    select user_id, count(*) as cycles, avg(days) as avg_days, min(days) as min_days, max(days) as max_days
    from deltas where days between 1 and 365 group by user_id
  ), classified as (
    select (max_days - avg_days > 7 or avg_days - min_days > 7) as irregular
    from per_user where cycles >= 3
  )
  select jsonb_build_object(
    'averageDays', (select case when count(*) >= 10 then round(avg(avg_days)) end from per_user),
    'irregularPercent', (select case when count(*) filter (where irregular) >= 10 and count(*) filter (where not irregular) >= 10
      then round(20.0 * count(*) filter (where irregular) / count(*)) * 5 end from classified),
    'symptoms', coalesce((select jsonb_agg(jsonb_build_object('id', symptom, 'count', round(frequency / 5.0) * 5) order by frequency desc, symptom) from monthly), '[]'::jsonb)
  );
$$;
grant select (user_id, payload) on public.health_state to service_role;

revoke execute on function public.tuta_premium_expiry(uuid), public.tuta_admin_users(text, text, integer, integer),
  public.tuta_admin_billing_summary(), public.tuta_member_announcements(uuid), public.tuta_admin_health_aggregates(text[])
  from public, anon, authenticated;
grant execute on function public.tuta_premium_expiry(uuid), public.tuta_admin_users(text, text, integer, integer),
  public.tuta_admin_billing_summary(), public.tuta_member_announcements(uuid), public.tuta_admin_health_aggregates(text[])
  to service_role;
