import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EMAIL_CODE_LENGTH,
  EMAIL_RESEND_WAIT_MS,
  cleanEmailCode,
  emailCodeError,
  emailNotConfirmed,
  resendSignupEmail,
  validEmailCode,
  verifySignupEmail,
} from "../src/email-verification.mjs";

test("email verification requires six digits and preserves a leading zero", async () => {
  assert.equal(cleanEmailCode("0 12-345"), "012345");
  assert.equal(validEmailCode("012345"), true);
  const auth = { verifyOtp: () => assert.fail("Invalid input reached the API") };
  for (const value of ["12345", "1234567", "abcdef", "١٢٣٤٥٦", "123456\n", 123456]) {
    assert.equal(validEmailCode(value), false);
    await assert.rejects(verifySignupEmail(auth, "sample@example.com", value), /format/);
  }
});

test("verification submits the email OTP and requires a confirmed session", async () => {
  const email = "sample@example.com";
  const token = "012345";
  const session = { access_token: "fixture" };
  const user = { email_confirmed_at: "2026-01-01T00:00:00Z" };
  await verifySignupEmail({
    async verifyOtp(payload) {
      assert.deepEqual(payload, { email, token, type: "email" });
      return { data: { session, user }, error: null };
    },
  }, email, token);
  for (const data of [{ session: null, user }, { session, user: {} }]) {
    await assert.rejects(verifySignupEmail({
      verifyOtp: async () => ({ data, error: null }),
    }, email, token), /confirmed session/);
  }
});

test("resend requests a signup code, and expired/rate-limited responses are actionable", async () => {
  const email = "sample@example.com";
  await resendSignupEmail({
    async resend(payload) {
      assert.deepEqual(payload, { email, type: "signup" });
      return { error: null };
    },
  }, email);
  const expired = { code: "otp_expired", status: 403 };
  await assert.rejects(verifySignupEmail({
    verifyOtp: async () => ({ data: null, error: expired }),
  }, email, "123456"), (error) => error === expired);
  assert.match(emailCodeError(expired, "en", "verify"), /expired/);
  assert.match(emailCodeError({ status: 429 }, "en", "resend"), /Too many requests/);
  assert.equal(EMAIL_RESEND_WAIT_MS, 60_000);
  assert.equal(emailNotConfirmed({ code: "email_not_confirmed" }), true);
  assert.equal(emailNotConfirmed({ code: "invalid_credentials" }), false);
});

test("confirmation email uses the configured six-digit token, not a redirect link", () => {
  const config = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");
  const template = readFileSync(new URL("../../supabase/templates/confirmation.html", import.meta.url), "utf8");
  assert.match(config, /enable_confirmations\s*=\s*true/);
  assert.match(config, new RegExp(`otp_length\\s*=\\s*${EMAIL_CODE_LENGTH}\\b`));
  assert.match(template, /{{\s*\.Token\s*}}/);
  assert.doesNotMatch(template, /ConfirmationURL|RedirectTo|localhost/);
});
