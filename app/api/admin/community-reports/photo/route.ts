import { ApiError, failure, requireAdmin } from "@/lib/platform-server";
import { serveCommunityPhoto } from "@/lib/community-media";

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "reports");
    const id = new URL(request.url).searchParams.get("report");
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) throw new ApiError(404, "ფოტო ვერ მოიძებნა.");
    const report = await db.from("community_reports").select("post_id").eq("id", id).maybeSingle();
    if (report.error) throw new ApiError(503, "ფოტო ვერ ჩაიტვირთა.");
    if (!report.data) throw new ApiError(404, "ფოტო ვერ მოიძებნა.");
    const post = await db.from("community_posts").select("image_public_id").eq("id", report.data.post_id).maybeSingle();
    if (post.error) throw new ApiError(503, "ფოტო ვერ ჩაიტვირთა.");
    return serveCommunityPhoto(post.data?.image_public_id ?? null);
  } catch (error) {
    return failure(error);
  }
}
