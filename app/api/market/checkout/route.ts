import { NextResponse } from "next/server";
import { bearerToken, createFlittCheckout, flittEnvironment, FLITT_TEST_MERCHANT_ID } from "@/lib/flitt";
import { ApiError, checked, failure, requireFeature, requireUser } from "@/lib/platform-server";
import { flittReturnUrl } from "@/lib/flitt-return";
import { marketDeliveryFee } from "@/lib/market-delivery-fee";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const clients = flittEnvironment();
    if (!clients) throw new ApiError(503, "სატესტო გადახდის სერვისი ჯერ არ არის გამართული.");
    const token = bearerToken(request);
    if (!token) throw new ApiError(401, "შეკვეთის გასაფორმებლად შედი ანგარიშში.");
    const { user } = await requireUser(request);
    const deliveryFeeTetri = marketDeliveryFee(await requireFeature(clients.admin, "market"));
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { throw new ApiError(400, "შეკვეთის მონაცემები არასწორია."); }
    const recipient = typeof body.recipientName === "string" ? body.recipientName.trim() : "";
    const phone = typeof body.recipientPhone === "string" && body.recipientPhone.length <= 32 ? body.recipientPhone.replace(/[\s()-]/g, "") : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const lat = body.latitude === null || body.latitude === undefined ? null : Number(body.latitude);
    const lon = body.longitude === null || body.longitude === undefined ? null : Number(body.longitude);
    const lineItems = body.items;
    if (recipient.length < 2 || recipient.length > 120 || address.length < 5 || address.length > 500 || !Array.isArray(lineItems) || lineItems.length < 1 || lineItems.length > 20 || ((lat === null) !== (lon === null)) || (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon! < -180 || lon! > 180))) throw new ApiError(400, "შეავსე მიმღების სახელი, მისამართი და კალათა.");
    const requested = new Map<string, number>();
    for (const item of lineItems) {
      if (!item || typeof item !== "object" || !("productId" in item) || typeof item.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(item.productId) || !("quantity" in item) || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20) throw new ApiError(400, "კალათის პროდუქტი ან რაოდენობა არასწორია.");
      requested.set(item.productId, (requested.get(item.productId) || 0) + Number(item.quantity));
      if(requested.get(item.productId)!>20)throw new ApiError(400,"ერთი პროდუქტის მაქსიმალური რაოდენობაა 20.");
    }
    if (!/^\+?[0-9]{7,15}$/.test(phone)) throw new ApiError(400, "მიუთითე მიმღების სწორი ტელეფონის ნომერი.");
    const products = checked(await clients.admin.from("market_products").select("id,name,price_tetri,is_active,stock_quantity").in("id", [...requested.keys()])) ?? [];
    if (products.length !== requested.size || products.some(product => !product.is_active ||
        (product.stock_quantity !== null && product.stock_quantity < requested.get(product.id)!)))
      throw new ApiError(409, "ერთ-ერთი პროდუქტის მარაგი საკმარისი აღარ არის. განაახლე კალათა.");
    const snapshot = products.map(product => ({ productId: product.id, name: product.name, price_tetri: product.price_tetri, quantity: requested.get(product.id)! }));
    if ((body.deliveryFeeTetri ?? 0) !== deliveryFeeTetri) return NextResponse.json({
      error: "მიტანის საფასური შეიცვალა. გადაამოწმე ჯამი და თავიდან დაადასტურე. / Delivery fee changed. Review the total and try again.",
      deliveryFeeTetri,
    }, { status: 409 });
    const total = snapshot.reduce((sum, item) => sum + item.price_tetri * item.quantity, deliveryFeeTetri);
    if (!Number.isSafeInteger(total) || total < 1 || total > 100_000_000) throw new ApiError(400, "შეკვეთის ჯამი არასწორია.");
    if (body.expectedTotalTetri !== undefined &&
        (!Number.isSafeInteger(body.expectedTotalTetri) || body.expectedTotalTetri !== total))
      throw new ApiError(409, "შეკვეთის ჯამი შეიცვალა. გადაამოწმე თანხა და თავიდან დაადასტურე. / Order total changed. Review the amount and try again.");
    const orderId = `tuta-market-${crypto.randomUUID()}`;
    const order = await clients.admin.from("market_orders").insert({ order_id: orderId, user_id: user.id, items: snapshot, total_tetri: total, delivery_fee_tetri: deliveryFeeTetri, recipient_name: recipient, recipient_phone: phone, address, latitude: lat, longitude: lon, status: "pending", mode: "test" });
    if (order.error?.code === "P0001") throw new ApiError(409, "ერთ-ერთი პროდუქტის მარაგი შეიცვალა. განაახლე კალათა.");
    checked(order);
    const origin = new URL(request.url).origin;
    const params: Record<string, unknown> = {
      order_id: orderId, merchant_id: FLITT_TEST_MERCHANT_ID, order_desc: `Tuta market order (${snapshot.length} items)`, amount: total, currency: "GEL", response_url: flittReturnUrl(origin, "market", orderId, body.returnTo === "app"), server_callback_url: `${origin}/api/payments/flitt/callback`, lang: "ka", merchant_data: JSON.stringify({ type: "market-order", mode: "test" }),
    };
    const checkoutUrl = await createFlittCheckout(params).catch(() => null);
    if (!checkoutUrl) {
      await clients.admin.from("market_orders").update({ status: "declined", updated_at: new Date().toISOString() }).eq("order_id", orderId);
      throw new ApiError(502, "სატესტო გადახდის ბმული ვერ შეიქმნა. სცადე მოგვიანებით.");
    }
    return NextResponse.json({ checkoutUrl, testMode: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
