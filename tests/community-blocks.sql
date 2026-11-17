-- Run in an isolated migrated database with two confirmed test users.
begin;
do $$
declare
  members uuid[];
begin
  select array(select id from auth.users where not is_anonymous order by id limit 2) into members;
  if cardinality(members) <> 2 then raise exception 'Two test users are required'; end if;
  insert into public.community_posts (id, author_id, display_name, topic, body, is_anonymous)
  values ('67caa565-163b-47f9-bacd-ca0f030f7981', members[2], 'Test', 'questions', 'named test', false),
         ('67caa565-163b-47f9-bacd-ca0f030f7982', members[2], 'Test', 'questions', 'anonymous test', true);
  insert into public.community_member_blocks (blocker_id, blocked_id)
    values (members[1], members[2]) on conflict do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', members[1],
    'role', 'authenticated', 'is_anonymous', false)::text, true);
end;
$$;
set local role authenticated;
do $$
begin
  if exists (select 1 from public.community_posts where id = '67caa565-163b-47f9-bacd-ca0f030f7981') then
    raise exception 'Named post from blocked member was visible';
  end if;
  if not exists (select 1 from public.community_posts where
    id = '67caa565-163b-47f9-bacd-ca0f030f7982' and public_author_id is null) then
    raise exception 'Blocking changed anonymous identity visibility';
  end if;
end;
$$;
rollback;
