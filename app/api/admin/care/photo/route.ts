import { createHash, randomUUID } from "node:crypto";
import {
  requireAdmin,
  checked,
  result,
  failure,
  ApiError,
} from "@/lib/platform-server";
import { uuid } from "@/lib/content-validation";

export async function POST(request: Request) {
  try {
    const db = await requireAdmin(request);
    if (
      Number(request.headers.get("content-length") || 0) >
      3 * 1024 * 1024 + 16384
    )
      throw new ApiError(413, "ფოტო მაქსიმუმ 3 მბ უნდა იყოს.");
    const form = await request.formData();
    let doctorId: string;
    try {
      doctorId = uuid(form.get("doctorId"));
    } catch {
      throw new ApiError(400, "აირჩიე ექიმი.");
    }
    const doctor = checked(
      await db
        .from("verified_doctors")
        .select("user_id")
        .eq("user_id", doctorId)
        .maybeSingle(),
    );
    if (!doctor)
      throw new ApiError(
        403,
        "პროფილის ფოტო მხოლოდ გადამოწმებულ ექიმს შეიძლება ჰქონდეს.",
      );
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size < 12 ||
      file.size > 3 * 1024 * 1024
    )
      throw new ApiError(400, "აირჩიე JPG, PNG ან WebP ფოტო, მაქსიმუმ 3 მბ.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (b, i) => bytes[i] === b,
    );
    const webp =
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!jpeg && !png && !webp)
      throw new ApiError(400, "მხოლოდ JPG, PNG და WebP ფოტოებია დაშვებული.");
    const cloud = process.env.CLOUDINARY_CLOUD_NAME,
      key = process.env.CLOUDINARY_API_KEY,
      secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !key || !secret)
      throw new ApiError(503, "ფოტოების სერვისი ჯერ არ არის გამართული.");
    const publicId = `tuta-doctors/${doctorId}/${randomUUID()}`,
      timestamp = Math.floor(Date.now() / 1000);
    const transformation = "c_fill,g_face,h_512,w_512";
    const signature = createHash("sha1")
      .update(
        `public_id=${publicId}&timestamp=${timestamp}&transformation=${transformation}${secret}`,
      )
      .digest("hex");
    const upload = new FormData();
    upload.set("file", file);
    upload.set("api_key", key);
    upload.set("public_id", publicId);
    upload.set("timestamp", String(timestamp));
    upload.set("transformation", transformation);
    upload.set("signature", signature);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,
      { method: "POST", body: upload, signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok)
      throw new ApiError(503, "ფოტო ვერ აიტვირთა. სცადე ხელახლა.");
    const asset = await response.json();
    if (asset.public_id !== publicId || asset.resource_type !== "image")
      throw new ApiError(503, "ფოტოს პასუხი არასწორია.");
    checked(
      await db
        .from("verified_doctors")
        .update({ photo_public_id: publicId })
        .eq("user_id", doctorId)
        .select("user_id")
        .single(),
    );
    return result({ ok: true, publicId });
  } catch (e) {
    return failure(e);
  }
}
