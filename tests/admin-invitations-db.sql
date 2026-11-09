-- Test against a linked database without leaving fixtures or sending email.
begin;
do $$
begin
  if has_table_privilege('anon', 'public.website_copy', 'select')
    or has_table_privilege('authenticated', 'public.website_copy', 'update')
    or has_table_privilege('authenticated', 'public.admin_memberships', 'select')
    or has_function_privilege('authenticated', 'public.claim_admin_invitation(text,uuid,text)', 'execute')
    or has_function_privilege('anon', 'public.revoke_admin_membership(uuid)', 'execute')
    then raise exception 'Private admin data or function accessible to a customer role'; end if;
end;
$$;

insert into auth.users (id, email, email_confirmed_at)
  values ('ad100000-0000-4000-8000-000000000001', 'transaction-only-admin@example.test', now());
set local role service_role;
insert into public.admin_invitations (email, token_hash, expires_at)
  values ('transaction-only-admin@example.test', repeat('1', 64), now() + interval '1 hour'),
         ('transaction-only-admin@example.test', repeat('2', 64), now() + interval '1 hour'),
         ('transaction-only-admin@example.test', repeat('3', 64), now() - interval '1 hour');
do $$
declare
  person uuid := 'ad100000-0000-4000-8000-000000000001';
begin
  if public.claim_admin_invitation(repeat('1', 64), person, 'wrong@example.test')
    then raise exception 'Incorrect email used the invite'; end if;
  if public.claim_admin_invitation(repeat('3', 64), person, 'transaction-only-admin@example.test')
    then raise exception 'Expired invite accepted'; end if;
  if not public.claim_admin_invitation(repeat('1', 64), person, 'transaction-only-admin@example.test')
    then raise exception 'Valid invite rejected'; end if;
  if public.claim_admin_invitation(repeat('1', 64), person, 'transaction-only-admin@example.test')
    then raise exception 'Invitation replay succeeded'; end if;
  if not exists (select 1 from public.admin_memberships where user_id = person and revoked_at is null)
    then raise exception 'Membership not active'; end if;
  if not public.revoke_admin_membership(person)
    then raise exception 'Membership revoke failed'; end if;
  if public.claim_admin_invitation(repeat('2', 64), person, 'transaction-only-admin@example.test')
    then raise exception 'Old invite reactivated revoked membership'; end if;
  if exists (select 1 from public.admin_memberships where user_id = person and revoked_at is null)
    then raise exception 'Membership is still active'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: RLS grants, email binding, expiry, single-use and revocation' as test_result;
