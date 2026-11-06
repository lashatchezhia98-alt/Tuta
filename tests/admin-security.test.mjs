import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSession, verifyAdminSession, SESSION_SECONDS } from '../lib/admin-auth.ts';
import { isSameOrigin, credentialsMatch, readAdminJson } from '../lib/admin-request.ts';

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
