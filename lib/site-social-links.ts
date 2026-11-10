export const SOCIAL_PLATFORMS = ["facebook", "instagram", "youtube", "tiktok"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLinks = Record<SocialPlatform, string>;

export const EMPTY_SOCIAL_LINKS: SocialLinks = {
  facebook: "",
  instagram: "",
  youtube: "",
  tiktok: "",
};

const allowedHosts: Record<SocialPlatform, string[]> = {
  facebook: ["facebook.com", "fb.watch"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
};

export function parseSocialLinks(value: unknown): { links: SocialLinks; invalid: SocialPlatform[] } {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const links = { ...EMPTY_SOCIAL_LINKS };
  const invalid: SocialPlatform[] = [];

  for (const platform of SOCIAL_PLATFORMS) {
    const raw = source[platform];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const candidate = raw.trim();
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const validHost = allowedHosts[platform].some(base => host === base || host.endsWith(`.${base}`));
      if (url.protocol !== "https:" || !validHost || url.username || url.password) {
        invalid.push(platform);
        continue;
      }
      links[platform] = url.toString();
    } catch {
      invalid.push(platform);
    }
  }

  return { links, invalid };
}
