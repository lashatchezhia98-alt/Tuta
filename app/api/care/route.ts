import {
  requireUser,
  requireFeature,
  checked,
  result,
  failure,
  ApiError,
} from "@/lib/platform-server";
import { readAdminJson } from "@/lib/admin-request";
import { textField, uuid } from "@/lib/content-validation";

export async function GET(request: Request) {
  try {
    const { db, user } = await requireUser(request);
    const threadId = new URL(request.url).searchParams.get("thread");
    if (threadId) {
      try {
        uuid(threadId);
      } catch {
        throw new ApiError(400, "არასწორი ჩატი.");
      }
      const thread = checked(
        await db
          .from("consultation_threads")
          .select("id,patient_id,doctor_id")
          .eq("id", threadId)
          .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`)
          .maybeSingle(),
      );
      if (!thread) throw new ApiError(404, "ჩატი ვერ მოიძებნა.");
      const messages = checked(
        await db
          .from("consultation_messages")
          .select("id,sender_id,body,created_at")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: false })
          .limit(100),
      );
      return result({ messages: (messages || []).reverse(), userId: user.id });
    }
    const [doctors, threads, membership, ownDoctor] = await Promise.all([
      db
        .from("doctor_profiles")
        .select("user_id,specialty,bio,verified_doctors(first_name,last_name)")
        .eq("active", true)
        .limit(100),
      db
        .from("consultation_threads")
        .select("id,doctor_id,patient_id,patient_label")
        .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("premium_memberships")
        .select("expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("doctor_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle(),
    ]);
    const profiles = checked(doctors) || [],
      isDoctor = Boolean(checked(ownDoctor)),
      active = Boolean(
        checked(membership) &&
          Date.parse(membership.data!.expires_at) > Date.now(),
      );
    // Only return the user's own bookings, plus bookings for a verified doctor's own slots.
    const ownBookings = db
      .from("consultation_bookings")
      .select(
        "id,slot_id,patient_label,status,consultation_slots(starts_at,location,doctor_id)",
      )
      .eq("patient_id",user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const patientBookings=checked(await ownBookings)||[];
    const doctorBookings=isDoctor?checked(await db.from("consultation_bookings").select("id,slot_id,patient_label,status,consultation_slots!inner(starts_at,location,doctor_id)").eq("consultation_slots.doctor_id",user.id).order("created_at",{ascending:false}).limit(100))||[]:[];
    const bookings=[...new Map([...patientBookings,...doctorBookings].map(b=>[b.id,b])).values()];
    const slots = profiles.length
      ? checked(
          await db
            .from("consultation_slots")
            .select("id,doctor_id,starts_at,location")
            .in(
              "doctor_id",
              profiles.map((d) => d.user_id),
            )
            .gte("starts_at", new Date().toISOString())
            .order("starts_at")
            .limit(200),
        ) || []
      : [];
    const reserved = slots.length
      ? checked(
          await db
            .from("consultation_bookings")
            .select("slot_id")
            .in(
              "slot_id",
              slots.map((s) => s.id),
            )
            .eq("status", "confirmed"),
        ) || []
      : [];
    return result({
      userId: user.id,
      doctors: profiles,
      threads: checked(threads),
      premium: active,
      isDoctor,
      bookings,
      slots: slots.filter((s) => !reserved.some((b) => b.slot_id === s.id)),
    });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    const { db, user } = await requireUser(request);
    let body: Record<string, unknown>;
    try {
      body = await readAdminJson(request);
    } catch {
      throw new ApiError(400, "არასწორი მოთხოვნა.");
    }
    let id: string;
    try {
      id = uuid(body.id);
    } catch {
      throw new ApiError(400, "არასწორი ჩანაწერი.");
    }
    const label =
      String(
        user.user_metadata?.nickname ||
          user.user_metadata?.first_name ||
          "მომხმარებელი",
      )
        .trim()
        .slice(0, 100) || "მომხმარებელი";
    if (body.action === "cancel") {
      // History and cancellation remain available even when new consultations are disabled.
      const existing=checked(await db.from("consultation_bookings").select("patient_id,consultation_slots!inner(doctor_id)").eq("id",id).maybeSingle());
      const slot=existing?.consultation_slots as unknown as {doctor_id:string}|null;
      if(!existing||(existing.patient_id!==user.id&&slot?.doctor_id!==user.id))throw new ApiError(404,"ჯავშანი ვერ მოიძებნა.");
      const booking = checked(
        await db
          .from("consultation_bookings")
          .update({ status: "cancelled" })
          .eq("id", id)
          .eq("status", "confirmed")
          .select("id")
          .maybeSingle(),
      );
      if (!booking) throw new ApiError(404, "ჯავშანი ვერ მოიძებნა.");
      return result({ ok: true });
    }
    await requireFeature(db, "doctorConsultation");
    const member = checked(
      await db
        .from("premium_memberships")
        .select("expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    const premium = Boolean(
      member && Date.parse(member.expires_at) > Date.now(),
    );
    if (body.action === "book" || body.action === "start") {
      if (!premium)
        throw new ApiError(403, "კონსულტაცია მხოლოდ აქტიური პრემიუმისთვისაა.");
      const slot =
        body.action === "book"
          ? checked(
              await db
                .from("consultation_slots")
                .select("id,doctor_id,starts_at")
                .eq("id", id)
                .gt("starts_at", new Date().toISOString())
                .maybeSingle(),
            )
          : null;
      if (body.action === "book" && !slot)
        throw new ApiError(404, "ეს დრო აღარ არის ხელმისაწვდომი.");
      const doctorId = slot?.doctor_id || id;
      const doctor = checked(
        await db
          .from("doctor_profiles")
          .select("user_id")
          .eq("user_id", doctorId)
          .eq("active", true)
          .maybeSingle(),
      );
      if (!doctor || doctorId === user.id)
        throw new ApiError(400, "აირჩიე მოქმედი ექიმი.");
      if (slot) {
        const saved = await db
          .from("consultation_bookings")
          .insert({
            slot_id: slot.id,
            patient_id: user.id,
            patient_label: label,
          })
          .select("id")
          .single();
        if (saved.error?.code === "23505")
          throw new ApiError(409, "დრო უკვე დაჯავშნილია. აირჩიე სხვა დრო.");
        return result({ booking: checked(saved) });
      }
      checked(
        await db
          .from("consultation_threads")
          .upsert(
            { doctor_id: doctorId, patient_id: user.id, patient_label: label },
            { onConflict: "doctor_id,patient_id", ignoreDuplicates: true },
          ),
      );
      return result({
        thread: checked(
          await db
            .from("consultation_threads")
            .select("id")
            .eq("doctor_id", doctorId)
            .eq("patient_id", user.id)
            .single(),
        ),
      });
    }
    if (body.action === "message") {
      let content: string;
      try {
        content = textField(body.body, 2000);
      } catch {
        throw new ApiError(400, "შეტყობინება უნდა შეიცავდეს 1–2000 სიმბოლოს.");
      }
      const thread = checked(
        await db
          .from("consultation_threads")
          .select("id,doctor_id,patient_id")
          .eq("id", id)
          .or(`patient_id.eq.${user.id},doctor_id.eq.${user.id}`)
          .maybeSingle(),
      );
      if (!thread) throw new ApiError(404, "ჩატი ვერ მოიძებნა.");
      if (thread.patient_id === user.id && !premium)
        throw new ApiError(403, "წერისთვის საჭიროა აქტიური პრემიუმი.");
      const doctor = checked(
        await db
          .from("doctor_profiles")
          .select("user_id")
          .eq("user_id", thread.doctor_id)
          .eq("active", true)
          .maybeSingle(),
      );
      if (!doctor) throw new ApiError(403, "ექიმი დროებით მიუწვდომელია.");
      const saved = await db
        .from("consultation_messages")
        .insert({ thread_id: id, sender_id: user.id, body: content });
      if (saved.error?.code === "P0001")
        throw new ApiError(
          429,
          "შეტყობინებები ზედმეტად სწრაფად იგზავნება. ცოტა ხანში სცადე.",
        );
      checked(saved);
      return result({ ok: true });
    }
    throw new ApiError(400, "უცნობი მოქმედება.");
  } catch (e) {
    return failure(e);
  }
}
