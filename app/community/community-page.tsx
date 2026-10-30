"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useSiteFeatures } from "@/lib/site-features";

type Lang = "ka" | "en";
type Post = { id: string; public_author_id: string | null; is_anonymous: boolean; display_name: string; topic: string; body: string; image_public_id: string | null; created_at: string };
type Comment = { id: string; post_id: string; public_author_id: string | null; is_anonymous: boolean; parent_comment_id: string | null; display_name: string; body: string; created_at: string };
type Doctor = { user_id: string; first_name: string; last_name: string };
const topics = ["cycle", "symptoms", "wellbeing", "nutrition", "pregnancy", "questions"] as const;
const names: Record<string, [string, string]> = {
  cycle: ["ციკლი", "Cycle"], symptoms: ["სიმპტომები", "Symptoms"], wellbeing: ["კეთილდღეობა", "Wellbeing"],
  nutrition: ["კვება", "Nutrition"], pregnancy: ["ორსულობა", "Pregnancy"], questions: ["კითხვები", "Questions"],
};
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const words = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length;
const validPost = (value: string) => value.trim().length > 0 && value.trim().length <= 2000 && words(value) <= 200;
const nameOf = (metadata: Record<string, unknown> | undefined) => {
  const value = String(metadata?.nickname || metadata?.first_name || "").trim().slice(0, 30);
  return value.length >= 2 ? value : "Member";
};
const photoUrl = (publicId: string | null) => cloudName && publicId && /^[a-zA-Z0-9_-]+$/.test(cloudName) && /^tuta-community\/(?:[0-9a-f-]{36}|anon)\/[a-zA-Z0-9_-]+$/.test(publicId)
  ? `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_1200/${publicId}` : null;

export default function CommunityPage() {
  const features = useSiteFeatures();
  const [lang, setLang] = useState<Lang>("ka");
  const t = useCallback((ka: string, en: string) => lang === "ka" ? ka : en, [lang]);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isMember = Boolean(session && !session.user.is_anonymous);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ownedPostIds, setOwnedPostIds] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<Record<string, Doctor>>({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [notice, setNotice] = useState("");
  const [compose, setCompose] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [anonymousPost, setAnonymousPost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportingPost, setReportingPost] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({});
  const [anonymousComments, setAnonymousComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    queueMicrotask(() => setLang(localStorage.getItem("tuta-language") === "en" ? "en" : "ka"));
    try {
      const supabase = getSupabaseBrowserClient();
      queueMicrotask(() => setClient(supabase));
      void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); }).catch(() => setAuthReady(true));
      const { data } = supabase.auth.onAuthStateChange((_event, current) => {
        setSession(current); setAuthReady(true);
        if (!current || current.user.is_anonymous) { setPosts([]); setOwnedPostIds([]); setDoctors({}); setComments({}); setOpenComments({}); setCompose(false); }
      });
      return () => data.subscription.unsubscribe();
    } catch { queueMicrotask(() => { setNotice("Supabase is not configured."); setLoading(false); setAuthReady(true); }); }
  }, []);

  const loadDoctors = useCallback(async (ids: (string | null)[]) => {
    if (!client || !isMember || !ids.length) return;
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return;
    const { data, error } = await client.from("verified_doctors").select("user_id,first_name,last_name").in("user_id", unique);
    if (!error && data) setDoctors(current => {
      const next = { ...current };
      unique.forEach(id => { delete next[id]; });
      (data as Doctor[]).forEach(doctor => { next[doctor.user_id] = doctor; });
      return next;
    });
  }, [client, isMember]);

  const loadPosts = useCallback(async () => {
    if (!client || !isMember) return;
    setLoading(true);
    let query = client.from("community_posts").select("id,public_author_id,is_anonymous,display_name,topic,body,image_public_id,created_at").order("created_at", { ascending: false }).limit(50);
    if (filter !== "all") query = query.eq("topic", filter);
    const [{ data, error }, owned] = await Promise.all([query, client.from("community_post_owners").select("post_id")]);
    setOwnedPostIds(owned.error ? [] : ((owned.data || []) as { post_id: string }[]).map(row => row.post_id));
    if (error) { setFeedError(true); setPosts([]); }
    else { setFeedError(false); const list = data as Post[]; setPosts(list); await loadDoctors(list.map(post => post.public_author_id)); }
    setLoading(false);
  }, [client, filter, isMember, loadDoctors]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadPosts(); }, 0); return () => window.clearTimeout(timer); }, [loadPosts]);

  const loadComments = async (postId: string) => {
    if (!client || !isMember) return;
    const { data, error } = await client.from("community_comments").select("id,post_id,public_author_id,is_anonymous,parent_comment_id,display_name,body,created_at").eq("post_id", postId).order("created_at").limit(100);
    if (error) { setNotice(t("კომენტარები ვერ ჩაიტვირთა.", "Could not load comments.")); return; }
    const list = data as Comment[];
    setComments(current => ({ ...current, [postId]: list }));
    await loadDoctors(list.map(comment => comment.public_author_id));
  };
  const toggleComments = (id: string) => {
    if (!openComments[id]) void loadComments(id);
    setOpenComments(current => ({ ...current, [id]: !current[id] }));
  };
  const addComment = async (post: Post) => {
    if (!client || !session) return;
    const postId = post.id;
    const text = (drafts[postId] || "").trim();
    if (!text || text.length > 1000) return;
    const anonymous = post.is_anonymous && ownedPostIds.includes(postId) && (anonymousComments[postId] ?? true);
    const { error } = await client.from("community_comments").insert({ post_id: postId, parent_comment_id: replyTo[postId] || null, author_id: session.user.id, display_name: anonymous ? "Anonymous" : nameOf(session.user.user_metadata), is_anonymous: anonymous, body: text });
    if (error) setNotice(t("კომენტარი ვერ გამოქვეყნდა.", "Could not publish the comment."));
    else { setDrafts(current => ({ ...current, [postId]: "" })); setReplyTo(current => ({ ...current, [postId]: null })); await loadComments(postId); }
  };
  const reportPost = async (post: Post, reason: "spam" | "abuse" | "privacy" | "medical_misinformation") => {
    if (!client || !session || !isMember) return;
    setReportBusy(post.id);
    const { error } = await client.from("community_reports").insert({ post_id: post.id, reporter_id: session.user.id, reason });
    setReportBusy(null);
    setReportingPost(null);
    setNotice(error?.code === "23505"
      ? t("ეს პოსტი უკვე დაარეპორტე.", "You have already reported this post.")
      : error ? t("საჩივარი ვერ გაიგზავნა. სცადე მოგვიანებით.", "Could not submit the report. Please try again.")
      : t("მადლობა — საჩივარი მოდერაციისთვის გაიგზავნა.", "Thank you — your report was sent for review."));
  };
  const openNew = () => { setEditing(null); setBody(""); setTopic(""); setPhoto(null); setAnonymousPost(false); setCompose(true); setNotice(""); };
  const edit = (post: Post) => { setEditing(post.id); setBody(post.body); setTopic(post.topic); setPhoto(null); setAnonymousPost(post.is_anonymous); setCompose(true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (post: Post) => {
    if (!client || !session || !ownedPostIds.includes(post.id) || !window.confirm(t("წაიშალოს პოსტი და მისი კომენტარები?", "Delete this post and its comments?"))) return;
    const { data, error } = await client.from("community_posts").delete().eq("id", post.id).select("id").maybeSingle();
    setNotice(error || !data ? t("პოსტი ვერ წაიშალა.", "Could not delete the post.") : t("პოსტი წაიშალა.", "Post deleted."));
    if (data && !error) void loadPosts();
  };
  const save = async () => {
    if (!client || !session || !validPost(body) || !topics.some(item => item === topic)) return;
    setBusy(true); setNotice("");
    try {
      if (editing) {
        const { data, error } = await client.from("community_posts").update({ body: body.trim(), topic }).eq("id", editing).select("id").maybeSingle();
        if (error || !data) throw new Error("edit");
      } else {
        let image_public_id: string | null = null;
        if (photo) {
          if (!cloudName || photo.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("photo");
          const signed = await fetch("/api/community/cloudinary-signature", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ anonymous: anonymousPost }) });
          if (!signed.ok) throw new Error("signature");
          const details = await signed.json() as { cloudName: string; apiKey: string; publicId: string; timestamp: number; signature: string };
          if (details.cloudName !== cloudName || !details.publicId.startsWith(`tuta-community/${anonymousPost ? "anon" : session.user.id}/`)) throw new Error("signature");
          const upload = new FormData();
          upload.append("file", photo); upload.append("api_key", details.apiKey); upload.append("timestamp", String(details.timestamp)); upload.append("public_id", details.publicId); upload.append("signature", details.signature);
          const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: "POST", body: upload });
          if (!response.ok) throw new Error("upload");
          const image = await response.json() as { public_id?: string };
          if (image.public_id !== details.publicId) throw new Error("upload");
          image_public_id = details.publicId;
        }
        const { error } = await client.from("community_posts").insert({ author_id: session.user.id, display_name: anonymousPost ? "Anonymous" : nameOf(session.user.user_metadata), is_anonymous: anonymousPost, topic, body: body.trim(), image_public_id });
        if (error) throw error;
      }
      setCompose(false); setEditing(null); setBody(""); setTopic(""); setPhoto(null);
      setNotice(t("პოსტი შენახულია.", "Post saved."));
      await loadPosts();
    } catch { setNotice(t("პოსტი ვერ შეინახა. შეამოწმე მონაცემთა ბაზა ან ფოტოს სერვისი.", "Could not save the post. Check the database or photo service.")); }
    finally { setBusy(false); }
  };
  const date = (value: string) => new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const author = (id: string | null, display: string, anonymous: boolean) => anonymous ? t("ანონიმური", "Anonymous") : id && doctors[id] ? `${t("ექიმი", "Dr.")} ${doctors[id].first_name} ${doctors[id].last_name}` : display;

  if (!features.community) return <main className="min-h-screen bg-[#F9F8FC] px-5 py-24 text-center text-[#1E1B2E]"><h1 className="text-3xl font-semibold">{lang === "ka" ? "საზოგადოება დროებით გამორთულია" : "Community is temporarily unavailable"}</h1><p className="mt-4">{lang === "ka" ? "სცადე მოგვიანებით." : "Please try again later."}</p><Link className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[#1E1B2E] px-6 text-white" href="/">{lang === "ka" ? "მთავარზე დაბრუნება" : "Back to home"}</Link></main>;
  return <main className="min-h-screen bg-[#F9F8FC] text-[#1E1B2E]">
    <header className="border-b border-[#1E1B2E]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4"><Link href="/" className="text-2xl font-black">{lang === "ka" ? "თუთა" : "TUTA"}</Link><nav className="flex items-center gap-4 text-sm"><Link href="/blog">{t("ბლოგი", "Blog")}</Link><button type="button" onClick={() => { const next = lang === "ka" ? "en" : "ka"; setLang(next); localStorage.setItem("tuta-language", next); document.documentElement.lang = next; }} className="rounded-full border px-3 py-2">{lang === "ka" ? "EN" : "KA"}</button>{isMember ? <Link href="/app/settings" className="font-semibold">{nameOf(session?.user.user_metadata)}</Link> : <Link href="/login" className="font-semibold">{t("შესვლა", "Sign in")}</Link>}</nav></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="h-fit rounded-3xl bg-[#E3D8F1] p-6"><p className="text-xs font-bold uppercase tracking-widest">TUTA COMMUNITY</p><h1 className="mt-4 text-3xl font-semibold leading-tight">{t("ერთად, საკუთარ რიტმში", "A space to share")}</h1><p className="mt-4 text-sm leading-6 text-[#625B6D]">{t("პოსტები მხოლოდ რეგისტრირებულ მომხმარებლებს შეუძლიათ ნახონ. შენი პირადი ციკლის ჩანაწერები ლენტში არ ჩანს.", "Only registered members can see posts. Your private cycle entries do not appear in the feed.")}</p>{isMember ? <button type="button" onClick={openNew} className="mt-6 min-h-11 w-full rounded-full bg-[#1E1B2E] px-5 text-white">{t("პოსტის დაწერა", "Write a post")}</button> : null}</aside>
      {!authReady ? <section className="py-12 text-center">{t("იტვირთება…", "Loading…")}</section> : !isMember ? <section className="min-w-0 rounded-3xl border border-[#E6E2EC] bg-white p-8 sm:p-12"><h2 className="text-2xl font-semibold">{t("შედით საზოგადოების სანახავად", "Sign in to view the community")}</h2><p className="mt-3 text-[#625B6D]">{t("პოსტები და კომენტარები ხელმისაწვდომია მხოლოდ რეგისტრირებული მომხმარებლებისთვის.", "Posts and comments are available only to registered members.")}</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/login" className="inline-flex min-h-11 items-center rounded-full bg-[#1E1B2E] px-6 text-white">{t("შესვლა", "Sign in")}</Link><Link href="/register" className="inline-flex min-h-11 items-center rounded-full border border-[#1E1B2E] px-6">{t("რეგისტრაცია", "Register")}</Link></div></section> : <section className="min-w-0"><div className="mb-6 flex flex-wrap gap-2" aria-label={t("პოსტების თემები", "Post topics")}>{["all", ...topics].map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-11 rounded-full border px-4 text-sm ${filter === key ? "border-[#1E1B2E] bg-[#FDF0CC] font-semibold" : "border-[#DCD7E5] bg-white"}`}>{key === "all" ? t("ყველა", "All") : t(...names[key])}</button>)}</div>
        {compose ? <div className="mb-6 rounded-3xl border border-[#D8CBE8] bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">{editing ? t("პოსტის რედაქტირება", "Edit post") : t("ახალი პოსტი", "New post")}</h2>
          <p className="mt-2 text-sm text-[#6F687D]">{t("პოსტი რეგისტრირებულ წევრებს გამოუჩნდებათ. ნუ გამოაქვეყნებ პირად ჯანმრთელობის მონაცემებს.", "Registered members can see this post. Avoid sharing private health details.")}</p>
          {!editing ? <label className="mt-5 flex min-h-11 items-center gap-3 font-medium"><input type="checkbox" checked={anonymousPost} onChange={event => setAnonymousPost(event.target.checked)} className="h-5 w-5"/>{t("ანონიმურად გამოქვეყნება", "Post anonymously")}</label> : <p className="mt-5 text-sm text-[#6F687D]">{anonymousPost ? t("ეს პოსტი ანონიმურია.", "This post is anonymous.") : t("ეს პოსტი შენი სახელით გამოქვეყნდა.", "This post uses your name.")}</p>}
          <fieldset className="mt-5"><legend className="mb-2 font-semibold">{t("რას ეხება პოსტი?", "What is this post about?")}</legend><div className="flex flex-wrap gap-2">{topics.map(key => <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)} className={`min-h-11 rounded-full border px-4 text-sm ${topic === key ? "bg-[#E3D8F1]" : "bg-white"}`}>{t(...names[key])}</button>)}</div></fieldset>
          <label className="mt-5 block font-semibold" htmlFor="community-body">{t("პოსტის ტექსტი", "Post text")}</label><textarea id="community-body" value={body} onChange={event => setBody(event.target.value)} maxLength={2000} rows={5} className="mt-2 w-full rounded-2xl border border-[#DCD7E5] p-4 outline-none focus:border-[#806D9F]"/><p className={`text-right text-sm ${words(body) > 200 ? "text-red-700" : "text-[#6F687D]"}`}>{words(body)}/200 {t("სიტყვა", "words")}</p>
          {!editing ? <label className="mt-3 block text-sm font-medium">{t("ერთი ფოტო (არასავალდებულო, მაქს. 4 მბ)", "One photo (optional, max 4 MB)")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm"/></label> : <p className="mt-3 text-sm text-[#6F687D]">{t("არსებული ფოტო უცვლელი დარჩება.", "The existing photo stays unchanged.")}</p>}
          <div className="mt-5 flex gap-3"><button type="button" disabled={busy || !topic || !validPost(body)} onClick={() => void save()} className="min-h-11 rounded-full bg-[#1E1B2E] px-6 text-white disabled:opacity-50">{busy ? t("ინახება…", "Saving…") : t("შენახვა", "Save")}</button><button type="button" onClick={() => setCompose(false)} className="min-h-11 rounded-full border px-5">{t("გაუქმება", "Cancel")}</button></div>
        </div> : null}
        {notice ? <p role="status" className="mb-5 rounded-2xl bg-[#FDF0CC] p-4 text-sm">{notice}</p> : null}
        {loading ? <p className="py-12 text-center">{t("იტვირთება…", "Loading…")}</p> : feedError ? <div role="status" className="rounded-3xl border border-[#E9DDBB] bg-[#FDF0CC] p-8">{t("ლენტი ახლა მიუწვდომელია. გთხოვ, მოგვიანებით სცადე.", "The feed is unavailable right now. Please try again later.")}<button type="button" onClick={() => void loadPosts()} className="mt-4 block min-h-11 rounded-full bg-[#1E1B2E] px-5 text-white">{t("ხელახლა ცდა", "Try again")}</button></div> : posts.length === 0 ? <div className="rounded-3xl border bg-white p-8">{t("ჯერ პოსტები არ არის.", "No posts yet.")}</div> : <div className="space-y-5">{posts.map(post => <article key={post.id} className="rounded-3xl border border-[#E6E2EC] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{author(post.public_author_id, post.display_name, post.is_anonymous)}{post.public_author_id && doctors[post.public_author_id] ? <span aria-label={t("დადასტურებული ექიმი", "Verified doctor")} title={t("დადასტურებული ექიმი", "Verified doctor")} className="ml-1 text-[#5E4780]">✓</span> : null}</div><div className="mt-1 text-xs text-[#6F687D]">{date(post.created_at)} · {names[post.topic] ? t(...names[post.topic]) : post.topic}</div></div><div className="flex flex-wrap items-center justify-end gap-2 text-sm">{ownedPostIds.includes(post.id) ? <><button type="button" onClick={() => edit(post)} className="min-h-11 px-2">{t("რედაქტირება", "Edit")}</button><button type="button" onClick={() => void remove(post)} className="min-h-11 px-2 text-red-700">{t("წაშლა", "Delete")}</button></> : <button type="button" onClick={() => setReportingPost(current => current === post.id ? null : post.id)} className="min-h-11 px-2 text-[#5E4780]">{t("საჩივარი", "Report")}</button>}</div></div>
          {reportingPost === post.id ? <div className="mt-3 rounded-2xl bg-[#F9F8FC] p-3"><p className="mb-2 text-sm font-semibold">{t("მიზეზი აირჩიე", "Choose a reason")}</p><div className="flex flex-wrap gap-2">{([["spam", "სპამი", "Spam"], ["abuse", "შეურაცხმყოფელი შინაარსი", "Abuse"], ["privacy", "პირადი ინფორმაციის გამჟღავნება", "Privacy violation"], ["medical_misinformation", "ჯანმრთელობის მცდარი ინფორმაცია", "Medical misinformation"]] as const).map(([reason, ka, en]) => <button key={reason} type="button" disabled={reportBusy === post.id} onClick={() => void reportPost(post, reason)} className="min-h-11 rounded-full border border-[#DCD7E5] bg-white px-3 text-xs disabled:opacity-50">{t(ka, en)}</button>)}<button type="button" onClick={() => setReportingPost(null)} className="min-h-11 px-3 text-xs underline">{t("გაუქმება", "Cancel")}</button></div></div> : null}
          <p className="mt-5 whitespace-pre-wrap break-words leading-7">{post.body}</p>{photoUrl(post.image_public_id) ? <img src={photoUrl(post.image_public_id)!} alt={t("პოსტს დართული ფოტო", "Post attachment")} loading="lazy" className="mt-5 max-h-[520px] w-full rounded-2xl object-cover"/> : null}
          <button type="button" onClick={() => toggleComments(post.id)} className="mt-5 min-h-11 rounded-full bg-[#F9F8FC] px-4 text-sm font-semibold">{openComments[post.id] ? t("კომენტარების დამალვა", "Hide comments") : t("კომენტარები", "Comments")}</button>
          {openComments[post.id] ? <div className="mt-4 border-t pt-4">
            {(comments[post.id] || []).map(comment => <div key={comment.id} className={`mb-4 rounded-2xl bg-[#F9F8FC] p-4 ${comment.parent_comment_id ? "ml-5 border-l-2 border-[#D8CBE8]" : ""}`}>
              {comment.parent_comment_id ? <p className="mb-1 text-xs text-[#6F687D]">{t("პასუხი კომენტარზე", "Reply to")} {author((comments[post.id] || []).find(item => item.id === comment.parent_comment_id)?.public_author_id || null, (comments[post.id] || []).find(item => item.id === comment.parent_comment_id)?.display_name || "", Boolean((comments[post.id] || []).find(item => item.id === comment.parent_comment_id)?.is_anonymous))}</p> : null}
              <div className="font-semibold">{author(comment.public_author_id, comment.display_name, comment.is_anonymous)}{comment.public_author_id && doctors[comment.public_author_id] ? <span aria-label={t("დადასტურებული ექიმი", "Verified doctor")} title={t("დადასტურებული ექიმი", "Verified doctor")} className="ml-1 text-[#5E4780]">✓</span> : null}</div>
              <p className="mt-1 whitespace-pre-wrap break-words">{comment.body}</p><button type="button" onClick={() => setReplyTo(current => ({ ...current, [post.id]: comment.id }))} className="mt-2 min-h-11 text-sm font-semibold text-[#5E4780]">{t("პასუხი", "Reply")}</button>
            </div>)}
            {replyTo[post.id] ? <div className="mb-2 flex items-center gap-3 text-sm"><span>{t("პასუხობ კომენტარს:", "Replying to:")} {author((comments[post.id] || []).find(item => item.id === replyTo[post.id])?.public_author_id || null, (comments[post.id] || []).find(item => item.id === replyTo[post.id])?.display_name || "", Boolean((comments[post.id] || []).find(item => item.id === replyTo[post.id])?.is_anonymous))}</span><button type="button" onClick={() => setReplyTo(current => ({ ...current, [post.id]: null }))} className="min-h-11 underline">{t("გაუქმება", "Cancel")}</button></div> : null}
            <form onSubmit={event => { event.preventDefault(); void addComment(post); }}><label className="sr-only" htmlFor={`comment-${post.id}`}>{t("კომენტარი", "Comment")}</label><textarea id={`comment-${post.id}`} value={drafts[post.id] || ""} onChange={event => setDrafts(current => ({ ...current, [post.id]: event.target.value }))} maxLength={1000} rows={2} placeholder={replyTo[post.id] ? t("დაწერე პასუხი…", "Write a reply…") : t("დაწერე კომენტარი…", "Write a comment…")} className="w-full rounded-2xl border p-3"/>
              {post.is_anonymous && ownedPostIds.includes(post.id) ? <label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={anonymousComments[post.id] ?? true} onChange={event => setAnonymousComments(current => ({ ...current, [post.id]: event.target.checked }))} className="h-5 w-5"/>{t("ანონიმურად პასუხი", "Reply anonymously")}</label> : null}
              <button type="submit" disabled={!drafts[post.id]?.trim()} className="mt-2 min-h-11 rounded-full bg-[#1E1B2E] px-5 text-white disabled:opacity-50">{replyTo[post.id] ? t("პასუხის გაგზავნა", "Post reply") : t("გაგზავნა", "Post comment")}</button>
            </form>
          </div> : null}
        </article>)}</div>}
      </section>}
    </div>
  </main>;
}
