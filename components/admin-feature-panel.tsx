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

  return (
    <>
      <section className="inner-hero compact">
        <div className="inner-container">
          <span className="inner-kicker">ADMIN PANEL</span>
          <h1>{ka ? "ადმინისტრაცია" : "Administration"}</h1>
          <p>{ka ? "მართე საიტის ფუნქციების ხილვადობა ერთი ადგილიდან." : "Manage site feature visibility from one place."}</p>
        </div>
      </section>
      <section className="admin-wrap inner-container">
        <div className="admin-sidebar">
          <strong>TUTA Admin</strong>
          <a className="active" href="#features">{ka ? "ფუნქციები" : "Features"}</a>
          <a href="#users">{ka ? "მომხმარებლები" : "Users"}</a>
          <a href="#content">{ka ? "კონტენტი" : "Content"}</a>
          <a href="#care">{ka ? "ექიმები და განრიგი" : "Doctors & availability"}</a>
          <a href="/api/admin/logout">{ka ? "გამოსვლა" : "Sign out"}</a>
        </div>
        <div className="admin-content" id="features">
          <div className="admin-panel-heading">
            <div>
              <span className="inner-kicker">TUTA SETTINGS</span>
              <h2>{ka ? "საიტის ფუნქციები" : "Site features"}</h2>
              <p>{ka ? "გამორთული ფუნქცია მომხმარებლებისთვის მენიუში აღარ გამოჩნდება და შესაბამის გვერდზე შესვლისას მიუწვდომლობის შეტყობინებას აჩვენებს." : "Disabled features disappear from navigation and show an unavailable notice on direct visits."}</p>
            </div>
            <span className="admin-feature-count">{SITE_FEATURES.filter(({ id }) => features[id]).length}/{SITE_FEATURES.length} {ka ? "ჩართულია" : "enabled"}</span>
          </div>

          <div className="admin-feature-groups">
            {(["ძირითადი", "სერვისები"] as const).map(group => (
              <section className="admin-feature-group" key={group}>
                <h3>{ka ? group : group === "ძირითადი" ? "Core" : "Services"}</h3>
                {SITE_FEATURES.filter(feature => feature.group === group).map(feature => {
                  const item = feature[lang];
                  return (
                    <div className="admin-setting admin-feature-row" key={feature.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={features[feature.id]}
                          disabled={saving === feature.id}
                          onChange={event => void toggleFeature(feature.id, event.target.checked)}
                          aria-label={`${item.title}: ${ka ? "ჩართვა ან გამორთვა" : "enable or disable"}`}
                        />
                        <span />
                      </label>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          <section className="admin-community-reports" id="reports">
            <div className="admin-panel-heading">
              <div><span className="inner-kicker">COMMUNITY SAFETY</span><h2>{ka ? "საზოგადოების საჩივრები" : "Community reports"}</h2>
                <p>{ka ? "აქ ჩანს მხოლოდ მონიშნული პოსტის შინაარსი და საჩივრის მიზეზი — მომჩივნის ვინაობა არ ჩანს." : "Only the reported post and reason are shown here; reporter identity is kept private."}</p></div>
              <button type="button" onClick={() => void loadReports()} disabled={reportsLoading} className="admin-report-refresh">{ka ? "განახლება" : "Refresh"}</button>
            </div>
            {reportMessage && <p className="admin-notice" role="status">{reportMessage}</p>}
            {reportsLoading ? <p>{ka ? "იტვირთება…" : "Loading…"}</p> : reports.length === 0 ? <div className="admin-notice" role="status">{ka ? "ღია საჩივრები არ არის." : "There are no open reports."}</div> : <div className="admin-report-list">
              {reports.map(report => <article className="admin-report-card" key={report.id}>
                <div className="admin-report-meta"><strong>{reasonNames[report.reason]?.[ka ? 0 : 1] || report.reason}</strong><span>{new Intl.DateTimeFormat(ka ? "ka-GE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at))}</span></div>
                <p className="admin-report-author">{ka ? "ავტორი:" : "Author:"} {report.post.is_anonymous ? (ka ? "ანონიმური" : "Anonymous") : report.post.display_name} · {report.post.topic}</p>
                <blockquote>{report.post.body}</blockquote>
                <div className="admin-report-actions">
                  <button type="button" disabled={reportBusy === report.id} onClick={() => void handleReport(report, "dismiss")}>{ka ? "საჩივრის დახურვა" : "Dismiss report"}</button>
                  <button type="button" disabled={reportBusy === report.id} onClick={() => void handleReport(report, "remove_post")} className="danger">{ka ? "პოსტის წაშლა" : "Delete post"}</button>
                </div>
              </article>)}
            </div>}
          </section>

          {error && <div className="admin-notice admin-error" role="alert"><strong>{ka ? "ვერ შეინახა" : "Not saved"}</strong><p>{error}</p></div>}
          <div className="admin-notice" role="status">
            <strong>{ka ? "საერთო პარამეტრები" : "Shared settings"}</strong>
            <p>{ka ? "ფუნქციების მდგომარეობა ინახება Supabase-ში და ვრცელდება საიტის ყველა ვიზიტორზე. ამისთვის Supabase-ში მიგრაცია უნდა იყოს გამოყენებული; შეცვლისას სერვერის Supabase საიდუმლო გასაღებიც საჭირო არის." : "Feature settings are stored in Supabase and apply to every visitor. The Supabase migration must be applied, and the server-only Supabase secret key must be configured."}</p>
          </div>
          <div className="admin-future-sections">
            <section id="users"><h3>{ka ? "მომხმარებლები" : "Users"}</h3><p>{ka ? "მომხმარებლების მართვა დაემატება ცალკე, უსაფრთხო ადმინისტრაციული უფლებებით." : "User management will be added with separate, secure admin permissions."}</p></section>
            <Library lang={lang} admin/>
            <AdminCare lang={lang}/>
          </div>
        </div>
      </section>
    </>
  );
}
