import { failure, requireAdminIdentity, result } from "@/lib/platform-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminIdentity(request, false, "website-copy");
    return result({ authorized: true });
  } catch (error) {
    return failure(error);
  }
}
