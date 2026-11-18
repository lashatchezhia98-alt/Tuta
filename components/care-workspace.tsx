"use client";
import { SiteCopyText } from "@/components/site-copy-provider";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useSiteFeatures } from "@/lib/site-features";
import { useChatMessages } from "@/mobile/src/useChatMessages";
type Doctor = {
  user_id: string;
  specialty: string;
  bio: string;
  photoUrl: string | null;
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
  demoDoctors: { id: string; first_name: string; last_name: string; specialty: string; bio: string; photo_url: string }[];
  slots: Slot[];
  threads: Thread[];
  bookings: Booking[];
  premium: boolean;
  isDoctor: boolean;
};
async function careRequest(path = "", body?: unknown) {
  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();
  if (!session) throw Error("ავტორიზაცია საჭიროა / Sign in required");
  const r = await fetch(path.startsWith("/api/") ? path : "/api/care" + path, {
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
export default function CareWorkspace({ lang, doctorWorkspace = false }: { lang: "ka" | "en"; doctorWorkspace?: boolean }) {
  const ka = lang === "ka";
  const enabled = useSiteFeatures().doctorConsultation;
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [thread, setThread] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [blogTitle, setBlogTitle] = useState(""),
    [blogBody, setBlogBody] = useState(""),
    [blogCategory, setBlogCategory] = useState("cycle");
  const composer = useRef<HTMLFormElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const align = () => {
      const form = composer.current;
      if (!form) return;
      const shrink = document.documentElement.clientHeight - viewport.height;
      const hidden = Math.max(0, shrink - viewport.offsetTop);
      const typing = form.contains(document.activeElement);
      const dock = typing && viewport.scale <= 1.01 && shrink > 80;
      form.toggleAttribute("data-keyboard-docked", dock);
      if (dock) form.style.setProperty("--care-keyboard-inset", `${Math.ceil(hidden)}px`);
      else form.style.removeProperty("--care-keyboard-inset");
    };
    viewport.addEventListener("resize", align);
    viewport.addEventListener("scroll", align);
    return () => { viewport.removeEventListener("resize", align); viewport.removeEventListener("scroll", align); };
  }, []);
  const selected = useRef("");
  const generation = useRef(0);
  const authEpoch = useRef(0);
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
    const accountEpoch = authEpoch;
    let timer = setTimeout(() => void load(), 0);
    try {
      const client = getSupabaseBrowserClient();
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event) => {
        if (event === "TOKEN_REFRESHED") return;
        accountEpoch.current++;
        requestGeneration.current++;
        selected.current = "";
        setData(null);
        setThread("");
        setText("");
        setNotice("");
        setError("");
        setBusy(false);
        setLoading(true);
        clearTimeout(timer);
        timer = setTimeout(() => void load(), 0);
      });
      return () => {
        accountEpoch.current++;
        requestGeneration.current++;
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    } catch {
      return () => {
        accountEpoch.current++;
        requestGeneration.current++;
        clearTimeout(timer);
      };
    }
  }, [load]);
  const loadMessages = useCallback(async () => {
    if (!thread) return { messages: [], serverNow: new Date().toISOString() };
    const epoch = authEpoch.current;
    try {
      const r = await careRequest("?thread=" + thread);
      if (epoch === authEpoch.current && selected.current === thread) {
        return r;
      }
    } catch (e) {
      if (epoch === authEpoch.current && selected.current === thread) throw e;
    }
    return { messages: [], serverNow: new Date().toISOString() };
  }, [thread]);
  const chat = useChatMessages(
    data && thread ? `${data.userId}:${thread}` : "",
    loadMessages,
  );
  async function action(body: Record<string, unknown>) {
    const epoch = authEpoch.current;
    setBusy(true);
    setNotice("");
    try {
      const r = await careRequest("", body);
      if (epoch !== authEpoch.current) return;
      if (body.action === "message") {
        setText("");
        void careRequest("", { action: "typing", id: body.id, typing: false }).catch(() => {});
        await chat.refresh();
      } else {
        await load();
        if (epoch !== authEpoch.current) return;
        if (r.thread) {
          selected.current = r.thread.id;
          setThread(r.thread.id);
        }
      }
      if (epoch === authEpoch.current) setNotice(ka ? "შესრულებულია" : "Done");
    } catch (e) {
      if (epoch === authEpoch.current)
        setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (epoch === authEpoch.current) setBusy(false);
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
  const professionalView = doctorWorkspace || Boolean(data?.isDoctor);
  const bookings = data?.bookings.filter(b => !professionalView || b.consultation_slots?.doctor_id === data.userId) ?? [];
  const threads = data?.threads.filter(t => !professionalView || t.doctor_id === data.userId) ?? [];
  return (
    <div className="inner-container">
      <section className="workspace-card">
        <h1>{professionalView ? (ka ? "ექიმის კაბინეტი" : "Doctor workspace") : <SiteCopyText id="care.title" lang={lang}/>}</h1>
        {!enabled && (
          <p role="status">
            {ka
              ? "ახალი კონსულტაციები დროებით შეჩერებულია. ისტორიის ნახვა და ჯავშნის გაუქმება ხელმისაწვდომია."
              : "New consultations are paused. History and appointment cancellation remain available."}
          </p>
        )}
        <p>
          {professionalView ? (ka ? "ნახე შენი ვიზიტები და უპასუხე პაციენტებს." : "View your visits and reply to patients.") : <SiteCopyText id="care.intro" lang={lang}/>}
        </p>
        {data?.isDoctor && <p><Link href="/community">{ka ? "საზოგადოებაში გადასვლა" : "Go to community"}</Link></p>}
        <p>
          <SiteCopyText id="care.note" lang={lang}/>
        </p>
        {error && <p role="alert">{error}</p>}
        <p role="status">
          {loading ? (ka ? "იტვირთება…" : "Loading…") : notice}
        </p>
        <button onClick={() => void load()} disabled={busy}>
          {ka ? "განახლება" : "Refresh"}
        </button>
        {!data && !loading && (
          <Link href={doctorWorkspace ? "/login?next=%2Fconsultation%2Fdoctor" : "/login"}>
            {doctorWorkspace ? (ka ? "ექიმის ანგარიშით შესვლა" : "Sign in to your doctor account") : (ka ? "შესვლა / რეგისტრაცია" : "Sign in / register")}
          </Link>
        )}
        {doctorWorkspace && data && !data.isDoctor && <p role="status">
          {ka ? "ექიმის პროფილი ამ ანგარიშზე ჯერ არ არის აქტიური. გადაამოწმე ელფოსტა და დაუკავშირდი თუთას ადმინისტრაციას." : "An active doctor profile is not available for this account. Check your email address and contact Tuta administration."}
        </p>}
        {data && !professionalView && !data.premium && (
          <p>
            🔒{" "}
            {ka
              ? "ჩატისა და ჯავშნისთვის საჭიროა აქტიური პრემიუმი. წინა მიმოწერა ხელმისაწვდომი რჩება."
              : "Chat and booking require active Premium. Previous messages remain accessible."}{" "}
            <Link href="/premium">Premium</Link>
          </p>
        )}
      </section>
      {data && (!doctorWorkspace || data.isDoctor) && (
        <>
          {professionalView && <section className="workspace-card workspace-form">
            <h2>{ka ? "ჯანმრთელობის ბლოგის ახალი ჩანაწერი" : "Write a health article"}</h2>
            <p>{ka ? "გამოქვეყნებისთანავე სტატია საჯარო ბიბლიოთეკაში გამოჩნდება შენივე სახელით." : "Your article will be published in the public library under your name."}</p>
            <form onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true); setNotice("");
              try {
                await careRequest("/api/library", { title: blogTitle, body: blogBody, category: blogCategory });
                setBlogTitle(""); setBlogBody("");
                setNotice(ka ? "სტატია გამოქვეყნდა." : "Article published.");
              } catch (e) { setNotice(e instanceof Error ? e.message : "Could not publish."); }
              finally { setBusy(false); }
            }}>
              <label>{ka ? "სათაური" : "Title"}<input required maxLength={180} value={blogTitle} onChange={e => setBlogTitle(e.target.value)} /></label>
              <label>{ka ? "თემა" : "Topic"}<select value={blogCategory} onChange={e => setBlogCategory(e.target.value)}>
                <option value="cycle">{ka ? "ციკლი" : "Cycle"}</option><option value="pregnancy">{ka ? "ორსულობა" : "Pregnancy"}</option><option value="nutrition">{ka ? "კვება" : "Nutrition"}</option><option value="mental-health">{ka ? "ფსიქიკური ჯანმრთელობა" : "Mental health"}</option>
              </select></label>
              <label>{ka ? "სტატიის ტექსტი" : "Article"}<textarea required maxLength={6000} rows={8} value={blogBody} onChange={e => setBlogBody(e.target.value)} /></label>
              <button disabled={busy}>{ka ? "გამოქვეყნება" : "Publish"}</button>
            </form>
          </section>}
          {!professionalView && <><div className="workspace-grid">
            {data.doctors
              .filter((d) => d.user_id !== data.userId)
              .map((d) => (
                <article className="workspace-card" key={d.user_id}>
                  {d.photoUrl && (
                    <img
                      src={d.photoUrl}
                      alt={doctorName(d.user_id)}
                      width={72}
                      height={72}
                      className="doctor-avatar"
                    />
                  )}
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
                    <SiteCopyText id="care.startChat" lang={lang}/>
                  </button>
                  <h3><SiteCopyText id="care.slots" lang={lang}/></h3>
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
                          <SiteCopyText id="care.book" lang={lang}/>
                        </button>
                      </div>
                    ))}
                </article>
              ))}
            {data.demoDoctors?.map((d) => (
              <article className="workspace-card" key={`demo-${d.id}`}>
                <img src={d.photo_url} alt="DEMO" width={72} height={72} className="doctor-avatar" />
                <p><strong style={{ background: "#faedc7", borderRadius: 999, padding: "5px 10px" }}>DEMO · {ka ? "არა რეალური ექიმი" : "NOT A REAL DOCTOR"}</strong></p>
                <h2>{d.first_name} {d.last_name} · DEMO</h2>
                <strong>{d.specialty}</strong>
                <p>{ka ? "სატესტო პროფილი — კონსულტაცია, ჩატი და დაჯავშნა მიუწვდომელია." : "Demonstration profile — consultation, chat, and booking are unavailable."}</p>
              </article>
            ))}
          </div>
          {!data.doctors.length && !data.demoDoctors?.length && (
            <p>
              {ka
                ? "ხელმისაწვდომი ექიმი ჯერ არ არის დამატებული."
                : "No doctors are available yet."}
            </p>
          )}</>}
          <section className="workspace-card">
            <h2><SiteCopyText id="care.bookings" lang={lang}/></h2>
            {!bookings.length && (
              <p><SiteCopyText id="care.noBookings" lang={lang}/></p>
            )}
            {bookings.map((b) => (
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
            <h2><SiteCopyText id="care.messages" lang={lang}/></h2>
            <label>
              <SiteCopyText id="care.conversation" lang={lang}/>
              <select
                value={thread}
                disabled={busy}
                onChange={(e) => {
                  selected.current = e.target.value;
                  setThread(e.target.value);
                  setText("");
                }}
              >
                <option value="">{ka ? "აირჩიე" : "Choose"}</option>
                {threads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.doctor_id === data.userId
                      ? t.patient_label
                      : doctorName(t.doctor_id)}
                  </option>
                ))}
              </select>
            </label>
            {thread && threads.some(t => t.id === thread) && (
              <>
                <p>
                  <SiteCopyText id="care.retention" lang={lang}/>
                </p>
                {chat.error && <p role="alert">{chat.error}</p>}
                {chat.data?.typing && <p role="status">{professionalView ? (ka ? "პაციენტი წერს…" : "Patient is typing…") : (ka ? "ექიმი წერს…" : "Doctor is typing…")}</p>}
                <div className="care-messages" aria-live="polite">
                  {chat.messages.map((m) => (
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
                      <small>{date(m.created_at)}{m.sender_id === data.userId ? ` · ${m.read_at ? (ka ? "წაკითხულია" : "Read") : m.delivered_at ? (ka ? "მივიდა" : "Delivered") : (ka ? "გაგზავნილია" : "Sent")}` : ""}</small>
                    </article>
                  ))}
                </div>
                <form
                  ref={composer}
                  className="workspace-form care-chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action({ action: "message", id: thread, body: text });
                  }}
                >
                  <label>
                    <span className="care-chat-label"><SiteCopyText id="care.message" lang={lang}/></span>
                    <textarea
                      required
                      maxLength={2000}
                      rows={3}
                      value={text}
                      onChange={(e) => {
                        const value = e.target.value;
                        setText(value);
                        if (typingTimer.current) clearTimeout(typingTimer.current);
                        typingTimer.current = setTimeout(() => {
                          void careRequest("", { action: "typing", id: thread, typing: Boolean(value.trim()) }).catch(() => {});
                        }, 250);
                      }}
                    />
                  </label>
                  <button
                    onPointerDown={(event) => {
                      if (composer.current?.hasAttribute("data-keyboard-docked")) event.preventDefault();
                    }}
                    disabled={
                      busy ||
                      !enabled ||
                      (!data.premium &&
                        data.threads.find((t) => t.id === thread)?.doctor_id !==
                          data.userId)
                    }
                  >
                    <SiteCopyText id="care.send" lang={lang}/>
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
