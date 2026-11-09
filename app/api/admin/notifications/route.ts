import { adminInput, audiences, queryPage, uuidPattern } from "@/lib/admin-operations";
import { ApiError, checked, failure, requireAdmin, result } from "@/lib/platform-server";

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "notifications");
    const page = queryPage(new URL(request.url).searchParams);
    const rows = checked(await db.from("member_announcements").select("id,title,body,audience,scheduled_at,cancelled_at")
      .order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 25)) || [];
    return result({ rows: rows.slice(0, 25), more: rows.length > 25, now: new Date().toISOString() });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request, false, "notifications");
    const { action, id, title, body, audience, scheduledAt } = await adminInput(request);
    if (action === "cancel") {
      if (typeof id !== "string" || !uuidPattern.test(id)) throw new ApiError(400, "შეტყობინების ნომერი არასწორია.");
      const changed = checked(await db.from("member_announcements").update({ cancelled_at: new Date().toISOString() })
        .eq("id", id).is("cancelled_at", null).select("id").maybeSingle());
      if (!changed) throw new ApiError(404, "შეტყობინება აღარ არის აქტიური.");
    } else if (action === "publish") {
      const now = Date.now();
      const time = scheduledAt == null ? now : typeof scheduledAt === "string" ? Date.parse(scheduledAt) : NaN;
      if (!Number.isFinite(time) || time < now || time > now + 365 * 86400000) throw new ApiError(400, "აირჩიე მომავალი დრო, მაქსიმუმ ერთი წლით წინ.");
      if (typeof id !== "string" || !uuidPattern.test(id) || typeof title !== "string" || title.trim().length < 1 || title.trim().length > 100 || typeof body !== "string" || body.trim().length < 1 || body.trim().length > 500 || !audiences.some(value => value === audience))
        throw new ApiError(400, "შეავსე სათაური, ტექსტი და მიმღებთა ჯგუფი.");
      const { error } = await db.from("member_announcements").insert({ id, title: title.trim(), body: body.trim(), audience, scheduled_at: new Date(time).toISOString() });
      if (error?.code !== "23505" && error) throw new ApiError(503, "შეტყობინება ვერ შეინახა.");
    } else throw new ApiError(400, "მოქმედება არასწორია.");
    return result({ ok: true });
  } catch (error) { return failure(error); }
}
