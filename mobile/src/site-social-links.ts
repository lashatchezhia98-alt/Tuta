export const SOCIAL_PLATFORMS = ["facebook", "instagram", "youtube", "tiktok"] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLinks = Record<SocialPlatform, string>;

export const EMPTY_SOCIAL_LINKS: SocialLinks = {
  facebook: "",
  instagram: "",
  youtube: "",
  tiktok: "",
};
