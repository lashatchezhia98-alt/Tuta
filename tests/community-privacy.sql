-- Run only against a project with at least one permanent auth user.
-- Every inserted row is rolled back; no post or comment is retained.
begin;

do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object(
      'sub', (select id from auth.users where is_anonymous is false limit 1),
      'role', 'authenticated',
      'is_anonymous', false
    )::text, true);
end;
$$;

set local role authenticated;

insert into public.community_posts
  (author_id, display_name, topic, body, is_anonymous)
values
  (auth.uid(), 'Member', 'questions', 'tuta-private-test-post', true);

insert into public.community_comments
  (post_id, author_id, display_name, body)
select id, auth.uid(), 'Member', 'tuta-private-test-comment'
from public.community_posts where body = 'tuta-private-test-post';

insert into public.community_comments
  (post_id, parent_comment_id, author_id, display_name, body, is_anonymous)
select c.post_id, c.id, auth.uid(), 'Member', 'tuta-private-test-reply', true
from public.community_comments as c where c.body = 'tuta-private-test-comment';

insert into public.community_posts
  (author_id, display_name, topic, body)
values
  (auth.uid(), 'Member', 'questions', 'tuta-private-test-named-post');

insert into public.community_comments
  (post_id, author_id, display_name, body)
select id, auth.uid(), 'Member', 'tuta-private-test-post-author-comment'
from public.community_posts where body = 'tuta-private-test-named-post';

do $$
begin
  begin
    insert into public.community_comments
      (post_id, author_id, display_name, body, is_anonymous)
    select id, auth.uid(), 'Member', 'tuta-private-test-disallowed-anonymous', true
    from public.community_posts where body = 'tuta-private-test-named-post';
    raise exception 'Anonymous comments on named posts were not rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.community_comments
      (post_id, parent_comment_id, author_id, display_name, body)
    select p.id, c.id, auth.uid(), 'Member', 'tuta-private-test-wrong-parent'
    from public.community_posts as p
    cross join public.community_comments as c
    where p.body = 'tuta-private-test-named-post'
      and c.body = 'tuta-private-test-comment';
    raise exception 'A reply pointed to a comment on another post';
  exception when foreign_key_violation then null;
  end;
end;
$$;

select
  (select count(*) = 1 from public.community_posts
    where body = 'tuta-private-test-post'
      and is_anonymous and display_name = 'Anonymous'
      and public_author_id is null and author_initials = '?') as anonymous_post_hidden,
  (select count(*) = 1 from public.community_posts
    where body = 'tuta-private-test-named-post'
      and author_initials <> '') as named_post_has_initials,
  (select count(*) = 1 from public.community_post_owners as o
    join public.community_posts as p on p.id = o.post_id
    where p.body = 'tuta-private-test-post') as owner_can_manage,
  (select count(*) = 1 from public.community_comments as reply
    join public.community_comments as parent
      on reply.parent_comment_id = parent.id and reply.post_id = parent.post_id
    where reply.body = 'tuta-private-test-reply'
      and parent.body = 'tuta-private-test-comment'
      and reply.is_anonymous and reply.display_name = 'Anonymous' and reply.is_post_author
      and reply.public_author_id is null) as anonymous_reply_targets_comment,
  (select count(*) = 1 from public.community_comments
    where body = 'tuta-private-test-comment'
      and not is_post_author) as named_comment_does_not_unmask_anonymous_post,
  (select count(*) = 0 from public.community_comments
    where body in ('tuta-private-test-disallowed-anonymous',
      'tuta-private-test-wrong-parent')) as invalid_replies_rejected,
  (select count(*) = 1 from public.community_comments
    where body = 'tuta-private-test-post-author-comment'
      and is_post_author and author_initials <> '') as post_author_badge_and_initials,
  not has_column_privilege(current_user,
    'public.community_posts', 'author_id', 'SELECT') as real_post_author_hidden,
  not has_column_privilege(current_user,
    'public.community_comments', 'author_id', 'SELECT') as real_comment_author_hidden;

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
end;
$$;

select
  (select count(*) = 0 from public.community_post_owners) as other_member_cannot_see_owner,
  (select count(*) = 1 from public.community_posts
    where body = 'tuta-private-test-post'
      and public_author_id is null) as other_member_sees_anonymous_post;

rollback;
