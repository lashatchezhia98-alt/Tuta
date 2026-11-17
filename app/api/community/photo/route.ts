import { createClient } from "@supabase/supabase-js";
import { serveCommunityPhoto } from "@/lib/community-media";

export async function GET(request: Request) {
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") || "")?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const unavailable = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!token) return unavailable(401);
  if (!url || !key) return unavailable(503);
  const id = new URL(request.url).searchParams.get("post");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return unavailable(404);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user || user.is_anonymous) return unavailable(401);
  const post = await client.from("community_posts").select("image_public_id").eq("id", id).maybeSingle();
  if (post.error) return unavailable(503);
  return serveCommunityPhoto(post.data?.image_public_id ?? null);
}
