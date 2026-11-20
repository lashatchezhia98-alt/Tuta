import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useChatMessages, useChatReceipts, type ChatResponse } from "./useChatMessages";
import { careOverview } from "./care-presentation.mjs";
import { activityTones } from "./activity.mjs";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import type { Session } from "@supabase/supabase-js";
import { C, T, s, CTA, Chip, DateField, FieldLabel, NumberWheel } from "./ui";
import type { Data, Lang, Tab } from "./types";
import { api, apiRoot } from "./api";
import { checkoutInApp, openPaymentCheckout } from "./open-payment-checkout";
import { useResource } from "./useResource";
import { useMembership } from "./useMembership";
import { useAppFeatures, useFeatureEnabled } from "./useJourneyEnabled";
import { forecast } from "./cycle.mjs";
import { calculateCycleEstimate, calculatorMessages, formatCalculatorDate } from "./cycle-calculator.mjs";
import { healthReport, reminderCalendar, reminderLead, reminderRepeat } from "./health-report";
import { sexualActivityOptions } from "./sexual-activity";
import { symptoms } from "./symptoms.mjs";
import { filterLibrary, libraryCategories } from "../../lib/library-search";
import { premiumComparisonCopy, premiumComparisonFeatures } from "../../lib/premium-comparison";
import { Icon } from "./Art";

const comparisonStyles = StyleSheet.create({
  frame: { borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: "hidden", backgroundColor: C.white },
  row: { flexDirection: "row", borderTopWidth: 1, borderColor: C.line },
  feature: { flex: 3, minWidth: 0, justifyContent: "center", padding: 10 },
  plan: { flex: 1.15, minWidth: 0, justifyContent: "center", alignItems: "center", paddingVertical: 10, paddingHorizontal: 3 },
  heading: { fontSize: 13, textAlign: "center" },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});

function PremiumComparison({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const availability = useAppFeatures();
  const copy = (key: keyof typeof premiumComparisonCopy) => premiumComparisonCopy[key][ka ? 0 : 1];
  const freeLabel = copy("premium.compare.free");
  const paidLabel = copy("premium.compare.paid");
  const included = ka ? "შედის" : "included";
  const excluded = ka ? "არ შედის" : "not included";
  return <View style={{ gap: 10 }}>
    <T accessibilityRole="header" weight="bold" style={{ fontSize: 21 }}>{copy("premium.compare.title")}</T>
    <T style={s.muted}>{copy("premium.compare.intro")}</T>
    <View style={comparisonStyles.frame}>
      <View style={{ flexDirection: "row", backgroundColor: C.bg }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={comparisonStyles.feature}><T weight="bold" style={{ fontSize: 13 }}>{copy("premium.compare.feature")}</T></View>
        <View style={comparisonStyles.plan}><T weight="bold" style={comparisonStyles.heading}>{freeLabel}</T></View>
        <View style={[comparisonStyles.plan, { backgroundColor: C.lav }]}><T weight="bold" style={comparisonStyles.heading}>{paidLabel}</T></View>
      </View>
      {premiumComparisonFeatures.map(({ id, free, feature: flag }) => {
        const feature = copy(`premium.compare.${id}`);
        if (availability.status === "ready" && availability.features[flag] === false)
          return <View key={id} accessibilityLabel={`${feature}. ${copy("premium.compare.unavailable")}`} accessible style={comparisonStyles.row}>
            <View style={comparisonStyles.feature}><T style={{ fontSize: 14 }}>{feature}</T></View>
            <View style={[comparisonStyles.plan, { flex: 2.3, backgroundColor: "#F2ECFA" }]}><T style={{ fontSize: 12, textAlign: "center" }}>{copy("premium.compare.unavailable")}</T></View>
          </View>;
        return <View key={id} accessible accessibilityLabel={`${feature}. ${freeLabel}: ${free ? included : excluded}. ${paidLabel}: ${included}.`} style={comparisonStyles.row}>
          <View style={comparisonStyles.feature}><T style={{ fontSize: 14 }}>{feature}</T></View>
          <View style={comparisonStyles.plan}>{free
            ? <View style={[comparisonStyles.badge, { backgroundColor: C.bg }]}><Icon name="check" size={15} /></View>
            : <T style={s.muted}>–</T>}</View>
          <View style={[comparisonStyles.plan, { backgroundColor: "#F3EEF8" }]}>
            <View style={[comparisonStyles.badge, { backgroundColor: C.yellow }]}><Icon name="check" size={15} /></View>
          </View>
        </View>;
      })}
    </View>
    <T style={s.muted}>{copy("premium.compare.note")}</T>
  </View>;
}
type Nav = { lang: Lang; onNavigate: (tab: Tab) => void };
export function ResourceStatus({
  loading,
  error,
  refresh,
  lang,
}: {
  loading: boolean;
  error: string;
  refresh: () => unknown;
  lang: Lang;
}) {
  return (
    <View style={{ gap: 10, marginBottom: 16 }}>
      {loading && (
        <T accessibilityLiveRegion="polite">
          {lang === "ka" ? "იტვირთება…" : "Loading…"}
        </T>
      )}
      {Boolean(error) && (
        <T accessibilityRole="alert" style={s.error}>
          {error}
        </T>
      )}
      <Pressable
        accessibilityRole="button"
        style={{ minHeight: 44, justifyContent: "center" }}
        onPress={() => void refresh()}
      >
        <T weight="bold">↻ {lang === "ka" ? "განახლება" : "Refresh"}</T>
      </Pressable>
    </View>
  );
}
export function LibraryScreen({ lang, initialCategory = "" }: Nav & { initialCategory?: string }) {
  const ka = lang === "ka",
    resource = useResource<{
      articles: {
        id: string;
        title_ka: string;
        title_en: string;
        body_ka: string;
        body_en: string;
        category: string;
        verified_doctors?: { first_name: string; last_name: string } | null;
      }[];
    }>("/api/library");
  const [category, setCategory] = useState(initialCategory),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState("");
  const categories: Record<string, [string, string]> = libraryCategories;
  const article = resource.data?.articles.find((a) => a.id === selected);
  const visibleArticles = filterLibrary(resource.data?.articles ?? [], category, query);
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "ბიბლიოთეკა" : "Health library"}
      </T>
      <ResourceStatus {...resource} lang={lang} />
      {article ? (
        <>
          <CTA
            light
            title={ka ? "ყველა სტატია" : "All articles"}
            onPress={() => setSelected("")}
          />
          <View style={[s.card, { marginTop: 16 }]}>
            <T weight="bold" style={{ fontSize: 23, marginBottom: 16 }}>
              {ka ? article.title_ka : article.title_en || article.title_ka}
            </T>
            {article.verified_doctors && <T style={s.muted}>{ka ? "ავტორი: ექიმი " : "Author: Dr. "}{article.verified_doctors.first_name} {article.verified_doctors.last_name} ✓</T>}
            {!ka && !article.body_en && <T style={s.muted}>English translation is not available yet.</T>}
            <T selectable style={{ lineHeight: 28 }}>{ka ? article.body_ka : article.body_en || article.body_ka}</T>
          </View>
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel={ka ? "სტატიის ძებნა" : "Search articles"}
            placeholder={ka ? "მოძებნე თემა" : "Search a topic"}
            value={query}
            onChangeText={setQuery}
            style={s.input}
          />
          <View style={[s.wrap, { marginVertical: 16 }]}>
            <Chip
              label={ka ? "ყველა" : "All"}
              selected={!category}
              onPress={() => setCategory("")}
            />
            {Object.entries(categories).map(([id, [a, b]]) => (
              <Chip
                key={id}
                label={ka ? a : b}
                selected={category === id}
                onPress={() => setCategory(id)}
              />
            ))}
          </View>
          {visibleArticles
            .map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() => setSelected(a.id)}
                style={s.card}
              >
                <T style={s.muted}>
                  {categories[a.category]?.[ka ? 0 : 1]}
                </T>
                <T weight="bold" style={{ fontSize: 20, marginVertical: 12 }}>
                  {ka ? a.title_ka : a.title_en || a.title_ka}
                </T>
                <T>{ka ? "წაკითხვა →" : "Read →"}</T>
              </Pressable>
            ))}
          {resource.data?.articles.length && !visibleArticles.length ? <T>{ka ? "სტატია ვერ მოიძებნა." : "No matching articles."}</T> : null}
          {resource.data && !resource.data.articles.length && (
            <T>
              {ka
                ? "სტატიები გამოჩნდება ადმინისტრატორის მიერ გამოქვეყნების შემდეგ."
                : "Articles appear once the administrator publishes them."}
            </T>
          )}
        </>
      )}
      <T style={s.muted}>
        {ka
          ? "საგანმანათლებლო მასალა ექიმის კონსულტაციას არ ცვლის."
          : "Educational content does not replace medical care."}
      </T>
    </View>
  );
}
export function PremiumScreen({ lang, session, onPaymentReturn }: Nav & {
  session: Session;
  onPaymentReturn: (url: string) => void;
}) {
  const ka = lang === "ka",
    membership = useResource<{ active: boolean; expiresAt: string | null; purchaseBlocked?: boolean; renewalState?: "active" | "disabled" | "starting" | "stopping" | null; canResume?: boolean }>(
      "/api/payments/flitt/status",
      session.user.id,
      30000,
    );
  const [plan, setPlan] = useState("yearly"),
    [autoRenew, setAutoRenew] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const alive = useRef(true);
  const working = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  async function checkout() {
    if (working.current || membership.data?.purchaseBlocked) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/payments/flitt/checkout", {
        body: { plan, autoRenew, ...(checkoutInApp ? { returnTo: "app" } : {}) },
        userId: session.user.id,
      });
      if (!alive.current) return;
      const returned = await openPaymentCheckout(result.checkoutUrl);
      if (!alive.current) return;
      if (returned) onPaymentReturn(returned);
      if (checkoutInApp) void membership.refresh();
    } catch (e) {
      if (alive.current)
        setMessage(e instanceof Error ? e.message : "Connection unavailable");
      if (alive.current) void membership.refresh();
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const renewal = membership.data?.renewalState;
  const pending = renewal === "starting" || renewal === "stopping";
  async function changeRenewal(enabled: boolean) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await api("/api/payments/flitt/status", { method: "PATCH", body: { enabled }, userId: session.user.id });
      if (alive.current) setMessage(enabled
        ? (ka ? "ავტომატური განახლება ჩაირთო." : "Automatic renewal is on.")
        : (ka ? "ავტომატური განახლება გაითიშა. გადახდილი პერიოდი ძალაში რჩება." : "Automatic renewal is off. Paid access is unchanged."));
    } catch (e) {
      if (alive.current) setMessage(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      if (alive.current) { void membership.refresh(); setBusy(false); }
      working.current = false;
    }
  }
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        Tuta Premium
      </T>
      <ResourceStatus {...membership} lang={lang} />
      <View style={[s.card, { backgroundColor: C.yellow }]}>
        <T weight="bold">
          {membership.data?.active
            ? ka
              ? "პრემიუმი აქტიურია"
              : "Premium is active"
            : ka
              ? "შენი ჯანმრთელობის მეტი დეტალი"
              : "More insight into your health"}
        </T>
        {membership.data?.expiresAt && (
          <T>
            {ka ? "მოქმედებს: " : "Valid until: "}
            {new Date(membership.data.expiresAt).toLocaleDateString(
              ka ? "ka-GE" : "en-GB",
            )}
          </T>
        )}
      </View>
      <PremiumComparison lang={lang} />
      <View style={s.banner}>
        <T weight="bold">
          {ka ? "მხოლოდ სატესტო გადახდა" : "Test checkout only"}
        </T>
        <T style={s.muted}>
          {ka
            ? "რეალური თანხა არ ჩამოგეჭრება. ავტომატური განახლებაც სატესტოა."
            : "No real charge. Automatic renewal is also in test mode."}
        </T>
      </View>
      {membership.data?.purchaseBlocked ? <T style={s.muted}>{ka ? "მეორედ გადახდა ამ პერიოდში შეუძლებელია." : "You cannot pay again for the current period."}</T> : <><View style={[s.wrap, { marginBottom: 16 }]}>
        <Chip
          selected={plan === "monthly"}
          label={ka ? "30 დღე · 4.99 ₾" : "30 days · 4.99 GEL"}
          onPress={() => setPlan("monthly")}
        />
        <Chip
          selected={plan === "yearly"}
          label={ka ? "1 წელი · 49.90 ₾" : "1 year · 49.90 GEL"}
          onPress={() => setPlan("yearly")}
        />
      </View>
      <Chip selected={autoRenew} label={ka ? "ავტომატური სატესტო განახლება" : "Automatic test renewal"} onPress={() => setAutoRenew(value => !value)}/>
      <CTA
        title={ka ? "სატესტო გადახდის გახსნა" : "Open test checkout"}
        disabled={busy || membership.loading || Boolean(membership.error)}
        onPress={() => void checkout()}
      /></>}
      {renewal && <View style={s.card}>
        <T>{pending ? (ka ? "ცვლილება მოწმდება." : "Verifying change.") : renewal === "active" ? (ka ? "ავტომატური განახლება ჩართულია." : "Automatic renewal is on.") : (ka ? "ავტომატური განახლება გამორთულია." : "Automatic renewal is off.")}</T>
        {(renewal !== "disabled" || membership.data?.canResume) && <CTA
          light disabled={busy}
          title={pending ? (ka ? "ხელახლა შემოწმება" : "Retry change") : renewal === "active" ? (ka ? "ავტომატური განახლების გათიშვა" : "Turn off automatic renewal") : (ka ? "ავტომატური განახლების ჩართვა" : "Turn on automatic renewal")}
          onPress={() => void changeRenewal(renewal === "disabled" || renewal === "starting")}
        />}
      </View>}
      {Boolean(message) && <T accessibilityRole="alert">{message}</T>}
    </View>
  );
}
type Doctor = {
  user_id: string;
  specialty: string;
  bio: string;
  photoUrl: string | null;
  verified_doctors: { first_name: string; last_name: string };
};
type Slot = {
  id: string;
  doctor_id: string;
  starts_at: string;
  location: string;
};
type Care = {
  userId: string;
  doctors: Doctor[];
  demoDoctors: { id: string; first_name: string; last_name: string; specialty: string; bio: string; photo_url: string }[];
  slots: Slot[];
  threads: {
    id: string;
    doctor_id: string;
    patient_id: string;
    patient_label: string;
    has_unread?: boolean;
  }[];
  bookings: {
    id: string;
    status: string;
    patient_label: string;
    consultation_slots: Omit<Slot, "id">;
  }[];
  premium: boolean;
  isDoctor: boolean;
};
function subscribeToCareAppState(notify: () => void) {
  const subscription = AppState.addEventListener("change", notify);
  return () => subscription.remove();
}
export function CareScreen({
  lang,
  session,
  onNavigate,
}: Nav & { session: Session }) {
  const ka = lang === "ka",
    resource = useResource<Care>("/api/care", session.user.id, 30000),
    feature = useFeatureEnabled("doctorConsultation");
  const [selectedSection, setSection] = useState(""),
    [doctor, setDoctor] = useState(""),
    [thread, setThread] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [blogTitle, setBlogTitle] = useState(""),
    [blogBody, setBlogBody] = useState(""),
    [blogCategory, setBlogCategory] = useState("cycle"),
    [showBlog, setShowBlog] = useState(false),
    [showSchedule, setShowSchedule] = useState(false);
  const isDoctor = Boolean(resource.data?.isDoctor);
  const section = isDoctor && (!selectedSection || selectedSection === "doctors") ? "messages" : selectedSection || "doctors";
  const threads = resource.data?.threads.filter(t => !isDoctor || t.doctor_id === session.user.id) ?? [];
  const bookings = resource.data?.bookings.filter(b => !isDoctor || b.consultation_slots?.doctor_id === session.user.id) ?? [];
  const activeConversation = section === "messages" && threads.some(t => t.id === thread);
  const chatScope = activeConversation ? `${session.user.id}:${thread}` : "";
  const loadMessages = useCallback(
    () =>
      api<ChatResponse>("/api/care?thread=" + thread, {
        userId: session.user.id,
      }),
    [thread, session.user.id],
  );
  const messages = useChatMessages(
    chatScope,
    loadMessages,
  );
  const foreground = useSyncExternalStore(subscribeToCareAppState, () => AppState.currentState === "active", () => false);
  const refreshCare = resource.refresh;
  const confirmReceipts = useCallback(async (messageIds: string[], visible: boolean) => {
    await api("/api/care", { body: { action: "receipts", id: thread, messageIds, visible }, userId: session.user.id });
    if (visible) void refreshCare();
  }, [thread, session.user.id, refreshCare]);
  useChatReceipts(chatScope, session.user.id, messages.messages, foreground, confirmReceipts);
  const alive = useRef(true);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, [chatScope]);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const name = (id: string) => {
    const d = resource.data?.doctors.find((d) => d.user_id === id);
    return d
      ? `${d.verified_doctors.first_name} ${d.verified_doctors.last_name}`
      : ka
        ? "ექიმი"
        : "Doctor";
  };
  const date = (value: string) =>
    new Date(value).toLocaleString(ka ? "ka-GE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/care", { body, userId: session.user.id });
      if (!alive.current) return;
      if (result.thread) {
        setThread(result.thread.id);
        setSection("messages");
      }
      if (body.action === "message") {
        if (typingTimer.current) clearTimeout(typingTimer.current);
        setText("");
        void api("/api/care", { body: { action: "typing", id: thread, typing: false }, userId: session.user.id }).catch(() => {});
        void messages.refresh();
      }
      await resource.refresh();
      if (alive.current) setMessage(ka ? "შესრულებულია" : "Done");
    } catch (e) {
      if (alive.current)
        setMessage(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const allowed =
    feature.status === "enabled" && Boolean(resource.data?.premium);
  const overview = isDoctor && resource.data ? careOverview(threads, bookings, resource.data.slots.filter(slot => slot.doctor_id === session.user.id)) : null;
  const sendDisabled = busy || !text.trim() || feature.status !== "enabled" ||
    (!resource.data?.premium && !isDoctor);
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <T weight="display" style={s.title}>
        {isDoctor ? (ka ? "ექიმის კაბინეტი" : "Doctor workspace") : (ka ? "ექიმები და კონსულტაცია" : "Doctors & care")}
      </T>
      <T style={s.muted}>
        {isDoctor ? (ka ? "უპასუხე პაციენტებს და ნახე შენი ვიზიტები." : "Reply to patients and view your visits.") : ka
          ? "ეს არ არის გადაუდებელი დახმარების სერვისი. ექიმი შენს დღიურს ავტომატურად ვერ ხედავს."
          : "Not an emergency service. Doctors cannot automatically view your journal."}
      </T>
      <ResourceStatus {...resource} lang={lang} />
      {overview && <View style={[s.card, { gap: 8 }]}>
        <T weight="bold" style={{ fontSize: 20 }}>{ka ? "სამუშაო მიმოხილვა" : "Work overview"}</T>
        <CTA light title={ka ? `წაუკითხავი საუბრები · ${overview.unread}` : `Unread conversations · ${overview.unread}`} onPress={() => setSection("messages")}/>
        <T weight="bold">{ka ? "უახლოესი ვიზიტი" : "Next appointment"}</T>
        <T>{overview.nextVisit?.consultation_slots ? date(overview.nextVisit.consultation_slots.starts_at) : (ka ? "დაგეგმილი არ არის" : "None scheduled")}</T>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showSchedule }}
          style={{ minHeight: 44, justifyContent: "center" }} onPress={() => setShowSchedule(value => !value)}>
          <T weight="bold">{ka ? `თავისუფალი დროები · ${overview.openSlots.length}` : `Open appointment times · ${overview.openSlots.length}`}</T>
        </Pressable>
        {showSchedule && overview.openSlots.map((slot, i) => <T key={`${slot.starts_at}:${i}`}>{date(slot.starts_at)}</T>)}
      </View>}
      {isDoctor && <CTA light title={ka ? "საზოგადოებაში გადასვლა" : "Go to community"} onPress={() => onNavigate("home")} />}
      {isDoctor && <CTA light title={showBlog ? (ka ? "სტატიის ფორმის დამალვა" : "Hide article editor") : (ka ? "ჯანმრთელობის ბლოგის წერა" : "Write a health article")} onPress={() => setShowBlog(value => !value)} />}
      {isDoctor && showBlog && <View style={s.card}>
        <T weight="bold" style={{ fontSize: 20, marginBottom: 8 }}>{ka ? "ჯანმრთელობის ბლოგის წერა" : "Write a health article"}</T>
        <T style={s.muted}>{ka ? "გამოქვეყნებისთანავე სტატია ბიბლიოთეკაში შენი სახელით გამოჩნდება." : "Published articles appear in the library under your name."}</T>
        <TextInput accessibilityLabel={ka ? "სტატიის სათაური" : "Article title"} placeholder={ka ? "სათაური" : "Title"} value={blogTitle} onChangeText={setBlogTitle} maxLength={180} style={s.input} />
        <View style={s.wrap}>{[["cycle", "ციკლი", "Cycle"], ["pregnancy", "ორსულობა", "Pregnancy"], ["nutrition", "კვება", "Nutrition"], ["mental-health", "ფსიქიკური ჯანმრთელობა", "Mental health"]].map(([id, kaLabel, enLabel]) => <Chip key={id} label={ka ? kaLabel : enLabel} selected={blogCategory === id} onPress={() => setBlogCategory(id)} />)}</View>
        <TextInput accessibilityLabel={ka ? "სტატიის ტექსტი" : "Article text"} placeholder={ka ? "სტატიის ტექსტი" : "Article text"} value={blogBody} onChangeText={setBlogBody} maxLength={6000} multiline textAlignVertical="top" style={[s.input, { minHeight: 150 }]} />
        <CTA disabled={busy || !blogTitle.trim() || !blogBody.trim()} title={ka ? "გამოქვეყნება" : "Publish"} onPress={() => void (async () => {
          setBusy(true); setMessage("");
          try { await api("/api/library", { body: { title: blogTitle, body: blogBody, category: blogCategory }, userId: session.user.id }); setBlogTitle(""); setBlogBody(""); setMessage(ka ? "სტატია გამოქვეყნდა." : "Article published."); }
          catch (e) { setMessage(e instanceof Error ? e.message : "Could not publish."); }
          finally { setBusy(false); }
        })()} />
      </View>}
      <View style={[s.wrap, { marginBottom: 18 }]}>
        {[
          ["doctors", "ექიმები", "Doctors"],
          ["messages", "ჩატი", "Chat"],
          ["bookings", "ჩემი ვიზიტები", "My visits"],
        ].filter(([id]) => !isDoctor || id !== "doctors").map(([id, a, b]) => (
          <Chip
            key={id}
            label={ka ? a : b}
            selected={section === id}
            onPress={() => setSection(id)}
          />
        ))}
      </View>
      {feature.status !== "enabled" && (
        <View style={s.banner}>
          <T>
            {ka
              ? "ახალი კონსულტაციები დროებით შეჩერებულია. ისტორია და ჯავშნის გაუქმება ხელმისაწვდომია."
              : "New consultations are paused. History and cancellation remain available."}
          </T>
        </View>
      )}
      {resource.data && !resource.data.premium && !resource.data.isDoctor && (
        <View style={s.card}>
          <T>
            {ka
              ? "ახალი ჩატისა და ვიზიტისთვის საჭიროა პრემიუმი."
              : "New chats and appointments require Premium."}
          </T>
          <CTA light title="Premium" onPress={() => onNavigate("premium")} />
        </View>
      )}
      {Boolean(message) && (
        <T accessibilityRole="alert" style={s.muted}>
          {message}
        </T>
      )}
      {section === "doctors" && (
        <>
          {resource.data?.demoDoctors?.map((d) => (
            <View style={s.card} key={`demo-${d.id}`}>
              <Image source={{ uri: apiRoot + d.photo_url }} accessibilityLabel="DEMO" style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }} />
              <View style={{ alignSelf: "flex-start", backgroundColor: C.yellow, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 }}>
                <T weight="bold" style={{ fontSize: 12 }}>DEMO · {ka ? "არა რეალური ექიმი" : "NOT A REAL DOCTOR"}</T>
              </View>
              <T weight="bold" style={{ fontSize: 20 }}>{d.first_name} {d.last_name} · DEMO</T>
              <T style={{ marginVertical: 8 }}>{d.specialty}</T>
              <T style={s.muted}>{ka ? "სატესტო პროფილი — კონსულტაცია, ჩატი და დაჯავშნა მიუწვდომელია." : "Demonstration profile — consultation, chat, and booking are unavailable."}</T>
            </View>
          ))}
          {resource.data?.doctors
            .filter((d) => d.user_id !== session.user.id)
            .map((d) => (
              <View style={s.card} key={d.user_id}>
                {d.photoUrl && (
                  <Image
                    source={{ uri: d.photoUrl }}
                    accessibilityLabel={name(d.user_id)}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      marginBottom: 12,
                    }}
                  />
                )}
                <T weight="bold" style={{ fontSize: 20 }}>
                  {ka ? "ექიმი " : "Dr "}
                  {name(d.user_id)} ✓
                </T>
                <T style={{ marginVertical: 8 }}>{d.specialty}</T>
                <T style={s.muted}>{d.bio}</T>
                <View style={{ gap: 12, marginTop: 16 }}>
                  <CTA
                    light
                    title={
                      ka ? "თავისუფალი დროების ნახვა" : "View available times"
                    }
                    onPress={() =>
                      setDoctor(doctor === d.user_id ? "" : d.user_id)
                    }
                  />
                  <CTA
                    disabled={!allowed || busy}
                    title={ka ? "ჩატის დაწყება" : "Start chat"}
                    onPress={() =>
                      void action({ action: "start", id: d.user_id })
                    }
                  />
                </View>
                {doctor === d.user_id && (
                  <View style={{ marginTop: 16, gap: 12 }}>
                    {resource.data?.slots
                      .filter((s) => s.doctor_id === doctor)
                      .map((slot) => (
                        <View key={slot.id} style={s.section}>
                          <T weight="bold">{date(slot.starts_at)}</T>
                          <T style={s.muted}>{slot.location}</T>
                          <CTA
                            title={ka ? "დაჯავშნა" : "Book"}
                            disabled={!allowed || busy}
                            onPress={() =>
                              Alert.alert(
                                ka
                                  ? "დაადასტურე ჯავშანი"
                                  : "Confirm appointment",
                                date(slot.starts_at),
                                [
                                  {
                                    text: ka ? "გაუქმება" : "Cancel",
                                    style: "cancel",
                                  },
                                  {
                                    text: ka ? "დაჯავშნა" : "Book",
                                    onPress: () =>
                                      void action({
                                        action: "book",
                                        id: slot.id,
                                      }),
                                  },
                                ],
                              )
                            }
                          />
                        </View>
                      ))}
                    {!resource.data?.slots.some(
                      (s) => s.doctor_id === doctor,
                    ) && (
                      <T>
                        {ka
                          ? "თავისუფალი დრო ჯერ არ არის."
                          : "No times available yet."}
                      </T>
                    )}
                  </View>
                )}
              </View>
            ))}
          {resource.data && !resource.data.doctors.length && (
            <T>
              {ka
                ? "ექიმები გამოჩნდებიან ადმინისტრატორის მიერ დამატების შემდეგ."
                : "Doctors appear once added by the administrator."}
            </T>
          )}
        </>
      )}
      {section === "bookings" && (
        <>
          {bookings.map((b) => (
            <View key={b.id} style={s.card}>
              <T weight="bold">{name(b.consultation_slots.doctor_id)}</T>
              <T>{date(b.consultation_slots.starts_at)}</T>
              <T style={s.muted}>
                {b.consultation_slots.location} ·{" "}
                {b.status === "cancelled"
                  ? ka
                    ? "გაუქმებული"
                    : "Cancelled"
                  : ka
                    ? "დადასტურებული"
                    : "Confirmed"}
              </T>
              {resource.data?.isDoctor && <T>{b.patient_label}</T>}
              {b.status === "confirmed" && (
                <CTA
                  light
                  disabled={busy}
                  title={ka ? "ჯავშნის გაუქმება" : "Cancel appointment"}
                  onPress={() =>
                    Alert.alert(
                      ka ? "გაუქმდეს ვიზიტი?" : "Cancel appointment?",
                      date(b.consultation_slots.starts_at),
                      [
                        { text: ka ? "დარჩენა" : "Keep", style: "cancel" },
                        {
                          text: ka ? "გაუქმება" : "Cancel appointment",
                          style: "destructive",
                          onPress: () =>
                            void action({ action: "cancel", id: b.id }),
                        },
                      ],
                    )
                  }
                />
              )}
            </View>
          ))}
          {resource.data && !bookings.length && (
            <T>{ka ? "ჯავშნები ჯერ არ გაქვს." : "No appointments yet."}</T>
          )}
        </>
      )}
      {section === "messages" && (
        <>
          <View style={s.wrap}>
            {threads.map((t) => (
              <Chip
                key={t.id}
                selected={thread === t.id}
                label={
                  (t.doctor_id === session.user.id ? t.patient_label : name(t.doctor_id)) +
                  (t.has_unread ? (ka ? " · წაუკითხავი" : " · Unread") : "")
                }
                onPress={() => {
                  setThread(t.id);
                  setText("");
                }}
              />
            ))}
          </View>
          {!threads.length && (
            <T>
              {isDoctor ? (ka ? "პაციენტების მიმოწერა ჯერ არ გაქვს." : "You have no patient conversations yet.") : ka
                ? "მიმოწერა ჯერ არ გაქვს. აირჩიე ექიმი."
                : "No conversations yet. Choose a doctor."}
            </T>
          )}
          {activeConversation && (
            <>
              <ResourceStatus {...messages} lang={lang} />
              {messages.data?.typing && <T>{isDoctor ? (ka ? "პაციენტი წერს…" : "Patient is typing…") : (ka ? "ექიმი წერს…" : "Doctor is typing…")}</T>}
              <T style={s.muted}>
                {ka
                  ? "შეტყობინებები გაგზავნიდან 48 საათში ავტომატურად იშლება. ჩატის არქივი არ ინახება."
                  : "Messages are automatically deleted 48 hours after sending. No chat archive is kept."}
              </T>
              {messages.data?.messages?.map((m) => (
                <View
                  key={m.id}
                  style={[
                    s.card,
                    {
                      marginTop: 8,
                      backgroundColor:
                        m.sender_id === session.user.id ? C.lav : C.white,
                    },
                  ]}
                >
                  <T weight="bold">
                    {m.sender_id === session.user.id
                      ? ka
                        ? "შენ"
                        : "You"
                      : resource.data?.threads.find((t) => t.id === thread)
                            ?.doctor_id === m.sender_id
                        ? `${ka ? "ექიმი" : "Dr"} ${name(m.sender_id)} ✓`
                        : ka
                          ? "პაციენტი"
                          : "Patient"}
                  </T>
                  <T selectable style={{ marginVertical: 8 }}>
                    {m.body}
                  </T>
                  <T style={s.muted}>{date(m.created_at)}</T>
                  {m.sender_id === session.user.id && <T style={s.muted}>{m.read_at ? (ka ? "წაკითხულია" : "Read") : m.delivered_at ? (ka ? "მივიდა" : "Delivered") : (ka ? "გაგზავნილია" : "Sent")}</T>}
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
    {activeConversation ? (
              <View testID="care-chat-composer" style={{ flexDirection: "row", alignItems: "flex-end", gap: 8,
                padding: 12, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.bg }}>
                <TextInput
                  style={[s.input, { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 96, paddingVertical: 10 }]}
                  accessibilityLabel={ka ? "შეტყობინება" : "Message"}
                  placeholder={ka ? "შეტყობინება" : "Message"}
                  multiline
                  maxLength={2000}
                  value={text}
                  onChangeText={(value) => {
                    setText(value);
                    if (typingTimer.current) clearTimeout(typingTimer.current);
                    typingTimer.current = setTimeout(() => {
                      if (AppState.currentState !== "active") return;
                      void api("/api/care", { body: { action: "typing", id: thread, typing: Boolean(value.trim()) }, userId: session.user.id }).catch(() => {});
                    }, 250);
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: sendDisabled }}
                  disabled={sendDisabled}
                  style={({ pressed }) => [s.cta, { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10,
                    opacity: sendDisabled || pressed ? 0.6 : 1 }]}
                  onPress={() => void action({ action: "message", id: thread, body: text.trim() })}
                >
                  <T weight="bold" style={{ color: C.white }}>{ka ? "გაგზავნა" : "Send"}</T>
                </Pressable>
              </View>
    ) : null}
    </View>
  );
}
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const phaseNames: Record<string, [string, string]> = {
  menstruation: ["მენსტრუაცია", "Menstruation"],
  follicular: ["ფოლიკულური", "Follicular"],
  ovulation: ["ოვულაცია", "Ovulation"],
  luteal: ["ლუთეალური", "Luteal"],
  unknown: ["უცნობი", "Unknown"],
};
export function ReportScreen({
  data,
  session,
  onNavigate,
}: {
  data: Data;
  session: Session;
  onNavigate: (tab: Tab) => void;
}) {
  const ka = data.lang === "ka",
    membership = useMembership(session.access_token, apiRoot),
    summary = healthReport(data),
    [busy, setBusy] = useState(false),
    [includeActivity, setIncludeActivity] = useState(false),
    [message, setMessage] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const label = (id: string) =>
    symptoms.find((s) => s[0] === id)?.[ka ? 1 : 2] || id;
  async function create() {
    setBusy(true);
    let uri: string | undefined;
    try {
      const member = await api("/api/payments/flitt/status", {
        userId: session.user.id,
      });
      if (!member.active)
        throw Error(ka ? "პრემიუმი არ არის აქტიური." : "Premium is inactive.");
      if (!alive.current) return;
      const rows = summary.cycles
        .map(
          (p) =>
            `<tr><td>${escape(p.start)}</td><td>${p.length}</td><td>${p.duration}</td><td>${p.irregular ? "&gt;7" : ""}</td></tr>`,
        )
        .join("");
      const html = `<!doctype html><html lang="${data.lang}"><meta charset="utf-8"><style>body{font:15px sans-serif;color:#1e1b2e;padding:20px}h1{font-size:28px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid #e3d8f1}.bar{background:#e3d8f1;height:12px}section{break-inside:avoid;margin:24px 0}</style><body><h1>TutaHealth · ${ka ? "ექიმისთვის ანგარიში" : "Doctor report"}</h1><p>${summary.from} / ${summary.today}</p><p>${ka ? "პირადი ინფორმაცია. ჩაწერილი მონაცემების შეჯამება, არა დიაგნოზი." : "Private information. Recorded data summary, not a diagnosis."}</p><section><h2>${ka ? "დასრულებული ციკლები" : "Completed cycles"}</h2><table><tr><th>${ka ? "დაწყება" : "Start"}</th><th>${ka ? "დღეები" : "Days"}</th><th>${ka ? "სისხლდენა" : "Bleeding"}</th><th>${ka ? "გადახრა" : "Deviation"}</th></tr>${rows}</table></section><section><h2>${ka ? "სიმპტომების სიხშირე (დღე)" : "Symptom frequency (days)"}</h2>${summary.symptoms.map((p) => `<p>${escape(label(p.name))}: ${p.count}</p><div class="bar" style="width:${Math.min(100, (p.count / Math.max(1, summary.logs)) * 100)}%"></div>`).join("")}</section><section><h2>${ka ? "სავარაუდო ფაზის საშუალო ხანგრძლივობა" : "Estimated average phase duration"}</h2>${summary.phases.map((p) => `<p>${escape(phaseNames[p.phase]?.[ka ? 0 : 1] || p.phase)}: ${p.days.toFixed(1)}</p>`).join("")}<p>${ka ? "ფაზები კლინიკურად დადასტურებული არ არის." : "Phases are not clinically confirmed."}</p></section></body></html>`;
      const activity = includeActivity ? healthReport(data, summary.today, true).sexualActivity : undefined;
      const activitySection = activity?.length
        ? `<section><h2>${ka ? "სქესობრივი აქტივობა" : "Sexual activity"}</h2>${activity.map(({ date, sexualActivity }) =>
            `<p>${escape(date)}: ${escape(sexualActivityOptions.find(([id]) => id === sexualActivity)![ka ? 1 : 2])}</p>`,
          ).join("")}</section>`
        : "";
      const file = await Print.printToFileAsync({ html: html.replace("</body>", `${activitySection}</body>`) });
      uri = file.uri;
      const current = await api("/api/payments/flitt/status", {
        userId: session.user.id,
      });
      if (!alive.current || !current.active) return;
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      else
        throw Error(
          ka ? "ფაილის გაზიარება მიუწვდომელია." : "File sharing unavailable.",
        );
    } catch (e) {
      if (alive.current)
        setMessage(e instanceof Error ? e.message : "Could not export PDF");
    } finally {
      if (uri)
        try {
          new File(uri).delete();
        } catch {
          /* The OS may already have removed this temporary export. */
        }
      if (alive.current) setBusy(false);
    }
  }
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "ექიმისთვის ანგარიში" : "Doctor report"}
      </T>
      <T style={s.muted}>
        {summary.from} / {summary.today}
      </T>
      {membership.active ? (
        <>
          <View style={s.card}>
            <FieldLabel>{ka ? "ბოლო 6 თვე" : "Last 6 months"}</FieldLabel>
            <T>
              {summary.cycles.length}{" "}
              {ka ? "დასრულებული ციკლი" : "completed cycles"} · {summary.logs}{" "}
              {ka ? "დღიური" : "check-ins"}
            </T>
          </View>
          {summary.cycles.map((p) => (
            <View key={p.start} style={s.section}>
              <T>
                {p.start} · {p.length} {ka ? "დღე" : "days"}
                {p.irregular ? " · >7" : ""}
              </T>
            </View>
          ))}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: includeActivity, disabled: busy }}
            disabled={busy} onPress={() => setIncludeActivity(value => !value)}
            style={{ minHeight: 48, justifyContent: "center" }}>
            <T>{includeActivity ? "☑ " : "☐ "}{ka ? "PDF-ში სქესობრივი აქტივობის დამატება" : "Include sexual activity in the PDF"}</T>
          </Pressable>
          <CTA
            disabled={busy}
            title={ka ? "PDF-ის შექმნა / გაზიარება" : "Create / share PDF"}
            onPress={() =>
              Alert.alert(
                ka
                  ? "პირადი ჯანმრთელობის ინფორმაცია"
                  : "Private health information",
                ka
                  ? "ფაილი დროებით შეიქმნება შენს ტელეფონზე და გაზიარების შემდეგ დროებითი ასლი წაიშლება. გააზიარე მხოლოდ სანდო პირთან."
                  : "A temporary file is created on your phone and removed after sharing. Share only with someone you trust.",
                [
                  { text: ka ? "გაუქმება" : "Cancel", style: "cancel" },
                  {
                    text: ka ? "გაგრძელება" : "Continue",
                    onPress: () => void create(),
                  },
                ],
              )
            }
          />
        </>
      ) : (
        <>
          <T>
            {membership.error
              ? ka
                ? "პრემიუმი ვერ შემოწმდა."
                : "Could not verify Premium."
              : ka
                ? "ექიმისთვის ანგარიში პრემიუმის ფუნქციაა."
                : "Doctor reports require Premium."}
          </T>
          <CTA light title="Premium" onPress={() => onNavigate("premium")} />
        </>
      )}
      {Boolean(message) && <T accessibilityRole="alert">{message}</T>}
    </View>
  );
}
export function CalculatorScreen({
  lang,
  ovulation = false,
}: {
  lang: Lang;
  ovulation?: boolean;
}) {
  const ka = lang === "ka", i = ka ? 0 : 1,
    [start, setStart] = useState(""),
    [length, setLength] = useState(28),
    [duration, setDuration] = useState(5),
    [calculated, setCalculated] = useState(false);
  const result = calculated ? calculateCycleEstimate(start, length, duration) : null;
  const format = (value: string) => formatCalculatorDate(value, ka);
  const message = !result ? null
    : result.status !== "estimated" ? calculatorMessages[result.status][i]
    : !ovulation ? `${ka ? "პერიოდის სავარაუდო დასაწყისი" : "Estimated period start"}: ${format(result.nextPeriod)}`
    : !result.fertility ? calculatorMessages.unavailable[i]
    : result.fertility.passed ? calculatorMessages.fertilityPassed[i]
    : `${ka ? "სავარაუდო ოვულაცია" : "Estimated ovulation"}: ${format(result.fertility.ovulation)}\n${ka ? "სავარაუდო ნაყოფიერი დღეები" : "Estimated fertile days"}: ${format(result.fertility.start)} – ${format(result.fertility.end)}`;
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ovulation
          ? ka
            ? "ოვულაციის კალკულატორი"
            : "Ovulation calculator"
          : ka
            ? "პერიოდის კალკულატორი"
            : "Period calculator"}
      </T>
      <T style={[s.muted, { marginBottom: 20 }]}>
        {ka
          ? "სასწავლო კალკულატორი. 28 დღე მხოლოდ საწყისი მაგალითია. შედეგი ჩანაწერებში არ ინახება და კონტრაცეფციისთვის არ გამოიყენება."
          : "Educational calculator. 28 days is only an initial example. Results are not saved and must not be used for contraception."}
      </T>
      <DateField
        ka={ka}
        label={ka ? "ბოლო პერიოდის დაწყება" : "Last period start"}
        value={start}
        onChange={(value) => { setStart(value); setCalculated(false); }}
      />
      <View style={{ gap: 12, marginVertical: 16 }}>
        <NumberWheel label={ka ? "ციკლის ხანგრძლივობა (დღე)" : "Cycle length (days)"} value={length} min={21} max={45} onChange={(n) => { setLength(n); setCalculated(false); }} ka={ka}/>
        <NumberWheel label={ka ? "სისხლდენის ხანგრძლივობა (დღე)" : "Bleeding duration (days)"} value={duration} min={1} max={10} onChange={(n) => { setDuration(n); setCalculated(false); }} ka={ka}/>
      </View>
      <CTA title={ka ? "გამოთვლა" : "Calculate"} onPress={() => setCalculated(true)} />
      {message ? (
        <View style={[s.card, { marginTop: 16 }]}>
          <T accessibilityLiveRegion="polite">{message}</T>
        </View>
      ) : null}
    </View>
  );
}
export function RemindersScreen({ data }: { data: Data }) {
  const [repeat, setRepeat] = useState<(typeof reminderRepeat)[number][0]>("next");
  const [lead, setLead] = useState<(typeof reminderLead)[number][0]>("12h");
  const ka = data.lang === "ka",
    model = forecast(
      data.periods,
      data.cycleLength,
      undefined,
      data.pregnancy?.active,
    ),
    [message, setMessage] = useState("");
  async function share() {
    const file = new File(Paths.cache, "tuta-reminders.ics");
    try {
      file.write(reminderCalendar(model.starts, { repeat, lead }));
      if (!(await Sharing.isAvailableAsync())) throw Error();
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/calendar",
        UTI: "com.apple.ical.ics",
      });
    } catch {
      setMessage(
        ka
          ? "კალენდრის გაზიარება ვერ მოხერხდა."
          : "Could not share the calendar.",
      );
    } finally {
      if (file.exists) file.delete();
    }
  }
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "შეხსენებები" : "Reminders"}
      </T>
      <T style={s.muted}>
        {ka
          ? "გადაიტანე სავარაუდო თარიღები პირად კალენდარში. მოვლენის სათაური ჯანმრთელობის დეტალებს არ შეიცავს."
          : "Export estimated dates to your personal calendar. Event titles contain no health details."}
      </T>
      <FieldLabel>{ka ? "რომელი თარიღები გადავიტანო?" : "Which dates should be exported?"}</FieldLabel>
      <View style={s.wrap}>{reminderRepeat.map(([value, ge, en]) => <Chip key={value} label={ka ? ge : en} selected={repeat === value} onPress={() => setRepeat(value)}/>)}</View>
      <FieldLabel>{ka ? "როდის გამახსენოს?" : "When should it remind me?"}</FieldLabel>
      <View style={s.wrap}>{reminderLead.map(([value, ge, en]) => <Chip key={value} label={ka ? ge : en} selected={lead === value} onPress={() => setLead(value)}/>)}</View>
      <T style={s.muted}>{ka ? "შეხსენება იმუშავებს ფაილის პირად კალენდარში შეტანის შემდეგ." : "Reminders work after importing the file into your personal calendar."}</T>
      <CTA
        title={ka ? "კალენდრის ფაილის გაზიარება" : "Share calendar file"}
        disabled={model.status !== "active"}
        onPress={() => void share()}
      />
      {model.status !== "active" && (
        <T>
          {ka
            ? "ჯერ საჭიროა მიმდინარე პერიოდის ისტორია. ორსულობისა და დაგვიანების დროს პროგნოზები შეჩერებულია."
            : "Current period history is needed. Estimates are paused during pregnancy or an overdue cycle."}
        </T>
      )}
      {Boolean(message) && <T accessibilityRole="alert">{message}</T>}
    </View>
  );
}

export function AnnouncementsScreen({ lang, userId }: { lang: Lang; userId: string }) {
  const ka = lang === "ka";
  const { data, error, loading, refresh } = useResource<{ rows: { id: string; title: string; body: string; scheduled_at: string; read_at: string | null }[] }>("/api/notifications", userId, 60_000);
  const [busy, setBusy] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  async function read(id: string) {
    if (busy) return;
    setBusy(true);
    setWriteFailed(false);
    try {
      await api("/api/notifications", { body: { id }, userId });
      await refresh();
    } catch {
      setWriteFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return <View style={s.content}>
    <T weight="display" style={s.title}>{ka ? "თუთას განცხადებები" : "Tuta announcements"}</T>
    {loading && !data ? <T>{ka ? "იტვირთება…" : "Loading…"}</T> : null}
    {error || writeFailed ? <View style={s.card}><T accessibilityRole="alert">{ka ? "განცხადებების განახლება ვერ მოხერხდა." : "Could not update announcements."}</T><CTA title={ka ? "ხელახლა ცდა" : "Retry"} onPress={() => { setWriteFailed(false); void refresh(); }}/></View> : null}
    {data?.rows.length === 0 ? <T>{ka ? "ჯერ განცხადებები არ არის." : "No announcements yet."}</T> : null}
    {data?.rows.map(row => <View key={row.id} style={[s.card, { backgroundColor: activityTones.info.background }]}>
      <View style={[s.row, { gap: 8 }]}>
        <T style={{ color: activityTones.info.color }} weight="bold" accessible={false}>i</T>
        <T weight={row.read_at ? undefined : "bold"} style={{ flex: 1 }}>{row.title}</T>
        {!row.read_at && <View accessibilityRole="image" accessibilityLabel={ka ? "წაუკითხავი" : "Unread"} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activityTones.info.color }}/>}
      </View>
      <T style={s.muted}>{new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Tbilisi" }).format(new Date(row.scheduled_at))}</T>
      <T>{row.body}</T>
      {row.read_at ? <T style={s.muted}>{ka ? "წაკითხულია" : "Read"}</T> : <CTA light disabled={busy} title={ka ? "წაკითხულად მონიშვნა" : "Mark as read"} onPress={() => void read(row.id)}/>}
    </View>)}
  </View>;
}
export function PlannedScreen({ lang, page, onNavigate }: { page: Tab } & Nav) {
  const ka = lang === "ka";
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {page === "account-deletion"
          ? ka
            ? "ანგარიშის წაშლა"
            : "Delete account"
          : ka
            ? "სიმპტომების განხილვა"
            : "Symptom review"}
      </T>
      <View style={s.banner}>
        <T>
          {page === "account-deletion"
            ? ka
              ? "ანგარიშის ავტომატური წაშლა ჯერ არ არის ჩართული. ამ გვერდზე არაფერი იშლება და მოთხოვნა არ იგზავნება."
              : "Automatic account deletion is not enabled. This page deletes nothing and does not submit a request."
            : ka
              ? "ავტომატური სამედიცინო შეფასება არ არის ჩართული. დღიური დიაგნოზს არ ადგენს. ექიმისთვის შეგიძლია ჩანაწერების ანგარიში მოამზადო."
              : "Automated medical assessment is not enabled. The journal does not diagnose. Prepare a report for your doctor instead."}
        </T>
      </View>
      <CTA
        light
        title={
          page === "account-deletion"
            ? ka
              ? "კონფიდენციალურობა"
              : "Privacy"
            : ka
              ? "ანგარიშის გახსნა"
              : "Open report"
        }
        onPress={() =>
          onNavigate(page === "account-deletion" ? "privacy" : "report")
        }
      />
    </View>
  );
}
