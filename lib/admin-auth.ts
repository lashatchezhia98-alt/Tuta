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

type AdminIdentity = { role: "owner" } | { role: "admin"; userId: string; grantId: string };
type Credentials = { email: string } | { userId: string; grantId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function createSession(identity: Credentials) {
  const payload = encode(JSON.stringify({ ...identity, expiresAt: Date.now() + SESSION_SECONDS * 1000 }));
  const signature = await sign(payload);
  return signature ? `${payload}.${signature}` : null;
}

export const createAdminSession = (email: string) => createSession({ email });
export const createInvitedAdminSession = (userId: string, grantId: string) => createSession({ userId, grantId });

export async function readAdminIdentity(value?: string): Promise<AdminIdentity | null> {
  if (!value || value.length > 4096 || value.split(".").length !== 2) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = await sign(payload);
  if (!expected || !safeEqual(signature, expected)) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(decoded, char => char.charCodeAt(0))));
    if (typeof data.expiresAt !== "number" || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= Date.now()) return null;
    if (typeof data.email === "string" && process.env.ADMIN_EMAIL && data.email === process.env.ADMIN_EMAIL) return { role: "owner" };
    if (typeof data.userId === "string" && uuid.test(data.userId) && typeof data.grantId === "string" && uuid.test(data.grantId))
      return { role: "admin", userId: data.userId, grantId: data.grantId };
    return null;
  } catch {
    return null;
  }
}

export async function verifyAdminSession(value?: string) {
  return (await readAdminIdentity(value))?.role === "owner";
}

export { COOKIE_NAME, SESSION_SECONDS };
