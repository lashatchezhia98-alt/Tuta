// One primary home per destination; other links are contextual shortcuts.
export const destinations = [
  {
    id: "home",
    group: "home",
    ka: "მთავარი",
    en: "Home",
    icon: "home",
    feature: "community",
  },
  {
    id: "cycle",
    group: "cycle",
    ka: "შეჯამება",
    en: "Overview",
    icon: "cycle",
    feature: "period",
  },
  {
    id: "calendar",
    group: "cycle",
    ka: "კალენდარი",
    en: "Calendar",
    icon: "calendar",
    feature: "period",
  },
  {
    id: "log",
    group: "cycle",
    ka: "დღიური",
    en: "Journal",
    icon: "log",
    feature: "dailyLog",
  },
  {
    id: "insights",
    group: "cycle",
    ka: "ანალიზი",
    en: "Insights",
    icon: "insights",
    feature: "insights",
  },
  {
    id: "care",
    group: "services",
    ka: "ექიმები და ვიზიტები",
    en: "Doctors & appointments",
    icon: "care",
    feature: "doctorConsultation",
    retain: true,
  },
  {
    id: "blog",
    group: "services",
    ka: "ბიბლიოთეკა",
    en: "Health library",
    icon: "book",
    feature: "library",
  },
  {
    id: "pregnancy",
    group: "services",
    ka: "ორსულობა",
    en: "Pregnancy",
    icon: "moon",
    feature: "pregnancy",
    retain: true,
  },
  {
    id: "partners",
    group: "services",
    ka: "პარტნიორი",
    en: "Partner sharing",
    icon: "profile",
    feature: "partners",
    retain: true,
  },
  {
    id: "journey",
    group: "services",
    ka: "პირადი გზამკვლევი",
    en: "Guided journey",
    icon: "spark",
    feature: "journey",
  },
  {
    id: "report",
    group: "services",
    ka: "ექიმისთვის ანგარიში",
    en: "Doctor report",
    icon: "report",
    feature: "doctorReport",
  },
  {
    id: "period-calculator",
    group: "services",
    ka: "პერიოდის კალკულატორი",
    en: "Period calculator",
    icon: "calendar",
  },
  {
    id: "ovulation-calculator",
    group: "services",
    ka: "ოვულაციის კალკულატორი",
    en: "Ovulation calculator",
    icon: "cycle",
  },
  {
    id: "symptom-checker",
    group: "services",
    ka: "სიმპტომების განხილვა",
    en: "Symptom review",
    icon: "care",
    feature: "symptom-checker",
    planned: true,
  },
  {
    id: "notifications",
    group: "profile",
    ka: "შეხსენებები",
    en: "Reminders",
    icon: "calendar",
    feature: "notifications",
  },
  {
    id: "premium",
    group: "profile",
    ka: "პრემიუმი",
    en: "Premium",
    icon: "spark",
    feature: "premium",
  },
  {
    id: "market",
    group: "market",
    ka: "მარკეტი",
    en: "Market",
    icon: "market",
    feature: "market",
  },
  {
    id: "cart",
    group: "market",
    ka: "კალათა",
    en: "Cart",
    icon: "market",
    feature: "market",
  },
  {
    id: "orders",
    group: "profile",
    ka: "ჩემი შეკვეთები",
    en: "My orders",
    icon: "report",
    retain: true,
  },
  {
    id: "profile",
    group: "profile",
    ka: "ჩემი ანგარიში",
    en: "My account",
    icon: "profile",
  },
  {
    id: "account-deletion",
    group: "profile",
    ka: "ანგარიშის წაშლა",
    en: "Delete account",
    icon: "lock",
    feature: "account-deletion",
    planned: true,
  },
  {
    id: "about",
    group: "info",
    ka: "ჩვენ შესახებ",
    en: "About Tuta",
    icon: "moon",
  },
  {
    id: "privacy",
    group: "info",
    ka: "კონფიდენციალურობა",
    en: "Privacy",
    icon: "lock",
  },
  {
    id: "terms",
    group: "info",
    ka: "წესები და პირობები",
    en: "Terms",
    icon: "book",
  },
];
export const mainTabs = [
  ["home", "მთავარი", "Home"],
  ["cycle", "პერიოდი", "Period"],
  ["services", "სერვისები", "Services"],
  ["market", "მარკეტი", "Market"],
  ["profile", "პროფილი", "Profile"],
];
export function primaryTab(id) {
  const group = destinations.find((page) => page.id === id)?.group;
  return group === "info" ? "profile" : group || id;
}
export function visibleDestinations(group, features) {
  return destinations.filter(
    (page) =>
      page.group === group &&
      (!page.feature || features[page.feature] === true || page.retain),
  );
}
export function pageAllowed(id, features) {
  const page = destinations.find((p) => p.id === id);
  return (
    !page?.feature || page.retain === true || features[page.feature] === true
  );
}
