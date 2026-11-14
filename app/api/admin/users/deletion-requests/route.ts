import { checked, failure, requireAdmin, result } from "@/lib/platform-server";

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "users");
    const rows = checked(await db.from("account_deletion_requests")
      .select("user_id,requested_at").order("requested_at").limit(25));
    return result({ rows });
  } catch (error) {
    return failure(error);
  }
}
