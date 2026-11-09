import test from "node:test";
import assert from "node:assert/strict";
import { parsePaymentReturn, paymentReturnLink } from "../src/payment-return.mjs";

test("only fixed Tuta deep links can reopen Premium or Orders", () => {
  const uuid = "12345678-1234-4234-8234-123456789abc";
  assert.equal(parsePaymentReturn(paymentReturnLink("premium", `tuta-${uuid}`)), "premium");
  assert.equal(parsePaymentReturn(paymentReturnLink("market", `tuta-market-${uuid}`)), "orders");
  for (const url of [
    null,
    "https://tutahealth.ge/premium",
    "com.tutahealth.app://auth-callback",
    "com.tutahealth.app://payment-return.attacker/premium",
    "com.tutahealth.app://payment-return/settings",
    "com.tutahealth.app://payment-return/market?status=approved",
    `com.tutahealth.app://payment-return/market/tuta-${uuid}`,
    `com.tutahealth.app://payment-return/premium/tuta-${uuid}/extra`,
  ]) assert.equal(parsePaymentReturn(url), null);
});
