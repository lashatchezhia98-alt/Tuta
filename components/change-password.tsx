"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import PasswordField from "@/components/password-field";
import { SiteCopyText, useSiteCopyText } from "@/components/site-copy-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ChangePassword({ lang }: { lang: "ka" | "en" }) {
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  const ka = lang === "ka";
  useEffect(() => {
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
        setAccount(session?.user && !session.user.is_anonymous ? session.user.id : null);
      });
      return () => subscription.unsubscribe();
    } catch {
      const timer = setTimeout(() => setUnavailable(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  return <section id="change-password" className="workspace-card scroll-mt-24" aria-labelledby="change-password-heading">
    <h2 id="change-password-heading"><SiteCopyText id="policy.privacy.password.title" lang={lang}/></h2>
    {unavailable ? <p role="alert">{ka ? "ანგარიშთან კავშირი ვერ შედგა. სცადე ხელახლა." : "Account access is unavailable. Try again."}</p>
      : account === undefined ? <p role="status">{ka ? "მოწმდება ანგარიში…" : "Checking your account…"}</p>
      : account ? <PasswordForm key={account} account={account} lang={lang}/>
      : <p><Link className="underline" href="/login?next=%2Fprivacy">{ka ? "პაროლის შესაცვლელად შედი ანგარიშში" : "Sign in to change your password"}</Link></p>}
    <p><Link className="underline" href="/forgot-password"><SiteCopyText id="auth.forgot" lang={lang}/></Link></p>
  </section>;
}

function PasswordForm({ account, lang }: { account: string; lang: "ka" | "en" }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const currentLabel = useSiteCopyText("policy.privacy.password.current", lang);
  const passwordLabel = useSiteCopyText("auth.newPassword", lang);
  const confirmLabel = useSiteCopyText("auth.repeatNewPassword", lang);
  const ka = lang === "ka";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fail = (geo: string, en: string) => setMessage({ text: ka ? geo : en, ok: false });
    if (!current || password.length < 8 || password !== confirmation || password === current) {
      fail("ახალი პაროლი უნდა იყოს მინიმუმ 8 სიმბოლო, განსხვავდებოდეს ძველისგან და ემთხვეოდეს დადასტურებას.", "Use at least 8 characters, choose a different password and make sure both new passwords match.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { auth } = getSupabaseBrowserClient();
      const { data: { user } } = await auth.getUser();
      if (!user || user.id !== account || user.is_anonymous) {
        fail("სესია შეიცვალა. ხელახლა შედი ანგარიშში.", "Your session changed. Sign in again.");
        return;
      }
      const { error } = await auth.updateUser({ password, current_password: current });
      if (error) {
        if (error.code === "reauthentication_needed") fail("ხელახლა შედი ანგარიშში და შემდეგ შეცვალე პაროლი.", "Sign in again before changing your password.");
        else fail("პაროლი არ შეცვლილა. შეამოწმე მიმდინარე პაროლი და ახალი პაროლის მოთხოვნები.", "Password was not changed. Check your current password and the new password requirements.");
        return;
      }
      setCurrent("");
      setPassword("");
      setConfirmation("");
      setMessage({ text: ka ? "პაროლი შეიცვალა." : "Password changed.", ok: true });
    } catch {
      fail("პაროლი ვერ შეიცვალა. შეამოწმე კავშირი და სცადე ხელახლა.", "Could not change your password. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  return <form className="workspace-form privacy-password-form" onSubmit={submit}>
    <PasswordField label={currentLabel} value={current} onChange={setCurrent} autoComplete="current-password" lang={lang}/>
    <PasswordField label={passwordLabel} value={password} onChange={setPassword} lang={lang}/>
    <PasswordField label={confirmLabel} value={confirmation} onChange={setConfirmation} lang={lang}/>
    <button type="submit" disabled={busy}>{busy ? <SiteCopyText id="auth.working" lang={lang}/> : <SiteCopyText id="auth.reset" lang={lang}/>}</button>
    {message && <p role={message.ok ? "status" : "alert"}>{message.text}</p>}
  </form>;
}
