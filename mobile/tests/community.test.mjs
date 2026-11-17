import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {canEditCommunityPost, communityAuthorInitials, communityPhotoUrl, memberDisplayName, memberInitials, normalizePost, POST_EDIT_WINDOW_MS, POST_TOPICS, postWordCount, validComment, validPost, validTopic} from '../src/community.mjs';

test('ordinary community authors show initials instead of a stored full name or email', () => {
  assert.equal(communityAuthorInitials('ნგ', 'ნინო გიორგაძე'), 'ნგ');
  assert.equal(communityAuthorInitials('?', 'ნინო გიორგაძე'), 'ნ');
  assert.equal(communityAuthorInitials('untrusted full name', 'Member'), '?');
  assert.equal(communityAuthorInitials(undefined, 'member@example.test'), 'm');
  assert.equal(communityAuthorInitials(undefined, 'Anonymous'), '?');
});

test('pull to refresh is scoped to the member feed and replaces pagination', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const feed = readFileSync(new URL('../src/CommunityFeed.tsx', import.meta.url), 'utf8');
  assert.match(app, /canPullToRefresh = tab === "home" && !authMode && !!memberId\s+&& activityTarget\?\.userId !== memberId && pageAllowed/);
  assert.match(app, /refreshControl=\{canPullToRefresh \?/);
  assert.match(app, /await feed\.refresh\(\);\s+\} finally \{\s+refreshRequest\.current = false;\s+setRefreshingMember\(null\)/);
  assert.match(feed, /refresh: \(\) => load\(false, true\)/);
  assert.match(feed, /request === feedRequest\.current/);
  assert.match(feed, /if \(!isCurrent\(\)\) return;[\s\S]*more \? \[\.\.\.current, \.\.\.page\] : page/);
});

test('intimacy choices are collapsed by default with accessible single selection and clearing', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /activityOnly = false/);
  assert.match(app, /\[intimacyOpen, setIntimacyOpen\] = useState\(activityOnly\)/);
  assert.match(app, /accessibilityState=\{\{ expanded: intimacyOpen \}\}/);
  assert.match(app, /intimacyOpen \?[\s\S]*accessibilityRole="radiogroup"[\s\S]*accessibilityRole="radio" accessibilityState=\{\{ checked \}\}/);
  assert.match(app, /onPress=\{\(\) => change\(\{ sexualActivity: undefined \}\)\}/);
});

test('only the author can edit a post during the first 30 minutes', () => {
  const now = Date.parse('2026-11-12T12:30:00.000Z');
  const postedAt = new Date(now - POST_EDIT_WINDOW_MS).toISOString();
  assert.equal(canEditCommunityPost(new Date(now - POST_EDIT_WINDOW_MS + 1).toISOString(), true, now), true);
  assert.equal(canEditCommunityPost(postedAt, true, now), false);
  assert.equal(canEditCommunityPost(new Date(now - 1000).toISOString(), false, now), false);
  assert.equal(canEditCommunityPost('not-a-date', true, now), false);
  assert.equal(canEditCommunityPost(new Date(now + 1000).toISOString(), true, now), false);
});

test('Georgian and English words share the 200-word limit', () => {
  assert.equal(postWordCount('  გამარჯობა\n world  '), 2);
  assert.equal(validPost(Array(200).fill('სიტყვა').join(' ')), true);
  assert.equal(validPost(Array(201).fill('word').join(' ')), false);
  assert.equal(validPost('   '), false);
  assert.equal(validPost('a'.repeat(2001)), false);
  assert.equal(normalizePost('  hello  '), 'hello');
});

test('photo URLs are limited to Tuta Cloudinary IDs', () => {
  const id='123e4567-e89b-12d3-a456-426614174000';
  assert.equal(communityPhotoUrl('tuta',`tuta-community/${id}/photo_1`),`https://res.cloudinary.com/tuta/image/upload/f_auto,q_auto,w_1200/tuta-community/${id}/photo_1`);
  assert.equal(communityPhotoUrl('tuta','tuta-community/anon/photo_1'),'https://res.cloudinary.com/tuta/image/upload/f_auto,q_auto,w_1200/tuta-community/anon/photo_1');
  assert.equal(communityPhotoUrl('tuta','https://evil.test/photo'),null);
  assert.equal(communityPhotoUrl('../evil',`tuta-community/${id}/photo`),null);
});

test('public labels show a nickname or first name, never an email', () => {
  assert.equal(memberDisplayName({nickname:'ნინო',first_name:'მარია',email:'private@example.com'}),'ნინო');
  assert.equal(memberDisplayName({first_name:'მარია',email:'private@example.com'}),'მარია');
  assert.equal(memberDisplayName({email:'private@example.com'}),'Member');
  assert.equal(memberInitials({first_name:'მარიამ',last_name:'ბერიძე'}),'მბ');
  assert.equal(memberInitials({nickname:'ნინო'}),'ნ');
  assert.equal(memberInitials({}), '?');
});

test('post topics are fixed and comments have a bounded length', () => {
  assert.equal(POST_TOPICS.length,6);
  assert.equal(validTopic('cycle'),true);
  assert.equal(validTopic('other'),false);
  assert.equal(validComment(' გამარჯობა '),true);
  assert.equal(validComment('  '),false);
  assert.equal(validComment('x'.repeat(1001)),false);
});
