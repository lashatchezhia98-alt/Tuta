export const MOBILE_AUTH_CALLBACK = "com.tutahealth.app://auth-callback";
export const WEB_PASSWORD_RECOVERY = "https://tutahealth.ge/forgot-password";

/** @param {string | null} url
 * @returns {{error: "expired" | "invalid"} | {access_token: string, refresh_token: string} | null}
 */
export function authCallback(url) {
  if (!url || ![MOBILE_AUTH_CALLBACK, MOBILE_AUTH_CALLBACK + "/"].some(
    (base) => url === base || url.startsWith(base + "?") || url.startsWith(base + "#"),
  )) return null;
  const [base, hash] = url.split("#");
  const query = new URLSearchParams(base.split("?")[1] ?? "");
  const fragment = new URLSearchParams(hash ?? "");
  const read = (key) => fragment.get(key) ?? query.get(key);
  if (["error", "error_code", "error_description"].some((key) => read(key))) {
    return { error: read("error_code") === "otp_expired" ? "expired" : "invalid" };
  }
  const access_token = read("access_token"), refresh_token = read("refresh_token");
  if (!access_token || !refresh_token || !["recovery", "invite"].includes(read("type"))) {
    return { error: "invalid" };
  }
  return { access_token, refresh_token };
}

export function recoveryError(error) {
  if (error?.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error?.code)) return "rate";
  if (error?.code === "same_password") return "same";
  if (error?.code === "weak_password") return "weak";
  if (["otp_expired", "session_not_found", "refresh_token_not_found", "refresh_token_already_used"].includes(error?.code)) return "expired";
  if (error?.name === "AuthRetryableFetchError" || error?.name === "TypeError") return "network";
  return "invalid";
}
