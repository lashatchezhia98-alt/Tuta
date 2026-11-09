import { NextResponse } from "next/server";
import { bearerToken, createFlittCheckout, flittEnvironment, FLITT_TEST_AMOUNTS, FLITT_TEST_MERCHANT_ID, type PremiumPlan } from "@/lib/flitt";

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
    response_url: `${origin}/api/payments/flitt/return?type=premium`,
    server_callback_url: `${origin}/api/payments/flitt/callback`,
    lang: "ka",
    merchant_data: JSON.stringify({ product: `premium-${plan}`, test: true }),
  };
  try {
    const checkoutUrl = await createFlittCheckout(params);
    if (!checkoutUrl) {
      await clients.admin.from("premium_payments").update({ status: "failed" }).eq("order_id", orderId);
      return NextResponse.json({ error: "Flitt-მა სატესტო შეკვეთა ვერ შექმნა." }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await clients.admin.from("premium_payments").update({ status: "failed" }).eq("order_id", orderId);
    return NextResponse.json({ error: "Flitt-თან კავშირი ვერ შედგა. სცადე ხელახლა." }, { status: 502 });
  }
}
