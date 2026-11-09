import { adminInput, queryPage, uuidPattern } from "@/lib/admin-operations";
import { ApiError, checked, failure, requireAdmin, result } from "@/lib/platform-server";

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "users");
    const params = new URL(request.url).searchParams;
    const page = queryPage(params);
    const plan = params.get("plan") || "all";
    const joined = params.get("joined") || "0";
    if (!["all", "free", "premium"].includes(plan) || !["0", "7", "30", "90"].includes(joined)) throw new ApiError(400, "ფილტრი არასწორია.");
    const rows = checked(await db.rpc("tuta_admin_users", {
      p_query: (params.get("q") || "").trim().slice(0, 120), p_plan: plan,
      p_offset: page * 25, p_joined_days: Number(joined),
    })) as { email: string | null }[];
    const owner = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    return result({ rows: rows.slice(0, 25).map(row => ({ ...row, protected: row.email?.toLowerCase() === owner && Boolean(owner) })), more: rows.length > 25 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const db = await requireAdmin(request, true, "users");
    const { id, action, role } = await adminInput(request);
    if (typeof id !== "string" || !uuidPattern.test(id)) throw new ApiError(400, "ანგარიშის ნომერი არასწორია.");
    const auth = await db.auth.admin.getUserById(id);
    if (auth.error?.status === 404 || (!auth.error && !auth.data.user)) throw new ApiError(404, "ანგარიში ვერ მოიძებნა.");
    if (auth.error) throw new ApiError(503, "ანგარიში ვერ ჩაიტვირთა.");
    const { user } = auth.data;
    if (user.is_anonymous || user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase()) throw new ApiError(403, "ეს ანგარიში დაცულია.");
    if (action === "role") {
      if (role !== "admin" && role !== "content_editor" && role !== "support") throw new ApiError(400, "როლი არასწორია.");
      const updated = checked(await db.from("admin_memberships").update({ access_role: role })
        .eq("user_id", id).is("revoked_at", null).select("user_id").maybeSingle());
      if (!updated) throw new ApiError(404, "როლის შესაცვლელად ანგარიში ჯერ მოწვევით დაამატე.");
    } else if (action === "block" || action === "unblock") {
      const membership = checked(await db.from("admin_memberships").select("user_id").eq("user_id", id).is("revoked_at", null).maybeSingle());
      if (action === "block" && membership) throw new ApiError(409, "ჯერ გააუქმე ადმინის წვდომა მოწვევების გვერდიდან.");
      const update = await db.auth.admin.updateUserById(id, { ban_duration: action === "block" ? "876000h" : "none" });
      if (update.error) throw new ApiError(503, "ანგარიში ვერ განახლდა.");
    } else throw new ApiError(400, "მოქმედება არასწორია.");
    return result({ ok: true });
  } catch (error) { return failure(error); }
}
