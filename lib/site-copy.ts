import { aboutCards, homeCopy, pageInfo, policyCopy } from "./site-copy-defaults";
import { memberCopyFields } from "./member-copy-defaults";
import { extraPages } from "./page-directory";

export type CopyLanguage = "ka" | "en";
export type CopyOverrides = Record<CopyLanguage, Record<string, string>>;
export const emptyCopy = (): CopyOverrides => ({ ka: {}, en: {} });

export const copyPages = [
  ["/", "მთავარი გვერდი", "Homepage", ["home.", "nav."]],
  ["/about", "ჩვენ შესახებ", "About", ["page.about.", "about.", "nav."]],
  ["/premium", "Premium", "Premium", ["premium.", "nav."]],
  ["/login", "შესვლა", "Sign in", ["page.login.", "auth.", "nav."]],
  ["/register", "რეგისტრაცია", "Registration", ["page.register.", "auth.", "nav."]],
  ["/forgot-password", "პაროლის აღდგენა", "Password recovery", ["page.forgot-password.", "auth.", "nav."]],
  ["/reset-password", "ახალი პაროლი", "New password", ["page.reset-password.", "auth.", "nav."]],
  ["/privacy", "კონფიდენციალურობა", "Privacy", ["policy.privacy.", "nav."]],
  ["/terms", "წესები და პირობები", "Terms of use", ["policy.terms.", "nav."]],
  ["/market", "მარკეტი", "Market", ["market.", "nav."]],
  ["/blog", "ბიბლიოთეკა", "Library", ["library.", "nav."]],
  ["/consultation", "კონსულტაცია", "Consultations", ["care.", "nav."]],
  ["/tools/period-calculator", "პერიოდის კალკულატორი", "Period calculator", ["page.period.0", "calculator.", "nav."]],
  ["/tools/ovulation-calculator", "ოვულაციის კალკულატორი", "Ovulation calculator", ["page.ovulation.0", "calculator.", "nav."]],
  ["/app/features", "ფუნქციები", "Features", ["directory.", "nav."]],
] as const;

export const memberCopyPages = [
  ["/community", "მთავარი და პოსტები", "Home & posts", ["feed.", "nav."]],
  ["/app/dashboard", "პერიოდის კალენდარი", "Period calendar", ["tracker.", "workspace.", "nav."]],
  ["/app/log", "ყოველდღიური დღიური", "Daily journal", ["journal.", "workspace.", "nav."]],
  ["/app/insights", "პერიოდის ანალიზი", "Insights", ["insights.", "workspace.", "nav."]],
  ["/app/report", "ექიმისთვის ანგარიში", "Doctor report", ["report.", "insights.", "workspace.", "nav."]],
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
  "nav.register": ["რეგისტრაცია", "Register"],
  "nav.menu": ["მენიუ", "Menu"],
  "nav.features": ["ყველა ფუნქცია", "All features"],
  "nav.community": ["მთავარი", "Home"],
  "nav.about": ["ჩვენ შესახებ", "About"],
  "nav.library": ["ბლოგები", "Library"],
  "nav.market": ["მარკეტი / მაღაზია", "Market / shop"],
  "nav.period": ["პერიოდი", "Period"],
  "nav.premium": ["პრემიუმი", "Premium"],
  "nav.care": ["ექიმთან კონსულტაცია", "Consult a doctor"],
  "nav.orders": ["ჩემი შეკვეთები", "My orders"],
  "nav.signOut": ["ანგარიში და გამოსვლა", "Account & sign out"],
  "nav.language": ["ენა", "Language"],
  "home.availabilityTitle": ["ხელმისაწვდომობა ექიმის განრიგით", "Availability follows each doctor's schedule"],
  "home.availabilityText": ["სია და თავისუფალი დროები კონსულტაციის გვერდზე მოწმდება. ეს არ არის გადაუდებელი დახმარების სერვისი.", "Check the consultation page for doctors and open appointments. This is not an emergency service."],
  "home.premiumLink": ["Premium", "Premium"],
  "premium.title": ["Premium სატესტო პაკეტი", "Premium test plan"],
  "premium.intro": ["სატესტო გადახდა და Premium წვდომის გააქტიურების სრული შემოწმება.", "Test the payment flow and Premium access activation."],
  "premium.heading": ["TUTA Premium","TUTA Premium"],
  "premium.instructions": ["აირჩიე პაკეტი. სატესტო გადახდის წარმატებით დასრულებისას Premium ავტომატურად გააქტიურდება.","Choose a plan. Premium activates after a successful test payment."],
  "premium.pay": ["სატესტო გადახდა","Test payment"],
  "premium.status": ["გადახდის სტატუსის შემოწმება","Check payment status"],
  "premium.testCards": ["სატესტო ბარათები","Test cards"],
  "auth.email": ["ელფოსტა (მომხმარებლის სახელი)", "Email (username)"],
  "auth.firstName": ["სახელი", "First name"],
  "auth.lastName": ["გვარი", "Last name"],
  "auth.birthDate": ["დაბადების თარიღი", "Date of birth"],
  "auth.password": ["პაროლი", "Password"],
  "auth.confirmPassword": ["გაიმეორე პაროლი", "Confirm password"],
  "auth.newPassword": ["ახალი პაროლი", "New password"],
  "auth.repeatNewPassword": ["გაიმეორე ახალი პაროლი", "Confirm new password"],
  "auth.create": ["ანგარიშის შექმნა", "Create account"],
  "auth.reset": ["პაროლის შეცვლა", "Update password"],
  "auth.send": ["ბმულის გაგზავნა", "Send recovery link"],
  "auth.working": ["მუშავდება…", "Please wait…"],
  "auth.forgot": ["დაგავიწყდა პაროლი?", "Forgot password?"],
  "auth.needAccount": ["არ გაქვს ანგარიში?", "Need an account?"],
  "auth.back": ["შესვლაზე დაბრუნება", "Back to sign in"],
  "auth.private": ["შენი მონაცემები შენ გეკუთვნის.", "Your data belongs to you."],
  "auth.verifyTitle": ["დაადასტურე ელფოსტა", "Confirm your email"],
  "auth.verifyCode": ["6-ნიშნა კოდი","6-digit code"],
  "auth.verifyAction": ["ელფოსტის დადასტურება","Verify email"],
  "auth.resendCode": ["კოდის ხელახლა გაგზავნა","Resend code"],
  "market.title": ["მარკეტი / მაღაზია","Market / shop"],
  "market.cart": ["შენი კალათა","Your cart"],
  "library.title": ["ბლოგები","Library"],
  "care.title": ["ექიმები და კონსულტაცია","Doctors & consultations"],
  "care.bookings": ["ჩემი ჯავშნები","My appointments"],
  "care.messages": ["მიმოწერა","Messages"],
  "calculator.start": ["ბოლო პერიოდის პირველი დღე","First day of last period"],
  "directory.title": ["ყველა ფუნქცია","All features"],
  "directory.intro": ["აირჩიე შენი სივრცე. მოსამზადებელი ფუნქციები ცალკეა მონიშნული.","Choose your space. Features still in preparation are clearly marked."],
  "market.intro": ["შერჩეული პროდუქტები ყოველდღიური თავის მოვლისთვის.","Thoughtfully selected products for everyday care."],
  "market.orders": ["ჩემი შეკვეთები და გადახდის სტატუსი","My orders & payment status"],
  "care.intro": ["პირადი მიმოწერა არჩეულ ექიმთან და 30-წუთიანი ვიზიტის დაჯავშნა. ეს არ არის გადაუდებელი დახმარების სერვისი. ექიმი ვერ ხედავს შენს პერიოდის დღიურს.","Private messages with your chosen doctor and 30-minute appointments. This is not an emergency service. Doctors cannot access your period journal."],
  "care.note": ["პრემიუმის გადახდა ამ ეტაპზე სატესტოა. ექიმები გამოჩნდებიან მხოლოდ ადმინისტრატორის მიერ მათი დამატების შემდეგ.","Premium checkout is currently test-only. Doctors appear only after an administrator adds them."],
  "calculator.intro": ["მარტივი შეფასება შენი შეყვანილი საშუალო ხანგრძლივობით. 28 დღე მხოლოდ საწყისი მაგალითია.","A simple estimate using your entered average length. 28 days is only an initial example."],
  "calculator.length": ["ციკლის საშუალო ხანგრძლივობა","Average cycle length"],
  "calculator.duration": ["პერიოდის ხანგრძლივობა","Period duration"],
  "calculator.disclaimer": ["ეს კალკულატორი ისტორიას არ აანალიზებს. პირად კალენდარში პროგნოზი შენს რეალურ ჩანაწერებსა და მათ ცვალებადობასაც ითვალისწინებს. შეფასება არ ადასტურებს ოვულაციას, არ არის დიაგნოზი და კონტრაცეფციისთვის არ გამოიყენება.","This calculator does not analyze history. Your personal tracker also considers recorded cycles and their variability. Estimates do not confirm ovulation, diagnose conditions or provide contraception."],
  "calculator.estimated": ["სავარაუდო თარიღები","Estimated dates"],
  "calculator.empty": ["გამოთვლისთვის შეავსე ველები.","Complete the fields to estimate dates."],
};
for (const [key, [ka, en]] of Object.entries(additional)) add(key, ka, en);
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
