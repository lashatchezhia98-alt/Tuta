begin;
insert into auth.users(id) values ('f17a0000-0000-4000-8000-000000000001');
set local role service_role;
do $$
declare
  uid uuid:='f17a0000-0000-4000-8000-000000000001';
  first_order text:='tuta-f17a0000-0000-4000-8000-000000000002';
  other_order text:='tuta-f17a0000-0000-4000-8000-000000000003';
  expiration timestamptz;
  action jsonb;
begin
  if has_function_privilege('authenticated','public.begin_premium_renewal_change(uuid,boolean)','execute')
    or has_function_privilege('anon','public.apply_flitt_premium_renewal(text,text,text,text,integer)','execute')
    or has_column_privilege('authenticated','public.premium_payments','checkout_url','select') then
    raise exception 'Unprivileged subscription access';
  end if;
  insert into public.premium_payments(order_id,user_id,amount,currency,plan,status,mode,renewal_requested,checkout_deadline)
    values(first_order,uid,499,'GEL','monthly','pending','test',true,now()+interval '15 minutes');
  begin
    insert into public.premium_payments(order_id,user_id,amount,currency,plan,status,mode)
      values(other_order,uid,4990,'GEL','yearly','pending','test');
    raise exception 'Second checkout was accepted';
  exception when sqlstate 'PT409' then
    if sqlerrm<>'premium_pending' then raise; end if;
  end;
  if not public.apply_flitt_premium_payment(first_order,'998701','approved',499) then raise exception 'Approval failed'; end if;
  expiration:=public.tuta_premium_expiry(uid);
  if expiration < now()+interval '29 days' then raise exception 'Paid access not granted'; end if;
  begin
    insert into public.premium_payments(order_id,user_id,amount,currency,plan,status,mode)
      values(other_order,uid,4990,'GEL','yearly','pending','test');
    raise exception 'Repeat purchase was accepted';
  exception when sqlstate 'PT409' then
    if sqlerrm<>'premium_paid' then raise; end if;
  end;
  action:=public.begin_premium_renewal_change(uid,false);
  if action->>'pending'<>'stopping' or public.tuta_premium_expiry(uid)<>expiration then raise exception 'Stopping altered paid access'; end if;
  if public.begin_premium_renewal_change(uid,true)->>'code'<>'busy' then raise exception 'Overlapping provider changes accepted'; end if;
  update public.premium_payments set renewal_state='disabled' where order_id=first_order;
  if public.begin_premium_renewal_change(uid,true)->>'pending'<>'starting' then raise exception 'Resume was rejected'; end if;
  update public.premium_payments set renewal_state='active' where order_id=first_order;
  if public.apply_flitt_premium_renewal(first_order,'fixture-wrong-amount','998702','approved',4990) then raise exception 'Wrong renewal amount accepted'; end if;
  if not public.apply_flitt_premium_renewal(first_order,'fixture-early','998703','approved',499) or public.tuta_premium_expiry(uid)<>expiration then
    raise exception 'Early renewal altered coverage';
  end if;
  update public.premium_memberships set expires_at=now()+interval '5 minutes' where user_id=uid;
  perform public.apply_flitt_premium_renewal(first_order,'fixture-renewal','998704','approved',499);
  expiration:=public.tuta_premium_expiry(uid);
  if expiration<now()+interval '30 days' then raise exception 'Renewal did not grant the next term'; end if;
  perform public.apply_flitt_premium_renewal(first_order,'fixture-renewal','998704','approved',499);
  if public.tuta_premium_expiry(uid)<>expiration then raise exception 'Replay added coverage twice'; end if;
  perform public.apply_flitt_premium_payment(first_order,'998701','reversed',499);
  if public.tuta_premium_expiry(uid)<>expiration then raise exception 'Old reversal removed a newer payment'; end if;
end;
$$;
reset role;
rollback;
select true as premium_checkout_renewal_and_permission_checks_passed;
