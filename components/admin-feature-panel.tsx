"use client";

import { SITE_FEATURES, setSiteFeature, useSiteFeatures } from "@/lib/site-features";
import { useCallback, useEffect, useState } from "react";
import Library from './library';
import AdminCare from './admin-care';

type Lang = "ka" | "en";
type Report = { id: string; reason: string; created_at: string; post: { id: string; display_name: string; is_anonymous: boolean; topic: string; body: string; created_at: string } };
const reasonNames: Record<string, [string, string]> = {
  spam: ["სპამი", "Spam"], abuse: ["შეურაცხმყოფელი შინაარსი", "Abusive content"],
  privacy: ["პირადი ინფორმაციის გამჟღავნება", "Privacy violation"],
  medical_misinformation: ["ჯანმრთელობის მცდარი ინფორმაცია", "Medical misinformation"],
};

export default function AdminFeaturePanel({ lang }: { lang: Lang }) {
  const features = useSiteFeatures();
  const ka = lang === "ka";
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportMessage, setReportMessage] = useState("");
  const [reportBusy, setReportBusy] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch("/api/admin/community-reports", { cache: "no-store" });
      const data = await response.json() as { reports?: Report[]; error?: string };
      if (!response.ok) throw new Error(data.error || (ka ? "საჩივრები ვერ ჩაიტვირთა." : "Could not load reports."));
      setReports(data.reports || []);
      setReportMessage("");
    } catch (cause) {
      setReports([]);
      setReportMessage(cause instanceof Error ? cause.message : ka ? "საჩივრები ვერ ჩაიტვირთა." : "Could not load reports.");
    } finally { setReportsLoading(false); }
  }, [ka]);

  useEffect(() => { const timer = window.setTimeout(() => { void loadReports(); }, 0); return () => window.clearTimeout(timer); }, [loadReports]);

  async function handleReport(report: Report, action: "dismiss" | "remove_post") {
    if (action === "remove_post" && !window.confirm(ka ? "დარწმუნებული ხარ, რომ გინდა პოსტისა და ყველა კომენტარის წაშლა?" : "Delete this post and all its comments?")) return;
    setReportBusy(report.id);
    try {
      const response = await fetch("/api/admin/community-reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reportId: report.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || (ka ? "მოქმედება ვერ შესრულდა." : "Action failed."));
      setReports(current => current.filter(item => item.id !== report.id && !(action === "remove_post" && item.post.id === report.post.id)));
      setReportMessage(ka ? "მოქმედება შესრულებულია." : "Action completed.");
    } catch (cause) { setReportMessage(cause instanceof Error ? cause.message : ka ? "მოქმედება ვერ შესრულდა." : "Action failed."); }
    finally { setReportBusy(null); }
  }

  async function toggleFeature(id: (typeof SITE_FEATURES)[number]["id"], enabled: boolean) {
    setSaving(id);
    setError("");
    try {
      await setSiteFeature(id, enabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ka ? "შენახვა ვერ მოხერხდა." : "Could not save the setting.");
    } finally {
      setSaving(null);
    }
  }

  const enabledFeatures = SITE_FEATURES.filter(({ id }) => features[id]).length;
  const reportsCount = reportsLoading || reportMessage ? "—" : reports.length;

  return (
    <main className="admin-wrap inner-container">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><span>TUTA</span><strong>{ka ? "მართვა" : "Admin"}</strong></div>
        <nav aria-label={ka ? "ადმინის მენიუ" : "Admin navigation"}>
          <span className="admin-nav-label">{ka ? "პლატფორმა" : "PLATFORM"}</span>
          <a href="#features">{ka ? "საიტის ფუნქციები" : "Site features"}</a>
          <a href="#reports">{ka ? "საზოგადოების საჩივრები" : "Community reports"}</a>
          <span className="admin-nav-label">{ka ? "მართვა" : "MANAGEMENT"}</span>
          <a href="#content">{ka ? "ბლოგები და ბიბლიოთეკა" : "Blog & library"}</a>
          <a href="#care">{ka ? "ექიმები და ვიზიტები" : "Doctors & appointments"}</a>
          <a className="admin-nav-disabled" href="#planned">{ka ? "მომავალი მართვის ხელსაწყოები" : "More admin tools"}<small>{ka ? "მზადდება" : "Planned"}</small></a>
        </nav>
        <a className="admin-signout" href="/api/admin/logout">{ka ? "ადმინიდან გამოსვლა" : "Sign out"}</a>
      </aside>

      <div className="admin-content">
        <header className="admin-page-heading">
          <div><span className="inner-kicker">TUTA · ADMIN</span><h1>{ka ? "მართვის პანელი" : "Admin dashboard"}</h1><p>{ka ? "საიტის ყოველდღიური მართვა და უსაფრთხო მოდერაცია." : "Daily site operations and safe community moderation."}</p></div>
        </header>

        <section className="admin-summary" aria-label={ka ? "სწრაფი მიმოხილვა" : "Quick overview"}>
          <article><span>{ka ? "ჩართული ფუნქციები" : "Enabled features"}</span><strong>{enabledFeatures}<small> / {SITE_FEATURES.length}</small></strong><a href="#features">{ka ? "ფუნქციების მართვა" : "Manage features"} ↗</a></article>
          <article><span>{ka ? "ღია საჩივრები" : "Open reports"}</span><strong>{reportsCount}</strong><a href="#reports">{ka ? "საჩივრების ნახვა" : "Review reports"} ↗</a></article>
          <article><span>{ka ? "ექიმების სერვისი" : "Doctor services"}</span><strong>{ka ? "მართვა" : "Manage"}</strong><a href="#care">{ka ? "პროფილები და განრიგი" : "Profiles & availability"} ↗</a></article>
        </section>

        <section className="admin-section" id="features">
          <div className="admin-panel-heading">
            <div><span className="inner-kicker">01 · TUTA SETTINGS</span><h2>{ka ? "საიტის ფუნქციები" : "Site features"}</h2><p>{ka ? "ჩართე ან გამორთე საიტის სექციები. გამორთული ფუნქცია მენიუში აღარ გამოჩნდება და პირდაპირი ბმულითაც მიუწვდომელი იქნება." : "Turn site sections on or off. Disabled features are hidden from navigation and direct visits."}</p></div>
            <span className="admin-feature-count">{enabledFeatures}/{SITE_FEATURES.length} {ka ? "ჩართულია" : "enabled"}</span>
          </div>
          <div className="admin-feature-groups">
            {(["ძირითადი", "სერვისები"] as const).map(group => (
              <section className="admin-feature-group" key={group}>
                <h3>{ka ? group : group === "ძირითადი" ? "Core" : "Services"}</h3>
                {SITE_FEATURES.filter(feature => feature.group === group).map(feature => {
                  const item = feature[lang];
                  return <div className="admin-setting admin-feature-row" key={feature.id}>
                    <div><strong>{item.title}</strong><p>{item.description}</p></div>
                    <label className="switch"><input type="checkbox" checked={features[feature.id]} disabled={saving === feature.id} onChange={event => void toggleFeature(feature.id, event.target.checked)} aria-label={`${item.title}: ${ka ? "ჩართვა ან გამორთვა" : "enable or disable"}`}/><span/></label>
                  </div>;
                })}
              </section>
            ))}
          </div>
          {error && <div className="admin-notice admin-error" role="alert"><strong>{ka ? "ვერ შეინახა" : "Not saved"}</strong><p>{error}</p></div>}
          <div className="admin-notice"><strong>{ka ? "სინქრონიზაცია" : "Synchronization"}</strong><p>{ka ? "ცვლილებები ინახება Supabase-ში და მოქმედებს ყველა ვიზიტორზე." : "Changes are stored in Supabase and apply to all visitors."}</p></div>
        </section>

        <section className="admin-section" id="reports">
          <div className="admin-panel-heading">
            <div><span className="inner-kicker">02 · COMMUNITY SAFETY</span><h2>{ka ? "საზოგადოების საჩივრები" : "Community reports"}</h2><p>{ka ? "შეამოწმე მონიშნული პოსტი, დახურე საჩივარი ან წაშალე წესების დამრღვევი პოსტი. მომჩივნის ვინაობა არ ჩანს." : "Review flagged posts, dismiss reports, or remove content that breaks the rules. Reporter identity is not shown."}</p></div>
            <button type="button" onClick={() => void loadReports()} disabled={reportsLoading} className="admin-report-refresh">{reportsLoading ? (ka ? "იტვირთება…" : "Loading…") : (ka ? "განახლება" : "Refresh")}</button>
          </div>
          {reportMessage && <p className="admin-notice" role="status">{reportMessage}</p>}
          {reportsLoading ? <p>{ka ? "საჩივრები იტვირთება…" : "Loading reports…"}</p> : reports.length === 0 ? <div className="admin-empty-state" role="status">{ka ? "ღია საჩივრები არ არის." : "There are no open reports."}</div> : <div className="admin-report-list">
            {reports.map(report => <article className="admin-report-card" key={report.id}>
              <div className="admin-report-meta"><strong>{reasonNames[report.reason]?.[ka ? 0 : 1] || report.reason}</strong><span>{new Intl.DateTimeFormat(ka ? "ka-GE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at))}</span></div>
              <p className="admin-report-author">{ka ? "ავტორი:" : "Author:"} {report.post.is_anonymous ? (ka ? "ანონიმური" : "Anonymous") : report.post.display_name} · {report.post.topic}</p>
              <blockquote>{report.post.body}</blockquote>
              <div className="admin-report-actions"><button type="button" disabled={reportBusy === report.id} onClick={() => void handleReport(report, "dismiss")}>{ka ? "საჩივრის დახურვა" : "Dismiss report"}</button><button type="button" disabled={reportBusy === report.id} onClick={() => void handleReport(report, "remove_post")} className="danger">{ka ? "პოსტის წაშლა" : "Delete post"}</button></div>
            </article>)}
          </div>}
        </section>

        <section className="admin-section" id="content" aria-labelledby="admin-content-heading">
          <div className="admin-section-title"><span className="inner-kicker">03 · HEALTH CONTENT</span><h2 id="admin-content-heading">{ka ? "ბლოგები და ბიბლიოთეკა" : "Blog & health library"}</h2><p>{ka ? "შექმენი და მართე ქართული და ინგლისური სტატიები, კატეგორიები და გამოქვეყნების სტატუსი." : "Create and manage Georgian and English articles, categories and publishing status."}</p></div>
          <Library lang={lang} admin/>
        </section>

        <section className="admin-section" id="care" aria-labelledby="admin-care-heading">
          <div className="admin-section-title"><span className="inner-kicker">04 · CARE SERVICES</span><h2 id="admin-care-heading">{ka ? "ექიმები და ვიზიტები" : "Doctors & appointments"}</h2><p>{ka ? "მართე გადამოწმებული ექიმების პროფილები და თავისუფალი ვიზიტის დროები." : "Manage verified doctor profiles and available appointment times."}</p></div>
          <AdminCare lang={lang}/>
        </section>

        <section className="admin-section admin-roadmap" id="planned">
          <div className="admin-section-title"><span className="inner-kicker">05 · COMING NEXT</span><h2>{ka ? "შემდგომი ადმინისტრაციული ხელსაწყოები" : "More admin tools"}</h2><p>{ka ? "ქვემოთ ჩამოთვლილი კონტროლები ამ ვერსიაში ჯერ არ არის ჩართული — აქ განთავსებულია მხოლოდ მომავალი განვითარების გეგმა." : "The controls below are not active in this version; this is a roadmap only."}</p></div>
          <div className="admin-roadmap-grid">{(ka ? ["მომხმარებლების ანგარიშები და როლები", "პრემიუმ გამოწერები და გადახდები", "შეტყობინებების გაგზავნა და ისტორია", "ანონიმური, აგრეგირებული ანალიტიკა"] : ["User accounts and roles", "Premium subscriptions and payments", "Notifications and history", "Anonymous aggregated analytics"]).map(item => <div key={item}><span>◷</span><strong>{item}</strong><small>{ka ? "დაგეგმილია · მართვა ჯერ მიუწვდომელია" : "Planned · controls not available yet"}</small></div>)}</div>
        </section>
      </div>
    </main>
  );
}
