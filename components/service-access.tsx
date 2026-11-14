"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useHealthState } from "@/app/use-health-state";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { reviewItems, reviewSymptoms } from "@/lib/symptom-review.mjs";
import { useMembership } from "@/mobile/src/useMembership";

type Lang = "ka" | "en";
export function SymptomReview({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const health = useHealthState();
  const member = useMembership(health.session?.access_token);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const result = reviewSymptoms(selected);
  if (!health.loaded) return <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p>;
  if (!health.session) return <Link href="/login">{ka ? "შედი ანგარიშში" : "Sign in"}</Link>;
  if (member.error) return <p role="alert">{ka ? "პრემიუმის სტატუსი ვერ ჩაიტვირთა." : "Could not check Premium status."}</p>;
  if (member.active === null) return <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p>;
  if (!member.active) return <Link href="/premium">{ka ? "სიმპტომების კითხვარი პრემიუმშია" : "Symptom review is included in Premium"}</Link>;
  return <section className="workspace-card" style={{ marginTop: 24, padding: 24 }}>
    <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
      <fieldset style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <legend>{ka ? "მონიშნე სიმპტომები, რომლებსაც ამჩნევ" : "Select the symptoms you notice"}</legend>
        {reviewItems.map(([id, ge, en]) => <label key={id} style={{ display: "flex", gap: 10, minHeight: 44, alignItems: "center" }}>
          <input type="checkbox" checked={selected.includes(id)} onChange={() => {
            setSubmitted(false);
            setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
          }} />{ka ? ge : en}
        </label>)}
      </fieldset>
      <p>{ka ? "პასუხები არ ინახება. კითხვარი დიაგნოზს არ ადგენს." : "Answers are not saved. This review is not a diagnosis."}</p>
      <button className="btn btn-primary" disabled={!selected.length}>{ka ? "შეჯამების ნახვა" : "See summary"}</button>
    </form>
    {submitted ? <div role="status" style={{ marginTop: 16 }}>
      {result.pcos ? <p>{ka ? "შეგიძლია ექიმს ჰკითხო პოლიცისტური საკვერცხეების სინდრომის (PCOS) შესახებ." : "Consider asking a clinician about polycystic ovary syndrome (PCOS)."}</p> : null}
      {result.endometriosis ? <p>{ka ? "შეგიძლია ექიმს ჰკითხო ენდომეტრიოზის შესახებ." : "Consider asking a clinician about endometriosis."}</p> : null}
      <p>{result.discuss ? (ka ? "მონიშნული სიმპტომები ექიმთან განიხილე. კითხვარი მიზეზს ვერ ადგენს." : "Discuss these symptoms with a clinician. This review cannot determine the cause.")
        : (ka ? "ეს შედეგი პრობლემას არ გამორიცხავს. თუ სიმპტომები გრძელდება ან გაწუხებს, მიმართე ექიმს." : "This does not rule out a health problem. See a clinician if symptoms persist or concern you.")}</p>
      <Link href="/consultation">{ka ? "ექიმების ნახვა" : "Find a doctor"}</Link>
    </div> : null}
  </section>;
}

export function AccountDeletion({ lang }: { lang: Lang }) {
  const health = useHealthState();
  if (!health.loaded) return <p role="status">{lang === "ka" ? "იტვირთება…" : "Loading…"}</p>;
  const user = health.session?.user;
  return user && !user.is_anonymous ? <DeletionForm key={user.id} userId={user.id} lang={lang} />
    : <Link href="/login">{lang === "ka" ? "შედი ანგარიშში" : "Sign in"}</Link>;
}

function DeletionForm({ userId, lang }: { userId: string; lang: Lang }) {
  const ka = lang === "ka";
  const [requested, setRequested] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().from("account_deletion_requests")
          .select("user_id").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (live) { setRequested(!!data); setError(false); }
      } catch { if (live) setError(true); }
    })();
    return () => { live = false; };
  }, [userId, revision]);
  async function change() {
    if (lock.current || requested === null) return;
    if (!requested && !window.confirm(ka ? "გავაგზავნოთ წაშლის მოთხოვნა?" : "Submit a deletion request?")) return;
    lock.current = true;
    setBusy(true);
    try {
      const query = getSupabaseBrowserClient().from("account_deletion_requests");
      const { error } = requested ? await query.delete().eq("user_id", userId)
        : await query.upsert({ user_id: userId }, { ignoreDuplicates: true });
      if (error) throw error;
      setRequested(!requested);
    } catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="workspace-card" style={{ marginTop: 24, padding: 24 }}>
    <p>{ka ? "წაშლის მოთხოვნას ადმინი განიხილავს. გაგზავნა ანგარიშს ავტომატურად არ შლის. განხილვამდე მოთხოვნის გაუქმება შეგიძლია." : "An administrator reviews the request. Submission does not delete the account automatically. You can withdraw it before review."}</p>
    {requested ? <p role="status">{ka ? "მოთხოვნა გაგზავნილია." : "Request submitted."}</p> : null}
    {error ? <p role="alert"><button type="button" onClick={() => setRevision((value) => value + 1)}>{ka ? "ვერ შესრულდა — ხელახლა ცდა" : "Could not complete — retry"}</button></p> : null}
    {requested === null && !error ? <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p> : null}
    {requested !== null && !error ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void change()}>
      {requested ? (ka ? "მოთხოვნის გაუქმება" : "Withdraw request") : (ka ? "წაშლის მოთხოვნის გაგზავნა" : "Request account deletion")}
    </button> : null}
  </section>;
}
