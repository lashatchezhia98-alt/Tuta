-- Run only against a disposable local or staging database after migrations.
begin;
do $$
declare
  doctor uuid := gen_random_uuid();
  patient uuid := gen_random_uuid();
  enrollment uuid;
  thread uuid;
  slot uuid;
begin
  if has_function_privilege('authenticated', 'public.remove_doctor_enrollment(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.remove_doctor_enrollment(uuid)', 'EXECUTE') then
    raise exception 'Doctor removal is not admin-only';
  end if;

  insert into auth.users(id) values (doctor), (patient);
  insert into public.doctor_enrollments
    (email, first_name, last_name, specialty, license_reference, consent_confirmed, user_id, status)
    values (doctor::text || '@example.test', 'Test', 'Doctor', 'Test', 'Test ref', true, doctor, 'invited')
    returning id into enrollment;
  perform public.approve_doctor_enrollment(enrollment);
  insert into public.consultation_threads(doctor_id, patient_id, patient_label)
    values (doctor, patient, 'Test patient') returning id into thread;
  begin
    perform public.remove_doctor_enrollment(enrollment);
    raise exception 'Removal succeeded despite conversation history';
  exception when foreign_key_violation then null;
  end;
  if not exists (select 1 from public.verified_doctors where user_id = doctor)
    or not exists (select 1 from public.doctor_enrollments where id = enrollment) then
    raise exception 'Rejected removal changed the doctor record';
  end if;

  delete from public.consultation_threads where id = thread;
  insert into public.consultation_slots(doctor_id, starts_at, location)
    values (doctor, '2099-01-01T12:00:00Z', 'Test clinic') returning id into slot;
  insert into public.consultation_bookings(slot_id, patient_id, patient_label)
    values (slot, patient, 'Test patient');
  begin
    perform public.remove_doctor_enrollment(enrollment);
    raise exception 'Removal succeeded despite a booking';
  exception when foreign_key_violation then null;
  end;

  delete from public.consultation_bookings where slot_id = slot;
  perform public.remove_doctor_enrollment(enrollment);
  if exists (select 1 from public.doctor_enrollments where id = enrollment)
    or exists (select 1 from public.verified_doctors where user_id = doctor)
    or exists (select 1 from public.consultation_slots where id = slot)
    or not exists (select 1 from auth.users where id = doctor) then
    raise exception 'Doctor removal did not preserve the personal account or clear the professional records';
  end if;
end;
$$;
rollback;
