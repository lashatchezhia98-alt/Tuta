-- Run through the linked SQL connection. Everything, including the synthetic
-- auth user and badge, is rolled back and never becomes visible outside here.
begin;
insert into auth.users(id,email,email_confirmed_at)
 values ('d0c00000-0000-4000-8000-000000000001','transaction-only-doctor@example.test',now());
insert into public.doctor_enrollments(id,email,first_name,last_name,specialty,license_reference,consent_confirmed,user_id,status)
 values ('d0c00000-0000-4000-8000-000000000002','transaction-only-doctor@example.test','Test','Doctor','Test only','TRANSACTION-TEST',true,'d0c00000-0000-4000-8000-000000000001','invited');
set local role service_role;
select public.approve_doctor_enrollment('d0c00000-0000-4000-8000-000000000002');
do $$ begin
 if not exists (select 1 from public.verified_doctors where user_id='d0c00000-0000-4000-8000-000000000001') then raise exception 'Missing badge';end if;
 if not exists (select 1 from public.doctor_profiles where user_id='d0c00000-0000-4000-8000-000000000001' and not active) then raise exception 'Profile must remain inactive';end if;
 if not exists (select 1 from public.doctor_enrollments where id='d0c00000-0000-4000-8000-000000000002' and status='verified' and verified_at is not null) then raise exception 'Missing verification';end if;
 begin
  perform public.approve_doctor_enrollment('d0c00000-0000-4000-8000-000000000002');
  raise exception 'Replay must fail';
 exception when invalid_parameter_value then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: atomic doctor approval, inactive public profile, replay guard, rollback' as test_result;
