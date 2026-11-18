"use client";
import { SiteCopyText } from "@/components/site-copy-provider";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { addDays, cycleAt, distance, periodCalendarModel, periodDayLabel, periodDayMarkers, predictionDateKey } from "../mobile/src/cycle.mjs";

export default function CycleOverview({ periods, cycleLength, lang, pregnancyActive=false, calendar, onMark, onCalendar }: {
  periods: { start: string; duration: number }[]; cycleLength: number; lang: "ka" | "en";
  pregnancyActive?: boolean;
  calendar?: ReturnType<typeof periodCalendarModel>;
  onMark?: () => void;
  onCalendar?: (date: string) => void;
}) {
  const ka = lang === "ka";
  const today = calendar?.today ?? predictionDateKey();
  const model = calendar ?? periodCalendarModel({periods, cycleLength, pregnancy: { active: pregnancyActive }}, today);
  const current = cycleAt(periods, cycleLength, today, today);
  const format = (date: string) => new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  if(pregnancyActive)return <p>{ka?'ორსულობის რეჟიმი ჩართულია. პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია.':'Pregnancy mode is active. Period and fertile-day estimates are paused.'} <Link href="/app/pregnancy">{ka?'ორსულობის მონიტორინგი':'Pregnancy tracking'} →</Link></p>;
  if (!current) return <section className="workspace-card">
    <p>{ka ? "პროგნოზისთვის შეინახე პერიოდის დაწყების თარიღი." : "Save a period start date to see an estimate."}</p>
    {onMark && <button type="button" onClick={onMark}>{ka ? "პერიოდის დღეების მონიშვნა" : "Log period days"}</button>}
  </section>;
  const next = model.nextWindow;
  const daysLeft = next ? distance(today, next.start) : 0;
  const phase = (model.status === 'overdue' || model.reliability === 'low') && current.phase !== 'menstruation' ? 'unknown' : current.phase;
  const phases: Record<string, string> = { menstruation: "მენსტრუაცია", follicular: "ფოლიკულური", ovulation: "ოვულაცია", luteal: "ლუთეალური", unknown: "უცნობია" };
  const countdown = !next ? (ka ? "პროგნოზი შეჩერებულია" : "Estimate paused") : daysLeft === 0 ? (ka ? "სავარაუდოდ დღეს" : "Estimated today") : (ka ? `${daysLeft} დღეში` : `In ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`);
  const reliability = model.reliability === "consistent" ? (ka ? "ისტორიაზე დაფუძნებული" : "Based on your history") : model.reliability === "low" ? (ka ? "სიზუსტე შეზღუდულია" : "Limited accuracy") : (ka ? "საწყისი შეფასება" : "Initial estimate");
  return <section aria-label={ka ? "პერიოდის პროგნოზი" : "Period estimates"}>
    {onMark && onCalendar && <div className="mobile-cycle-summary">
      <article className="mobile-cycle-card">
        <div className="mobile-cycle-card-top"><strong>{ka ? "მიმდინარე ციკლი" : "Current cycle"}</strong><span>{ka ? `${current.length} დღიანი შეფასება` : `${current.length}-day estimate`}</span></div>
        <div className="mobile-cycle-card-body">
          <div><div>{ka ? "ციკლის დღე" : "Cycle day"}</div><strong className="mobile-cycle-day">{current.day}</strong><span className="mobile-cycle-phase">{ka ? phases[phase] : phase}</span></div>
          <svg viewBox="0 0 156 156" aria-hidden="true" focusable="false">
            <circle cx="78" cy="78" r="62" stroke="#D8C9EA" strokeWidth="11" fill="none"/>
            <circle cx="78" cy="78" r="62" stroke="#1E1B2E" strokeWidth="11" strokeLinecap="round" fill="none" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - Math.min(100, current.day / Math.max(1, current.length) * 100)} transform="rotate(-90 78 78)"/>
            <circle cx="78" cy="78" r="48" fill="#F9F8FC"/>
            <path d="M93 44a28 28 0 1 0 21 49A30 30 0 0 1 93 44Z" fill="#FDF0CC"/>
            <circle cx="111" cy="49" r="3" fill="#B7A0D8"/>
          </svg>
        </div>
        <p>{ka ? "ფაზა სავარაუდოა და ჩანაწერების მიხედვით იცვლება." : "Phase is estimated and updates with your entries."}</p>
      </article>
      <button type="button" className="mobile-cycle-action" onClick={onMark}><strong>{ka ? "პერიოდის დღეების მონიშვნა" : "Log period days"}</strong><ChevronRight aria-hidden="true" size={22}/></button>
      <button type="button" className="mobile-cycle-action mobile-cycle-next" onClick={() => onCalendar(next?.start ?? today)}>
        <span><strong>{ka ? "შემდეგი პერიოდი" : "Next period"}</strong><ChevronRight aria-hidden="true" size={22}/></span>
        <b>{countdown}</b>
        {next && <small>{next.start}{next.end !== next.start ? ` – ${next.end}` : ""} · {reliability}</small>}
      </button>
      <section className="mobile-cycle-week">
        <h2>{ka ? "შენი კვირა" : "Your week"}</h2>
        <div>
          {Array.from({ length: 7 }, (_, index) => {
            const date = addDays(today, index - 3);
            const day = model.day(date);
            const weekday = (ka ? ["კვ", "ორ", "სა", "ოთ", "ხუ", "პა", "შა"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"])[new Date(`${date}T12:00:00Z`).getUTCDay()];
            const fertile = day.state === "fertile";
            const markers = periodDayMarkers(ka).filter(marker => day[marker.key]);
            return <button key={date} type="button" className={`${day.state}${fertile ? " fertile" : ""}`} aria-current={date === today ? "date" : undefined} aria-label={periodDayLabel(day, date, ka)} onClick={() => onCalendar(date)}>
              <small>{weekday}</small><strong>{Number(date.slice(-2))}</strong>
              {(markers.length > 0 || fertile) && <span aria-hidden="true">{fertile ? "✦" : markers.map(marker => marker.symbol).join("")}</span>}
            </button>;
          })}
        </div>
      </section>
    </div>}
    <div className={onMark && onCalendar ? "app-content-cards desktop-cycle-summary" : "app-content-cards"}>
      <article>
        <small><SiteCopyText id="tracker.nextEstimate" lang={lang}/></small>
        <strong>{countdown}</strong>
        {next && <small>{format(next.start)}{next.start !== next.end ? ` – ${format(next.end)}` : ""}</small>}
      </article>
      <article><small>{ka ? "ციკლის დღე" : "Cycle day"}</small><strong>{current.day}</strong></article>
      <article><small>{ka ? "სავარაუდო ფაზა" : "Estimated phase"}</small><strong>{ka ? phases[phase] : phase}</strong></article>
    </div>
    {model.status === "overdue" && <p role="status"><SiteCopyText id="tracker.overdue" lang={lang}/></p>}
    <details><summary>{ka ? "რას ნიშნავს ეს პროგნოზი?" : "How to read this estimate"}</summary><p>{model.reliability === "limited"
      ? (ka ? `საწყისი შეფასება: ვიყენებთ შენს მითითებულ ${cycleLength} დღეს. პირადი საშუალოსთვის საჭიროა 3 დასრულებული ციკლი, ანუ 4 დაწყების თარიღი.` : `Initial estimate: using your chosen ${cycleLength} days. A personal average needs 3 completed cycles, meaning 4 start dates.`)
      : model.reliability === "low"
        ? (ka ? "ამ ჩანაწერებით პროგნოზის სიზუსტე შეზღუდულია. ზუსტ ნაყოფიერ დღეებს არ ვაჩვენებთ." : "These entries limit prediction accuracy. Precise fertile-day estimates are not shown.")
        : (ka ? "შეფასება შენს ჩაწერილ ისტორიას ეყრდნობა." : "Estimates use your recorded history.")}</p>
    {model.status !== "overdue" && <>
      {model.earliest && model.latest ? <p>{ka ? "ისტორიული ხანგრძლივობების დიაპაზონი: " : "Range based on past cycle lengths: "}{format(model.earliest)} – {format(model.latest)}. {ka ? "ეს გარანტირებული თარიღები არ არის." : "These dates are not guaranteed."}</p> : null}
      {model.fertilityAvailable ? <p>{ka ? "სავარაუდო ნაყოფიერი დღეები: " : "Estimated fertile days: "}{format(current.fertileStart)} – {format(current.fertileEnd)}</p> : null}
      <details><summary><SiteCopyText id="tracker.sixStarts" lang={lang}/></summary><ul>{model.starts.map((date: string) => <li key={date}>{format(date)}</li>)}</ul></details>
    </>}
    <p className="mt-4 text-sm"><SiteCopyText id="tracker.disclaimer" lang={lang}/></p></details>
  </section>;
}
