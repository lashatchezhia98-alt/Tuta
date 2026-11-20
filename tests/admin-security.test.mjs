import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSession, verifyAdminSession, SESSION_SECONDS } from '../lib/admin-auth.ts';
import { isSameOrigin, credentialsMatch, readAdminJson } from '../lib/admin-request.ts';
import { canAccessAdminSection } from '../lib/admin-sections.ts';
import { communityPhotoMime, officialPostInput } from '../lib/official-community-post.ts';
import { isOfficialCommunityPost } from '../mobile/src/community.mjs';

test('only the owner and administrators can access official publishing', () => {
  for (const role of ['owner', 'admin', 'content_editor', 'support']) {
    assert.equal(canAccessAdminSection(role, 'community-posts'), role === 'owner' || role === 'admin');
  }
});

test('official community posts use the regular topic and body limits and ignore author fields', () => {
  const form = new FormData();
  form.set('body', '  გამარჯობა, ეს თუთაა!  ');
  form.set('topic', 'wellbeing');
  form.set('display_name', 'Different author');
  assert.deepEqual(officialPostInput(form), { body: 'გამარჯობა, ეს თუთაა!', topic: 'wellbeing' });
  form.set('topic', 'invalid');
  assert.equal(officialPostInput(form), null);
  form.set('topic', 'cycle');
  for (const body of [' ', 'ა'.repeat(2001), 'a '.repeat(201)]) {
    form.set('body', body);
    assert.equal(officialPostInput(form), null);
  }
  assert.equal(communityPhotoMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])), 'image/png');
  assert.equal(communityPhotoMime(new TextEncoder().encode('<svg></svg>!')), null);
});

test('the official badge is based on the protected database identity, not a name', () => {
  assert.equal(isOfficialCommunityPost({ public_author_id: null, is_anonymous: false }), true);
  assert.equal(isOfficialCommunityPost({ public_author_id: null, is_anonymous: true }), false);
  assert.equal(isOfficialCommunityPost({ public_author_id: 'member-id', is_anonymous: false, display_name: 'თუთა' }), false);
});

test('admin sessions reject tampering, expiration and invalid configuration', async () => {
  const originalEmail = process.env.ADMIN_EMAIL;
  const originalSecret = process.env.ADMIN_SESSION_SECRET;
  const now = Date.now;
  try {
    process.env.ADMIN_EMAIL = 'admin@example.test';
    process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-in-production-123456';
    const token = await createAdminSession(process.env.ADMIN_EMAIL);
    assert.equal(await verifyAdminSession(token), true);
    assert.equal(await verifyAdminSession(token + '.extra'), false);
    assert.equal(await verifyAdminSession('x' + token), false);
    assert.equal(await verifyAdminSession('x'.repeat(4097)), false);
    assert.equal(await verifyAdminSession(), false);
    process.env.ADMIN_EMAIL = 'different@example.test';
    assert.equal(await verifyAdminSession(token), false);
    process.env.ADMIN_EMAIL = 'admin@example.test';
    Date.now = () => now() + (SESSION_SECONDS + 1) * 1000;
    assert.equal(await verifyAdminSession(token), false);
    Date.now = now;
    process.env.ADMIN_SESSION_SECRET = 'short';
    assert.equal(await createAdminSession(process.env.ADMIN_EMAIL), null);
    assert.equal(await verifyAdminSession(token), false);
  } finally {
    Date.now = now;
    for (const [key, value] of [['ADMIN_EMAIL', originalEmail], ['ADMIN_SESSION_SECRET', originalSecret]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('admin writes require exact origin, including scheme and port', () => {
  for (const origin of ['https://tutahealth.ge', 'https://other.test', 'https://sub.tutahealth.ge', 'http://tutahealth.ge', 'https://tutahealth.ge:444', 'null', 'bad']) {
    assert.equal(isSameOrigin(new Request('https://tutahealth.ge/api/admin/login', { headers: { origin } })), origin === 'https://tutahealth.ge');
  }
  assert.equal(isSameOrigin(new Request('https://tutahealth.ge/api/admin/login')), false);
});

test('credential comparisons reject wrong values and non-string input', () => {
  assert.equal(credentialsMatch('secret', 'secret'), true);
  for (const value of ['wrong', null, {}, 123, 'x'.repeat(4097)]) assert.equal(credentialsMatch(value, 'secret'), false);
});

const request = (body, type = 'application/json') => new Request('https://tutahealth.ge/api/admin/login', { method: 'POST', headers: { 'content-type': type }, body });
test('admin JSON is bounded and must be an object', async () => {
  assert.deepEqual(await readAdminJson(request('{"enabled":true}')), { enabled: true });
  for (const body of ['null', '[]', '123', '"text"', '{bad', '', JSON.stringify({ text: 'ა'.repeat(6000) })]) {
    await assert.rejects(readAdminJson(request(body)));
  }
  await assert.rejects(readAdminJson(request('{}', 'text/plain')));
});
