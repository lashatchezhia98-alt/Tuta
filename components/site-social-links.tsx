"use client";

import { useEffect, useState } from "react";
import { EMPTY_SOCIAL_LINKS, type SocialLinks, type SocialPlatform } from "@/lib/site-social-links";

const labels: Record<SocialPlatform, [string, string]> = {
  facebook: ["Facebook", "Facebook"],
  instagram: ["Instagram", "Instagram"],
  youtube: ["YouTube", "YouTube"],
  tiktok: ["TikTok", "TikTok"],
};

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "facebook") return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-8.2h2.8l.4-3.2h-3.2v-2c0-.9.3-1.6 1.6-1.6H17V3.1c-.4-.1-1.5-.2-2.8-.2-2.8 0-4.7 1.7-4.7 4.8v1.9H6.7v3.2h2.8V21h4Z"/></svg>;
  if (platform === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.7" cy="6.7" r="1.2" fill="currentColor"/></svg>;
  if (platform === "youtube") return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12c0 1.7.1 3.3.5 4.9a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2c.4-1.6.5-3.2.5-4.9s-.1-3.3-.5-4.9ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.8 8.1a6.7 6.7 0 0 1-4.1-1.4v8.1a6.3 6.3 0 1 1-5.5-6.2v3.4a3 3 0 1 0 2.2 2.9V2.5h3.3c.2 2 1.6 3.5 4.1 3.8v1.8Z"/></svg>;
}

export default function SiteSocialLinks({ lang = "ka", className = "" }: { lang?: "ka" | "en"; className?: string }) {
  const [links, setLinks] = useState<SocialLinks>(EMPTY_SOCIAL_LINKS);
  useEffect(() => {
    let active = true;
    fetch("/api/site-social-links", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (active && data?.links) setLinks({ ...EMPTY_SOCIAL_LINKS, ...data.links }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const configured = (Object.keys(links) as SocialPlatform[]).filter(platform => links[platform]);
  if (!configured.length) return null;
  return <nav className={`site-social-links ${className}`} aria-label={lang === "ka" ? "თუთას სოციალური ქსელები" : "Tuta social media"}>
    {configured.map(platform => <a key={platform} href={links[platform]} target="_blank" rel="noopener noreferrer" aria-label={labels[platform][lang === "ka" ? 0 : 1]} title={labels[platform][lang === "ka" ? 0 : 1]}><SocialIcon platform={platform}/></a>)}
  </nav>;
}
