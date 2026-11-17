import type { Lang, Tab } from "./types";

type Feature = "library" | "doctorConsultation" | "premium" | "period" | "community" | "market";
type Entry = {
  tab: Tab;
  href: string;
  icon: string;
  label: Record<Lang, string>;
  copy?: string;
  feature?: Feature;
  membersOnly?: true;
};
type Group = { id: string; label: Record<Lang, string>; entries: Entry[] };

const groups: Group[] = [
  { id: "discover", label: { ka: "აღმოაჩინე", en: "Explore" }, entries: [
    { tab: "blog", href: "/blog", icon: "book", label: { ka: "ბლოგები", en: "Articles" }, copy: "nav.library", feature: "library" },
    { tab: "services", href: "/app/features", icon: "services", label: { ka: "სერვისები", en: "Services" }, copy: "nav.services" },
    { tab: "care", href: "/consultation", icon: "care", label: { ka: "ექიმთან კონსულტაცია", en: "Consult a doctor" }, copy: "nav.care", feature: "doctorConsultation" },
    { tab: "premium", href: "/premium", icon: "spark", label: { ka: "პრემიუმი", en: "Premium" }, copy: "nav.premium", feature: "premium" },
  ] },
  { id: "shortcuts", label: { ka: "სწრაფი წვდომა", en: "Quick links" }, entries: [
    { tab: "cycle", href: "/app/dashboard", icon: "periodMoon", label: { ka: "პერიოდი", en: "Period" }, copy: "nav.period", feature: "period" },
    { tab: "home", href: "/community", icon: "communityStars", label: { ka: "საზოგადოება", en: "Community" }, feature: "community" },
    { tab: "market", href: "/market", icon: "market", label: { ka: "მარკეტი", en: "Market" }, copy: "nav.market", feature: "market" },
    { tab: "profile", href: "/app/settings", icon: "profile", label: { ka: "პროფილი", en: "Profile" }, copy: "nav.profile", membersOnly: true },
    { tab: "orders", href: "/market/orders", icon: "report", label: { ka: "ჩემი შეკვეთები", en: "My orders" }, copy: "nav.orders", membersOnly: true },
  ] },
  { id: "info", label: { ka: "თუთას შესახებ", en: "About Tuta" }, entries: [
    { tab: "about", href: "/about", icon: "moon", label: { ka: "ჩვენ შესახებ", en: "About" }, copy: "nav.about" },
    { tab: "privacy", href: "/privacy", icon: "lock", label: { ka: "კონფიდენციალურობა", en: "Privacy" }, copy: "policy.privacy.title" },
    { tab: "terms", href: "/terms", icon: "terms", label: { ka: "წესები და პირობები", en: "Terms of use" }, copy: "policy.terms.title" },
  ] },
];

export function burgerMenuGroups(features: Partial<Record<Feature, boolean>>, signedIn: boolean) {
  return groups.map(group => ({
    ...group,
    entries: group.entries.filter(item =>
      (!item.feature || features[item.feature] === true) && (!item.membersOnly || signedIn),
    ),
  })).filter(group => group.entries.length > 0);
}

export const burgerLanguage = {
  ka: { label: "ენა", next: "English", code: "en" },
  en: { label: "Language", next: "ქართული", code: "ka" },
} as const;
