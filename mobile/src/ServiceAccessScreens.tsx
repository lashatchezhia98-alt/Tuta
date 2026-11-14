import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { reviewItems, reviewSymptoms } from "../../lib/symptom-review.mjs";
import { apiRoot } from "./api";
import { supabase } from "./supabase";
import { CTA, Chip, T, s } from "./ui";
import { useMembership } from "./useMembership";
import type { Lang } from "./types";

export function SymptomReview({ lang, token, onPremium, onCare }: {
  lang: Lang; token: string; onPremium: () => void; onCare: () => void;
}) {
  const ka = lang === "ka";
  const membership = useMembership(token, apiRoot);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const result = reviewSymptoms(selected);
  if (membership.active !== true) return (
    <View style={s.content}>
      <T>{membership.error ? (ka ? "პრემიუმის სტატუსი ვერ ჩაიტვირთა." : "Could not check Premium status.")
        : membership.active === null ? (ka ? "იტვირთება…" : "Loading…")
        : (ka ? "სიმპტომების კითხვარი პრემიუმშია." : "Symptom review is a Premium feature.")}</T>
      {membership.active === false ? <CTA title={ka ? "პრემიუმის ნახვა" : "See Premium"} onPress={onPremium} /> : null}
    </View>
  );
  return (
    <View style={s.content}>
      <T style={s.muted}>{ka ? "მონიშნე სიმპტომები, რომლებსაც ამჩნევ. პასუხები არ ინახება და შედეგი დიაგნოზი არ არის." : "Select the symptoms you notice. Answers are not saved, and this is not a diagnosis."}</T>
      <View style={{ gap: 8, marginVertical: 16 }}>
        {reviewItems.map(([id, ge, en]) => (
          <Chip key={id} label={ka ? ge : en} selected={selected.includes(id)}
            onPress={() => {
              setSubmitted(false);
              setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
            }} />
        ))}
      </View>
      <CTA title={ka ? "შეჯამების ნახვა" : "See summary"} disabled={!selected.length} onPress={() => setSubmitted(true)} />
      {submitted ? <View style={s.card}>
        <T weight="bold">{ka ? "ექიმთან განსახილველი საკითხები" : "What to discuss with a clinician"}</T>
        {result.pcos ? <T>{ka ? "შეგიძლია ექიმს ჰკითხო პოლიცისტური საკვერცხეების სინდრომის (PCOS) შესახებ." : "Consider asking a clinician about polycystic ovary syndrome (PCOS)."}</T> : null}
        {result.endometriosis ? <T>{ka ? "შეგიძლია ექიმს ჰკითხო ენდომეტრიოზის შესახებ." : "Consider asking a clinician about endometriosis."}</T> : null}
        <T>{result.discuss
          ? (ka ? "მონიშნული სიმპტომების განხილვა ექიმთან ღირს. კითხვარი მიზეზს ვერ ადგენს." : "Discuss these symptoms with a clinician. This review cannot determine the cause.")
          : (ka ? "ეს შედეგი ჯანმრთელობის პრობლემას არ გამორიცხავს. თუ სიმპტომები გრძელდება ან გაწუხებს, მიმართე ექიმს." : "This result does not rule out a health problem. See a clinician if symptoms persist or concern you.")}</T>
        <CTA title={ka ? "ექიმების ნახვა" : "Find a doctor"} onPress={onCare} />
      </View> : null}
    </View>
  );
}

export function AccountDeletion({ lang, userId }: { lang: Lang; userId: string }) {
  const ka = lang === "ka";
  const [requested, setRequested] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let live = true;
    void (async () => {
      try {
        const { data, error } = await client.from("account_deletion_requests")
          .select("user_id").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (live) { setRequested(!!data); setError(false); }
      } catch { if (live) setError(true); }
    })();
    return () => { live = false; };
  }, [revision, userId]);
  async function change(remove: boolean) {
    if (!supabase || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const query = supabase.from("account_deletion_requests");
      const { error } = remove
        ? await query.delete().eq("user_id", userId)
        : await query.upsert({ user_id: userId }, { ignoreDuplicates: true });
      if (error) throw error;
      setRequested(!remove);
    } catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View style={s.content}><View style={s.card}>
    <T>{ka ? "წაშლის მოთხოვნას ადმინი განიხილავს. გაგზავნა ანგარიშს ავტომატურად არ შლის. განხილვამდე მოთხოვნის გაუქმება შეგიძლია." : "An administrator will review your deletion request. Submitting it does not delete your account automatically. You can withdraw it before review."}</T>
    {requested ? <T accessibilityRole="alert">{ka ? "მოთხოვნა გაგზავნილია." : "Request submitted."}</T> : null}
    {error ? <CTA title={ka ? "ვერ შესრულდა — ხელახლა ცდა" : "Could not complete — retry"} light disabled={busy} onPress={() => setRevision((value) => value + 1)} /> : null}
    {!supabase ? <T>{ka ? "სერვისი მიუწვდომელია." : "Service unavailable."}</T> : null}
    {requested === null && !error && supabase ? <T>{ka ? "იტვირთება…" : "Loading…"}</T> : null}
    {requested !== null && !error ? <CTA
      title={requested ? (ka ? "მოთხოვნის გაუქმება" : "Withdraw request") : (ka ? "წაშლის მოთხოვნის გაგზავნა" : "Request account deletion")}
      disabled={busy} onPress={() => {
        if (requested) { void change(true); return; }
        Alert.alert(ka ? "გავაგზავნოთ წაშლის მოთხოვნა?" : "Submit a deletion request?", undefined, [
          { text: ka ? "უკან" : "Back", style: "cancel" },
          { text: ka ? "გაგზავნა" : "Submit", onPress: () => void change(false) },
        ]);
      }} /> : null}
  </View></View>;
}
