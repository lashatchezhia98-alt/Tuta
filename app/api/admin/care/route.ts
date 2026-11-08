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
    const [doctors, slots, bookings] = await Promise.all([
      db
        .from("verified_doctors")
        .select(
          "user_id,first_name,last_name,photo_public_id,doctor_profiles(specialty,bio,active)",
        )
        .limit(100),
      db
        .from("consultation_slots")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(200),
      db
        .from("consultation_bookings")
        .select(
          "id,patient_label,status,consultation_slots(id,doctor_id,starts_at,location)",
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    return result({
      doctors: checked(doctors),
      slots: checked(slots),
      bookings: checked(bookings),
    });
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
    if (body.action === "remove-photo") {
      const saved = checked(
        await db
          .from("verified_doctors")
          .update({ photo_public_id: null })
          .eq("user_id", id)
          .select("user_id")
          .maybeSingle(),
      );
      if (!saved) throw new ApiError(404, "ექიმი ვერ მოიძებნა.");
      return result({ ok: true });
    }
    if (
      body.action === "cancel-booking" ||
      body.action === "reschedule-booking"
    ) {
      const booking = checked(
        await db
          .from("consultation_bookings")
          .select("id,slot_id,consultation_slots!inner(doctor_id)")
          .eq("id", id)
          .eq("status", "confirmed")
          .maybeSingle(),
      );
      if (!booking) throw new ApiError(404, "მოქმედი ჯავშანი ვერ მოიძებნა.");
      const patch: Record<string, string> = { status: "cancelled" };
      if (body.action === "reschedule-booking") {
        let slotId: string;
        try {
          slotId = uuid(body.slotId);
        } catch {
          throw new ApiError(400, "აირჩიე ახალი დრო.");
        }
        const doctor = (
          booking.consultation_slots as unknown as { doctor_id: string }
        ).doctor_id;
        const slot = checked(
          await db
            .from("consultation_slots")
            .select("id")
            .eq("id", slotId)
            .eq("doctor_id", doctor)
            .gt("starts_at", new Date().toISOString())
            .maybeSingle(),
        );
        if (!slot || slot.id === booking.slot_id)
          throw new ApiError(400, "აირჩიე იმავე ექიმის სხვა მომავალი დრო.");
        patch.status = "confirmed";
        patch.slot_id = slot.id;
      }
      const saved = await db
        .from("consultation_bookings")
        .update(patch)
        .eq("id", id)
        .eq("status", "confirmed")
        .eq("slot_id", booking.slot_id)
        .select("id")
        .maybeSingle();
      if (saved.error?.code === "23505")
        throw new ApiError(409, "ეს დრო უკვე დაჯავშნილია.");
      if (!checked(saved))
        throw new ApiError(409, "ჯავშანი პარალელურად შეიცვალა. განაახლე სია.");
      return result({ ok: true });
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
