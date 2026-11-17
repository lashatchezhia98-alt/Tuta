"use client";

import { useState } from "react";
import { SiteCopyText } from "@/components/site-copy-provider";
import { dateKey } from "@/mobile/src/cycle.mjs";
import { calculateCycleEstimate, calculatorMessages, formatCalculatorDate } from "@/mobile/src/cycle-calculator.mjs";

export default function FreeCalculator({ lang, kind }: { lang: "ka" | "en"; kind: "period" | "ovulation" }) {
  const ka = lang === "ka", i = ka ? 0 : 1;
  const [date, setDate] = useState("");
  const [length, setLength] = useState("28");
  const [duration, setDuration] = useState("5");
  const today = dateKey();
  const result = date ? calculateCycleEstimate(date, Number(length), Number(duration), today) : null;
  const format = (value: string) => formatCalculatorDate(value, ka);

  return <>
    <section className="inner-hero compact"><div className="inner-container">
      <h1><SiteCopyText id={`page.${kind}.0`} lang={lang} /></h1>
      <p><SiteCopyText id="calculator.intro" lang={lang} /></p>
    </div></section>
    <section className="calculator inner-container">
      <label><SiteCopyText id="calculator.start" lang={lang} /><input type="date" max={today} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label><SiteCopyText id="calculator.length" lang={lang} /><input type="number" min={21} max={45} step={1} value={length} onChange={e => setLength(e.target.value)} /></label>
      <label><SiteCopyText id="calculator.duration" lang={lang} /><input type="number" min={1} max={10} step={1} value={duration} onChange={e => setDuration(e.target.value)} /></label>
      <p><SiteCopyText id="calculator.disclaimer" lang={lang} /></p>
      <div className="calculator-result" aria-live="polite">
        <h2><SiteCopyText id="calculator.estimated" lang={lang} /></h2>
        {!result ? <p><SiteCopyText id="calculator.empty" lang={lang} /></p>
          : result.status !== "estimated" ? <p>{calculatorMessages[result.status][i]}</p>
          : <>
            <p>{ka ? "პერიოდის სავარაუდო დასაწყისი" : "Estimated period start"}: <strong>{format(result.nextPeriod)}</strong></p>
            {!result.fertility ? <p>{calculatorMessages.unavailable[i]}</p>
              : result.fertility.passed ? <p>{calculatorMessages.fertilityPassed[i]}</p>
              : <>
                <p>{ka ? "ოვულაცია (მოდელის ვარაუდი)" : "Ovulation (model assumption)"}: {format(result.fertility.ovulation)}</p>
                <p>{ka ? "სავარაუდო ნაყოფიერი დღეები" : "Estimated fertile days"}: {format(result.fertility.start)} – {format(result.fertility.end)}</p>
              </>}
          </>}
      </div>
    </section>
  </>;
}
