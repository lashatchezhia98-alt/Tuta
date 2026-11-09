import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, readAdminIdentity } from "./admin-auth";
import { isSameOrigin } from "./admin-request";
import { canAccessAdminSection, type AdminAccess, type AdminSection } from "./admin-sections";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError(503, "სერვისი ჯერ არ არის გამართული.");
  return createClient(
    /^https?:/.test(url) ? url : `https://${url}.supabase.co`,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireUser(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new ApiError(401, "გაიარე ავტორიზაცია.");
  const db = dbClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user || user.is_anonymous)
    throw new ApiError(401, "გაიარე ავტორიზაცია.");
  return { db, user };
}
export async function getAdminIdentity() {
  const identity = await readAdminIdentity((await cookies()).get(COOKIE_NAME)?.value);
  if (!identity) return null;
  if (identity.role === "owner") return { ...identity, access: "owner" as const };
  try {
    const { data, error } = await dbClient().from("admin_memberships").select("access_role")
      .eq("user_id", identity.userId).eq("invite_id", identity.grantId).is("revoked_at", null).maybeSingle();
    const access: AdminAccess = data?.access_role;
    return !error && (access === "admin" || access === "content_editor" || access === "support") ? { ...identity, access } : null;
  } catch { return null; }
}

export async function requireAdminIdentity(request: Request, ownerOnly = false, section: AdminSection = "overview") {
  if (request.method !== "GET" && !isSameOrigin(request))
    throw new ApiError(403, "მოთხოვნა დაუშვებელია.");
  const identity = await getAdminIdentity();
  if (!identity) throw new ApiError(401, "ადმინის შესვლა ხელახლა გაიარე.");
  if (ownerOnly && identity.role !== "owner") throw new ApiError(403, "ეს მოქმედება მხოლოდ მთავარ ადმინს შეუძლია.");
  if (!canAccessAdminSection(identity.access, section)) throw new ApiError(403, "ამ სექციაზე წვდომა არ გაქვს.");
  return identity;
}

export async function requireAdmin(request: Request, ownerOnly = false, section?: AdminSection) {
  await requireAdminIdentity(request, ownerOnly, section);
  return dbClient();
}
export async function requireFeature(
  db: ReturnType<typeof dbClient>,
  key: string,
) {
  const { data, error } = await db
    .from("site_settings")
    .select("features")
    .eq("id", "global")
    .maybeSingle();
  if (error || !data) throw new ApiError(503, "პარამეტრები ვერ ჩაიტვირთა.");
  if (data.features[key] === false)
    throw new ApiError(403, "ეს ფუნქცია დროებით გამორთულია.");
}
export function result(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function failure(error: unknown) {
  return result(
    {
      error:
        error instanceof ApiError
          ? error.message
          : "მოთხოვნა ვერ შესრულდა. სცადე ხელახლა.",
    },
    error instanceof ApiError ? error.status : 503,
  );
}
export function checked<T>(response: { data: T; error: unknown }): T {
  if (response.error) throw new ApiError(503, "ბაზასთან კავშირი ვერ შედგა.");
  return response.data;
}
