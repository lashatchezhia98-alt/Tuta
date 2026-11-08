begin;
grant select,insert on public.verified_doctors to service_role;
-- Partners get only the API's consented projection, never direct table access.
grant select on public.health_state to service_role;
-- Called only after server-side admin, consent and confirmed-email checks.
-- Invoker security plus explicit grants prevents browser-issued doctor badges.
create function public.approve_doctor_enrollment(enrollment_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare enrollment public.doctor_enrollments%rowtype;
begin
 select * into enrollment from public.doctor_enrollments where id=enrollment_id for update;
 if not found or enrollment.status <> 'invited' or enrollment.user_id is null or not enrollment.consent_confirmed then
  raise exception 'Enrollment not ready' using errcode='22023';
 end if;
 insert into public.verified_doctors(user_id,first_name,last_name)
 values(enrollment.user_id,enrollment.first_name,enrollment.last_name)
 on conflict (user_id) do nothing;
 insert into public.doctor_profiles(user_id,specialty,bio,active)
 values(enrollment.user_id,enrollment.specialty,enrollment.bio,false)
 on conflict (user_id) do nothing;
 update public.doctor_enrollments set status='verified',verified_at=now() where id=enrollment_id;
end;
$$;
revoke all on function public.approve_doctor_enrollment(uuid) from public,anon,authenticated;
grant execute on function public.approve_doctor_enrollment(uuid) to service_role;
commit;
