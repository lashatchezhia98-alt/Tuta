-- Restrict post updates to the author and the first 30 minutes after creation.
-- The existing column-level grant allows updates only to body/topic, so
-- clients cannot move created_at forward to extend the editing window.
drop policy if exists "members edit their own posts" on public.community_posts;

create policy "members edit their own posts within 30 minutes"
  on public.community_posts
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and created_at > statement_timestamp() - interval '30 minutes'
    and created_at <= statement_timestamp()
  )
  with check (
    author_id = (select auth.uid())
    and created_at > statement_timestamp() - interval '30 minutes'
    and created_at <= statement_timestamp()
  );
