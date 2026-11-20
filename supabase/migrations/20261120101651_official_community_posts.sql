-- Official posts have no member identity. The publishing admin is kept private.
alter table public.community_posts
  alter column author_id drop not null,
  add column is_official boolean not null default false,
  add column official_publisher text,
  add constraint community_official_author check (
    (
      is_official and author_id is null and not is_anonymous
      and display_name = 'თუთა' and author_initials = 'თ'
      and official_publisher is not null
      and (official_publisher = 'owner' or official_publisher ~ '^[0-9a-f-]{36}$')
    ) or (not is_official and author_id is not null and official_publisher is null)
  );

alter table public.community_posts drop constraint community_image_owner;
alter table public.community_posts add constraint community_image_owner check (
  image_public_id is null or
  (is_official and image_public_id ~ '^tuta-community/official/private_[a-zA-Z0-9_-]+$') or
  (not is_official and not is_anonymous and image_public_id ~ ('^tuta-community/' || author_id::text || '/[a-zA-Z0-9_-]+$')) or
  (is_anonymous and image_public_id ~ '^tuta-community/anon/[a-zA-Z0-9_-]+$')
);

drop trigger set_community_post_display_name on public.community_posts;
create trigger set_community_post_display_name before insert on public.community_posts
  for each row when (not new.is_official)
  execute function community_private.set_display_name_from_author();

drop trigger record_community_post_owner on public.community_posts;
create trigger record_community_post_owner after insert on public.community_posts
  for each row when (not new.is_official)
  execute function community_private.record_post_owner();

alter policy "members publish their own posts" on public.community_posts with check (
  not is_official and author_id = (select auth.uid())
  and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
);
alter policy community_respect_blocks on public.community_posts
  using (is_official or is_anonymous or community_private.community_author_visible(author_id));

grant insert (display_name, author_initials, topic, body, image_public_id, is_official, official_publisher)
  on public.community_posts to service_role;
