import test from "node:test";
import assert from "node:assert/strict";
import { sourceModule } from "./source-loader.mjs";
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const result = (value, status = 200) => Response.json(value, { status });
const failure = (e) => result({ error: e.message }, e.status || 503);
const checked = ({ data, error }) => {
  if (error) throw new ApiError(503, "unavailable");
  return data;
};
const thread = "12345678-1234-4234-8234-123456789abc";
test("chat reads require membership and participant scope, exclude expired messages in the database query", async () => {
  const calls = [];
  const db = {
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          calls.push([table, key, value]);
          return q;
        },
        or(value) {
          calls.push(["scope", value]);
          return q;
        },
        gt(key, value) {
          calls.push(["cutoff", key, value]);
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        maybeSingle: async () => ({ data: { id: thread } }),
        then(resolve) {
          return Promise.resolve({ data: [] }).then(resolve);
        },
      };
      return q;
    },
  };
  const route = sourceModule("app/api/care/route.ts", {
    "@/lib/platform-server": {
      requireUser: async () => ({ db, user: { id: "member" } }),
      checked,
      result,
      failure,
      ApiError,
    },
  });
  const response = await route.GET(
    new Request("https://tutahealth.ge/api/care?thread=" + thread),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).messages.length, 0);
  assert.ok(
    calls.some(
      (row) =>
        row[0] === "scope" &&
        row[1] === "patient_id.eq.member,doctor_id.eq.member",
    ),
  );
  const cutoff = calls.find((row) => row[0] === "cutoff");
  assert.equal(cutoff[1], "created_at");
  assert.ok(
    Math.abs(Date.parse(cutoff[2]) - (Date.now() - 48 * 3600000)) < 1000,
  );
});
test("an unrelated account cannot read private chat messages", async () => {
  let readMessages = false;
  const route = sourceModule("app/api/care/route.ts", {
    "@/lib/platform-server": {
      requireUser: async () => ({
        user: { id: "stranger" },
        db: {
          from(table) {
            if (table === "consultation_messages") readMessages = true;
            const q = {
              select() {
                return q;
              },
              eq() {
                return q;
              },
              or() {
                return q;
              },
              maybeSingle: async () => ({ data: null }),
            };
            return q;
          },
        },
      }),
      checked,
      result,
      failure,
      ApiError,
    },
  });
  assert.equal(
    (
      await route.GET(
        new Request("https://tutahealth.ge/api/care?thread=" + thread),
      )
    ).status,
    404,
  );
  assert.equal(readMessages, false);
});
test("message reads are side-effect free; only the recipient can acknowledge fresh messages", async () => {
  const messageId = "02345678-1234-4234-8234-123456789abc";
  let member = true;
  const writes = [];
  const db = { from(table) {
    let payload;
    const filters = {};
    const q = {
      select() { return q; }, order() { return q; }, limit() { return q; },
      update(value) { assert.equal(table, "consultation_messages"); payload = value; return q; },
      eq(k,v) { filters[k] = v; return q; },
      neq(k,v) { filters[`not:${k}`] = v; return q; },
      or(v) { assert.equal(v, "patient_id.eq.member,doctor_id.eq.member"); return q; },
      in(k,v) { filters[k] = v; return q; },
      is(k,v) { filters[k] = v; return q; },
      gt(k,v) { filters[k] = v; return q; },
      maybeSingle: async () => ({data: member ? { id: thread } : null}),
      then(resolve) {
        if (payload) writes.push({ payload, filters });
        return Promise.resolve({ data: table === "consultation_messages" && !payload ? [{ id: messageId, sender_id: "other", delivered_at: null, read_at: null }] : [] }).then(resolve);
      },
    };
    return q;
  }};
  const route = sourceModule("app/api/care/route.ts", {
    "@/lib/platform-server": { requireUser: async () => ({db,user:{id:"member"}}), checked, result, failure, ApiError },
  });
  const poll = () => route.GET(new Request("https://tutahealth.ge/api/care?thread=" + thread));
  const ack = (visible, messageIds = [messageId]) => route.POST(new Request("https://tutahealth.ge/api/care", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action:"receipts", id:thread, messageIds, visible }),
  }));
  assert.equal((await (await poll()).json()).messages[0].read_at, null);
  assert.equal((await poll()).status, 200);
  assert.equal(writes.length, 0);
  member = false;
  assert.equal((await ack(true)).status, 404);
  member = true;
  assert.equal((await ack(true, [])).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await ack(false)).status, 200);
  assert.deepEqual(writes.map(row => Object.keys(row.payload)[0]), ["delivered_at"]);
  assert.equal((await ack(true)).status, 200);
  assert.deepEqual(writes.map(row => Object.keys(row.payload)[0]), ["delivered_at", "delivered_at", "read_at"]);
  for (const {filters} of writes) {
    assert.equal(filters["not:sender_id"], "member");
    assert.equal(filters.thread_id, thread);
    assert.deepEqual(filters.id, [messageId]);
    assert.ok(Math.abs(Date.parse(filters.created_at) - (Date.now() - 48 * 3600000)) < 1000);
  }
});
test("doctor photos require admin authorization before parsing or contacting Cloudinary", async () => {
  let parsed = false;
  const route = sourceModule("app/api/admin/care/photo/route.ts", {
    "@/lib/platform-server": {
      requireAdmin: async () => {
        throw new ApiError(401, "denied");
      },
      checked,
      result,
      failure,
      ApiError,
    },
  });
  assert.equal(
    (
      await route.POST({
        headers: new Headers(),
        formData() {
          parsed = true;
          throw Error();
        },
      })
    ).status,
    401,
  );
  assert.equal(parsed, false);
});
test("a non-doctor cannot receive a profile photo even through the admin upload boundary", async () => {
  let uploads = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    uploads++;
    throw Error();
  };
  const route = sourceModule("app/api/admin/care/photo/route.ts", {
    "@/lib/platform-server": {
      requireAdmin: async () => ({
        from() {
          const q = {
            select() {
              return q;
            },
            eq() {
              return q;
            },
            maybeSingle: async () => ({ data: null }),
          };
          return q;
        },
      }),
      checked,
      result,
      failure,
      ApiError,
    },
  });
  const form = new FormData();
  form.set("doctorId", thread);
  form.set("file", new File(["fake"], "x.png"));
  try {
    assert.equal(
      (
        await route.POST(
          new Request("https://tutahealth.ge/api/admin/care/photo", {
            method: "POST",
            body: form,
          }),
        )
      ).status,
      403,
    );
    assert.equal(uploads, 0);
  } finally {
    globalThis.fetch = previous;
  }
});
test("market callbacks go through the atomic database guard and never directly overwrite status", async () => {
  let parameters;
  const route = sourceModule("app/api/payments/flitt/callback/route.ts", {
    "@/lib/flitt": {
      FLITT_TEST_MERCHANT_ID: 1549901,
      verifyFlittSignature: () => true,
      verifyFlittOrderStatus: async (order, id, status, amount) =>
        order === "tuta-market-12345678-1234-4234-8234-123456789abc" &&
        id === "12345" && status === "processing" && amount === 499,
      flittEnvironment: () => ({
        admin: {
          rpc: async (name, params) => {
            assert.equal(name, "apply_flitt_market_payment");
            parameters = params;
            return { data: true };
          },
        },
      }),
    },
  });
  const response = await route.POST(
    new Request("https://tutahealth.ge/api/payments/flitt/callback", {
      method: "POST",
      body: JSON.stringify({
        order_id: "tuta-market-12345678-1234-4234-8234-123456789abc",
        payment_id: "12345",
        order_status: "processing",
        amount: 499,
        currency: "GEL",
        merchant_id: 1549901,
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(parameters.p_status, "processing");
  assert.equal(parameters.p_payment_id, "12345");
});
