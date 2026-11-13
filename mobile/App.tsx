import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Fredoka_600SemiBold } from "@expo-google-fonts/fredoka/600SemiBold";
import { NotoSansGeorgian_400Regular } from "@expo-google-fonts/noto-sans-georgian/400Regular";
import { NotoSansGeorgian_700Bold } from "@expo-google-fonts/noto-sans-georgian/700Bold";
import { Icon, MoonFlower, Face, CycleOrbit } from "./src/Art";
import { C, T, CTA, Chip, DateField, FieldLabel, NumberWheel, Scale, s } from "./src/ui";
import PasswordInput from "./src/PasswordInput";
import { PeriodDaysPicker } from "./src/PeriodDaysPicker";
import EmailCodeScreen from "./src/EmailCodeScreen";
import { EMAIL_RESEND_WAIT_MS, emailNotConfirmed } from "./src/email-verification.mjs";
import type { PendingEmail } from "./src/use-email-verification";
import { Data, Log, Tab, emptyData, validData } from "./src/types";
import {
  dateKey,
  stamp,
  addDays,
  validSetup,
  periodFromSelectedDays,
  validBirthDate,
  cycleAt,
  calendarState,
  averages,
  predictions,
  forecast,
  distance,
  monthLabel,
  symptomPatterns,
} from "./src/cycle.mjs";
import { isSupabaseConfigured, supabase } from "./src/supabase";
import { EMPTY_SOCIAL_LINKS, type SocialLinks, type SocialPlatform } from "./src/site-social-links";
import type { Session } from "@supabase/supabase-js";
import { CommunityFeed } from "./src/CommunityFeed";
import { AppMenu, MenuPage } from "./src/MenuPages";
import { PregnancyScreen, PartnerScreen } from "./src/HealthFeatureScreens";
import { CycleEducation, GuidedJourney } from "./src/CycleSupport";
import { overlapsPeriod } from "./src/cycle.mjs";
import {
  initialTab,
  mainTabs,
  primaryTab,
  pageAllowed,
  visibleDestinations,
} from "./src/navigation.mjs";
import { useAppFeatures } from "./src/useJourneyEnabled";
import {
  ServicesScreen,
  PeriodNavigation,
  PageHeading,
  FeatureUnavailable,
  ScreenLinks,
} from "./src/NavigationScreens";
import {
  CareScreen,
  LibraryScreen,
  PremiumScreen,
  ReportScreen,
  CalculatorScreen,
  RemindersScreen,
  PlannedScreen,
} from "./src/ServiceScreens";
import {
  CartProvider,
  MarketScreen,
  CartScreen,
  OrdersScreen,
} from "./src/MarketScreens";
import { useMembership } from "./src/useMembership";
import { apiRoot } from "./src/api";
import { parsePaymentReturn } from "./src/payment-return.mjs";

const KEY = "tuta.mobile.v1";
const moods = [
  ["happy", "ბედნიერი", "Happy"],
  ["calm", "მშვიდი", "Calm"],
  ["low", "სევდიანი", "Low"],
  ["tense", "დაძაბული", "Tense"],
  ["tired", "დაღლილი", "Tired"],
];
import { symptoms } from "./src/symptoms.mjs";
const phases: Record<string, [string, string]> = {
  menstruation: ["მენსტრუაცია", "Period"],
  follicular: ["ფოლიკულური", "Follicular"],
  ovulation: ["ოვულაცია", "Ovulation"],
  luteal: ["ლუთეალური", "Luteal"],
  unknown: ["ფაზა უცნობია", "Phase unknown"],
};
const tabs = mainTabs as [Tab, string, string][];
type Shared = {
  data: Data;
  save: (d: Data) => Promise<boolean>;
  birthDate?: string;
};

export default function App() {
  const [fonts, error] = useFonts({
    Display: Fredoka_600SemiBold,
    Body: NotoSansGeorgian_400Regular,
    BodyBold: NotoSansGeorgian_700Bold,
  });
  if (!fonts && !error)
    return (
      <View style={[s.root, { justifyContent: "center" }]}>
        <ActivityIndicator color={C.ink} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <CartProvider>
        <Shell />
      </CartProvider>
    </SafeAreaProvider>
  );
}
function Shell() {
  const [data, setData] = useState<Data>(emptyData),
    [ready, setReady] = useState(false),
    [problem, setProblem] = useState("");
  const [legacy, setLegacy] = useState<Data | null>(null),
    [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab),
    [logDate, setLogDate] = useState(dateKey()),
    [calendarDate, setCalendarDate] = useState(dateKey()),
    [calendarEditing, setCalendarEditing] = useState(false),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<Tab | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [authMode, setAuthMode] = useState<
      "login" | "register" | "forgot" | "reset" | null
    >(null),
    [authBusy, setAuthBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const features = useAppFeatures();
  const [trail, setTrail] = useState<Tab[]>([]);
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const headerWidth = Math.min(width, 520) - insets.left - insets.right;
  const stackedHeader = headerWidth < 300 + 180 * Math.max(0, fontScale - 1);
  const scroll = useRef<ScrollView>(null);
  const saving = useRef(false);
  const handledAuthLink = useRef<string | null>(null);
  const handledPaymentLink = useRef<string | null>(null);
  const revision = useRef<number | null>(null);
  const activeUser = useRef<string | null>(null);
  const epoch = useRef(0),
    readSequence = useRef(0),
    saveToken = useRef(0),
    healthError = useRef(false);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab, data.periods.length === 0]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [authMode]);
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true,
      observed = false;
    const accept = (next: Session | null) => {
      if (!alive) return;
      const id = next?.user.id ?? null;
      if (id !== activeUser.current) {
        epoch.current++;
        readSequence.current++;
        saveToken.current++;
        saving.current = false;
        activeUser.current = id;
        revision.current = null;
        setData(emptyData);
        setLegacy(null);
        setLoadedUser(null);
        setDirty(false);
        setPending(null);
        setProblem("");
        setReady(!next);
      }
      setSession(next);
    };
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!observed) accept(session);
      })
      .catch(() => {
        if (alive)
          setProblem("ანგარიში ვერ ჩაიტვირთა / Could not load account");
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      observed = true;
      accept(next);
      if (event === "PASSWORD_RECOVERY") setAuthMode("reset");
      else if (next) setAuthMode((mode) => (mode === "reset" ? mode : null));
    });
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase!.auth.startAutoRefresh();
      else supabase!.auth.stopAutoRefresh();
    });
    if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
    return () => {
      alive = false;
      epoch.current++;
      readSequence.current++;
      subscription.unsubscribe();
      foreground.remove();
      supabase!.auth.stopAutoRefresh();
    };
  }, []);
  const refresh = useCallback(async (userId: string) => {
    if (!supabase) return;
    const generation = epoch.current,
      request = ++readSequence.current;
    const { data: row, error } = await supabase
      .from("health_state")
      .select("payload,revision")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (
      activeUser.current !== userId ||
      generation !== epoch.current ||
      request !== readSequence.current
    )
      return;
    healthError.current = false;
    setProblem("");
    if (row) {
      if (!validData(row.payload)) throw new Error("Invalid health data");
      setData(row.payload);
      revision.current = Number(row.revision);
    } else {
      setData(emptyData);
      revision.current = null;
    }
  }, []);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      activeUser.current = null;
      revision.current = null;
      setData(emptyData);
      setLegacy(null);
      setLoadedUser(null);
      return;
    }
    activeUser.current = userId;
    let active = true;
    setReady(false);
    setProblem("");
    void (async () => {
      try {
        await refresh(userId);
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (
            validData(parsed) &&
            (parsed.periods.length > 0 || parsed.logs.length > 0) &&
            active
          )
            setLegacy(parsed);
          else await AsyncStorage.removeItem(KEY);
        }
      } catch {
        if (active) {
          healthError.current = true;
          setProblem(
            "მონაცემთა ბაზასთან კავშირი ვერ დამყარდა. სცადე ხელახლა. / Could not load your records. Please retry.",
          );
        }
      } finally {
        if (active) {
          setLoadedUser(userId);
          setReady(true);
        }
      }
    })();
    const channel = supabase!
      .channel(`health-state-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "health_state",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (active && !saving.current) void refresh(userId).catch(() => {});
        },
      )
      .subscribe();
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active" && active && !saving.current)
        void refresh(userId).catch(() => {});
    });
    return () => {
      active = false;
      foreground.remove();
      void supabase!.removeChannel(channel);
    };
  }, [session?.user.id, refresh]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const receive = async (url: string | null) => {
      if (
        !active ||
        !url ||
        !url.startsWith("com.tutahealth.app://auth-callback") ||
        handledAuthLink.current === url
      )
        return;
      handledAuthLink.current = url;
      try {
        const fragment = url.split("#")[1] || "";
        const params = new URLSearchParams(fragment || url.split("?")[1] || "");
        if (params.get("error")) throw new Error("Auth link error");
        const access_token = params.get("access_token"),
          refresh_token = params.get("refresh_token");
        if (!access_token || !refresh_token)
          throw new Error("Missing auth tokens");
        const { error } = await supabase!.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;
        if (active)
          setAuthMode(params.get("type") === "recovery" ? "reset" : null);
      } catch {
        if (active)
          setProblem(
            "ელფოსტის ბმული არასწორია ან ვადა გაუვიდა. / Email link is invalid or expired.",
          );
      }
    };
    void Linking.getInitialURL()
      .then(receive)
      .catch(() => {});
    const listener = Linking.addEventListener("url", (event) => {
      void receive(event.url);
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  const save = async (next: Data) => {
    if (!session || !supabase) {
      setAuthMode("login");
      return false;
    }
    if (saving.current || healthError.current || loadedUser !== session.user.id)
      return false;
    const generation = epoch.current,
      token = ++saveToken.current;
    saving.current = true;
    try {
      if (!validData(next)) throw new Error("Invalid health data");
      const userId = session.user.id;
      let row;
      if (revision.current === null) {
        const result = await supabase
          .from("health_state")
          .insert({ user_id: userId, payload: next, revision: 1 })
          .select("revision")
          .single();
        row = result.data;
        if (result.error) throw result.error;
      } else {
        const result = await supabase
          .from("health_state")
          .update({
            payload: next,
            revision: revision.current + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("revision", revision.current)
          .select("revision")
          .maybeSingle();
        row = result.data;
        if (result.error) throw result.error;
      }
      if (generation !== epoch.current || activeUser.current !== userId)
        return false;
      if (!row) {
        await refresh(userId);
        if (generation === epoch.current)
          setProblem(
            "ჩანაწერი სხვა მოწყობილობაზე შეიცვალა. მონაცემები განახლდა; სცადე თავიდან. / Records changed elsewhere. Review the latest data and retry.",
          );
        return false;
      }
      revision.current = Number(row.revision);
      setData(next);
      setProblem("");
      return true;
    } catch {
      if (generation === epoch.current)
        setProblem(
          "ბაზაში შენახვა ვერ მოხერხდა. შეამოწმე ინტერნეტი და სცადე ხელახლა. / Could not save to the database. Check your connection and retry.",
        );
      return false;
    } finally {
      if (token === saveToken.current) saving.current = false;
    }
  };
  const importLegacy = async () => {
    if (!legacy) return;
    const merged: Data = {
      ...data,
      name: data.name || legacy.name,
      periods: [
        ...data.periods,
        ...legacy.periods.filter(
          (p) => !data.periods.some((current) => current.start === p.start),
        ),
      ].sort((a, b) => a.start.localeCompare(b.start)),
      logs: [
        ...data.logs,
        ...legacy.logs.filter(
          (log) => !data.logs.some((current) => current.date === log.date),
        ),
      ].sort((a, b) => a.date.localeCompare(b.date)),
    };
    if (await save(merged)) {
      await AsyncStorage.removeItem(KEY);
      setLegacy(null);
    }
  };
  const ka = data.lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const nav = (next: Tab) => {
    if (next === tab) return;
    if (tab === "log" && dirty) {
      setPending(next);
      return;
    }
    setTrail((history) => [...history.slice(-19), tab]);
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const receivePaymentReturn = (url: string | null) => {
    const target = parsePaymentReturn(url);
    if (!target || url === handledPaymentLink.current) return;
    handledPaymentLink.current = url;
    setMenuOpen(false);
    nav(target);
  };
  const receiveExternalPaymentReturn = useEffectEvent(receivePaymentReturn);
  useEffect(() => {
    let active = true;
    void Linking.getInitialURL().then((url) => {
      if (active) receiveExternalPaymentReturn(url);
    }).catch(() => {});
    const listener = Linking.addEventListener("url", ({ url }) =>
      receiveExternalPaymentReturn(url),
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  const back = () => {
    const parent = primaryTab(tab);
    const target = trail.at(-1) || ((parent === tab ? initialTab : parent) as Tab);
    if (tab === "log" && dirty) {
      setPending(target);
      return;
    }
    setTrail((history) => history.slice(0, -1));
    setTab(target);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (authMode) {
        setAuthMode(null);
        return true;
      }
      if (tab === initialTab) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [tab, dirty, trail, menuOpen, authMode]);
  const openLog = (date = dateKey()) => {
    setLogDate(date);
    nav("log");
  };
  const openCalendar = (date = dateKey(), editing = false) => {
    setCalendarDate(date);
    setCalendarEditing(editing);
    nav("calendar");
  };
  const renderPage = () => {
    if (!pageAllowed(tab, features.features))
      return (
        <FeatureUnavailable
          lang={data.lang}
          status={features.status === "ready" ? "disabled" : features.status}
          retry={() => void features.retry()}
        />
      );
    const props = { lang: data.lang, onNavigate: nav };
    if (tab === "home")
      return (
        <CommunityFeed
          lang={data.lang}
          session={session}
          onSignIn={() => setAuthMode("login")}
        />
      );
    if (tab === "services") return <ServicesScreen {...props} />;
    if (["about", "privacy", "terms"].includes(tab))
      return (
        <MenuPage
          page={tab as "about" | "privacy" | "terms"}
          lang={data.lang}
        />
      );
    if (tab === "blog") return <LibraryScreen {...props} />;
    if (tab === "market") return <MarketScreen {...props} />;
    if (tab === "cart") return <CartScreen {...props} session={session} onPaymentReturn={receivePaymentReturn} />;
    if (tab === "period-calculator" || tab === "ovulation-calculator")
      return (
        <CalculatorScreen
          lang={data.lang}
          ovulation={tab === "ovulation-calculator"}
        />
      );
    if (tab === "symptom-checker" || tab === "account-deletion")
      return <PlannedScreen {...props} page={tab} />;
    if (!session)
      return (
        <View style={s.content}>
          <T weight="display" style={s.title}>
            {t("შედი შენს ანგარიშში", "Sign in to your account")}
          </T>
          <T style={[s.muted, { marginBottom: 20 }]}>
            {t(
              "პირადი ჩანაწერები შენს ანგარიშში ინახება და ვებსაიტთან სინქრონდება.",
              "Your private records are saved to your account and synced with the website.",
            )}
          </T>
          <CTA
            title={t("შესვლა ან რეგისტრაცია", "Sign in or create account")}
            onPress={() => setAuthMode("login")}
          />
        </View>
      );
    if (tab === "care") return <CareScreen {...props} session={session} />;
    if (tab === "orders") return <OrdersScreen {...props} session={session} />;
    if (tab === "premium")
      return <PremiumScreen {...props} session={session} onPaymentReturn={receivePaymentReturn} />;
    if (tab === "profile")
      return (
        <Profile
          data={data}
          save={save}
          birthDate={session.user.user_metadata?.date_of_birth}
          session={session}
          authEnabled={isSupabaseConfigured}
          authBusy={authBusy}
          setAuthBusy={setAuthBusy}
          onNavigate={nav}
        />
      );
    if (healthError.current)
      return (
        <View style={s.content}>
          <T>
            {t(
              "ჯანმრთელობის ჩანაწერები ვერ ჩაიტვირთა.",
              "Could not load your health entries.",
            )}
          </T>
          <CTA
            light
            title={t("ხელახლა ცდა", "Retry")}
            onPress={() => void refresh(session.user.id).catch(() => {})}
          />
        </View>
      );
    if (tab === "pregnancy")
      return (
        <PregnancyScreen
          data={data}
          save={save}
          token={session.access_token}
          onPremium={() => nav("premium")}
        />
      );
    if (tab === "partners")
      return <PartnerScreen data={data} token={session.access_token} />;
    if (tab === "journey")
      return <GuidedJourney data={data} onNavigate={nav} />;
    if (tab === "report")
      return <ReportScreen data={data} session={session} onNavigate={nav} />;
    if (tab === "notifications") return <RemindersScreen data={data} />;
    if (needsSetup && ["cycle", "calendar"].includes(tab))
      return (
        <Setup
          data={data}
          save={save}
          birthDate={session.user.user_metadata?.date_of_birth}
        />
      );
    if (tab === "cycle")
      return (
        <Home
          data={data}
          openCalendar={openCalendar}
          openPregnancy={() => nav("pregnancy")}
          birthDate={session.user.user_metadata?.date_of_birth}
        />
      );
    if (tab === "calendar")
      return (
        <Calendar
          key={`${calendarDate}-${calendarEditing}`}
          initialDate={calendarDate}
          initiallyEditing={calendarEditing}
          data={data}
          save={save}
          openLog={openLog}
        />
      );
    if (tab === "log")
      return (
        <Daily
          key={logDate}
          data={data}
          save={save}
          date={logDate}
          dirty={setDirty}
        />
      );
    if (tab === "insights")
      return (
        <Insights
          data={data}
          birthDate={session.user.user_metadata?.date_of_birth}
          token={session.access_token}
          onPremium={() => nav("premium")}
        />
      );
    return <ServicesScreen {...props} />;
  };
  if (!ready || (session && loadedUser !== session.user.id))
    return (
      <View style={[s.root, { justifyContent: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  const needsSetup = data.periods.length === 0 && !data.pregnancy?.active;
  return (
    <View style={s.root}>
      <View style={s.frame}>
        <StatusBar style="dark" />
        <SafeAreaView
          edges={["top", "left", "right"]}
          style={{ flex: 1, backgroundColor: C.bg }}
        >
          <View style={[s.header, stackedHeader && { flexWrap: "wrap" }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("საზოგადოების მთავარი", "Community home")}
              style={[s.row, { minHeight: 44, flexShrink: 0 }]}
              onPress={() => {
                setAuthMode(null);
                nav("home");
              }}
            >
              <Image
                source={require("./assets/app-icon.png")}
                style={{ width: 36, height: 36, borderRadius: 12 }}
              />
              <T weight="display" numberOfLines={1} style={{ fontSize: 25 }}>
                {ka ? "თუთა" : "TUTA"}
              </T>
            </Pressable>
            {!authMode && (
              <View style={[s.row, { marginLeft: "auto" }]}>
                {!session && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("ავტორიზაცია", "Sign in or register")}
                    onPress={() => setAuthMode("login")}
                    style={[
                      s.chip,
                      {
                        minWidth: 60,
                        minHeight: 44,
                        paddingHorizontal: 8,
                        alignItems: "center",
                        backgroundColor: C.yellow,
                      },
                    ]}
                  >
                    <T weight="bold" numberOfLines={1} style={{ fontSize: 14, textAlign: "center" }}>
                      {t("ავტორიზაცია", "Sign in")}
                    </T>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("მენიუს გახსნა", "Open menu")}
                  onPress={() => setMenuOpen(true)}
                  style={s.round}
                >
                  <Icon name="menu" />
                </Pressable>
              </View>
            )}
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
          {problem ? (
            <View style={[s.banner, { marginHorizontal: 20 }]}>
              <T accessibilityRole="alert">{problem}</T>
            </View>
          ) : null}
          {legacy && session ? (
            <View style={[s.banner, { marginHorizontal: 20 }]}>
              <T>
                {t(
                  "ამ ტელეფონზე ძველი ჩანაწერები მოიძებნა. გადაიტანე შენს ანგარიშში; წარმატებული გადატანის შემდეგ მოწყობილობიდან წაიშლება.",
                  "Older entries were found on this phone. Import them into your account; they will be removed from the device only after a successful save.",
                )}
              </T>
              <CTA
                title={t("ჩანაწერების გადატანა", "Import entries")}
                onPress={() => void importLegacy()}
              />
            </View>
          ) : null}
          {pending ? (
            <View style={[s.banner, { marginHorizontal: 20 }]}>
              <T>
                {t(
                  "შენიშვნები ჯერ არ შეგინახავს. გახვიდე?",
                  "Your changes are not saved. Leave this page?",
                )}
              </T>
              <View style={[s.wrap, { marginTop: 12 }]}>
                <Chip
                  label={t("დარჩენა", "Stay")}
                  selected
                  onPress={() => setPending(null)}
                />
                <Chip
                  label={t("გასვლა", "Discard")}
                  selected={false}
                  onPress={() => {
                    setDirty(false);
                    setTab(pending);
                    setPending(null);
                  }}
                />
              </View>
            </View>
          ) : null}
              {authMode ? (
                <AuthScreen
                  kind={authMode}
                  lang={data.lang}
                  busy={authBusy}
                  setBusy={setAuthBusy}
                  back={() => setAuthMode(null)}
                  forgot={() => setAuthMode("forgot")}
                  login={() => setAuthMode("login")}
                  register={() => setAuthMode("register")}
                />
              ) : (
                <View key={session?.user.id || "guest"}>
                  {primaryTab(tab) === "cycle" ? (
                    <PeriodNavigation
                      lang={data.lang}
                      selected={tab}
                      onNavigate={nav}
                    />
                  ) : (
                    !tabs.some(([id]) => id === tab) && (
                      <PageHeading lang={data.lang} page={tab} onBack={back} />
                    )
                  )}
                  <View key={tab}>{renderPage()}</View>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          {!authMode && (
            <View
              style={[s.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}
            >
              {tabs
                .filter(([id]) =>
                  id === "cycle"
                    ? visibleDestinations("cycle", features.features).length > 0
                    : id === "home"
                      ? features.features.community === true
                      : id === "market"
                        ? features.features.market === true
                        : true,
                )
                .map(([id, geo, en]) => (
                  <Pressable
                    key={id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: primaryTab(tab) === id }}
                    accessibilityLabel={id === "home" ? t("საზოგადოება", "Community") : t(geo, en)}
                    onPress={() =>
                      nav(
                        id === "cycle" &&
                          !pageAllowed("cycle", features.features)
                          ? (visibleDestinations("cycle", features.features)[0]
                              .id as Tab)
                          : id,
                      )
                    }
                    style={s.navItem}
                  >
                    <View
                      style={[
                        s.navIcon,
                        primaryTab(tab) === id && { backgroundColor: C.yellow },
                      ]}
                    >
                      <Icon name={id === "home" ? "communityStars" : id === "cycle" ? "periodMoon" : id} />
                    </View>
                    {id !== "home" && <T
                      weight={primaryTab(tab) === id ? "bold" : "regular"}
                      style={{
                        fontSize: ka ? 11 : 12,
                        textAlign: "center",
                        alignSelf: "stretch",
                      }}
                    >
                      {t(geo, en)}
                    </T>}
                  </Pressable>
                ))}
            </View>
          )}
          <AppMenu
            visible={menuOpen}
            lang={data.lang}
            showSettings={!session}
            onClose={() => setMenuOpen(false)}
            onNavigate={nav}
            onLanguage={() => {
              if (session) void save({ ...data, lang: ka ? "en" : "ka" });
              else setData({ ...data, lang: ka ? "en" : "ka" });
              setMenuOpen(false);
            }}
          />
        </SafeAreaView>
      </View>
    </View>
  );
}

function Setup({
  data,
  save,
  editing = false,
  birthDate,
}: { editing?: boolean } & Shared) {
  const ka = data.lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const latest = editing ? data.periods.at(-1) : undefined;
  const [days, setDays] = useState(() =>
      latest ? Array.from({ length: latest.duration }, (_, index) => addDays(latest.start, index)) : [],
    ),
    [length, setLength] = useState(String(data.cycleLength)),
    [name, setName] = useState(data.name),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async () => {
    if (data.pregnancy?.active) {
      setMessage(
        t(
          "პერიოდის დასამატებლად ჯერ გამორთე ორსულობის რეჟიმი.",
          "Turn off pregnancy mode before logging a period.",
        ),
      );
      return;
    }
    const period = periodFromSelectedDays(days);
    if (!period || !validSetup(period.start, Number(length), period.duration)) {
      setMessage(
        t(
          "მონიშნე სისხლდენის 1–10 ზედიზედ დღე და აირჩიე ციკლის ხანგრძლივობა.",
          "Select 1–10 consecutive bleeding days and choose your cycle length.",
        ),
      );
      return;
    }
    const { start } = period;
    if (
      overlapsPeriod(
        data.periods,
        period,
        latest?.start ?? start,
      )
    ) {
      setMessage(
        t(
          "სისხლდენის დღეები არსებულ ჩანაწერს ემთხვევა. შესასწორებლად აირჩიე მისი დაწყების თარიღი.",
          "Bleeding days overlap another entry. Use its start date to edit it.",
        ),
      );
      return;
    }
    setBusy(true);
    const periods = [
      ...data.periods.filter((p) => p.start !== (latest?.start ?? start)),
      period,
    ].sort((a, b) => a.start.localeCompare(b.start));
    if (
      await save({
        ...data,
        name: name.trim(),
        cycleLength: Number(length),
        periods,
      })
    ) {
      setMessage(t("შენახულია ✓", "Saved ✓"));
    }
    setBusy(false);
  };
  return (
    <View style={s.content}>
      {!editing && (
        <>
          <View
            style={{
              alignItems: "center",
              backgroundColor: C.lav,
              borderRadius: 32,
              marginBottom: 24,
            }}
          >
            <MoonFlower size={170} />
          </View>
          <T weight="display" style={s.title}>
            {t("შენი რიტმით.", "In your rhythm.")}
          </T>
          <T style={[s.muted, { marginBottom: 24 }]}>
            {t(
              "დავიწყოთ შენი ციკლით. ჩანაწერები შენს ანგარიშში შეინახება.",
              "Let’s start with your cycle. Entries will be saved to your account.",
            )}
          </T>
        </>
      )}
      <View style={s.section}>
        <FieldLabel>
          {t("სახელი (სურვილისამებრ)", "Name (optional)")}
        </FieldLabel>
        <TextInput
          accessibilityLabel="Name"
          style={s.input}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />
      </View>
      <View style={s.section}>
        <FieldLabel>{t("პერიოდის დაწყება", "Period start")}</FieldLabel>
        <T style={[s.muted, { marginBottom: 10 }]}>
          {t("მონიშნე სისხლდენის დღეები და ერთხელ შეინახე.", "Select bleeding days and save them together.")}
        </T>
        <PeriodDaysPicker
          ka={ka}
          initialDate={latest?.start ?? dateKey()}
          days={days}
          onToggle={(date) => {
            setDays((current) => current.includes(date) ? current.filter((day) => day !== date) : [...current, date]);
            setMessage("");
          }}
        />
      </View>
      <View style={s.section}>
        <NumberWheel
          label={t("ციკლის ხანგრძლივობა (დღე)", "Cycle length (days)")}
          value={Number(length) || 28}
          min={21}
          max={45}
          onChange={(value) => setLength(String(value))}
          ka={ka}
        />
      </View>
      {message ? (
        <T accessibilityLiveRegion="polite" style={s.error}>
          {message}
        </T>
      ) : null}
      <CTA
        title={
          busy
            ? t("ინახება…", "Saving…")
            : editing
              ? t("შენახვა", "Save period")
              : t("დავიწყოთ", "Find my rhythm")
        }
        onPress={() => void submit()}
        disabled={busy}
      />
      <T style={[s.muted, { marginTop: 20 }]}>
        {t(
          "შენახული ჩანაწერები სინქრონდება შენს ანგარიშთან.",
          "Saved entries sync with your account.",
        )}
      </T>
      <CycleEducation data={data} birthDate={birthDate} />
    </View>
  );
}
function Home({
  data,
  openCalendar,
  openPregnancy,
  birthDate,
}: {
  data: Data;
  openCalendar: (date?: string, editing?: boolean) => void;
  openPregnancy: () => void;
  birthDate?: string;
}) {
  const ka = data.lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const { width, fontScale } = useWindowDimensions();
  const stackCycle = width < 365 || fontScale > 1.25;
  if (data.pregnancy?.active)
    return (
      <View style={s.content}>
        <T weight="display" style={s.title}>
          {t("ორსულობის რეჟიმი", "Pregnancy mode")}
        </T>
        <T style={s.muted}>
          {t(
            "პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია.",
            "Period and fertile-day estimates are paused.",
          )}
        </T>
        <CTA
          title={t("ორსულობის გვერდი", "Pregnancy page")}
          onPress={openPregnancy}
        />
      </View>
    );
  const c = cycleAt(data.periods, data.cycleLength);
  if (!c) return null;
  const today = dateKey(),
    model = forecast(data.periods, data.cycleLength),
    left = distance(today, c.next);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3));
  const phase =
    model.status === "overdue" ||
    (model.reliability === "low" && c.phase !== "menstruation")
      ? "unknown"
      : c.phase;
  const reliability =
    model.reliability === "consistent"
      ? t("ისტორიაზე დაფუძნებული", "Based on your history")
      : model.reliability === "low"
        ? t("სიზუსტე შეზღუდულია", "Limited accuracy")
        : t("საწყისი შეფასება", "Initial estimate");
  return (
    <View style={s.content}>
      <T style={[s.muted, { fontSize: 15 }]}>
        {data.name
          ? t(`გამარჯობა, ${data.name}`, `Hello, ${data.name}`)
          : t("შენი სივრცე", "Your space")}
      </T>
      <T weight="display" style={[s.title, { marginTop: 3, marginBottom: 18 }]}>
        {t("დღეს შენს რიტმში", "Today in your rhythm")}
      </T>
      <View
        style={[
          s.card,
          {
            backgroundColor: "#EEE6F7",
            borderColor: "#E1D3F1",
            padding: 20,
            overflow: "hidden",
          },
        ]}
      >
        <View style={[s.topBar, { flexWrap: "wrap" }]}>
          <T weight="bold" style={{ fontSize: 14, color: C.muted }}>
            {t("მიმდინარე ციკლი", "CURRENT CYCLE")}
          </T>
          <T style={{ fontSize: 14, color: C.muted }}>
            {t(`${c.length} დღიანი შეფასება`, `${c.length}-day estimate`)}
          </T>
        </View>
        <View style={stackCycle ? { gap: 12, alignItems: "center" } : [s.row, { gap: 10 }]}>
          <View style={stackCycle ? { alignSelf: "stretch" } : { flex: 1 }}>
            <T style={s.muted}>{t("ციკლის დღე", "Cycle day")}</T>
            <T weight="display" style={{ fontSize: 69, lineHeight: 78 }}>
              {c.day}
            </T>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: C.white,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 7,
                marginTop: 5,
                maxWidth: "100%",
              }}
            >
              <T weight="bold" style={{ fontSize: 14 }}>
                {phases[phase][ka ? 0 : 1]}
              </T>
            </View>
          </View>
          <View pointerEvents="none">
            <CycleOrbit day={c.day} length={c.length} size={stackCycle ? 116 : 142} />
          </View>
        </View>
        <T style={[s.muted, { marginTop: 17 }]}>
          {t(
            "ფაზა სავარაუდოა და ჩანაწერების მიხედვით იცვლება.",
            "Phase is estimated and updates with your entries.",
          )}
        </T>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => openCalendar(today, true)}
        style={[s.card, s.topBar, { minHeight: 52 }]}
      >
        <T weight="bold" style={{ flex: 1 }}>{t("პერიოდის დღეების მონიშვნა", "Log period days")}</T>
        <Icon name="arrow" size={19} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          "შემდეგი პერიოდის კალენდარში ნახვა",
          "View next period in calendar",
        )}
        onPress={() =>
          openCalendar(
            model.status === "active" && model.expected
              ? model.expected
              : today,
          )
        }
        style={s.card}
      >
        <View style={s.topBar}>
          <T weight="bold" style={{ fontSize: 18, flex: 1 }}>
            {t("შემდეგი პერიოდი", "Next period")}
          </T>
          <Icon name="arrow" size={19} />
        </View>
        <T weight="display" style={{ fontSize: 27, lineHeight: 36 }}>
          {model.status === "overdue"
            ? t("პროგნოზი შეჩერებულია", "Estimate paused")
            : left > 0
              ? t(`${left} დღეში`, `In ${left} days`)
              : t("სავარაუდოდ დღეს", "Estimated today")}
        </T>
        <T style={[s.muted, { marginTop: 5 }]}>
          {model.status === "active"
            ? `${model.expected} · ${reliability}`
            : t(
                "ჩაწერე დაწყების თარიღი კალენდარში.",
                "Record the start date in Calendar.",
              )}
        </T>
      </Pressable>
      <View style={s.card}>
        <T weight="bold" style={{ fontSize: 18, marginBottom: 14 }}>
          {t("შენი კვირა", "Your week")}
        </T>
        <View style={{ flexDirection: "row" }}>
          {week.map((day) => {
            const state = calendarState(
              data.periods,
              data.cycleLength,
              day,
              undefined,
              data.pregnancy?.active,
            );
            const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
            const labels = ka
              ? ["კვ", "ორ", "სა", "ოთ", "ხუ", "პა", "შა"]
              : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={day}
                onPress={() => openCalendar(day)}
                style={{
                  flex: 1,
                  minHeight: 62,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 13,
                  backgroundColor:
                    day === today
                      ? C.ink
                      : state === "period"
                        ? C.lav
                        : state === "fertile"
                          ? C.yellow
                          : "#F3F1F6",
                }}
              >
                <T
                  style={{
                    fontSize: 13,
                    color: day === today ? C.white : C.muted,
                  }}
                >
                  {labels[weekday]}
                </T>
                <T
                  weight="bold"
                  style={{
                    fontSize: 16,
                    color: day === today ? C.white : C.ink,
                  }}
                >
                  {Number(day.slice(-2))}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
      <T style={s.muted}>
        {t(
          "პროგნოზები შეფასებაა და არ წარმოადგენს კონტრაცეფციის მეთოდს.",
          "Predictions are estimates and are not a method of contraception.",
        )}
      </T>
      <CycleEducation data={data} birthDate={birthDate} />
    </View>
  );
}
function Daily({
  data,
  save,
  date,
  dirty,
}: { date: string; dirty: (v: boolean) => void } & Shared) {
  const ka = data.lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const blank = (d: string): Log => ({
    date: d,
    mood: "calm",
    energy: 3,
    pain: 1,
    flow: "none",
    symptoms: [],
    notes: "",
  });
  const [savedDate, setSavedDate] = useState(date);
  const [entry, setEntry] = useState<Log>(
      () => data.logs.find((l) => l.date === date) || blank(date),
    ),
    [custom, setCustom] = useState(""),
    [symptomSearch, setSymptomSearch] = useState(""),
    [showAllSymptoms, setShowAllSymptoms] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (patch: Partial<Log>) => {
    setEntry((e) => ({ ...e, ...patch }));
    dirty(true);
    setMessage("");
  };
  const toggle = (sym: string) =>
    change({
      symptoms: entry.symptoms.includes(sym)
        ? entry.symptoms.filter((s) => s !== sym)
        : [...entry.symptoms, sym],
    });
  const query = symptomSearch.trim().toLocaleLowerCase();
  const visibleSymptoms = symptoms.filter(
    ([id, a, b], i) =>
      entry.symptoms.includes(id) ||
      (query
        ? `${a} ${b}`.toLocaleLowerCase().includes(query)
        : showAllSymptoms || i < 9),
  );
  const submit = async () => {
    try {
      stamp(entry.date);
      if (entry.date > dateKey()) throw new Error();
    } catch {
      setMessage(
        t(
          "თარიღი უნდა იყოს დღეს ან წარსულში.",
          "Choose a valid date today or in the past.",
        ),
      );
      return;
    }
    if (
      entry.date !== savedDate &&
      data.logs.some((l) => l.date === entry.date)
    ) {
      setMessage(
        t(
          "ამ თარიღზე ჩანაწერი უკვე გაქვს. მის შესაცვლელად გახსენი კალენდრიდან.",
          "There is already a check-in for this date. Open it from the calendar to edit.",
        ),
      );
      return;
    }
    setBusy(true);
    const symptom = custom.trim();
    const final = {
      ...entry,
      symptoms: [
        ...new Set([...entry.symptoms, ...(symptom ? [symptom] : [])]),
      ],
    };
    if (
      await save({
        ...data,
        logs: [...data.logs.filter((l) => l.date !== entry.date), final].sort(
          (a, b) => a.date.localeCompare(b.date),
        ),
      })
    ) {
      setEntry(final);
      setSavedDate(final.date);
      setCustom("");
      dirty(false);
      setMessage(t("შენახულია ✓", "Check-in saved ✓"));
    }
    setBusy(false);
  };
  return (
    <View style={s.content}>
      <T style={[s.muted, { fontSize: 15 }]}>
        {t("ყოველდღიური ჩანაწერი", "DAILY CHECK-IN")}
      </T>
      <T weight="display" style={[s.title, { marginTop: 4, marginBottom: 10 }]}>
        {t("როგორ ხარ დღეს?", "How do you feel?")}
      </T>
      <T style={[s.muted, { marginBottom: 20 }]}>
        {t(
          "მონიშნე მხოლოდ ის, რაც დღეს შენთვის მნიშვნელოვანია.",
          "Record what matters to you today. You can edit it later.",
        )}
      </T>
      <View style={s.section}>
        <FieldLabel>{t("თარიღი", "Date")}</FieldLabel>
        <DateField
          label={t("თარიღი", "Date")}
          value={entry.date}
          onChange={(v) => change({ date: v })}
          ka={ka}
        />
        <T style={s.muted}>
          {t(
            "უკვე შენახული დღის შესაცვლელად გახსენი ის კალენდარში.",
            "To edit an existing day, open it from the calendar.",
          )}
        </T>
      </View>
      <View style={s.section}>
        <FieldLabel>
          {t("როგორ გრძნობ თავს?", "How are you feeling today?")}
        </FieldLabel>
        <View style={s.wrap}>
          {moods.map(([id, geo, en]) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: entry.mood === id }}
              onPress={() => change({ mood: id })}
              style={{
                flexBasis: 82,
                flexGrow: 1,
                minHeight: 112,
                paddingVertical: 12,
                paddingHorizontal: 4,
                borderRadius: 18,
                borderWidth: entry.mood === id ? 2 : 1,
                borderColor: entry.mood === id ? C.ink : "#E8E4ED",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: entry.mood === id ? C.lav : "#F8F7FA",
              }}
            >
              <Face mood={id} size={50} />
              <T
                weight={entry.mood === id ? "bold" : "regular"}
                style={{ fontSize: 14, textAlign: "center" }}
              >
                {t(geo, en)}
              </T>
            </Pressable>
          ))}
        </View>
      </View>
      <Scale
        label={t("ენერგია · 1 დაბალი, 5 მაღალი", "Energy · 1 low, 5 high")}
        value={entry.energy}
        onChange={(energy) => change({ energy })}
      />
      <Scale
        label={t("ტკივილი · 1 მსუბუქი, 5 ძლიერი", "Pain · 1 mild, 5 severe")}
        value={entry.pain}
        onChange={(pain) => change({ pain })}
      />
      <View style={s.section}>
        <FieldLabel>{t("ნაკადი", "Flow")}</FieldLabel>
        <View style={s.wrap}>
          {[
            ["none", "არ არის", "None"],
            ["spotting", "ლაქები", "Spotting"],
            ["light", "მსუბუქი", "Light"],
            ["medium", "საშუალო", "Medium"],
            ["heavy", "ძლიერი", "Heavy"],
          ].map(([id, a, b]) => (
            <Chip
              key={id}
              label={t(a, b)}
              selected={entry.flow === id}
              onPress={() => change({ flow: id })}
            />
          ))}
        </View>
      </View>
      <View style={s.section}>
        <FieldLabel>{t("დღის სიმპტომები", "Any symptoms today?")}</FieldLabel>
        <TextInput
          accessibilityLabel={t("სიმპტომების ძიება", "Search symptoms")}
          style={s.input}
          placeholder={t("მოძებნე სიმპტომი", "Search symptoms")}
          placeholderTextColor={C.muted}
          value={symptomSearch}
          onChangeText={setSymptomSearch}
        />
        <View style={[s.wrap, { marginTop: 12 }]}>
          {visibleSymptoms.map(([id, a, b]) => (
            <Chip
              key={id}
              label={t(a, b)}
              selected={entry.symptoms.includes(id)}
              onPress={() => toggle(id)}
            />
          ))}
          {entry.symptoms
            .filter((x) => !symptoms.some((s) => s[0] === x))
            .map((x) => (
              <Chip key={x} label={x} selected onPress={() => toggle(x)} />
            ))}
        </View>
        {!symptomSearch.trim() && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAllSymptoms(!showAllSymptoms)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <T weight="bold">
              {showAllSymptoms
                ? t("ნაკლების ჩვენება", "Show fewer")
                : t("ყველა სიმპტომის ჩვენება", "See all symptoms")}
            </T>
          </Pressable>
        )}
      </View>
      <View style={s.section}>
        <FieldLabel>{t("სხვა სიმპტომი", "Add your own symptom")}</FieldLabel>
        <TextInput
          accessibilityLabel="Custom symptom"
          style={s.input}
          placeholder={t("მაგ. თავბრუსხვევა", "For example, dizziness")}
          placeholderTextColor={C.muted}
          value={custom}
          maxLength={60}
          onChangeText={(v) => {
            setCustom(v);
            dirty(true);
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (custom.trim()) {
              change({
                symptoms: [...new Set([...entry.symptoms, custom.trim()])],
              });
              setCustom("");
            }
          }}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <T weight="bold">{t("+ დამატება", "+ Add symptom")}</T>
        </Pressable>
      </View>
      <View style={s.section}>
        <FieldLabel>
          {t("რას გრძნობ დღეს?", "Anything else on your mind?")}
        </FieldLabel>
        <TextInput
          accessibilityLabel="Daily notes"
          multiline
          textAlignVertical="top"
          style={[s.input, { minHeight: 130 }]}
          placeholder={t(
            "მომიყევი შენს დღეზე…",
            "A little note about your day…",
          )}
          placeholderTextColor={C.muted}
          value={entry.notes}
          maxLength={2000}
          onChangeText={(notes) => change({ notes })}
        />
        <T style={[s.muted, { textAlign: "right" }]}>
          {entry.notes.length}/2000
        </T>
      </View>
      {message ? (
        <View style={s.banner}>
          <T accessibilityLiveRegion="polite">{message}</T>
        </View>
      ) : null}
      <CTA
        title={
          busy ? t("ინახება…", "Saving…") : t("დღის შენახვა", "Save check-in")
        }
        disabled={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}

function Calendar({
  data,
  save,
  openLog,
  initialDate,
  initiallyEditing = false,
}: {
  data: Data;
  openLog: (date: string) => void;
  initialDate: string;
  initiallyEditing?: boolean;
} & Shared) {
  const ka = data.lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const [month, setMonth] = useState(
      () =>
        new Date(
          Number(initialDate.slice(0, 4)),
          Number(initialDate.slice(5, 7)) - 1,
          1,
        ),
    ),
    [selected, setSelected] = useState(initialDate);
  const recordedOn = (date: string) =>
    data.periods.find((p) => date >= p.start && date < addDays(p.start, p.duration));
  const initialPeriod = initiallyEditing ? recordedOn(initialDate) : undefined;
  const [editing, setEditing] = useState(initiallyEditing && !data.pregnancy?.active),
    [periodDays, setPeriodDays] = useState<string[]>(() =>
      initialPeriod
        ? Array.from({ length: initialPeriod.duration }, (_, index) => addDays(initialPeriod.start, index)).filter((day) => day <= dateKey())
        : [],
    ),
    [periodMessage, setPeriodMessage] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const first = (month.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells = Array.from(
    { length: Math.ceil((first + count) / 7) * 7 },
    (_, i) => i - first + 1,
  );
  const selectedLog = data.logs.find((l) => l.date === selected);
  const c = cycleAt(data.periods, data.cycleLength, selected);
  const recorded =
    selected <= dateKey()
      ? recordedOn(selected)
      : undefined;
  const changeDate = (key: string) => {
    setSelected(key);
    setEditing(false);
    setPeriodMessage("");
    setConfirmDelete(false);
  };
  const savePeriod = async () => {
    if (data.pregnancy?.active) {
      setPeriodMessage(
        t(
          "პერიოდის დასამატებლად ჯერ გამორთე ორსულობის რეჟიმი.",
          "Turn off pregnancy mode before logging a period.",
        ),
      );
      return;
    }
    const period = periodFromSelectedDays(periodDays);
    if (!period || !validSetup(period.start, data.cycleLength, period.duration)) {
      setPeriodMessage(
        t(
          "მონიშნე მხოლოდ გასული, ზედიზედ დღეები (1–10).",
          "Select only past, consecutive bleeding days (1–10).",
        ),
      );
      return;
    }
    if (
      overlapsPeriod(
        data.periods,
        period,
        recorded?.start ?? "",
      )
    ) {
      setPeriodMessage(
        t(
          "სისხლდენის დღეები სხვა ჩანაწერს ემთხვევა.",
          "Bleeding days overlap another entry.",
        ),
      );
      return;
    }
    const periods = [
      ...data.periods.filter((p) => p.start !== recorded?.start),
      period,
    ].sort((a, b) => a.start.localeCompare(b.start));
    if (await save({ ...data, periods })) {
      setEditing(false);
      setPeriodMessage(t("პერიოდი შენახულია ✓", "Period saved ✓"));
    }
  };
  const deletePeriod = async () => {
    if (!recorded) return;
    if (
      await save({
        ...data,
        periods: data.periods.filter((p) => p.start !== recorded.start),
      })
    ) {
      setEditing(false);
      setConfirmDelete(false);
      setPeriodMessage(t("პერიოდი წაიშალა", "Period removed"));
    }
  };
  return (
    <View style={s.content}>
      <T style={[s.muted, { fontSize: 15 }]}>
        {t("თვეების მიმოხილვა", "CYCLE CALENDAR")}
      </T>
      <T weight="display" style={[s.title, { marginTop: 4, marginBottom: 18 }]}>
        {t("შენი კალენდარი", "Your calendar")}
      </T>
      {!editing && (
      <>
      <View style={[s.card, { paddingHorizontal: 8 }]}>
        <View style={s.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("წინა თვე", "Previous month")}
            style={s.round}
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <Icon name="back" />
          </Pressable>
          <View style={{ alignItems: "center", flex: 1 }}>
            <T weight="bold" style={{ fontSize: 21, textAlign: "center" }}>
              {monthLabel(month, ka)}
            </T>
            <T style={s.muted}>{month.getFullYear()}</T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("შემდეგი თვე", "Next month")}
            style={s.round}
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <Icon name="arrow" />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row" }}>
          {(ka
            ? ["ორ", "სა", "ოთ", "ხუ", "პა", "შა", "კვ"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          ).map((x) => (
            <View
              key={x}
              style={[s.cell, { alignItems: "center", paddingVertical: 12 }]}
            >
              <T style={{ fontSize: 12 }}>{x}</T>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((n, i) => {
            if (n < 1 || n > count) return <View key={i} style={s.cell} />;
            const key = dateKey(
              new Date(month.getFullYear(), month.getMonth(), n),
            );
            const state = calendarState(
              data.periods,
              data.cycleLength,
              key,
              undefined,
              data.pregnancy?.active,
            );
            const logged = data.logs.some((l) => l.date === key);
            return (
              <View key={key} style={s.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${key}${state ? `, ${state}` : ""}${logged ? ", logged" : ""}`}
                  accessibilityState={{ selected: selected === key }}
                  onPress={() => changeDate(key)}
                  style={[
                    s.day,
                    {
                      backgroundColor:
                        state === "period"
                          ? C.lav
                          : state === "fertile"
                            ? C.yellow
                            : state === "predicted"
                              ? C.white
                              : "#F4F2F7",
                      borderColor:
                        state === "predicted" ? "#A78BC9" : "transparent",
                      borderStyle: state === "predicted" ? "dashed" : "solid",
                    },
                    selected === key && {
                      borderColor: C.ink,
                      borderWidth: 2,
                      borderStyle: "solid",
                    },
                  ]}
                >
                  <T weight={key === dateKey() ? "bold" : "regular"}>{n}</T>
                  {logged && (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 3,
                        backgroundColor: C.ink,
                        position: "absolute",
                        bottom: 4,
                      }}
                    />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={[s.wrap, { marginTop: 18 }]}>
          {[
            [C.lav, t("ჩაწერილი პერიოდი", "Recorded period"), false],
            [
              C.yellow,
              t("სავარაუდო ნაყოფიერი დღეები", "Estimated fertile days"),
              false,
            ],
            [C.white, t("სავარაუდო პერიოდი", "Predicted period"), true],
          ].map(([color, label, dashed]) => (
            <View key={String(label)} style={s.row}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 6,
                  backgroundColor: String(color),
                  borderWidth: dashed ? 1 : 0,
                  borderColor: "#A78BC9",
                  borderStyle: dashed ? "dashed" : "solid",
                }}
              />
              <T style={{ fontSize: 12, flexShrink: 1 }}>{label}</T>
            </View>
          ))}
        </View>
      </View>
      <View style={[s.card, { backgroundColor: C.ink }]}>
        <T style={{ color: C.lav, marginBottom: 8 }}>{selected}</T>
        <T weight="display" style={{ fontSize: 24, color: C.yellow }}>
          {recorded
            ? t("ჩაწერილი მენსტრუაცია", "Recorded period")
            : selected > dateKey()
              ? t("სავარაუდო თარიღი", "Estimated date")
              : c
                ? t(`ციკლის დღე ${c.day}`, `Cycle day ${c.day}`)
                : t("ციკლი არ არის ჩაწერილი", "No cycle recorded")}
        </T>
        <T style={{ color: C.white, marginTop: 8 }}>
          {recorded
            ? t(
                `დაიწყო ${recorded.start} · ${recorded.duration} დღე`,
                `Started ${recorded.start} · ${recorded.duration} days`,
              )
            : selected > dateKey()
              ? t("ეს მხოლოდ პროგნოზია.", "This is only an estimate.")
              : c
                ? phases[c.phase][ka ? 0 : 1]
                : ""}
        </T>
        {selectedLog && (
          <T numberOfLines={3} style={{ color: C.lav, marginTop: 12 }}>
            {selectedLog.notes || t("დღიური შენახულია ✓", "Check-in saved ✓")}
          </T>
        )}
      </View>
      {selected <= dateKey() && (
        <>
          <CTA
            title={
              selectedLog
                ? t("ჩანაწერის შეცვლა", "Edit check-in")
                : t("დღიურის დამატება", "Add check-in")
            }
            onPress={() => openLog(selected)}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditing(!editing);
              setPeriodDays(
                recorded
                  ? Array.from({ length: recorded.duration }, (_, index) =>
                      addDays(recorded.start, index),
                    ).filter((day) => day <= dateKey())
                  : selected <= dateKey()
                    ? [selected]
                    : [],
              );
              setPeriodMessage("");
            }}
            style={{
              minHeight: 52,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <T weight="bold">
              {recorded
                ? t("პერიოდის შეცვლა", "Edit recorded period")
                : t("+ მენსტრუაციის დაწყების ჩაწერა", "+ Record period start")}
            </T>
          </Pressable>
        </>
      )}
      </>
      )}
      {editing && (
        <View style={[s.card, { backgroundColor: C.lav }]}>
          <T weight="bold">
            {t("პერიოდის დღეები", "Period days")}
          </T>
          <T style={[s.muted, { marginVertical: 10 }]}>
            {t(
              "მონიშნე გასული სისხლდენის დღეები. პერიოდის დღეები ზედიზედ უნდა იყოს.",
              "Tap the days bleeding occurred. Period days must be consecutive.",
            )}
          </T>
          <PeriodDaysPicker
            ka={ka}
            initialDate={recorded?.start ?? (selected <= dateKey() ? selected : dateKey())}
            days={periodDays}
            onToggle={(date) => {
              setPeriodDays((current) => current.includes(date) ? current.filter((day) => day !== date) : [...current, date]);
              setPeriodMessage("");
            }}
          />
          <View style={{ marginTop: 14 }}>
            <CTA
              title={t("პერიოდის შენახვა", "Save period")}
              onPress={() => void savePeriod()}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
            onPress={() => {
              setEditing(false);
              setConfirmDelete(false);
              setPeriodMessage("");
            }}
          >
            <T>{t("მონიშვნის გაუქმება", "Cancel selection")}</T>
          </Pressable>
          {recorded && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmDelete(true)}
              style={{ minHeight: 50, justifyContent: "center" }}
            >
              <T style={{ color: "#92384B" }}>
                {t("ამ პერიოდის წაშლა", "Remove this period")}
              </T>
            </Pressable>
          )}
          {confirmDelete && (
            <View style={s.wrap}>
              <Chip
                label={t("გაუქმება", "Cancel")}
                selected={false}
                onPress={() => setConfirmDelete(false)}
              />
              <Chip
                label={t("წაშლის დადასტურება", "Confirm removal")}
                selected
                onPress={() => void deletePeriod()}
              />
            </View>
          )}
        </View>
      )}
      {periodMessage ? (
        <T
          accessibilityLiveRegion="polite"
          style={[s.muted, { marginTop: 12 }]}
        >
          {periodMessage}
        </T>
      ) : null}
    </View>
  );
}

function PredictionNotice({ data }: { data: Data }) {
  if (data.pregnancy?.active)
    return (
      <View style={s.card}>
        <T>
          {data.lang === "ka"
            ? "ორსულობის რეჟიმში პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია."
            : "Period and fertile-day estimates are paused in pregnancy mode."}
        </T>
      </View>
    );
  const ka = data.lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const model = forecast(
    data.periods,
    data.cycleLength,
    undefined,
    data.pregnancy?.active,
  );
  return (
    <View style={[s.banner, { marginTop: 16 }]}>
      <T weight="bold">
        {model.status === "overdue"
          ? t("პროგნოზი შეჩერებულია", "Predictions paused")
          : model.reliability === "limited"
            ? t("საწყისი შეფასება", "Initial estimate")
            : model.reliability === "low"
              ? t("ციკლები განსხვავდება", "Cycles vary")
              : t(
                  "პროგნოზი შენს ისტორიაზეა დაფუძნებული",
                  "Estimate based on your history",
                )}
      </T>
      <T style={[s.muted, { marginTop: 8 }]}>
        {model.status === "overdue"
          ? t(
              "სავარაუდო თარიღი გავიდა. კალენდარში ჩაწერე ახალი პერიოდი, როცა დაიწყება; მანამდე მომავალ პერიოდებსა და ნაყოფიერ დღეებს არ ვაჩვენებთ.",
              "The estimated date has passed. Log the new period in Calendar when it starts; future period and fertile-day estimates are paused.",
            )
          : model.reliability === "limited"
            ? t(
                "საჭიროა 3 დასრულებული ციკლი. ჯერ ვიყენებთ შენს მითითებულ ხანგრძლივობას.",
                "We need 3 completed cycles. For now, we use your chosen cycle length.",
              )
            : model.reliability === "low"
              ? t(
                  "ერთი ზუსტი თარიღი ნაკლებად სანდოა; ნაყოფიერი დღეების პროგნოზი დამალულია.",
                  "A single date is less reliable; fertile-day estimates are hidden.",
                )
              : t(
                  "მეტი ზუსტი ჩანაწერი პროგნოზის განახლებაში დაგვეხმარება.",
                  "More accurate entries help us update your estimates.",
                )}
      </T>
      {model.earliest && model.latest && model.status === "active" && (
        <T style={[s.muted, { marginTop: 8 }]}>
          {t(
            "შენი წინა ციკლების დიაპაზონი: ",
            "Range observed in your previous cycles: ",
          )}
          {model.earliest} — {model.latest}
        </T>
      )}
    </View>
  );
}
function Insights({
  data,
  birthDate,
  token,
  onPremium,
}: {
  data: Data;
  birthDate?: string;
  token: string;
  onPremium: () => void;
}) {
  const ka = data.lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const avg = averages(data.periods, data.cycleLength);
  const enough = avg.completed.length >= 3;
  const model = forecast(
    data.periods,
    data.cycleLength,
    undefined,
    data.pregnancy?.active,
  );
  const frequency = new Map<string, number>();
  data.logs.forEach((l) =>
    l.symptoms.forEach((sym) =>
      frequency.set(sym, (frequency.get(sym) || 0) + 1),
    ),
  );
  const membership = useMembership(token, apiRoot);
  const patterns = membership.active
    ? symptomPatterns(data.periods, data.logs)
    : [];
  return (
    <View style={s.content}>
      <T style={[s.muted, { fontSize: 15 }]}>
        {t("შენი ჩანაწერების მიხედვით", "FROM YOUR ENTRIES")}
      </T>
      <T weight="display" style={[s.title, { marginTop: 4 }]}>
        {t("ციკლის ანალიტიკა", "Cycle insights")}
      </T>
      <View
        style={[s.card, { backgroundColor: "#EEE6F7", borderColor: "#E1D3F1" }]}
      >
        <T weight="bold" style={{ fontSize: 18, marginBottom: 16 }}>
          {t("შენი ციკლი რიცხვებში", "Your cycle in numbers")}
        </T>
        <View style={[s.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <T weight="display" style={{ fontSize: 43, lineHeight: 51 }}>
              {Math.round(avg.length)}
            </T>
            <T style={s.muted}>
              {enough
                ? t("საშუალო ციკლი · დღე", "Average cycle · days")
                : t("მითითებული ციკლი · დღე", "Cycle estimate · days")}
            </T>
          </View>
          <View
            style={{
              width: 1,
              alignSelf: "stretch",
              backgroundColor: "#CDBBDD",
            }}
          />
          <View style={{ flex: 1, paddingLeft: 8 }}>
            <T weight="display" style={{ fontSize: 43, lineHeight: 51 }}>
              {Math.round(avg.duration)}
            </T>
            <T style={s.muted}>
              {enough
                ? t("საშუალო სისხლდენა · დღე", "Average bleeding · days")
                : t("ბოლო ჩანაწერი · დღე", "Last period · days")}
            </T>
          </View>
        </View>
        <T style={[s.muted, { marginTop: 16 }]}>
          {enough
            ? t(
                `${avg.completed.length} დასრულებული ციკლის მიხედვით`,
                `Based on ${avg.completed.length} completed cycles`,
              )
            : t(
                "პირადი საშუალოსთვის საჭიროა 3 დასრულებული ციკლი.",
                "Three completed cycles are needed for a personal average.",
              )}
        </T>
      </View>
      <PredictionNotice data={data} />
      <CycleEducation data={data} birthDate={birthDate} />{" "}
      <View style={s.section}>
        <FieldLabel>
          {t("შენი განმეორებადი ნიშნები", "Your recurring patterns")}
        </FieldLabel>
        {!membership.active ? (
          <View style={{ gap: 12 }}>
            <T style={s.muted}>
              {membership.error
                ? t("პრემიუმი ვერ შემოწმდა.", "Could not verify Premium.")
                : t(
                    "განმეორებადი სიმპტომების ანალიზი პრემიუმის ფუნქციაა.",
                    "Recurring symptom patterns require Premium.",
                  )}
            </T>
            <CTA light title="Premium" onPress={onPremium} />
          </View>
        ) : patterns.length === 0 ? (
          <T style={s.muted}>
            {enough
              ? t(
                  "ერთსა და იმავე ფაზაში 3 ციკლის განმავლობაში განმეორებული სიმპტომი ჯერ არ დაფიქსირებულა.",
                  "No symptom has repeated in the same phase across 3 cycles yet.",
                )
              : t(
                  "პატერნისთვის საჭიროა მინიმუმ 3 დასრულებული ციკლი და დღიური ჩანაწერები.",
                  "Patterns need at least 3 completed cycles with check-ins.",
                )}
          </T>
        ) : (
          patterns.map(
            (p: {
              symptom: string;
              phase: string;
              count: number;
              total: number;
            }) => (
              <View
                key={`${p.symptom}-${p.phase}`}
                style={[
                  s.card,
                  { backgroundColor: C.yellow, marginBottom: 10 },
                ]}
              >
                <T weight="bold">
                  {symptoms.find((s) => s[0] === p.symptom)?.[ka ? 1 : 2] ||
                    p.symptom}
                </T>
                <T style={s.muted}>
                  {phases[p.phase]?.[ka ? 0 : 1] || p.phase} ·{" "}
                  {t(`${p.count} ციკლში`, `In ${p.count} cycles`)}
                </T>
              </View>
            ),
          )
        )}
      </View>
      <View style={s.section}>
        <FieldLabel>{t("ციკლების ისტორია", "Cycle history")}</FieldLabel>
        {avg.completed.length === 0 ? (
          <T style={s.muted}>
            {t(
              "კალენდარში დაამატე წინა პერიოდების დაწყების თარიღები.",
              "Add previous period start dates in Calendar.",
            )}
          </T>
        ) : (
          avg.completed
            .slice(-6)
            .reverse()
            .map((p: { start: string; length: number }) => (
              <View key={p.start} style={{ marginBottom: 16 }}>
                <View style={s.topBar}>
                  <T>{p.start}</T>
                  <T weight="bold">
                    {p.length} {t("დღე", "days")}
                  </T>
                </View>
                <View
                  style={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: C.silver,
                  }}
                >
                  <View
                    style={{
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: C.lav,
                      width: `${Math.min(100, (p.length / 45) * 100)}%`,
                    }}
                  />
                </View>
                {enough && Math.abs(p.length - avg.length) > 7 && (
                  <T style={[s.muted, { marginTop: 6 }]}>
                    {t(
                      "საშუალოსგან განსხვავდება 7 დღეზე მეტით.",
                      "More than 7 days from your average.",
                    )}
                  </T>
                )}
              </View>
            ))
        )}
      </View>
      <View style={s.section}>
        <FieldLabel>{t("ხშირი სიმპტომები", "Your symptom journal")}</FieldLabel>
        {frequency.size === 0 ? (
          <T style={s.muted}>
            {t(
              "მონიშნე სიმპტომები დღიურში და აქ შეჯამდება.",
              "Symptoms from your check-ins will appear here.",
            )}
          </T>
        ) : (
          [...frequency.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([sym, count]) => (
              <View key={sym} style={[s.topBar, { gap: 12 }]}>
                <T style={{ flex: 1 }}>
                  {symptoms.find((s) => s[0] === sym)?.[ka ? 1 : 2] || sym}
                </T>
                <View
                  style={{
                    backgroundColor: C.yellow,
                    padding: 8,
                    borderRadius: 12,
                  }}
                >
                  <T>
                    {count} {t("დღე", "days")}
                  </T>
                </View>
              </View>
            ))
        )}
      </View>
      {enough && model.status === "active" && (
        <View style={s.section}>
          <FieldLabel>
            {t("შემდეგი 6 პერიოდი · პროგნოზი", "Next 6 periods · estimates")}
          </FieldLabel>
          {predictions(data.periods, data.cycleLength).map((d: string) => (
            <T key={d} style={{ paddingVertical: 8 }}>
              {d}
            </T>
          ))}
        </View>
      )}
      <T style={s.muted}>
        {t(
          "ანალიტიკა ეფუძნება შენს ჩანაწერებს და არ წარმოადგენს დიაგნოზს.",
          "Insights summarize your entries and are not a diagnosis.",
        )}
      </T>
    </View>
  );
}
function Profile({
  data,
  save,
  birthDate,
  session,
  authBusy,
  setAuthBusy,
  onNavigate,
}: {
  session: Session;
  authEnabled: boolean;
  authBusy: boolean;
  setAuthBusy: (value: boolean) => void;
  onNavigate: (tab: Tab) => void;
} & Shared) {
  const ka = data.lang === "ka",
    t = (a: string, b: string) => (ka ? a : b);
  const [editing, setEditing] = useState(false),
    [message, setMessage] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(EMPTY_SOCIAL_LINKS);
  useEffect(() => {
    let active = true;
    fetch("https://tutahealth.ge/api/site-social-links")
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result?.links) setSocialLinks({ ...EMPTY_SOCIAL_LINKS, ...result.links }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  async function signOut() {
    if (!supabase) return;
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      setMessage(
        t(
          "გამოსვლა ვერ მოხერხდა. სცადე თავიდან.",
          "Could not sign out. Try again.",
        ),
      );
    } finally {
      setAuthBusy(false);
    }
  }
  return (
    <View style={s.content}>
      <T weight="display" style={s.title}>
        {t("ჩემი პროფილი", "My profile")}
      </T>
      <View style={[s.card, { backgroundColor: C.lav, gap: 12 }]}>
        <T weight="bold" style={{ fontSize: 23 }}>
          {[
            session.user.user_metadata?.first_name,
            session.user.user_metadata?.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
            data.name ||
            t("ჩემი ანგარიში", "My account")}
        </T>
        <T selectable>{session.user.email}</T>
        <CTA
          disabled={authBusy}
          title={
            authBusy
              ? t("მუშავდება…", "Please wait…")
              : t("ანგარიშიდან გამოსვლა", "Sign out")
          }
          onPress={() => void signOut()}
        />
      </View>
      <ScreenLinks lang={data.lang} onNavigate={onNavigate} group="profile" />
      {Object.values(socialLinks).some(Boolean) && <View style={s.card}>
        <FieldLabel>{t("გამოგვყევი", "Follow Tuta")}</FieldLabel>
        <T style={s.muted}>{t("თუთა სოციალურ ქსელებში", "Tuta on social media")}</T>
        <View style={[s.row, { flexWrap: "wrap", gap: 10 }]}>
          {(["facebook", "instagram", "youtube", "tiktok"] as SocialPlatform[]).filter((platform) => socialLinks[platform]).map((platform) => <Pressable key={platform} accessibilityRole="link" accessibilityLabel={platform} onPress={() => void Linking.openURL(socialLinks[platform])} style={[s.card, { paddingVertical: 10, paddingHorizontal: 14, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }]}>
            <SocialBadge platform={platform}/><T weight="bold">{platform === "facebook" ? "Facebook" : platform === "instagram" ? "Instagram" : platform === "youtube" ? "YouTube" : "TikTok"}</T>
          </Pressable>)}
        </View>
      </View>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: editing }}
        onPress={() => setEditing(!editing)}
        style={[
          s.card,
          s.row,
          { minHeight: 60, justifyContent: "space-between" },
        ]}
      >
        <T weight="bold" style={{ flex: 1 }}>{t("ციკლის პარამეტრები", "Cycle settings")}</T>
        <Icon name={editing ? "close" : "arrow"} />
      </Pressable>
      {editing && (
        <Setup data={data} save={save} birthDate={birthDate} editing />
      )}
      <View style={[s.card, { gap: 16 }]}>
        <FieldLabel>
          {t("მონაცემები და უსაფრთხოება", "Data & safety")}
        </FieldLabel>
        <T style={s.muted}>
          {t(
            "ჯანმრთელობის ჩანაწერები დაცულ ანგარიშშია და აპსა და საიტთან სინქრონდება. ექსპორტი მხოლოდ შენი მოქმედებით ხდება.",
            "Health entries are stored in your private account and synced across apps and web. Exports happen only when you choose.",
          )}
        </T>
        <CTA
          light
          title={t("ჩემი მონაცემების ექსპორტი", "Export my data")}
          onPress={() =>
            Alert.alert(
              t("პირადი ინფორმაცია", "Private information"),
              t(
                "ექსპორტი ჯანმრთელობის მონაცემებს შეიცავს. გააზიარე მხოლოდ სანდო ადგილას.",
                "This export contains health data. Share only with someone you trust.",
              ),
              [
                { text: t("გაუქმება", "Cancel"), style: "cancel" },
                {
                  text: t("გაზიარება", "Share"),
                  onPress: () =>
                    void Share.share({
                      message: JSON.stringify(data, null, 2),
                      title: "Tuta data export",
                    }).catch(() =>
                      setMessage(
                        t("გაზიარება ვერ გაიხსნა.", "Could not open sharing."),
                      ),
                    ),
                },
              ],
            )
          }
        />
        <CTA
          light
          title={t("კონფიდენციალურობა", "Privacy")}
          onPress={() => onNavigate("privacy")}
        />
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: "center" }}
          onPress={() =>
            Alert.alert(
              t("ჯანმრთელობის ჩანაწერების წაშლა", "Delete health entries"),
              t(
                "ყველა მოწყობილობაზე წაიშლება პერიოდი, დღიური და ორსულობის დათარიღება. ანგარიში და შეკვეთები არ წაიშლება. ქმედება შეუქცევადია.",
                "This permanently clears period, journal and pregnancy records across devices. It does not delete your account or orders.",
              ),
              [
                { text: t("გაუქმება", "Cancel"), style: "cancel" },
                {
                  text: t("წაშლა", "Delete"),
                  style: "destructive",
                  onPress: () =>
                    void save({ ...emptyData, lang: data.lang }).then((ok) =>
                      setMessage(
                        ok
                          ? t("ჩანაწერები წაიშალა.", "Entries deleted.")
                          : t(
                              "ვერ წაიშალა. შეამოწმე კავშირი.",
                              "Could not delete. Check your connection.",
                            ),
                      ),
                    ),
                },
              ],
            )
          }
        >
          <T style={{ color: "#92384B" }}>
            {t("ჯანმრთელობის ჩანაწერების წაშლა", "Delete health entries")}
          </T>
        </Pressable>
      </View>
      {Boolean(message) && <T accessibilityLiveRegion="polite">{message}</T>}
    </View>
  );
}

function SocialBadge({ platform }: { platform: SocialPlatform }) {
  const letter = platform === "facebook" ? "f" : platform === "instagram" ? "◎" : platform === "youtube" ? "▶" : "♪";
  return <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.lav, alignItems: "center", justifyContent: "center" }}><T weight="bold">{letter}</T></View>;
}

function AuthScreen({
  kind,
  lang,
  busy,
  setBusy,
  back,
  forgot,
  login,
  register,
}: {
  kind: "login" | "register" | "forgot" | "reset";
  lang: "ka" | "en";
  busy: boolean;
  setBusy: (v: boolean) => void;
  back: () => void;
  forgot: () => void;
  login: () => void;
  register: () => void;
}) {
  const ka = lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState(""),
    [birthDate, setBirthDate] = useState(""),
    [message, setMessage] = useState("");
  const [pendingEmail, setPendingEmail] = useState<PendingEmail | null>(null);
  const isReset = kind === "reset",
    isForgot = kind === "forgot";
  const title =
    kind === "login"
      ? t("კეთილი დაბრუნება.", "Welcome back.")
      : kind === "register"
        ? t("შექმენი ანგარიში.", "Create your account.")
        : isForgot
          ? t("პაროლის აღდგენა.", "Reset your password.")
          : t("ახალი პაროლი.", "Choose a new password.");
  const submit = async () => {
    if (!supabase) {
      setMessage(
        t(
          "ანგარიშის სერვისი დაყენებული არ არის.",
          "Account service is not configured.",
        ),
      );
      return;
    }
    const normalized = email.trim().toLowerCase();
    if (!isReset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage(t("შეიყვანე სწორი ელფოსტა.", "Enter a valid email address."));
      return;
    }
    if (kind === "register" && (!firstName.trim() || !lastName.trim())) {
      setMessage(
        t("შეიყვანე სახელი და გვარი.", "Enter your first and last name."),
      );
      return;
    }
    if (kind === "register" && !validBirthDate(birthDate)) {
      setMessage(
        t(
          "კალენდარში აირჩიე დაბადების სწორი თარიღი.",
          "Choose a valid birth date from the calendar.",
        ),
      );
      return;
    }
    if (!isForgot && password.length < 8) {
      setMessage(
        t(
          "პაროლი მინიმუმ 8 სიმბოლოს უნდა შეიცავდეს.",
          "Password must be at least 8 characters.",
        ),
      );
      return;
    }
    if ((kind === "register" || isReset) && password !== confirm) {
      setMessage(
        t("პაროლები არ ემთხვევა ერთმანეთს.", "Passwords do not match."),
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(
          normalized,
          { redirectTo: "com.tutahealth.app://auth-callback" },
        );
        if (error) throw error;
        setMessage(
          t(
            "თუ ანგარიში არსებობს, აღდგენის ბმულს ელფოსტაზე მიიღებ. შეამოწმე სპამიც.",
            "If the account exists, a recovery link will arrive by email. Check spam too.",
          ),
        );
      } else if (isReset) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setMessage(
            t(
              "ჯერ გახსენი ელფოსტაზე მიღებული აღდგენის ბმული.",
              "Open the recovery link from your email first.",
            ),
          );
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut({ scope: "local" });
        setPassword("");
        setConfirm("");
        setMessage(
          t(
            "პაროლი შეიცვალა. ახლა შეგიძლია შეხვიდე.",
            "Password updated. You can now sign in.",
          ),
        );
      } else if (kind === "register") {
        const {
          data: { session },
          error,
        } = await supabase.auth.signUp({
          email: normalized,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              name: `${firstName.trim()} ${lastName.trim()}`,
              date_of_birth: birthDate,
            },
          },
        });
        if (error) throw error;
        if (!session) {
          setPassword("");
          setConfirm("");
          setPendingEmail({ email: normalized, resendAt: Date.now() + EMAIL_RESEND_WAIT_MS });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      if (kind === "login" && emailNotConfirmed(error)) {
        setPassword("");
        setPendingEmail({ email: normalized, resendAt: 0 });
        return;
      }
      const raw = error instanceof Error ? error.message : "";
      const lower = raw.toLowerCase();
      setMessage(
        lower.includes("already registered")
          ? t(
              "ეს ელფოსტა უკვე რეგისტრირებულია.",
              "This email is already registered.",
            )
          : lower.includes("invalid login") ||
              lower.includes("invalid credentials")
            ? t(
                "ელფოსტა ან პაროლი არასწორია.",
                "Email or password is incorrect.",
              )
            : t(
                "ვერ მოხერხდა. შეამოწმე კავშირი და სცადე ხელახლა.",
                "Could not complete this request. Check your connection and try again.",
              ),
      );
    } finally {
      setBusy(false);
    }
  };
  if (pendingEmail && (kind === "register" || kind === "login")) {
    return <EmailCodeScreen pending={pendingEmail} lang={lang} onBack={() => setPendingEmail(null)} />;
  }
  return (
    <View style={s.content}>
      <Pressable
        accessibilityRole="button"
        onPress={back}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <T weight="bold">‹ {t("უკან", "Back")}</T>
      </Pressable>
      <T weight="display" style={s.title}>
        {title}
      </T>
      <T style={[s.muted, { marginBottom: 24 }]}>
        {isForgot
          ? t(
              "გამოგიგზავნით ერთჯერად ბმულს ახალი პაროლის დასაყენებლად.",
              "We’ll send a one-time link to set a new password.",
            )
          : t(
              "ციკლის ჩანაწერები შენს ანგარიშში შეინახება და ყველა მოწყობილობაზე გამოჩნდება.",
              "Your cycle entries are saved to your account and available on all devices.",
            )}
      </T>
      {(kind === "login" || kind === "register") && (
        <View style={[s.row, { marginBottom: 24, gap: 10 }]}>
          {(
            [
              ["login", t("შესვლა", "Sign in")],
              ["register", t("რეგისტრაცია", "Create account")],
            ] as const
          ).map(([mode, label]) => (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === mode }}
              disabled={busy}
              onPress={() => {
                setMessage("");
                if (mode === "login") login();
                else register();
              }}
              style={{
                flex: 1,
                minHeight: 52,
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: kind === mode ? C.ink : C.white,
                borderWidth: 1,
                borderColor: kind === mode ? C.ink : C.line,
              }}
            >
              <T
                weight="bold"
                style={{ color: kind === mode ? C.white : C.ink, fontSize: 15, textAlign: "center" }}
              >
                {label}
              </T>
            </Pressable>
          ))}
        </View>
      )}
      {!isReset && (
        <View style={s.section}>
          <FieldLabel>
            {t("ელფოსტა (მომხმარებლის სახელი)", "Email (username)")}
          </FieldLabel>
          <TextInput
            accessibilityLabel={t(
              "ელფოსტა (მომხმარებლის სახელი)",
              "Email (username)",
            )}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            style={s.input}
            value={email}
            onChangeText={setEmail}
          />
        </View>
      )}
      {kind === "register" && (
        <View style={s.section}>
          <FieldLabel>{t("სახელი", "First name")}</FieldLabel>
          <TextInput
            accessibilityLabel={t("სახელი", "First name")}
            autoCapitalize="words"
            textContentType="givenName"
            style={s.input}
            value={firstName}
            onChangeText={setFirstName}
            maxLength={80}
          />
        </View>
      )}
      {kind === "register" && (
        <View style={s.section}>
          <FieldLabel>{t("გვარი", "Last name")}</FieldLabel>
          <TextInput
            accessibilityLabel={t("გვარი", "Last name")}
            autoCapitalize="words"
            textContentType="familyName"
            style={s.input}
            value={lastName}
            onChangeText={setLastName}
            maxLength={80}
          />
        </View>
      )}
      {kind === "register" && (
        <View style={s.section}>
          <FieldLabel>{t("დაბადების თარიღი", "Date of birth")}</FieldLabel>
          <DateField
            label={t("დაბადების თარიღი", "Date of birth")}
            value={birthDate}
            onChange={setBirthDate}
            ka={ka}
            birthDate
          />
        </View>
      )}
      {!isForgot && (
        <View style={s.section}>
          <FieldLabel>
            {isReset
              ? t("ახალი პაროლი", "New password")
              : t("პაროლი", "Password")}
          </FieldLabel>
          <PasswordInput
            label={
              isReset
                ? t("ახალი პაროლი", "New password")
                : t("პაროლი", "Password")
            }
            ka={ka}
            newPassword={kind !== "login"}
            value={password}
            onChange={setPassword}
          />
        </View>
      )}
      {(kind === "register" || isReset) && (
        <View style={s.section}>
          <FieldLabel>
            {t(
              isReset ? "გაიმეორე ახალი პაროლი" : "გაიმეორე პაროლი",
              isReset ? "Confirm new password" : "Confirm password",
            )}
          </FieldLabel>
          <PasswordInput
            label={t(
              isReset ? "გაიმეორე ახალი პაროლი" : "გაიმეორე პაროლი",
              isReset ? "Confirm new password" : "Confirm password",
            )}
            ka={ka}
            value={confirm}
            onChange={setConfirm}
          />
        </View>
      )}
      {message ? (
        <View style={s.banner}>
          <T accessibilityLiveRegion="polite">{message}</T>
        </View>
      ) : null}
      <CTA
        title={
          busy
            ? t("მუშავდება…", "Please wait…")
            : kind === "login"
              ? t("შესვლა", "Sign in")
              : kind === "register"
                ? t("ანგარიშის შექმნა", "Create account")
                : isForgot
                  ? t("ბმულის გაგზავნა", "Send recovery link")
                  : t("პაროლის შეცვლა", "Update password")
        }
        disabled={busy}
        onPress={() => void submit()}
      />
      {kind === "login" && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={forgot}
          style={{
            minHeight: 52,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <T style={s.muted}>{t("დაგავიწყდა პაროლი?", "Forgot password?")}</T>
        </Pressable>
      )}
      {(isForgot || isReset) && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={login}
          style={{
            minHeight: 52,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <T style={s.muted}>{t("შესვლაზე დაბრუნება", "Back to sign in")}</T>
        </Pressable>
      )}
    </View>
  );
}
