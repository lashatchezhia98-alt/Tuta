import { NextResponse } from "next/server";
import {
  flittEnvironment,
  decodeFlittEnvelope,
  FLITT_TEST_MERCHANT_ID,
  tutaPremiumOrder,
  verifyFlittOrderStatus,
  verifyFlittSignature,
} from "@/lib/flitt";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const clients = flittEnvironment();
  if (!clients)
    return NextResponse.json(
      { error: "Payment callback is not configured." },
      { status: 503 },
    );

  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid callback body." },
        { status: 400 },
      );
    }
    const record = body as Record<string, unknown>;
    const nested = record.response;
    payload =
      nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : record;
  } catch {
    return NextResponse.json(
      { error: "Invalid callback body." },
      { status: 400 },
    );
  }

  const verifiedPayload = typeof payload.data === "string" ? decodeFlittEnvelope(payload)
    : verifyFlittSignature(payload) ? payload : null;
  if (!verifiedPayload)
    return NextResponse.json(
      { error: "Invalid Flitt signature." },
      { status: 401 },
    );
  payload = verifiedPayload;
  const orderId = payload.order_id;
  const paymentId = String(payload.payment_id ?? "");
  const status = payload.order_status;
  const merchantId = String(payload.merchant_id ?? "");
  const parent = String(payload.parent_order_id ?? "");
  if (
    typeof orderId !== "string" ||
    (parent
      ? !tutaPremiumOrder.test(parent) || parent === orderId || !/^[\w.#:-]{1,256}$/.test(orderId) || orderId.startsWith("tuta-market-")
      : !/^tuta-(?:market-)?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderId)) ||
    !/^\d{1,32}$/.test(paymentId) ||
    merchantId !== String(FLITT_TEST_MERCHANT_ID)
  ) {
    return NextResponse.json(
      { error: "Unknown Flitt order." },
      { status: 400 },
    );
  }
  const amount = Number(payload.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0 || payload.currency !== "GEL") {
    return NextResponse.json(
      { error: "Payment amount or currency is invalid." },
      { status: 400 },
    );
  }
  const allowedStatuses = new Set([
    "approved",
    "declined",
    "expired",
    "reversed",
    "processing",
    "created",
  ]);
  if (typeof status !== "string" || !allowedStatuses.has(status))
    return NextResponse.json(
      { error: "Unknown payment status." },
      { status: 400 },
    );

  // The public sandbox key is not an authentication secret. Confirm the
  // signed event with Flitt directly before granting access or marking it paid.
  try {
    if (!(await verifyFlittOrderStatus(orderId, paymentId, status, amount, parent))) {
      return NextResponse.json({ error: "Flitt has not confirmed this payment status." }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "Flitt status is temporarily unavailable." }, { status: 503 });
  }

  if (orderId.startsWith("tuta-market-")) {
    const { data: accepted, error: marketUpdateError } =
      await clients.admin.rpc("apply_flitt_market_payment", {
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_status: status,
        p_amount: amount,
      });
    if (marketUpdateError)
      return NextResponse.json(
        { error: "Could not update market order." },
        { status: 503 },
      );
    if (!accepted)
      return NextResponse.json(
        { error: "Market order or amount does not match." },
        { status: 404 },
      );
    return NextResponse.json({ received: true });
  }

  const { data, error } = await clients.admin.rpc(
    parent ? "apply_flitt_premium_renewal" : "apply_flitt_premium_payment",
    {
      ...(parent ? { p_parent: parent } : {}),
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_status: status,
      p_amount: amount,
    },
  );
  if (error)
    return NextResponse.json(
      { error: "Could not update payment status." },
      { status: 503 },
    );
  if (!data)
    return NextResponse.json(
      { error: "Payment order was not found." },
      { status: 404 },
    );
  return NextResponse.json({ received: true });
}
