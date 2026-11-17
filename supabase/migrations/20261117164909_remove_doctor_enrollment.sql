begin;

grant delete on public.verified_doctors to service_role;

create function public.remove_doctor_enrollment(enrollment_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare enrollment public.doctor_enrollments%rowtype;
begin
  select * into enrollment from public.doctor_enrollments
    where id = enrollment_id for update;
  if not found then
    raise exception 'Enrollment not found' using errcode = '22023';
  end if;

  if enrollment.status = 'verified' and enrollment.user_id is not null then
    if exists (select 1 from public.doctor_enrollments
      where user_id = enrollment.user_id and status = 'verified' and id <> enrollment.id) then
      raise exception 'Multiple verified enrollments' using errcode = '55000';
    end if;
    -- Cascades only to the professional profile and unbooked slots. The
    -- non-cascading booking and thread FKs reject and roll back the entire
    -- operation when an existing consultation depends on the profile.
    delete from public.verified_doctors where user_id = enrollment.user_id;
  end if;
  delete from public.doctor_enrollments where id = enrollment.id;
end;
$$;

revoke all on function public.remove_doctor_enrollment(uuid) from public, anon, authenticated;
grant execute on function public.remove_doctor_enrollment(uuid) to service_role;

commit;
