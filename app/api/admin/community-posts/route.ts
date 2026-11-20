import { createHash, randomUUID } from "node:crypto";
import { communityPhotoMime, OFFICIAL_POST_PHOTO_MAX, officialPostInput } from "@/lib/official-community-post";
import { ApiError, checked, dbClient, failure, requireAdminIdentity, requireFeature, result } from "@/lib/platform-server";

async function uploadPhoto(photo: File) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !apiKey || !secret)
    throw new ApiError(503, "ფოტოების სერვისი ჯერ არ არის გამართული.");
  const bytes = await photo.arrayBuffer();
  const type = communityPhotoMime(new Uint8Array(bytes));
  if (!type) throw new ApiError(400, "აირჩიე JPG, PNG ან WebP ფოტო.");

  const publicId = `tuta-community/official/private_${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}&type=authenticated${secret}`).digest("hex");
  const upload = new FormData();
  upload.set("file", new Blob([bytes], { type }), `photo.${type === "image/jpeg" ? "jpg" : type.split("/")[1]}`);
  upload.set("public_id", publicId);
  upload.set("timestamp", timestamp);
  upload.set("type", "authenticated");
  upload.set("signature", signature);
  upload.set("api_key", apiKey);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST", body: upload, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  const asset = response?.ok ? await response.json().catch(() => null) : null;
  if (asset?.public_id !== publicId || asset.resource_type !== "image" || asset.type !== "authenticated")
    throw new ApiError(503, "ფოტო ვერ აიტვირთა. სცადე ხელახლა.");
  return publicId;
}

export async function POST(request: Request) {
  try {
    const identity = await requireAdminIdentity(request, false, "community-posts");
    const db = dbClient();
    await requireFeature(db, "community");
    if (Number(request.headers.get("content-length")) > OFFICIAL_POST_PHOTO_MAX + 65_536)
      throw new ApiError(413, "ფოტო არ უნდა აღემატებოდეს 3 მბ-ს.");

    const form = await request.formData().catch(() => null);
    const entry = form && officialPostInput(form);
    if (!entry) throw new ApiError(400, "აირჩიე თემა და ჩაწერე მაქსიმუმ 200 სიტყვა (2 000 სიმბოლო).");
    const photo = form.get("photo");
    if (photo !== null && (!(photo instanceof File) || photo.size > OFFICIAL_POST_PHOTO_MAX))
      throw new ApiError(413, "ფოტო არ უნდა აღემატებოდეს 3 მბ-ს.");
    const imagePublicId = photo instanceof File && photo.size > 0 ? await uploadPhoto(photo) : null;

    const post = checked(await db.from("community_posts").insert({
      ...entry,
      display_name: "თუთა",
      author_initials: "თ",
      image_public_id: imagePublicId,
      is_official: true,
      official_publisher: identity.role === "owner" ? "owner" : identity.userId,
    }).select("id").single());
    if (!post) throw new ApiError(503, "პოსტის გამოქვეყნება ვერ დადასტურდა.");
    return result({ id: post.id }, 201);
  } catch (error) {
    return failure(error);
  }
}
