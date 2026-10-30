"use client";

import { SITE_FEATURES, setSiteFeature, useSiteFeatures } from "@/lib/site-features";
import { useState } from "react";

type Lang = "ka" | "en";

export default function AdminFeaturePanel({ lang }: { lang: Lang }) {
  const features = useSiteFeatures();
  const ka = lang === "ka";
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

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

          {error && <div className="admin-notice admin-error" role="alert"><strong>{ka ? "ვერ შეინახა" : "Not saved"}</strong><p>{error}</p></div>}
          <div className="admin-notice" role="status">
            <strong>{ka ? "საერთო პარამეტრები" : "Shared settings"}</strong>
            <p>{ka ? "ფუნქციების მდგომარეობა ინახება Supabase-ში და ვრცელდება საიტის ყველა ვიზიტორზე. ამისთვის Supabase-ში მიგრაცია უნდა იყოს გამოყენებული; შეცვლისას სერვერის Supabase საიდუმლო გასაღებიც საჭირო არის." : "Feature settings are stored in Supabase and apply to every visitor. The Supabase migration must be applied, and the server-only Supabase secret key must be configured."}</p>
          </div>
          <div className="admin-future-sections">
            <section id="users"><h3>{ka ? "მომხმარებლები" : "Users"}</h3><p>{ka ? "მომხმარებლების მართვა დაემატება ცალკე, უსაფრთხო ადმინისტრაციული უფლებებით." : "User management will be added with separate, secure admin permissions."}</p></section>
            <section id="content"><h3>{ka ? "კონტენტი" : "Content"}</h3><p>{ka ? "სტატიების რედაქტორი და გამოქვეყნების მართვა ჯერ არ არის ჩართული." : "Article editing and publishing controls are not active yet."}</p></section>
          </div>
        </div>
      </section>
    </>
  );
}
