import { createHash, timingSafeEqual } from "node:crypto";

// Cookie-authenticated writes must originate from this site, not a sibling domain.
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try { return Boolean(origin && new URL(origin).origin === new URL(request.url).origin); }
  catch { return false; }
}

export function credentialsMatch(actual: unknown, expected: string) {
  if (typeof actual !== "string" || actual.length > 4096) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

export async function readAdminJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("JSON required");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); throw new Error("Request too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Object required");
  return data as Record<string, unknown>;
}
