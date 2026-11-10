"use client";

import { useEffect, useState } from "react";
import { EMPTY_SOCIAL_LINKS, type SocialLinks, type SocialPlatform } from "@/lib/site-social-links";

const platforms: { id: SocialPlatform; ka: string; en: string; placeholder: string }[] = [
  { id: "facebook", ka: "Facebook გვერდი", en: "Facebook page", placeholder: "https://www.facebook.com/yourpage" },
  { id: "instagram", ka: "Instagram პროფილი", en: "Instagram profile", placeholder: "https://www.instagram.com/yourprofile" },
  { id: "youtube", ka: "YouTube არხი", en: "YouTube channel", placeholder: "https://www.youtube.com/@yourchannel" },
  { id: "tiktok", ka: "TikTok პროფილი", en: "TikTok profile", placeholder: "https://www.tiktok.com/@yourprofile" },
];

export default function AdminSocialLinks({ lang }: { lang: "ka" | "en" }) {
  const ka = lang === "ka";
  const [links, setLinks] = useState<SocialLinks>(EMPTY_SOCIAL_LINKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/site-social-links", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(ka ? "ბმულები ვერ ჩაიტვირთა." : "Could not load links.");
        const data = await response.json() as { links?: Partial<SocialLinks> };
        if (active) setLinks({ ...EMPTY_SOCIAL_LINKS, ...data.links });
      })
      .catch(error => { if (active) { setIsError(true); setNotice(error instanceof Error ? error.message : (ka ? "ბმულები ვერ ჩაიტვირთა." : "Could not load links.")); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ka]);

  async function save() {
    if (saving || loading) return;
    setSaving(true); setNotice(""); setIsError(false);
    try {
      const response = await fetch("/api/admin/site-social-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links }) });
      const data = await response.json() as { links?: SocialLinks; error?: string };
      if (!response.ok) throw new Error(data.error || (ka ? "შენახვა ვერ მოხერხდა." : "Could not save links."));
      setLinks({ ...EMPTY_SOCIAL_LINKS, ...data.links });
      setNotice(ka ? "ბმულები შენახულია. ცვლილებები საიტზე გამოჩნდება." : "Links saved. Changes are live on the website.");
    } catch (error) {
      setIsError(true); setNotice(error instanceof Error ? error.message : (ka ? "შენახვა ვერ მოხერხდა." : "Could not save links."));
    } finally { setSaving(false); }
  }

  return <div className="admin-social-settings">
    <div className="admin-notice"><strong>{ka ? "სოციალური ქსელების ბმულები" : "Social profile links"}</strong><p>{ka ? "შევსებული ბმულები საიტის ქვედა ნაწილში შესაბამის ხატულებად გამოჩნდება. ცარიელი ველი ხატულას დამალავს. გამოიყენე მხოლოდ შესაბამისი https ბმული." : "Configured links appear as matching icons in the website footer. Empty fields keep icons hidden. Use the matching https profile link."}</p></div>
    {platforms.map(platform => <div className="admin-social-field" key={platform.id}>
      <label htmlFor={`social-${platform.id}`}><strong>{ka ? platform.ka : platform.en}</strong><small>{ka ? "პროფილის საჯარო ბმული" : "Public profile URL"}</small></label>
      <input id={`social-${platform.id}`} type="url" inputMode="url" autoComplete="url" value={links[platform.id]} disabled={loading || saving} placeholder={platform.placeholder} onChange={event => setLinks(current => ({ ...current, [platform.id]: event.target.value }))}/>
    </div>)}
    <div className="admin-social-actions"><button type="button" onClick={() => void save()} disabled={loading || saving}>{saving ? (ka ? "ინახება…" : "Saving…") : loading ? (ka ? "იტვირთება…" : "Loading…") : (ka ? "ბმულების შენახვა" : "Save links")}</button>{notice && <p role={isError ? "alert" : "status"} className={isError ? "is-error" : ""}>{notice}</p>}</div>
  </div>;
}
