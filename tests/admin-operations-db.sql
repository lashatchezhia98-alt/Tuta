-- Rollback-only fixtures: no emails, payments or notifications are sent.
begin;
do $$
begin
  if has_table_privilege('authenticated', 'public.member_announcements', 'select')
    or has_table_privilege('anon', 'public.premium_admin_grants', 'insert')
    or has_function_privilege('authenticated', 'public.tuta_admin_users(text,text,integer,integer)', 'execute')
    or has_function_privilege('authenticated', 'public.tuta_admin_health_aggregates(text[])', 'execute')
    or has_function_privilege('authenticated', 'public.tuta_member_announcements(uuid)', 'execute')
  then raise exception 'Private operations accessible to customer role'; end if;
end;
$$;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at)
  select ('ad900000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'tuta-operations-db-fixture-' || i || '@example.test',
    now(), '{"first_name":"DB fixture","date_of_birth":"1970-01-01"}'::jsonb, now()
  from generate_series(1, 10) i;
insert into public.health_state (user_id, payload)
  select ('ad900000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    jsonb_build_object('periods', jsonb_build_array(jsonb_build_object('start', current_date - 30), jsonb_build_object('start', current_date - 2), jsonb_build_object('start','2024-02-30')),
    'logs', jsonb_build_array(jsonb_build_object('date', (now() at time zone 'Asia/Tbilisi')::date, 'symptoms', jsonb_build_array('fixture-aggregate-10','fixture-aggregate-9')),
      jsonb_build_object('date','2024-02-30','symptoms','invalid')))
  from generate_series(1, 9) i;
insert into public.health_state (user_id, payload)
  values ('ad900000-0000-4000-8000-000000000010', jsonb_build_object('logs',
    jsonb_build_array(jsonb_build_object('date', (now() at time zone 'Asia/Tbilisi')::date, 'symptoms', jsonb_build_array('fixture-aggregate-10')))));
insert into public.premium_memberships(user_id,expires_at)
  values ('ad900000-0000-4000-8000-000000000001', now() + interval '3 days');
set local role service_role;
insert into public.admin_invitations(email, token_hash, access_role)
  values ('tuta-operations-db-fixture-1@example.test', repeat('9', 64), 'support');
insert into public.premium_admin_grants (user_id, reason, expires_at)
  values ('ad900000-0000-4000-8000-000000000001', 'rollback test', now() + interval '6 days');
insert into public.member_announcements(id,title,body,audience,scheduled_at,cancelled_at) values
  ('ad910000-0000-4000-8000-000000000001','Fixture all','Body','all',now(),null),
  ('ad910000-0000-4000-8000-000000000002','Fixture premium','Body','premium',now(),null),
  ('ad910000-0000-4000-8000-000000000003','Fixture free','Body','free',now(),null),
  ('ad910000-0000-4000-8000-000000000004','Fixture future','Body','all',now()+interval '2 hours',null),
  ('ad910000-0000-4000-8000-000000000005','Fixture cancelled','Body','all',now(),now());
insert into public.member_announcement_reads(user_id,announcement_id)
  values ('ad900000-0000-4000-8000-000000000001','ad910000-0000-4000-8000-000000000001');
do $$
declare
  premium_user uuid := 'ad900000-0000-4000-8000-000000000001';
  free_user uuid := 'ad900000-0000-4000-8000-000000000002';
  aggregate jsonb;
begin
  if not public.claim_admin_invitation(repeat('9',64), premium_user, 'tuta-operations-db-fixture-1@example.test')
    then raise exception 'Valid invitation was rejected'; end if;
  if not exists(select 1 from public.admin_memberships where user_id = premium_user and access_role = 'support')
    then raise exception 'Invitation assigned wrong role'; end if;
  if public.tuta_premium_expiry(premium_user) < now() + interval '5 days'
    or public.tuta_premium_expiry(free_user) is not null
  then raise exception 'Wrong effective Premium'; end if;
  update public.premium_admin_grants set revoked_at = now() where user_id = premium_user;
  if public.tuta_premium_expiry(premium_user) <> now() + interval '3 days'
    then raise exception 'Revocation removed paid entitlement'; end if;
  if (select count(*) from public.tuta_admin_users('tuta-operations-db-fixture-', 'premium', 0, 7)) <> 1
    or (select count(*) from public.tuta_admin_users('tuta-operations-db-fixture-', 'free', 0, 7)) <> 9
    then raise exception 'Incorrect account filters'; end if;
  if not exists (select 1 from public.tuta_member_announcements(premium_user) where title = 'Fixture all' and read_at is not null)
    or not exists (select 1 from public.tuta_member_announcements(premium_user) where title = 'Fixture premium')
    or not exists (select 1 from public.tuta_member_announcements(free_user) where title = 'Fixture free')
    or exists (select 1 from public.tuta_member_announcements(premium_user) where title in ('Fixture free','Fixture future','Fixture cancelled'))
    or exists (select 1 from public.tuta_member_announcements(free_user) where title = 'Fixture premium' or (title = 'Fixture all' and read_at is not null))
  then raise exception 'Invalid announcement audience, schedule or read isolation'; end if;
  aggregate := public.tuta_admin_health_aggregates(array['fixture-aggregate-10','fixture-aggregate-9']);
  if aggregate->'symptoms' <> '[{"id":"fixture-aggregate-10","count":10}]'::jsonb
    then raise exception 'Symptom aggregation threshold failed'; end if;
  if not (public.tuta_admin_billing_summary() ? 'active') then raise exception 'Missing billing summary'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: admin permissions, search, premium entitlement, scheduling, read isolation and aggregate thresholds' as test_result;
