import { NextResponse } from "next/server";
import { bearerToken, createFlittCheckout, flittCheckoutUrl, flittEnvironment, flittRenewalParams, readFlittOrderStatus, FLITT_TEST_AMOUNTS, FLITT_TEST_MERCHANT_ID, type PremiumPlan } from "@/lib/flitt";
import { flittReturnUrl } from "@/lib/flitt-return";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const clients = flittEnvironment();
  if (!clients) return NextResponse.json({ error: "სატესტო გადახდის სერვისი ჯერ არ არის დაყენებული." }, { status: 503 });

  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "Premium-ის შესაძენად ჯერ შედი ანგარიშში." }, { status: 401 });
  const { data: { user }, error: authError } = await clients.auth.auth.getUser(accessToken);
  if (authError || !user || user.is_anonymous) return NextResponse.json({ error: "გადახდის დაწყება მხოლოდ რეგისტრირებული ანგარიშით შეიძლება." }, { status: 401 });

  let requestedPlan: unknown;
  let mobile = false;
  let renew = false;
  try {
    const body = await request.json();
    requestedPlan = body.plan;
    mobile = body.returnTo === "app";
    renew = body.autoRenew === true;
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
  const lifetime = 900;
  const reserved = {
    order_id: orderId,
    user_id: user.id,
    amount,
    currency: "GEL",
    status: "pending",
    mode: "test",
    plan,
    checkout_deadline: new Date(Date.now() + lifetime * 1000).toISOString(),
    renewal_requested: renew,
  };
  const pending = () => NextResponse.json({ code: "premium_pending", error: "წინა გადახდა ჯერ მუშავდება ან გადახდის ბმული კვლავ მოქმედებს. სცადე მოგვიანებით." }, { status: 409 });
  const checkoutResponse = (checkoutUrl: string) => NextResponse.json({ checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
  let inserted = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await clients.admin.from("premium_payments").insert(reserved);
    if (!error) { inserted = true; break; }
    if (error.code === "PT409" && error.message === "premium_paid")
      return NextResponse.json({ code: "premium_paid", error: "ამ პერიოდის Premium უკვე გადახდილია." }, { status: 409 });
    if (error.code === "PT409" && error.message === "premium_renewing")
      return NextResponse.json({ code: "premium_renewing", error: "ამ ანგარიშზე ავტომატური განახლება უკვე მოქმედებს ან ცვლილება მუშავდება." }, { status: 409 });
    if (error.code !== "PT409" || error.message !== "premium_pending")
      return NextResponse.json({ error: "შეკვეთის შენახვა ვერ მოხერხდა. სცადე ხელახლა." }, { status: 503 });
    const open = await clients.admin.from("premium_payments")
      .select("order_id,amount,status,plan,created_at,checkout_deadline,checkout_url,renewal_requested,parent_order_id")
      .eq("user_id", user.id).in("status", ["pending", "created", "processing"])
      .order("created_at").limit(1).maybeSingle();
    if (open.error || !open.data) return pending();
    const previous = open.data;
    const url = flittCheckoutUrl(previous.checkout_url);
    if (Date.parse(previous.created_at) > Date.now() - 120_000 && !url) return pending();
    try {
      const state = await readFlittOrderStatus(previous.order_id, previous.amount);
      if (state === "missing" && !previous.parent_order_id && !url && previous.status === "pending" && Date.parse(previous.created_at) <= Date.now() - 120_000) {
        // No checkout URL was issued and the provider confirms there is no order.
        const { error: saveError } = await clients.admin.from("premium_payments").update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("order_id", previous.order_id).eq("status", "pending").is("checkout_url", null);
        if (!saveError) continue;
      } else if (state && state !== "missing" && state.parent === (previous.parent_order_id || "")) {
        if (["approved", "declined", "expired", "reversed"].includes(state.status)) {
          const applied = await clients.admin.rpc("apply_flitt_premium_payment", { p_order_id: previous.order_id, p_payment_id: state.paymentId, p_status: state.status, p_amount: previous.amount });
          if (!applied.error && applied.data) continue;
        }
        if (state.status === "created" && url && previous.plan === plan && previous.renewal_requested === renew &&
          previous.checkout_deadline && Date.parse(previous.checkout_deadline) > Date.now()) return checkoutResponse(url);
      }
    } catch { /* Indeterminate gateway results must not unlock a second checkout. */ }
    return pending();
  }
  if (!inserted) return pending();

  const params: Record<string, unknown> = {
    order_id: orderId,
    merchant_id: FLITT_TEST_MERCHANT_ID,
    order_desc: `TUTA Premium ${plan} test access`,
    amount,
    currency: "GEL",
    response_url: flittReturnUrl(origin, "premium", orderId, mobile),
    server_callback_url: `${origin}/api/payments/flitt/callback`,
    lang: "ka",
    lifetime,
    delayed: "N",
    ...(renew ? { ...flittRenewalParams(plan), subscription_callback_url: `${origin}/api/payments/flitt/callback` } : {}),
    merchant_data: JSON.stringify({ product: `premium-${plan}`, test: true }),
  };
  try {
    const checkoutUrl = await createFlittCheckout(params);
    if (!checkoutUrl) {
      return NextResponse.json({ error: "Flitt-მა სატესტო შეკვეთა ვერ შექმნა." }, { status: 502 });
    }
    const saved = await clients.admin.from("premium_payments").update({ checkout_url: checkoutUrl })
      .eq("order_id", orderId).in("status", ["pending", "created"]).select("order_id").maybeSingle();
    if (saved.error || !saved.data) return pending();
    return checkoutResponse(checkoutUrl);
  } catch {
    return NextResponse.json({ error: "Flitt-თან კავშირი ვერ შედგა. სცადე ხელახლა." }, { status: 502 });
  }
}
