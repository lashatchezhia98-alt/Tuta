import { createHash } from "node:crypto";

export async function serveCommunityPhoto(publicId: string | null) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!publicId || !/^tuta-community\/(?:(?:[0-9a-f-]{36}|anon)\/[a-zA-Z0-9_-]+|official\/private_[a-zA-Z0-9_-]+)$/.test(publicId))
    return new Response(null, { status: 404, headers });
  if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !secret)
    return new Response(null, { status: 503, headers });
  const asset = `c_limit,w_1200,q_auto/${publicId}.jpg`;
  const signature = createHash("sha256").update(asset + secret).digest("base64url").slice(0, 8);
  const type = publicId.split("/").at(-1)?.startsWith("private_") ? "authenticated" : "upload";
  const upstream = await fetch(`https://res.cloudinary.com/${cloud}/image/${type}/s--${signature}--/${asset}`, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!upstream?.ok || upstream.headers.get("content-type") !== "image/jpeg")
    return new Response(null, { status: 404, headers });
  return new Response(upstream.body, { headers: { ...headers, "Content-Type": "image/jpeg" } });
}
