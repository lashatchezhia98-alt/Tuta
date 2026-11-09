export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_RESEND_WAIT_MS = 60_000;

export function cleanEmailCode(value) {
  return value.replace(/[^0-9]/g, "").slice(0, EMAIL_CODE_LENGTH);
}

export function validEmailCode(value) {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

export function emailNotConfirmed(error) {
  return error?.code === "email_not_confirmed";
}

export async function verifySignupEmail(auth, email, token) {
  if (!validEmailCode(token)) throw new Error("Invalid email code format");
  const { data, error } = await auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  if (!data.session || !data.user?.email_confirmed_at) {
    throw new Error("Email verification did not establish a confirmed session");
  }
}

export async function resendSignupEmail(auth, email) {
  const { error } = await auth.resend({ email, type: "signup" });
  if (error) throw error;
}

export function emailCodeError(error, lang, action) {
  const ka = lang === "ka";
  if (error?.status === 429 || error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return ka ? "მეტისმეტად ბევრი მოთხოვნაა. მოიცადე და სცადე ისევ." : "Too many requests. Wait a little and try again.";
  }
  if (action === "verify" && (error?.code === "otp_expired" || error?.status === 403)) {
    return ka ? "კოდი არასწორია ან ვადა გაუვიდა. შეამოწმე ბოლო წერილი ან მოითხოვე ახალი კოდი." : "The code is incorrect or expired. Check the latest email or request a new code.";
  }
  return ka ? "მოქმედება ვერ შესრულდა. შეამოწმე კავშირი და სცადე ისევ." : "Could not complete the request. Check your connection and try again.";
}
