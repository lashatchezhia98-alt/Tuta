-- Public-safe author presentation fields. Keep the real author_id private.
alter table public.community_posts
  add column author_initials text not null default '?';

alter table public.community_comments
  add column author_initials text not null default '?',
  add column is_post_author boolean not null default false;

create or replace function community_private.initials_for_profile(
  first_name text, last_name text, nickname text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(first_name), '') is not null
      and nullif(btrim(last_name), '') is not null
      then (case when left(btrim(first_name), 1) ~ '^[a-z]$'
        then upper(left(btrim(first_name), 1)) else left(btrim(first_name), 1) end)
        || (case when left(btrim(last_name), 1) ~ '^[a-z]$'
        then upper(left(btrim(last_name), 1)) else left(btrim(last_name), 1) end)
    else case when left(coalesce(
      nullif(btrim(nickname), ''), nullif(btrim(first_name), ''),
      nullif(btrim(last_name), ''), '?'
    ), 1) ~ '^[a-z]$'
      then upper(left(coalesce(
        nullif(btrim(nickname), ''), nullif(btrim(first_name), ''),
        nullif(btrim(last_name), ''), '?'
      ), 1))
      else left(coalesce(
        nullif(btrim(nickname), ''), nullif(btrim(first_name), ''),
        nullif(btrim(last_name), ''), '?'
      ), 1)
    end
  end;
$$;
revoke all on function community_private.initials_for_profile(text, text, text)
  from public, anon, authenticated;

create or replace function community_private.set_display_name_from_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_name text;
  initials text;
begin
  if new.is_anonymous then
    if tg_table_name = 'community_comments' then
      if not exists (
        select 1 from public.community_posts as p
        where p.id = new.post_id
          and p.author_id = new.author_id
          and p.is_anonymous
      ) then
        raise exception 'Anonymous comments are reserved for the author of an anonymous post'
          using errcode = '23514';
      end if;
      new.is_post_author := true;
    end if;
    new.display_name := 'Anonymous';
    new.author_initials := '?';
    return new;
  end if;

  select
    coalesce(
      case when char_length(btrim(u.raw_user_meta_data->>'nickname')) >= 2
        then left(btrim(u.raw_user_meta_data->>'nickname'), 30) end,
      case when char_length(btrim(u.raw_user_meta_data->>'first_name')) >= 2
        then left(btrim(u.raw_user_meta_data->>'first_name'), 30) end,
      case when char_length(btrim(u.raw_user_meta_data->>'last_name')) >= 2
        then left(btrim(u.raw_user_meta_data->>'last_name'), 30) end,
      'Member'
    ),
    community_private.initials_for_profile(
      u.raw_user_meta_data->>'first_name',
      u.raw_user_meta_data->>'last_name',
      u.raw_user_meta_data->>'nickname'
    )
  into author_name, initials
  from auth.users as u
  where u.id = new.author_id;

  if author_name is null then
    raise exception 'Community author not found' using errcode = '23503';
  end if;

  new.display_name := author_name;
  new.author_initials := coalesce(nullif(initials, ''), '?');
  if tg_table_name = 'community_comments' then
    new.is_post_author := exists (
      select 1 from public.community_posts as p
      where p.id = new.post_id and p.author_id = new.author_id
        and not p.is_anonymous
    );
  end if;
  return new;
end;
$$;

-- Backfill presentation fields without changing existing display names.
update public.community_posts as p
set author_initials = case when p.is_anonymous then '?'
  else community_private.initials_for_profile(
    u.raw_user_meta_data->>'first_name',
    u.raw_user_meta_data->>'last_name',
    u.raw_user_meta_data->>'nickname'
  ) end
from auth.users as u
where u.id = p.author_id;

update public.community_comments as c
set author_initials = case when c.is_anonymous then '?'
  else community_private.initials_for_profile(
    u.raw_user_meta_data->>'first_name',
    u.raw_user_meta_data->>'last_name',
    u.raw_user_meta_data->>'nickname'
  ) end,
is_post_author = exists (
  select 1 from public.community_posts as p
  where p.id = c.post_id and p.author_id = c.author_id
    and (not p.is_anonymous or c.is_anonymous)
)
from auth.users as u
where u.id = c.author_id;

revoke select on public.community_posts from authenticated;
grant select (id, display_name, author_initials, topic, body, image_public_id,
  created_at, updated_at, is_anonymous, public_author_id)
  on public.community_posts to authenticated;

revoke select on public.community_comments from authenticated;
grant select (id, post_id, display_name, author_initials, body, created_at,
  is_anonymous, public_author_id, parent_comment_id, is_post_author)
  on public.community_comments to authenticated;
