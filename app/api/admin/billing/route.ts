import { adminInput, paymentStatuses, queryPage, uuidPattern } from "@/lib/admin-operations";
import { ApiError, checked, failure, requireAdmin, result } from "@/lib/platform-server";

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "billing");
    const params = new URL(request.url).searchParams;
    const page = queryPage(params);
    const status = params.get("status");
    if (status && !paymentStatuses.some(item => item === status)) throw new ApiError(400, "სტატუსი არასწორია.");
    const user = params.get("user");
    if (user && !uuidPattern.test(user)) throw new ApiError(400, "ანგარიშის ნომერი არასწორია.");
    let payments = db.from("premium_payments").select("order_id,user_id,amount,plan,status,created_at").eq("mode", "test");
    if (status) payments = payments.eq("status", status);
    if (user) payments = payments.eq("user_id", user);
    let grants = db.from("premium_admin_grants").select("id,user_id,reason,expires_at,revoked_at,created_at");
    if (user) grants = grants.eq("user_id", user);
    const [summary, history, grantHistory] = await Promise.all([
      db.rpc("tuta_admin_billing_summary"),
      payments.order("created_at", { ascending: false }).order("order_id").range(page * 25, page * 25 + 25),
      grants.order("created_at", { ascending: false }).order("id").limit(25),
    ]);
    const rows = checked(history) || [];
    return result({ summary: checked(summary), rows: rows.slice(0, 25), more: rows.length > 25, grants: checked(grantHistory) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request, true, "billing");
    const { action, id, days, reason } = await adminInput(request);
    if (typeof id !== "string" || !uuidPattern.test(id)) throw new ApiError(400, "ნომერი არასწორია.");
    if (action === "grant") {
      if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 365 || typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 200)
        throw new ApiError(400, "მიუთითე დღეების რაოდენობა (1–365) და მიზეზი.");
      const auth = await db.auth.admin.getUserById(id);
      if (auth.error?.status === 404) throw new ApiError(404, "ანგარიში ვერ მოიძებნა.");
      if (auth.error) throw new ApiError(503, "ანგარიში ვერ ჩაიტვირთა.");
      const { user } = auth.data;
      if (!user?.email_confirmed_at || user.is_anonymous || Date.parse(user.banned_until || "") > Date.now()) throw new ApiError(409, "საჭიროა დადასტურებული, აქტიური ანგარიში.");
      checked(await db.from("premium_admin_grants").insert({ user_id: id, reason: reason.trim(), expires_at: new Date(Date.now() + days * 86400000).toISOString() }));
    } else if (action === "revoke") {
      const changed = checked(await db.from("premium_admin_grants").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null).select("id").maybeSingle());
      if (!changed) throw new ApiError(404, "წვდომა ვერ მოიძებნა ან უკვე გაუქმებულია.");
    } else throw new ApiError(400, "მოქმედება არასწორია.");
    return result({ ok: true });
  } catch (error) { return failure(error); }
}
