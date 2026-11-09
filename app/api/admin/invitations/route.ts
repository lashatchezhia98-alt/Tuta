import { readAdminJson } from "@/lib/admin-request";
import { adminEmail, adminInviteHash, adminInviteToken, validAdminRecordId } from "@/lib/admin-invitations";
import { ApiError, checked, failure, requireAdmin, result } from "@/lib/platform-server";
import { isAssignableAdminRole } from "@/lib/admin-sections";

const columns = "id,email,created_at,expires_at,used_at,revoked_at,access_role";

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, true);
    const [invites, memberships] = await Promise.all([
      db.from("admin_invitations").select(columns).order("created_at", { ascending: false }).limit(100),
      db.from("admin_memberships").select("user_id,email,granted_at,revoked_at,access_role").is("revoked_at", null).order("granted_at", { ascending: false }),
    ]);
    return result({ invites: checked(invites), members: checked(memberships) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request, true);
    const input = await readAdminJson(request, 4096).catch(() => { throw new ApiError(400, "მოთხოვნა არასწორია."); });
    if (input.action === "create") {
      const email = adminEmail(input.email);
      if (!email || email === adminEmail(process.env.ADMIN_EMAIL)) throw new ApiError(400, "შეიყვანე მოწვეული პირის ელფოსტა.");
      if (!isAssignableAdminRole(input.role)) throw new ApiError(400, "აირჩიე მოწვეული პირის როლი.");
      const token = adminInviteToken();
      const invitation = checked(await db.from("admin_invitations").insert({ email, token_hash: adminInviteHash(token), access_role: input.role }).select(columns).single());
      return result({ invitation, path: `/admin/invite#${token}` }, 201);
    }
    if (!validAdminRecordId(input.id)) throw new ApiError(400, "მოთხოვნა არასწორია.");
    if (input.action === "revoke-invite") {
      const row = checked(await db.from("admin_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", input.id).is("used_at", null).is("revoked_at", null).select("id").maybeSingle());
      if (!row) throw new ApiError(409, "ეს მოწვევა უკვე გამოყენებული ან გაუქმებულია.");
    } else if (input.action === "revoke-member") {
      const revoked = checked(await db.rpc("revoke_admin_membership", { p_user_id: input.id }));
      if (revoked !== true) throw new ApiError(409, "ადმინის წვდომა უკვე გაუქმებულია.");
    } else throw new ApiError(400, "მოთხოვნა არასწორია.");
    return result({ ok: true });
  } catch (error) { return failure(error); }
}
