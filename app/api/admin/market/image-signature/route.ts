import { createHash, randomUUID } from "node:crypto";
import { requireAdmin, failure, result } from "@/lib/platform-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return result({ error: "Cloudinary არ არის გამართული. დაამატე CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY და CLOUDINARY_API_SECRET." }, 503);
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `tuta-market/${randomUUID()}`;
    const signature = createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");
    return result({ cloudName, apiKey, publicId, timestamp, signature });
  } catch (error) {
    return failure(error);
  }
}
