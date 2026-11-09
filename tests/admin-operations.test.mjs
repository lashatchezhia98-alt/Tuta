import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceModule } from './source-loader.mjs';

test('scoped administration cannot cross into billing, settings or anonymous health metrics', () => {
  const { adminSections, adminHome, canAccessAdminSection, isAssignableAdminRole } = sourceModule('lib/admin-sections.ts');
  for (const role of ['content_editor', 'support']) {
    assert.deepEqual(adminSections.filter(section => canAccessAdminSection(role, section)), role === 'support' ? ['users'] : ['content', 'website-copy']);
    assert.equal(adminHome(role), role === 'support' ? '/admin/users' : '/admin/content');
  }
  assert.equal(canAccessAdminSection('admin', 'invitations'), false);
  assert.equal(canAccessAdminSection('owner', 'invitations'), true);
  assert.equal(isAssignableAdminRole('owner'), false);
});
