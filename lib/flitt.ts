import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const FLITT_TEST_AMOUNTS = { monthly: 499, yearly: 4990 } as const; // tetri: 4.99 / 49.90 GEL
export type PremiumPlan = keyof typeof FLITT_TEST_AMOUNTS;
export const FLITT_TEST_MERCHANT_ID = Number(process.env.FLITT_MERCHANT_ID || "1549901");
export const FLITT_TEST_SECRET = process.env.FLITT_SECRET_KEY || "test";

export function flittSignature(params: Record<string, unknown>) {
  const values = Object.entries(params)
    .filter(([key, value]) => key !== "signature" && key !== "response_signature_string" && value !== "" && value !== null && value !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, value]) => String(value));
  return createHash("sha1").update([FLITT_TEST_SECRET, ...values].join("|"), "utf8").digest("hex");
}

export function verifyFlittSignature(params: Record<string, unknown>) {
  const signature = params.signature;
  if (typeof signature !== "string" || !/^[a-f\d]{40}$/i.test(signature)) return false;
  const expected = Buffer.from(params.version === "2.0" && typeof params.data === "string"
    ? signV2(params.data) : flittSignature(params), "hex");
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function signV2(data: string) {
  return createHash("sha1").update(`${FLITT_TEST_SECRET}|${data}`, "utf8").digest("hex");
}

export function decodeFlittEnvelope(envelope: Record<string, unknown>) {
  if (typeof envelope.data !== "string" || envelope.data.length > 64_000 ||
      !verifyFlittSignature({ ...envelope, version: "2.0" })) return null;
  try {
    const order = JSON.parse(Buffer.from(envelope.data, "base64").toString("utf8")).order;
    return order && typeof order === "object" && !Array.isArray(order) ? order as Record<string, unknown> : null;
  } catch { return null; }
}

async function flittRequest(path: "checkout/url" | "status/order_id" | "subscription", params: Record<string, unknown>, allowFailure = false) {
  const encoded = params.recurring_data ? Buffer.from(JSON.stringify({ order: params })).toString("base64") : null;
  const response = await fetch(`https://pay.flitt.com/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: encoded
      ? { version: "2.0", data: encoded, signature: signV2(encoded) }
      : { ...params, signature: flittSignature(params) } }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json() as { response?: Record<string, unknown> } | null;
  const envelope = result?.response;
  const payment = encoded && envelope?.data ? decodeFlittEnvelope(envelope) : envelope;
  if (!response.ok || !payment || (!allowFailure && payment.response_status !== "success" &&
    !(encoded && envelope?.data && payment.response_status === undefined && typeof payment.checkout_url === "string"))) return null;
  return payment;
}

export async function createFlittCheckout(params: Record<string, unknown>) {
  const payment = await flittRequest("checkout/url", params);
  if (!payment || typeof payment.checkout_url !== "string") return null;
  // This HTTPS endpoint returns unsigned checkout URLs. A supplied signature
  // still must be valid; this response can never authorize a payment.
  if (Object.hasOwn(payment, "signature") && !verifyFlittSignature(payment)) return null;
  return flittCheckoutUrl(payment.checkout_url);
}

export function flittCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === "https://pay.flitt.com" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export const flittPaymentStatuses = ["approved", "declined", "expired", "reversed", "processing", "created"] as const;
export const tutaPremiumOrder = /^tuta-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export async function readFlittOrderStatus(orderId: string, amount: number) {
  const payment = await flittRequest("status/order_id", {
    order_id: orderId,
    merchant_id: FLITT_TEST_MERCHANT_ID,
  }, true);
  if (payment?.response_status === "failure" && String(payment.error_code ?? payment.response_code) === "1018") return "missing" as const;
  if (
    payment?.response_status === "success" && verifyFlittSignature(payment) &&
    payment.order_id === orderId &&
    /^\d{1,32}$/.test(String(payment.payment_id ?? "")) &&
    String(payment.merchant_id ?? "") === String(FLITT_TEST_MERCHANT_ID) &&
    payment.currency === "GEL" && Number(payment.amount) === amount &&
    flittPaymentStatuses.some(status => status === payment.order_status)
  ) return { paymentId: String(payment.payment_id), status: String(payment.order_status), parent: String(payment.parent_order_id ?? "") };
  return null;
}

export async function verifyFlittOrderStatus(orderId: string, paymentId: string, status: string, amount: number, parent = "") {
  const payment = await readFlittOrderStatus(orderId, amount);
  return Boolean(payment && payment !== "missing" && payment.paymentId === paymentId && payment.status === status && payment.parent === parent);
}

export function flittRenewalParams(plan: PremiumPlan) {
  const period = plan === "yearly" ? "month" : "day";
  const every = plan === "yearly" ? 12 : 30;
  return {
    subscription: "Y",
    recurring_data: { every, period, amount: FLITT_TEST_AMOUNTS[plan], state: "shown_readonly", quantity: plan === "yearly" ? 10 : 120, trial_period: period, trial_quantity: every },
  };
}

export async function setFlittRenewal(orderId: string, enabled: boolean) {
  const params = {
    order_id: orderId,
    merchant_id: FLITT_TEST_MERCHANT_ID,
    action: enabled ? "start" : "stop",
  };
  const payment = await flittRequest("subscription", params);
  // Flitt's stop/start endpoint can echo the exact request signature rather
  // than signing response fields. Only accept that on its direct HTTPS reply.
  return Boolean(payment && (verifyFlittSignature(payment) || payment.signature === flittSignature(params)) &&
    payment.order_id === orderId && String(payment.merchant_id) === String(FLITT_TEST_MERCHANT_ID) &&
    payment.status === (enabled ? "active" : "disabled"));
}

export function flittEnvironment() {
  if (process.env.FLITT_MODE && process.env.FLITT_MODE !== "test") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !secretKey) return null;
  const projectUrl = /^https?:\/\//i.test(url) ? url.replace(/\/+$/, "") : `https://${url}.supabase.co`;
  return {
    auth: createClient(projectUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
