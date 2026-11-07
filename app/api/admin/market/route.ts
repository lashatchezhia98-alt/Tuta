import { requireAdmin, checked, result, failure, ApiError } from "@/lib/platform-server";
import { readAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";
const categories = new Set(["period-care", "body-care", "nutrition", "accessories"]);
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function parseProduct(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = body.category;
  const price = Number(body.priceGEL);
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  const active = body.is_active !== false;
  if (name.length < 2 || name.length > 100 || description.length < 1 || description.length > 500 || typeof category !== "string" || !categories.has(category) || !Number.isFinite(price) || price <= 0 || price > 100000 || (imageUrl && (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 2000)) || typeof active !== "boolean") throw new ApiError(400, "შეამოწმე პროდუქტის სახელი, აღწერა, კატეგორია და ფასი.");
  return { name, description, category, price_tetri: Math.round(price * 100), image_url: imageUrl, is_active: active, updated_at: new Date().toISOString() };
}

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request);
    const products = checked(await db.from("market_products").select("*").order("sort_order").order("created_at", { ascending: false }).limit(200));
    return result({ products });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request);
    const body = await readAdminJson(request, 16_384);
    if (body.action === "delete") {
      if (!isUuid(body.id)) throw new ApiError(400, "პროდუქტის ნომერი არასწორია.");
      checked(await db.from("market_products").delete().eq("id", body.id));
      return result({ ok: true });
    }
    const product = parseProduct(body);
    if (body.id !== undefined) {
      if (!isUuid(body.id)) throw new ApiError(400, "პროდუქტის ნომერი არასწორია.");
      const saved = checked(await db.from("market_products").update(product).eq("id", body.id).select("*").single());
      return result({ product: saved });
    }
    const saved = checked(await db.from("market_products").insert(product).select("*").single());
    return result({ product: saved });
  } catch (error) { return failure(error); }
}
