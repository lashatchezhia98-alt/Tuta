"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { symptoms } from "@/mobile/src/symptoms.mjs";
import { adminRoleLabels as roleLabels, type AdminAccess } from "@/lib/admin-sections";

type Lang = "ka" | "en";
type RowSet<T> = { rows: T[]; more: boolean };
type Account = { id: string; name: string; email: string | null; joined_at: string; last_active: string | null; blocked: boolean; confirmed: boolean; premium: boolean; doctor: boolean; protected: boolean; access_role: Exclude<AdminAccess, "owner"> | null };
type Payment = { order_id: string; user_id: string; plan: "monthly" | "yearly"; status: string; amount: number; created_at: string };
type Grant = { id: string; user_id: string; reason: string; expires_at: string; revoked_at: string | null };
type Billing = RowSet<Payment> & { summary: { active: number; testTotal: number; testApproved: number; testUnsuccessful: number }; grants: Grant[] };
type Announcement = { id: string; title: string; body: string; audience: "all" | "free" | "premium"; scheduled_at: string; cancelled_at: string | null };
type Stats = { averageDays: number | null; irregularPercent: number | null; symptoms: { id: string; count: number }[] };

function tr(lang: Lang, ka: string, en: string) { return lang === "ka" ? ka : en; }
function formatDate(value: string | null, lang: Lang) {
  return value ? new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tbilisi" }).format(new Date(value)) : "—";
}
function formatMoney(amount: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "ka" ? "ka-GE" : "en-GB", { style: "currency", currency: "GEL" }).format(amount / 100);
}
const statusLabels = { pending: ["მოლოდინში", "Pending"], created: ["შექმნილი", "Created"], processing: ["მუშავდება", "Processing"], approved: ["დადასტურებული", "Approved"], declined: ["უარყოფილი", "Declined"], expired: ["ვადაგასული", "Expired"], reversed: ["დაბრუნებული", "Reversed"], failed: ["წარუმატებელი", "Failed"] } as const;
const audienceLabels = { all: ["ყველა მომხმარებელი", "All members"], free: ["უფასო გეგმა", "Free members"], premium: ["Premium", "Premium members"] } as const;

function useOperation<T>(url: string, lang: Lang) {
  const [response, setResponse] = useState<{ url: string; data: T } | null>(null);
  const [problem, setProblem] = useState<{ url: string; message: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const fallback = tr(lang, "მოთხოვნა ვერ შესრულდა.", "The request failed.");
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || fallback);
        if (!controller.signal.aborted) { setResponse({ url, data }); setProblem(null); }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setProblem({ url, message: error instanceof Error ? error.message : fallback });
      });
    return () => controller.abort();
  }, [url, fallback, revision]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  async function mutate(body: Record<string, unknown>, method = "POST") {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(url.split("?")[0], { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || fallback);
      setMessage(tr(lang, "ცვლილება შენახულია.", "Change saved."));
      refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
      return false;
    } finally { setBusy(false); }
  }
  return { data: response?.url === url ? response.data : null, error: problem?.url === url ? problem.message : "", message, busy, mutate, refresh };
}

function Feedback({ lang, error, message, loading, refresh }: { lang: Lang; error: string; message?: string; loading: boolean; refresh: () => void }) {
  return <>
    {error ? <div className="admin-notice admin-error" role="alert">{error} <button type="button" onClick={refresh}>{tr(lang, "ხელახლა ცდა", "Retry")}</button></div>
      : loading ? <p role="status">{tr(lang, "იტვირთება…", "Loading…")}</p> : null}
    {message && <p className="admin-notice" role="status">{message}</p>}
  </>;
}

function Pager({ lang, page, more, setPage }: { lang: Lang; page: number; more: boolean; setPage: (page: number) => void }) {
  return <nav className="ops-actions" aria-label={tr(lang, "გვერდები", "Pages")}>
    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{tr(lang, "წინა", "Previous")}</button>
    <span>{page + 1}</span>
    <button type="button" disabled={!more} onClick={() => setPage(page + 1)}>{tr(lang, "შემდეგი", "Next")}</button>
  </nav>;
}

export function AdminUsers({ lang, owner, initialQuery }: { lang: Lang; owner: boolean; initialQuery: string }) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(input);
  const [plan, setPlan] = useState("all");
  const [joined, setJoined] = useState("0");
  const [page, setPage] = useState(0);
  const [grant, setGrant] = useState<Account | null>(null);
  const op = useOperation<RowSet<Account>>(`/api/admin/users?${new URLSearchParams({ q: query, plan, joined, page: String(page) })}`, lang);
  const billing = useOperation<Billing>(grant ? `/api/admin/billing?user=${grant.id}` : "", lang);
  async function grantPremium(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!grant) return;
    const fields = new FormData(e.currentTarget);
    if (await billing.mutate({ action: "grant", id: grant.id, days: Number(fields.get("days")), reason: fields.get("reason") })) {
      setGrant(null);
      op.refresh();
    }
  }
  return <div className="ops-stack">
    <form className="ops-filters" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(input.trim()); }}>
      <label>{tr(lang, "ძიება", "Search")}<input value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tr(lang, "სახელი ან ელფოსტა", "Name or email")}/></label>
      <label>{tr(lang, "გეგმა", "Plan")}<select value={plan} onChange={e => { setPlan(e.target.value); setPage(0); }}><option value="all">{tr(lang, "ყველა", "All")}</option><option value="free">{tr(lang, "უფასო", "Free")}</option><option value="premium">Premium</option></select></label>
      <label>{tr(lang, "რეგისტრაცია", "Joined")}<select value={joined} onChange={e => { setJoined(e.target.value); setPage(0); }}><option value="0">{tr(lang, "ნებისმიერი დრო", "Any time")}</option>{[7, 30, 90].map(day => <option value={day} key={day}>{tr(lang, `ბოლო ${day} დღე`, `Last ${day} days`)}</option>)}</select></label>
      <button type="submit">{tr(lang, "ძებნა", "Search")}</button>
    </form>
    {owner && <p>{tr(lang, "ადმინის ახალი წვდომისთვის გამოიყენე მოწვევა. დაბლოკვა ხელს უშლის ახალ შესვლას; არსებული სესია შეიძლება ვადის გასვლამდე დარჩეს აქტიური.", "Use an invitation for new admin access. Blocking prevents new sign-ins; existing sessions may remain active until expiry.")} <Link href="/admin/invitations">{tr(lang, "ადმინის მოწვევები", "Admin invitations")}</Link></p>}
    <Feedback lang={lang} {...op} loading={!op.data}/>
    {grant && <form className="ops-entry ops-stack" onSubmit={grantPremium}>
      <strong>{tr(lang, "Premium წვდომის მინიჭება:", "Grant Premium access:")} {grant.email}</strong>
      <div className="ops-filters"><label>{tr(lang, "დღეები", "Days")}<input name="days" type="number" min={1} max={365} defaultValue={30} required/></label><label>{tr(lang, "მიზეზი", "Reason")}<input name="reason" minLength={3} maxLength={200} required/></label></div>
      <p>{tr(lang, "ბარათიდან თანხა არ ჩამოიჭრება.", "The user will not be charged.")}</p>
      <div className="ops-actions"><button disabled={billing.busy}>{tr(lang, "მინიჭება", "Grant access")}</button><button type="button" disabled={billing.busy} onClick={() => setGrant(null)}>{tr(lang, "გაუქმება", "Cancel")}</button></div>
      {billing.message && <p role="status">{billing.message}</p>}
    </form>}
    {op.data && (op.data.rows.length ? <div className="ops-table-wrap"><table className="ops-table">
      <thead><tr>{(lang === "ka" ? ["ანგარიში", "გეგმა / როლი", "რეგისტრაცია", "ბოლო შესვლა", ...(owner ? ["მოქმედება"] : [])] : ["Account", "Plan / role", "Joined", "Last sign-in", ...(owner ? ["Actions"] : [])]).map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
      <tbody>{op.data.rows.map(row => <tr key={row.id}>
        <td><strong>{row.name || row.email || "—"}</strong>{row.name && row.email && <small>{row.email}</small>}{row.blocked && <small>{tr(lang, "დაბლოკილია", "Blocked")}</small>}{!row.confirmed && <small>{tr(lang, "ელფოსტა დაუდასტურებელია", "Email unverified")}</small>}</td>
        <td>{row.premium ? "Premium" : tr(lang, "უფასო", "Free")}{row.doctor && <small>{tr(lang, "ექიმი", "Doctor")}</small>}{row.protected ? <small>{tr(lang, "მთავარი ადმინი", "Owner")}</small> : row.access_role && <small>{roleLabels[row.access_role][lang === "ka" ? 0 : 1]}</small>}</td>
        <td>{formatDate(row.joined_at, lang)}</td><td>{formatDate(row.last_active, lang)}</td>
        {owner && <td><div className="ops-actions">
          {!row.protected && row.access_role && <select aria-label={tr(lang, `${row.email} — როლი`, `Role for ${row.email}`)} value={row.access_role} disabled={op.busy} onChange={e => {
            if (window.confirm(tr(lang, "შევცვალოთ ამ ადმინის წვდომა?", "Change this administrator's access?"))) void op.mutate({ id: row.id, action: "role", role: e.target.value }, "PATCH");
          }}>{Object.entries(roleLabels).map(([key, values]) => <option key={key} value={key}>{values[lang === "ka" ? 0 : 1]}</option>)}</select>}
          {!row.protected && (!row.access_role || row.blocked) && <button type="button" disabled={op.busy} onClick={() => {
            if (window.confirm(row.blocked ? tr(lang, "მოვხსნათ ბლოკი?", "Unblock this account?") : tr(lang, "დავბლოკოთ ახალი შესვლა?", "Block new sign-ins?"))) void op.mutate({ id: row.id, action: row.blocked ? "unblock" : "block" }, "PATCH");
          }}>{row.blocked ? tr(lang, "ბლოკის მოხსნა", "Unblock") : tr(lang, "დაბლოკვა", "Block")}</button>}
          {row.confirmed && !row.blocked && <button type="button" onClick={() => setGrant(row)}>{tr(lang, "Premium-ის მინიჭება", "Grant Premium")}</button>}
          <Link href={`/admin/billing?user=${row.id}`}>{tr(lang, "გადახდები", "Payments")}</Link>
        </div></td>}
      </tr>)}</tbody>
    </table></div> : <p className="admin-empty-state">{tr(lang, "ანგარიში ვერ მოიძებნა.", "No accounts found.")}</p>)}
    {op.data && (page > 0 || op.data.more) && <Pager lang={lang} page={page} more={op.data.more} setPage={setPage}/>}
  </div>;
}

export function AdminBilling({ lang, owner, initialUser }: { lang: Lang; owner: boolean; initialUser: string }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [user, setUser] = useState(initialUser);
  const op = useOperation<Billing>(`/api/admin/billing?${new URLSearchParams({ status, user, page: String(page) })}`, lang);
  const i = lang === "ka" ? 0 : 1;
  return <div className="ops-stack">
    <p className="admin-notice">{tr(lang, "Flitt სატესტო რეჟიმშია. ნაჩვენები თანხა რეალური შემოსავალი არ არის. პროვაიდერის სტატუსი ხელით არ იცვლება.", "Flitt is in test mode. These amounts are not real revenue. Provider payment statuses cannot be edited here.")}</p>
    <Feedback lang={lang} {...op} loading={!op.data}/>
    {op.data && <dl className="ops-metrics">
      <div><dt>{tr(lang, "აქტიური Premium", "Active Premium")}</dt><dd>{op.data.summary.active}</dd></div>
      <div><dt>{tr(lang, "სატესტო თანხა · 30 დღე", "Test amount · 30 days")}</dt><dd>{formatMoney(op.data.summary.testTotal, lang)}</dd></div>
      <div><dt>{tr(lang, "წარმატებული · 30 დღე", "Successful · 30 days")}</dt><dd>{op.data.summary.testApproved}</dd></div>
      <div><dt>{tr(lang, "წარუმატებელი / დაბრუნებული · 30 დღე", "Failed / reversed · 30 days")}</dt><dd>{op.data.summary.testUnsuccessful}</dd></div>
    </dl>}
    <div className="ops-filters"><label>{tr(lang, "გადახდის სტატუსი", "Payment status")}<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">{tr(lang, "ყველა სტატუსი", "All statuses")}</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label[i]}</option>)}</select></label>{user && <button type="button" onClick={() => { setUser(""); setPage(0); window.history.replaceState(null, "", "/admin/billing"); }}>{tr(lang, "ყველა ანგარიშის ჩვენება", "Show all accounts")}</button>}</div>
    {op.data && (op.data.rows.length ? <div className="ops-table-wrap"><table className="ops-table">
      <thead><tr>{(lang === "ka" ? ["გადახდა / ანგარიში", "გეგმა", "თანხა", "სტატუსი", "თარიღი"] : ["Payment / account", "Plan", "Amount", "Status", "Date"]).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{op.data.rows.map(row => <tr key={row.order_id}><td><strong>{row.order_id}</strong><small><Link href={`/admin/users?q=${row.user_id}`}>{tr(lang, "ანგარიშის ნახვა", "View account")}</Link></small></td><td>{row.plan === "monthly" ? tr(lang, "თვიური", "Monthly") : tr(lang, "წლიური", "Yearly")}</td><td>{formatMoney(row.amount, lang)}</td><td>{statusLabels[row.status as keyof typeof statusLabels]?.[i] || row.status}</td><td>{formatDate(row.created_at, lang)}</td></tr>)}</tbody>
    </table></div> : <p className="admin-empty-state">{tr(lang, "ამ ფილტრით გადახდები არ მოიძებნა.", "No payments match this filter.")}</p>)}
    {op.data && (page > 0 || op.data.more) && <Pager lang={lang} page={page} more={op.data.more} setPage={setPage}/>}
    <h2>{tr(lang, "ადმინისტრატორის მიერ მინიჭებული Premium", "Administrator-granted Premium")}</h2>
    <p>{tr(lang, "წვდომა მიეცი ანგარიშების გვერდიდან. ქვემოთ ჩანს ბოლო 25 ჩანაწერი.", "Grant access from the Accounts page. The latest 25 entries are shown below.")} <Link href="/admin/users">{tr(lang, "ანგარიშები", "Accounts")}</Link></p>
    {op.data?.grants.length ? op.data.grants.map(row => <article key={row.id} className="ops-entry ops-actions">
      <div><strong>{row.reason}</strong><small>{tr(lang, "ვადა:", "Expires:")} {formatDate(row.expires_at, lang)}{row.revoked_at && ` · ${tr(lang, "გაუქმებულია", "Revoked")}`}</small></div>
      <Link href={`/admin/users?q=${row.user_id}`}>{tr(lang, "ანგარიში", "Account")}</Link>
      {owner && !row.revoked_at && <button type="button" disabled={op.busy} onClick={() => {
        if (window.confirm(tr(lang, "მოვხსნათ ხელით მინიჭებული წვდომა? გადახდილი Premium არ შეიცვლება.", "Revoke the manual grant? Paid Premium will remain unchanged."))) void op.mutate({ action: "revoke", id: row.id });
      }}>{tr(lang, "წვდომის გაუქმება", "Revoke grant")}</button>}
    </article>) : op.data && <p className="admin-empty-state">{tr(lang, "ხელით მინიჭებული წვდომა ჯერ არ არის.", "No manual grants yet.")}</p>}
  </div>;
}

export function AdminNotifications({ lang }: { lang: Lang }) {
  const [page, setPage] = useState(0);
  const [scheduled, setScheduled] = useState(false);
  const [publishId, setPublishId] = useState<string | null>(null);
  const op = useOperation<RowSet<Announcement> & { now: string }>(`/api/admin/notifications?page=${page}`, lang);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    const time = scheduled ? Date.parse(String(fields.get("time"))) : null;
    if (time !== null && !Number.isFinite(time)) return;
    if (!window.confirm(tr(lang, "დავადასტუროთ გამოქვეყნება არჩეული ჯგუფისთვის?", "Confirm publication for this audience?"))) return;
    const id = publishId ?? crypto.randomUUID();
    setPublishId(id);
    if (await op.mutate({ action: "publish", id, title: fields.get("title"), body: fields.get("body"), audience: fields.get("audience"), scheduledAt: time === null ? null : new Date(time).toISOString() })) {
      form.reset();
      setPublishId(null);
      setScheduled(false);
      setPage(0);
    }
  }
  return <div className="ops-stack">
    <p className="admin-notice">{tr(lang, "შეტყობინება გამოჩნდება ანგარიშში, ვებსაიტზე. ეს არ აგზავნის ელფოსტას ან ტელეფონის Push შეტყობინებას. მიმღების გეგმა მოწმდება ნახვისას.", "Announcements appear in the member's web account. This does not send email or device push. The member’s plan is checked when viewing.")}</p>
    <form className="ops-stack" onSubmit={submit} onChange={() => setPublishId(null)}>
      <label>{tr(lang, "სათაური", "Title")}<input name="title" required maxLength={100}/></label>
      <label>{tr(lang, "შეტყობინება", "Message")}<textarea name="body" required maxLength={500} rows={4}/></label>
      <div className="ops-filters">
        <label>{tr(lang, "მიმღებები", "Audience")}<select name="audience">{Object.entries(audienceLabels).map(([key, label]) => <option value={key} key={key}>{label[lang === "ka" ? 0 : 1]}</option>)}</select></label>
        <label>{tr(lang, "გამოქვეყნება", "Publish")}<select value={scheduled ? "later" : "now"} onChange={e => setScheduled(e.target.value === "later")}><option value="now">{tr(lang, "ახლავე", "Now")}</option><option value="later">{tr(lang, "დაგეგმვა", "Schedule")}</option></select></label>
        {scheduled && <label>{tr(lang, "თარიღი და დრო (შენი მოწყობილობის დროით)", "Date and time (your device time zone)")}<input name="time" type="datetime-local" required/></label>}
      </div>
      <button type="submit" disabled={op.busy}>{scheduled ? tr(lang, "დაგეგმვა", "Schedule") : tr(lang, "გამოქვეყნება", "Publish")}</button>
    </form>
    <h2>{tr(lang, "ისტორია", "History")}</h2>
    <Feedback lang={lang} {...op} loading={!op.data}/>
    {op.data?.rows.length ? op.data.rows.map(row => {
      const upcoming = Date.parse(row.scheduled_at) > Date.parse(op.data!.now);
      return <article key={row.id} className="ops-entry ops-stack"><strong>{row.title}</strong><p className="ops-message">{row.body}</p><small>{audienceLabels[row.audience][lang === "ka" ? 0 : 1]} · {formatDate(row.scheduled_at, lang)} · {row.cancelled_at ? tr(lang, "გაუქმებულია", "Cancelled") : upcoming ? tr(lang, "დაგეგმილია", "Scheduled") : tr(lang, "გამოქვეყნებულია", "Published")}</small>
        {!row.cancelled_at && <button type="button" disabled={op.busy} onClick={() => {
          if (window.confirm(tr(lang, "შევწყვიტოთ ამ შეტყობინების ჩვენება?", "Stop showing this announcement?"))) void op.mutate({ action: "cancel", id: row.id });
        }}>{upcoming ? tr(lang, "დაგეგმვის გაუქმება", "Cancel schedule") : tr(lang, "ჩვენების შეწყვეტა", "Stop showing")}</button>}
      </article>;
    }) : op.data && <p className="admin-empty-state">{tr(lang, "შეტყობინებები ჯერ არ არის.", "No announcements yet.")}</p>}
    {op.data && (page > 0 || op.data.more) && <Pager lang={lang} page={page} more={op.data.more} setPage={setPage}/>}
  </div>;
}

export function AdminAnalytics({ lang }: { lang: Lang }) {
  const op = useOperation<Stats>("/api/admin/analytics", lang);
  const missing = tr(lang, "არასაკმარისი მონაცემია", "Not enough data");
  return <div className="ops-stack">
    <p className="admin-notice">{tr(lang, "მცირე ჯგუფები და მომხმარებლის ჩანაწერები არ ჩანს. რაოდენობები და პროცენტები დამრგვალებულია.", "Small groups and individual records are not shown. Counts and percentages are rounded.")}</p>
    <Feedback lang={lang} {...op} loading={!op.data}/>
    {op.data && <>
      <dl className="ops-metrics">
        <div><dt>{tr(lang, "ციკლის საშუალო სიგრძე · ბოლო 12 თვე", "Average cycle length · past 12 months")}</dt><dd>{op.data.averageDays === null ? missing : `${op.data.averageDays} ${tr(lang, "დღე", "days")}`}</dd></div>
        <div><dt>{tr(lang, "ცვალებადი ციკლის წილი · ბოლო 12 თვე", "Variable cycles · past 12 months")}</dt><dd>{op.data.irregularPercent === null ? missing : `~${op.data.irregularPercent}%`}</dd></div>
      </dl>
      <h2>{tr(lang, "ამ თვეში ყველაზე ხშირად მონიშნული სიმპტომები", "Most logged symptoms this month")}</h2>
      {op.data.symptoms.length ? <ul className="ops-rank">{op.data.symptoms.map(row => <li className="ops-entry" key={row.id}><span>{symptoms.find(([id]) => id === row.id)?.[lang === "ka" ? 1 : 2]}</span><strong>~{row.count}</strong></li>)}</ul> : <p className="admin-empty-state">{missing}</p>}
    </>}
  </div>;
}
