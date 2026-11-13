-- The authenticated admin endpoint uses service_role, not member credentials.
-- Grant only the columns and moderation operations that endpoint uses.
grant select (id, display_name, is_anonymous, topic, body, image_public_id, created_at),
  delete on public.community_posts to service_role;
grant select (id, post_id, reason, created_at),
  delete on public.community_reports to service_role;
