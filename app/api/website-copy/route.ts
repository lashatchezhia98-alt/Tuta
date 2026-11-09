import { ApiError, checked, dbClient, failure, result } from "@/lib/platform-server";
import { validateCopy } from "@/lib/site-copy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = checked(await dbClient().from("website_copy").select("published").eq("id", "global").single());
    if (!row) throw new ApiError(503, "ტექსტები ვერ ჩაიტვირთა.");
    return result({ copy: validateCopy(row.published, false) });
  } catch (error) { return failure(error); }
}
