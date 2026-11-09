import { readAdminJson } from "@/lib/admin-request";
import { ApiError, checked, failure, requireAdmin, result } from "@/lib/platform-server";
import { validateCopy } from "@/lib/site-copy";

export const dynamic = "force-dynamic";
const columns = "draft,published,revision,published_at";

function editorState(row: { draft: unknown; published: unknown; revision: number; published_at: string | null }) {
  return { ...row, draft: validateCopy(row.draft, false), published: validateCopy(row.published, false) };
}

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "website-copy");
    const row = checked(await db.from("website_copy").select(columns).eq("id", "global").single());
    if (!row) throw new ApiError(503, "ტექსტების საცავი არ არის ხელმისაწვდომი.");
    return result(editorState(row));
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const db = await requireAdmin(request, false, "website-copy");
    let input;
    let draft;
    try {
      input = await readAdminJson(request, 262_144);
      draft = validateCopy(input.draft);
    } catch { throw new ApiError(400, "ტექსტი ცარიელია, დაუშვებელია ან აჭარბებს სიგრძის ზღვარს."); }
    const { revision, action } = input;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647 || (action !== "save" && action !== "publish"))
      throw new ApiError(400, "ტექსტების მოთხოვნა არასწორია.");

    const row = checked(await db.from("website_copy").update({
      draft,
      revision: revision + 1,
      ...(action === "publish" ? { published: draft, published_at: new Date().toISOString() } : {}),
    }).eq("id", "global").eq("revision", revision).select(columns).maybeSingle());
    if (!row) throw new ApiError(409, "ტექსტები სხვაგან შეიცვალა. ხელახლა ჩატვირთე უახლესი ვერსია.");
    return result(editorState(row));
  } catch (error) { return failure(error); }
}
