import { adminEmail, adminInviteHash, validAdminInviteToken } from "@/lib/admin-invitations";
import { COOKIE_NAME, createInvitedAdminSession, SESSION_SECONDS } from "@/lib/admin-auth";
import { isSameOrigin, readAdminJson } from "@/lib/admin-request";
import { ApiError, checked, failure, requireUser, result } from "@/lib/platform-server";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ApiError(403, "მოთხოვნა დაუშვებელია.");
    const body = await readAdminJson(request, 4096).catch(() => { throw new ApiError(400, "მოთხოვნა არასწორია."); });
    if (!validAdminInviteToken(body.token)) throw new ApiError(400, "მოწვევის ბმული არასწორია.");
    const { db, user } = await requireUser(request);
    const email = adminEmail(user.email);
    if (!user.email_confirmed_at || !email || email === adminEmail(process.env.ADMIN_EMAIL))
      throw new ApiError(403, "გამოიყენე მოწვეული და დადასტურებული ელფოსტა.");
    const claimed = checked(await db.rpc("claim_admin_invitation", { p_token_hash: adminInviteHash(body.token), p_user_id: user.id, p_verified_email: email }));
    if (claimed !== true) throw new ApiError(409, "ბმული უკვე გამოყენებულია, გაუქმებულია, ვადა გაუვიდა ან სხვა ელფოსტისთვისაა.");
    const member = checked(await db.from("admin_memberships").select("invite_id").eq("user_id", user.id).is("revoked_at", null).maybeSingle());
    const session = member && await createInvitedAdminSession(user.id, member.invite_id);
    const response = result({ ok: true, signedIn: Boolean(session) });
    if (session) response.cookies.set(COOKIE_NAME, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
    return response;
  } catch (error) { return failure(error); }
}
