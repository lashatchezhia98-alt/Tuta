import test from "node:test";
import assert from "node:assert/strict";
import { serveCommunityPhoto } from "../lib/community-media.ts";
import { createHash } from "node:crypto";
import { sourceModule } from "./source-loader.mjs";

test("protected web uploads and already-installed clients receive different valid signatures", async (t) => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test",
    CLOUDINARY_CLOUD_NAME: "tuta-test",
    CLOUDINARY_API_KEY: "fake-key",
    CLOUDINARY_API_SECRET: "fake-secret",
  };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => old === undefined ? delete process.env[key] : process.env[key] = old);
  }
  const { POST } = sourceModule("app/api/community/cloudinary-signature/route.ts", {
    "@supabase/supabase-js": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "test-uid" } } }) } }) },
    "next/server": { NextResponse: { json: (value, options) => Response.json(value, options) } },
  });
  const request = (body, token = true) => new Request("https://example.test", {
    method: "POST",
    headers: token ? { Authorization: "Bearer test-token" } : {},
    body: JSON.stringify(body),
  });
  assert.equal((await POST(request({}, false))).status, 401);
  const legacy = await (await POST(request({ anonymous: true }))).json();
  const secured = await (await POST(request({ anonymous: true, delivery: "authenticated" }))).json();
  for (const [upload, expectedType] of [[legacy, undefined], [secured, "authenticated"]]) {
    assert.equal(upload.type, expectedType);
    const suffix = expectedType ? "&type=authenticated" : "";
    assert.equal(upload.signature, createHash("sha1").update(`public_id=${upload.publicId}&timestamp=${upload.timestamp}${suffix}fake-secret`).digest("hex"));
    assert.equal(upload.publicId.startsWith("tuta-community/anon/private_"), Boolean(expectedType));
  }
});

test("community media never fetches arbitrary paths and proxies private assets without caching", async (t) => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const secret = process.env.CLOUDINARY_API_SECRET;
  process.env.CLOUDINARY_CLOUD_NAME = "tuta-test";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  t.after(() => {
    if (cloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = cloud;
    if (secret === undefined) delete process.env.CLOUDINARY_API_SECRET;
    else process.env.CLOUDINARY_API_SECRET = secret;
  });
  const fetch = t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(new Response("image", { headers: { "Content-Type": "image/jpeg" } })));
  assert.equal((await serveCommunityPhoto("https://example.com/file")).status, 404);
  assert.equal(fetch.mock.callCount(), 0);
  const response = await serveCommunityPhoto("tuta-community/anon/private_test");
  assert.match(fetch.mock.calls[0].arguments[0], /\/authenticated\/s--[\w-]{8}--\//);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("location"), null);
  assert.equal(await response.text(), "image");
});
