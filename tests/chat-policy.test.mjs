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
        order_id: "tuta-market-test",
        order_status: "processing",
        amount: 499,
        currency: "GEL",
        merchant_id: 1549901,
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(parameters.p_status, "processing");
  assert.equal(parameters.p_payment_id, null);
});
