-- Disposable fixtures only: the entire verification is rolled back.
begin;
do $$
declare doctor uuid:=gen_random_uuid(); patient uuid:=gen_random_uuid();
  thread uuid:=gen_random_uuid(); order_key text:='tuta-market-check-'||gen_random_uuid()::text;
  removed bigint; state text;
begin
  insert into auth.users(id) values(doctor),(patient);
  insert into public.verified_doctors(user_id,first_name,last_name) values(doctor,'Test','Doctor');
  insert into public.doctor_profiles(user_id,specialty,bio,active) values(doctor,'Test','',true);
  insert into public.consultation_threads(id,doctor_id,patient_id,patient_label) values(thread,doctor,patient,'Test');
  insert into public.consultation_messages(thread_id,sender_id,body,created_at) values
    (thread,patient,'expired fixture',statement_timestamp()-interval '49 hours'),
    (thread,doctor,'boundary fixture',statement_timestamp()-interval '48 hours'),
    (thread,patient,'live fixture',statement_timestamp()-interval '47 hours');
  removed:=private.purge_expired_consultation_messages();
  if removed<2 or (select count(*) from public.consultation_messages where thread_id=thread)<>1 then
    raise exception '48 hour cleanup failed';
  end if;
  if has_table_privilege('authenticated','public.consultation_messages','SELECT')
    or has_column_privilege('authenticated','public.verified_doctors','photo_public_id','UPDATE')
    or has_function_privilege('authenticated','public.apply_flitt_market_payment(text,text,text,integer)','EXECUTE') then
    raise exception 'Unexpected public access';
  end if;
  begin
    update public.verified_doctors set photo_public_id='https://example.invalid/not-a-doctor-photo' where user_id=doctor;
    raise exception 'Invalid photo was accepted';
  exception when check_violation then null; end;
  insert into public.market_orders(order_id,user_id,items,total_tetri,recipient_name,address)
    values(order_key,patient,'[]',499,'Test','Test address');
  perform public.apply_flitt_market_payment(order_key,'test-payment','approved',499);
  perform public.apply_flitt_market_payment(order_key,null,'processing',499);
  select status into state from public.market_orders where order_id=order_key;
  if state<>'approved' then raise exception 'Approved status regressed'; end if;
  perform public.apply_flitt_market_payment(order_key,null,'reversed',499);
  perform public.apply_flitt_market_payment(order_key,null,'approved',499);
  select status into state from public.market_orders where order_id=order_key;
  if state<>'reversed' then raise exception 'Reversal replay accepted'; end if;
  if public.apply_flitt_market_payment(order_key,null,'approved',500) then raise exception 'Incorrect amount accepted'; end if;
end;
$$;
rollback;
select true as chat_expiry_photo_permissions_and_payment_replay_checks_passed;
