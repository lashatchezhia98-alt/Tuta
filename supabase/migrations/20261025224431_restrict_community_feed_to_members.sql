-- The community is visible only to registered, signed-in members.
-- Supabase anonymous sign-ins also use the authenticated database role, so
-- the JWT claim must be checked in addition to the database role.
revoke select on public.community_posts from public, anon;
revoke select on public.community_comments from public, anon;
revoke select on public.verified_doctors from public, anon;

drop policy if exists "community posts are readable" on public.community_posts;
create policy "registered members read community posts" on public.community_posts
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

drop policy if exists "comments are readable" on public.community_comments;
create policy "registered members read community comments" on public.community_comments
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

drop policy if exists "verified doctors are public" on public.verified_doctors;
create policy "registered members read verified doctors" on public.verified_doctors
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );
