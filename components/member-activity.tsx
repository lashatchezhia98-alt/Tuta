"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HeaderActions from "@/components/header-actions";
import BrandMark from "@/components/brand-mark";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { activityGroups, activityKinds, activityReadEvent, activityTone, activityTones } from "@/mobile/src/activity.mjs";

type Lang = "ka" | "en";
type Item = {
  id: string;
  kind: keyof typeof activityKinds;
  post_id: string | null;
  comment_id: string | null;
  created_at: string;
  read_at: string | null;
};
type Inbox = { items: Item[]; preferences: Record<string, boolean> };

export default function MemberActivity() {
  const [lang, setLang] = useState<Lang>("ka");
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const [authError, setAuthError] = useState(false);
  const ka = lang === "ka";
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setLang(localStorage.getItem("tuta-language") === "en" ? "en" : "ka"); });
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
        if (active) setOwner(session && !session.user.is_anonymous ? session.user.id : null);
      });
      return () => { active = false; subscription.unsubscribe(); };
    } catch {
      queueMicrotask(() => { if (active) setAuthError(true); });
      return () => { active = false; };
    }
  }, []);
  return <>
    <header className="inner-header period-inner-header"><div className="inner-container inner-nav">
      <Link className="inner-logo" href="/"><BrandMark/><strong>{ka ? "თუთა" : "Tuta"}</strong></Link>
      <HeaderActions lang={lang} setLang={value => { localStorage.setItem("tuta-language", value); setLang(value); }}/>
    </div></header>
    <main className="workspace">
      <div className="workspace-main">
        <h1>{ka ? "შეტყობინებები" : "Notifications"}</h1>
        {authError ? <p role="alert">{ka ? "ანგარიშთან დაკავშირება ვერ მოხერხდა." : "Could not connect to your account."}</p>
          : owner === undefined ? <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p>
          : owner === null ? <Link href="/login">{ka ? "გაიარე ავტორიზაცია" : "Sign in"}</Link>
          : <ActivityInbox key={owner} owner={owner} lang={lang}/>}
        <Link href="/app/notifications">{ka ? "თუთას განცხადებები" : "Tuta announcements"}</Link>
      </div>
    </main>
  </>;
}

function ActivityInbox({ owner, lang }: { owner: string; lang: Lang }) {
  const ka = lang === "ka";
  const [data, setData] = useState<Inbox | null>(null);
  const [failed, setFailed] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    const client = getSupabaseBrowserClient();
    void Promise.all([
      client.from("activity_notifications").select("id,kind,post_id,comment_id,created_at,read_at")
        .eq("user_id", owner).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50).abortSignal(controller.signal),
      client.from("activity_preferences").select("post_comment,comment_reply,care,market,premium")
        .eq("user_id", owner).abortSignal(controller.signal).maybeSingle(),
    ]).then(([inbox, preferences]) => {
      if (inbox.error || preferences.error) throw Error("Activity unavailable");
      if (!controller.signal.aborted) {
        setData({ items: inbox.data as Item[], preferences: preferences.data ?? {} });
        setFailed(false);
      }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [owner, revision, busy]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 30_000);
    return () => { window.removeEventListener("focus", refresh); clearInterval(timer); };
  }, []);

  async function update(key?: string, enabled?: boolean, id?: string) {
    if (busy) return;
    setBusy(true);
    setWriteFailed(false);
    try {
      const client = getSupabaseBrowserClient();
      if (key) {
        const init = await client.from("activity_preferences").upsert({ user_id: owner }, { onConflict: "user_id", ignoreDuplicates: true });
        if (init.error) throw init.error;
        const change = await client.from("activity_preferences").update({ [key]: enabled }).eq("user_id", owner).select(key).single();
        if (change.error) throw change.error;
        setData(current => current && ({ ...current, preferences: { ...current.preferences, [key]: Boolean(enabled) } }));
      } else {
        const at = new Date().toISOString();
        let query = client.from("activity_notifications").update({ read_at: at }).eq("user_id", owner).is("read_at", null);
        if (id) query = query.eq("id", id);
        const result = await query;
        if (result.error) throw result.error;
        setData(current => current && ({ ...current, items: current.items.map(item => !item.read_at && (!id || id === item.id) ? { ...item, read_at: at } : item) }));
        window.dispatchEvent(new Event(activityReadEvent));
      }
    } catch {
      setWriteFailed(true);
    } finally {
      setBusy(false);
      setRevision(value => value + 1);
    }
  }
  const paths: Record<string, string> = { home: "/community", care: "/consultation", orders: "/market/orders", premium: "/premium" };
  return <>
    {failed ? <div role="alert"><p>{ka ? "შეტყობინებები ვერ ჩაიტვირთა." : "Notifications could not be loaded."}</p><button type="button" onClick={() => setRevision(value => value + 1)}>{ka ? "სცადე ხელახლა" : "Try again"}</button></div>
      : !data ? <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p> : null}
    {writeFailed && <p role="alert">{ka ? "ცვლილება ვერ შეინახა." : "Could not save the change."}</p>}
    {data && <>
      <details className="workspace-card">
        <summary>{ka ? "შეტყობინებების პარამეტრები" : "Notification preferences"}</summary>
        <p>{ka ? "აირჩიე, რა ტიპის ახალი შეტყობინებები გინდა მიიღო. ტელეფონის ჩაკეტილ ეკრანზე პირადი დეტალები არ ჩანს." : "Choose which new notifications to receive. Phone alerts hide private details on the lock screen."}</p>
        {activityGroups.map(([key, geo, en]) => <label key={key} className="workspace-row">
          <span>{ka ? geo : en}</span>
          <input type="checkbox" disabled={busy} checked={data.preferences[key] !== false} onChange={event => void update(key, event.target.checked)}/>
        </label>)}
      </details>
      {data.items.some(item => !item.read_at) && <button type="button" disabled={busy} onClick={() => void update()}>{ka ? "ყველა წაკითხულად მონიშვნა" : "Mark all as read"}</button>}
      {!data.items.length && <p>{ka ? "ჯერ ახალი შეტყობინებები არ გაქვს." : "No notifications yet."}</p>}
      {data.items.map(item => {
        if (!Object.hasOwn(activityKinds, item.kind)) return null;
        const [geo, en, destination] = activityKinds[item.kind];
        const href = destination === "home" && item.post_id
          ? `/community?${new URLSearchParams({ post: item.post_id, ...(item.comment_id ? { comment: item.comment_id } : {}) })}`
          : paths[destination];
        const tone = activityTones[activityTone(item.kind)];
        return <article className="workspace-card activity-card" data-unread={!item.read_at} key={item.id} style={{ background: tone.background }}>
          <div className="activity-card-heading"><span className="activity-status-icon" style={{ color: tone.color }} role="img" aria-label={tone.label[ka ? 0 : 1]}>{tone.icon}</span>
            <Link href={href} onClick={() => { if (!item.read_at) void update(undefined, undefined, item.id); }}>{ka ? geo : en}</Link>
            {!item.read_at && <span className="activity-dot" role="img" aria-label={ka ? "წაუკითხავი" : "Unread"}/>}
          </div>
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(ka ? "ka-GE" : "en-GB")}</time>
        </article>;
      })}
    </>}
  </>;
}
