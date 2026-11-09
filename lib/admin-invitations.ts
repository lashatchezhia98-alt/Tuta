import { createHash, randomBytes } from "node:crypto";

export const adminInviteToken = () => randomBytes(32).toString("base64url");
export const adminInviteHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const validAdminInviteToken = (token: unknown): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
export const validAdminRecordId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function adminEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
