"use client";

import { cycleAt, forecast, dateKey } from "../mobile/src/cycle.mjs";

export default function CycleOverview({ periods, cycleLength, lang }: {
  periods: { start: string; duration: number }[]; cycleLength: number; lang: "ka" | "en";
}) {
  const ka = lang === "ka";
  const today = dateKey();
  const model = forecast(periods, cycleLength, today);
  const current = cycleAt(periods, cycleLength, today, today);
  const format = (date: string) => new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  if (!current) return <p>{ka ? "პროგნოზისთვის შეინახე პერიოდის დაწყების თარიღი." : "Save a period start date to see an estimate."}</p>;
  const phases: Record<string, string> = { menstruation: "მენსტრუაცია", follicular: "ფოლიკულური", ovulation: "ოვულაცია", luteal: "ლუთეალური", unknown: "უცნობია" };
  return <section aria-label={ka ? "პერიოდის პროგნოზი" : "Period estimates"}>
    <div className="app-content-cards">
      <article><small>{ka ? "ციკლის დღე" : "Cycle day"}</small><strong>{current.day}</strong></article>
      <article><small>{ka ? "სავარაუდო ფაზა" : "Estimated phase"}</small><strong>{ka ? phases[current.phase] : current.phase}</strong></article>
      <article><small>{model.status === "overdue" ? (ka ? "სავარაუდო თარიღმა გაიარა" : "Estimated date has passed") : (ka ? "შემდეგი პერიოდის ვარაუდი" : "Next period estimate")}</small><strong>{model.expected ? format(model.expected) : ""}</strong></article>
    </div>
    <p>{model.reliability === "limited"
      ? (ka ? "პირველადი შეფასება: საჭიროა სულ მცირე 3 დასრულებული ციკლის ისტორია." : "Initial estimate: at least 3 completed cycles are needed.")
      : model.reliability === "low"
        ? (ka ? "ციკლის ხანგრძლივობა იცვლება. თარიღების სიზუსტე შეზღუდულია." : "Cycle lengths vary. Date estimates are uncertain.")
        : (ka ? "შეფასება შენს ჩაწერილ ისტორიას ეყრდნობა." : "Estimates use your recorded history.")}</p>
    {model.status === "overdue" ? <p role="status">{ka ? "ახალი პერიოდი ჯერ არ არის ჩაწერილი. მომავალი პროგნოზები დროებით შეჩერებულია." : "No new period is logged. Future predictions are paused."}</p> : <>
      {model.earliest && model.latest ? <p>{ka ? "ისტორიული ხანგრძლივობების დიაპაზონი: " : "Range based on past cycle lengths: "}{format(model.earliest)} – {format(model.latest)}. {ka ? "ეს გარანტირებული თარიღები არ არის." : "These dates are not guaranteed."}</p> : null}
      {model.fertilityAvailable ? <p>{ka ? "სავარაუდო ნაყოფიერი დღეები: " : "Estimated fertile days: "}{format(current.fertileStart)} – {format(current.fertileEnd)}</p> : null}
      <details><summary>{ka ? "შემდეგი 6 პერიოდის სავარაუდო დასაწყისი" : "Next 6 estimated period starts"}</summary><ul>{model.starts.map((date: string) => <li key={date}>{format(date)}</li>)}</ul></details>
    </>}
    <p className="mt-4 text-sm">{ka ? "კალენდარული შეფასება ოვულაციას არ ადასტურებს და კონტრაცეფციის მეთოდი არ არის." : "Calendar estimates do not confirm ovulation and are not contraception."}</p>
  </section>;
}
