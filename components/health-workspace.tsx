"use client";
import { SiteCopyText } from "@/components/site-copy-provider";
import { useState, useRef, useEffect, Suspense, Fragment } from "react";
import { useMembership } from "@/lib/use-membership";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { useSearchParams } from "next/navigation";
import { featureForRoute, useSiteFeatures } from "@/lib/site-features";
import Link from "next/link";
import { useHealthState, type HealthData } from "@/app/use-health-state";
import {
  addDays,
  calendarDateLabel,
  calendarRangeLabel,
  periodCalendarLegend,
  periodCalendarModel,
  periodDayLabel,
  predictionDateKey,
  symptomPatterns,
  selectPeriodDay,
  periodSelectionReview,
} from "../mobile/src/cycle.mjs";
import { symptoms } from "../mobile/src/symptoms.mjs";
import { healthReport, reminderCalendar, reminderLead, reminderRepeat } from "@/lib/health-report";
import { sexualActivityOptions } from "@/mobile/src/sexual-activity";
import { Check, ChevronDown, Heart, LockKeyhole, MoreHorizontal, ShieldCheck } from "lucide-react";
import CycleOverview, { CalendarKeyMark } from "./cycle-overview";
import CycleEducation from "./cycle-education";

const workspaceNavigation = [
  ["/community", "nav.community"],
  ["/app/dashboard", "nav.period"],
  ["/app/log", "workspace.nav.journal"],
  ["/app/insights", "workspace.nav.insights"],
  ["/app/report", "workspace.nav.report"],
  ["/blog", "nav.library"],
  ["/consultation", "workspace.nav.care"],
  ["/premium", "nav.premium"],
  ["/app/settings", "workspace.nav.settings"],
] as const;

const workspaceTitles: Record<string, string> = {
  dashboard: "tracker.title", log: "journal.title", insights: "insights.title", report: "report.title",
};

type Lang = "ka" | "en";
type Props = {
  data: HealthData;
  save: (d: HealthData) => Promise<void>;
  lang: Lang;
  birthDate?: string;
};
export const phaseLabels: Record<string, [string, string]> = {
  menstruation: ["მენსტრუაცია", "Menstruation"],
  follicular: ["ფოლიკულური", "Follicular"],
  ovulation: ["ოვულაცია", "Ovulation"],
  luteal: ["ლუთეალური", "Luteal"],
  unknown: ["უცნობი", "Unknown"],
};
export function symptomLabel(id: string, lang: Lang) {
  const item = symptoms.find((s) => s[0] === id);
  return item ? item[lang === "ka" ? 1 : 2] : id;
}
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function HealthWorkspace({
  kind,
  lang,
}: {
  kind: string;
  lang: Lang;
}) {
  const health = useHealthState();
  const ka = lang === "ka";
  const features = useSiteFeatures();
  return (
    <section className={kind === "dashboard" ? "workspace period-dashboard" : "workspace"}>
      <nav
        className="workspace-nav"
        aria-label={ka ? "პირადი სივრცე" : "My space"}
      >
        {workspaceNavigation
          .filter(([href]) => {
            const id = featureForRoute(href);
            return (kind !== "dashboard" || ["/app/dashboard", "/app/log", "/app/insights"].includes(href)) && (!id || features[id]);
          })
          .map(([href, id]) => (
            <Link
              key={href}
              href={href}
              aria-current={href.endsWith("/" + kind) ? "page" : undefined}
            >
              {href === "/app/dashboard" ? (ka ? "პერიოდი" : "Period") : href === "/app/insights" ? (ka ? "ციკლის ანალიზი" : "Cycle analysis") : <SiteCopyText id={id} lang={lang}/>}
            </Link>
          ))}
      </nav>
      {["dashboard", "log", "insights"].includes(kind) && <nav className="mobile-period-nav" aria-label={ka ? "პერიოდის სექციები" : "Period sections"}>
        {workspaceNavigation.slice(1, 4).filter(([href]) => {
          const id = featureForRoute(href);
          return id && features[id];
        }).map(([href, id]) => <Link key={href} href={href} aria-current={href.endsWith("/" + kind) ? "page" : undefined}>
          {href === "/app/dashboard" ? (ka ? "პერიოდი" : "Period") : href === "/app/insights" ? (ka ? "ციკლის ანალიზი" : "Cycle analysis") : <SiteCopyText id={id} lang={lang}/>}
        </Link>)}
      </nav>}
      <main className="workspace-main">
        <p className={kind === "dashboard" ? "inner-kicker period-desktop-heading" : "inner-kicker"}>
          <SiteCopyText id="workspace.kicker" lang={lang}/>
        </p>
        <h1 className={kind === "dashboard" ? "period-desktop-heading" : undefined}>{kind === "reminders" ? (ka ? "კალენდრის შეხსენებები" : "Calendar reminders") : <SiteCopyText id={workspaceTitles[kind] || "workspace.title"} lang={lang}/>}</h1>
        {!health.loaded ? (
          <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p>
        ) : !health.session ? (
          <p>
            {ka
              ? "პირადი ჩანაწერებისთვის გაიარე ავტორიზაცია."
              : "Sign in to access your records."}{" "}
            <Link href="/login">
              {ka ? "შესვლა / რეგისტრაცია" : "Sign in / register"}
            </Link>
          </p>
        ) : health.error ? (
          <div role="alert">
            <p>
              {ka
                ? "ჩანაწერები ვერ ჩაიტვირთა. მონაცემების დასაცავად რედაქტირება შეჩერებულია."
                : "Records could not be loaded. Editing is paused to protect your data."}
            </p>
            <button onClick={() => location.reload()}>
              {ka ? "განახლება" : "Reload"}
            </button>
          </div>
        ) : (
          <Fragment key={health.session.user.id}>
            {health.legacy && (
              <button
                onClick={() => void health.importLegacy().catch(() => {})}
              >
                {ka
                  ? "ძველი ჩანაწერების ანგარიშში გადატანა"
                  : "Import older entries"}
              </button>
            )}
            {kind === "dashboard" ? (
              <PeriodCalendar {...health} lang={lang} birthDate={health.session.user.user_metadata?.date_of_birth} />
            ) : kind === "log" ? (
              <Suspense fallback={<p>…</p>}>
                <Journal {...health} lang={lang} />
              </Suspense>
            ) : kind === "report" ? (
              <PremiumReport data={health.data} lang={lang} />
            ) : kind === "reminders" ? (
              <CalendarReminders data={health.data} lang={lang}/>
            ) : (
              <HealthInsights data={health.data} lang={lang} birthDate={health.session.user.user_metadata?.date_of_birth} />
            )}
          </Fragment>
        )}
      </main>
    </section>
  );
}

function CalendarReminders({ data, lang }: Pick<Props, "data" | "lang">) {
  const ka = lang === "ka";
  const [repeat, setRepeat] = useState<(typeof reminderRepeat)[number][0]>("next");
  const [lead, setLead] = useState<(typeof reminderLead)[number][0]>("12h");
  const { starts } = periodCalendarModel(data);
  return <section className="workspace-card">
    <p>{ka ? "გადაიტანე სავარაუდო დღეები პირად კალენდარში. მოვლენის სათაური ჯანმრთელობის დეტალებს არ შეიცავს." : "Export estimated dates to your personal calendar. Event titles contain no health details."}</p>
    <div className="workspace-form">
      <label>{ka ? "რომელი თარიღები გადავიტანო?" : "Which dates should be exported?"}
        <select value={repeat} onChange={event => setRepeat(event.currentTarget.value as typeof repeat)}>{reminderRepeat.map(([value, ge, en]) => <option value={value} key={value}>{ka ? ge : en}</option>)}</select>
      </label>
      <label>{ka ? "როდის გამახსენოს?" : "When should it remind me?"}
        <select value={lead} onChange={event => setLead(event.currentTarget.value as typeof lead)}>{reminderLead.map(([value, ge, en]) => <option value={value} key={value}>{ka ? ge : en}</option>)}</select>
      </label>
    </div>
    <p>{ka ? "შეხსენება იმუშავებს ფაილის პირად კალენდარში შეტანის შემდეგ." : "Reminders work after importing the file into your personal calendar."}</p>
    <button type="button" disabled={!starts.length} onClick={() => download(reminderCalendar(starts, { repeat, lead }), "tuta-reminders.ics", "text/calendar")}>
      <SiteCopyText id="tracker.download" lang={lang}/>
    </button>
    {!starts.length && <p>{ka ? "ჯერ საჭიროა მიმდინარე პერიოდის ისტორია. ორსულობისა და დაგვიანების დროს პროგნოზები შეჩერებულია." : "Current period history is needed. Estimates are paused during pregnancy or an overdue cycle."}</p>}
  </section>;
}

export function ProfileHealthTools({ lang }: { lang: Lang }) {
  const { session, data, loaded, error, save } = useHealthState();
  const features = useSiteFeatures();
  if (!loaded || !session || session.user.is_anonymous) return null;
  return <ProfileHealthActions key={session.user.id} data={data} save={save} error={error} lang={lang} period={features.period} reminders={features.notifications} accountDeletion={features["account-deletion"]}/>;
}

function ProfileHealthActions({ data, save, error, lang, period, reminders, accountDeletion }: Props & {
  error: string; period: boolean; reminders: boolean; accountDeletion: boolean;
}) {
  const ka = lang === "ka";
  const [name, setName] = useState<string | null>(null);
  const [length, setLength] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const cycleSettings = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.location.hash === "#cycle-settings" && cycleSettings.current) {
      cycleSettings.current.open = true;
      cycleSettings.current.scrollIntoView({ block: "start" });
    }
  }, []);
  async function persist(next: HealthData, cleared = false) {
    setPending(true);
    setNotice("");
    try {
      await save(next);
      setName(null);
      setLength(null);
      setNotice(cleared ? (ka ? "ჩანაწერები წაიშალა." : "Entries deleted.") : (ka ? "პარამეტრები შენახულია." : "Settings saved."));
    } catch {
      setNotice(ka ? "ცვლილება ვერ შეინახა. სცადე ხელახლა." : "Could not save the change. Try again.");
    } finally {
      setPending(false);
    }
  }
  return <section className="workspace-card">
    <h2>{ka ? "მონაცემები და უსაფრთხოება" : "Data & safety"}</h2>
    <div className="period-shortcuts">
      <Link href="/app/activity">{ka ? "შეტყობინებები" : "Notifications"}</Link>
      {reminders && <Link href="/app/reminders">{ka ? "კალენდრის შეხსენებები" : "Calendar reminders"}</Link>}
      {accountDeletion && <Link href="/app/account-deletion">{ka ? "ანგარიშის წაშლის მოთხოვნა" : "Request account deletion"}</Link>}
    </div>
    {period && <details ref={cycleSettings} id="cycle-settings" className="workspace-card">
      <summary>{ka ? "ციკლის პარამეტრები" : "Cycle settings"}</summary>
      <form className="workspace-form" onSubmit={event => {
        event.preventDefault();
        const cycleLength = Number(length ?? data.cycleLength);
        if (pending || error || !Number.isInteger(cycleLength) || cycleLength < 21 || cycleLength > 45) return;
        void persist({ ...data, name: (name ?? data.name).trim(), cycleLength });
      }}>
        <label>{ka ? "სახელი (სურვილისამებრ)" : "Name (optional)"}<input maxLength={80} value={name ?? data.name} onChange={event => setName(event.target.value)}/></label>
        <label>{ka ? "ციკლის ხანგრძლივობა (დღე)" : "Cycle length (days)"}<input type="number" required min={21} max={45} value={length ?? data.cycleLength} onChange={event => setLength(event.target.value)}/></label>
        <button type="submit" disabled={pending || !!error}>{ka ? "შენახვა" : "Save"}</button>
        <Link href="/app/dashboard#period-calendar">{ka ? "პერიოდის თარიღების რედაქტირება" : "Edit period dates"}</Link>
      </form>
    </details>}
    <div className="workspace-row">
    <button type="button" disabled={pending || !!error} onClick={() => {
      if (window.confirm(ka ? "ფაილი პირად ჯანმრთელობის მონაცემებს შეიცავს. გინდა ჩამოტვირთვა?" : "This file contains private health data. Download it?"))
        download(JSON.stringify(data, null, 2), "tuta-health-export.json", "application/json");
    }}>{ka ? "ჩემი მონაცემების ექსპორტი" : "Export my data"}</button>
    <button type="button" disabled={pending || !!error} onClick={() => {
      if (!window.confirm(ka ? "პერიოდის, დღიურისა და ორსულობის ჩანაწერები ყველა მოწყობილობიდან წაიშლება. ანგარიშსა და შეკვეთებს ეს არ ეხება. ქმედება შეუქცევადია. გავაგრძელოთ?" : "Permanently delete period, journal and pregnancy entries across all devices? Your account and orders will remain.")) return;
      void persist({ version: 1, lang: data.lang, name: "", cycleLength: 28, periods: [], logs: [] }, true);
    }}>{ka ? "ჯანმრთელობის ჩანაწერების წაშლა" : "Delete health entries"}</button>
    </div>
    <p role="status">{error ? (ka ? "ჩანაწერები ვერ ჩაიტვირთა." : "Could not load your records.") : notice}</p>
  </section>;
}

export function PeriodCalendar({ data, save, lang, birthDate }: Props) {
  const ka = lang === "ka";
  const t = (kaText: string, en: string) => ka ? kaText : en;
  const features = useSiteFeatures();
  const calendar = periodCalendarModel(data);
  const { today } = calendar;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<{ days: string[]; anchor: string | null; replacing?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const calendarSection = useRef<HTMLElement>(null);
  const first = month + "-01";
  const offset = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const visibleDay = selected.startsWith(month) ? selected : null;
  const recordedOn = (date: string) => data.periods.find(p => date >= p.start && date < addDays(p.start, p.duration));
  const recorded = visibleDay ? recordedOn(visibleDay) : undefined;
  const selectedInfo = visibleDay ? calendar.day(visibleDay) : null;
  const labels = periodCalendarLegend(ka, !!draft);
  const selectedDays = new Set(draft?.days);
  const review = draft?.days.length ? periodSelectionReview(draft.days, data.periods, draft.replacing, today) : null;
  const selectionError = review && !review.periods ? t("თითო პერიოდი მაქსიმუმ 10 ზედიზედ დღეა. გადაამოწმე მონიშნული დღეები.", "Each period can have up to 10 consecutive days. Check the selected dates.") : null;
  const history = [...data.periods].sort((a, b) => b.start.localeCompare(a.start));
  const formatPeriod = ({ start, duration }: { start: string; duration: number }) =>
    `${calendarRangeLabel(start, addDays(start, duration - 1), ka, true)} · ${duration} ${t("დღე", duration === 1 ? "day" : "days")}`;
  useUnsavedChanges(!!draft?.days.length, ka);
  useEffect(() => {
    if (window.location.hash === "#period-calendar") calendarSection.current?.focus();
  }, []);

  function focusCalendar() {
    calendarSection.current?.focus({ preventScroll: true });
    calendarSection.current?.scrollIntoView({ block: "start" });
  }
  function beginMarking(editDate?: string) {
    if (!draft && !busy && !data.pregnancy?.active) {
      const period = editDate ? recordedOn(editDate) : undefined;
      const days = period
        ? Array.from({ length: period.duration }, (_, index) => addDays(period.start, index)).filter(day => day <= today)
        : [];
      setDraft({ days, anchor: null, replacing: period?.start });
      if (month > today.slice(0, 7)) setMonth(today.slice(0, 7));
      setMessage("");
    }
    focusCalendar();
  }
  function moveMonth(delta: number) {
    const date = new Date(first + "T12:00:00Z");
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(date.toISOString().slice(0, 7));
  }
  async function saveDays() {
    if (busy || !review?.periods || !review.start || data.pregnancy?.active) return;
    setBusy(true);
    setMessage("");
    try {
      await save({ ...data, periods: review.periods });
      setSelected(review.start);
      setMonth(review.start.slice(0, 7));
      setDraft(null);
      setMessage(t("პერიოდის ჩანაწერები შენახულია.", "Period entries saved."));
    } catch {
      setMessage(t("შენახვა ვერ მოხერხდა. მონიშვნები დარჩა — სცადე ხელახლა.", "Could not save. Your selection is preserved; try again."));
    } finally { setBusy(false); }
  }
  async function removePeriod(start: string) {
    if (busy || !confirm(t("წაიშალოს ეს პერიოდი ყველა მოწყობილობაზე?", "Delete this period on all devices?"))) return;
    setBusy(true);
    setMessage("");
    try {
      await save({ ...data, periods: data.periods.filter(p => p.start !== start) });
      setMessage(t("პერიოდი წაიშალა.", "Period removed."));
    } catch {
      setMessage(t("წაშლა ვერ მოხერხდა.", "Could not remove the period."));
    } finally { setBusy(false); }
  }
  function historyEntry(period: { start: string; duration: number }) {
    return <li key={period.start}><button type="button" className="history-entry" disabled={!!draft || busy} onClick={() => {
      if (data.pregnancy?.active) focusCalendar();
      else beginMarking(period.start);
      setMonth(period.start.slice(0, 7));
      setSelected(period.start);
      setMessage("");
    }}>{formatPeriod(period)}</button></li>;
  }

  return <>
    <div className="period-mobile-heading">
      <p>{data.name ? t(`გამარჯობა, ${data.name}`, `Hello, ${data.name}`) : t("შენი სივრცე", "Your space")}</p>
      <h1>{t("პერიოდი", "Period")}</h1>
    </div>
    <CycleOverview periods={data.periods} cycleLength={data.cycleLength} pregnancyActive={data.pregnancy?.active}
      calendar={calendar} lang={lang} onMark={beginMarking}/>
    {data.pregnancy?.active && <button type="button" disabled={busy} onClick={() => {
      if (confirm(t("გამორთო ორსულობის რეჟიმი? ისტორია შენარჩუნდება.", "Turn off pregnancy mode? History will be preserved."))) {
        void save({ ...data, pregnancy: { ...data.pregnancy!, active: false, updatedAt: new Date().toISOString() } })
          .catch(() => setMessage(t("შენახვა ვერ მოხერხდა.", "Could not save.")));
      }
    }}>{t("ორსულობის რეჟიმის გამორთვა", "Turn off pregnancy mode")}</button>}

    <section ref={calendarSection} id="period-calendar" className="workspace-card period-calendar" tabIndex={-1} aria-labelledby="period-calendar-title">
      <h2 id="period-calendar-title">{t("კალენდარი", "Calendar")}</h2>
      {draft && <p>{t("მონიშნე პირველი და ბოლო დღე. დღის მოსახსნელად დააჭირე ხელახლა. წინა თვეებისთვის გამოიყენე ისრები.", "Select the first and last day. Tap again to remove a day. Use the arrows for earlier months.")}</p>}
      <div className="workspace-row period-month">
        <button type="button" aria-label={t("წინა თვე", "Previous month")} disabled={busy} onClick={() => moveMonth(-1)}>‹</button>
        <h3 aria-live="polite">{new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(first))}</h3>
        <button type="button" aria-label={t("შემდეგი თვე", "Next month")} disabled={busy || (!!draft && month >= today.slice(0, 7))} onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className="period-grid">
        {(ka ? ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).map(d => <span key={d}>{d}</span>)}
        {Array.from({ length: Math.ceil((offset + dayCount) / 7) * 7 }, (_, index) => {
          const number = index - offset + 1;
          if (number < 1 || number > dayCount) return <span key={index} aria-hidden="true"/>;
          const date = addDays(first, number - 1);
          const day = calendar.day(date);
          const marked = selectedDays.has(date);
          const symbols = labels.filter(item => item.symbol && (item.key === "draft" ? marked : day[item.key as keyof typeof day] === true));
          return <button key={date} type="button" className={`day ${day.state}`} aria-current={day.today ? "date" : undefined}
            aria-label={periodDayLabel(day, date, ka, marked)}
            aria-pressed={draft ? marked : visibleDay === date}
            disabled={busy || (!!draft && date > today)}
            onClick={() => {
              setMessage("");
              if (draft) setDraft(current => current && ({ ...current, ...selectPeriodDay(current.days, current.anchor, date, today) }));
              else setSelected(date);
            }}>
            <span className="period-date-number">{number}</span>
            {symbols.length > 0 && <span className="period-day-markers" aria-hidden="true">{symbols.map(item => <span key={item.key} data-mark={item.key}>{item.symbol}</span>)}</span>}
          </button>;
        })}
      </div>
      <div className="period-legend">
        <h3>{t("კალენდრის ნიშნები", "Calendar key")}</h3>
        <ul>{labels.map(({ key, symbol, label }) => <li key={key}><CalendarKeyMark kind={key} symbol={symbol}/>{label}</li>)}</ul>
      </div>
      {draft ? <div className="period-day-detail">
        {review?.entries.length ? <div aria-live="polite"><h3>{t("ასე შეინახება", "This is what will be saved")}</h3>
          <ul>{review.entries.map(period => <li key={period.start}>{formatPeriod(period)}</li>)}</ul>
        </div> : null}
        {selectionError && <p role="status">{selectionError}</p>}
        <div className="workspace-row">
          <button type="button" className="period-primary" disabled={busy || !review?.periods} onClick={() => void saveDays()}>
            {busy ? t("ინახება…", "Saving…") : t("შენახვა", "Save")}
          </button>
          <button type="button" disabled={busy} onClick={() => { setDraft(null); setMessage(""); }}>{t("გაუქმება", "Cancel")}</button>
        </div>
      </div> : visibleDay && selectedInfo && <div className="period-day-detail" aria-live="polite">
        <h3>{calendarDateLabel(visibleDay, ka, true)}</h3>
        <ul className="period-day-info">{labels.filter(({ key }) => selectedInfo.state === key || selectedInfo[key as keyof typeof selectedInfo] === true)
          .map(({ key, symbol, label }) => <li key={key}><CalendarKeyMark kind={key} symbol={symbol}/>{label}</li>)}</ul>
        {recorded && <p>{formatPeriod(recorded)}</p>}
        {visibleDay <= today && <div className="workspace-row">
          {features.dailyLog && <Link href={`/app/log?date=${visibleDay}`}>{selectedInfo.journal ? t("დღიურის გახსნა", "Open journal entry") : t("სიმპტომების ჩაწერა", "Log symptoms")}</Link>}
          {recorded && !data.pregnancy?.active && <button type="button" disabled={busy} onClick={() => beginMarking(visibleDay)}>{t("პერიოდის რედაქტირება", "Edit period")}</button>}
        </div>}
        {recorded && <details className="period-estimates">
          <summary>{t("ჩანაწერის მართვა", "Manage entry")}</summary>
          <button type="button" disabled={busy} onClick={() => void removePeriod(recorded.start)}>{t("ჩანაწერის წაშლა", "Delete entry")}</button>
        </details>}
      </div>}
      {message && <p role="status">{message}</p>}
    </section>

    <section className="workspace-card period-history" aria-labelledby="period-history-title">
      <h2 id="period-history-title">{t("ციკლის ისტორია", "Cycle history")}</h2>
      {history.length ? <>
        <ul>{history.slice(0, 3).map(historyEntry)}</ul>
        {history.length > 3 && <details><summary>{t("ძველი ჩანაწერები", "Earlier entries")}</summary><ul>{history.slice(3).map(historyEntry)}</ul></details>}
      </> : <p>{t("შენახული პერიოდები აქ გამოჩნდება.", "Saved periods will appear here.")}</p>}
    </section>
    <section className="workspace-card period-more">
      <h2>{t("დამატებით", "More")}</h2>
      <div className="period-shortcuts">
        {features.dailyLog && <Link href="/app/log?section=activity#journal-activity">{t("სქესობრივი აქტივობა", "Sexual activity")}</Link>}
        {features.insights && <Link href="/app/insights">{t("ციკლის ანალიზი", "Cycle analysis")}</Link>}
        <Link href="/app/settings#cycle-settings">{t("ციკლის პარამეტრები", "Cycle settings")}</Link>
      </div>
      <details className="period-estimates"><summary>{t("საცნობარო ინფორმაცია", "Reference information")}</summary>
        <CycleEducation periods={data.periods} birthDate={birthDate} lang={lang}/>
      </details>
    </section>
  </>;
}

function JournalFace({ mood }: { mood: string }) {
  const mouth = mood === "happy" ? "M21 36q9 13 18 0" : mood === "low" ? "M22 42q8-12 16 0"
    : mood === "tense" ? "m21 39 4-3 5 3 5-3 4 3" : "M24 39q6 5 12 0";
  return <svg width="50" height="50" viewBox="0 0 60 60" aria-hidden="true">
    <circle cx="30" cy="30" r="28" fill={mood === "happy" ? "#fdf0cc" : mood === "low" ? "#d8e0ed" : "#e3d8f1"}/>
    {mood === "calm" || mood === "tired" ? <path d="M15 24q5 7 10 0m10 0q5 7 10 0" fill="none" stroke="#1e1b2e" strokeWidth="2"/>
      : <><circle cx="21" cy="25" r="2.5" fill="#1e1b2e"/><circle cx="39" cy="25" r="2.5" fill="#1e1b2e"/></>}
    <path d={mouth} fill="none" stroke="#1e1b2e" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

function Journal({ data, save, lang }: Props) {
  const params = useSearchParams();
  const requested = params.get("date");
  const ka = lang === "ka",
    today = predictionDateKey();
  const initial =
    requested &&
    /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
    Number.isFinite(Date.parse(requested)) &&
    requested <= today
      ? requested
      : today;
  const [date, setDate] = useState(initial),
    [intimacyOpen, setIntimacyOpen] = useState(() => params.get("section") === "activity"),
    [query, setQuery] = useState(""),
    [custom, setCustom] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const blank = (day: string) =>
    data.logs.find((l) => l.date === day) || {
      date: day,
      mood: "calm",
      energy: 3,
      pain: 1,
      flow: "none",
      symptoms: [],
      notes: "",
    };
  const [draft, setEntry] = useState(() => blank(initial));
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty,ka);
  const baseline = useRef("");
  const entry = dirty ? draft : blank(date);
  function change(p: Partial<typeof entry>) {
    if (!dirty) baseline.current = JSON.stringify(blank(date));
    setEntry({ ...entry, ...p });
    setDirty(true);
  }
  function selectDate(value: string) {
    if (
      dirty &&
      !confirm(
        ka ? "შეუნახავი ცვლილებები გაუქმდეს?" : "Discard unsaved changes?",
      )
    )
      return;
    setDate(value);
    setIntimacyOpen(false);
    setEntry(blank(value));
    setDirty(false);
    setMessage("");
  }
  async function submit(remove = false) {
    if (dirty && baseline.current !== JSON.stringify(blank(date))) {
      setMessage(
        ka
          ? "ეს ჩანაწერი სხვა მოწყობილობაზე შეიცვალა. აირჩიე სხვა დღე და დაბრუნდი განახლებული ჩანაწერის სანახავად."
          : "This entry changed on another device. Select another date and return to review it.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (date > today) throw Error();
      const savedEntry = { ...entry, date };
      if (savedEntry.sexualActivity === undefined) delete savedEntry.sexualActivity;
      await save({
        ...data,
        logs: [
          ...data.logs.filter((l) => l.date !== date),
          ...(remove ? [] : [savedEntry]),
        ].sort((a, b) => a.date.localeCompare(b.date)),
      });
      setDirty(false);
      setMessage(ka ? "შენახულია" : "Saved");
      if (remove)
        setEntry({
          date,
          mood: "calm",
          energy: 3,
          pain: 1,
          flow: "none",
          symptoms: [],
          notes: "",
        });
    } catch {
      setMessage(ka ? "შენახვა ვერ მოხერხდა." : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="workspace-card workspace-form app-style-journal"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset disabled={busy} className="workspace-form">
        <label>
          <SiteCopyText id="journal.date" lang={lang}/>
          <input
            type="date"
            required
            max={today}
            value={date}
            onChange={(e) => selectDate(e.target.value)}
          />
        </label>
        <fieldset>
          <legend><SiteCopyText id="journal.mood" lang={lang}/></legend>
          <div className="workspace-row journal-moods">
            {["happy", "calm", "low", "tense", "tired"].map((id) => (
              <button
                type="button"
                key={id}
                aria-pressed={entry.mood === id}
                onClick={() => change({ mood: id })}
              >
                <JournalFace mood={id}/>
                <SiteCopyText id={`journal.mood.${id}`} lang={lang}/>
              </button>
            ))}
          </div>
        </fieldset>
        {(["energy", "pain"] as const).map((key) => (
          <fieldset key={key}>
            <legend>
            <SiteCopyText id={`journal.${key}`} lang={lang}/>{" "}
            (1–5)
            </legend>
            <div className="journal-scores">
              {[1, 2, 3, 4, 5].map(score => (
                <button key={score} type="button" aria-pressed={entry[key] === score}
                  onClick={() => change({ [key]: score })}>{score}</button>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend><SiteCopyText id="journal.flow" lang={lang}/></legend>
          <div className="workspace-row">
            {[
              ["none", "არ არის", "None"],
              ["spotting", "ლაქები", "Spotting"],
              ["light", "მსუბუქი", "Light"],
              ["medium", "საშუალო", "Medium"],
              ["heavy", "ძლიერი", "Heavy"],
            ].map(([id, a, b]) => (
              <button key={id} type="button" aria-pressed={entry.flow === id} onClick={() => change({ flow: id })}>
                {ka ? a : b}
              </button>
            ))}
          </div>
        </fieldset>
        <section id="journal-activity" className="journal-intimacy">
          <button type="button" className="journal-intimacy-trigger" aria-expanded={intimacyOpen}
            onClick={() => setIntimacyOpen(open => !open)}>
            <span className="journal-intimacy-icon"><LockKeyhole size={22} aria-hidden="true"/></span>
            <span className="journal-intimacy-text">
              <strong>{ka ? "სქესობრივი აქტივობა" : "Sexual activity"}</strong>
              <small>{ka ? "პირადი · არასავალდებულო" : "Private · optional"}</small>
            </span>
            <ChevronDown size={18} aria-hidden="true"/>
          </button>
          {intimacyOpen ? <fieldset className="journal-intimacy-options">
            <legend>{ka ? "ეს ჩანაწერი პროგნოზს არ ცვლის." : "This entry does not change predictions."}</legend>
            {sexualActivityOptions.map(([id, a, b]) => {
              const Icon = id === "protected" ? ShieldCheck : id === "unprotected" ? Heart : MoreHorizontal;
              const checked = entry.sexualActivity === id;
              return <label key={id} className="journal-intimacy-option" data-selected={checked}>
                <input className="sr-only" type="radio" name="journal-sexual-activity" value={id} checked={checked}
                  onChange={() => change({ sexualActivity: id })}/>
                <span className="journal-intimacy-icon" data-option={id}><Icon size={18} aria-hidden="true"/></span>
                <span className="journal-intimacy-text">{ka ? a : b}</span>
                {checked ? <Check size={20} aria-hidden="true"/> : null}
              </label>;
            })}
            {entry.sexualActivity ? <button type="button" className="journal-intimacy-clear"
              onClick={() => change({ sexualActivity: undefined })}>
              {ka ? "მონიშვნის მოხსნა" : "Clear selection"}
            </button> : null}
          </fieldset> : null}
        </section>
        <fieldset>
          <legend><SiteCopyText id="journal.symptoms" lang={lang}/></legend>
          <label>
            <SiteCopyText id="journal.findSymptom" lang={lang}/>
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="symptom-choices">
            {symptoms
              .filter((s) =>
                s.join(" ").toLowerCase().includes(query.toLowerCase()),
              )
              .map(([id, a, b]) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={entry.symptoms.includes(id)}
                    onChange={() =>
                      change({
                        symptoms: entry.symptoms.includes(id)
                          ? entry.symptoms.filter((s) => s !== id)
                          : [...entry.symptoms, id],
                      })
                    }
                  />
                  {ka ? a : b}
                </label>
              ))}
          </div>
          {entry.symptoms
            .filter((id) => !symptoms.some((s) => s[0] === id))
            .map((id) => (
              <button
                type="button"
                key={id}
                onClick={() =>
                  change({ symptoms: entry.symptoms.filter((s) => s !== id) })
                }
              >
                {id} ×
              </button>
            ))}
          <label>
            <SiteCopyText id="journal.customSymptom" lang={lang}/>
            <input
              maxLength={60}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (custom.trim())
                change({
                  symptoms: [...new Set([...entry.symptoms, custom.trim()])],
                });
              setCustom("");
            }}
          >
            <SiteCopyText id="journal.add" lang={lang}/>
          </button>
        </fieldset>
        <label>
          <SiteCopyText id="journal.notes" lang={lang}/>
          <textarea
            maxLength={2000}
            rows={4}
            value={entry.notes}
            onChange={(e) => change({ notes: e.target.value })}
          />
        </label>
        <button disabled={busy}>
          <SiteCopyText id="journal.save" lang={lang}/>
        </button>
        {data.logs.some((l) => l.date === date) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  ka
                    ? "წაიშალოს ამ დღის ჩანაწერი?"
                    : "Delete this day’s entry?",
                )
              )
                void submit(true);
            }}
          >
            <SiteCopyText id="journal.delete" lang={lang}/>
          </button>
        )}
          <p role="status">{message}</p>
      </fieldset>
    </form>
  );
}

function PremiumReport({ data, lang }: { data: HealthData; lang: Lang }) {
  const {status:state}=useMembership();
  if (state === "active")
    return <HealthInsights data={data} lang={lang} report />;
  return (
    <section className="workspace-card">
      <p role="status">
        {state === "loading"
          ? lang === "ka"
            ? "იტვირთება…"
            : "Loading…"
          : state === "error"
            ? lang === "ka"
              ? "პრემიუმის სტატუსი ვერ შემოწმდა. განაახლე გვერდი."
              : "Could not verify membership. Reload this page."
            : <>🔒 <SiteCopyText id="report.locked" lang={lang}/></>}
      </p>
      {state === "locked" && (
        <Link href="/premium">
          {lang === "ka" ? "პრემიუმის ნახვა" : "View Premium"}
        </Link>
      )}
    </section>
  );
}

function HealthInsights({
  data,
  lang,
  report = false,
  birthDate,
}: {
  data: HealthData;
  lang: Lang;
  report?: boolean;
  birthDate?: string;
}) {
  const [includeActivity, setIncludeActivity] = useState(false);
  const ka = lang === "ka",
    summary = healthReport(data, undefined, report && includeActivity),
    patterns = symptomPatterns(data.periods, data.logs);
  const membership=useMembership();
  const features = useSiteFeatures();
  return (
    <div className={report ? "health-report" : ""}>
      {!report && features.doctorReport && <Link className="period-related-link" href="/app/report">{ka ? "ექიმისთვის ანგარიში" : "Report for your doctor"} →</Link>}
      {!report && <CycleEducation periods={data.periods} birthDate={birthDate} lang={lang} />}
      <p>
        {summary.from} / {summary.today}
      </p>
      <p>
        <SiteCopyText id="insights.periodNote" lang={lang}/>
      </p>
      {report && <>
        <label className="no-print report-intimacy-opt-in">
          <input type="checkbox" checked={includeActivity} onChange={event => setIncludeActivity(event.target.checked)}/>
          {ka ? "PDF-ში სქესობრივი აქტივობის დამატება" : "Include sexual activity in the PDF"}
        </label>
        <button
          className="no-print"
          onClick={() => {
            if (
              confirm(
                ka
                  ? "ანგარიში შეიცავს ჯანმრთელობის პირად ინფორმაციას. გააგრძელებ? ბეჭდვის ფანჯარაში აირჩიე PDF-ად შენახვა."
                  : "This report contains private health information. Continue and choose Save as PDF in the print dialog?",
              )
            )
              window.print();
          }}
        >
          <SiteCopyText id="report.download" lang={lang}/>
        </button>
      </>}
      {report && summary.sexualActivity?.length ? (
        <section className="workspace-card">
          <h2>{ka ? "სქესობრივი აქტივობა" : "Sexual activity"}</h2>
          <ul>{summary.sexualActivity.map(({ date, sexualActivity }) => (
            <li key={date}>{date}: {sexualActivityOptions.find(([id]) => id === sexualActivity)?.[ka ? 1 : 2]}</li>
          ))}</ul>
        </section>
      ) : null}
      <div className="workspace-grid">
        <section className="workspace-card">
          <h2><SiteCopyText id="insights.lengths" lang={lang}/></h2>
          {!summary.cycles.length ? (
            <p>
              <SiteCopyText id="insights.noCycles" lang={lang}/>
            </p>
          ) : (
            <>
              <p>
                <SiteCopyText id="insights.average" lang={lang}/>: {summary.mean?.toFixed(1)}{" "}
                {ka ? "დღე" : "days"}
              </p>
              <table>
                <thead>
                  <tr>
                    <th><SiteCopyText id="insights.start" lang={lang}/></th>
                    <th><SiteCopyText id="insights.days" lang={lang}/></th>
                    <th><SiteCopyText id="insights.bleeding" lang={lang}/></th>
                    <th><SiteCopyText id="insights.flag" lang={lang}/></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.cycles.map((p) => (
                    <tr key={p.start}>
                      <td>{p.start}</td>
                      <td>
                        <span
                          className="length-bar"
                          style={{ width: Math.min(p.length * 2, 160) }}
                        />
                        {p.length}
                      </td>
                      <td>{p.duration}</td>
                      <td>
                        {p.irregular
                          ? ka
                            ? "გადახრა >7 დღე"
                            : "Deviation >7 days"
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
        <section className="workspace-card">
          <h2><SiteCopyText id="insights.symptomFrequency" lang={lang}/></h2>
          <p>
            {ka
              ? "დათვლილია დღეები, არა სიმპტომის სიმძიმე."
              : "Counts are recorded days, not severity."}
          </p>
          {summary.symptoms.length ? (
            summary.symptoms.map((s) => (
              <div className="symptom-bar" key={s.name}>
                <span>{symptomLabel(s.name, lang)}</span>
                <meter
                  value={s.count}
                  min={0}
                  max={Math.max(1, summary.logs)}
                />
                <strong>{s.count}</strong>
              </div>
            ))
          ) : (
            <p>
              {ka
                ? "სიმპტომები ჯერ არ არის ჩაწერილი."
                : "No symptoms recorded."}
            </p>
          )}
        </section>
      </div>
      <section className="workspace-card">
        <h2>
          {ka
            ? "სავარაუდო ფაზების საშუალო ხანგრძლივობა"
            : "Estimated average phase durations"}
        </h2>
        {summary.cycles.length ? (
          summary.phases.map((p) => (
            <p key={p.phase}>
              {phaseLabels[p.phase]?.[ka ? 0 : 1]}: {p.days.toFixed(1)}{" "}
              {ka ? "დღე" : "days"}
            </p>
          ))
        ) : (
          <p>
            {ka
              ? "საჭიროა დასრულებული ციკლის ისტორია."
              : "Completed cycle history is needed."}
          </p>
        )}
      </section>
      <section className="workspace-card">
        <h2><SiteCopyText id="insights.patterns" lang={lang}/></h2>
        <p>
          {ka
            ? "მთელ ისტორიაში, სულ მცირე 3 დასრულებული ციკლის ერთსა და იმავე სავარაუდო ფაზაში. ეს დიაგნოზი არ არის."
            : "Across all history, in the same estimated phase in at least 3 completed cycles. This is not a diagnosis."}
        </p>
        {!report&&!membership.active ? <p>🔒 {ka?"განმეორებადი სიმპტომების ანალიზი Premium-შია.":"Repeating symptom analysis is included in Premium."} <Link href="/premium">{ka?"პაკეტების ნახვა":"View plans"}</Link></p> : patterns.length ? (
          patterns.map((p) => (
            <p key={p.symptom + p.phase}>
              {symptomLabel(p.symptom, lang)} ·{" "}
              {phaseLabels[p.phase]?.[ka ? 0 : 1]} · {p.count}/{p.total}
            </p>
          ))
        ) : (
          <p>
            {ka
              ? "ამ ეტაპზე განმეორებადი ნიმუში არ გამოვლენილა."
              : "No repeating pattern detected yet."}
          </p>
        )}
      </section>
    </div>
  );
}
