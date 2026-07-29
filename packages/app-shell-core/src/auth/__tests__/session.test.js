import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalAuthStorage,
  createMemoryAuthStorage,
  mapRestoredSession,
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

// ETP-4576 cycle 15 — mapRestoredSession maps the GET /sws/go/session payload
// (EtendoGoJwtServlet#handleSessionRestore) onto the `session` shape the
// AuthContext consumers expect. The backend's `environment` block only carries
// IDs, while the UI needs the full role/org OBJECTS (it renders `.name`), so the
// mapper cross-references environment.roleId/orgId against the returned
// `roleList` / `selectedRole.orgList`. Every field falls back to null/[] rather
// than throwing: a session can legitimately exist with `environment: null`
// (logged in, no environment entered yet), and a defensive mapper keeps a
// partial/unexpected payload from bringing down the whole app boot.
test('mapRestoredSession derives the full role and org objects from the environment IDs', () => {
  const org = { id: 'org-1', name: 'Main Org', extra: 'kept' };
  const role = { id: 'role-1', name: 'Admin', orgList: [{ id: 'org-other', name: 'Other Org' }, org] };

  const mapped = mapRestoredSession({
    status: 'success',
    account: { name: 'Ada Lovelace', email: 'ada@example.com' },
    environment: {
      userId: 'user-1',
      roleId: 'role-1',
      clientId: 'client-1',
      orgId: 'org-1',
      warehouseId: 'wh-1',
    },
    roleList: [{ id: 'role-0', name: 'Other Role', orgList: [] }, role],
    csrfToken: 'csrf-abc',
  });

  assert.equal(mapped.username, 'Ada Lovelace');
  assert.equal(mapped.clientId, 'client-1');
  assert.deepEqual(mapped.roleList, [{ id: 'role-0', name: 'Other Role', orgList: [] }, role]);
  // The full objects, not the IDs — the UI renders selectedRole.name /
  // selectedOrg.name (host UserAvatarButton) and DataProvider scopes the cache
  // by them.
  assert.deepEqual(mapped.selectedRole, role);
  assert.equal(mapped.selectedRole.name, 'Admin');
  assert.deepEqual(mapped.selectedOrg, org);
  assert.equal(mapped.selectedOrg.name, 'Main Org');
});

test('mapRestoredSession falls back to the account email when the account has no name', () => {
  const mapped = mapRestoredSession({
    account: { email: 'ada@example.com' },
    environment: null,
  });

  assert.equal(mapped.username, 'ada@example.com');
});

test('mapRestoredSession yields a null username when the account is missing', () => {
  assert.equal(mapRestoredSession({ environment: null }).username, null);
  assert.equal(mapRestoredSession({ account: null, environment: null }).username, null);
});

test('mapRestoredSession keeps the roleList but nulls the environment-derived fields when environment is null', () => {
  // Real backend case: the session exists (user is logged in) but no
  // environment has been entered yet, so there is no client/role/org selection
  // to map — the available roles still have to reach the role picker.
  const roleList = [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }];

  const mapped = mapRestoredSession({
    status: 'success',
    account: { name: 'Ada' },
    environment: null,
    roleList,
    csrfToken: 'csrf-abc',
  });

  assert.equal(mapped.username, 'Ada');
  assert.equal(mapped.clientId, null);
  assert.equal(mapped.selectedRole, null);
  assert.equal(mapped.selectedOrg, null);
  assert.deepEqual(mapped.roleList, roleList);
});

test('mapRestoredSession normalizes a missing or non-array roleList to an empty array', () => {
  assert.deepEqual(mapRestoredSession({ account: { name: 'Ada' } }).roleList, []);
  assert.deepEqual(mapRestoredSession({ roleList: null }).roleList, []);
  assert.deepEqual(mapRestoredSession({ roleList: 'not-an-array' }).roleList, []);
  assert.deepEqual(mapRestoredSession({ roleList: { id: 'role-1' } }).roleList, []);
  assert.doesNotThrow(() => mapRestoredSession({}));
});

test('mapRestoredSession returns a null selectedRole when the environment roleId is not in the roleList', () => {
  const mapped = mapRestoredSession({
    account: { name: 'Ada' },
    environment: { roleId: 'role-missing', clientId: 'client-1', orgId: 'org-1' },
    roleList: [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }],
  });

  assert.equal(mapped.selectedRole, null);
  // No role means no orgList to search — selectedOrg has to fall through to null.
  assert.equal(mapped.selectedOrg, null);
  // The rest of the mapping still holds.
  assert.equal(mapped.clientId, 'client-1');
  assert.equal(mapped.roleList.length, 1);
});

test('mapRestoredSession returns a null selectedOrg when the matched role has no orgList', () => {
  const role = { id: 'role-1', name: 'Admin' };

  const mapped = mapRestoredSession({
    environment: { roleId: 'role-1', orgId: 'org-1' },
    roleList: [role],
  });

  assert.deepEqual(mapped.selectedRole, role);
  assert.equal(mapped.selectedOrg, null);
});

test('mapRestoredSession returns a null selectedOrg when the environment orgId is not in the role orgList', () => {
  const role = { id: 'role-1', name: 'Admin', orgList: [{ id: 'org-other', name: 'Other Org' }] };

  const mapped = mapRestoredSession({
    environment: { roleId: 'role-1', orgId: 'org-missing' },
    roleList: [role],
  });

  assert.deepEqual(mapped.selectedRole, role);
  assert.equal(mapped.selectedOrg, null);
});

test('mapRestoredSession resolves the role but leaves selectedOrg null when the environment carries no orgId', () => {
  const role = { id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] };

  const mapped = mapRestoredSession({
    environment: { roleId: 'role-1', clientId: 'client-1' },
    roleList: [role],
  });

  assert.deepEqual(mapped.selectedRole, role);
  assert.equal(mapped.selectedOrg, null);
});

test('mapRestoredSession never produces a token — the restored session lives in the __Host- cookie', () => {
  const payloads = [
    {
      account: { name: 'Ada' },
      environment: { roleId: 'role-1', clientId: 'client-1', orgId: 'org-1' },
      roleList: [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }],
      csrfToken: 'csrf-abc',
    },
    { account: { name: 'Ada' }, environment: null, roleList: [] },
    {},
  ];

  for (const payload of payloads) {
    const mapped = mapRestoredSession(payload);
    assert.ok(!mapped.token, 'mapRestoredSession must never carry a client-side token');
    // Nor should the CSRF proof (memory-only, never part of `session`) leak in
    // through the token slot.
    assert.ok(!JSON.stringify(mapped).includes('csrf-abc'));
  }
});
