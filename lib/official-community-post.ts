import { normalizePost, validPost, validTopic } from "../mobile/src/community.mjs";

export const OFFICIAL_POST_PHOTO_MAX = 3 * 1024 * 1024;

export function officialPostInput(form: FormData) {
  const text = form.get("body");
  const topic = form.get("topic");
  if (typeof text !== "string" || !validPost(text) || typeof topic !== "string" || !validTopic(topic)) return null;
  return { body: normalizePost(text), topic };
}

export function communityPhotoMime(bytes: Uint8Array) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return "image/png";
  if (String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}
