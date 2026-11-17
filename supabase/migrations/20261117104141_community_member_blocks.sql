create table public.community_member_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index community_member_blocks_reverse on public.community_member_blocks (blocked_id, blocker_id);
alter table public.community_member_blocks enable row level security;
revoke all on public.community_member_blocks from public, anon, authenticated;
grant select, insert, update, delete on public.community_member_blocks to service_role;

create function community_private.community_author_visible(author uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and not exists (
    select 1 from public.community_member_blocks
    where (blocker_id = (select auth.uid()) and blocked_id = author)
       or (blocked_id = (select auth.uid()) and blocker_id = author)
  );
$$;
revoke all on function community_private.community_author_visible(uuid) from public, anon, authenticated;
grant execute on function community_private.community_author_visible(uuid) to authenticated;

-- Filtering anonymous items would let a member infer their author's identity.
create policy community_respect_blocks on public.community_posts as restrictive
  for select to authenticated using (is_anonymous or community_private.community_author_visible(author_id));
create policy community_comments_respect_blocks on public.community_comments as restrictive
  for select to authenticated using (
    (is_anonymous or community_private.community_author_visible(author_id)) and
    exists (select 1 from public.community_posts p where p.id = post_id)
  );
grant select (author_id, is_anonymous) on public.community_posts to service_role;
