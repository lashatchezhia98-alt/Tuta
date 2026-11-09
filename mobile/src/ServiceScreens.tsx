import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useChatMessages, type ChatResponse } from "./useChatMessages";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import type { Session } from "@supabase/supabase-js";
import { C, T, s, CTA, Chip, DateField, FieldLabel } from "./ui";
import type { Data, Lang, Tab } from "./types";
import { api, apiRoot } from "./api";
import { checkoutInApp, openPaymentCheckout } from "./open-payment-checkout";
import { useResource } from "./useResource";
import { useMembership } from "./useMembership";
import { useFeatureEnabled } from "./useJourneyEnabled";
import { forecast, addDays, validSetup, predictions } from "./cycle.mjs";
import { healthReport, reminderCalendar } from "./health-report";
import { symptoms } from "./symptoms.mjs";
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
export function LibraryScreen({ lang }: Nav) {
  const ka = lang === "ka",
    resource = useResource<{
      articles: {
        id: string;
        title_ka: string;
        title_en: string;
        body_ka: string;
        body_en: string;
        category: string;
      }[];
    }>("/api/library");
  const [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState("");
  const categories = [
    ["cycle", "პერიოდი", "Period"],
    ["pregnancy", "ორსულობა", "Pregnancy"],
    ["nutrition", "კვება", "Nutrition"],
    ["mental-health", "ემოციური ჯანმრთელობა", "Mental wellbeing"],
  ];
  const article = resource.data?.articles.find((a) => a.id === selected);
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
              {ka ? article.title_ka : article.title_en}
            </T>
            <T selectable style={{ lineHeight: 28 }}>
              {ka ? article.body_ka : article.body_en}
            </T>
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
            {categories.map(([id, a, b]) => (
              <Chip
                key={id}
                label={ka ? a : b}
                selected={category === id}
                onPress={() => setCategory(id)}
              />
            ))}
          </View>
          {resource.data?.articles
            .filter(
              (a) =>
                (!category || category === a.category) &&
                `${a.title_ka} ${a.title_en}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() => setSelected(a.id)}
                style={s.card}
              >
                <T style={s.muted}>
                  {categories.find((c) => c[0] === a.category)?.[ka ? 1 : 2]}
                </T>
                <T weight="bold" style={{ fontSize: 20, marginVertical: 12 }}>
                  {ka ? a.title_ka : a.title_en}
                </T>
                <T>{ka ? "წაკითხვა →" : "Read →"}</T>
              </Pressable>
            ))}
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
    membership = useResource<{ active: boolean; expiresAt: string | null }>(
      "/api/payments/flitt/status",
      session.user.id,
      30000,
    );
  const [plan, setPlan] = useState("yearly"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  async function checkout() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/payments/flitt/checkout", {
        body: { plan, ...(checkoutInApp ? { returnTo: "app" } : {}) },
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
    } finally {
      if (alive.current) setBusy(false);
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
      <View style={s.card}>
        <FieldLabel>{ka ? "უფასო" : "Free"}</FieldLabel>
        <T>
          {ka
            ? "პერიოდის კალენდარი, დღიური, ციკლების ისტორია და საზოგადოების პოსტები."
            : "Period calendar, daily journal, cycle history and member community."}
        </T>
      </View>
      <View style={s.card}>
        <FieldLabel>Premium</FieldLabel>
        <T>
          {ka
            ? "განმეორებადი სიმპტომების ანალიზი, ექიმისთვის ანგარიში, ორსულობის აღრიცხვა, პარტნიორთან გაზიარება და ექიმთან ჩატი/ჯავშანი, როცა ექიმები ხელმისაწვდომია."
            : "Recurring symptom patterns, doctor reports, pregnancy tracking, partner sharing and doctor chat/booking when doctors are available."}
        </T>
      </View>
      <View style={s.banner}>
        <T weight="bold">
          {ka ? "მხოლოდ სატესტო გადახდა" : "Test checkout only"}
        </T>
        <T style={s.muted}>
          {ka
            ? "რეალური გამოწერის გაყიდვა არ არის ჩართული. ავტომატური განახლება არ ხდება."
            : "Real subscription sales are not enabled. No automatic renewal."}
        </T>
      </View>
      <View style={[s.wrap, { marginBottom: 16 }]}>
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
      <CTA
        title={ka ? "სატესტო გადახდის გახსნა" : "Open test checkout"}
        disabled={busy}
        onPress={() => void checkout()}
      />
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
  slots: Slot[];
  threads: {
    id: string;
    doctor_id: string;
    patient_id: string;
    patient_label: string;
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
export function CareScreen({
  lang,
  session,
  onNavigate,
}: Nav & { session: Session }) {
  const ka = lang === "ka",
    resource = useResource<Care>("/api/care", session.user.id, 30000),
    feature = useFeatureEnabled("doctorConsultation");
  const [section, setSection] = useState("doctors"),
    [doctor, setDoctor] = useState(""),
    [thread, setThread] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const loadMessages = useCallback(
    () =>
      api<ChatResponse>("/api/care?thread=" + thread, {
        userId: session.user.id,
      }),
    [thread, session.user.id],
  );
  const messages = useChatMessages(
    thread ? `${session.user.id}:${thread}` : "",
    loadMessages,
  );
  const alive = useRef(true);
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
        setText("");
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
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {ka ? "ექიმები და კონსულტაცია" : "Doctors & care"}
      </T>
      <T style={s.muted}>
        {ka
          ? "ეს არ არის გადაუდებელი დახმარების სერვისი. ექიმი შენს დღიურს ავტომატურად ვერ ხედავს."
          : "Not an emergency service. Doctors cannot automatically view your journal."}
      </T>
      <ResourceStatus {...resource} lang={lang} />
      <View style={[s.wrap, { marginBottom: 18 }]}>
        {[
          ["doctors", "ექიმები", "Doctors"],
          ["messages", "ჩატი", "Chat"],
          ["bookings", "ჩემი ვიზიტები", "My visits"],
        ].map(([id, a, b]) => (
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
          {resource.data?.bookings.map((b) => (
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
          {resource.data && !resource.data.bookings.length && (
            <T>{ka ? "ჯავშნები ჯერ არ გაქვს." : "No appointments yet."}</T>
          )}
        </>
      )}
      {section === "messages" && (
        <>
          <View style={s.wrap}>
            {resource.data?.threads.map((t) => (
              <Chip
                key={t.id}
                selected={thread === t.id}
                label={
                  t.doctor_id === session.user.id
                    ? t.patient_label
                    : name(t.doctor_id)
                }
                onPress={() => {
                  setThread(t.id);
                  setText("");
                }}
              />
            ))}
          </View>
          {!resource.data?.threads.length && (
            <T>
              {ka
                ? "მიმოწერა ჯერ არ გაქვს. აირჩიე ექიმი."
                : "No conversations yet. Choose a doctor."}
            </T>
          )}
          {Boolean(thread) && (
            <>
              <ResourceStatus {...messages} lang={lang} />
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
                </View>
              ))}
              <TextInput
                style={[s.input, { minHeight: 100, marginVertical: 12 }]}
                accessibilityLabel={
                  ka ? "ექიმისთვის შეტყობინება" : "Message your doctor"
                }
                multiline
                maxLength={2000}
                value={text}
                onChangeText={setText}
              />
              <CTA
                disabled={
                  busy ||
                  !text.trim() ||
                  feature.status !== "enabled" ||
                  (!resource.data?.premium && !resource.data?.isDoctor)
                }
                title={ka ? "გაგზავნა" : "Send"}
                onPress={() =>
                  void action({
                    action: "message",
                    id: thread,
                    body: text.trim(),
                  })
                }
              />
            </>
          )}
        </>
      )}
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
      const file = await Print.printToFileAsync({ html });
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
  const ka = lang === "ka",
    [start, setStart] = useState(""),
    [length, setLength] = useState("28"),
    [duration, setDuration] = useState("5"),
    [result, setResult] = useState("");
  function calculate() {
    if (!validSetup(start, Number(length), Number(duration))) {
      setResult(
        ka
          ? "შეამოწმე ველები: ციკლი 21–45, სისხლდენა 1–10 დღე."
          : "Check fields: cycle 21–45, bleeding 1–10 days.",
      );
      return;
    }
    const next = addDays(start, Number(length)),
      ov = addDays(next, -14);
    setResult(
      ovulation
        ? `${ka ? "სავარაუდო ოვულაცია" : "Estimated ovulation"}: ${ov}\n${ka ? "სავარაუდო ნაყოფიერი დღეები" : "Estimated fertile days"}: ${addDays(ov, -5)} / ${addDays(ov, 1)}`
        : `${ka ? "შემდეგი პერიოდის ვარაუდი" : "Next period estimate"}: ${next}`,
    );
  }
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
        onChange={setStart}
      />
      <View style={{ gap: 12, marginVertical: 16 }}>
        <FieldLabel>{ka ? "ციკლის ხანგრძლივობა" : "Cycle length"}</FieldLabel>
        <TextInput
          accessibilityLabel={ka ? "ციკლის ხანგრძლივობა" : "Cycle length"}
          keyboardType="number-pad"
          value={length}
          onChangeText={setLength}
          style={s.input}
        />
        <FieldLabel>{ka ? "სისხლდენის დღეები" : "Bleeding days"}</FieldLabel>
        <TextInput
          accessibilityLabel={ka ? "სისხლდენის დღეები" : "Bleeding days"}
          keyboardType="number-pad"
          value={duration}
          onChangeText={setDuration}
          style={s.input}
        />
      </View>
      <CTA title={ka ? "გამოთვლა" : "Calculate"} onPress={calculate} />
      {result && (
        <View style={[s.card, { marginTop: 16 }]}>
          <T accessibilityLiveRegion="polite">{result}</T>
        </View>
      )}
    </View>
  );
}
export function RemindersScreen({ data }: { data: Data }) {
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
      file.write(reminderCalendar(predictions(data.periods, data.cycleLength)));
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
          ? "ავტომატური push შეტყობინებები ჯერ არ იგზავნება. შეგიძლია სავარაუდო თარიღები კალენდარში გადაიტანო. სათაური არ შეიცავს ჯანმრთელობის დეტალებს."
          : "Automatic push notifications are not enabled yet. Export estimated dates to your calendar. Event titles contain no health details."}
      </T>
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
