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
  const expected = Buffer.from(flittSignature(params), "hex");
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
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
