import { Pressable, ScrollView, View } from "react-native";
import { C, T, s, CTA } from "./ui";
import { Icon } from "./Art";
import { destinations, visibleDestinations } from "./navigation.mjs";
import type { Lang, Tab } from "./types";
import { useAppFeatures } from "./useJourneyEnabled";
import { serviceGroups } from "../../lib/service-directory";
import { featureForRoute } from "../../lib/site-feature-definitions";

export const serviceTargets = {
  "/app/dashboard": "calendar", "/app/log": "log", "/app/insights": "insights",
  "/app/journey": "journey", "/tools/period-calculator": "period-calculator",
  "/tools/ovulation-calculator": "ovulation-calculator", "/consultation": "care",
  "/app/report": "report", "/app/pregnancy": "pregnancy", "/app/partners": "partners",
  "/community": "home", "/blog": "blog", "/app/notifications": "notifications",
  "/market": "market", "/market/orders": "orders", "/premium": "premium",
  "/app/settings": "profile", "/privacy": "privacy", "/about": "about",
  "/terms": "terms", "/app/symptom-checker": "symptom-checker",
  "/app/account-deletion": "account-deletion",
} as const satisfies Record<(typeof serviceGroups)[number]["items"][number][0], Tab>;
type Nav = { lang: Lang; onNavigate: (tab: Tab) => void };
export function ScreenLinks({
  lang,
  onNavigate,
  group,
}: { group: string } & Nav) {
  const { features } = useAppFeatures();
  const ka = lang === "ka";
  return (
    <View style={s.card}>
      {visibleDestinations(group, features)
        .filter((p) => p.id !== "profile" && p.id !== "premium")
        .map((page) => (
          <Pressable
            key={page.id}
            accessibilityRole="button"
            onPress={() => onNavigate(page.id as Tab)}
            style={{
              minHeight: 62,
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
              borderBottomWidth: 1,
              borderColor: C.line,
              paddingVertical: 8,
            }}
          >
            <View
              style={{ backgroundColor: C.lav, padding: 10, borderRadius: 13 }}
            >
              <Icon name={page.icon} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="bold">{ka ? page.ka : page.en}</T>
              {page.planned && (
                <T style={s.muted}>
                  {ka ? "მომზადების ეტაპზე" : "In preparation"}
                </T>
              )}
            </View>
            <Icon name="arrow" size={18} />
          </Pressable>
        ))}
    </View>
  );
}
export function ServicesScreen(props: Nav) {
  const ka = props.lang === "ka";
  const { status, features, retry } = useAppFeatures();
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "სერვისები" : "Services"}
      </T>
      <T style={[s.muted, { marginBottom: 18 }]}>
        {ka ? "აირჩიე, რისი გაკეთება გინდა." : "Choose what you want to do."}
      </T>
      {status === "loading" && <T>{ka ? "სერვისები იტვირთება…" : "Loading services…"}</T>}
      {status === "error" && <View style={s.card}>
        <T>{ka ? "სერვისების სრული სია ვერ ჩაიტვირთა." : "Could not load all services."}</T>
        <CTA title={ka ? "ხელახლა ცდა" : "Retry"} onPress={() => void retry()}/>
      </View>}
      {serviceGroups.map(group => {
        const items = group.items.filter(([href]) => {
          const feature = featureForRoute(href);
          return feature === null || features[feature] === true;
        });
        if (!items.length) return null;
        return <View key={group.id}>
          <T weight="bold" style={{ fontSize: 19, marginBottom: 8 }} accessibilityRole="header">{ka ? group.ka : group.en}</T>
          <View style={[s.card, { paddingVertical: 0 }]}>
            {items.map(([href, labelKa, labelEn, detailKa, detailEn, access], index) => (
              <Pressable key={href} accessibilityRole="button" onPress={() => props.onNavigate(serviceTargets[href])}
                style={{ minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderColor: C.line, borderTopWidth: index === 0 ? 0 : 1 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <T weight="bold">{href === "/app/notifications" ? (ka ? "შეხსენებები" : "Reminders") : (ka ? labelKa : labelEn)}</T>
                  <T style={s.muted}>{href === "/app/notifications"
                    ? (ka ? "დააყენე პერიოდის შეხსენება ამ მოწყობილობაზე." : "Set period reminders on this device.")
                    : (ka ? detailKa : detailEn)}</T>
                  {access === "premium" && <T style={{ alignSelf: "flex-start", backgroundColor: C.yellow, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12 }}>{ka ? "პრემიუმი" : "Premium"}</T>}
                </View>
                <Icon name="arrow" size={18}/>
              </Pressable>
            ))}
          </View>
        </View>;
      })}
    </View>
  );
}
export function PeriodNavigation({
  lang,
  onNavigate,
  selected,
}: { selected: Tab } & Nav) {
  const { features } = useAppFeatures();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
      }}
      style={{ flexGrow: 0 }}
    >
      {visibleDestinations("cycle", features).map((page) => (
        <Pressable
          key={page.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: page.id === selected }}
          onPress={() => onNavigate(page.id as Tab)}
          style={[
            s.chip,
            { backgroundColor: page.id === selected ? C.lav : C.white },
          ]}
        >
          <T weight={page.id === selected ? "bold" : "regular"}>
            {lang === "ka" ? page.ka : page.en}
          </T>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function PageHeading({
  page,
  lang,
  onBack,
}: {
  page: Tab;
  lang: Lang;
  onBack: () => void;
}) {
  const item = destinations.find((p) => p.id === page);
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          minHeight: 44,
        }}
      >
        <Icon name="back" size={18} />
        <T style={s.muted}>{lang === "ka" ? "უკან" : "Back"}</T>
      </Pressable>
      {item && (
        <T weight="bold" style={{ fontSize: 18 }}>
          {lang === "ka" ? item.ka : item.en}
        </T>
      )}
    </View>
  );
}
export function FeatureUnavailable({
  lang,
  retry,
  status,
}: {
  lang: Lang;
  retry: () => void;
  status: string;
}) {
  return (
    <View style={s.content}>
      <T style={{ marginBottom: 18 }}>
        {status === "loading"
          ? lang === "ka"
            ? "პარამეტრები იტვირთება…"
            : "Loading settings…"
          : status === "error"
            ? lang === "ka"
              ? "პარამეტრები ვერ ჩაიტვირთა."
              : "Could not load settings."
            : lang === "ka"
              ? "ფუნქცია დროებით გამორთულია."
              : "This feature is temporarily disabled."}
      </T>
      <CTA
        light
        title={lang === "ka" ? "განახლება" : "Refresh"}
        onPress={retry}
      />
    </View>
  );
}
