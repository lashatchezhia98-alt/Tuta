"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthPage } from "@/app/inner-page";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AdminInviteForm() {
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = window.location.hash.slice(1);
    queueMicrotask(() => setToken(value));
  }, []);

  async function claim() {
    if (!token || busy) return;
    setBusy(true); setError("");
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session) throw Error("ჯერ შექმენი და დაადასტურე ანგარიში ან შედი მოწვეული ელფოსტით.");
      const response = await fetch("/api/admin/invitations/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ token }),
      });
      const body = await response.json() as { error?: string; signedIn?: boolean };
      if (!response.ok) throw Error(body.error || "მოწვევის გააქტიურება ვერ მოხერხდა.");
      window.history.replaceState(null, "", window.location.pathname);
      if (body.signedIn) window.location.replace("/admin");
      else setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "მოწვევის გააქტიურება ვერ მოხერხდა."); }
    finally { setBusy(false); }
  }

  if (token === null) return <p className="admin-invite-intro" role="status">მოწვევა იტვირთება…</p>;
  if (done) return <main className="admin-invite-intro"><h1>ადმინის წვდომა გააქტიურდა</h1><Link href="/admin/login">ადმინის პანელში შესვლა</Link></main>;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <main className="admin-invite-intro"><h1>მოწვევის ბმული არასწორია</h1><p>გახსენი მთავარი ადმინის გამოგზავნილი სრული ბმული.</p></main>;
  return <main>
    <div className="admin-invite-intro copy-editor">
      <h1>თუთას ადმინის მოწვევა</h1>
      <p>დარეგისტრირდი იმ ელფოსტით, რომელზეც ბმული გამოგიგზავნეს. თუ ანგარიში უკვე გაქვს, აირჩიე შესვლა.</p>
      <div className="copy-editor-actions">
        <button type="button" disabled={busy} aria-pressed={mode === "register"} onClick={() => { setMode("register"); setError(""); }}>რეგისტრაცია</button>
        <button type="button" disabled={busy} aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>არსებული ანგარიშით შესვლა</button>
        <button type="button" disabled={busy} onClick={() => void claim()}>უკვე შესული ვარ · მოწვევის გააქტიურება</button>
      </div>
      {busy && <p role="status">მოწვევა მოწმდება…</p>}
      {error && <p role="alert" className="copy-editor-error">{error}</p>}
    </div>
    <AuthPage key={mode} kind={mode} lang="ka" onAuthenticated={() => void claim()}/>
  </main>;
}
