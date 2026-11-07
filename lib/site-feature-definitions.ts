import { extraPages } from './page-directory';
export type SiteFeatureId =
  | (typeof extraPages)[number]['slug']
  | "community"
  | "period"
  | "dailyLog"
  | "insights"
  | "library"
  | "premium"
  | "doctorConsultation"
  | "doctorReport"
  | "market";

export const SITE_FEATURES: Array<{
  id: SiteFeatureId;
  group: "ძირითადი" | "სერვისები";
  ka: { title: string; description: string };
  en: { title: string; description: string };
  enabledByDefault: boolean;
}> = [
  ...extraPages.map(page => ({id:page.slug,group:'სერვისები' as const,ka:{title:page.ka,description:page.slug==='journey'?'ჩანაწერებზე დაფუძნებული ნაბიჯ-ნაბიჯ გზამკვლევი.':'მოსამზადებელი გვერდის ხილვადობა. ჩართვა სერვისს არ ააქტიურებს.'},en:{title:page.en,description:page.slug==='journey'?'Step-by-step guidance based on saved entries.':'Preparation page visibility. Enabling does not activate the service.'},enabledByDefault:true})),
  { id: "community", group: "ძირითადი", ka: { title: "მთავარი / საზოგადოება", description: "პოსტების ნახვა და მომხმარებლების საზოგადოება." }, en: { title: "Home / Community", description: "Community feed and member posts." }, enabledByDefault: true },
  { id: "period", group: "ძირითადი", ka: { title: "პერიოდის კალენდარი", description: "პერიოდისა და ოვულაციის პროგნოზები." }, en: { title: "Period tracker", description: "Period and ovulation predictions." }, enabledByDefault: true },
  { id: "dailyLog", group: "ძირითადი", ka: { title: "დღიური ჩანაწერები", description: "განწყობის, ენერგიის, ტკივილისა და სიმპტომების აღრიცხვა." }, en: { title: "Daily check-in", description: "Mood, energy, pain and symptom tracking." }, enabledByDefault: true },
  { id: "insights", group: "ძირითადი", ka: { title: "პატერნები და ანალიზი", description: "ციკლის ისტორია და პირადი შეჯამებები." }, en: { title: "Insights and patterns", description: "Cycle history and personal summaries." }, enabledByDefault: true },
  { id: "library", group: "ძირითადი", ka: { title: "ჯანმრთელობის ბიბლიოთეკა", description: "სტატიებისა და სასწავლო მასალების გვერდი." }, en: { title: "Health library", description: "Articles and educational resources." }, enabledByDefault: true },
  { id: "premium", group: "სერვისები", ka: { title: "Premium", description: "ფასიანი პაკეტის გვერდი და შეთავაზებები." }, en: { title: "Premium", description: "Paid plan page and offers." }, enabledByDefault: true },
  { id: "doctorConsultation", group: "სერვისები", ka: { title: "ექიმთან კონსულტაცია", description: "კონსულტაციის გვერდისა და ბმულების გამოჩენა." }, en: { title: "Doctor consultation", description: "Visibility of consultation page and links." }, enabledByDefault: true },
  { id: "doctorReport", group: "სერვისები", ka: { title: "ექიმის ანგარიში", description: "ექიმისთვის ანგარიშის გვერდი." }, en: { title: "Doctor report", description: "Doctor report page." }, enabledByDefault: true },
  { id: "market", group: "სერვისები", ka: { title: "მარკეტი / მაღაზია", description: "პროდუქტების გვერდი, კალათა და შეკვეთის გაფორმება." }, en: { title: "Market / shop", description: "Product catalog, cart and checkout." }, enabledByDefault: true },
];

export type SiteFeatureSettings = Record<SiteFeatureId, boolean>;

export function defaultSiteFeatures(): SiteFeatureSettings {
  return Object.fromEntries(SITE_FEATURES.map(({ id, enabledByDefault }) => [id, enabledByDefault])) as SiteFeatureSettings;
}

export function featureForRoute(route: string): SiteFeatureId | null {
  const extra = extraPages.find(page => route === '/app/' + page.slug);
  if(extra) return extra.slug;
  if (route === "/community") return "community";
  if (route === "/blog") return "library";
  if (route === "/premium") return "premium";
  if (route === "/consultation") return "doctorConsultation";
  if (route === "/market") return "market";
  if (route === "/app/dashboard") return "period";
  if (route === "/app/log") return "dailyLog";
  if (route === "/app/insights") return "insights";
  if (route === "/app/report") return "doctorReport";
  return null;
}
