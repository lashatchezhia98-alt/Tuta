import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceModule } from './source-loader.mjs';

test('website copy remains bilingual, within editor limits and preserves custom wording', () => {
  const { copyFields, getCopyText } = sourceModule('lib/site-copy.ts');
  assert.equal(new Set(copyFields.map(field => field.id)).size, copyFields.length);
  for (const field of copyFields) {
    for (const lang of ['ka', 'en']) {
      assert.ok(field[lang].trim(), `${field.id}: ${lang}`);
      assert.ok(field[lang].length <= field.max, `${field.id}: editor limit`);
    }
  }
  assert.equal(getCopyText({ ka: { 'nav.marketShort': 'MARKET' }, en: {} }, 'nav.marketShort', 'ka'), 'MARKET');
  assert.equal(getCopyText({ ka: {}, en: {} }, 'nav.marketShort', 'ka'), 'მარკეტი');
});

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const result = (data, status = 200) => Response.json(data, { status });
const failure = error => result({ error: error.message }, error.status || 503);
const checked = response => {
  if (response?.error) throw new ApiError(503, response.error.message || 'database_unavailable');
  return response?.data;
};
const host = 'https://tutahealth.ge';
const request = (path, method, body, origin = host) => new Request(host + path, {
  method,
  headers: { origin, 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function databaseFixture() {
  const texts = new Map();
  let legacy = { id: 'global', published: { ka: { 'home.title': 'შენახული ძველი სათაური' }, en: { 'home.title': 'Legacy published title' } } };
  let unavailable = false;
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.operation = 'select'; this.payload = null; this.columns = '*'; }
    select(columns = '*') { this.columns = columns; return this; }
    order() { return this; }
    eq(key, value) { this.filters.push([key, value]); return this; }
    upsert(payload, options = {}) { this.operation = 'upsert'; this.payload = payload; this.ignoreDuplicates = options.ignoreDuplicates; return this; }
    insert(payload) { this.operation = 'insert'; this.payload = payload; return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    delete() { this.operation = 'delete'; return this; }
    single() { return this.execute(true); }
    maybeSingle() { return this.execute(false); }
    then(resolve, reject) { return this.execute(false).then(resolve, reject); }
    async execute(single = false) {
      if (unavailable && this.table === 'website_texts') return { data: null, error: { message: 'database_unavailable' } };
      if (this.table === 'website_copy') return { data: legacy, error: null };
      const matches = [...texts.values()].filter(row => this.filters.every(([key, value]) => row[key] === value));
      if (this.operation === 'upsert') {
        for (const row of this.payload) if (!this.ignoreDuplicates || !texts.has(row.key)) texts.set(row.key, { updated_at: new Date(0).toISOString(), ...row });
        return { data: this.payload, error: null };
      }
      if (this.operation === 'insert') {
        if (texts.has(this.payload.key)) return { data: null, error: { code: '23505', message: 'duplicate' } };
        const row = { updated_at: new Date(0).toISOString(), ...this.payload };
        texts.set(row.key, row);
        return { data: row, error: null };
      }
      if (this.operation === 'update') {
        const row = matches[0];
        if (!row) return { data: null, error: null };
        const updated = { ...row, ...this.payload };
        texts.set(updated.key, updated);
        return { data: updated, error: null };
      }
      if (this.operation === 'delete') {
        const row = matches[0];
        if (row) texts.delete(row.key);
        return { data: row ? { key: row.key } : null, error: null };
      }
      const selected = matches.map(row => this.columns === '*' ? row : Object.fromEntries(this.columns.split(',').map(key => [key, row[key]])));
      return { data: single ? selected[0] ?? null : selected, error: null };
    }
  }
  const db = { from: table => new Query(table) };
  return { db, texts, set unavailable(value) { unavailable = value; }, set legacy(value) { legacy = value; } };
}

function apiModules(fixture) {
  let allowed = false;
  const requireAdmin = async (_request, ownerOnly, section) => {
    assert.equal(ownerOnly, false);
    assert.equal(section, 'website-copy');
    if (!allowed) throw new ApiError(401, 'Sign in');
    return fixture.db;
  };
  const platform = { ApiError, checked, failure, result, requireAdmin, dbClient: () => fixture.db };
  const admin = sourceModule('app/api/admin/website-texts/route.ts', {
    '@/lib/admin-request': { readAdminJson: async request => request.json() },
    '@/lib/platform-server': platform,
  });
  const site = sourceModule('app/api/site-content/route.ts', { '@/lib/platform-server': platform });
  return { admin, site, authorize: () => { allowed = true; } };
}

const text = (key = 'custom.notice', overrides = {}) => ({
  key, page: '/about', section: 'intro', ka_text: 'ქართული ტექსტი', en_text: 'English copy',
  ka_style: { fontSize: 18, color: '#123ABC' }, en_style: { fontSize: 16, color: '#1E1B2E' }, published: false, ...overrides,
});

test('styles are normalized safely; invalid CSS sizes/colors are rejected and built-in reset is available', () => {
  const { normalizeTextStyle, validateWebsiteText, catalogDefaults, restoreWebsiteTextDefaults } = sourceModule('lib/website-content.ts');
  assert.deepEqual(normalizeTextStyle({ fontSize: 18.24, color: '#abc' }), { fontSize: 18.2, color: '#ABC' });
  for (const bad of [
    { fontSize: 11, color: '#123456' }, { fontSize: 57, color: '#123456' },
    { fontSize: 16, color: 'red' }, { fontSize: 16, color: 'url(javascript:alert(1))' },
    { fontSize: '20px', color: '#123456' },
  ]) assert.equal(normalizeTextStyle(bad), null);
  assert.throws(() => validateWebsiteText(text('custom.notice', { en_style: { fontSize: 99, color: '#FFFFFF' } })), /invalid_style/);
  const defaults = catalogDefaults().find(item => item.key === 'home.title');
  assert.ok(defaults?.ka_text && defaults?.en_text);
  const restored = restoreWebsiteTextDefaults({ ...defaults, ka_text: 'შეცვლილი', en_text: 'Changed', ka_style: { fontSize: 30, color: '#FFFFFF' } });
  assert.equal(restored.ka_text, defaults.ka_text);
  assert.deepEqual(restored.ka_style, { fontSize: 16, color: '#1E1B2E' });
});

test('published content parser preserves only recognized, published legacy copy keys', () => {
  const { catalogWithLegacyPublishedValues, copyFromPublishedRows, copyAndStylesFromRows } = sourceModule('lib/website-content.ts');
  const old = catalogWithLegacyPublishedValues({ ka: { 'home.title': ' ძველი სათაური ', ignored: 'unsafe key' }, en: { 'home.title': 'Old title' } });
  assert.equal(old.find(item => item.key === 'home.title').ka_text, 'ძველი სათაური');
  assert.equal(old.find(item => item.key === 'home.title').en_text, 'Old title');
  const row = { ...text('home.title', { published: true }), updated_at: new Date().toISOString() };
  const publicRows = copyFromPublishedRows([row, { ...row, key: 'home.hidden', published: false }]);
  assert.equal(publicRows.copy.ka['home.title'], 'ქართული ტექსტი');
  assert.equal(publicRows.copy.ka['home.hidden'], undefined);
  const preview = copyAndStylesFromRows([row]);
  assert.equal(preview.styles.ka['home.title'].fontSize, 18);
  assert.equal(preview.styles.ka['home.title'].color, '#123ABC');
  assert.equal(copyFromPublishedRows([{ ...row, ka_style: { fontSize: 200, color: 'red' } }]).styles.ka['home.title'], undefined);
});

test('admin API requires its permission, seeds the catalog from published legacy copy, and creates/edits bilingual text', async () => {
  const fixture = databaseFixture();
  const { admin, authorize } = apiModules(fixture);
  assert.equal((await admin.GET(request('/api/admin/website-texts', 'GET'))).status, 401);
  assert.equal((await admin.POST(request('/api/admin/website-texts', 'POST', text()))).status, 401);
  authorize();
  const loaded = await (await admin.GET(request('/api/admin/website-texts', 'GET'))).json();
  assert.ok(loaded.records.length > 20);
  const homeTitle = loaded.records.find(row => row.key === 'home.title');
  assert.equal(homeTitle.ka_text, 'შენახული ძველი სათაური');
  assert.equal(homeTitle.en_text, 'Legacy published title');
  const createdResponse = await admin.POST(request('/api/admin/website-texts', 'POST', text()));
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).record;
  assert.equal(created.ka_text, 'ქართული ტექსტი');
  assert.equal(created.en_text, 'English copy');
  const duplicate = await admin.POST(request('/api/admin/website-texts', 'POST', text()));
  assert.equal(duplicate.status, 409);
  const editedResponse = await admin.PATCH(request('/api/admin/website-texts', 'PATCH', text('custom.notice', {
    ka_text: 'განახლებული ტექსტი', en_text: 'Updated copy', ka_style: { fontSize: 22, color: '#AABBCC' }, published: true,
  })));
  assert.equal(editedResponse.status, 200);
  const edited = (await editedResponse.json()).record;
  assert.equal(edited.ka_text, 'განახლებული ტექსტი');
  assert.equal(edited.en_text, 'Updated copy');
  assert.deepEqual(edited.ka_style, { fontSize: 22, color: '#AABBCC' });
  assert.equal(edited.published, true);
  const protectedDelete = await admin.DELETE(request('/api/admin/website-texts', 'DELETE', { key: 'home.title' }));
  assert.equal(protectedDelete.status, 409);
  const customDelete = await admin.DELETE(request('/api/admin/website-texts', 'DELETE', { key: 'custom.notice' }));
  assert.equal(customDelete.status, 200);
});

test('public endpoint returns only published structured rows and validated published legacy values', async () => {
  const fixture = databaseFixture();
  fixture.texts.set('published.key', { ...text('published.key', { published: true }), updated_at: new Date().toISOString() });
  fixture.texts.set('draft.key', { ...text('draft.key', { published: false }), updated_at: new Date().toISOString() });
  const { site } = apiModules(fixture);
  const response = await site.GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.records.map(row => row.key), ['published.key']);
  assert.equal(body.legacyCopy.ka['home.title'], 'შენახული ძველი სათაური');
  assert.equal(body.legacyCopy.ka.unknown, undefined);
});

test('database failures are surfaced rather than treated as an empty successful content response', async () => {
  const fixture = databaseFixture();
  fixture.unavailable = true;
  const { site, admin, authorize } = apiModules(fixture);
  const publicResponse = await site.GET();
  assert.equal(publicResponse.status, 503);
  assert.match((await publicResponse.json()).error, /database_unavailable/);
  authorize();
  const adminResponse = await admin.GET(request('/api/admin/website-texts', 'GET'));
  assert.equal(adminResponse.status, 503);
});
