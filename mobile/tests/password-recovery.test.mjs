import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { authCallback, MOBILE_AUTH_CALLBACK, recoveryError, recoveryLinkError } from "../src/password-recovery.mjs";

test("expired links are recognized in a browser query or fragment without a session", () => {
  assert.equal(recoveryLinkError("?error_code=otp_expired"), "expired");
  assert.equal(recoveryLinkError("", "#type=recovery&error_code=otp_expired"), "expired");
  assert.equal(recoveryLinkError("?error=access_denied", "#type=recovery"), "invalid");
  assert.equal(recoveryLinkError("?next=/app/dashboard", "#type=recovery&access_token=fixture"), null);
});

test("only a Tuta recovery callback with a full session is accepted", () => {
  const tokens = { access_token: "test-access", refresh_token: "test-refresh" };
  const params = new URLSearchParams({ ...tokens, type: "recovery" });
  assert.deepEqual(authCallback(`${MOBILE_AUTH_CALLBACK}#${params}`), tokens);
  assert.deepEqual(authCallback(`${MOBILE_AUTH_CALLBACK}/?${params}`), tokens);
  assert.equal(authCallback(`${MOBILE_AUTH_CALLBACK}-other#${params}`), null);
  assert.deepEqual(authCallback(`${MOBILE_AUTH_CALLBACK}#access_token=a&refresh_token=b&type=signup`), { error: "invalid" });
  assert.deepEqual(authCallback(`${MOBILE_AUTH_CALLBACK}#type=recovery&access_token=a`), { error: "invalid" });
  assert.deepEqual(authCallback(`${MOBILE_AUTH_CALLBACK}?error_code=otp_expired#${params}`), { error: "expired" });
});

test("password recovery distinguishes network, expired link, weak password and rate limit", () => {
  assert.equal(recoveryError({ name: "AuthRetryableFetchError" }), "network");
  assert.equal(recoveryError({ code: "otp_expired" }), "expired");
  assert.equal(recoveryError({ code: "weak_password" }), "weak");
  assert.equal(recoveryError({ code: "same_password" }), "same");
  assert.equal(recoveryError({ status: 429 }), "rate");
});

test("web and app continue the recovery session instead of signing out", () => {
  const web = readFileSync(new URL("../../app/inner-page.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const webReset = web.split("}else if(reset){")[1].split("}else{")[0];
  const appReset = app.split("} else if (isReset) {")[1].split('} else if (kind === "register")')[0];
  assert.match(webReset, /session\?\.user\.id!==recoveryUser/);
  assert.match(webReset, /updateUser\(\{password\}\)[\s\S]+finish\(\)/);
  assert.match(appReset, /updateUser\(\{ password \}\)[\s\S]+onRecovered\(\)/);
  assert.doesNotMatch(webReset + appReset, /signOut|signInWithPassword/);
  assert.match(app, /automaticallyAdjustKeyboardInsets/);
  assert.match(app, /marginBottom: keyboard.overlap/);
});
