import { requireAdmin, checked, result, failure, ApiError } from "@/lib/platform-server";
import { readAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";
const categories = new Set(["period-care", "body-care", "nutrition", "accessories"]);
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const galleryPrefix = "tuta-gallery:";

function savedImages(imageUrl: unknown, imageUrls: unknown) {
  if (Array.isArray(imageUrls)) return imageUrls.filter((value): value is string => typeof value === "string");
  if (typeof imageUrl !== "string" || !imageUrl) return [];
  if (imageUrl.startsWith(galleryPrefix)) {
    try {
      const parsed: unknown = JSON.parse(imageUrl.slice(galleryPrefix.length));
      if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string");
    } catch { /* Keep legacy image URLs intact if older encoded content is invalid. */ }
  }
  return [imageUrl];
}

function normalizedProduct<T extends { image_url?: unknown; image_urls?: unknown }>(product: T) {
  const imageUrls = savedImages(product.image_url, product.image_urls);
  return { ...product, image_url: imageUrls[0] || null, image_urls: imageUrls };
}

function parseProduct(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = body.category;
  const price = Number(body.priceGEL);
  const legacyImage = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  const imageUrls = Array.isArray(body.imageUrls)
    ? [...new Set(body.imageUrls.filter((value): value is string => typeof value === "string").map(value => value.trim()).filter(Boolean))]
    : legacyImage ? [legacyImage] : [];
  const imageUrl = imageUrls[0] || null;
  const active = body.is_active !== false;
  if (name.length < 2 || name.length > 100 || description.length < 1 || description.length > 500 || typeof category !== "string" || !categories.has(category) || !Number.isFinite(price) || price <= 0 || price > 100000 || imageUrls.length > 8 || imageUrls.some(url => !/^https:\/\//i.test(url) || url.length > 2000 || !/^https:\/\/res\.cloudinary\.com\//i.test(url)) || typeof active !== "boolean") throw new ApiError(400, "შეამოწმე პროდუქტის სახელი, აღწერა, კატეგორია და ფასი. დასაშვებია მაქსიმუმ 8 Cloudinary ფოტო.");
  return { name, description, category, price_tetri: Math.round(price * 100), image_url: imageUrls.length ? imageUrl : null, image_urls: imageUrls, is_active: active, updated_at: new Date().toISOString() };
}

async function saveProduct(db: Awaited<ReturnType<typeof requireAdmin>>, body: Record<string, unknown>, product: ReturnType<typeof parseProduct>) {
  const isUpdate = body.id !== undefined;
  const write = (values: Record<string, unknown>) => isUpdate
    ? db.from("market_products").update(values).eq("id", body.id as string).select("*").single()
    : db.from("market_products").insert(values).select("*").single();
  let response = await write(product);
  if (response.error && /image_urls/i.test(response.error.message)) {
    // Older production schemas may not have the gallery column yet. Keep the
    // gallery in the legacy image_url field until the migration is applied.
    const legacyProduct = { ...product, image_url: `${galleryPrefix}${JSON.stringify(product.image_urls)}` };
    delete (legacyProduct as { image_urls?: string[] }).image_urls;
    response = await write(legacyProduct);
  }
  return checked(response);
}

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request);
    const products = checked(await db.from("market_products").select("*").order("sort_order").order("created_at", { ascending: false }).limit(200)) ?? [];
    return result({ products: products.map(normalizedProduct) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request);
    const body = await readAdminJson(request, 16_384);
    if (body.action === "delete") {
      if (!isUuid(body.id)) throw new ApiError(400, "პროდუქტის ნომერი არასწორია.");
      const deleted = checked(await db.from("market_products").delete().eq("id", body.id).select("id").maybeSingle());
      if (!deleted) throw new ApiError(404, "პროდუქტი ვერ მოიძებნა.");
      return result({ ok: true });
    }
    const product = parseProduct(body);
    if (body.id !== undefined && !isUuid(body.id)) throw new ApiError(400, "პროდუქტის ნომერი არასწორია.");
    const saved = await saveProduct(db, body, product);
    return result({ product: normalizedProduct(saved) });
  } catch (error) { return failure(error); }
}
