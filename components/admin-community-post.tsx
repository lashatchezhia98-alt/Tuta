"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import { POST_TOPICS, postWordCount, validPost } from "@/mobile/src/community.mjs";
import { OFFICIAL_POST_PHOTO_MAX } from "@/lib/official-community-post";

const topics: Record<string, [string, string]> = {
  cycle: ["ციკლი", "Cycle"], symptoms: ["სიმპტომები", "Symptoms"], wellbeing: ["კეთილდღეობა", "Wellbeing"],
  nutrition: ["კვება", "Nutrition"], pregnancy: ["ორსულობა", "Pregnancy"], questions: ["კითხვები", "Questions"],
};

export default function AdminCommunityPost({ lang }: { lang: "ka" | "en" }) {
  const t = (ka: string, en: string) => lang === "ka" ? ka : en;
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState("");
  const inFlight = useRef(false);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !validPost(body)) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo");
    if (photo instanceof File && photo.size > OFFICIAL_POST_PHOTO_MAX) {
      setError(t("ფოტო არ უნდა აღემატებოდეს 3 მბ-ს.", "The photo must be 3 MB or smaller."));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setPublished("");
    try {
      const response = await fetch("/api/admin/community-posts", { method: "POST", body: data });
      const result = await response.json().catch(() => null) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) {
        setError((lang === "ka" && result?.error) || t("პოსტი ვერ გამოქვეყნდა.", "The post could not be published."));
        return;
      }
      setPublished(result.id);
      setBody("");
      form.reset();
    } catch {
      setError(t("კავშირი გაწყდა. ხელახლა ცდამდე შეამოწმე, გამოჩნდა თუ არა პოსტი საზოგადოებაში.", "Connection lost. Check the community feed before retrying."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="ops-stack max-w-2xl">
    <div className="flex items-center gap-3">
      <BrandMark/>
      <div><small>{t("ავტორი", "Author")}</small><br/><strong>{t("თუთა", "Tuta")}</strong></div>
    </div>
    <p className="admin-notice">{t("პოსტს საზოგადოებაში მხოლოდ შესული წევრები ნახავენ. შენი ადმინის სახელი არ გამოჩნდება.", "Only signed-in members see the post in the community feed. Your admin name is not shown.")}</p>
    <form className="ops-stack" onSubmit={publish}>
      <label>{t("თემა", "Topic")}<select name="topic" defaultValue="" disabled={busy} required>
        <option value="" disabled>{t("აირჩიე თემა", "Choose a topic")}</option>
        {POST_TOPICS.map(topic => <option key={topic} value={topic}>{topics[topic][lang === "ka" ? 0 : 1]}</option>)}
      </select></label>
      <label>{t("პოსტის ტექსტი", "Post text")}
        <textarea name="body" required rows={7} maxLength={2000} value={body} disabled={busy}
          aria-describedby="official-post-limit" onChange={event => setBody(event.target.value)}/>
      </label>
      <small id="official-post-limit">{postWordCount(body)} / 200 {t("სიტყვა", "words")} · {body.length} / 2 000 {t("სიმბოლო", "characters")}</small>
      <label>{t("ფოტო (არასავალდებულო, მაქს. 3 მბ)", "Photo (optional, up to 3 MB)")}
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" disabled={busy}/>
      </label>
      <button type="submit" disabled={busy || !validPost(body)}>
        {busy ? t("ქვეყნდება…", "Publishing…") : t("გამოქვეყნება თუთას სახელით", "Publish as Tuta")}
      </button>
    </form>
    {error && <p className="admin-notice admin-error" role="alert">{error}</p>}
    {published && <div className="admin-notice" role="status">
      {t("პოსტი გამოქვეყნდა.", "Post published.")}{" "}
      <Link className="underline" href={`/community?post=${encodeURIComponent(published)}`}>{t("პოსტის ნახვა", "View post")}</Link>
    </div>}
  </div>;
}
