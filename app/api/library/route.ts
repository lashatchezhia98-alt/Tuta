import {
  dbClient,
  requireFeature,
  checked,
  result,
  failure,
} from "@/lib/platform-server";
export async function GET() {
  try {
    const db = dbClient();
    await requireFeature(db, "library");
    const articles = checked(
      await db
        .from("articles")
        .select("id,title_ka,title_en,body_ka,body_en,category,publish_at")
        .in("status", ["published", "scheduled"])
        .lte("publish_at", new Date().toISOString())
        .order("publish_at", { ascending: false })
        .limit(100),
    );
    return result({ articles });
  } catch (e) {
    return failure(e);
  }
}
