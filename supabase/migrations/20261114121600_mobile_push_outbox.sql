begin;

-- Tokens are write-only for app clients. Delivery is bound to a live Auth session.
create table public.activity_push_devices (
  token text primary key check (token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{1,180}\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique references auth.sessions(id) on delete cascade,
  language text not null check (language in ('ka','en'))
);
create index activity_push_devices_owner_idx on public.activity_push_devices(user_id);
alter table public.activity_push_devices enable row level security;
revoke all on public.activity_push_devices from public, anon, authenticated, service_role;
grant select (session_id) on public.activity_push_devices to authenticated;
create policy push_devices_read on public.activity_push_devices for select to authenticated
  using (user_id = (select auth.uid()) and session_id::text = (select auth.jwt()->>'session_id'));

create function public.activity_push_set_device(p_token text, p_language text, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare account uuid := auth.uid();
declare auth_session uuid := (auth.jwt()->>'session_id')::uuid;
begin
  if account is null or account is distinct from p_user or coalesce(auth.jwt()->>'is_anonymous' = 'true',false) then
    raise insufficient_privilege;
  end if;
  perform 1 from auth.sessions where id=auth_session and user_id=account
    and (not_after is null or not_after > now()) for update;
  if not found then raise insufficient_privilege; end if;
  if p_token is null then
    delete from public.activity_push_devices where session_id=auth_session;
  else
    delete from public.activity_push_devices where session_id=auth_session and token<>p_token;
    insert into public.activity_push_devices(token,user_id,session_id,language)
    values(p_token,account,auth_session,p_language)
    on conflict(token) do update set language=excluded.language,session_id=excluded.session_id
    where activity_push_devices.user_id=account;
    if not found then raise insufficient_privilege; end if;
  end if;
end;
$$;
revoke all on function public.activity_push_set_device(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.activity_push_set_device(text,text,uuid) to authenticated;

create table community_private.activity_push_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.activity_notifications(id) on delete cascade,
  token text not null references public.activity_push_devices(token) on delete cascade,
  next_at timestamptz not null default now(),
  attempts int not null default 0,
  lease uuid,
  ticket text,
  unique (notification_id, token)
);
create index activity_push_jobs_due_idx on community_private.activity_push_jobs(next_at, id);
create index activity_push_jobs_token_idx on community_private.activity_push_jobs(token);
alter table community_private.activity_push_jobs enable row level security;
revoke all on community_private.activity_push_jobs from public, anon, authenticated, service_role;

create function community_private.activity_push_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into community_private.activity_push_jobs(notification_id, token)
  select new.id, d.token from public.activity_push_devices d where d.user_id = new.user_id;
  return new;
end;
$$;
revoke all on function community_private.activity_push_enqueue() from public, anon, authenticated, service_role;
create trigger activity_push_enqueue after insert on public.activity_notifications
  for each row execute function community_private.activity_push_enqueue();

-- Only service_role can call these worker endpoints. No end-user can read the queue.
create function public.activity_push_claim() returns table(job uuid, device text, lang text, claim uuid, receipt text, eligible boolean)
language sql security definer set search_path = '' as $$
  with picked as (
    select j.id from community_private.activity_push_jobs j
    where j.next_at <= now() order by j.next_at,j.id
    limit 100 for update skip locked
  ), leased as (
    update community_private.activity_push_jobs j
    set next_at = now() + interval '3 minutes', lease = gen_random_uuid(), attempts = j.attempts + 1
    from picked where j.id = picked.id
    returning j.*
  )
  select j.id,j.token,d.language,j.lease,j.ticket,
    j.attempts <= 8 and n.created_at > now() - interval '1 day'
      and (j.ticket is not null or (
        n.read_at is null and (s.not_after is null or s.not_after > now())
        and coalesce(case
          when n.kind = 'post_comment' then p.post_comment
          when n.kind = 'comment_reply' then p.comment_reply
          when n.kind = 'care_message' or n.kind like 'visit_%' then p.care
          when n.kind like 'market_%' then p.market
          when n.kind like 'premium_%' then p.premium
          end,true)
      ))
  from leased j
  join public.activity_notifications n on n.id=j.notification_id
  join public.activity_push_devices d on d.token=j.token
  join auth.sessions s on s.id=d.session_id and s.user_id=d.user_id
  left join public.activity_preferences p on p.user_id=d.user_id;
$$;

create function public.activity_push_finish(p_job uuid,p_claim uuid,p_result text,p_ticket text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target text;
begin
  if p_result = 'retry' then
    update community_private.activity_push_jobs set next_at=now()+interval '5 minutes',lease=null
    where id=p_job and lease=p_claim;
  elsif p_result = 'ticket' and length(p_ticket) between 1 and 100 then
    update community_private.activity_push_jobs
    set ticket=p_ticket,next_at=now()+interval '15 minutes',lease=null,attempts=0
    where id=p_job and lease=p_claim;
  elsif p_result = 'unregistered' then
    select token into target from community_private.activity_push_jobs where id=p_job and lease=p_claim for update;
    delete from public.activity_push_devices where token=target;
  elsif p_result = 'done' then
    delete from community_private.activity_push_jobs where id=p_job and lease=p_claim;
  end if;
end;
$$;
revoke all on function public.activity_push_claim(), public.activity_push_finish(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.activity_push_claim(), public.activity_push_finish(uuid,uuid,text,text) to service_role;
commit;
