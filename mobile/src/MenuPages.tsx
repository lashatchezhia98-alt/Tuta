import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon, MoonFlower } from "./Art";
import { C, T, s } from "./ui";
import type { Lang, Tab } from "./types";
import { destinations } from "./navigation.mjs";
import { ChangePassword } from "./ChangePassword";

const menuPages = [
  { id: "services", icon: "services", ka: "სერვისები", en: "Services" },
  ...destinations.filter((page) => page.group === "info"),
];

export function AppMenu({
  visible,
  lang,
  onClose,
  onNavigate,
  onLanguage,
}: {
  visible: boolean;
  lang: Lang;
  showSettings: boolean;
  onClose: () => void;
  onNavigate: (page: Tab) => void;
  onLanguage: () => void;
}) {
  const ka = lang === "ka";
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: C.bg }}
          edges={["top", "bottom"]}
        >
          <View style={s.header}>
            <T weight="bold" style={{ fontSize: 24 }}>
              {ka ? "მენიუ" : "Menu"}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka ? "დახურვა" : "Close menu"}
              onPress={onClose}
              style={s.round}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            <T style={[s.muted, { marginBottom: 20 }]}>
              {ka
                ? "აქ ნახავ სერვისებს, ინფორმაციას თუთაზე და ენის პარამეტრებს."
                : "Find services, information about Tuta, and language settings here."}
            </T>
            <View style={s.card}>
              {menuPages
                .map((page) => (
                  <Pressable
                    key={page.id}
                    accessibilityRole="button"
                    onPress={() => {
                      onClose();
                      onNavigate(page.id as Tab);
                    }}
                    style={{
                      minHeight: 60,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <Icon name={page.icon} />
                    <T style={{ flex: 1 }}>{ka ? page.ka : page.en}</T>
                    <Icon name="arrow" size={18} />
                  </Pressable>
                ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onLanguage}
              style={[
                s.card,
                s.wrap,
                { minHeight: 60, justifyContent: "space-between" },
              ]}
            >
              <T weight="bold">{ka ? "ენა" : "Language"}</T>
              <T>{ka ? "ქართული · EN" : "English · ქა"}</T>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
export function MenuPage({
  page,
  lang,
  userId,
  onSignIn,
  onForgot,
}: {
  page: "about" | "privacy" | "terms";
  lang: Lang;
  userId?: string;
  onSignIn: () => void;
  onForgot: () => void;
}) {
  const ka = lang === "ka";
  const sections =
    page === "about"
      ? [
          [
            ka ? "შენი რიტმის გასაგებად" : "Understand your rhythm",
            ka
              ? "თუთა აერთიანებს პერიოდის კალენდარს, დღიურს, ქალთა საზოგადოებას, ჯანმრთელობის მასალებს, კონსულტაციებსა და მარკეტს. ვებსაიტი და აპები ერთი ანგარიშით მუშაობს."
              : "Tuta brings together period tracking, check-ins, a women’s community, health education, consultations and a market. The website and apps use one account.",
          ],
          [
            ka ? "შეფასება, არა დიაგნოზი" : "Estimates, not diagnosis",
            ka
              ? "პროგნოზი შენს ჩანაწერებს ეყრდნობა. გამოთვლები არ ადასტურებს ოვულაციას და კონტრაცეფციისთვის არ გამოიყენება."
              : "Estimates depend on your recorded history. Calculations do not confirm ovulation and must not be used for contraception.",
          ],
        ]
      : page === "privacy"
        ? [
            [
              ka
                ? "პირადი ინფორმაცია დაცულია"
                : "Your personal information is protected",
              ka
                ? "პერიოდისა და დღიურის ჩანაწერები ინახება ანგარიშთან დაკავშირებულ ბაზაში და სინქრონდება ვებსაიტსა და აპებს შორის. ყოველდღიური ჯანმრთელობის ჩანაწერები ტელეფონის მუდმივ საცავში არ ინახება. ტელეფონზე ინახება შესვლის სესია და კალათის პროდუქტის კოდები/რაოდენობები."
                : "Period and journal entries are stored in your account database and synced across web and apps. Daily health records are not persisted on the phone. Your sign-in session and cart product IDs/quantities are stored on the device.",
            ],
            [
              ka ? "გაზიარებას შენ აკონტროლებ" : "You control sharing",
              ka
                ? "პარტნიორისთვის მხოლოდ შენ მიერ არჩეული პერიოდის ან ორსულობის თარიღები ზიარდება. ნებართვის გაუქმება ყოველთვის შეგიძლია. ექიმი შენს დღიურს ავტომატურად ვერ ხედავს. PDF-ისა და მონაცემების ექსპორტი მხოლოდ შენი მოქმედებით ქმნის გასაზიარებელ ასლს."
                : "Partner sharing includes only selected period or pregnancy dates. You can revoke consent. Doctors cannot automatically see your journal. PDF and data exports create a shareable copy only when you choose to export.",
            ],
            [
              ka ? "პოსტები და ფოტოები" : "Posts and photos",
              ka
                ? "პოსტებს მხოლოდ შესული წევრები ხედავენ. ანონიმური პოსტი სხვებს ავტორის სახელს არ აჩვენებს, თუმცა სრული ტექნიკური ანონიმურობა არ იგულისხმება. ფოტოები Cloudinary-ზე ინახება და ფოტოს ბმულის მქონეს მისი ნახვა შეუძლია."
                : "Posts require member sign-in. Anonymous posting hides your display name from other members, not your identity from every system. Photos are hosted on Cloudinary and can be accessed by anyone holding the image URL.",
            ],
            [
              ka ? "მარკეტი და მიწოდება" : "Market and delivery",
              ka
                ? "შეკვეთისას მითითებული მისამართი და არასავალდებულო პინი გამოიყენება მიწოდების ორგანიზებისთვის. ისინი კალათის ადგილობრივ ასლში არ ინახება."
                : "Delivery details and your optional map pin are used to arrange delivery. They are not included in the locally stored cart.",
            ],
            [
              ka ? "ექიმთან მიმოწერის ვადა" : "Chat retention",
              ka
                ? "ჩატის შეტყობინებები გაგზავნიდან 48 საათში წაიშლება აქტიური ბაზიდან და აპში აღარ გამოჩნდება. ჩატის ადგილობრივი არქივი არ იქმნება. პროვაიდერის სარეზერვო ასლებს შენახვის ცალკე ვადა აქვს; სხვის მიერ გაკეთებულ ასლებსა და ეკრანის ფოტოებს ვერ წავშლით. პროფილის ფოტო მხოლოდ გადამოწმებულ ექიმებს აქვთ."
                : "Chat messages expire after 48 hours and are removed from the active database. No local chat archive is created. Provider backups have separate retention; copies and screenshots made by others cannot be erased. Only verified doctors have profile photos.",
            ],
          ]
        : [
            [
              ka ? "უსაფრთხო გამოყენება" : "Safe use",
              ka
                ? "თუთა არ არის დიაგნოსტიკის ან გადაუდებელი დახმარების სერვისი. ყველა სავარაუდო თარიღი დამოკიდებულია შეყვანილ ისტორიაზე. ექიმთან კონსულტაცია ხელმისაწვდომია მხოლოდ დამატებული ექიმებისა და მათი თავისუფალი დროების მიხედვით."
                : "Tuta is not a diagnostic or emergency service. Estimated dates depend on entered history. Consultations depend on listed doctors and available appointment times.",
            ],
            [
              ka ? "საზოგადოების წესები" : "Community rules",
              ka
                ? "პოსტი მაქსიმუმ 200 სიტყვასა და ერთ ფოტოს შეიცავს. მიუთითე თემა. შეგიძლია საკუთარი პოსტის შეცვლა/წაშლა, კონკრეტულ კომენტარზე პასუხი და დარღვევის გასაჩივრება. არ გამოაქვეყნო სხვისი პირადი ინფორმაცია, შეურაცხყოფა ან სპამი."
                : "Posts allow up to 200 words and one photo, with a topic. Edit/delete your own post, reply to a specific comment and report violations. Do not publish private information about others, abuse or spam.",
            ],
            [
              ka ? "გამოწერა და გადახდა" : "Plans and payments",
              ka
                ? "პრემიუმის ფასებია 4.99 ₾ / 30 დღე და 49.90 ₾ / წელი. ამ ვერსიაში გადახდა სატესტოა, რეალური გაყიდვა და ავტომატური ჩამოჭრა ჩართული არ არის. კალათის ფასი და რაოდენობა სერვერზე ხელახლა მოწმდება."
                : "Premium prices are 4.99 GEL / 30 days and 49.90 GEL / year. Checkout is test-only; real sales and automatic charges are not enabled. Cart prices and quantities are revalidated on the server.",
            ],
          ];
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {page === "about"
          ? ka
            ? "ჩვენ შესახებ"
            : "About Tuta"
          : page === "privacy"
            ? ka
              ? "კონფიდენციალურობა"
              : "Privacy"
            : ka
              ? "წესები და პირობები"
              : "Terms of use"}
      </T>
      {page === "privacy" ? <ChangePassword ka={ka} userId={userId} onSignIn={onSignIn} onForgot={onForgot} /> : null}
      {page === "about" && (
        <View
          style={[s.card, { alignItems: "center", backgroundColor: C.lav }]}
        >
          <MoonFlower size={140} />
        </View>
      )}
      {sections.map(([title, body]) => (
        <View key={title} style={s.card}>
          <T weight="bold" style={{ fontSize: 20, marginBottom: 12 }}>
            {title}
          </T>
          <T style={{ lineHeight: 28 }}>{body}</T>
        </View>
      ))}
    </View>
  );
}
