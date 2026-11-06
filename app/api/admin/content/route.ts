import {
  requireAdmin,
  checked,
  result,
  failure,
  ApiError,
} from "@/lib/platform-server";
import { readAdminJson } from "@/lib/admin-request";
import { articleInput, uuid } from "@/lib/content-validation";
export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request);
    return result({
      articles: checked(
        await db
          .from("articles")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(100),
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request);
    let body: Record<string, unknown>,
      entry: ReturnType<typeof articleInput> | undefined,
      id: string | undefined;
    try {
      body = await readAdminJson(request, 65_536);
      if (body.id) id = uuid(body.id);
      if (body.action !== "delete") entry = articleInput(body);
      else if (!id) throw Error();
    } catch {
      throw new ApiError(400, "შეამოწმე ველები, თარიღი და თარგმანი.");
    }
    if (body.action === "delete") {
      checked(await db.from("articles").delete().eq("id", id!));
      return result({ ok: true });
    }
    const saved = id
      ? await db
          .from("articles")
          .update(entry!)
          .eq("id", id)
          .select("id")
          .single()
      : await db.from("articles").insert(entry!).select("id").single();
    return result({ article: checked(saved) });
  } catch (e) {
    return failure(e);
  }
}
