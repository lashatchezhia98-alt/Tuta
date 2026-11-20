"use client";

import Link from "next/link";
import { SiteCopyText } from "@/components/site-copy-provider";
import { calendarRangeLabel, cycleAt, periodCalendarLegend, periodCalendarModel } from "../mobile/src/cycle.mjs";

const phases: Record<string, [string, string]> = {
  menstruation: ["მენსტრუაცია", "Menstruation"], follicular: ["ფოლიკულური ფაზა", "Follicular phase"],
  ovulation: ["ოვულაცია", "Ovulation"], luteal: ["ლუთეალური ფაზა", "Luteal phase"], unknown: ["უცნობია", "Unknown"],
};

export function CalendarKeyMark({ kind, symbol }: { kind: string; symbol?: string }) {
  return <span className="calendar-key-mark" data-mark={kind} aria-hidden="true">{symbol}</span>;
}

export default function CycleOverview({ periods, cycleLength, lang, pregnancyActive = false, calendar, onMark }: {
  periods: { start: string; duration: number }[];
  cycleLength: number;
  lang: "ka" | "en";
  pregnancyActive?: boolean;
  calendar?: ReturnType<typeof periodCalendarModel>;
  onMark?: () => void;
}) {
  const ka = lang === "ka";
  const model = calendar ?? periodCalendarModel({ periods, cycleLength, pregnancy: { active: pregnancyActive } });
  const current = cycleAt(periods, cycleLength, model.today, model.today);
  const phase = current && ((model.status === "overdue" || model.reliability === "low") && current.phase !== "menstruation"
    ? "unknown" : current.phase);
  const { nextWindow, nextFertileWindow } = model;
  const labels = periodCalendarLegend(ka);
  return <section className="workspace-card period-today" aria-label={ka ? "დღეს" : "Today"}>
    <h2>{ka ? "დღეს" : "Today"}</h2>
    {pregnancyActive ? <>
      <p>{ka ? "ორსულობის რეჟიმი ჩართულია. პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია." : "Pregnancy mode is active. Period and fertile-day estimates are paused."}</p>
      <Link href="/app/pregnancy">{ka ? "ორსულობის მონიტორინგი" : "Pregnancy tracking"} →</Link>
    </> : <>
      {current && phase ? <p><strong>{ka ? `ციკლის დღე: ${current.day}` : `Cycle day: ${current.day}`}</strong>
        {phase !== "unknown" && <> · {ka ? "სავარაუდო ფაზა:" : "Estimated phase:"} {phases[phase][ka ? 0 : 1]}</>}
      </p> : <p>{ka ? "მონიშნე პერიოდის დღეები, რომ ციკლის შეჯამება აქ გამოჩნდეს." : "Log period days to see your cycle summary here."}</p>}
      {(current || nextWindow) && <dl className="period-forecast">
        <div><dt><CalendarKeyMark kind="predicted"/>{labels.find(item => item.key === "predicted")?.label}</dt>
          <dd>{nextWindow ? calendarRangeLabel(nextWindow.start, nextWindow.end, ka) : (ka ? "პროგნოზი შეჩერებულია" : "Estimate paused")}</dd></div>
        <div><dt><CalendarKeyMark kind="fertile"/>{labels.find(item => item.key === "fertile")?.label}</dt>
          <dd>{nextFertileWindow ? calendarRangeLabel(nextFertileWindow.start, nextFertileWindow.end, ka) : (ka ? "ჯერ არ არის ხელმისაწვდომი" : "Not available yet")}</dd></div>
      </dl>}
      {model.status === "overdue" && <p role="status"><SiteCopyText id="tracker.overdue" lang={lang}/></p>}
      {onMark && <button type="button" className="period-primary" onClick={onMark}>{ka ? "პერიოდის მონიშვნა" : "Log period"}</button>}
      {current && <details className="period-estimates"><summary>{ka ? "რას ნიშნავს ეს პროგნოზი?" : "How to read this estimate"}</summary>
        <p>{model.reliability === "limited"
          ? (ka ? `საწყისი შეფასება: ვიყენებთ შენს მითითებულ ${cycleLength} დღეს. პირადი საშუალოსთვის საჭიროა 3 დასრულებული ციკლი, ანუ 4 დაწყების თარიღი.` : `Initial estimate: using your chosen ${cycleLength} days. A personal average needs 3 completed cycles, meaning 4 start dates.`)
          : model.reliability === "low"
            ? (ka ? "ამ ჩანაწერებით პროგნოზის სიზუსტე შეზღუდულია." : "These entries limit prediction accuracy.")
            : (ka ? "შეფასება შენს ჩაწერილ ისტორიას ეყრდნობა." : "Estimates use your recorded history.")}</p>
        {model.status !== "overdue" && model.earliest && model.latest && <p>{ka ? "ისტორიული ხანგრძლივობების დიაპაზონი: " : "Range based on past cycle lengths: "}{calendarRangeLabel(model.earliest, model.latest, ka, true)}.</p>}
        {model.starts.length > 0 && <details><summary><SiteCopyText id="tracker.sixStarts" lang={lang}/></summary>
          <ul>{model.windows.map(window => <li key={window.start}>{calendarRangeLabel(window.start, window.end, ka, true)}</li>)}</ul></details>}
        <p><SiteCopyText id="tracker.disclaimer" lang={lang}/></p>
      </details>}
    </>}
  </section>;
}
