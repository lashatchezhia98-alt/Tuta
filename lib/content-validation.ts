export const articleCategories = [
  "cycle",
  "pregnancy",
  "nutrition",
  "mental-health",
] as const;
export function textField(value: unknown, max: number, required = true) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new Error("Invalid text");
  return value.trim();
}
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)
  )
    throw new Error("Invalid ID");
  return value;
}
export function articleInput(body: Record<string, unknown>) {
  const title_ka = textField(body.title_ka, 180),
    body_ka = textField(body.body_ka, 6000);
  const title_en = textField(body.title_en, 180, false),
    body_en = textField(body.body_en, 6000, false);
  if (Boolean(title_en) !== Boolean(body_en))
    throw new Error("Translation incomplete");
  if (
    !articleCategories.includes(
      body.category as (typeof articleCategories)[number],
    ) ||
    !["draft", "published", "scheduled"].includes(String(body.status))
  )
    throw new Error("Invalid category/status");
  const publish_at =
    body.status === "draft"
      ? null
      : body.status === "published"
        ? new Date().toISOString()
        : textField(body.publish_at, 40);
  if (publish_at && !Number.isFinite(Date.parse(publish_at)))
    throw new Error("Invalid publication time");
  return {
    title_ka,
    body_ka,
    title_en,
    body_en,
    category: String(body.category),
    status: String(body.status),
    publish_at,
    updated_at: new Date().toISOString(),
  };
}
