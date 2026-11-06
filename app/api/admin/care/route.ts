import {
  requireAdmin,
  checked,
  result,
  failure,
  ApiError,
} from "@/lib/platform-server";
import { readAdminJson } from "@/lib/admin-request";
import { textField, uuid } from "@/lib/content-validation";
export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request);
    const [doctors, slots] = await Promise.all([
      db
        .from("verified_doctors")
        .select(
          "user_id,first_name,last_name,doctor_profiles(specialty,bio,active)",
        )
        .limit(100),
      db
        .from("consultation_slots")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(200),
    ]);
    return result({ doctors: checked(doctors), slots: checked(slots) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request);
    let body: Record<string, unknown>, id: string;
    try {
      body = await readAdminJson(request);
      id = uuid(body.id);
    } catch {
      throw new ApiError(400, "შეამოწმე მონაცემები.");
    }
    if (body.action === "profile") {
      let specialty: string, bio: string;
      try {
        specialty = textField(body.specialty, 120);
        bio = textField(body.bio, 2000, false);
        if (typeof body.active !== "boolean") throw Error();
      } catch {
        throw new ApiError(400, "შეამოწმე სპეციალობა და აღწერა.");
      }
      // The account must already have been independently verified. No self-issued doctor badges.
      const verified = checked(
        await db
          .from("verified_doctors")
          .select("user_id")
          .eq("user_id", id)
          .maybeSingle(),
      );
      if (!verified)
        throw new ApiError(
          400,
          "ჯერ საჭიროა ექიმის ვინაობისა და კვალიფიკაციის გადამოწმება.",
        );
      checked(
        await db
          .from("doctor_profiles")
          .upsert({ user_id: id, specialty, bio, active: body.active }),
      );
      return result({ ok: true });
    }
    if (body.action === "slot") {
      let starts_at: string, location: string;
      try {
        starts_at = textField(body.starts_at, 40);
        location = textField(body.location, 200);
        const t = new Date(starts_at);
        if (
          !Number.isFinite(t.getTime()) ||
          t.getTime() <= Date.now() ||
          ![0, 30].includes(t.getUTCMinutes()) ||
          t.getUTCSeconds() !== 0
        )
          throw Error();
      } catch {
        throw new ApiError(
          400,
          "აირჩიე მომავალი დრო, ზუსტ საათზე ან ნახევარზე.",
        );
      }
      const saved = await db
        .from("consultation_slots")
        .insert({ doctor_id: id, starts_at, location });
      if (saved.error?.code === "23505")
        throw new ApiError(409, "ეს დრო უკვე დამატებულია.");
      checked(saved);
      return result({ ok: true });
    }
    if (body.action === "delete-slot") {
      // Keep any slot with booking history for patient/doctor access and auditability.
      const saved = await db.from("consultation_slots").delete().eq("id", id);
      if (saved.error?.code === "23503")
        throw new ApiError(409, "ჯავშნის ისტორიის მქონე დრო ვერ წაიშლება.");
      checked(saved);
      return result({ ok: true });
    }
    throw new ApiError(400, "უცნობი მოქმედება.");
  } catch (e) {
    return failure(e);
  }
}
