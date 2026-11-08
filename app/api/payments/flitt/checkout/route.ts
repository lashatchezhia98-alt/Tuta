import { NextResponse } from "next/server";
import { bearerToken, flittEnvironment, flittSignature, FLITT_TEST_AMOUNTS, FLITT_TEST_MERCHANT_ID, verifyFlittSignature, type PremiumPlan } from "@/lib/flitt";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const clients = flittEnvironment();
  if (!clients) return NextResponse.json({ error: "სატესტო გადახდის სერვისი ჯერ არ არის დაყენებული." }, { status: 503 });

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "Premium-ის შესაძენად ჯერ შედი ანგარიშში." }, { status: 401 });
  const { data: { user }, error: authError } = await clients.auth.auth.getUser(accessToken);
  if (authError || !user || user.is_anonymous) return NextResponse.json({ error: "გადახდის დაწყება მხოლოდ რეგისტრირებული ანგარიშით შეიძლება." }, { status: 401 });

  let requestedPlan: unknown;
  try {
    requestedPlan = (await request.json()).plan;
  } catch {
    return NextResponse.json({ error: "აირჩიე Premium პაკეტი." }, { status: 400 });
  }
  if (requestedPlan !== "monthly" && requestedPlan !== "yearly") {
    return NextResponse.json({ error: "არჩეული Premium პაკეტი არასწორია." }, { status: 400 });
  }
  const plan: PremiumPlan = requestedPlan;
  const amount = FLITT_TEST_AMOUNTS[plan];

  const origin = new URL(request.url).origin;
  const orderId = `tuta-${crypto.randomUUID()}`;
  const { error: insertError } = await clients.admin.from("premium_payments").insert({
    order_id: orderId,
    user_id: user.id,
    amount,
    currency: "GEL",
    status: "pending",
    mode: "test",
    plan,
  });
  if (insertError) return NextResponse.json({ error: "შეკვეთის შენახვა ვერ მოხერხდა. მონაცემთა ბაზის მიგრაცია გადაამოწმე." }, { status: 503 });

  const params: Record<string, unknown> = {
    order_id: orderId,
    merchant_id: FLITT_TEST_MERCHANT_ID,
    order_desc: `TUTA Premium ${plan} test access`,
    amount,
    currency: "GEL",
    sender_email: user.email || "",
    response_url: `${origin}/api/payments/flitt/return?type=premium`,
    server_callback_url: `${origin}/api/payments/flitt/callback`,
    lang: "ka",
    merchant_data: JSON.stringify({ product: `premium-${plan}`, test: true }),
  };
  params.signature = flittSignature(params);

  try {
    const response = await fetch("https://pay.flitt.com/api/checkout/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: params }),
      cache: "no-store",
    });
    const result = await response.json() as { response?: { response_status?: string; checkout_url?: string; error_message?: string; signature?: string } };
    const payment = result.response;
    if (!response.ok || payment?.response_status !== "success" || !payment.checkout_url || !verifyFlittSignature(payment)) {
      await clients.admin.from("premium_payments").update({ status: "failed" }).eq("order_id", orderId);
      return NextResponse.json({ error: "Flitt-მა სატესტო შეკვეთა ვერ შექმნა.", detail: payment?.error_message }, { status: 502 });
    }
    const checkoutUrl = new URL(payment.checkout_url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "pay.flitt.com") {
      await clients.admin.from("premium_payments").update({ status: "failed" }).eq("order_id", orderId);
      return NextResponse.json({ error: "Flitt-ის გადახდის ბმული არასწორია." }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl: checkoutUrl.toString() });
  } catch {
    await clients.admin.from("premium_payments").update({ status: "failed" }).eq("order_id", orderId);
    return NextResponse.json({ error: "Flitt-თან კავშირი ვერ შედგა. სცადე ხელახლა." }, { status: 502 });
  }
}
