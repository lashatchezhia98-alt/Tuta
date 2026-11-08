-- No archive or soft-delete table: expire private consultation messages in-place.
create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create index if not exists consultation_messages_expiry_idx
  on public.consultation_messages(created_at);

create or replace function private.purge_expired_consultation_messages()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare removed bigint;
begin
  delete from public.consultation_messages
    where created_at <= statement_timestamp() - interval '48 hours';
  get diagnostics removed = row_count;
  -- This job's operational logs contain counts only, never message contents.
  delete from cron.job_run_details
    where jobid in (select jobid from cron.job where jobname='tuta-chat-retention-48h')
      and end_time < statement_timestamp() - interval '1 day';
  return removed;
end;
$$;
revoke all on function private.purge_expired_consultation_messages() from public, anon, authenticated;
select cron.schedule('tuta-chat-retention-48h','10 seconds',
  $$select private.purge_expired_consultation_messages();$$);
select private.purge_expired_consultation_messages();

-- Member metadata can never confer a verified doctor photo or badge.
alter table public.verified_doctors add column if not exists photo_public_id text;
alter table public.verified_doctors add constraint verified_doctor_photo_path
  check (photo_public_id is null or photo_public_id ~
    ('^tuta-doctors/' || user_id::text || '/[0-9a-f-]{36}$'));
grant update(photo_public_id) on public.verified_doctors to service_role;

-- Serialize callbacks so a replay cannot regress an approved/reversed payment.
create or replace function public.apply_flitt_market_payment(
  p_order_id text, p_payment_id text, p_status text, p_amount integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare previous_status text;
begin
  if p_status is null or p_status not in ('approved','declined','expired','reversed','processing','created') then
    return false;
  end if;
  select status into previous_status from public.market_orders
    where order_id=p_order_id and mode='test' and total_tetri=p_amount for update;
  if not found then return false; end if;
  if previous_status='reversed' or (previous_status='approved' and p_status<>'reversed') then
    return true;
  end if;
  update public.market_orders set status=p_status,
    payment_id=coalesce(p_payment_id,payment_id),updated_at=now()
    where order_id=p_order_id;
  return true;
end;
$$;
revoke all on function public.apply_flitt_market_payment(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.apply_flitt_market_payment(text,text,text,integer) to service_role;
