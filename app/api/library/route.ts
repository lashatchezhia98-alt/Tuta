import {
  dbClient,
  requireUser,
  requireFeature,
  checked,
  result,
  failure,
  ApiError,
} from "@/lib/platform-server";
import { textField } from "@/lib/content-validation";
import { readAdminJson } from "@/lib/admin-request";
export async function GET() {
  try {
    const db = dbClient();
    await requireFeature(db, "library");
    const articles = checked(
      await db
        .from("articles")
        .select("id,title_ka,title_en,body_ka,body_en,category,publish_at,verified_doctors!articles_author_doctor_id_fkey(first_name,last_name)")
        .in("status", ["published", "scheduled"])
        .lte("publish_at", new Date().toISOString())
        .order("publish_at", { ascending: false })
        .limit(100),
    );
    return result({ articles });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    const { db, user } = await requireUser(request);
    await requireFeature(db, "library");
    const doctor = checked(await db.from("doctor_profiles").select("user_id")
      .eq("user_id", user.id).eq("active", true).maybeSingle());
    if (!doctor) throw new ApiError(403, "ექიმის აქტიური ანგარიში საჭიროა.");
    const body = await readAdminJson(request, 12_288);
    const title = textField(body?.title, 180);
    const content = textField(body?.body, 6000);
    const category = String(body?.category ?? "");
    if (!(["cycle", "pregnancy", "nutrition", "mental-health"] as string[]).includes(category))
      throw new ApiError(400, "აირჩიე სტატიის თემა.");
    const saved = checked(await db.from("articles").insert({
      title_ka: title, title_en: "", body_ka: content, body_en: "", category,
      status: "published", publish_at: new Date().toISOString(), author_doctor_id: user.id,
    }).select("id").single());
    return result({ article: saved });
  } catch (e) {
    return failure(e);
  }
}
