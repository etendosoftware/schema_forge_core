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

/**
 * Decodes a JWT's payload (middle segment) into a plain object, or `null` when the token is
 * missing, malformed, or not valid JSON. Signature is NOT verified — this is a client-side
 * read of a token the server already issued to this caller, purely to compare embedded claims
 * (e.g. the `role` claim minted by `SecureWebServicesUtils.generateToken`, see
 * `SFRefreshToken.java` in com.etendoerp.go); it is never used as an authorization decision.
 *
 * No existing JWT-decode helper was found anywhere in this package (ETP-5195) — this is new
 * shared surface, kept intentionally minimal (base64url -> UTF-8 -> JSON, no library).
 */
export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary');
    const utf8Json = decodeURIComponent(
      Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    return JSON.parse(utf8Json);
  } catch {
    return null;
  }
}

/**
 * The `role` claim embedded in a NEO bearer JWT (the AD_Role id the token authenticates as),
 * or `null` when the token cannot be decoded. See {@link decodeJwtPayload}.
 */
export function decodeJwtRole(token) {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload === 'object' ? payload.role ?? null : null;
}

/**
 * The `user` claim embedded in a NEO bearer JWT (the AD_User_ID the token was issued for), or
 * `null` when the token cannot be decoded. See {@link decodeJwtPayload}.
 *
 * ETP-5195 — added so a component can compare "is the record I'm acting on the CURRENT
 * LOGGED-IN VIEWER" (e.g. the User window's self-promote/demote-admin case) without a
 * dedicated endpoint, the same way `decodeJwtRole` already lets `AuthContext` compare roles
 * across a silent refresh.
 */
export function decodeJwtUser(token) {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload === 'object' ? payload.user ?? null : null;
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
