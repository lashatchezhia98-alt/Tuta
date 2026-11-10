import { checked, dbClient, failure, result } from "@/lib/platform-server";
import { legacyPublishedCopy } from "@/lib/website-content";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = dbClient();
    const [rows, legacy] = await Promise.all([
      db.from("website_texts").select("key,page,section,ka_text,en_text,ka_style,en_style,published,updated_at").eq("published", true),
      db.from("website_copy").select("published").eq("id", "global").maybeSingle(),
    ]);
    const structuredRows = checked(rows);
    const legacyRow = checked(legacy);
    const records = Array.isArray(structuredRows) ? structuredRows : [];
    return result({
      records: records.filter((row) => row && typeof row === "object" && "published" in row && row.published === true),
      legacyCopy: legacyPublishedCopy(legacyRow?.published),
    });
  } catch (error) { return failure(error); }
}
