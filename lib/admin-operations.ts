import { readAdminJson } from "./admin-request";
import { ApiError, checked, type dbClient } from "./platform-server";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const audiences = ["all", "free", "premium"] as const;
export const paymentStatuses = ["pending", "created", "processing", "approved", "declined", "expired", "reversed", "failed"] as const;

export function queryPage(params: URLSearchParams) {
  const raw = params.get("page") || "0";
  if (!/^\d{1,4}$/.test(raw)) throw new ApiError(400, "გვერდის ნომერი არასწორია.");
  return Number(raw);
}

export async function adminInput(request: Request) {
  try { return await readAdminJson(request); }
  catch { throw new ApiError(400, "მოთხოვნის მონაცემები არასწორია."); }
}

export async function premiumExpiry(db: ReturnType<typeof dbClient>, userId: string): Promise<string | null> {
  return checked(await db.rpc("tuta_premium_expiry", { p_user_id: userId }));
}
