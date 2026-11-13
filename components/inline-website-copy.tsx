"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CopyLanguage } from "@/lib/site-copy";
import type { WebsiteTextRecord } from "@/lib/website-content";

const endpoint = "/api/admin/website-texts";

export default function InlineWebsiteCopy({ language, icon }: { language: CopyLanguage; icon: ReactNode }) {
  const ka = language === "ka";
  const [records, setRecords] = useState<WebsiteTextRecord[] | null>(null);
  const [draft, setDraft] = useState<WebsiteTextRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const active = records !== null;

  useEffect(() => {
    if (!draft || dialog.current?.open) return;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, [draft]);

  useEffect(() => {
    if (!records) return;
    const select = (event: MouseEvent | KeyboardEvent) => {
      if (event.altKey || !(event.target instanceof Element)) return;
      if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
      const text = event.target.closest<HTMLElement>("[data-site-copy]") ??
        (event instanceof KeyboardEvent ? event.target.closest("a,button")?.querySelector<HTMLElement>("[data-site-copy]") : null);
      const item = text && records.find((row) => row.key === text.dataset.siteCopy);
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      setDraft(item);
      setMessage("");
    };
    document.documentElement.classList.add("inline-copy-enabled");
    document.addEventListener("click", select, true);
    document.addEventListener("keydown", select, true);
    return () => {
      document.documentElement.classList.remove("inline-copy-enabled");
      document.removeEventListener("click", select, true);
      document.removeEventListener("keydown", select, true);
    };
  }, [records]);

  async function toggle() {
    setMessage("");
    if (active) { setRecords(null); return; }
    setBusy(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.records)) throw new Error();
      setRecords(body.records);
    } catch {
      setMessage(ka ? "რედაქტორი ვერ ჩაიტვირთა. გადაამოწმე ადმინის სესია." : "Could not load the editor. Check your admin session.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, published: true }),
      });
      const body = await response.json();
      if (!response.ok || body.record?.key !== draft.key) throw new Error();
      setRecords((current) => current?.map((row) => row.key === draft.key ? body.record : row) ?? null);
      dialog.current?.close();
      window.dispatchEvent(new Event("tuta:website-copy-saved"));
      setMessage(ka ? "ტექსტი გამოქვეყნდა." : "Text published.");
    } catch {
      setMessage(ka ? "ტექსტი ვერ შეინახა. გადაამოწმე ორივე ველი და ადმინის სესია." : "Could not save. Check both fields and your admin session.");
    } finally { setBusy(false); }
  }

  return <>
    <button type="button" className="admin-website-copy-shortcut" aria-pressed={active} disabled={busy} onClick={() => void toggle()}>
      {icon}
      <span>{active ? (ka ? "რედაქტირების დასრულება" : "Exit editing") : (ka ? "ტექსტების რედაქტირება" : "Edit website text")}</span>
    </button>
    <aside className="inline-copy-status" role="status">
      {message || (active ? (ka ? "დააჭირე მონიშნულ ტექსტს. Alt + დაჭერით ბმული გაიხსნება." : "Select an outlined text. Alt-click to follow a link.") : "")}
    </aside>
    <dialog ref={dialog} className="inline-copy-dialog copy-editor" aria-labelledby="inline-copy-heading" onClose={() => setDraft(null)} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      {draft && <form className="copy-editor-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <h2 id="inline-copy-heading">{ka ? "ტექსტის რედაქტირება" : "Edit website text"}</h2>
        <small>{draft.key}</small>
        <label>ქართული<textarea rows={4} required maxLength={3500} disabled={busy} value={draft.ka_text} onChange={(event) => setDraft({ ...draft, ka_text: event.target.value })} /></label>
        <label>English<textarea rows={4} required maxLength={3500} disabled={busy} value={draft.en_text} onChange={(event) => setDraft({ ...draft, en_text: event.target.value })} /></label>
        {message && <p role="alert" className="copy-editor-error">{message}</p>}
        <div className="copy-editor-actions">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>{ka ? "გაუქმება" : "Cancel"}</button>
          <button type="submit" className="copy-editor-primary" disabled={busy}>{ka ? "შენახვა და გამოქვეყნება" : "Save and publish"}</button>
        </div>
      </form>}
    </dialog>
  </>;
}
