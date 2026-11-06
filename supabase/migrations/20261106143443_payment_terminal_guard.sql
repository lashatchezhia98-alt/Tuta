create or replace function public.apply_flitt_premium_payment(
  p_order_id text,
  p_payment_id text,
  p_status text,
  p_amount integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_previous_status text;
  v_plan text;
begin
  if p_status not in ('approved', 'declined', 'expired', 'reversed', 'processing', 'created') then
    return false;
  end if;

  select payment.user_id, payment.status, payment.plan
    into v_user_id, v_previous_status, v_plan
    from public.premium_payments as payment
    where payment.order_id = p_order_id
      and payment.mode = 'test'
      and payment.amount = p_amount
      and payment.currency = 'GEL'
    for update;

  if not found then
    return false;
  end if;

  -- Terminal states cannot be replayed through intermediate callbacks to extend access.
  if v_previous_status = 'reversed' then
    return true;
  end if;
  if v_previous_status = 'approved' and p_status <> 'reversed' then
    return true;
  end if;

  update public.premium_payments
    set status = p_status,
        payment_id = coalesce(p_payment_id, payment_id),
        updated_at = now()
    where order_id = p_order_id;

  if p_status = 'approved' and v_previous_status <> 'approved' then
    insert into public.premium_memberships (user_id, expires_at, updated_at)
      values (v_user_id, now() + case when v_plan = 'yearly' then interval '1 year' else interval '30 days' end, now())
      on conflict (user_id) do update
        set expires_at = greatest(public.premium_memberships.expires_at, now()) + case when v_plan = 'yearly' then interval '1 year' else interval '30 days' end,
            updated_at = now();
  elsif p_status = 'reversed' and v_previous_status = 'approved' then
    update public.premium_memberships
      set expires_at = least(expires_at, now()), updated_at = now()
      where user_id = v_user_id;
  end if;

  return true;
end;
$$;

revoke all on function public.apply_flitt_premium_payment(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.apply_flitt_premium_payment(text, text, text, integer) to service_role;
