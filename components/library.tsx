"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {useUnsavedChanges} from '@/lib/use-unsaved-changes';
import { articleCategories } from "@/lib/content-validation";
type Article = {
  id: string;
  title_ka: string;
  title_en: string;
  body_ka: string;
  body_en: string;
  category: string;
  status?: string;
  publish_at: string | null;
};
const categories: Record<string, [string, string]> = {
  cycle: ["პერიოდი", "Period"],
  pregnancy: ["ორსულობა", "Pregnancy"],
  nutrition: ["კვება", "Nutrition"],
  "mental-health": ["ემოციური ჯანმრთელობა", "Mental wellbeing"],
};
const blank = {
  title_ka: "",
  title_en: "",
  body_ka: "",
  body_en: "",
  category: "cycle",
  status: "draft",
  publish_at: "",
};
export default function Library({
  lang,
  admin = false,
}: {
  lang: "ka" | "en";
  admin?: boolean;
}) {
  const ka = lang === "ka";
  const [articles, setArticles] = useState<Article[]>([]),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Partial<Article> & typeof blank>(blank);
  const baseline=useRef(JSON.stringify(blank));
  const dirty=JSON.stringify(draft)!==baseline.current;
  useUnsavedChanges(admin&&dirty,ka);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(admin ? "/api/admin/content" : "/api/library", {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw Error();
      setArticles(data.articles);
      setMessage("");
    } catch {
      setMessage(
        ka
          ? "სტატიები ვერ ჩაიტვირთა. სცადე განახლება."
          : "Could not load articles. Try refreshing.",
      );
    } finally {
      setLoading(false);
    }
  }, [admin, ka]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function save(remove = false) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          publish_at: draft.publish_at
            ? new Date(draft.publish_at).toISOString()
            : null,
          action: remove ? "delete" : "save",
        }),
      });
      if (!r.ok) throw Error();
      baseline.current=JSON.stringify(blank);setDraft(blank);
      await load();
      setMessage(ka ? "შენახულია" : "Saved");
    } catch {
      setMessage(
        ka
          ? "ვერ შეინახა. შეამოწმე ველები და შესვლის სტატუსი."
          : "Could not save. Check fields and your session.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-card" id={admin ? "admin-library" : "content"}>
      <div className="workspace-row">
        <h1>{ka ? "ბლოგები" : "Library"}</h1>
        <button disabled={loading} onClick={() => void load()}>
          {ka ? "განახლება" : "Refresh"}
        </button>
      </div>
      {admin && (
        <form
          className="workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2>{ka ? "სტატიის რედაქტორი" : "Article editor"}</h2>
          <p>
            {ka
              ? "აქვეყნებ მხოლოდ გადამოწმებულ მასალას. ტექსტში მიუთითე წყაროები და სამედიცინო რედაქტორი."
              : "Publish reviewed content only. Include sources and medical reviewer in the text."}
          </p>
          {(["title_ka", "body_ka", "title_en", "body_en"] as const).map(
            (key) => (
              <label key={key}>
                {
                  {
                    title_ka: "სათაური ქართულად",
                    body_ka: "ტექსტი ქართულად",
                    title_en: "English title",
                    body_en: "English text",
                  }[key]
                }
                {key.startsWith("body") ? (
                  <textarea
                    rows={8}
                    maxLength={6000}
                    required={key.endsWith("ka")}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    maxLength={180}
                    required={key.endsWith("ka")}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                )}
              </label>
            ),
          )}
          <label>
            {ka ? "კატეგორია" : "Category"}
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {articleCategories.map((c) => (
                <option key={c} value={c}>
                  {categories[c][ka ? 0 : 1]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ka ? "სტატუსი" : "Status"}
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              <option value="draft">{ka ? "შავი ჩანაწერი" : "Draft"}</option>
              <option value="published">
                {ka ? "გამოქვეყნებული" : "Published"}
              </option>
              <option value="scheduled">
                {ka ? "დაგეგმილი" : "Scheduled"}
              </option>
            </select>
          </label>
          {draft.status === "scheduled" && (
            <label>
              {ka
                ? "გამოქვეყნების დრო (შენი დროის სარტყელი)"
                : "Publish time (your timezone)"}
              <input
                type="datetime-local"
                required
                value={draft.publish_at}
                onChange={(e) =>
                  setDraft({ ...draft, publish_at: e.target.value })
                }
              />
            </label>
          )}
          <button type="submit" disabled={busy}>
            {ka ? "შენახვა" : "Save"}
          </button>
          <button type="button" onClick={() => {if(dirty&&!confirm(ka?'შეუნახავი ცვლილებები გაუქმდეს?':'Discard unsaved changes?'))return;baseline.current=JSON.stringify(blank);setDraft(blank)}}>
            {ka ? "ახალი სტატია" : "New article"}
          </button>
          {draft.id && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm(ka ? "წაიშალოს სტატია?" : "Delete article?"))
                  void save(true);
              }}
            >
              {ka ? "წაშლა" : "Delete"}
            </button>
          )}
        </form>
      )}
      <div className="workspace-form">
        <label>
          {ka ? "ძიება" : "Search"}
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          {ka ? "თემა" : "Topic"}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{ka ? "ყველა" : "All"}</option>
            {articleCategories.map((c) => (
              <option key={c} value={c}>
                {categories[c][ka ? 0 : 1]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">
        {loading
          ? ka
            ? "იტვირთება…"
            : "Loading…"
          : message ||
            (!articles.length
              ? ka
                ? "გამოქვეყნებული სტატიები ჯერ არ არის."
                : "No articles yet."
              : "")}
      </p>
      {articles
        .filter(
          (a) =>
            (!filter || a.category === filter) &&
            [a.title_ka, a.title_en, a.body_ka, a.body_en]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .map((a) => (
          <article className="workspace-card" key={a.id}>
            <p>
              {categories[a.category]?.[ka ? 0 : 1]}
              {admin ? ` · ${a.status}` : ""}
            </p>
            <h2>{ka ? a.title_ka : a.title_en || a.title_ka}</h2>
            {!ka && !a.body_en && (
              <p>English translation is not available yet.</p>
            )}
            <div style={{ whiteSpace: "pre-wrap" }}>
              {ka ? a.body_ka : a.body_en || a.body_ka}
            </div>
            {admin && (
              <button
                onClick={() => {
                  if(dirty&&!confirm(ka?'შეუნახავი ცვლილებები გაუქმდეს?':'Discard unsaved changes?'))return;
                  const date = a.publish_at ? new Date(a.publish_at) : null;
                  const next={
                    ...a,
                    status: a.status || "draft",
                    publish_at: date
                      ? new Date(
                          date.getTime() - date.getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : "",
                  };baseline.current=JSON.stringify(next);setDraft(next);
                  document.getElementById(admin ? "admin-library" : "content")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {ka ? "რედაქტირება" : "Edit"}
              </button>
            )}
          </article>
        ))}
    </section>
  );
}
