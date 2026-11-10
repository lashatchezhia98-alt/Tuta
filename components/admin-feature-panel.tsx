"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { SITE_FEATURES, setSiteFeature, useSiteFeatures } from "@/lib/site-features";
import Library from "@/components/library";
import AdminCare from "@/components/admin-care";
import DoctorEnrollment from "@/components/doctor-enrollment";
import AdminMarket from "@/components/admin-market";
import MarketOrders from "@/components/market-orders";
import BrandMark from "@/components/brand-mark";
import AdminWebsiteCopy from "@/components/admin-website-copy";
import AdminInvitations from "@/components/admin-invitations";
import AdminSocialLinks from "@/components/admin-social-links";
import { AdminAnalytics, AdminBilling, AdminNotifications, AdminUsers } from "@/components/admin-operations";
import { canAccessAdminSection, type AdminAccess, type AdminSection as Section } from "@/lib/admin-sections";

type Lang = "ka" | "en";
type Report = { id: string; reason: string; created_at: string; post: { id: string; display_name: string; is_anonymous: boolean; topic: string; body: string; created_at: string } };

const reasonNames: Record<string, [string, string]> = {
  spam: ["სპამი", "Spam"],
  abuse: ["შეურაცხმყოფელი შინაარსი", "Abusive content"],
  privacy: ["პირადი ინფორმაციის გამჟღავნება", "Privacy violation"],
  medical_misinformation: ["ჯანმრთელობის მცდარი ინფორმაცია", "Medical misinformation"],
};

function subscribeAdminLanguage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getAdminLanguage(): Lang {
  return localStorage.getItem("tuta-language") === "en" ? "en" : "ka";
}

const nav: { section: Section; href: string; ka: string; en: string }[] = [
  { section: "overview", href: "/admin", ka: "მიმოხილვა", en: "Overview" },
  { section: "features", href: "/admin/features", ka: "საიტის ფუნქციები", en: "Site features" },
  { section: "website-copy", href: "/admin/website-copy", ka: "ტექსტების რედაქტირება", en: "Website copy" },
  { section: "social-links", href: "/admin/social-links", ka: "სოციალური ქსელები", en: "Social networks" },
  { section: "invitations", href: "/admin/invitations", ka: "ადმინის მოწვევები", en: "Admin invitations" },
  { section: "reports", href: "/admin/reports", ka: "საჩივრები", en: "Reports" },
  { section: "content", href: "/admin/content", ka: "ბლოგები და ბიბლიოთეკა", en: "Blog & library" },
  { section: "doctors", href: "/admin/doctors", ka: "ექიმების რეგისტრაცია", en: "Doctor registration" },
  { section: "care", href: "/admin/care", ka: "პროფილები და ვიზიტები", en: "Profiles & visits" },
  { section: "market", href: "/admin/market", ka: "მარკეტი / მაღაზია", en: "Market / shop" },
  { section: "orders", href: "/admin/orders", ka: "მარკეტის შეკვეთები", en: "Market orders" },
  { section: "users", href: "/admin/users", ka: "მომხმარებლები და როლები", en: "Users & roles" },
  { section: "billing", href: "/admin/billing", ka: "Premium და გადახდები", en: "Premium & payments" },
  { section: "notifications", href: "/admin/notifications", ka: "შეტყობინებები", en: "Announcements" },
  { section: "analytics", href: "/admin/analytics", ka: "ანონიმური სტატისტიკა", en: "Anonymous analytics" },
];
const operations = nav.filter(item => ["users", "billing", "notifications", "analytics"].includes(item.section));

export default function AdminFeaturePanel({ section = "overview", initialLang = "ka", access, initialFilter = "" }: { section?: Section; initialLang?: Lang; access: AdminAccess; initialFilter?: string }) {
  const owner = access === "owner";
  const lang = useSyncExternalStore(subscribeAdminLanguage, getAdminLanguage, () => initialLang);
  const ka = lang === "ka";
  const features = useSiteFeatures();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
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
    } finally {
      setReportsLoading(false);
    }
  }, [ka]);

  useEffect(() => {
    if (section !== "overview" && section !== "reports") return;
    const timer = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReports, section]);

  async function handleReport(report: Report, action: "dismiss" | "remove_post") {
    if (action === "remove_post" && !window.confirm(ka ? "დარწმუნებული ხარ, რომ გინდა პოსტისა და ყველა კომენტარის წაშლა?" : "Delete this post and all its comments?")) return;
    setReportBusy(report.id);
    try {
      const response = await fetch("/api/admin/community-reports", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reportId: report.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || (ka ? "მოქმედება ვერ შესრულდა." : "Action failed."));
      setReports(current => current.filter(item => item.id !== report.id && !(action === "remove_post" && item.post.id === report.post.id)));
      setReportMessage(ka ? "მოქმედება შესრულებულია." : "Action completed.");
    } catch (cause) {
      setReportMessage(cause instanceof Error ? cause.message : ka ? "მოქმედება ვერ შესრულდა." : "Action failed.");
    } finally {
      setReportBusy(null);
    }
  }

  async function toggleFeature(id: (typeof SITE_FEATURES)[number]["id"], enabled: boolean) {
    if(saving)return;
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
  const heading: Record<Section, [string, string]> = {
    overview: ["მართვის მიმოხილვა", "Admin overview"],
    features: ["საიტის ფუნქციები", "Site features"],
    "website-copy": ["ვებსაიტის ტექსტები", "Website copy"],
    "social-links": ["სოციალური ქსელების ბმულები", "Social profile links"],
    invitations: ["ადმინის მოწვევები", "Admin invitations"],
    reports: ["საზოგადოების საჩივრები", "Community reports"],
    content: ["ბლოგები და ბიბლიოთეკა", "Blog & health library"],
    care: ["ექიმები და ვიზიტები", "Doctors & appointments"],
    doctors: ["ექიმების რეგისტრაცია", "Doctor registration"],
    tools: ["მართვის ხელსაწყოები", "Administration tools"],
    users: ["მომხმარებლები და როლები", "Users & roles"],
    billing: ["Premium და გადახდები", "Premium & payments"],
    notifications: ["შეტყობინებები", "Announcements"],
    analytics: ["ანონიმური სტატისტიკა", "Anonymous analytics"],
    market: ["მარკეტის პროდუქტები", "Market products"],
    orders: ["მარკეტის შეკვეთები", "Market orders"],
  };
  const description: Record<Section, [string, string]> = {
    overview: ["ერთი ადგილიდან გადადი პლატფორმის მართვის საჭირო ნაწილზე.", "Jump to the area you need to manage."],
    features: ["ჩართე ან გამორთე საიტის სექციები. ცვლილება Supabase-ში ინახება.", "Turn site sections on or off. Changes are saved to Supabase."],
    "website-copy": ["შეცვალე ვებსაიტის ტექსტები ქართულად და ინგლისურად. აპლიკაციების ტექსტები არ იცვლება.", "Edit Georgian and English website copy. Mobile app copy is unaffected."],
    "social-links": ["მართე Facebook-ის, Instagram-ის, YouTube-ისა და TikTok-ის ბმულები, რომლებიც საიტის ქვედა ნაწილში გამოჩნდება.", "Manage the Facebook, Instagram, YouTube and TikTok links shown in the website footer."],
    invitations: ["შექმენი ერთჯერადი ბმული, გაუზიარე მოწვეულ პირს და საჭიროებისას გააუქმე წვდომა.", "Create and share a one-time link, or revoke access."],
    reports: ["შეამოწმე მონიშნული პოსტები. მომჩივნის ვინაობა ადმინისტრატორს არ უჩანს.", "Review flagged posts. Reporter identity is not shown to admins."],
    content: ["მართე სტატიები, კატეგორიები, ენები და გამოქვეყნების სტატუსი.", "Manage articles, categories, languages and publication status."],
    care: ["მართე გადამოწმებული ექიმების პროფილები და ხელმისაწვდომი ვიზიტის დროები.", "Manage verified doctor profiles and available appointment times."],
    doctors: ["დაამატე ექიმი, დააკავშირე ანგარიში და გადაამოწმე პროფესიული კვალიფიკაცია.", "Register a doctor, link their account and verify professional qualifications."],
    tools: ["აირჩიე მართვის სექცია.", "Choose an administration area."],
    users: ["იპოვე ანგარიში, ნახე გეგმა და მართე წვდომა. ჯანმრთელობის ჩანაწერები აქ არ ჩანს.", "Find accounts, review plans and manage access. Health records are not shown."],
    billing: ["ნახე გადახდების ისტორია და Premium-ზე მინიჭებული წვდომა.", "Review payments and Premium grants."],
    notifications: ["გამოაქვეყნე ან დაგეგმე ანგარიშში გამოსაჩენი შეტყობინება.", "Publish or schedule an announcement for member accounts."],
    analytics: ["ნახე საერთო ტენდენციები ინდივიდუალური ჩანაწერების გარეშე.", "Review overall trends without individual records."],
    market: ["დაამატე ან შეცვალე პროდუქტი, აღწერა, ფასი და გამოჩენა მომხმარებლის მარკეტში.", "Add or edit products, descriptions, prices and visibility in the customer shop."],
    orders: ["მართე მიწოდების სტატუსი; გადახდის სტატუსი მხოლოდ პროვაიდერის დადასტურებით იცვლება.", "Manage delivery separately from provider-confirmed payments."],
  };

  const reportsView = (
    <>
      <div className="admin-section-heading-row">
        <p>{ka ? "ღია საჩივრები" : "Open reports"}</p>
        <button type="button" onClick={() => void loadReports()} disabled={reportsLoading} className="admin-report-refresh">{reportsLoading ? (ka ? "იტვირთება…" : "Loading…") : (ka ? "განახლება" : "Refresh")}</button>
      </div>
      {reportMessage && <p className="admin-notice" role="status">{reportMessage}</p>}
      {reportsLoading ? <div className="admin-empty-state">{ka ? "საჩივრები იტვირთება…" : "Loading reports…"}</div> : reports.length === 0 ? <div className="admin-empty-state" role="status">{ka ? "ღია საჩივრები არ არის." : "There are no open reports."}</div> : <div className="admin-report-list">
        {reports.map(report => <article className="admin-report-card" key={report.id}>
          <div className="admin-report-meta"><strong>{reasonNames[report.reason]?.[ka ? 0 : 1] || report.reason}</strong><span>{new Intl.DateTimeFormat(ka ? "ka-GE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at))}</span></div>
          <p className="admin-report-author">{ka ? "ავტორი:" : "Author:"} {report.post.is_anonymous ? (ka ? "ანონიმური" : "Anonymous") : report.post.display_name} · {report.post.topic}</p>
          <blockquote>{report.post.body}</blockquote>
          <div className="admin-report-actions"><button type="button" disabled={reportBusy === report.id} onClick={() => void handleReport(report, "dismiss")}>{ka ? "საჩივრის დახურვა" : "Dismiss report"}</button><button type="button" disabled={reportBusy === report.id} onClick={() => void handleReport(report, "remove_post")} className="danger">{ka ? "პოსტის წაშლა" : "Delete post"}</button></div>
        </article>)}
      </div>}
    </>
  );

  function renderSection(current: Section) {
    if (current === "users") return <AdminUsers lang={lang} owner={owner} initialQuery={initialFilter}/>;
    if (current === "billing") return <AdminBilling lang={lang} owner={owner} initialUser={initialFilter}/>;
    if (current === "notifications") return <AdminNotifications lang={lang}/>;
    if (current === "analytics") return <AdminAnalytics lang={lang}/>;
    if (current === "website-copy") return <AdminWebsiteCopy lang={lang}/>;
    if (current === "invitations" && owner) return <AdminInvitations lang={lang}/>;
    if (current === "social-links" && owner) return <AdminSocialLinks lang={lang}/>;
    if(current==='orders')return <MarketOrders lang={lang} admin/>;
    if (current === "features") return <>
      <div className="admin-feature-groups">{(["ძირითადი", "სერვისები"] as const).map(group => <section className="admin-feature-group" key={group}>
        <h3>{ka ? group : group === "ძირითადი" ? "Core" : "Services"}</h3>
        {SITE_FEATURES.filter(feature => feature.group === group).map(feature => {
          const item = feature[lang];
          const enabled = features[feature.id];
          return <div className="admin-setting admin-feature-row" key={feature.id}><div><strong>{item.title}</strong><p>{item.description}</p><small className="admin-feature-state">{saving === feature.id ? (ka ? "ინახება…" : "Saving…") : enabled ? (ka ? "ჩართულია" : "On") : (ka ? "გამორთულია" : "Off")}</small></div><button type="button" className={`admin-feature-toggle ${enabled ? "is-on" : ""}`} disabled={saving!==null} onClick={() => void toggleFeature(feature.id, !enabled)} aria-pressed={enabled}>{saving === feature.id ? (ka ? "ინახება…" : "Saving…") : enabled ? (ka ? "გამორთვა" : "Turn off") : (ka ? "ჩართვა" : "Turn on")}</button></div>;
        })}
      </section>)}</div>
      {error && <div className="admin-notice admin-error" role="alert"><strong>{ka ? "ვერ შეინახა" : "Not saved"}</strong><p>{error}</p></div>}
      <div className="admin-notice"><strong>{ka ? "სინქრონიზაცია" : "Synchronization"}</strong><p>{ka ? "ცვლილებები ინახება Supabase-ში და მოქმედებს საიტის ყველა ვიზიტორზე." : "Changes are saved to Supabase and apply to all visitors."}</p></div>
    </>;
    if (current === "reports") return reportsView;
    if (current === "content") return <Library lang={lang} admin/>;
    if (current === "doctors") return <DoctorEnrollment lang={lang}/>;
    if (current === "care") return <AdminCare lang={lang}/>;
    if (current === "market") return <AdminMarket lang={lang}/>;
    if (current === "tools") return <div className="ops-tool-links">{operations.map(item => <Link key={item.section} href={item.href}><strong>{ka ? item.ka : item.en}</strong><span>{description[item.section][ka ? 0 : 1]}</span></Link>)}</div>;
    return <div className="admin-summary admin-summary-overview">
      <Link href="/admin/features"><span>{ka ? "ჩართული ფუნქციები" : "Enabled features"}</span><strong>{enabledFeatures}<small> / {SITE_FEATURES.length}</small></strong><em>{ka ? "ფუნქციების მართვა →" : "Manage features →"}</em></Link>
      <Link href="/admin/reports"><span>{ka ? "ღია საჩივრები" : "Open reports"}</span><strong>{reportsLoading || reportMessage ? "—" : reports.length}</strong><em>{ka ? "საჩივრების ნახვა →" : "Review reports →"}</em></Link>
      <Link href="/admin/content"><span>{ka ? "ჯანმრთელობის კონტენტი" : "Health content"}</span><strong>{ka ? "სტატიები" : "Articles"}</strong><em>{ka ? "ბიბლიოთეკის მართვა →" : "Manage library →"}</em></Link>
      <Link href="/admin/doctors"><span>{ka ? "ექიმების რეგისტრაცია" : "Doctor registration"}</span><strong>{ka ? "დამატება" : "Add"}</strong><em>{ka ? "მოწვევა და გადამოწმება →" : "Invite & verify →"}</em></Link>
      <Link href="/admin/care"><span>{ka ? "ექიმები და ვიზიტები" : "Doctors & visits"}</span><strong>{ka ? "მართვა" : "Manage"}</strong><em>{ka ? "პროფილები და განრიგი →" : "Profiles & schedule →"}</em></Link>
    </div>;
  }

  return <>
    <header className="admin-topbar"><div className="admin-topbar-inner"><Link href="/" className="inner-logo"><BrandMark/><strong>{ka ? "თუთა" : "TUTA"}</strong></Link><span>{ka ? "მართვის პანელი" : "Admin console"}</span></div></header>
    <main className="admin-wrap inner-container">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><span>TUTA</span><strong>{ka ? "ადმინისტრაცია" : "Administration"}</strong></div>
        <nav aria-label={ka ? "ადმინის მენიუ" : "Admin navigation"}>
          {nav.filter(item => canAccessAdminSection(access, item.section)).map(item => <Link key={item.section} href={item.href} className={section === item.section ? "active" : undefined} aria-current={section === item.section ? "page" : undefined}>{ka ? item.ka : item.en}</Link>)}
        </nav>
        <form action="/api/admin/logout" method="post"><button className="admin-signout" type="submit">{ka ? "გამოსვლა" : "Sign out"}</button></form>
      </aside>
      <div className="admin-content">
        <header className="admin-page-heading"><div><span className="inner-kicker">TUTA · ADMIN</span><h1>{heading[section][ka ? 0 : 1]}</h1><p>{description[section][ka ? 0 : 1]}</p></div></header>
        {section === "overview" ? <>
          <div className="admin-dashboard-notice">{ka ? "ადმინისტრატორს მომხმარებლების ჯანმრთელობის ჩანაწერები და პირადი მიმოწერა არ უჩანს." : "Admins cannot access users’ health records or private messages."}</div>
          {renderSection("overview")}
          <section className="admin-overview-roadmap"><h2>{ka ? "მართვის ხელსაწყოები" : "Administration tools"}</h2>{renderSection("tools")}</section>
        </> : <section className="admin-section">{renderSection(section)}</section>}
      </div>
    </main>
  </>;
}
