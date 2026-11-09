import { checked, failure, requireAdmin, result } from "@/lib/platform-server";
import { symptoms } from "@/mobile/src/symptoms.mjs";

export async function GET(request: Request) {
  try {
    const db = await requireAdmin(request, false, "analytics");
    return result(checked(await db.rpc("tuta_admin_health_aggregates", { p_symptoms: symptoms.map(([id]) => id) })));
  } catch (error) { return failure(error); }
}
