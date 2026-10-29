-- A public post can have an anonymous display identity while retaining a
-- private owner for edit/delete permissions. The real author_id is never
-- readable through the Data API by ordinary members.
alter table public.community_posts
  add column is_anonymous boolean not null default false,
  add column public_author_id uuid generated always as
    (case when is_anonymous then null else author_id end) stored;

alter table public.community_comments
  add column is_anonymous boolean not null default false,
  add column public_author_id uuid generated always as
    (case when is_anonymous then null else author_id end) stored,
  add column parent_comment_id uuid;

alter table public.community_comments
  add constraint community_comments_id_post_unique unique (id, post_id),
  add constraint community_comments_parent_same_post
    foreign key (parent_comment_id, post_id)
    references public.community_comments (id, post_id)
    on delete cascade;
create index community_comments_parent_idx
  on public.community_comments (parent_comment_id)
  where parent_comment_id is not null;

-- An anonymous photo path must not contain the owner's user ID.
alter table public.community_posts drop constraint community_image_owner;
alter table public.community_posts add constraint community_image_owner check (
  image_public_id is null or
  (not is_anonymous and image_public_id ~ ('^tuta-community/' || author_id::text || '/[a-zA-Z0-9_-]+$')) or
  (is_anonymous and image_public_id ~ '^tuta-community/anon/[a-zA-Z0-9_-]+$')
);

create or replace function community_private.set_display_name_from_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_name text;
begin
  if new.is_anonymous then
    if tg_table_name = 'community_comments' then
      if not exists (
        select 1 from public.community_posts as p
        where p.id = new.post_id and p.author_id = new.author_id and p.is_anonymous
      ) then
        raise exception 'Anonymous comments are reserved for the author of an anonymous post'
          using errcode = '23514';
      end if;
    end if;
    new.display_name := 'Anonymous';
    return new;
  end if;

  select coalesce(
    case when char_length(btrim(u.raw_user_meta_data->>'nickname')) >= 2
      then left(btrim(u.raw_user_meta_data->>'nickname'), 30) end,
    case when char_length(btrim(u.raw_user_meta_data->>'first_name')) >= 2
      then left(btrim(u.raw_user_meta_data->>'first_name'), 30) end,
    'Member'
  ) into author_name
  from auth.users as u
  where u.id = new.author_id;

  if author_name is null then
    raise exception 'Community author not found' using errcode = '23503';
  end if;
  new.display_name := author_name;
  return new;
end;
$$;

-- Do not grant SELECT on author_id. Clients use public_author_id for named
-- members and the restricted own-post-ID function for owner controls.
revoke select on public.community_posts from authenticated;
grant select (id, display_name, topic, body, image_public_id, created_at,
  updated_at, is_anonymous, public_author_id)
  on public.community_posts to authenticated;

revoke select on public.community_comments from authenticated;
grant select (id, post_id, display_name, body, created_at,
  is_anonymous, public_author_id, parent_comment_id)
  on public.community_comments to authenticated;

create function public.community_my_post_ids()
returns table (post_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.community_posts as p
  where p.author_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true';
$$;
revoke all on function public.community_my_post_ids() from public, anon;
grant execute on function public.community_my_post_ids() to authenticated;
