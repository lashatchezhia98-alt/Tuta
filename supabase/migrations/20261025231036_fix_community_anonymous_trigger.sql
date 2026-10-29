-- PL/pgSQL can inspect an entire boolean expression before short-circuiting;
-- never reference comment-only fields while the post trigger is running.
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
