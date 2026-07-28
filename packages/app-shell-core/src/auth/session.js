const DEFAULT_PREFIX = 'sf_auth';

const SESSION_KEYS = {
  token: 'token',
  username: 'user',
  clientId: 'client_id',
  roleList: 'rolelist',
  selectedRole: 'selected_role',
  selectedOrg: 'selected_org',
};

const JSON_KEYS = new Set(['roleList', 'selectedRole', 'selectedOrg']);

// Full set of pre-cookie-session localStorage keys, including sf_auth_client_name
// (written by onboarding but never covered by clear(), since SESSION_KEYS has no
// clientName entry) — ETP-4576 purges these once on migration to the __Host- cookie.
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

function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage || null;
}

function storageKey(prefix, key) {
  return `${prefix}_${SESSION_KEYS[key]}`;
}

function readJson(storage, key) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeValue(storage, key, value, json = false) {
  if (!storage) return;
  if (value === undefined || value === null || value === '') {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, json ? JSON.stringify(value) : String(value));
}

export function purgeLegacyAuthStorage(storage = getBrowserStorage()) {
  try {
    for (const key of LEGACY_AUTH_KEYS) {
      storage?.removeItem(key);
    }
  } catch {
    // ignore — storage access can throw (e.g. disabled in some privacy modes);
    // never let a purge failure block logout/session restore.
  }
}

export function normalizeAuthSession(session = {}) {
  return {
    token: session.token || null,
    username: session.username || null,
    clientId: session.clientId || null,
    roleList: Array.isArray(session.roleList) ? session.roleList : [],
    selectedRole: session.selectedRole || null,
    selectedOrg: session.selectedOrg || null,
  };
}

export function createMemoryAuthStorage(initialSession = {}) {
  let session = normalizeAuthSession(initialSession);

  return {
    read() {
      return session;
    },
    write(nextSession) {
      session = normalizeAuthSession(nextSession);
    },
    clear() {
      session = normalizeAuthSession();
    },
  };
}

export function createLocalAuthStorage({ prefix = DEFAULT_PREFIX, storage = getBrowserStorage() } = {}) {
  return {
    read() {
      return normalizeAuthSession({
        token: storage?.getItem(storageKey(prefix, 'token')),
        username: storage?.getItem(storageKey(prefix, 'username')),
        clientId: storage?.getItem(storageKey(prefix, 'clientId')),
        roleList: readJson(storage, storageKey(prefix, 'roleList')),
        selectedRole: readJson(storage, storageKey(prefix, 'selectedRole')),
        selectedOrg: readJson(storage, storageKey(prefix, 'selectedOrg')),
      });
    },
    write(session) {
      const normalized = normalizeAuthSession(session);
      for (const key of Object.keys(SESSION_KEYS)) {
        writeValue(storage, storageKey(prefix, key), normalized[key], JSON_KEYS.has(key));
      }
    },
    clear() {
      if (!storage) return;
      for (const key of Object.keys(SESSION_KEYS)) {
        storage.removeItem(storageKey(prefix, key));
      }
      storage.removeItem('sf_platform_token');
      storage.removeItem('sf_platform_auth_method');
    },
  };
}
