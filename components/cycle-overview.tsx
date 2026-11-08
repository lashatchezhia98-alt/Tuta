"use client";

import { cycleAt, forecast, dateKey } from "../mobile/src/cycle.mjs";

export default function CycleOverview({ periods, cycleLength, lang, pregnancyActive=false }: {
  periods: { start: string; duration: number }[]; cycleLength: number; lang: "ka" | "en";
  pregnancyActive?: boolean;
}) {
  const ka = lang === "ka";
  const today = dateKey();
  const model = forecast(periods, cycleLength, today, pregnancyActive);
  const current = cycleAt(periods, cycleLength, today, today);
  const format = (date: string) => new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  if(pregnancyActive)return <p>{ka?'ორსულობის რეჟიმი ჩართულია. პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია.':'Pregnancy mode is active. Period and fertile-day estimates are paused.'} <a href="/app/pregnancy">{ka?'ორსულობის მონიტორინგი':'Pregnancy tracking'} →</a></p>;
  if (!current) return <p>{ka ? "პროგნოზისთვის შეინახე პერიოდის დაწყების თარიღი." : "Save a period start date to see an estimate."}</p>;
  const phase = (model.status === 'overdue' || model.reliability === 'low') && current.phase !== 'menstruation' ? 'unknown' : current.phase;
  const phases: Record<string, string> = { menstruation: "მენსტრუაცია", follicular: "ფოლიკულური", ovulation: "ოვულაცია", luteal: "ლუთეალური", unknown: "უცნობია" };
  return <section aria-label={ka ? "პერიოდის პროგნოზი" : "Period estimates"}>
    <div className="app-content-cards">
      <article><small>{ka ? "ციკლის დღე" : "Cycle day"}</small><strong>{current.day}</strong></article>
      <article><small>{ka ? "სავარაუდო ფაზა" : "Estimated phase"}</small><strong>{ka ? phases[phase] : phase}</strong></article>
      <article><small>{model.status === "overdue" ? (ka ? "სავარაუდო თარიღმა გაიარა" : "Estimated date has passed") : (ka ? "შემდეგი პერიოდის ვარაუდი" : "Next period estimate")}</small><strong>{model.expected ? format(model.expected) : ""}</strong></article>
    </div>
    <p>{model.reliability === "limited"
      ? (ka ? `საწყისი შეფასება: ვიყენებთ შენს მითითებულ ${cycleLength} დღეს. პირადი საშუალოსთვის საჭიროა 3 დასრულებული ციკლი, ანუ 4 დაწყების თარიღი.` : `Initial estimate: using your chosen ${cycleLength} days. A personal average needs 3 completed cycles, meaning 4 start dates.`)
      : model.reliability === "low"
        ? (ka ? "ამ ჩანაწერებით პროგნოზის სიზუსტე შეზღუდულია. ზუსტ ნაყოფიერ დღეებს არ ვაჩვენებთ." : "These entries limit prediction accuracy. Precise fertile-day estimates are not shown.")
        : (ka ? "შეფასება შენს ჩაწერილ ისტორიას ეყრდნობა." : "Estimates use your recorded history.")}</p>
    {model.status === "overdue" ? <p role="status">{ka ? "ახალი პერიოდი ჯერ არ არის ჩაწერილი. მომავალი პროგნოზები დროებით შეჩერებულია." : "No new period is logged. Future predictions are paused."}</p> : <>
      {model.earliest && model.latest ? <p>{ka ? "ისტორიული ხანგრძლივობების დიაპაზონი: " : "Range based on past cycle lengths: "}{format(model.earliest)} – {format(model.latest)}. {ka ? "ეს გარანტირებული თარიღები არ არის." : "These dates are not guaranteed."}</p> : null}
      {model.fertilityAvailable ? <p>{ka ? "სავარაუდო ნაყოფიერი დღეები: " : "Estimated fertile days: "}{format(current.fertileStart)} – {format(current.fertileEnd)}</p> : null}
      <details><summary>{ka ? "შემდეგი 6 პერიოდის სავარაუდო დასაწყისი" : "Next 6 estimated period starts"}</summary><ul>{model.starts.map((date: string) => <li key={date}>{format(date)}</li>)}</ul></details>
    </>}
    <p className="mt-4 text-sm">{ka ? "კალენდარული შეფასება ოვულაციას არ ადასტურებს და კონტრაცეფციის მეთოდი არ არის." : "Calendar estimates do not confirm ovulation and are not contraception."}</p>
  </section>;
}
