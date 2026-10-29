-- The public name is presentation data, never a permission check. The trigger
-- copies it from the author's current profile so callers cannot pick a
-- different name for each post or comment.
create schema if not exists community_private;
revoke all on schema community_private from public;

create function community_private.set_display_name_from_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_name text;
begin
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

revoke all on function community_private.set_display_name_from_author()
  from public, anon, authenticated;

create trigger set_community_post_display_name
before insert on public.community_posts
for each row execute function community_private.set_display_name_from_author();

create trigger set_community_comment_display_name
before insert on public.community_comments
for each row execute function community_private.set_display_name_from_author();

drop policy "members publish their own posts" on public.community_posts;
create policy "members publish their own posts" on public.community_posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

drop policy "members comment as themselves" on public.community_comments;
create policy "members comment as themselves" on public.community_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );
