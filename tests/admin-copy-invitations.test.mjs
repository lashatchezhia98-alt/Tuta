import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceModule } from './source-loader.mjs';

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const result = (data, status = 200) => Response.json(data, { status });
const failure = error => result({ error: error.message }, error.status || 503);
const checked = response => response.data;
const host = 'https://tutahealth.ge';
const request = (path, method, body, origin = host) => new Request(host + path, {
  method, headers: { origin, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});

test('copy registry falls back independently per language and accepts only configured plain-text fields', () => {
  const { validateCopy, getCopyText } = sourceModule('lib/site-copy.ts');
  const copy = validateCopy({ ka: { 'home.title': ' განახლებული სათაური ' } });
  assert.equal(getCopyText(copy, 'home.title', 'ka'), 'განახლებული სათაური');
  assert.match(getCopyText(copy, 'home.title', 'en'), /body/i);
  assert.throws(() => validateCopy({ ka: { arbitrary: 'not allowed' } }));
  assert.throws(() => validateCopy({ ka: { 'home.title': '   ' } }));
  assert.throws(() => validateCopy({ en: { 'home.title': 'x'.repeat(3501) } }));
  assert.throws(() => validateCopy(JSON.parse('{"ka":{"__proto__":"bad"}}')));
  assert.deepEqual(validateCopy({ ka: { arbitrary: 'dropped' } }, false), { ka: {}, en: {} });
});

test('draft is private, publish updates public copy, and stale writes cannot overwrite the latest revision', async () => {
  let row = { draft: {}, published: {}, revision: 0, published_at: null };
  let signedIn = false;
  const db = { from(table) {
    assert.equal(table, 'website_copy');
    let selection, payload, expected;
    const query = {
      select(columns) { selection = columns; return query; },
      eq(key, value) { if (key === 'revision') expected = value; return query; },
      update(value) { payload = value; return query; },
      async maybeSingle() {
        if (row.revision !== expected) return { data: null };
        row = { ...row, ...payload }; return { data: row };
      },
      async single() { return { data: Object.fromEntries(selection.split(',').map(key => [key, row[key]])) }; },
    };
    return query;
  } };
  const mocks = { '@/lib/platform-server': { ApiError, checked, failure, result, dbClient: () => db, requireAdmin: async req => {
    if (req.method !== 'GET' && req.headers.get('origin') !== host) throw new ApiError(403, 'Cross origin');
    if (!signedIn) throw new ApiError(401, 'Sign in');
    return db;
  } } };
  const admin = sourceModule('app/api/admin/website-copy/route.ts', mocks);
  const publicApi = sourceModule('app/api/website-copy/route.ts', mocks);
  const path = '/api/admin/website-copy';
  const draft = { ka: { 'home.title': 'ტესტი' } };
  const put = (action, revision, origin) => admin.PUT(request(path, 'PUT', { action, revision, draft }, origin));
  assert.equal((await admin.GET(request(path, 'GET'))).status, 401);
  assert.equal((await put('publish', 0)).status, 401);
  signedIn = true;
  assert.equal((await put('publish', 0, 'https://other.test')).status, 403);
  assert.equal((await put('save', 0)).status, 200);
  assert.deepEqual(await (await publicApi.GET()).json(), { copy: { ka: {}, en: {} } });
  assert.equal((await put('publish', 0)).status, 409);
  assert.equal((await put('publish', 1)).status, 200);
  assert.deepEqual(await (await publicApi.GET()).json(), { copy: { ...draft, en: {} } });
});

test('invite creation is owner-only and saves a hash instead of the shareable link token', async () => {
  const { adminInviteHash, validAdminInviteToken } = sourceModule('lib/admin-invitations.ts');
  let owner = false;
  let insert;
  const db = { from: () => ({ insert: data => {
    insert = data;
    return { select: () => ({ single: async () => ({ data: { id: 'test', email: data.email } }) }) };
  } }) };
  const route = sourceModule('app/api/admin/invitations/route.ts', { '@/lib/platform-server': {
    ApiError, checked, failure, result, requireAdmin: async (_request, ownerOnly) => {
      assert.equal(ownerOnly, true);
      if (!owner) throw new ApiError(403, 'Owner only');
      return db;
    },
  } });
  const create = () => route.POST(request('/api/admin/invitations', 'POST', { action: 'create', email: ' Invite@Example.test ' }));
  assert.equal((await create()).status, 403);
  assert.equal(insert, undefined);
  owner = true;
  const response = await create();
  assert.equal(response.status, 201);
  const { path } = await response.json();
  const token = new URL(path, host).hash.slice(1);
  assert.equal(validAdminInviteToken(token), true);
  assert.deepEqual(insert, { email: 'invite@example.test', token_hash: adminInviteHash(token) });
  assert.ok(!JSON.stringify(insert).includes(token));
});

test('invited admin session distinguishes the membership grant from the owner', async () => {
  const { createInvitedAdminSession, readAdminIdentity, verifyAdminSession } = sourceModule('lib/admin-auth.ts');
  const original = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'unit-test-secret-not-used-in-production';
  try {
    const userId = '10000000-0000-0000-0000-000000000001', grantId = '10000000-0000-0000-0000-000000000002';
    const token = await createInvitedAdminSession(userId, grantId);
    assert.deepEqual(await readAdminIdentity(token), { role: 'admin', userId, grantId });
    assert.equal(await verifyAdminSession(token), false);
    assert.equal(await readAdminIdentity(token + '.extra'), null);
  } finally {
    if (original === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = original;
  }
});
