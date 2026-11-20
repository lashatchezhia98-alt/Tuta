import { useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import type { RefObject } from "react";
import {
  addDays, calendarDateLabel, calendarRangeLabel, cycleAt, dateKey, periodCalendarLegend,
  periodCalendarModel, periodSelectionReview, selectPeriodDay,
} from "./cycle.mjs";
import { CycleEducation } from "./CycleSupport";
import { CalendarKeyMark, PeriodDaysPicker } from "./PeriodDaysPicker";
import type { Data } from "./types";
import { C, CTA, T, s } from "./ui";
import { useAppFeatures } from "./useJourneyEnabled";

type Draft = { days: string[]; anchor: string | null; replacing?: string };
type Period = Data["periods"][number];
const monthFor = (date: string) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1);
const phases: Record<string, [string, string]> = {
  menstruation: ["მენსტრუაცია", "Menstruation"], follicular: ["ფოლიკულური ფაზა", "Follicular phase"],
  ovulation: ["ოვულაცია", "Ovulation"], luteal: ["ლუთეალური ფაზა", "Luteal phase"], unknown: ["უცნობია", "Unknown"],
};

export function PeriodWorkspace({ data, save, initialDate, summary, openLog, openInsights, openSettings, openPregnancy, birthDate, scrollToCalendar }: {
  data: Data;
  save: (data: Data) => Promise<boolean>;
  initialDate: string;
  summary: boolean;
  openLog: (date?: string, activityOnly?: boolean) => void;
  openInsights: () => void;
  openSettings: () => void;
  openPregnancy: () => void;
  birthDate?: string;
  scrollToCalendar: (ref: RefObject<View | null>) => void;
}) {
  const ka = data.lang === "ka";
  const t = (kaText: string, en: string) => ka ? kaText : en;
  const { features } = useAppFeatures();
  const calendar = periodCalendarModel(data);
  const { today, nextWindow, nextFertileWindow } = calendar;
  const current = cycleAt(data.periods, data.cycleLength, today, today);
  const phase = current && ((calendar.status === "overdue" || calendar.reliability === "low") && current.phase !== "menstruation" ? "unknown" : current.phase);
  const calendarRef = useRef<View>(null);
  const pending = useRef(false);
  const [month, setMonth] = useState(() => monthFor(initialDate));
  const [selected, setSelected] = useState(initialDate);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const visibleDay = selected.startsWith(dateKey(month).slice(0, 7)) ? selected : null;
  const recordedOn = (date: string) => data.periods.find(p => date >= p.start && date < addDays(p.start, p.duration));
  const recorded = visibleDay ? recordedOn(visibleDay) : undefined;
  const selectedInfo = visibleDay ? calendar.day(visibleDay) : null;
  const labels = periodCalendarLegend(ka);
  const review = draft?.days.length ? periodSelectionReview(draft.days, data.periods, draft.replacing, today) : null;
  const history = [...data.periods].sort((a, b) => b.start.localeCompare(a.start));
  const formatPeriod = ({ start, duration }: Period) =>
    `${calendarRangeLabel(start, addDays(start, duration - 1), ka, true)} · ${duration} ${t("დღე", duration === 1 ? "day" : "days")}`;
  function beginMarking(editDate?: string) {
    if (!draft && !busy && !data.pregnancy?.active) {
      const period = editDate ? recordedOn(editDate) : undefined;
      const days = period ? Array.from({ length: period.duration }, (_, index) => addDays(period.start, index)).filter(day => day <= today) : [];
      setDraft({ days, anchor: null, replacing: period?.start });
      if (dateKey(month).slice(0, 7) > today.slice(0, 7)) setMonth(monthFor(today));
      setMessage("");
    }
    scrollToCalendar(calendarRef);
  }
  async function saveDays() {
    if (pending.current || !review?.periods || !review.start || data.pregnancy?.active) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (await save({ ...data, periods: review.periods })) {
        setMonth(monthFor(review.start));
        setSelected(review.start);
        setDraft(null);
        setShowManage(false);
        setMessage(t("პერიოდის ჩანაწერები შენახულია.", "Period entries saved."));
      } else setMessage(t("შენახვა ვერ მოხერხდა. მონიშვნები დარჩა — სცადე ხელახლა.", "Could not save. Your selection is preserved; try again."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function confirmRemoval(start: string) {
    Alert.alert(t("ჩანაწერის წაშლა", "Delete entry"), t("წაიშალოს ეს პერიოდი ყველა მოწყობილობაზე?", "Delete this period on all devices?"), [
      { text: t("გაუქმება", "Cancel"), style: "cancel" },
      { text: t("წაშლა", "Delete"), style: "destructive", onPress: () => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        void save({ ...data, periods: data.periods.filter(p => p.start !== start) }).then(ok => {
          if (ok) setShowManage(false);
          setMessage(ok ? t("პერიოდი წაიშალა.", "Period removed.") : t("წაშლა ვერ მოხერხდა.", "Could not remove the period."));
        }).finally(() => {
          pending.current = false;
          setBusy(false);
        });
      } },
    ]);
  }

  return <View style={s.content}>
    {summary && <>
      <T style={s.muted}>{data.name ? t(`გამარჯობა, ${data.name}`, `Hello, ${data.name}`) : t("შენი სივრცე", "Your space")}</T>
      <T accessibilityRole="header" weight="display" style={s.title}>{t("პერიოდი", "Period")}</T>
    </>}
    <View style={[s.card, { backgroundColor: "#EEE6F7", gap: 8 }]}>
      <T accessibilityRole="header" weight="bold" style={{ fontSize: 20 }}>{t("დღეს", "Today")}</T>
      {data.pregnancy?.active ? <>
        <T>{t("ორსულობის რეჟიმი ჩართულია. პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია.", "Pregnancy mode is active. Period and fertile-day estimates are paused.")}</T>
        <CTA light title={t("ორსულობის მონიტორინგი", "Pregnancy tracking")} onPress={openPregnancy}/>
      </> : <>
        {current && phase ? <T>
          <T weight="bold">{t(`ციკლის დღე: ${current.day}`, `Cycle day: ${current.day}`)}</T>
          {phase !== "unknown" && ` · ${t("სავარაუდო ფაზა:", "Estimated phase:")} ${phases[phase][ka ? 0 : 1]}`}
        </T> : <T>{t("მონიშნე პერიოდის დღეები, რომ ციკლის შეჯამება აქ გამოჩნდეს.", "Log period days to see your cycle summary here.")}</T>}
        {current && <View style={{ gap: 6, marginVertical: 4 }}>
          {([
            ["predicted", nextWindow, t("პროგნოზი შეჩერებულია", "Estimate paused")],
            ["fertile", nextFertileWindow, t("ჯერ არ არის ხელმისაწვდომი", "Not available yet")],
          ] as const).map(([kind, window, noEstimate]) => <View key={kind} style={{ backgroundColor: C.white, borderRadius: 12, padding: 10, gap: 2 }}>
            <View style={[s.row, { gap: 6 }]}><CalendarKeyMark kind={kind}/><T style={{ flexShrink: 1 }}>{labels.find(item => item.key === kind)?.label}</T></View>
            <T weight="bold">{window ? calendarRangeLabel(window.start, window.end, ka) : noEstimate}</T>
          </View>)}
        </View>}
        <CTA title={t("პერიოდის მონიშვნა", "Log period")} onPress={() => beginMarking()} disabled={busy}/>
      </>}
    </View>
    <View ref={calendarRef} collapsable={false} style={[s.card, { paddingHorizontal: 10, gap: 8 }]}>
      <T accessibilityRole="header" weight="bold" style={{ fontSize: 20 }}>{t("კალენდარი", "Calendar")}</T>
      {draft && <T style={s.muted}>{t("მონიშნე პირველი და ბოლო დღე. დღის მოსახსნელად შეეხე ხელახლა. წინა თვეებისთვის გამოიყენე ისრები.", "Select the first and last day. Tap again to remove a day. Use the arrows for earlier months.")}</T>}
      <PeriodDaysPicker ka={ka} calendar={calendar} month={month} setMonth={setMonth} selected={visibleDay} days={draft?.days} busy={busy}
        onPressDay={date => {
          setMessage("");
          if (draft) setDraft(current => current && ({ ...current, ...selectPeriodDay(current.days, current.anchor, date, today) }));
          else { setSelected(date); setShowManage(false); }
        }}/>
      {draft ? <View style={{ borderTopWidth: 1, borderColor: C.line, marginTop: 6, paddingTop: 8, gap: 6 }}>
        {review?.entries.length ? <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
          <T weight="bold">{t("ასე შეინახება", "This is what will be saved")}</T>
          {review.entries.map(period => <T key={period.start}>{formatPeriod(period)}</T>)}
        </View> : null}
        {review && !review.periods && <T accessibilityRole="alert">{t("თითო პერიოდი მაქსიმუმ 10 ზედიზედ დღეა. გადაამოწმე მონიშნული დღეები.", "Each period can have up to 10 consecutive days. Check the selected dates.")}</T>}
        <CTA disabled={busy || !review?.periods} title={busy ? t("ინახება…", "Saving…") : t("შენახვა", "Save")} onPress={() => void saveDays()}/>
        <CTA light disabled={busy} title={t("გაუქმება", "Cancel")} onPress={() => { setDraft(null); setMessage(""); }}/>
      </View> : visibleDay && selectedInfo && <View style={{ borderTopWidth: 1, borderColor: C.line, marginTop: 6, paddingTop: 8, gap: 6 }}>
        <T weight="bold">{calendarDateLabel(visibleDay, ka, true)}</T>
        {labels.filter(({ key }) => selectedInfo.state === key || selectedInfo[key as keyof typeof selectedInfo] === true)
          .map(({ key, symbol, label }) => <View key={key} style={[s.row, { gap: 4 }]}><CalendarKeyMark kind={key} symbol={symbol}/><T style={{ flexShrink: 1 }}>{label}</T></View>)}
        {recorded && <T style={s.muted}>{formatPeriod(recorded)}</T>}
        {visibleDay <= today && features.dailyLog && <CTA light disabled={busy}
          title={selectedInfo.journal ? t("დღიურის გახსნა", "Open journal entry") : t("სიმპტომების ჩაწერა", "Log symptoms")} onPress={() => openLog(visibleDay)}/>}
        {recorded && !data.pregnancy?.active && <CTA light disabled={busy} title={t("პერიოდის რედაქტირება", "Edit period")} onPress={() => beginMarking(visibleDay)}/>}
        {recorded && <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showManage }} style={{ minHeight: 44, justifyContent: "center" }}
            onPress={() => setShowManage(open => !open)}><T>{t("ჩანაწერის მართვა", "Manage entry")}</T></Pressable>
          {showManage && <CTA light disabled={busy} title={t("ჩანაწერის წაშლა", "Delete entry")} onPress={() => confirmRemoval(recorded.start)}/>}
        </>}
      </View>}
      {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
    </View>

    <View style={[s.card, { gap: 6 }]}>
      <T accessibilityRole="header" weight="bold" style={{ fontSize: 20 }}>{t("ციკლის ისტორია", "Cycle history")}</T>
      {!history.length && <T style={s.muted}>{t("შენახული პერიოდები აქ გამოჩნდება.", "Saved periods will appear here.")}</T>}
      {(showHistory ? history : history.slice(0, 3)).map(period => <Pressable key={period.start} accessibilityRole="button"
        accessibilityState={{ disabled: !!draft || busy }} disabled={!!draft || busy} style={{ minHeight: 44, justifyContent: "center", opacity: draft ? 0.5 : 1 }}
        onPress={() => {
          if (data.pregnancy?.active) scrollToCalendar(calendarRef);
          else beginMarking(period.start);
          setMonth(monthFor(period.start));
          setSelected(period.start);
          setMessage("");
          setShowManage(false);
        }}><T>{formatPeriod(period)}</T></Pressable>)}
      {history.length > 3 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHistory }}
        style={{ minHeight: 44, justifyContent: "center" }} onPress={() => setShowHistory(open => !open)}>
        <T weight="bold">{showHistory ? t("ძველი ჩანაწერების დამალვა", "Hide earlier entries") : t("ძველი ჩანაწერები", "Earlier entries")}</T>
      </Pressable>}
    </View>
    <View style={[s.card, { gap: 6 }]}>
      <T accessibilityRole="header" weight="bold" style={{ fontSize: 20 }}>{t("დამატებით", "More")}</T>
      {features.dailyLog && <CTA light title={t("სქესობრივი აქტივობა", "Sexual activity")} onPress={() => openLog(today, true)}/>}
      {features.insights && <CTA light title={t("ციკლის ანალიზი", "Cycle analysis")} onPress={openInsights}/>}
      <CTA light title={t("ციკლის პარამეტრები", "Cycle settings")} onPress={openSettings}/>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showReference }} style={{ minHeight: 44, justifyContent: "center" }}
        onPress={() => setShowReference(open => !open)}><T>{t("საცნობარო ინფორმაცია", "Reference information")}</T></Pressable>
      {showReference && <CycleEducation data={data} birthDate={birthDate}/>}
    </View>
  </View>;
}
