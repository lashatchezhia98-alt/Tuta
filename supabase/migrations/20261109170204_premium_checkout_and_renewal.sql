alter table public.premium_payments
  add column checkout_url text,
  add column checkout_deadline timestamptz,
  add column renewal_requested boolean not null default false,
  add column renewal_state text check (renewal_state in ('active','disabled','starting','stopping')),
  add column renewal_changed_at timestamptz,
  add column parent_order_id text references public.premium_payments(order_id) on delete cascade,
  add column coverage_until timestamptz;

create index premium_payments_open_idx on public.premium_payments(user_id,created_at)
  where status in ('pending','created','processing');
create index premium_payments_renewal_idx on public.premium_payments(user_id,created_at desc)
  where renewal_state is not null;
create index premium_payments_parent_idx on public.premium_payments(parent_order_id);

-- Guard every manual insert, including from an older server deployment.
create function public.guard_premium_checkout()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.parent_order_id is not null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 906249));
  if exists(select 1 from public.premium_memberships m where m.user_id=new.user_id and m.expires_at>clock_timestamp()) then
    raise sqlstate 'PT409' using message='premium_paid';
  end if;
  if exists(select 1 from public.premium_payments p where p.user_id=new.user_id and p.renewal_state in ('active','starting','stopping')) then
    raise sqlstate 'PT409' using message='premium_renewing';
  end if;
  if exists(select 1 from public.premium_payments p where p.user_id=new.user_id and p.status in ('pending','created','processing')) then
    raise sqlstate 'PT409' using message='premium_pending';
  end if;
  return new;
end;
$$;
create trigger premium_checkout_guard before insert on public.premium_payments
  for each row execute function public.guard_premium_checkout();
revoke execute on function public.guard_premium_checkout() from public, anon, authenticated;

create or replace function public.apply_flitt_premium_payment(p_order_id text, p_payment_id text, p_status text, p_amount integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare payment public.premium_payments%rowtype; account uuid; end_at timestamptz; term interval;
begin
  if p_status is null or p_status not in ('approved','declined','expired','reversed','processing','created') then return false; end if;
  select user_id into account from public.premium_payments where order_id=p_order_id and mode='test' and amount=p_amount;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(account::text, 906249));
  select * into payment from public.premium_payments where order_id=p_order_id for update;
  if not found or payment.currency<>'GEL' or (payment.payment_id is not null and p_payment_id is not null and payment.payment_id<>p_payment_id) then return false; end if;
  if payment.status='reversed' or (payment.status='approved' and p_status<>'reversed') then return true; end if;
  if payment.status in ('declined','expired','failed') and p_status in ('created','processing') then return true; end if;

  if p_status='approved' then
    term := case when payment.plan='yearly' then interval '1 year' else interval '30 days' end;
    select expires_at into end_at from public.premium_memberships where user_id=account;
    -- A second manual payment never stacks paid time. Renewals may arrive
    -- shortly before the boundary and must preserve the remaining coverage.
    if end_at is null or end_at <= clock_timestamp() or
      (payment.parent_order_id is not null and end_at <= clock_timestamp()+interval '24 hours') then
      end_at := greatest(end_at,clock_timestamp()) + term;
      insert into public.premium_memberships(user_id,expires_at,updated_at) values(account,end_at,now())
        on conflict (user_id) do update set expires_at=excluded.expires_at,updated_at=now();
    else end_at := null;
    end if;
    update public.premium_payments set coverage_until=end_at,
      renewal_state=case when renewal_requested and parent_order_id is null then coalesce(renewal_state,'active') else renewal_state end
      where order_id=p_order_id;
  elsif p_status='reversed' and payment.status='approved' then
    -- A reversal of an old or overlapping order must not remove newer paid access.
    update public.premium_memberships set expires_at=least(expires_at,clock_timestamp()),updated_at=now()
      where user_id=account and (expires_at=payment.coverage_until or (payment.checkout_deadline is null and payment.coverage_until is null
        and not exists(select 1 from public.premium_payments newer where newer.user_id=account and newer.status='approved' and newer.updated_at>payment.updated_at)));
  end if;
  update public.premium_payments set status=p_status,payment_id=coalesce(p_payment_id,payment_id),updated_at=now(),
    checkout_url=case when p_status in ('approved','declined','expired','reversed') then null else checkout_url end
    where order_id=p_order_id;
  return true;
end;
$$;

create function public.apply_flitt_premium_renewal(p_parent text,p_order_id text,p_payment_id text,p_status text,p_amount integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare parent public.premium_payments%rowtype;
begin
  if p_order_id=p_parent or p_status is null or p_status not in ('approved','declined','expired','reversed','processing','created') then return false; end if;
  select * into parent from public.premium_payments where order_id=p_parent and mode='test' and amount=p_amount
    and renewal_requested and parent_order_id is null and status in ('approved','reversed');
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(parent.user_id::text,906249));
  insert into public.premium_payments(order_id,user_id,amount,currency,status,mode,plan,parent_order_id)
    values(p_order_id,parent.user_id,p_amount,'GEL','pending','test',parent.plan,p_parent)
    on conflict (order_id) do nothing;
  if not exists(select 1 from public.premium_payments where order_id=p_order_id and parent_order_id=p_parent) then return false; end if;
  return public.apply_flitt_premium_payment(p_order_id,p_payment_id,p_status,p_amount);
end;
$$;

create function public.begin_premium_renewal_change(p_user_id uuid,p_enabled boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare payment public.premium_payments%rowtype; target text; pending text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,906249));
  target := case when p_enabled then 'active' else 'disabled' end;
  pending := case when p_enabled then 'starting' else 'stopping' end;
  select * into payment from public.premium_payments where user_id=p_user_id and renewal_state is not null
    order by (renewal_state in ('active','starting','stopping')) desc, created_at desc limit 1 for update;
  if not found then return jsonb_build_object('code','no_subscription'); end if;
  if payment.renewal_state=target then return jsonb_build_object('code','unchanged','state',target); end if;
  if payment.renewal_state in ('starting','stopping') and (payment.renewal_state<>pending or payment.renewal_changed_at>clock_timestamp()-interval '45 seconds') then
    return jsonb_build_object('code','busy');
  end if;
  if p_enabled and payment.renewal_state<>'starting' and (payment.status<>'approved' or not exists(
      select 1 from public.premium_memberships m where m.user_id=p_user_id and m.expires_at>clock_timestamp()
        and exists(select 1 from public.premium_payments p where p.status='approved' and p.coverage_until=m.expires_at
          and (p.order_id=payment.order_id or p.parent_order_id=payment.order_id)))) then
    return jsonb_build_object('code','expired');
  end if;
  update public.premium_payments set renewal_state=pending,renewal_changed_at=clock_timestamp() where order_id=payment.order_id;
  return jsonb_build_object('code','ready','orderId',payment.order_id,'pending',pending,'state',target);
end;
$$;

revoke execute on function public.apply_flitt_premium_renewal(text,text,text,text,integer),
  public.begin_premium_renewal_change(uuid,boolean) from public,anon,authenticated;
grant execute on function public.apply_flitt_premium_renewal(text,text,text,text,integer),
  public.begin_premium_renewal_change(uuid,boolean) to service_role;
