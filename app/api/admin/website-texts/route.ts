import { readAdminJson } from "@/lib/admin-request";
import { ApiError, checked, failure, requireAdmin, result } from "@/lib/platform-server";
import { catalogDefaults, catalogWithLegacyPublishedValues, validateWebsiteText } from "@/lib/website-content";

export const dynamic = "force-dynamic";
const columns = "key,page,section,ka_text,en_text,ka_style,en_style,published,updated_at";

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "invalid_key") return "გასაღები უნდა იყოს უნიკალური და შეიცავდეს მხოლოდ ლათინურ პატარა ასოებს, ციფრებს, წერტილს, ტირეს ან ქვედა ტირეს.";
    if (error.message === "invalid_style") return "ტექსტის ფერი ან ზომა დასაშვებ მნიშვნელობებს არ შეესაბამება.";
    if (error.message === "invalid_text") return "ორივე ენაზე შეავსე ტექსტი (მაქსიმუმ 3500 სიმბოლო).";
  }
  return "შეამოწმე ტექსტის გასაღები, გვერდი, სექცია, ენები და სტილი.";
}

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "website-copy");
    // Preserve already-published content from the original editor when the new
    // normalized table is initialized. Draft content is intentionally ignored.
    const legacy = checked(await db.from("website_copy").select("published").eq("id", "global").maybeSingle());
    const defaults = catalogWithLegacyPublishedValues(legacy?.published);
    const seeded = checked(await db.from("website_texts").upsert(defaults, { onConflict: "key", ignoreDuplicates: true }));
    void seeded;
    const records = checked(await db.from("website_texts").select(columns).order("page").order("section").order("key"));
    if (!Array.isArray(records)) throw new ApiError(503, "ტექსტების საცავი ვერ ჩაიტვირთა.");
    return result({ records });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request, false, "website-copy");
    let input;
    try { input = validateWebsiteText(await readAdminJson(request, 12_000)); }
    catch (error) { throw new ApiError(400, errorMessage(error)); }
    const response = await db.from("website_texts").insert({ ...input, updated_at: new Date().toISOString() }).select(columns).single();
    if (response.error?.code === "23505") throw new ApiError(409, "ეს გასაღები უკვე არსებობს.");
    const row = checked(response);
    return result({ record: row }, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const db = await requireAdmin(request, false, "website-copy");
    let input;
    try { input = validateWebsiteText(await readAdminJson(request, 12_000)); }
    catch (error) { throw new ApiError(400, errorMessage(error)); }
    const row = checked(await db.from("website_texts").update({ page: input.page, section: input.section, ka_text: input.ka_text, en_text: input.en_text, ka_style: input.ka_style, en_style: input.en_style, published: input.published, updated_at: new Date().toISOString() }).eq("key", input.key).select(columns).maybeSingle());
    if (!row) throw new ApiError(404, "ტექსტი ვერ მოიძებნა.");
    return result({ record: row });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const db = await requireAdmin(request, false, "website-copy");
    const input = await readAdminJson(request, 1_024);
    if (typeof input.key !== "string" || !/^[a-z0-9][a-z0-9._-]{1,119}$/.test(input.key)) throw new ApiError(400, "გასაღები არასწორია.");
    if (catalogDefaults().some(item => item.key === input.key)) throw new ApiError(409, "სისტემური ტექსტის ჩანაწერი ვერ წაიშლება; შეცვალე ან მონახაზად გადაიყვანე.");
    const row = checked(await db.from("website_texts").delete().eq("key", input.key).select("key").maybeSingle());
    if (!row) throw new ApiError(404, "ტექსტი ვერ მოიძებნა.");
    return result({ deleted: input.key });
  } catch (error) { return failure(error); }
}
