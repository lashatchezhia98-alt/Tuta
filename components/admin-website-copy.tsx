"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyFields, copyPages, memberCopyPages, emptyCopy, getCopyText, validateCopy, type CopyLanguage, type CopyOverrides } from "@/lib/site-copy";

type EditorState = { draft: CopyOverrides; published: CopyOverrides; revision: number; published_at: string | null };
type Action = "save" | "publish";
const endpoint = "/api/admin/website-copy";
const startingPage = copyPages[0];

export default function AdminWebsiteCopy({ lang }: { lang: CopyLanguage }) {
  const ka = lang === "ka";
  const [saved, setSaved] = useState<EditorState | null>(null);
  const [draft, setDraft] = useState(emptyCopy);
  const [page, setPage] = useState<string>(startingPage[0]);
  const [audience, setAudience] = useState<"public" | "member">("public");
  const [language, setLanguage] = useState<CopyLanguage>("ka");
  const [selected, setSelected] = useState("home.title");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const pages = audience === "member" ? memberCopyPages : copyPages;
  const activePage = pages.find(item => item[0] === page) ?? pages[0];
  const pageFields = [...new Set(activePage[3].flatMap(prefix => copyFields.filter(item => item.id.startsWith(prefix))))];
  const visible = pageFields.filter(item => [item[language], getCopyText(draft, item.id, language), item.id].some(value => value.toLowerCase().includes(query.trim().toLowerCase())));
  const field = visible.find(item => item.id === selected) ?? visible[0];
  const text = field ? getCopyText(draft, field.id, language) : "";
  const dirty = !!saved && JSON.stringify(draft) !== JSON.stringify(saved.draft);
  const unpublished = !!saved && JSON.stringify(draft) !== JSON.stringify(saved.published);

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      if (!response.ok) throw Error(ka ? "ტექსტები ვერ ჩაიტვირთა. შეამოწმე ადმინის სესია ან სცადე ხელახლა." : "Could not load copy. Check your session or try again.");
      const body = await response.json() as EditorState;
      if (!signal?.aborted) { setSaved(body); setDraft(body.draft); setStatus(""); }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (!signal?.aborted) setBusy(false); }
  }, [ka]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const sendPreview = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "tuta:copy-preview:values", copy: draft, lang: language }, window.location.origin);
  }, [draft, language]);

  function chooseAudience(next: "public" | "member") {
    if (next === audience) return;
    setAudience(next);
    setPage(next === "member" ? memberCopyPages[0][0] : copyPages[0][0]);
    setSelected(next === "member" ? "feed.title" : "home.title");
    setQuery("");
  }

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "tuta:copy-preview:ready") sendPreview();
      if (event.data?.type === "tuta:copy-preview:select" && activePage[3].some(prefix => typeof event.data.id === "string" && event.data.id.startsWith(prefix)) && copyFields.some(item => item.id === event.data.id)) {
        setSelected(event.data.id);
        setQuery("");
        input.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("message", receive);
    sendPreview();
    return () => window.removeEventListener("message", receive);
  }, [sendPreview, activePage]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function write(action: Action) {
    if (!saved || busy) return;
    let values;
    try { values = validateCopy(draft); }
    catch { setError(ka ? "შეავსე ცარიელი ველები ან აღადგინე საწყისი ტექსტი." : "Fill empty fields or restore their defaults."); return; }
    if (action === "publish" && !window.confirm(ka ? "მონახაზი გამოჩნდება ვებსაიტზე. გამოვაქვეყნოთ?" : "This draft will appear on the website. Publish now?")) return;
    setBusy(true); setStatus(""); setError("");
    try {
      const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, draft: values, revision: saved.revision }) });
      const body = await response.json() as EditorState & { error?: string };
      if (!response.ok) throw Error(body.error || (ka ? "შენახვა ვერ მოხერხდა." : "Could not save the copy."));
      setSaved(body); setDraft(body.draft);
      setStatus(action === "publish" ? (ka ? "ტექსტები გამოქვეყნდა." : "Copy published.") : (ka ? "მონახაზი შენახულია. საიტზე ჯერ არ ჩანს." : "Draft saved. It is not public yet."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  function restore() {
    if (!field) return;
    setDraft(current => {
      const values = { ...current[language] };
      delete values[field.id];
      return { ...current, [language]: values };
    });
  }

  function reload() {
    if (!dirty || window.confirm(ka ? "უახლესი ვერსიის ჩატვირთვით შეუნახავი ცვლილებები დაიკარგება. გავაგრძელოთ?" : "Reloading discards unsaved changes. Continue?")) void load();
  }

  return <div className="copy-editor">
    <div className="copy-editor-actions">
      <button type="button" onClick={reload} disabled={busy}>{ka ? "ხელახლა ჩატვირთვა" : "Reload"}</button>
      <button type="button" onClick={() => void write("save")} disabled={busy || !dirty}>{ka ? "მონახაზის შენახვა" : "Save draft"}</button>
      <button type="button" className="copy-editor-primary" onClick={() => void write("publish")} disabled={busy || !unpublished}>{ka ? "გამოქვეყნება" : "Publish"}</button>
    </div>
    {busy && <p role="status">{ka ? "მუშავდება…" : "Working…"}</p>}
    {status && <p role="status">{status}</p>}
    {error && <p className="copy-editor-error" role="alert">{error}</p>}
    {saved && <div className="copy-editor-grid">
      <div className="copy-editor-controls">
        <div className="copy-editor-actions" role="group" aria-label={ka ? "გვერდების ჯგუფი" : "Page audience"}>
          <button type="button" aria-pressed={audience === "public"} onClick={() => chooseAudience("public")}>{ka ? "საჯარო გვერდები" : "Public pages"}</button>
          <button type="button" aria-pressed={audience === "member"} onClick={() => chooseAudience("member")}>{ka ? "შესული მომხმარებლის გვერდები" : "Signed-in pages"}</button>
        </div>
        <label>{ka ? "გვერდი" : "Page"}<select value={page} onChange={event => { setPage(event.target.value); setSelected(""); setQuery(""); }}>
          {pages.map(([href, label, english]) => <option key={href} value={href}>{ka ? label : english}</option>)}
        </select></label>
        <div className="copy-editor-actions" role="group" aria-label={ka ? "ტექსტის ენა" : "Copy language"}>
          <button type="button" aria-pressed={language === "ka"} onClick={() => { setLanguage("ka"); setQuery(""); }}>ქართული</button>
          <button type="button" aria-pressed={language === "en"} onClick={() => { setLanguage("en"); setQuery(""); }}>English</button>
        </div>
        <label>{ka ? "ტექსტის ძებნა" : "Find text"}<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <div className="copy-editor-list">
          {visible.map(item => <button type="button" key={item.id} aria-pressed={field?.id === item.id} onClick={() => setSelected(item.id)}><span>{item[language]}</span><small>{item.id}</small></button>)}
          {!visible.length && <p>{ka ? "ტექსტი ვერ მოიძებნა." : "No matching text."}</p>}
        </div>
        {field && <label>{ka ? "ტექსტის შეცვლა" : "Edit text"}<textarea ref={input} value={text} rows={4} maxLength={field.max} disabled={busy} onChange={event => setDraft({ ...draft, [language]: { ...draft[language], [field.id]: event.target.value } })}/><small>{text.length} / {field.max}</small></label>}
        <button type="button" onClick={restore} disabled={!field || busy || !(field.id in draft[language])}>{ka ? "საწყისი ტექსტის აღდგენა" : "Restore default"}</button>
      </div>
      <div className="copy-editor-preview">
        {audience === "member" ? <>
          <strong>{ka ? "ტექსტების წინასწარი ხედი" : "Copy preview"}</strong>
          <p>{ka ? "აქ მხოლოდ ინტერფეისის ტექსტებია. მომხმარებლის პირადი მონაცემები არ იტვირთება." : "Only interface text is shown here. No private account data is loaded."}</p>
          <div className="copy-member-preview" lang={language}>
            <h2>{activePage[language === "ka" ? 1 : 2]}</h2>
            {visible.map(item => <button
              key={item.id}
              type="button"
              aria-pressed={field?.id === item.id}
              onClick={() => { setSelected(item.id); input.current?.focus(); }}
            >{getCopyText(draft, item.id, language)}</button>)}
          </div>
        </> : <>
          <strong>{ka ? "ვებსაიტის წინასწარი ხედი" : "Website preview"}</strong>
          <p>{ka ? "მონიშნულ ტექსტზე დაჭერით მისი ველი გაიხსნება." : "Click an outlined text to open its field."}</p>
          <iframe ref={frame} title={ka ? "ვებსაიტის წინასწარი ხედი" : "Website preview"} sandbox="allow-scripts allow-same-origin" src={`${page}?copyPreview=${language}`} onLoad={sendPreview}/>
        </>}
      </div>
    </div>}
  </div>;
}
