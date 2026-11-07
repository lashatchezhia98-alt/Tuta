import { checked, failure, requireFeature, result, dbClient } from "@/lib/platform-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = dbClient();
    await requireFeature(db, "market");
    const products = checked(await db.from("market_products").select("*").eq("is_active", true).order("sort_order").order("created_at", { ascending: false }).limit(100)) ?? [];
    const publicProducts = products.map(product => {
      let imageUrls: string[] = Array.isArray(product.image_urls) ? product.image_urls.filter((value: unknown): value is string => typeof value === "string") : [];
      if (!imageUrls.length && typeof product.image_url === "string" && product.image_url.startsWith("tuta-gallery:")) {
        try { const decoded: unknown = JSON.parse(product.image_url.slice("tuta-gallery:".length)); if (Array.isArray(decoded)) imageUrls = decoded.filter((value): value is string => typeof value === "string"); } catch { /* Ignore malformed gallery metadata. */ }
      }
      if (!imageUrls.length && typeof product.image_url === "string" && product.image_url) imageUrls = [product.image_url];
      return { id: product.id, name: product.name, description: product.description, category: product.category, price_tetri: product.price_tetri, image_url: imageUrls[0] || null, image_urls: imageUrls };
    });
    return result({ products: publicProducts });
  } catch (error) {
    return failure(error);
  }
}
