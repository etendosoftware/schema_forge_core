import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAuthStorage, normalizeAuthSession } from '../session.js';

test('normalizeAuthSession exposes the standalone auth contract shape', () => {
  assert.deepEqual(normalizeAuthSession({ token: 't', username: 'u' }), {
    token: 't',
    username: 'u',
    clientId: null,
    roleList: [],
    selectedRole: null,
    selectedOrg: null,
  });
});

test('memory auth storage supports SDK consumers without browser localStorage', () => {
  const storage = createMemoryAuthStorage({ token: 'initial' });
  assert.equal(storage.read().token, 'initial');

  storage.write({ token: 'next', roleList: [{ id: 'admin' }] });
  assert.deepEqual(storage.read(), {
    token: 'next',
    username: null,
    clientId: null,
    roleList: [{ id: 'admin' }],
    selectedRole: null,
    selectedOrg: null,
  });

  storage.clear();
  assert.equal(storage.read().token, null);
});
