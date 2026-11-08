import { NextResponse } from "next/server";
import { bearerToken, flittEnvironment, flittSignature, FLITT_TEST_MERCHANT_ID, verifyFlittSignature } from "@/lib/flitt";
import { ApiError, checked, failure, requireFeature, requireUser } from "@/lib/platform-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const clients = flittEnvironment();
    if (!clients) throw new ApiError(503, "სატესტო გადახდის სერვისი ჯერ არ არის გამართული.");
    const token = bearerToken(request);
    if (!token) throw new ApiError(401, "შეკვეთის გასაფორმებლად შედი ანგარიშში.");
    const { user } = await requireUser(request);
    await requireFeature(clients.admin, "market");
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { throw new ApiError(400, "შეკვეთის მონაცემები არასწორია."); }
    const recipient = typeof body.recipientName === "string" ? body.recipientName.trim() : "";
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
    const products = checked(await clients.admin.from("market_products").select("id,name,price_tetri,is_active").in("id", [...requested.keys()])) ?? [];
    if (products.length !== requested.size || products.some(product => !product.is_active)) throw new ApiError(400, "ერთ-ერთი პროდუქტი აღარ არის ხელმისაწვდომი.");
    const snapshot = products.map(product => ({ productId: product.id, name: product.name, price_tetri: product.price_tetri, quantity: requested.get(product.id)! }));
    const total = snapshot.reduce((sum, item) => sum + item.price_tetri * item.quantity, 0);
    if (!Number.isSafeInteger(total) || total < 1 || total > 100_000_000) throw new ApiError(400, "შეკვეთის ჯამი არასწორია.");
    const orderId = `tuta-market-${crypto.randomUUID()}`;
    checked(await clients.admin.from("market_orders").insert({ order_id: orderId, user_id: user.id, items: snapshot, total_tetri: total, recipient_name: recipient, address, latitude: lat, longitude: lon, status: "pending", mode: "test" }));
    const origin = new URL(request.url).origin;
    const params: Record<string, unknown> = {
      order_id: orderId, merchant_id: FLITT_TEST_MERCHANT_ID, order_desc: `Tuta market order (${snapshot.length} items)`, amount: total, currency: "GEL", sender_email: user.email || "", response_url: `${origin}/api/payments/flitt/return?type=market&order=${encodeURIComponent(orderId)}`, server_callback_url: `${origin}/api/payments/flitt/callback`, lang: "ka", merchant_data: JSON.stringify({ type: "market-order", mode: "test" }),
    };
    params.signature = flittSignature(params);
    const response = await fetch("https://pay.flitt.com/api/checkout/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: params }), cache: "no-store" });
    const result = await response.json() as { response?: { response_status?: string; checkout_url?: string; error_message?: string; signature?: string } };
    const payment = result.response;
    if (!response.ok || payment?.response_status !== "success" || !payment.checkout_url || !verifyFlittSignature(payment)) {
      await clients.admin.from("market_orders").update({ status: "declined", updated_at: new Date().toISOString() }).eq("order_id", orderId);
      throw new ApiError(502, "სატესტო გადახდის ბმული ვერ შეიქმნა. სცადე მოგვიანებით.");
    }
    const checkoutUrl = new URL(payment.checkout_url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "pay.flitt.com") throw new ApiError(502, "გადახდის ბმული ვერ დადასტურდა.");
    return NextResponse.json({ checkoutUrl: checkoutUrl.toString(), testMode: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
