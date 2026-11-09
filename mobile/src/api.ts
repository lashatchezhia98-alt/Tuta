import { supabase } from "./supabase";
export const apiRoot =
  typeof __DEV__ !== "undefined" &&
  __DEV__ &&
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? ""
    : process.env.EXPO_PUBLIC_TUTA_API_URL?.trim().replace(/\/$/, "") ||
      "https://tutahealth.ge";
export async function api<T = any>(
  path: string,
  {
    body,
    signal,
    userId,
    method,
  }: { body?: unknown; signal?: AbortSignal; userId?: string; method?: "PATCH" } = {},
): Promise<T> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (userId && session?.user.id !== userId)
    throw Error("ანგარიში შეიცვალა / Account changed");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(apiRoot + path, {
      method: method ?? (body ? "POST" : "GET"),
      headers: {
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
      cache: "no-store",
    });
    const value = await response.json();
    if (!response.ok)
      throw Error(value.error || "კავშირი ვერ შედგა / Connection unavailable");
    if (
      userId &&
      (await supabase?.auth.getSession())?.data.session?.user.id !== userId
    )
      throw Error("ანგარიში შეიცვალა / Account changed");
    return value;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
export function checkoutDestination(value: unknown) {
  if (typeof value !== "string") throw Error("Invalid checkout URL");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "pay.flitt.com" ||
    url.username !== "" ||
    url.password !== ""
  )
    throw Error("Invalid checkout URL");
  return url.toString();
}
