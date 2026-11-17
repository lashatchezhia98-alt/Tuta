import { ApiError, failure, requireUser, result } from "@/lib/platform-server";

export async function POST(request: Request) {
  try {
    const { db, user } = await requireUser(request);
    const body = await request.json().catch(() => null);
    if (typeof body?.postId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.postId)) {
      throw new ApiError(400, "პოსტის ნომერი არასწორია.");
    }
    const { data: post, error } = await db.from("community_posts")
      .select("author_id,is_anonymous").eq("id", body.postId).maybeSingle();
    if (error) throw new ApiError(503, "მოქმედება ვერ შესრულდა.");
    if (!post || post.is_anonymous || post.author_id === user.id) {
      throw new ApiError(404, "ამ პოსტიდან ავტორის დაბლოკვა შეუძლებელია.");
    }
    const blocked = await db.from("community_member_blocks").upsert({
      blocker_id: user.id, blocked_id: post.author_id,
    }, { ignoreDuplicates: true });
    if (blocked.error) throw new ApiError(503, "მოქმედება ვერ შესრულდა.");
    return result({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
