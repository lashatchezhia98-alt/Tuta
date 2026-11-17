import test from "node:test";
import assert from "node:assert/strict";
import { serveCommunityPhoto } from "../lib/community-media.ts";

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
