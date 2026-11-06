-- Run against the linked Tuta project. Every fixture is rolled back, including Auth users.
begin;
do $$
declare
 doctor uuid:=gen_random_uuid();patient uuid:=gen_random_uuid();stranger uuid:=gen_random_uuid();
 slot uuid;thread uuid;expiry timestamptz;order_key text:='tuta-test-'||gen_random_uuid()::text;
begin
 insert into auth.users(id) values(doctor),(patient),(stranger);
 insert into public.verified_doctors(user_id,first_name,last_name) values(doctor,'Transaction','Test');
 insert into public.doctor_profiles(user_id,specialty,active) values(doctor,'Rollback-only fixture',true);
 insert into public.consultation_slots(doctor_id,starts_at,location) values(doctor,date_trunc('hour',now()+interval '1 day'),'Rollback-only fixture') returning id into slot;
 insert into public.consultation_bookings(slot_id,patient_id,patient_label) values(slot,patient,'Fixture');
 begin
   insert into public.consultation_bookings(slot_id,patient_id,patient_label) values(slot,stranger,'Fixture');
   raise exception 'FAIL: double booking allowed';
 exception when unique_violation then null;
 end;
 update public.consultation_bookings set status='cancelled' where slot_id=slot;
 insert into public.consultation_bookings(slot_id,patient_id,patient_label) values(slot,stranger,'Fixture');
 insert into public.consultation_threads(doctor_id,patient_id,patient_label) values(doctor,patient,'Fixture') returning id into thread;
 begin
   insert into public.consultation_messages(thread_id,sender_id,body) values(thread,stranger,'Must fail');
   raise exception using errcode='XX000',message='FAIL: nonparticipant message allowed';
 exception when raise_exception then null;
 end;
 insert into public.consultation_messages(thread_id,sender_id,body) values(thread,patient,'Allowed');
 begin
   insert into public.consultation_messages(thread_id,sender_id,body) values(thread,patient,'Rate limit must apply');
   raise exception using errcode='XX000',message='FAIL: rate limit missing';
 exception when raise_exception then null;
 end;
 insert into public.consultation_messages(thread_id,sender_id,body) values(thread,doctor,'Allowed doctor reply');
 insert into public.premium_payments(order_id,user_id,amount,currency,plan,status,mode) values(order_key,patient,499,'GEL','monthly','pending','test');
 perform public.apply_flitt_premium_payment(order_key,order_key,'approved',499);
 select expires_at into expiry from public.premium_memberships where user_id=patient;
 perform public.apply_flitt_premium_payment(order_key,order_key,'processing',499);
 perform public.apply_flitt_premium_payment(order_key,order_key,'approved',499);
 if (select expires_at from public.premium_memberships where user_id=patient)<>expiry then raise exception 'FAIL: replay extended membership';end if;
 perform public.apply_flitt_premium_payment(order_key,order_key,'reversed',499);
 perform public.apply_flitt_premium_payment(order_key,order_key,'approved',499);
 if (select expires_at from public.premium_memberships where user_id=patient)>now() then raise exception 'FAIL: reversed payment reactivated';end if;
 if has_table_privilege('anon','public.consultation_messages','select') or has_table_privilege('authenticated','public.consultation_messages','insert') then raise exception 'FAIL: care API can be bypassed';end if;
 if has_table_privilege('authenticated','public.articles','insert') or has_table_privilege('anon','public.articles','select') then raise exception 'FAIL: draft access';end if;
 if has_function_privilege('authenticated','public.apply_flitt_premium_payment(text,text,text,integer)','execute') then raise exception 'FAIL: payment grant';end if;
 if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relname in('articles','doctor_profiles','consultation_slots','consultation_bookings','consultation_threads','consultation_messages','premium_memberships','premium_payments') and not relrowsecurity) then raise exception 'FAIL: missing RLS';end if;
end $$;
select 'PASS: booking uniqueness, cancellation, participant guard, rate limit, payment replay, grants and RLS; fixtures rolled back' as verification;
rollback;
