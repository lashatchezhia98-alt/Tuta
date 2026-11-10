"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyFields, type CopyLanguage } from "@/lib/site-copy";
import { copyAndStylesFromRows, defaultTextStyle, restoreWebsiteTextDefaults, type WebsiteTextRecord, type WebsiteTextStyle } from "@/lib/website-content";

const endpoint = "/api/admin/website-texts";
const initialRecord = (): WebsiteTextRecord => ({ key: "", page: "/", section: "home", ka_text: "", en_text: "", ka_style: defaultTextStyle, en_style: defaultTextStyle, published: false, updated_at: "" });
const localized = (ka: boolean, kaText: string, enText: string) => ka ? kaText : enText;

export default function AdminWebsiteCopy({ lang }: { lang: CopyLanguage }) {
  const ka = lang === "ka";
  const [records, setRecords] = useState<WebsiteTextRecord[]>([]);
  const [draft, setDraft] = useState<WebsiteTextRecord>(initialRecord);
  const [original, setOriginal] = useState<WebsiteTextRecord | null>(null);
  const [activeLang, setActiveLang] = useState<CopyLanguage>("ka");
  const [query, setQuery] = useState("");
  const [pageFilter, setPageFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const isNew = !original;
  const isBuiltIn = copyFields.some(field => field.id === draft.key);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original ?? initialRecord());

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || localized(ka, "ტექსტები ვერ ჩაიტვირთა. შეამოწმე ადმინის სესია და მონაცემთა ბაზის მიგრაცია.", "Could not load texts. Check the admin session and database migration."));
      const next = (Array.isArray(body.records) ? body.records : []) as WebsiteTextRecord[];
      if (!signal?.aborted) {
        setRecords(next);
      }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [ka]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const pages = useMemo(() => [...new Set(records.map(item => item.page))].sort(), [records]);
  const sections = useMemo(() => [...new Set(records.filter(item => !pageFilter || item.page === pageFilter).map(item => item.section))].sort(), [records, pageFilter]);
  const visible = useMemo(() => records.filter(item =>
    (!pageFilter || item.page === pageFilter) &&
    (!sectionFilter || item.section === sectionFilter) &&
    (!query.trim() || [item.key, item.page, item.section, item.ka_text, item.en_text].some(value => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))),
  ), [records, pageFilter, sectionFilter, query]);

  const previewContent = useMemo(() => {
    const rows = records.map(item => item.key === draft.key ? { ...draft, updated_at: draft.updated_at || new Date(0).toISOString() } : item);
    if (isNew && draft.key) rows.push({ ...draft, updated_at: new Date(0).toISOString() });
    return copyAndStylesFromRows(rows);
  }, [records, draft, isNew]);
  const sendPreview = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "tuta:copy-preview:values", copy: previewContent.copy, styles: previewContent.styles, lang: activeLang }, window.location.origin);
  }, [previewContent, activeLang]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "tuta:copy-preview:ready") sendPreview();
      if (event.data?.type === "tuta:copy-preview:select" && typeof event.data.id === "string") {
        const match = records.find(item => item.key === event.data.id);
        if (match) { setOriginal(match); setDraft(match); setError(""); setStatus(""); textarea.current?.focus({ preventScroll: true }); }
      }
    };
    window.addEventListener("message", receive); sendPreview();
    return () => window.removeEventListener("message", receive);
  }, [records, sendPreview]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function select(record: WebsiteTextRecord) {
    if (dirty && !window.confirm(localized(ka, "შეუნახავი ცვლილებები დაიკარგება. გავაგრძელოთ?", "Unsaved changes will be discarded. Continue?"))) return;
    setDraft(record); setOriginal(record); setError(""); setStatus("");
  }
  function change<K extends keyof WebsiteTextRecord>(key: K, value: WebsiteTextRecord[K]) { setDraft(current => ({ ...current, [key]: value })); setStatus(""); }
  function changeStyle(language: CopyLanguage, key: keyof WebsiteTextStyle, value: string | number) {
    const property = language === "ka" ? "ka_style" : "en_style";
    setDraft(current => ({ ...current, [property]: { ...current[property], [key]: value } })); setStatus("");
  }

  async function save(nextPublished = draft.published) {
    if (busy) return;
    const body = { ...draft, published: nextPublished };
    if (!/^[a-z0-9][a-z0-9._-]{1,119}$/.test(body.key)) { setError(localized(ka, "გასაღები აუცილებელია: ლათინური პატარა ასოები, ციფრები, წერტილი, ტირე ან ქვედა ტირე.", "A valid key is required: lowercase letters, numbers, dots, dashes or underscores.")); return; }
    if (!body.page.startsWith("/") || !body.section.trim() || !body.ka_text.trim() || !body.en_text.trim()) { setError(localized(ka, "შეავსე გვერდი, სექცია და ორივე ენის ტექსტი.", "Complete the page, section and both language values.")); return; }
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch(endpoint, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || localized(ka, "შენახვა ვერ მოხერხდა.", "Could not save changes."));
      const saved = result.record as WebsiteTextRecord;
      setRecords(current => isNew ? [...current, saved].sort((a, b) => a.page.localeCompare(b.page) || a.key.localeCompare(b.key)) : current.map(item => item.key === saved.key ? saved : item));
      setDraft(saved); setOriginal(saved); setStatus(localized(ka, nextPublished ? "ტექსტი გამოქვეყნდა." : "ცვლილებები შენახულია.", nextPublished ? "Text published." : "Changes saved."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!original || busy || !window.confirm(localized(ka, "წავშალოთ ეს ტექსტი? საიტზე შესაბამისი ჩაშენებული ტექსტი დარჩება.", "Delete this text? The built-in website copy will remain."))) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: original.key }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || localized(ka, "წაშლა ვერ მოხერხდა.", "Delete failed."));
      setRecords(current => current.filter(item => item.key !== original.key)); setDraft(initialRecord()); setOriginal(null); setStatus(localized(ka, "ტექსტი წაიშალა.", "Text deleted."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  function restoreDefault() {
    if (!draft.key) return;
    setDraft(current => restoreWebsiteTextDefaults(current));
  }

  return <div className="copy-editor">
    <header className="copy-editor-heading"><div><p className="copy-editor-eyebrow">TUTA · WEBSITE CONTENT</p><h2>{localized(ka, "საიტის ტექსტები", "Website copy")}</h2><p>{localized(ka, "მართე გამოქვეყნებული ვებსაიტის ტექსტი და სტილი. აპის ტექსტებზე ეს რედაქტორი არ მოქმედებს.", "Edit published website text and styling. This editor does not change app copy.")}</p></div><button type="button" className="copy-editor-primary" onClick={() => { if (dirty && !window.confirm(localized(ka, "შეუნახავი ცვლილებები დაიკარგება. ახალი ტექსტი დავამატოთ?", "Discard unsaved changes and add a new text?"))) return; setDraft(initialRecord()); setOriginal(null); setError(""); setStatus(""); }} disabled={busy}>{localized(ka, "+ ახალი ტექსტი", "+ New text")}</button></header>
    <div className="copy-editor-actions"><button type="button" onClick={() => void load()} disabled={busy}>{localized(ka, "განახლება", "Refresh")}</button><button type="button" onClick={() => void save()} disabled={busy || !dirty}>{localized(ka, "შენახვა", "Save")}</button><button type="button" className="copy-editor-primary" onClick={() => void save(true)} disabled={busy || !dirty}>{localized(ka, draft.published ? "გამოქვეყნება / განახლება" : "შენახვა და გამოქვეყნება", draft.published ? "Publish / update" : "Save and publish")}</button>{original&&!isBuiltIn&&<button type="button" className="copy-editor-danger" onClick={() => void remove()} disabled={busy}>{localized(ka, "წაშლა", "Delete")}</button>}</div>
    {busy&&<p role="status">{localized(ka, "მუშავდება…", "Working…")}</p>}{status&&<p className="copy-editor-success" role="status">{status}</p>}{error&&<p className="copy-editor-error" role="alert">{error}</p>}
    <div className="copy-editor-grid">
      <section className="copy-editor-controls" aria-label={localized(ka, "ტექსტების სია და რედაქტორი", "Text list and editor")}>
        <div className="copy-editor-list-tools"><label>{localized(ka, "ძიება", "Search")}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={localized(ka, "გასაღები ან ტექსტი", "Key or text")}/></label><label>{localized(ka, "გვერდი", "Page")}<select value={pageFilter} onChange={event => { setPageFilter(event.target.value); setSectionFilter(""); }}><option value="">{localized(ka, "ყველა გვერდი", "All pages")}</option>{pages.map(item => <option key={item}>{item}</option>)}</select></label><label>{localized(ka, "სექცია", "Section")}<select value={sectionFilter} onChange={event => setSectionFilter(event.target.value)}><option value="">{localized(ka, "ყველა სექცია", "All sections")}</option>{sections.map(item => <option key={item}>{item}</option>)}</select></label></div>
        <p className="copy-editor-count">{visible.length} / {records.length} {localized(ka, "ტექსტი", "texts")}</p>
        <div className="copy-editor-list" aria-label={localized(ka, "რედაქტირებადი ტექსტები", "Editable texts")}>{visible.map(item => <button type="button" key={item.key} aria-pressed={draft.key === item.key && !isNew} onClick={() => select(item)}><span>{item.ka_text}</span><small>{item.key} · {item.page} · {item.published ? localized(ka, "გამოქვეყნებული", "Published") : localized(ka, "მონახაზი", "Draft")}</small></button>)}{!visible.length&&<p>{localized(ka, "შესაბამისი ტექსტი ვერ მოიძებნა.", "No matching text found.")}</p>}</div>
        <form className="copy-editor-form" onSubmit={event => { event.preventDefault(); void save(); }}>
          <label>{localized(ka, "უნიკალური გასაღები", "Unique key")}<input required pattern="[a-z0-9][a-z0-9._-]{1,119}" maxLength={120} value={draft.key} disabled={!isNew || busy} onChange={event => change("key", event.target.value.toLowerCase())} placeholder="home.title"/><small>{localized(ka, "შექმნის შემდეგ გასაღები ვერ შეიცვლება; ახალი ტექსტისთვის გამოიყენე მცირე ლათინური ასოები.", "Keys cannot be changed after creation; use lowercase Latin letters for new entries.")}</small></label>
          <div className="copy-editor-two-columns"><label>{localized(ka, "გვერდის გზა", "Page path")}<input required value={draft.page} disabled={busy} onChange={event => change("page", event.target.value)}/></label><label>{localized(ka, "სექცია", "Section")}<input required value={draft.section} disabled={busy} onChange={event => change("section", event.target.value)}/></label></div>
          <div className="copy-editor-actions" role="group" aria-label={localized(ka, "რედაქტირების ენა", "Editing language")}><button type="button" aria-pressed={activeLang === "ka"} onClick={() => setActiveLang("ka")}>ქართული</button><button type="button" aria-pressed={activeLang === "en"} onClick={() => setActiveLang("en")}>English</button><label className="copy-editor-published"><input type="checkbox" checked={draft.published} disabled={busy} onChange={event => change("published", event.target.checked)}/>{localized(ka, "გამოქვეყნებულია", "Published")}</label></div>
          <label>{localized(ka, "ტექსტი", "Text")}<textarea ref={textarea} required rows={5} maxLength={3500} value={activeLang === "ka" ? draft.ka_text : draft.en_text} disabled={busy} onChange={event => change(activeLang === "ka" ? "ka_text" : "en_text", event.target.value)}/></label>
          <fieldset className="copy-editor-style"><legend>{localized(ka, "ტექსტის სტილი", "Text style")} · {activeLang === "ka" ? "ქართული" : "English"}</legend><div className="copy-editor-two-columns"><label>{localized(ka, "ზომა (12–56 px)", "Size (12–56 px)")}<div className="copy-editor-size-input"><input type="range" min="12" max="56" step="1" value={activeLang === "ka" ? draft.ka_style.fontSize : draft.en_style.fontSize} disabled={busy} onChange={event => changeStyle(activeLang, "fontSize", Number(event.target.value))}/><input type="number" min="12" max="56" step="1" value={activeLang === "ka" ? draft.ka_style.fontSize : draft.en_style.fontSize} disabled={busy} onChange={event => changeStyle(activeLang, "fontSize", Number(event.target.value))}/></div></label><label>{localized(ka, "ფერი", "Color")}<div className="copy-editor-color-input"><input type="color" value={(activeLang === "ka" ? draft.ka_style.color : draft.en_style.color).length === 7 ? (activeLang === "ka" ? draft.ka_style.color : draft.en_style.color) : "#1E1B2E"} disabled={busy} onChange={event => changeStyle(activeLang, "color", event.target.value)}/><input value={activeLang === "ka" ? draft.ka_style.color : draft.en_style.color} maxLength={7} disabled={busy} onChange={event => changeStyle(activeLang, "color", event.target.value.toUpperCase())}/></div></label></div></fieldset>
          <button type="button" onClick={restoreDefault} disabled={busy || !draft.key}>{localized(ka, "ნაგულისხმევზე დაბრუნება", "Restore defaults")}</button>
          <div className="copy-editor-preview-sample" lang={activeLang} style={{ fontSize: `${activeLang === "ka" ? draft.ka_style.fontSize : draft.en_style.fontSize}px`, color: /^#[0-9A-F]{6}$/i.test(activeLang === "ka" ? draft.ka_style.color : draft.en_style.color) ? (activeLang === "ka" ? draft.ka_style.color : draft.en_style.color) : "#1E1B2E" }}>{(activeLang === "ka" ? draft.ka_text : draft.en_text) || localized(ka, "წინასწარი ხედი", "Live preview")}</div>
          <small>{original?.updated_at ? `${localized(ka, "ბოლო განახლება", "Updated")}: ${new Date(original.updated_at).toLocaleString(ka ? "ka-GE" : "en-US")}` : localized(ka, "ჯერ არ არის შენახული", "Not saved yet")}</small>
          <button className="copy-editor-primary" disabled={busy || !dirty}>{localized(ka, "შენახვა", "Save")}</button>
        </form>
      </section>
      <section className="copy-editor-preview"><strong>{localized(ka, "საიტის წინასწარი ხედი", "Website preview")}</strong><p>{localized(ka, "აირჩიე სასურველი გვერდი. ტექსტზე დაჭერით ის რედაქტორში მოინიშნება.", "Choose a page. Click a text on it to select it in the editor.")}</p><label>{localized(ka, "გვერდი", "Page")}<select value={draft.page} onChange={event => { if (pages.includes(event.target.value)) { const field = copyFields.find(item => item.id === draft.key); if (field) return; } change("page", event.target.value); }}><option value={draft.page}>{draft.page}</option>{pages.filter(item => item !== draft.page).map(item => <option key={item}>{item}</option>)}</select></label><iframe ref={frame} title={localized(ka, "საიტის წინასწარი ხედი", "Website preview")} sandbox="allow-scripts allow-same-origin" src={`${draft.page || "/"}?copyPreview=${activeLang}`} onLoad={sendPreview}/></section>
    </div>
  </div>;
}
