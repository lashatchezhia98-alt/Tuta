"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

async function sessionHeaders() {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : null;
}

const unavailable = "მოწვევის შემოწმება ვერ მოხერხდა. განაახლე გვერდი და სცადე ხელახლა.";

export default function DoctorSetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewName, setPreviewName] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const headers = await sessionHeaders();
        if (controller.signal.aborted) return;
        if (!headers) { setNeedsLogin(true); return; }
        const response = await fetch("/api/doctor/setup", {headers, signal:controller.signal, cache:"no-store"});
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (response.status===401) setNeedsLogin(true);
        else if (response.ok) setEmail(data.email);
        else setError(data.error || unavailable);
      } catch {
        if (!controller.signal.aborted) setError(unavailable);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const body = new FormData(event.currentTarget);
    const photo = body.get("photo");
    if (photo instanceof File && photo.size > 3 * 1024 * 1024) {
      setError("ფოტო მაქსიმუმ 3 მბ უნდა იყოს.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const headers = await sessionHeaders();
      if (!headers) { setNeedsLogin(true); return; }
      const response = await fetch("/api/doctor/setup", {method:"POST", headers, body});
      const data = await response.json();
      if (response.status===401) { setNeedsLogin(true); return; }
      if (!response.ok) throw new Error(data.error || unavailable);
      router.replace("/consultation/doctor");
    } catch (e) {
      setError(e instanceof Error && e.message !== "Load failed" && e.message !== "Failed to fetch" ? e.message : unavailable);
    } finally { setBusy(false); }
  }

  return <main className="inner-container">
    <section className="workspace-card">
      <h1>ექიმის პროფილის შევსება</h1>
      {error ? <p role="alert">{error}</p> : null}
      {needsLogin ? <Link href="/login?next=%2Fconsultation%2Fdoctor%2Fsetup">შედი მოწვევის ელფოსტით</Link>
        : email ? <form className="workspace-form" onSubmit={submit}>
          <p>{email}</p>
          <label>სახელი<input name="first_name" autoComplete="given-name" required minLength={2} maxLength={60}/></label>
          <label>გვარი<input name="last_name" autoComplete="family-name" required minLength={2} maxLength={60}/></label>
          <label>სპეციალობა<input name="specialty" placeholder="მაგალითად, გინეკოლოგი" required maxLength={120}/></label>
          <label>პროფილის ფოტო (არასავალდებულო, მაქს. 3 მბ)
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setPreviewName(event.target.files?.[0]?.name || "")}/>
          </label>
          {previewName ? <button type="button" onClick={event=>{
            const input=event.currentTarget.form?.elements.namedItem("photo");
            if(input instanceof HTMLInputElement) input.value="";
            setPreviewName("");
          }}>არჩეული ფოტოს წაშლა</button> : null}
          <label><input type="checkbox" name="publish" value="yes" required/> ვეთანხმები, რომ ჩემი სახელი, გვარი, სპეციალობა და დამატებული ფოტო საჯაროდ გამოჩნდეს.</label>
          <button type="submit" disabled={busy}>{busy?"ქვეყნდება…":"პროფილის გამოქვეყნება"}</button>
        </form> : error ? <Link href="/consultation/doctor">ექიმის კაბინეტი</Link>
          : <p role="status">მოწვევა მოწმდება…</p>}
    </section>
  </main>;
}
