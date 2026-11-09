"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Notice = { id: string; title: string; body: string; scheduled_at: string; read_at: string | null };
type State = { token: string | null; rows: Notice[]; status: "loading" | "signed-out" | "ready" | "error" };
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function language() { return localStorage.getItem("tuta-language") === "en" ? "en" : "ka"; }

export default function MemberAnnouncements() {
  const ka = useSyncExternalStore(subscribe, language, () => "ka") === "ka";
  const [state, setState] = useState<State>({ token: null, rows: [], status: "loading" });
  const [revision, setRevision] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let controller: AbortController | undefined;
    let active = true;
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        controller?.abort();
        if (!session || session.user.is_anonymous) { setState({ token: null, rows: [], status: "signed-out" }); return; }
        const request = new AbortController();
        controller = request;
        const token = session.access_token;
        setState(current => current.token === token ? current : { token, rows: [], status: "loading" });
        void fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` }, signal: request.signal, cache: "no-store" })
          .then(async response => {
            if (!response.ok) throw new Error("Unavailable");
            const data = await response.json() as { rows: Notice[] };
            if (active && !request.signal.aborted) setState({ token, rows: data.rows, status: "ready" });
          })
          .catch(() => { if (active && !request.signal.aborted) setState({ token, rows: [], status: "error" }); });
      });
      return () => { active = false; controller?.abort(); subscription.unsubscribe(); };
    } catch {
      queueMicrotask(() => { if (active) setState({ token: null, rows: [], status: "error" }); });
      return () => { active = false; };
    }
  }, [revision]);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);

  async function markRead(id: string) {
    const token = state.token;
    if (!token || working) return;
    setWorking(id);
    setError(false);
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("Unavailable");
      setState(current => current.token === token ? { ...current, rows: current.rows.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row) } : current);
    } catch { setError(true); }
    finally { setWorking(null); }
  }

  return <main className="inner-container settings-workspace ops-stack">
    <Link href="/app/settings">← {ka ? "ჩემი ანგარიში" : "My account"}</Link>
    <h1>{ka ? "შეტყობინებები" : "Announcements"}</h1>
    {state.status === "loading" && <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p>}
    {state.status === "signed-out" && <Link href="/login">{ka ? "შეტყობინებების სანახავად შედი ანგარიშში" : "Sign in to view announcements"}</Link>}
    {state.status === "error" && <p role="alert">{ka ? "შეტყობინებები ვერ ჩაიტვირთა." : "Could not load announcements."} <button type="button" onClick={() => setRevision(value => value + 1)}>{ka ? "ხელახლა ცდა" : "Retry"}</button></p>}
    {error && <p role="alert">{ka ? "წაკითხვის სტატუსი ვერ შეინახა." : "Could not mark as read."}</p>}
    {state.status === "ready" && (!state.rows.length ? <p className="admin-empty-state">{ka ? "შეტყობინებები ჯერ არ არის." : "No announcements yet."}</p> : state.rows.map(row => (
      <article className="ops-entry ops-stack" key={row.id}>
        <h2>{row.title}</h2>
        <time dateTime={row.scheduled_at}>{new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Tbilisi" }).format(new Date(row.scheduled_at))}</time>
        <p className="ops-message">{row.body}</p>
        {row.read_at ? <small>{ka ? "წაკითხულია" : "Read"}</small> : <button type="button" disabled={working !== null} onClick={() => void markRead(row.id)}>{ka ? "წაკითხულად მონიშვნა" : "Mark as read"}</button>}
      </article>
    )))}
  </main>;
}
