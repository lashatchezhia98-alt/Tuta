import { SiteCopyText } from "@/components/site-copy-provider";
import { EMAIL_CODE_LENGTH } from "@/mobile/src/email-verification.mjs";
import { useEmailVerification, type PendingEmail } from "@/mobile/src/use-email-verification";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function EmailCodeForm({ pending, lang, onVerified, onBack }: {
  pending: PendingEmail;
  lang: "ka" | "en";
  onVerified: () => void;
  onBack: () => void;
}) {
  const ka = lang === "ka";
  const verification = useEmailVerification({ auth: () => getSupabaseBrowserClient().auth, pending, lang, onVerified });
  const busy = verification.operation !== null;
  return (
    <form onSubmit={(event) => { event.preventDefault(); void verification.submit("verify"); }}>
      <label>
        <SiteCopyText id="auth.verifyCode" lang={lang}/>
        <input
          name="email-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={EMAIL_CODE_LENGTH}
          pattern="[0-9]{6}"
          value={verification.code}
          onChange={(event) => verification.changeCode(event.target.value)}
          disabled={busy}
          required
        />
      </label>
      {verification.error && <p className="admin-login-error" role="alert">{verification.error}</p>}
      {verification.resent && <p className="auth-notice" role="status">{ka ? "ახალი კოდი გაიგზავნა. გამოიყენე ბოლო წერილი." : "A new code was sent. Use the latest email."}</p>}
      <button type="submit" disabled={busy || !verification.valid}>
        {verification.operation === "verify" ? (ka ? "მოწმდება…" : "Verifying…") : (<SiteCopyText id="auth.verifyAction" lang={lang}/>)}
      </button>
      <button type="button" className="email-code-secondary" disabled={busy || verification.wait > 0} onClick={() => void verification.submit("resend")}>
        {verification.operation === "resend" ? (ka ? "იგზავნება…" : "Sending…") : (<SiteCopyText id="auth.resendCode" lang={lang}/>)}
        {verification.wait > 0 ? ` (${verification.wait}s)` : ""}
      </button>
      <button type="button" className="email-code-secondary" disabled={busy} onClick={onBack}>{ka ? "უკან" : "Back"}</button>
    </form>
  );
}
