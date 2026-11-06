const COOKIE_NAME = "tuta_admin_session";
const SESSION_SECONDS = 60 * 60 * 12;

function encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encode(String.fromCharCode(...new Uint8Array(signature)));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

export async function createAdminSession(email: string) {
  const payload = encode(JSON.stringify({ email, expiresAt: Date.now() + SESSION_SECONDS * 1000 }));
  const signature = await sign(payload);
  return signature ? `${payload}.${signature}` : null;
}

export async function verifyAdminSession(value?: string) {
  if (!value || value.length > 4096 || value.split(".").length !== 2) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = await sign(payload);
  if (!expected || !safeEqual(signature, expected)) return false;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(decoded, char => char.charCodeAt(0))));
    return typeof data.email === "string" && Boolean(process.env.ADMIN_EMAIL)
      && data.email === process.env.ADMIN_EMAIL
      && typeof data.expiresAt === "number" && Number.isSafeInteger(data.expiresAt)
      && data.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export { COOKIE_NAME, SESSION_SECONDS };
