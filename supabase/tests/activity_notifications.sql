-- Run within a transaction; fixtures must never persist.
insert into auth.users(id) values
  ('7c259a20-0cf2-4468-91bb-9a069690a101'),
  ('7c259a20-0cf2-4468-91bb-9a069690a102'),
  ('7c259a20-0cf2-4468-91bb-9a069690a103');
insert into public.community_posts(id,author_id,display_name,topic,body,is_anonymous)
values ('7c259a20-0cf2-4468-91bb-9a069690a110','7c259a20-0cf2-4468-91bb-9a069690a101','Test','questions','Activity fixture',true);
insert into public.community_comments(id,post_id,author_id,display_name,body,parent_comment_id) values
  ('7c259a20-0cf2-4468-91bb-9a069690a111','7c259a20-0cf2-4468-91bb-9a069690a110','7c259a20-0cf2-4468-91bb-9a069690a101','Test','Self comment',null),
  ('7c259a20-0cf2-4468-91bb-9a069690a112','7c259a20-0cf2-4468-91bb-9a069690a110','7c259a20-0cf2-4468-91bb-9a069690a102','Test','Reply to post author','7c259a20-0cf2-4468-91bb-9a069690a111'),
  ('7c259a20-0cf2-4468-91bb-9a069690a113','7c259a20-0cf2-4468-91bb-9a069690a110','7c259a20-0cf2-4468-91bb-9a069690a103','Test','Reply to other person','7c259a20-0cf2-4468-91bb-9a069690a112');
do $$
begin
  if (select count(*) from public.activity_notifications where post_id='7c259a20-0cf2-4468-91bb-9a069690a110') <> 3
  or not exists (select 1 from public.activity_notifications where comment_id='7c259a20-0cf2-4468-91bb-9a069690a112' and kind='comment_reply' and user_id='7c259a20-0cf2-4468-91bb-9a069690a101')
  then raise exception 'Incorrect self-notification or reply deduplication'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7c259a20-0cf2-4468-91bb-9a069690a101","role":"authenticated"}',true);
insert into public.activity_preferences(user_id,post_comment,comment_reply) values
  ('7c259a20-0cf2-4468-91bb-9a069690a101',false,false);
insert into public.account_deletion_requests(user_id) values ('7c259a20-0cf2-4468-91bb-9a069690a101');
update public.activity_notifications set read_at=now();
do $$
begin
  if (select count(*) from public.activity_notifications where read_at is not null) <> 2 then
    raise exception 'Owner could not read or mark their items'; end if;
  begin
    insert into public.activity_preferences(user_id) values ('7c259a20-0cf2-4468-91bb-9a069690a103');
    raise exception 'Cross-account preferences write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims','{"sub":"7c259a20-0cf2-4468-91bb-9a069690a102","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.activity_notifications where read_at is null) <> 1
  or exists(select 1 from public.account_deletion_requests)
  then raise exception 'Cross-account read or update allowed'; end if;
end $$;
reset role;
insert into public.community_comments(post_id,author_id,display_name,body,parent_comment_id)
values ('7c259a20-0cf2-4468-91bb-9a069690a110','7c259a20-0cf2-4468-91bb-9a069690a103','Test','Suppressed reply','7c259a20-0cf2-4468-91bb-9a069690a111');
do $$
begin
  if (select count(*) from public.activity_notifications where post_id='7c259a20-0cf2-4468-91bb-9a069690a110') <> 3
  then raise exception 'Disabled notification was created'; end if;
  if has_table_privilege('anon','public.activity_notifications','SELECT')
  or has_function_privilege('authenticated','community_private.record_activity()','EXECUTE')
  then raise exception 'Unexpected activity permissions'; end if;
end $$;
