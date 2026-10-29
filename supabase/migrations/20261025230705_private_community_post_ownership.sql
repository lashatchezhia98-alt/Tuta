-- Members can identify their own posts without gaining access to the real
-- author IDs of anyone else's anonymous posts.
create table public.community_post_owners (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade
);
insert into public.community_post_owners (post_id, owner_id)
  select id, author_id from public.community_posts;

alter table public.community_post_owners enable row level security;
revoke all on public.community_post_owners from public, anon, authenticated;
grant select (post_id) on public.community_post_owners to authenticated;
create policy "members see only their own post IDs"
  on public.community_post_owners for select to authenticated
  using (
    owner_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

create function community_private.record_post_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.community_post_owners (post_id, owner_id)
    values (new.id, new.author_id);
  return new;
end;
$$;
revoke all on function community_private.record_post_owner()
  from public, anon, authenticated;
create trigger record_community_post_owner
  after insert on public.community_posts
  for each row execute function community_private.record_post_owner();

drop function public.community_my_post_ids();
