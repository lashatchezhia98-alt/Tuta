import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMAIL_RESEND_WAIT_MS,
  cleanEmailCode,
  emailCodeError,
  resendSignupEmail,
  validEmailCode,
  verifySignupEmail,
} from "./email-verification.mjs";

export type PendingEmail = { email: string; resendAt: number };

export function useEmailVerification({ auth, pending, lang, onVerified }: {
  auth: () => SupabaseClient["auth"];
  pending: PendingEmail;
  lang: "ka" | "en";
  onVerified?: () => void;
}) {
  const [code, setCode] = useState("");
  const [operation, setOperation] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [resendAt, setResendAt] = useState(pending.resendAt);
  const [wait, setWait] = useState(() => Math.max(0, Math.ceil((pending.resendAt - Date.now()) / 1000)));
  const locked = useRef(false);

  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
      setWait(seconds);
      if (!seconds) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [resendAt]);

  function startWait() {
    setWait(EMAIL_RESEND_WAIT_MS / 1000);
    setResendAt(Date.now() + EMAIL_RESEND_WAIT_MS);
  }

  async function submit(action: "verify" | "resend") {
    if (locked.current || (action === "verify" ? !validEmailCode(code) : Date.now() < resendAt)) return;
    locked.current = true;
    setOperation(action);
    setError("");
    setResent(false);
    try {
      if (action === "verify") {
        await verifySignupEmail(auth(), pending.email, code);
        setCode("");
        onVerified?.();
      } else {
        await resendSignupEmail(auth(), pending.email);
        setCode("");
        setResent(true);
        startWait();
      }
    } catch (cause) {
      setError(emailCodeError(cause, lang, action));
      if (action === "resend" && typeof cause === "object" && cause && "status" in cause && cause.status === 429) startWait();
    } finally {
      locked.current = false;
      setOperation(null);
    }
  }

  return { code, changeCode: (value: string) => setCode(cleanEmailCode(value)), submit, operation, error, resent, wait, valid: validEmailCode(code) };
}
