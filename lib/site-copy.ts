import { aboutCards, homeCopy, pageInfo, policyCopy } from "./site-copy-defaults";
import { memberCopyFields } from "./member-copy-defaults";
import { extraPages } from "./page-directory";
import { serviceCopyKey, serviceGroups } from "./service-directory";

export type CopyLanguage = "ka" | "en";
export type CopyOverrides = Record<CopyLanguage, Record<string, string>>;
export const emptyCopy = (): CopyOverrides => ({ ka: {}, en: {} });

export const copyPages = [
  ["/", "მთავარი გვერდი", "Homepage", ["home.", "nav."]],
  ["/about", "ჩვენ შესახებ", "About", ["page.about.", "about.", "nav."]],
  ["/premium", "პრემიუმი", "Premium", ["premium.", "nav."]],
  ["/login", "შესვლა", "Sign in", ["page.login.", "auth.", "nav."]],
  ["/register", "რეგისტრაცია", "Registration", ["page.register.", "auth.", "nav."]],
  ["/forgot-password", "პაროლის აღდგენა", "Password recovery", ["page.forgot-password.", "auth.", "nav."]],
  ["/reset-password", "ახალი პაროლი", "New password", ["page.reset-password.", "auth.", "nav."]],
  ["/privacy", "კონფიდენციალურობა", "Privacy", ["policy.privacy.", "nav."]],
  ["/terms", "წესები და პირობები", "Terms of use", ["policy.terms.", "nav."]],
  ["/market", "მარკეტი", "Market", ["market.", "nav."]],
  ["/blog", "ბლოგები", "Articles", ["library.", "nav."]],
  ["/consultation", "კონსულტაცია", "Consultations", ["care.", "nav."]],
  ["/tools/period-calculator", "პერიოდის კალკულატორი", "Period calculator", ["page.period.0", "calculator.", "nav."]],
  ["/tools/ovulation-calculator", "ოვულაციის კალკულატორი", "Ovulation calculator", ["page.ovulation.0", "calculator.", "nav."]],
  ["/app/features", "ფუნქციები", "Features", ["directory.", "nav."]],
] as const;

export const memberCopyPages = [
  ["/community", "მთავარი და პოსტები", "Home & posts", ["feed.", "nav."]],
  ["/app/dashboard", "პერიოდის კალენდარი", "Period calendar", ["tracker.", "workspace.", "nav."]],
  ["/app/log", "დღიური", "Journal", ["journal.", "workspace.", "nav."]],
  ["/app/insights", "ციკლის ანალიზი", "Cycle insights", ["insights.", "workspace.", "nav."]],
  ["/app/report", "ანგარიში ექიმისთვის", "Report for your doctor", ["report.", "insights.", "workspace.", "nav."]],
  ["/app/settings", "ანგარიში და პარამეტრები", "Account & settings", ["settings.", "nav."]],
  ["/app/pregnancy", "ორსულობა", "Pregnancy", ["extra.pregnancy.", "pregnancy."]],
  ["/app/partners", "პარტნიორთან გაზიარება", "Partner sharing", ["extra.partners.", "partners."]],
  ["/app/journey", "პირადი გზამკვლევი", "Guided journey", ["extra.journey.", "journey."]],
  ["/consultation", "ექიმები, ჩატი და ჯავშნები", "Doctors, chat & appointments", ["care."]],
  ["/premium", "პრემიუმი და გადახდა", "Premium & checkout", ["premium."]],
  ["/market", "კალათა და შეკვეთის გაფორმება", "Cart & checkout", ["market."]],
  ["/market/orders", "ჩემი შეკვეთები", "My orders", ["orders."]],
] as const;

const fields = new Map<string, { ka: string; en: string; max: number }>();
function add(key: string, ka: string, en: string) {
  fields.set(key, { ka, en, max: Math.min(3500, Math.max(120, Math.max(ka.length, en.length) * 3)) });
}
function collect(prefix: string, ka: unknown, en: unknown) {
  if (typeof ka === "string" && typeof en === "string") return add(prefix, ka, en);
  if (ka && en && typeof ka === "object" && typeof en === "object") {
    for (const [key, value] of Object.entries(ka)) collect(`${prefix}.${key}`, value, (en as Record<string, unknown>)[key]);
  }
}
const homeUnused = new Set(["featuresNav", "consultation", "login", "signup", "available", "gynecologist", "endocrinologist", "years"]);
for (const key of Object.keys(homeCopy.ka) as (keyof typeof homeCopy.ka)[]) {
  if (!homeUnused.has(key)) collect(`home.${key}`, homeCopy.ka[key], homeCopy.en[key]);
}
for (const key of ["about", "login", "register", "forgot-password", "reset-password", "period", "ovulation"] as const) {
  collect(`page.${key}`, pageInfo[key].ka, pageInfo[key].en);
}
for (const key of ["privacy", "terms"] as const) collect(`policy.${key}`, policyCopy[key].ka, policyCopy[key].en);

collect("about", aboutCards.ka, aboutCards.en);

const additional: Record<string, [string, string]> = {
  "nav.brand": ["თუთა", "TUTA"],
  "nav.marketShort": ["მარკეტი", "Market"],
  "nav.account": ["ჩემი ანგარიში", "My account"],
  "nav.signIn": ["შესვლა", "Sign in"],
  "nav.register": ["რეგისტრაცია", "Sign up"],
  "nav.menu": ["მენიუ", "Menu"],
  "nav.features": ["ყველა ფუნქცია", "All features"],
  "nav.community": ["მთავარი", "Home"],
  "nav.about": ["ჩვენ შესახებ", "About"],
  "nav.library": ["ბლოგები", "Articles"],
  "nav.market": ["მარკეტი", "Market"],
  "nav.period": ["პერიოდი", "Period"],
  "nav.premium": ["პრემიუმი", "Premium"],
  "nav.services": ["სერვისები", "Services"],
  "nav.profile": ["პროფილი", "Profile"],
  "nav.care": ["ექიმთან კონსულტაცია", "Consult a doctor"],
  "nav.orders": ["ჩემი შეკვეთები", "My orders"],
  "nav.signOut": ["ანგარიშის პარამეტრები", "Account settings"],
  "nav.language": ["ენა", "Language"],
  "home.availabilityTitle": ["შეარჩიე შენთვის მოსახერხებელი დრო", "Find a time that works for you"],
  "home.availabilityText": ["ექიმის გვერდზე ნახავ თავისუფალ დროსა და ჯავშნის პირობებს. ეს არ არის გადაუდებელი დახმარების სერვისი.", "See available times and booking details on the doctor's page. This is not an emergency service."],
  "home.premiumLink": ["პრემიუმი", "Premium"],
  "premium.title": ["თუთა პრემიუმი", "Tuta Premium"],
  "premium.intro": ["მეტი შესაძლებლობა შენი ციკლის გასაცნობად და ექიმთან დასაკავშირებლად. ამ ეტაპზე პრემიუმს სატესტო გადახდით ააქტიურებ; რეალური თანხა არ ჩამოგეჭრება.", "More ways to understand your cycle and connect with a doctor. Activate Premium with a test payment for now; no real charge is made."],
  "premium.heading": ["აირჩიე პაკეტი","Choose your plan"],
  "premium.instructions": ["აირჩიე 30-დღიანი ან წლიური პაკეტი. პრემიუმი წარმატებული სატესტო გადახდის დადასტურების შემდეგ გააქტიურდება.","Choose a 30-day or annual plan. Premium activates once your successful test payment is confirmed."],
  "premium.pay": ["სატესტო გადახდაზე გადასვლა","Continue to test payment"],
  "premium.status": ["გადახდის სტატუსის შემოწმება","Check payment status"],
  "premium.testCards": ["სატესტო ბარათები","Test cards"],
  "premium.compare.title": ["შეადარე გეგმები", "Compare plans"],
  "premium.compare.intro": ["ნახე, რით შეგიძლია ისარგებლო უფასოდ და რას გთავაზობს პრემიუმი დამატებით.", "See what you get for free and what Premium adds."],
  "premium.compare.feature": ["შესაძლებლობა", "Feature"],
  "premium.compare.free": ["უფასო", "Free"],
  "premium.compare.paid": ["პრემიუმი", "Premium"],
  "premium.compare.calendar": ["პერიოდის კალენდარი", "Period calendar"],
  "premium.compare.predictions": ["პერიოდისა და ოვულაციის პროგნოზი", "Period and ovulation estimates"],
  "premium.compare.journal": ["დღიური და სიმპტომების აღრიცხვა", "Journal and symptom tracking"],
  "premium.compare.history": ["ციკლის ისტორია", "Cycle history"],
  "premium.compare.community": ["საზოგადოება და ანონიმური პოსტები", "Community and anonymous posts"],
  "premium.compare.library": ["ჯანმრთელობის ბლოგები", "Health articles"],
  "premium.compare.patterns": ["განმეორებადი სიმპტომების ანალიზი", "Recurring symptom analysis"],
  "premium.compare.report": ["ანგარიში ექიმისთვის", "Report for your doctor"],
  "premium.compare.pregnancy": ["ორსულობის მონიტორინგი", "Pregnancy tracking"],
  "premium.compare.partner": ["პარტნიორის მოწვევა და გაზიარება", "Invite a partner and share updates"],
  "premium.compare.doctor_chat": ["ექიმთან მიმოწერა", "Message a doctor"],
  "premium.compare.booking": ["ექიმთან ვიზიტის დაჯავშნა", "Book a doctor appointment"],
  "premium.compare.note": ["ექიმთან მიმოწერა და ჯავშანი ხელმისაწვდომ ექიმებზეა დამოკიდებული. პრემიუმის გადახდა ჯერ სატესტოა.", "Messaging and bookings depend on doctor availability. Premium payments are currently in test mode."],
  "auth.email": ["ელფოსტა", "Email"],
  "auth.firstName": ["სახელი", "First name"],
  "auth.lastName": ["გვარი", "Last name"],
  "auth.birthDate": ["დაბადების თარიღი", "Date of birth"],
  "auth.password": ["პაროლი", "Password"],
  "auth.confirmPassword": ["გაიმეორე პაროლი", "Confirm password"],
  "auth.newPassword": ["ახალი პაროლი", "New password"],
  "policy.privacy.password.title": ["პაროლის შეცვლა", "Change password"],
  "policy.privacy.password.current": ["მიმდინარე პაროლი", "Current password"],
  "auth.repeatNewPassword": ["გაიმეორე ახალი პაროლი", "Confirm new password"],
  "auth.create": ["ანგარიშის შექმნა", "Create account"],
  "auth.reset": ["პაროლის შეცვლა", "Update password"],
  "auth.send": ["აღდგენის ბმულის გაგზავნა", "Send recovery link"],
  "auth.working": ["გთხოვ, მოიცადე…", "Please wait…"],
  "auth.forgot": ["დაგავიწყდა პაროლი?", "Forgot password?"],
  "auth.needAccount": ["არ გაქვს ანგარიში?", "Need an account?"],
  "auth.back": ["შესვლაზე დაბრუნება", "Back to sign in"],
  "auth.private": ["შენი მონაცემები შენ გეკუთვნის.", "Your data belongs to you."],
  "auth.verifyTitle": ["დაადასტურე ელფოსტა", "Confirm your email"],
  "auth.verifyCode": ["6-ნიშნა კოდი","6-digit code"],
  "auth.verifyAction": ["ელფოსტის დადასტურება","Verify email"],
  "auth.resendCode": ["კოდის ხელახლა გაგზავნა","Resend code"],
  "market.title": ["მარკეტი","Market"],
  "market.cart": ["შენი კალათა","Your cart"],
  "library.title": ["ბლოგები","Articles"],
  "care.title": ["ექიმთან კონსულტაცია","Doctor consultations"],
  "care.bookings": ["ჩემი ვიზიტები","My appointments"],
  "care.messages": ["მიმოწერა","Messages"],
  "calculator.start": ["ბოლო პერიოდის პირველი დღე","First day of last period"],
  "directory.title": ["ყველა ფუნქცია","All features"],
  "directory.servicesTitle": ["სერვისები", "Services"],
  "directory.intro": ["კალენდარი, დღიური, კონსულტაცია და სხვა შესაძლებლობები. აირჩიე, რა გჭირდება დღეს.","Your calendar, journal, consultations and more. Choose what you need today."],
  "market.intro": ["აღმოაჩინე პროდუქტები ყოველდღიური თავის მოვლისთვის.","Explore products for everyday self-care."],
  "market.orders": ["ჩემი შეკვეთები","My orders"],
  "care.intro": ["პირადი მიმოწერა არჩეულ ექიმთან და 30-წუთიანი ვიზიტის დაჯავშნა. ეს არ არის გადაუდებელი დახმარების სერვისი. ექიმი ვერ ხედავს შენს პერიოდის დღიურს.","Private messages with your chosen doctor and 30-minute appointments. This is not an emergency service. Doctors cannot access your period journal."],
  "care.note": ["მიმოწერისა და ჯავშნისთვის პრემიუმი გჭირდება. გადახდა ჯერ სატესტოა. სიაში მხოლოდ დამატებული, გადამოწმებული ექიმები გამოჩნდება.","Messaging and booking require Premium. Payments are still in test mode. Only verified doctors added to the platform appear here."],
  "calculator.intro": ["შეიყვანე ბოლო პერიოდის თარიღი და შენი ციკლის საშუალო ხანგრძლივობა. 28 დღე მხოლოდ საწყისი მნიშვნელობაა; შეცვალე შენი მონაცემებით.","Enter your last period date and average cycle length. 28 days is only a starting value; adjust it to match your cycle."],
  "calculator.length": ["ციკლის საშუალო ხანგრძლივობა (დღე)","Average cycle length (days)"],
  "calculator.duration": ["სისხლდენის ხანგრძლივობა (დღე)","Bleeding duration (days)"],
  "calculator.disclaimer": ["ეს კალკულატორი ისტორიას არ აანალიზებს. პირად კალენდარში პროგნოზი შენს რეალურ ჩანაწერებსა და მათ ცვალებადობასაც ითვალისწინებს. შეფასება არ ადასტურებს ოვულაციას, არ არის დიაგნოზი და კონტრაცეფციისთვის არ გამოიყენება.","This calculator does not analyze history. Your personal tracker also considers recorded cycles and their variability. Estimates do not confirm ovulation, diagnose conditions or provide contraception."],
  "calculator.estimated": ["სავარაუდო თარიღები","Estimated dates"],
  "calculator.empty": ["გამოთვლისთვის შეავსე ველები.","Complete the fields to estimate dates."],
};
for (const [key, [ka, en]] of Object.entries(additional)) add(key, ka, en);
for (const group of serviceGroups) {
  add(`directory.group.${group.id}`, group.ka, group.en);
  for (const [href, ka, en, detailKa, detailEn] of group.items) {
    add(serviceCopyKey(href), ka, en);
    add(`${serviceCopyKey(href)}.detail`, detailKa, detailEn);
  }
}
for (const [key, [ka, en]] of Object.entries(memberCopyFields)) add(key, ka, en);
for (const page of extraPages) {
  add(`extra.${page.slug}.title`, page.ka, page.en);
  add(`extra.${page.slug}.intro`, page.description, page.english);
}

export const copyFields = Array.from(fields, ([id, field]) => ({ id, ...field }));

export function getCopyText(values: CopyOverrides, id: string, lang: CopyLanguage) {
  return values[lang][id] ?? fields.get(id)?.[lang] ?? "";
}

function record(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function hasUnsupportedCharacters(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) return true;
  }
  return false;
}

export function validateCopy(input: unknown, strict = true): CopyOverrides {
  const output = emptyCopy();
  if (!record(input)) {
    if (strict) throw Error("Invalid copy");
    return output;
  }
  if (strict && Object.keys(input).some(key => key !== "ka" && key !== "en")) throw Error("Invalid language");
  for (const lang of ["ka", "en"] as const) {
    const values = input[lang];
    if (values === undefined) continue;
    if (!record(values)) {
      if (strict) throw Error("Invalid language values");
      continue;
    }
    for (const [key, value] of Object.entries(values)) {
      const field = fields.get(key);
      if (!field || typeof value !== "string" || !value.trim() || value.length > field.max || hasUnsupportedCharacters(value)) {
        if (strict) throw Error("Invalid copy entry");
        continue;
      }
      if (value.trim() !== field[lang]) output[lang][key] = value.trim();
    }
  }
  return output;
}
