-- The server-only moderation endpoint reads the queue and can resolve a
-- report or remove its post. Do not expose reporter_id or change member RLS.
grant select (id, post_id, reason, created_at), delete
  on public.community_reports to service_role;
grant select (id, display_name, is_anonymous, topic, body, created_at), delete
  on public.community_posts to service_role;
