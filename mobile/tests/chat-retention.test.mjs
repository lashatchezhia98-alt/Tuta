import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_RETENTION_MS,
  chatCutoff,
  liveMessages,
  pruneChatPage,
} from "../src/chat-retention.mjs";
import { doctorPhotoUrl, validDoctorPhoto } from "../src/doctor-photo.mjs";
import { loadCommentPage, mergeComments } from "../src/comment-pages.mjs";
const now = Date.parse("2026-11-09T12:00:00Z");
test("chat expires exactly 48 hours after sending, not at midnight or on read", () => {
  const fresh = {
    id: "fresh",
    created_at: new Date(now - CHAT_RETENTION_MS + 1).toISOString(),
  };
  const expired = { id: "expired", created_at: chatCutoff(now) };
  assert.deepEqual(
    liveMessages(
      [
        fresh,
        expired,
        { created_at: "bad" },
        { created_at: new Date(now + 1).toISOString() },
      ],
      now,
    ),
    [fresh],
  );
  assert.equal(liveMessages([fresh], now + 1).length, 0);
  assert.equal(
    liveMessages([{ created_at: "2026-11-07T16:00:00+04:00" }], now).length,
    0,
  );
});
test("chat expiry uses server time plus elapsed device time and removes bodies from memory state", () => {
  const page = {
    serverNow: new Date(now).toISOString(),
    receivedAt: 100,
    messages: [
      {
        body: "private",
        created_at: new Date(now - CHAT_RETENTION_MS + 500).toISOString(),
      },
    ],
  };
  assert.equal(pruneChatPage(page, 599).messages.length, 1);
  assert.deepEqual(pruneChatPage(page, 600).messages, []);
  assert.equal(
    JSON.stringify(pruneChatPage(page, 600)).includes("private"),
    false,
  );
  assert.equal(pruneChatPage(null), null);
  assert.deepEqual(
    pruneChatPage({ ...page, serverNow: "invalid" }, 100).messages,
    [],
  );
});
test("only a verified doctor record and its own Cloudinary namespace can produce a profile photo", () => {
  const user_id = "12345678-1234-4234-8234-123456789abc";
  const photo_public_id = `tuta-doctors/${user_id}/87654321-1234-4234-8234-123456789abc`;
  assert.equal(validDoctorPhoto(photo_public_id, user_id), true);
  assert.match(
    doctorPhotoUrl("test-cloud", { user_id, photo_public_id }),
    /^https:\/\/res.cloudinary.com\/test-cloud\//,
  );
  for (const record of [
    null,
    { avatar_url: "https://attacker.test/a.jpg" },
    { user_id, photo_public_id: "https://attacker.test/a.jpg" },
    {
      user_id,
      photo_public_id: photo_public_id.replace(
        user_id,
        "00000000-0000-4000-8000-000000000000",
      ),
    },
  ])
    assert.equal(doctorPhotoUrl("test-cloud", record), null);
  assert.equal(
    doctorPhotoUrl("test-cloud", { user_id, photo_public_id }, true),
    null,
  );
  assert.equal(doctorPhotoUrl("../evil", { user_id, photo_public_id }), null);
});
test("comments load newest first, retain microsecond cursor precision and have no 100-comment ceiling", async () => {
  const rows = Array.from({ length: 151 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    created_at: "2026-11-09T12:00:00.123456+00:00",
    parent_comment_id: null,
  }));
  let filters = [];
  const client = {
    from() {
      let boundary = null,
        limit = 0;
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        order() {
          return q;
        },
        limit(n) {
          limit = n;
          return q;
        },
        or(filter) {
          filters.push(filter);
          boundary = filter.match(/id.lt.([0-9a-f-]+)/)[1];
          return q;
        },
        then(resolve) {
          return Promise.resolve({
            data: rows
              .filter((r) => !boundary || r.id < boundary)
              .slice()
              .reverse()
              .slice(0, limit),
          }).then(resolve);
        },
      };
      return q;
    },
  };
  let page = await loadCommentPage(client, "post"),
    all = page.comments;
  assert.equal(all.at(-1).id, rows.at(-1).id);
  while (page.hasMore) {
    page = await loadCommentPage(client, "post", page.before);
    all = mergeComments(all, page.comments);
  }
  assert.equal(all.length, 151);
  assert.equal(all[0].id, rows[0].id);
  assert.ok(filters.every((value) => value.includes(".123456+00:00")));
  assert.equal(mergeComments(all, all).length, 151);
});
