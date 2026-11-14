-- Run after the push migration, in a transaction that is rolled back.
insert into auth.users(id) values
  ('7c259a20-0cf2-4468-91bb-9a069690a201'),
  ('7c259a20-0cf2-4468-91bb-9a069690a202');
insert into auth.sessions(id,user_id) values
  ('7c259a20-0cf2-4468-91bb-9a069690a211','7c259a20-0cf2-4468-91bb-9a069690a201'),
  ('7c259a20-0cf2-4468-91bb-9a069690a212','7c259a20-0cf2-4468-91bb-9a069690a202');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7c259a20-0cf2-4468-91bb-9a069690a201","session_id":"7c259a20-0cf2-4468-91bb-9a069690a211"}',true);
select public.activity_push_set_device('ExpoPushToken[fixture_one]','ka','7c259a20-0cf2-4468-91bb-9a069690a201');
do $$
begin
  if (select count(session_id) from public.activity_push_devices) <> 1 then raise exception 'Missing own device'; end if;
  if has_column_privilege(current_user,'public.activity_push_devices','token','select')
     or has_function_privilege(current_user,'public.activity_push_claim()','execute')
  then raise exception 'Device token or queue exposed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"7c259a20-0cf2-4468-91bb-9a069690a202","session_id":"7c259a20-0cf2-4468-91bb-9a069690a212"}',true);
do $$
begin
  if exists(select session_id from public.activity_push_devices) then raise exception 'Cross-account read'; end if;
  begin
    perform public.activity_push_set_device('ExpoPushToken[fixture_one]','en','7c259a20-0cf2-4468-91bb-9a069690a202');
    raise exception 'Cross-account token takeover';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
insert into public.activity_notifications(user_id,kind)
values ('7c259a20-0cf2-4468-91bb-9a069690a201','post_comment');
insert into public.activity_preferences(user_id,post_comment)
values ('7c259a20-0cf2-4468-91bb-9a069690a201',false);
do $$
declare queued record;
begin
  select * into queued from public.activity_push_claim() where device='ExpoPushToken[fixture_one]';
  if not found or queued.eligible then raise exception 'Opt-out failed to suppress queued push'; end if;
  perform public.activity_push_finish(queued.job,gen_random_uuid(),'done');
  if not exists(select 1 from community_private.activity_push_jobs where id=queued.job) then raise exception 'Stale lease deleted job'; end if;
  perform public.activity_push_finish(queued.job,queued.claim,'done');
  if exists(select 1 from community_private.activity_push_jobs where id=queued.job) then raise exception 'Valid lease did not delete job'; end if;
end $$;
insert into public.activity_notifications(user_id,kind)
values ('7c259a20-0cf2-4468-91bb-9a069690a201','comment_reply');
delete from auth.sessions where id='7c259a20-0cf2-4468-91bb-9a069690a211';
do $$
begin
  if exists(select 1 from community_private.activity_push_jobs where token='ExpoPushToken[fixture_one]')
  or exists(select 1 from public.activity_push_devices where token='ExpoPushToken[fixture_one]')
  then raise exception 'Revoked session still has a push device or queued delivery'; end if;
end $$;
