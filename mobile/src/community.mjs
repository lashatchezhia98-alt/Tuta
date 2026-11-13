export function normalizePost(text) {
  return text.trim().normalize('NFC');
}

export function postWordCount(text) {
  const body = normalizePost(text);
  return body ? body.split(/\s+/u).length : 0;
}

export function validPost(text) {
  const body = normalizePost(text);
  return body.length > 0 && body.length <= 2000 && postWordCount(body) <= 200;
}

export const POST_TOPICS = ['cycle', 'symptoms', 'wellbeing', 'nutrition', 'pregnancy', 'questions'];

export const POST_EDIT_WINDOW_MS = 30 * 60 * 1000;

export function canEditCommunityPost(createdAt, isOwner, now = Date.now()) {
  if (!isOwner || !Number.isFinite(now)) return false;
  const postedAt = Date.parse(createdAt);
  return Number.isFinite(postedAt) && postedAt <= now && now - postedAt < POST_EDIT_WINDOW_MS;
}

export function validTopic(topic) {
  return POST_TOPICS.includes(topic);
}

export function validComment(text) {
  const body = normalizePost(text);
  return body.length > 0 && body.length <= 1000;
}

export function memberDisplayName(metadata = {}) {
  const name = String(metadata.nickname || metadata.first_name || '').trim().slice(0, 30);
  return name.length >= 2 ? name : 'Member';
}

export function memberInitials(metadata = {}) {
  const first = String(metadata.first_name || "").trim();
  const last = String(metadata.last_name || "").trim();
  const initial = (value) => /^[a-z]$/i.test(value) ? value.toUpperCase() : value;
  if (first && last) return `${initial(first[0])}${initial(last[0])}`;
  const name = String(metadata.nickname || first || last || "").trim();
  return name ? initial(name[0]) : "?";
}

export function communityPhotoUrl(cloudName, publicId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(cloudName || '')) return null;
  if (!/^tuta-community\/(?:[0-9a-f-]{36}|anon)\/[a-zA-Z0-9_-]+$/.test(publicId || '')) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_1200/${publicId}`;
}
