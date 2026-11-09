"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Invite = { id: string; email: string; expires_at: string; used_at: string | null; revoked_at: string | null };
type Member = { user_id: string; email: string; granted_at: string };
const endpoint = "/api/admin/invitations";

export default function AdminInvitations({ lang }: { lang: "ka" | "en" }) {
  const ka = lang === "ka";
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);
  const failed = ka ? "მოქმედება ვერ შესრულდა. სცადე ხელახლა." : "Could not complete the action. Try again.";

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { signal, cache: "no-store" });
      if (!response.ok) throw Error(failed);
      const data = await response.json() as { invites: Invite[]; members: Member[] };
      if (!signal?.aborted) { setInvites(data.invites); setMembers(data.members); setLoadedAt(Date.now()); }
    } catch { if (!signal?.aborted) setError(failed); }
  }, [failed]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  async function act(body: { action: "create"; email: string } | { action: "revoke-invite" | "revoke-member"; id: string }) {
    if (busy) return;
    setBusy(true); setError(""); setNotice(""); setLink("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { path?: string; error?: string };
      if (!response.ok) throw Error(data.error || failed);
      if (body.action === "create" && data.path) {
        setLink(new URL(data.path, window.location.origin).href);
        setEmail("");
      } else setNotice(ka ? "წვდომა გაუქმდა." : "Access revoked.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : failed); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setNotice(ka ? "ბმული დაკოპირებულია." : "Link copied."); }
    catch { setNotice(ka ? "მონიშნე ბმული და ხელით დააკოპირე." : "Select the link and copy it manually."); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void act({ action: "create", email });
  }

  const format = (value: string) => new Intl.DateTimeFormat(ka ? "ka-GE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <div className="copy-editor admin-invites">
    <form onSubmit={create}>
      <label>{ka ? "მოწვეული პირის ელფოსტა" : "Invitee email"}<input type="email" maxLength={254} required autoComplete="off" value={email} onChange={event => setEmail(event.target.value)}/></label>
      <button type="submit" disabled={busy} className="copy-editor-primary">{ka ? "ბმულის შექმნა" : "Create link"}</button>
    </form>
    <p>{ka ? "ბმული 24 საათით მოქმედებს. დააკოპირე და მხოლოდ მოწვეულ ადამიანს გაუგზავნე." : "The link is valid for 24 hours. Copy it and send it only to the invitee."}</p>
    {link && <div className="copy-editor-actions"><input readOnly aria-label={ka ? "მოწვევის ბმული" : "Invitation link"} value={link} onFocus={event => event.currentTarget.select()}/><button type="button" onClick={() => void copyLink()}>{ka ? "ბმულის კოპირება" : "Copy link"}</button></div>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="copy-editor-error">{error}</p>}
    <section><h2>{ka ? "მოწვევების ისტორია" : "Invitation history"}</h2>
      {!busy && !invites.length && <p>{ka ? "მოწვევები ჯერ არ არის." : "No invitations yet."}</p>}
      {invites.map(invite => {
        const expired = Date.parse(invite.expires_at) <= loadedAt;
        const state = invite.used_at ? (ka ? "გამოყენებულია" : "Used") : invite.revoked_at ? (ka ? "გაუქმებულია" : "Revoked") : expired ? (ka ? "ვადაგასულია" : "Expired") : (ka ? "მოქმედია" : "Active");
        return <div className="admin-invite-row" key={invite.id}><div><strong>{invite.email}</strong><small>{state} · {format(invite.expires_at)}</small></div>{!invite.used_at && !invite.revoked_at && !expired && <button type="button" disabled={busy} onClick={() => void act({ action: "revoke-invite", id: invite.id })}>{ka ? "მოწვევის გაუქმება" : "Revoke invite"}</button>}</div>;
      })}
    </section>
    <section><h2>{ka ? "მოწვეული ადმინები" : "Invited admins"}</h2>
      {!busy && !members.length && <p>{ka ? "მოწვეული ადმინები ჯერ არ არიან." : "No invited admins yet."}</p>}
      {members.map(member => <div className="admin-invite-row" key={member.user_id}><div><strong>{member.email}</strong><small>{format(member.granted_at)}</small></div><button type="button" disabled={busy} onClick={() => { if (window.confirm(ka ? "გავაუქმოთ ამ ადმინის წვდომა?" : "Revoke this administrator’s access?")) void act({ action: "revoke-member", id: member.user_id }); }}>{ka ? "წვდომის გაუქმება" : "Revoke access"}</button></div>)}
    </section>
  </div>;
}
