import assert from 'node:assert/strict';
import test from 'node:test';
import {communityPhotoUrl, memberDisplayName, normalizePost, POST_TOPICS, postWordCount, validComment, validPost, validTopic} from '../src/community.mjs';

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
});

test('post topics are fixed and comments have a bounded length', () => {
  assert.equal(POST_TOPICS.length,6);
  assert.equal(validTopic('cycle'),true);
  assert.equal(validTopic('other'),false);
  assert.equal(validComment(' გამარჯობა '),true);
  assert.equal(validComment('  '),false);
  assert.equal(validComment('x'.repeat(1001)),false);
});
