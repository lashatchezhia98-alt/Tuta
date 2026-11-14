import test from "node:test";
import assert from "node:assert/strict";
import configure from "../app.config.js";
import { dispatch, pushMessage } from "../../supabase/functions/activity-push/worker.mjs";

test("standard builds do not enable push; an explicit iOS build enables only iOS", () => {
  const keys = ["EXPO_PUBLIC_TUTA_PUSH_PROJECT_ID", "TUTA_PUSH_IOS", "TUTA_PUSH_GOOGLE_SERVICES_FILE"];
  const previous = keys.map((key) => process.env[key]);
  const config = { plugins: ["existing"], extra: { other: true } };
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(configure({ config }), config);
    process.env.TUTA_PUSH_IOS = "1";
    process.env.EXPO_PUBLIC_TUTA_PUSH_PROJECT_ID = "invalid";
    assert.throws(() => configure({ config }), /valid Expo project ID/);
    process.env.EXPO_PUBLIC_TUTA_PUSH_PROJECT_ID = "5e7d80e5-7266-45ac-8cea-1da89b849d11";
    const enabled = configure({ config });
    assert.equal(enabled.extra.tutaPush.ios, true);
    assert.equal(enabled.extra.tutaPush.android, false);
    assert.equal(enabled.extra.other, true);
    assert.equal(enabled.plugins[0], "existing");
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});

test("lock-screen payload does not include names, message content, IDs, or categories", () => {
  const data = pushMessage({ device: "token", lang: "ka", kind: "care_message", body: "private", job: "private-id" });
  assert.equal(data.body, "ახალი შეტყობინება გაქვს.");
  assert.deepEqual(data.data, { screen: "activity" });
  assert.doesNotMatch(JSON.stringify(data), /private|care_message/);
});

test("worker skips disabled or read activity and handles tickets, retries and expired tokens", async () => {
  const rows = [
    { job: "skip", eligible: false },
    { job: "send", eligible: true },
    { job: "wait", eligible: true },
    { job: "receipt", eligible: true, receipt: "receipt-1" },
    { job: "removed", eligible: true, receipt: "receipt-2" },
  ].map(row => ({ claim: "lease", device: "token", lang: "en", ...row }));
  const changes = [];
  const count = await dispatch({
    accessToken: "test",
    rpc: async (name, args) => {
      if (name === "activity_push_claim") return rows;
      changes.push([args.p_job, args.p_result, args.p_ticket]);
    },
    send: async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer test");
      const payload = JSON.parse(init.body);
      if (url.endsWith("/send")) {
        assert.equal(payload.length, 2);
        return Response.json({ data: [{ status: "ok", id: "ticket" }, { status: "error" }] });
      }
      return Response.json({ data: {
        "receipt-1": { status: "ok" },
        "receipt-2": { status: "error", details: { error: "DeviceNotRegistered" } },
      } });
    },
  });
  assert.equal(count, 5);
  assert.deepEqual(changes, [["skip", "done", null], ["send", "ticket", "ticket"],
    ["wait", "retry", null], ["receipt", "done", null], ["removed", "unregistered", null]]);
});
