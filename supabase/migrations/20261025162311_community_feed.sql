-- Community posts are public. Cycle and symptom records are deliberately absent.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  topic text not null check (topic in ('cycle', 'symptoms', 'wellbeing', 'nutrition', 'pregnancy', 'questions')),
  body text not null check (
    body = btrim(body)
    and char_length(body) between 1 and 2000
    and cardinality(regexp_split_to_array(body, '[[:space:]]+')) <= 200
  ),
  image_public_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint community_image_owner check (
    image_public_id is null or
    image_public_id ~ ('^tuta-community/' || author_id::text || '/[a-zA-Z0-9_-]+$')
  )
);

create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc, id desc);
create index if not exists community_posts_author_idx
  on public.community_posts (author_id, created_at desc);
create index if not exists community_posts_topic_idx
  on public.community_posts (topic, created_at desc);

alter table public.community_posts enable row level security;
revoke all on public.community_posts from anon, authenticated;
grant select on public.community_posts to anon, authenticated;
grant insert, delete, update (body, topic) on public.community_posts to authenticated;

create policy "community posts are readable" on public.community_posts
  for select to anon, authenticated using (true);
create policy "members publish their own posts" on public.community_posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
    and display_name = coalesce(
      case when char_length(btrim(auth.jwt()->'user_metadata'->>'nickname')) >= 2
        then left(btrim(auth.jwt()->'user_metadata'->>'nickname'), 30) end,
      case when char_length(btrim(auth.jwt()->'user_metadata'->>'first_name')) >= 2
        then left(btrim(auth.jwt()->'user_metadata'->>'first_name'), 30) end,
      'Member'
    )
  );
create policy "members remove their own posts" on public.community_posts
  for delete to authenticated using (author_id = (select auth.uid()));
create policy "members edit their own posts" on public.community_posts
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- Only a trusted server/admin process may add a verified doctor. User metadata
-- and self-declared profile fields must never grant the verification badge.
create table if not exists public.verified_doctors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 2 and 60),
  last_name text not null check (char_length(btrim(last_name)) between 2 and 60),
  verified_at timestamptz not null default now()
);
alter table public.verified_doctors enable row level security;
revoke all on public.verified_doctors from anon, authenticated;
grant select on public.verified_doctors to anon, authenticated;
create policy "verified doctors are public" on public.verified_doctors
  for select to anon, authenticated using (true);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  body text not null check (body = btrim(body) and char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at, id);
alter table public.community_comments enable row level security;
revoke all on public.community_comments from anon, authenticated;
grant select on public.community_comments to anon, authenticated;
grant insert, delete on public.community_comments to authenticated;
create policy "comments are readable" on public.community_comments
  for select to anon, authenticated using (true);
create policy "members comment as themselves" on public.community_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
    and display_name = coalesce(
      case when char_length(btrim(auth.jwt()->'user_metadata'->>'nickname')) >= 2
        then left(btrim(auth.jwt()->'user_metadata'->>'nickname'), 30) end,
      case when char_length(btrim(auth.jwt()->'user_metadata'->>'first_name')) >= 2
        then left(btrim(auth.jwt()->'user_metadata'->>'first_name'), 30) end,
      'Member'
    )
  );
create policy "members remove their own comments" on public.community_comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- Reports are write-only to members; they must never appear in the public feed.
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'privacy', 'medical_misinformation')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);
create index if not exists community_reports_post_idx on public.community_reports(post_id);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from anon, authenticated;
grant insert on public.community_reports to authenticated;
create policy "members report posts" on public.community_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );
