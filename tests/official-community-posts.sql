-- Run against a database with the migration applied. Fixtures are rolled back.
begin;

insert into auth.users (id, email, raw_user_meta_data)
values ('408ef71d-a50e-4887-b062-23cf8670b798', 'tuta-official-fixture@example.test', '{"nickname":"თუთა"}');

set local role service_role;
with p as (
  insert into public.community_posts (display_name, author_initials, topic, body, image_public_id, is_official, official_publisher)
  values ('თუთა', 'თ', 'wellbeing', 'Test official post', 'tuta-community/official/private_test', true, 'owner')
  returning id
)
select set_config('tuta_test.official_post_id', id::text, true) from p;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"408ef71d-a50e-4887-b062-23cf8670b798","is_anonymous":false}', true);

do $$
declare
  official_id uuid := current_setting('tuta_test.official_post_id')::uuid;
  own_post uuid;
begin
  if not exists (select 1 from public.community_posts p where p.id = official_id
    and p.public_author_id is null and not p.is_anonymous and p.display_name = 'თუთა'
    and p.image_public_id = 'tuta-community/official/private_test') then
    raise exception 'The member feed did not return the official post';
  end if;
  if has_column_privilege(current_user, 'public.community_posts', 'official_publisher', 'SELECT') then
    raise exception 'The publishing admin must not be exposed';
  end if;
  begin
    insert into public.community_posts (display_name, author_initials, topic, body, is_official, official_publisher)
    values ('თუთა', 'თ', 'wellbeing', 'Rejected post', true, 'owner');
    raise exception 'A member was able to publish an official post';
  exception when insufficient_privilege then null;
  end;

  insert into public.community_posts (author_id, display_name, topic, body)
  values (auth.uid(), 'Member', 'wellbeing', 'Normal member post') returning id into own_post;
  if not exists (select 1 from public.community_posts p where p.id = own_post and p.public_author_id = auth.uid()) then
    raise exception 'A regular post must still use the member identity';
  end if;
  if not exists (select 1 from public.community_post_owners o where o.post_id = own_post) then
    raise exception 'The existing ownership trigger stopped recording member posts';
  end if;
  if exists (select 1 from public.community_post_owners o where o.post_id = official_id) then
    raise exception 'A member cannot own an official post';
  end if;

  insert into public.community_comments (post_id, author_id, display_name, body)
    values (official_id, auth.uid(), 'Member', 'Member comment on official post');
end;
$$;

reset role;
set local role anon;
do $$
begin
  if has_column_privilege(current_user, 'public.community_posts', 'id', 'SELECT') then
    raise exception 'The member-only feed must not become readable to guests';
  end if;
end;
$$;

rollback;
