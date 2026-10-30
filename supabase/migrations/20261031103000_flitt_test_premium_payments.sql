create table if not exists public.premium_payments (
  order_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  currency text not null check (currency = 'GEL'),
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null check (status in ('pending', 'created', 'processing', 'approved', 'declined', 'expired', 'reversed', 'failed')),
  mode text not null check (mode = 'test'),
  payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan = 'monthly' and amount = 499) or (plan = 'yearly' and amount = 4990))
);

create index if not exists premium_payments_user_created_idx
  on public.premium_payments (user_id, created_at desc);

create table if not exists public.premium_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.premium_payments enable row level security;
alter table public.premium_memberships enable row level security;

revoke all on public.premium_payments from public, anon, authenticated;
revoke all on public.premium_memberships from public, anon, authenticated;
grant all on public.premium_payments to service_role;
grant all on public.premium_memberships to service_role;

grant select on public.premium_memberships to authenticated;
drop policy if exists "Users can read their own Premium membership" on public.premium_memberships;
create policy "Users can read their own Premium membership"
  on public.premium_memberships for select
  to authenticated
  using ((select auth.uid()) = user_id);

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

  if v_previous_status = 'approved' and p_status = 'approved' then
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
