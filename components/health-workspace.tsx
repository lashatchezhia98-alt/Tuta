"use client";
import { SiteCopyText } from "@/components/site-copy-provider";
import { useEffect, useState, useRef, Suspense, Fragment } from "react";
import { useMembership } from "@/lib/use-membership";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { featureForRoute, useSiteFeatures } from "@/lib/site-features";
import Link from "next/link";
import { useHealthState, type HealthData } from "@/app/use-health-state";
import {
  addDays,
  dateKey,
  calendarState,
  forecast,
  symptomPatterns,
  distance,
  overlapsPeriod,
} from "../mobile/src/cycle.mjs";
import { symptoms } from "../mobile/src/symptoms.mjs";
import { healthReport, reminderCalendar } from "@/lib/health-report";
import CycleOverview from "./cycle-overview";
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
    <section className="workspace">
      <nav
        className="workspace-nav"
        aria-label={ka ? "პირადი სივრცე" : "My space"}
      >
        {workspaceNavigation
          .filter(([href]) => {
            const id = featureForRoute(href);
            return !id || features[id];
          })
          .map(([href, id]) => (
            <Link
              key={href}
              href={href}
              aria-current={href.endsWith("/" + kind) ? "page" : undefined}
            >
              <SiteCopyText id={id} lang={lang}/>
            </Link>
          ))}
      </nav>
      <main className="workspace-main">
        <p className="inner-kicker">
          <SiteCopyText id="workspace.kicker" lang={lang}/>
        </p>
        <h1><SiteCopyText id={workspaceTitles[kind] || "workspace.title"} lang={lang}/></h1>
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
            ) : (
              <HealthInsights data={health.data} lang={lang} birthDate={health.session.user.user_metadata?.date_of_birth} />
            )}
          </Fragment>
        )}
      </main>
    </section>
  );
}

function PeriodCalendar({ data, save, lang, birthDate }: Props) {
  const ka = lang === "ka",
    today = dateKey();
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today),
    [duration, setDuration] = useState(1),
    [length, setLength] = useState(data.cycleLength),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const first = month + "-01",
    start = addDays(
      first,
      -((new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7),
    );
  const existing = data.periods.find((p) => p.start === selected);
  async function persist(remove = false) {
    setBusy(true);
    setMessage("");
    try {
      if (remove) {
        await save({ ...data, periods: data.periods.filter(p => p.start !== selected) });
        setMessage(ka ? "წაშლილია" : "Removed");
        return;
      }
      if(data.pregnancy?.active){setMessage(ka?'პერიოდის ახალი ჩანაწერის დამატებამდე გამორთე ორსულობის რეჟიმი.':'Turn off pregnancy mode before adding a period entry.');return;}
      if (
        selected > today ||
        duration < 1 ||
        duration > 10 ||
        !Number.isInteger(duration) ||
        !Number.isInteger(length) ||
        length < 21 ||
        length > 45
      )
        throw Error();
      if (duration > distance(selected, today) + 1) {
        setMessage(
          ka
            ? "მომავალი სისხლდენის დღეებს დადასტურებულად ნუ მონიშნავ."
            : "Do not mark future bleeding days as confirmed.",
        );
        return;
      }
      if (
        overlapsPeriod(data.periods, { start: selected, duration })
      ) {
        setMessage(
          ka
            ? "ეს პერიოდი არსებულ ჩანაწერს ემთხვევა."
            : "This period overlaps another entry.",
        );
        return;
      }
      await save({
        ...data,
        cycleLength: length,
        periods: [
          ...data.periods.filter((p) => p.start !== selected),
          { start: selected, duration },
        ].sort((a, b) => a.start.localeCompare(b.start)),
      });
      setMessage(ka ? "შენახულია" : "Saved");
    } catch {
      setMessage(
        ka
          ? "შენახვა ვერ მოხერხდა. შეამოწმე მონაცემები და კავშირი."
          : "Could not save. Check your entries and connection.",
      );
    } finally {
      setBusy(false);
    }
  }
  function moveMonth(delta: number) {
    const d = new Date(first + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(d.toISOString().slice(0, 7));
  }
  return (
    <>
      <CycleOverview
        periods={data.periods}
        cycleLength={data.cycleLength}
        pregnancyActive={data.pregnancy?.active}
        lang={lang}
      />
      <CycleEducation periods={data.periods} birthDate={birthDate} lang={lang} />
      {data.pregnancy?.active&&<button type="button" disabled={busy} onClick={()=>{if(confirm(ka?'გამორთო ორსულობის რეჟიმი? ისტორია შენარჩუნდება.':'Turn off pregnancy mode? History will be preserved.'))void save({...data,pregnancy:{...data.pregnancy!,active:false,updatedAt:new Date().toISOString()}}).catch(()=>setMessage(ka?'შენახვა ვერ მოხერხდა.':'Could not save.'))}}>{ka?'ორსულობის რეჟიმის გამორთვა':'Turn off pregnancy mode'}</button>}
      <div className="workspace-grid">
        <section className="workspace-card">
          <div className="workspace-row">
            <button
              aria-label={ka ? "წინა თვე" : "Previous month"}
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <h2>
              {new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(first))}
            </h2>
            <button
              aria-label={ka ? "შემდეგი თვე" : "Next month"}
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="period-grid">
            {(ka
              ? ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"]
              : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
            ).map((d) => (
              <span key={d}>{d}</span>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const date = addDays(start, i),
                state = calendarState(
                  data.periods,
                  data.cycleLength,
                  date,
                  today,
                  data.pregnancy?.active,
                );
              return (
                <button
                  key={date}
                  className={`day ${state} ${date === selected ? "selected" : ""}`}
                  aria-label={`${date} ${state}`}
                  aria-pressed={selected === date}
                  onClick={() => {
                    setSelected(date);
                    setDuration(
                      data.periods.find((p) => p.start === date)?.duration || 1,
                    );
                  }}
                  style={{ opacity: date.startsWith(month) ? 1 : 0.45 }}
                >
                  {Number(date.slice(-2))}
                </button>
              );
            })}
          </div>
          <p>
            <SiteCopyText id="tracker.legend" lang={lang}/>
          </p>
        </section>
        <section className="workspace-card">
          <h2>
            <SiteCopyText id={existing ? "tracker.edit" : "tracker.add"} lang={lang}/>
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void persist();
            }}
            className="workspace-form"
          >
            <label>
              <SiteCopyText id="tracker.startDate" lang={lang}/>
              <input
                type="date"
                required
                max={today}
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setDuration(
                    data.periods.find((p) => p.start === e.target.value)
                      ?.duration || 1,
                  );
                }}
              />
            </label>
            <label>
              <SiteCopyText id="tracker.bleedingDays" lang={lang}/>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <label>
              <SiteCopyText id="tracker.initialLength" lang={lang}/>
              <input
                type="number"
                min={21}
                max={45}
                required
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
              />
            </label>
            <p><SiteCopyText id="tracker.initialNote" lang={lang}/></p>
            <button disabled={busy || selected > today}>
              <SiteCopyText id="tracker.save" lang={lang}/>
            </button>
            {existing && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      ka
                        ? "წაიშალოს ეს პერიოდი ყველა მოწყობილობაზე?"
                        : "Delete this period on all devices?",
                    )
                  )
                    void persist(true);
                }}
              >
                <SiteCopyText id="tracker.delete" lang={lang}/>
              </button>
            )}
          </form>
          <p role="status">{message}</p>
          <Link href={`/app/log?date=${selected}`}>
            <SiteCopyText id="tracker.dayJournal" lang={lang}/>
          </Link>
        </section>
      </div>
      <section className="workspace-card">
        <h2><SiteCopyText id="tracker.reminders" lang={lang}/></h2>
        <p>
          <SiteCopyText id="tracker.reminderNote" lang={lang}/>
        </p>
        <button
          disabled={
            !forecast(data.periods, data.cycleLength, today, data.pregnancy?.active).starts.length
          }
          onClick={() =>
            download(
              reminderCalendar(
                forecast(data.periods, data.cycleLength, today, data.pregnancy?.active).starts,
              ),
              "tuta-reminders.ics",
              "text/calendar",
            )
          }
        >
          <SiteCopyText id="tracker.download" lang={lang}/>
        </button>
      </section>
      <section className="workspace-card">
        <h2><SiteCopyText id="tracker.history" lang={lang}/></h2>
        {[...data.periods].reverse().map((p) => (
          <button
            key={p.start}
            className="history-entry"
            onClick={() => {
              setSelected(p.start);
              setDuration(p.duration);
              setMonth(p.start.slice(0, 7));
            }}
          >
            {p.start} · {p.duration} {ka ? "დღე" : "days"}
          </button>
        ))}
      </section>
    </>
  );
}

function Journal({ data, save, lang }: Props) {
  const params = useSearchParams();
  const requested = params.get("date");
  const ka = lang === "ka",
    today = dateKey();
  const initial =
    requested &&
    /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
    Number.isFinite(Date.parse(requested)) &&
    requested <= today
      ? requested
      : today;
  const [date, setDate] = useState(initial),
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
      await save({
        ...data,
        logs: [
          ...data.logs.filter((l) => l.date !== date),
          ...(remove ? [] : [{ ...entry, date }]),
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
      className="workspace-card workspace-form"
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
          <div className="workspace-row">
            {["happy", "calm", "low", "tense", "tired"].map((id) => (
              <button
                type="button"
                key={id}
                aria-pressed={entry.mood === id}
                onClick={() => change({ mood: id })}
              >
                <SiteCopyText id={`journal.mood.${id}`} lang={lang}/>
              </button>
            ))}
          </div>
        </fieldset>
        {(["energy", "pain"] as const).map((key) => (
          <label key={key}>
            <SiteCopyText id={`journal.${key}`} lang={lang}/>{" "}
            (1–5)
            <input
              type="number"
              required
              min={1}
              max={5}
              value={entry[key]}
              onChange={(e) => change({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label>
          <SiteCopyText id="journal.flow" lang={lang}/>
          <select
            value={entry.flow}
            onChange={(e) => change({ flow: e.target.value })}
          >
            {[
              ["none", "არ არის", "None"],
              ["spotting", "ლაქები", "Spotting"],
              ["light", "მსუბუქი", "Light"],
              ["medium", "საშუალო", "Medium"],
              ["heavy", "ძლიერი", "Heavy"],
            ].map(([id, a, b]) => (
              <option key={id} value={id}>
                {ka ? a : b}
              </option>
            ))}
          </select>
        </label>
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
  const ka = lang === "ka",
    summary = healthReport(data),
    patterns = symptomPatterns(data.periods, data.logs);
  const membership=useMembership();
  return (
    <div className={report ? "health-report" : ""}>
      {!report && <CycleEducation periods={data.periods} birthDate={birthDate} lang={lang} />}
      <p>
        {summary.from} / {summary.today}
      </p>
      <p>
        <SiteCopyText id="insights.periodNote" lang={lang}/>
      </p>
      {report && (
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
      )}
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
