import { checked, failure, requireFeature, result, dbClient } from "@/lib/platform-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = dbClient();
    await requireFeature(db, "market");
    const products = checked(await db.from("market_products").select("id,name,description,category,price_tetri,image_url").eq("is_active", true).order("sort_order").order("created_at", { ascending: false }).limit(100));
    return result({ products });
  } catch (error) {
    return failure(error);
  }
}
