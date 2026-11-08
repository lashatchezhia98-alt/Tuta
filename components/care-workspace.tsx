"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {useSiteFeatures} from '@/lib/site-features';
type Doctor = {
  user_id: string;
  specialty: string;
  bio: string;
  verified_doctors: { first_name: string; last_name: string };
};
type Slot = {
  id: string;
  doctor_id: string;
  starts_at: string;
  location: string;
};
type Thread = {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_label: string;
};
type Booking = {
  id: string;
  slot_id: string;
  patient_label: string;
  status: string;
  consultation_slots: Omit<Slot, "id">;
};
type State = {
  userId: string;
  doctors: Doctor[];
  slots: Slot[];
  threads: Thread[];
  bookings: Booking[];
  premium: boolean;
  isDoctor: boolean;
};
type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
async function careRequest(path = "", body?: unknown) {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  if (!session) throw Error("ავტორიზაცია საჭიროა / Sign in required");
  const r = await fetch("/api/care" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error);
  return data;
}
export default function CareWorkspace({ lang }: { lang: "ka" | "en" }) {
  const ka = lang === "ka";
  const enabled=useSiteFeatures().doctorConsultation;
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [thread, setThread] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState("");
  const selected = useRef("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    try {
      const next = await careRequest();
      if (current === generation.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const requestGeneration = generation;
    let timer = setTimeout(() => void load(), 0);
    try {
      const client = getSupabaseBrowserClient();
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(() => {
        requestGeneration.current++;
        selected.current = "";
        setData(null);
        setThread("");
        setMessages([]);
        clearTimeout(timer);
        timer = setTimeout(() => void load(), 0);
      });
      return () => {
        requestGeneration.current++;
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    } catch {
      return () => clearTimeout(timer);
    }
  }, [load]);
  const loadMessages = useCallback(async () => {
    if (!thread) return;
    try {
      const r = await careRequest("?thread=" + thread);
      if (selected.current === thread) {
        setMessages(r.messages);
        setError("");
      }
    } catch (e) {
      if (selected.current === thread)
        setError(e instanceof Error ? e.message : "Error");
    }
  }, [thread]);
  useEffect(() => {
    const initial = setTimeout(() => void loadMessages(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages();
    }, 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [loadMessages]);
  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      const r = await careRequest("", body);
      if (body.action === "message") {
        setText("");
        await loadMessages();
      } else {
        await load();
        if (r.thread) {
          selected.current = r.thread.id;
          setThread(r.thread.id);
          setMessages([]);
        }
      }
      setNotice(ka ? "შესრულებულია" : "Done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  function doctorName(id: string) {
    const d = data?.doctors.find((d) => d.user_id === id);
    return d
      ? `${d.verified_doctors.first_name} ${d.verified_doctors.last_name}`
      : ka
        ? "ექიმი"
        : "Doctor";
  }
  const date = (value: string) =>
    new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <div className="inner-container">
      <section className="workspace-card">
        <h1>{ka ? "ექიმები და კონსულტაცია" : "Doctors & consultations"}</h1>
        {!enabled&&<p role="status">{ka?'ახალი კონსულტაციები დროებით შეჩერებულია. ისტორიის ნახვა და ჯავშნის გაუქმება ხელმისაწვდომია.':'New consultations are paused. History and appointment cancellation remain available.'}</p>}
        <p>
          {ka
            ? "პირადი მიმოწერა არჩეულ ექიმთან და 30-წუთიანი ვიზიტის დაჯავშნა. ეს არ არის გადაუდებელი დახმარების სერვისი. ექიმი ვერ ხედავს შენს პერიოდის დღიურს."
            : "Private messages with your chosen doctor and 30-minute appointments. This is not an emergency service. Doctors cannot access your period journal."}
        </p>
        <p>
          {ka
            ? "პრემიუმის გადახდა ამ ეტაპზე სატესტოა. ექიმები გამოჩნდებიან მხოლოდ ადმინისტრატორის მიერ მათი დამატების შემდეგ."
            : "Premium checkout is currently test-only. Doctors appear only after an administrator adds them."}
        </p>
        {error && <p role="alert">{error}</p>}
        <p role="status">
          {loading ? (ka ? "იტვირთება…" : "Loading…") : notice}
        </p>
        <button onClick={() => void load()} disabled={busy}>
          {ka ? "განახლება" : "Refresh"}
        </button>
        {!data && !loading && (
          <Link href="/login">
            {ka ? "შესვლა / რეგისტრაცია" : "Sign in / register"}
          </Link>
        )}
        {data && !data.premium && !data.isDoctor && (
          <p>
            🔒{" "}
            {ka
              ? "ჩატისა და ჯავშნისთვის საჭიროა აქტიური პრემიუმი. წინა მიმოწერა ხელმისაწვდომი რჩება."
              : "Chat and booking require active Premium. Previous messages remain accessible."}{" "}
            <Link href="/premium">Premium</Link>
          </p>
        )}
      </section>
      {data && (
        <>
          <div className="workspace-grid">
            {data.doctors
              .filter((d) => d.user_id !== data.userId)
              .map((d) => (
                <article className="workspace-card" key={d.user_id}>
                  <h2>
                    {ka ? "ექიმი" : "Dr"} {doctorName(d.user_id)}{" "}
                    <span
                      aria-label={
                        ka ? "ვერიფიცირებული ექიმი" : "Verified doctor"
                      }
                    >
                      ✓
                    </span>
                  </h2>
                  <strong>{d.specialty}</strong>
                  <p>{d.bio}</p>
                  <button
                    disabled={busy || !data.premium || !enabled}
                    onClick={() =>
                      void action({ action: "start", id: d.user_id })
                    }
                  >
                    {ka ? "მიმოწერის დაწყება" : "Start chat"}
                  </button>
                  <h3>{ka ? "თავისუფალი დროები" : "Available appointments"}</h3>
                  {data.slots
                    .filter((s) => s.doctor_id === d.user_id)
                    .map((s) => (
                      <div key={s.id}>
                        <p>
                          {date(s.starts_at)} · {s.location}
                        </p>
                        <button
                          disabled={busy || !data.premium || !enabled}
                          onClick={() => {
                            if (
                              confirm(
                                ka
                                  ? "დაადასტურებ ამ ვიზიტის დაჯავშნას?"
                                  : "Confirm this appointment?",
                              )
                            )
                              void action({ action: "book", id: s.id });
                          }}
                        >
                          {ka ? "დაჯავშნა" : "Book"}
                        </button>
                      </div>
                    ))}
                </article>
              ))}
          </div>
          {!data.doctors.length && (
            <p>
              {ka
                ? "ხელმისაწვდომი ექიმი ჯერ არ არის დამატებული."
                : "No doctors are available yet."}
            </p>
          )}
          <section className="workspace-card">
            <h2>{ka ? "ჩემი ჯავშნები" : "My appointments"}</h2>
            {!data.bookings.length && (
              <p>{ka ? "ჯავშნები ჯერ არ გაქვს." : "No appointments yet."}</p>
            )}
            {data.bookings.map((b) => (
              <article key={b.id}>
                <p>
                  {date(b.consultation_slots.starts_at)} ·{" "}
                  {doctorName(b.consultation_slots.doctor_id)} ·{" "}
                  {b.consultation_slots.location} ·{" "}
                  {b.status === "cancelled"
                    ? ka
                      ? "გაუქმებული"
                      : "Cancelled"
                    : ka
                      ? "დადასტურებული"
                      : "Confirmed"}
                  {data.isDoctor ? ` · ${b.patient_label}` : ""}
                </p>
                {b.status === "confirmed" && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            ka ? "გაუქმდეს ჯავშანი?" : "Cancel appointment?",
                          )
                        )
                          void action({ action: "cancel", id: b.id });
                      }}
                    >
                      {ka ? "გაუქმება" : "Cancel"}
                    </button>
                  )}
              </article>
            ))}
          </section>
          <section className="workspace-card workspace-form">
            <h2>{ka ? "მიმოწერა" : "Messages"}</h2>
            <label>
              {ka ? "აირჩიე საუბარი" : "Choose conversation"}
              <select
                value={thread}
                disabled={busy}
                onChange={(e) => {
                  selected.current = e.target.value;
                  setThread(e.target.value);
                  setMessages([]);
                  setText("");
                }}
              >
                <option value="">{ka ? "აირჩიე" : "Choose"}</option>
                {data.threads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.doctor_id === data.userId
                      ? t.patient_label
                      : doctorName(t.doctor_id)}
                  </option>
                ))}
              </select>
            </label>
            {thread && (
              <>
                <p>
                  {ka
                    ? "ნაჩვენებია ბოლო 100 შეტყობინება; ახლდება ყოველ 15 წამში."
                    : "Showing the latest 100 messages; refreshes every 15 seconds."}
                </p>
                <div className="care-messages" aria-live="polite">
                  {messages.map((m) => (
                    <article
                      className={m.sender_id === data.userId ? "mine" : ""}
                      key={m.id}
                    >
                      <strong>
                        {m.sender_id === data.userId
                          ? ka
                            ? "შენ"
                            : "You"
                          : data.threads.find((t) => t.id === thread)
                                ?.doctor_id === m.sender_id
                            ? `${ka ? "ექიმი" : "Dr"} ${doctorName(m.sender_id)} ✓`
                            : data.threads.find((t) => t.id === thread)
                                ?.patient_label}
                      </strong>
                      <p>{m.body}</p>
                      <small>{date(m.created_at)}</small>
                    </article>
                  ))}
                </div>
                <form
                  className="workspace-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action({ action: "message", id: thread, body: text });
                  }}
                >
                  <label>
                    {ka ? "შეტყობინება" : "Message"}
                    <textarea
                      required
                      maxLength={2000}
                      rows={3}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={
                      busy || !enabled ||
                      (!data.premium &&
                        data.threads.find((t) => t.id === thread)?.doctor_id !==
                          data.userId)
                    }
                  >
                    {ka ? "გაგზავნა" : "Send"}
                  </button>
                </form>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
