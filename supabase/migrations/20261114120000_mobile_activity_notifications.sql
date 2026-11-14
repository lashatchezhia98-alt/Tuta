begin;

create table public.activity_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  post_comment boolean not null default true,
  comment_reply boolean not null default true,
  care boolean not null default true,
  market boolean not null default true,
  premium boolean not null default true
);

create table public.activity_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'post_comment','comment_reply','care_message','visit_confirmed','visit_cancelled',
    'market_paid','market_payment_failed','market_shipped','market_delivered','market_cancelled',
    'premium_paid','premium_payment_failed'
  )),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  message_id uuid references public.consultation_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index activity_inbox_idx on public.activity_notifications(user_id, created_at desc, id desc);
create index activity_unread_idx on public.activity_notifications(user_id) where read_at is null;
create index activity_post_idx on public.activity_notifications(post_id) where post_id is not null;
create index activity_comment_idx on public.activity_notifications(comment_id) where comment_id is not null;
create index activity_message_idx on public.activity_notifications(message_id) where message_id is not null;

alter table public.activity_preferences enable row level security;
alter table public.activity_notifications enable row level security;
revoke all on public.activity_preferences, public.activity_notifications from public, anon, authenticated, service_role;
grant select, insert on public.activity_preferences to authenticated;
grant update (post_comment, comment_reply, care, market, premium) on public.activity_preferences to authenticated;
grant select on public.activity_notifications to authenticated;
grant update (read_at) on public.activity_notifications to authenticated;

create policy activity_preferences_read on public.activity_preferences for select to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
create policy activity_preferences_insert on public.activity_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
create policy activity_preferences_update on public.activity_preferences for update to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false))
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
create policy activity_notifications_read on public.activity_notifications for select to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false)
    and (message_id is null or created_at > now() - interval '48 hours'));
create policy activity_notifications_update on public.activity_notifications for update to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false)
    and (message_id is null or created_at > now() - interval '48 hours'))
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false)
    and (message_id is null or created_at > now() - interval '48 hours'));

create function community_private.enqueue_activity(
  recipient uuid, event_kind text, post uuid default null,
  comment uuid default null, message uuid default null, event_time timestamptz default now()
) returns boolean language sql set search_path = '' as $$
  with added as (
    insert into public.activity_notifications(user_id, kind, post_id, comment_id, message_id, created_at)
    select recipient, event_kind, post, comment, message, event_time
    where recipient is not null and coalesce((
      select case
        when event_kind = 'post_comment' then p.post_comment
        when event_kind = 'comment_reply' then p.comment_reply
        when event_kind like 'care_%' or event_kind like 'visit_%' then p.care
        when event_kind like 'market_%' then p.market
        when event_kind like 'premium_%' then p.premium
        else false end
      from public.activity_preferences p where p.user_id = recipient
    ), true)
    returning id
  ) select exists(select 1 from added);
$$;

create function community_private.record_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  post_owner uuid;
  reply_owner uuid;
  reply_sent boolean := false;
  recipient uuid;
  event_kind text;
begin
  case tg_table_name
    when 'community_comments' then
      select author_id into post_owner from public.community_posts where id = new.post_id;
      if new.parent_comment_id is not null then
        select author_id into reply_owner from public.community_comments
        where id = new.parent_comment_id and post_id = new.post_id;
        if reply_owner <> new.author_id then
          reply_sent := community_private.enqueue_activity(reply_owner, 'comment_reply', new.post_id, new.id);
        end if;
      end if;
      if post_owner <> new.author_id and (not reply_sent or post_owner is distinct from reply_owner) then
        perform community_private.enqueue_activity(post_owner, 'post_comment', new.post_id, new.id);
      end if;
    when 'consultation_messages' then
      select case when new.sender_id = t.patient_id then t.doctor_id
                  when new.sender_id = t.doctor_id then t.patient_id end
        into recipient from public.consultation_threads t where t.id = new.thread_id;
      perform community_private.enqueue_activity(recipient, 'care_message', null, null, new.id, new.created_at);
    when 'consultation_bookings' then
      if tg_op = 'INSERT' then
        if new.status = 'confirmed' then
          perform community_private.enqueue_activity(new.patient_id, 'visit_confirmed');
        end if;
      elsif new.status is distinct from old.status and new.status = 'cancelled' then
        perform community_private.enqueue_activity(new.patient_id, 'visit_cancelled');
      end if;
    when 'market_orders' then
      if new.fulfillment_status is distinct from old.fulfillment_status then
        event_kind := case new.fulfillment_status
          when 'shipped' then 'market_shipped' when 'delivered' then 'market_delivered'
          when 'cancelled' then 'market_cancelled' end;
      end if;
      if event_kind is null and new.status is distinct from old.status then
        event_kind := case when new.status = 'approved' then 'market_paid'
          when new.status in ('declined','expired','reversed') then 'market_payment_failed' end;
      end if;
      if event_kind is not null then
        perform community_private.enqueue_activity(new.user_id, event_kind);
      end if;
    when 'premium_payments' then
      if new.status is distinct from old.status then
        event_kind := case when new.status = 'approved' then 'premium_paid'
          when new.status in ('declined','expired','reversed','failed') then 'premium_payment_failed' end;
        if event_kind is not null then
          perform community_private.enqueue_activity(new.user_id, event_kind);
        end if;
      end if;
  end case;
  return new;
end;
$$;
revoke all on function community_private.enqueue_activity(uuid,text,uuid,uuid,uuid,timestamptz) from public, anon, authenticated, service_role;
revoke all on function community_private.record_activity() from public, anon, authenticated, service_role;

create trigger activity_community_comment after insert on public.community_comments
  for each row execute function community_private.record_activity();
create trigger activity_care_message after insert on public.consultation_messages
  for each row execute function community_private.record_activity();
create trigger activity_care_booking after insert or update of status on public.consultation_bookings
  for each row execute function community_private.record_activity();
create trigger activity_market_order after update of status, fulfillment_status on public.market_orders
  for each row execute function community_private.record_activity();
create trigger activity_premium_payment after update of status on public.premium_payments
  for each row execute function community_private.record_activity();

commit;
