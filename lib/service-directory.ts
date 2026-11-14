export const serviceGroups = [
  { id: "track", ka: "პერიოდი და ჯანმრთელობა", en: "Cycle & health", items: [
    ["/app/dashboard", "პერიოდის კალენდარი", "Period calendar", "მონიშნე პერიოდის დღეები და ნახე სავარაუდო თარიღები.", "Log your period days and see estimated dates."],
    ["/app/log", "სიმპტომების დღიური", "Symptom journal", "ჩაინიშნე, როგორ გრძნობ თავს დღეს.", "Record how you feel today."],
    ["/app/insights", "ციკლის ისტორია და ანალიზი", "Cycle history & insights", "შეადარე შენახული ციკლები და სიმპტომები.", "Review your recorded cycles and symptoms."],
    ["/app/symptom-checker", "სიმპტომების კითხვარი", "Symptom review", "მონიშნე სიმპტომები და მოემზადე ექიმთან საუბრისთვის.", "Select symptoms and prepare for a conversation with a clinician.", "premium"],
    ["/app/journey", "პირადი გზამკვლევი", "Guided journey", "ნახე შემდეგი ნაბიჯი შენი ჩანაწერების მიხედვით.", "Find your next step based on your entries."],
    ["/tools/period-calculator", "პერიოდის კალკულატორი", "Period calculator", "გამოთვალე შემდეგი პერიოდის სავარაუდო თარიღი.", "Estimate the date of your next period."],
    ["/tools/ovulation-calculator", "ოვულაციის კალკულატორი", "Ovulation calculator", "ნახე ოვულაციის სავარაუდო თარიღი.", "See your estimated ovulation date."],
  ] },
  { id: "care", ka: "ექიმი და მხარდაჭერა", en: "Care & support", items: [
    ["/consultation", "ექიმები, ჩატი და ვიზიტები", "Doctors, chat & appointments", "ნახე ექიმები. მიმოწერისა და დაჯავშნისთვის საჭიროა პრემიუმი.", "Browse doctors. Messaging and booking require Premium.", "premium"],
    ["/app/report", "ანგარიში ექიმისთვის", "Report for your doctor", "მოამზადე ჩანაწერების შეჯამება ექიმთან გასაზიარებლად.", "Prepare a summary of your records to share with a doctor.", "premium"],
    ["/app/pregnancy", "ორსულობის მონიტორინგი", "Pregnancy tracking", "შეიყვანე თარიღი და თვალი ადევნე ორსულობის კვირებს.", "Enter your dates and track pregnancy weeks.", "premium"],
    ["/app/partners", "პარტნიორთან გაზიარება", "Partner sharing", "აირჩიე, რა გაუზიარო პარტნიორს. მოწვევას პრემიუმი სჭირდება.", "Choose what to share. Sending an invitation requires Premium.", "premium"],
  ] },
  { id: "discover", ka: "საზოგადოება და ბიბლიოთეკა", en: "Community & library", items: [
    ["/community", "საზოგადოება", "Community", "შესვლის შემდეგ წაიკითხე პოსტები ან გაუზიარე სხვებს გამოცდილება.", "Sign in to read posts or share your experience."],
    ["/blog", "ჯანმრთელობის სტატიები", "Health articles", "მოძებნე სტატიები შენთვის საინტერესო თემაზე.", "Find articles on topics that interest you."],
    ["/app/notifications", "შეტყობინებები", "Announcements", "ნახე თუთასგან მიღებული შეტყობინებები.", "Read announcements from Tuta."],
  ] },
  { id: "shop", ka: "მარკეტი და გამოწერა", en: "Market & subscription", items: [
    ["/market", "მარკეტი", "Market", "დაათვალიერე პროდუქტები და დაამატე კალათაში.", "Browse products and add them to your cart."],
    ["/market/orders", "ჩემი შეკვეთები", "My orders", "ნახე შენი შეკვეთების ისტორია და სტატუსი.", "See your order history and status."],
    ["/premium", "პრემიუმის გეგმები", "Premium plans", "შეადარე უფასო და პრემიუმ გეგმები და მართე გამოწერა.", "Compare Free and Premium and manage your subscription."],
  ] },
  { id: "account", ka: "ანგარიში და ინფორმაცია", en: "Account & information", items: [
    ["/app/settings", "ჩემი პროფილი", "My profile", "ნახე ანგარიშის ინფორმაცია ან გამოდი ანგარიშიდან.", "View your account details or sign out."],
    ["/privacy", "კონფიდენციალურობა და პაროლი", "Privacy & password", "გაიგე, როგორ ინახება მონაცემები და შეცვალე პაროლი.", "See how your data is handled and change your password."],
    ["/app/account-deletion", "ანგარიშის წაშლის მოთხოვნა", "Request account deletion", "გააგზავნე წაშლის მოთხოვნა ან გააუქმე გაგზავნილი.", "Submit or withdraw a request to delete your account."],
    ["/about", "თუთას შესახებ", "About Tuta", "გაიგე, რისთვის არის თუთა.", "Learn what Tuta is for."],
    ["/terms", "წესები და პირობები", "Terms of use", "წაიკითხე პლატფორმის გამოყენების წესები.", "Read the rules for using the platform."],
  ] },
] as const;

export const serviceCopyKey = (href: string) => `directory.item.${href.slice(1).replaceAll("/", ".")}`;
