import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalAuthStorage,
  createMemoryAuthStorage,
  normalizeAuthSession,
  purgeLegacyAuthStorage,
} from '../session.js';

function createFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    keys: () => [...data.keys()],
  };
}

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

test('local auth storage round-trips a session through prefixed keys', () => {
  const backing = createFakeStorage();
  const storage = createLocalAuthStorage({ storage: backing });

  storage.write({
    token: 't',
    username: 'u',
    roleList: [{ id: 'admin' }],
    selectedRole: { id: 'admin' },
    selectedOrg: { id: 'org' },
  });

  assert.deepEqual(storage.read(), {
    token: 't',
    username: 'u',
    clientId: null,
    roleList: [{ id: 'admin' }],
    selectedRole: { id: 'admin' },
    selectedOrg: { id: 'org' },
  });
});

test('local auth storage clear removes session keys and both platform keys', () => {
  const backing = createFakeStorage({
    sf_platform_token: 'platform-token',
    sf_platform_auth_method: 'password',
    unrelated_key: 'kept',
  });
  const storage = createLocalAuthStorage({ storage: backing });
  storage.write({ token: 't', username: 'u', roleList: [{ id: 'admin' }] });

  storage.clear();

  assert.equal(backing.getItem('sf_auth_token'), null);
  assert.equal(backing.getItem('sf_auth_user'), null);
  assert.equal(backing.getItem('sf_auth_rolelist'), null);
  assert.equal(backing.getItem('sf_platform_token'), null);
  assert.equal(backing.getItem('sf_platform_auth_method'), null);
  assert.equal(backing.getItem('unrelated_key'), 'kept');
  assert.deepEqual(storage.read(), normalizeAuthSession());
});

test('local auth storage clear is a no-op without a storage backend', () => {
  const storage = createLocalAuthStorage({ storage: null });
  assert.doesNotThrow(() => storage.clear());
  assert.deepEqual(storage.read(), normalizeAuthSession());
});

const LEGACY_AUTH_KEYS = [
  'sf_auth_token',
  'sf_auth_user',
  'sf_auth_client_id',
  'sf_auth_client_name',
  'sf_auth_rolelist',
  'sf_auth_selected_role',
  'sf_auth_selected_org',
  'sf_platform_token',
  'sf_platform_auth_method',
];

test('purgeLegacyAuthStorage removes every legacy key and leaves unrelated keys intact', () => {
  const seed = Object.fromEntries(LEGACY_AUTH_KEYS.map((key) => [key, 'value']));
  const backing = createFakeStorage({ ...seed, unrelated_key: 'kept' });

  purgeLegacyAuthStorage(backing);

  for (const key of LEGACY_AUTH_KEYS) {
    assert.equal(backing.getItem(key), null, `expected ${key} to be purged`);
  }
  assert.equal(backing.getItem('unrelated_key'), 'kept');
});

test('purgeLegacyAuthStorage clears the orphan sf_auth_client_name key', () => {
  // sf_auth_client_name is written by the onboarding flow but the existing
  // clear() never removes it (SESSION_KEYS has no clientName entry) — this
  // new function exists precisely to close that gap.
  const backing = createFakeStorage({ sf_auth_client_name: 'Acme Corp' });

  purgeLegacyAuthStorage(backing);

  assert.equal(backing.getItem('sf_auth_client_name'), null);
});

test('purgeLegacyAuthStorage does not throw when the storage is empty', () => {
  const backing = createFakeStorage();
  assert.doesNotThrow(() => purgeLegacyAuthStorage(backing));
});

test('purgeLegacyAuthStorage is a safe no-op when storage is null', () => {
  assert.doesNotThrow(() => purgeLegacyAuthStorage(null));
});

test('purgeLegacyAuthStorage swallows exceptions thrown mid-purge by removeItem', () => {
  let calls = 0;
  const flakyStorage = {
    removeItem: (key) => {
      calls += 1;
      if (calls === 3) throw new Error('storage unavailable');
    },
  };

  assert.doesNotThrow(() => purgeLegacyAuthStorage(flakyStorage));
});
