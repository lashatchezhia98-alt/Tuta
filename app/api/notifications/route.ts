import { adminInput, uuidPattern } from "@/lib/admin-operations";
import { ApiError, checked, failure, requireUser, result } from "@/lib/platform-server";

export async function GET(request: Request) {
  try {
    const { db, user } = await requireUser(request);
    return result({ rows: checked(await db.rpc("tuta_member_announcements", { p_user_id: user.id })) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const { db, user } = await requireUser(request);
    const { id } = await adminInput(request);
    if (typeof id !== "string" || !uuidPattern.test(id)) throw new ApiError(400, "შეტყობინების ნომერი არასწორია.");
    const rows = checked(await db.rpc("tuta_member_announcements", { p_user_id: user.id })) as { id: string }[];
    if (!rows.some(row => row.id === id)) throw new ApiError(404, "შეტყობინება ვერ მოიძებნა.");
    checked(await db.from("member_announcement_reads").upsert({ user_id: user.id, announcement_id: id }, { ignoreDuplicates: true }));
    return result({ ok: true });
  } catch (error) { return failure(error); }
}
