import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalAuthStorage, createMemoryAuthStorage, normalizeAuthSession,
  decodeJwtPayload, decodeJwtRole, decodeJwtUser,
} from '../session.js';

/**
 * Builds a JWT-shaped string with a real base64url-encoded payload segment, matching what
 * `decodeJwtPayload` expects to decode (header/signature content is irrelevant to it — only
 * the middle segment is read).
 */
function makeToken(payload, { header = { alg: 'HS256' }, signature = 'sig' } = {}) {
  const encode = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode(header)}.${encode(payload)}.${signature}`;
}

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

// ── ETP-5195 — decodeJwtPayload/decodeJwtRole/decodeJwtUser ─────────────────────────────────
//
// Client-side read of a JWT's payload segment (signature NOT verified — see the functions' own
// doc comments in session.js): lets AuthContext's silent-refresh compare the `role` claim across
// a token swap, and lets a component compare the `user` claim against a record id to detect a
// self-service action.

test('decodeJwtPayload decodes a valid token to its payload object', () => {
  const token = makeToken({ role: 'R1', user: 'U1', exp: 1234 });
  assert.deepEqual(decodeJwtPayload(token), { role: 'R1', user: 'U1', exp: 1234 });
});

test('decodeJwtPayload returns null for a token with no dot at all (not even 2 segments)', () => {
  assert.equal(decodeJwtPayload('not-a-jwt-at-all'), null);
});

test('decodeJwtPayload returns null when the payload segment is not valid base64', () => {
  // '-'/'_' survive the base64url->base64 translation; '!' does not belong in any base64
  // alphabet and makes the decode throw, which must be caught and turned into null.
  assert.equal(decodeJwtPayload('header.!!!not-base64!!!.sig'), null);
});

test('decodeJwtPayload returns null when the decoded payload is not valid JSON', () => {
  const notJson = Buffer.from('this is not json', 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(decodeJwtPayload(`header.${notJson}.sig`), null);
});

test('decodeJwtPayload returns null for non-string input', () => {
  for (const bad of [null, undefined, 42, {}, [], true]) {
    assert.equal(decodeJwtPayload(bad), null);
  }
});

test('decodeJwtPayload tolerates a missing signature segment (only header.payload)', () => {
  // The implementation only requires >= 2 segments, so a token with no trailing signature
  // still decodes — documenting this rather than asserting a stricter contract it doesn't have.
  const encode = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const twoSegmentToken = `${encode({ alg: 'HS256' })}.${encode({ role: 'R1' })}`;
  assert.deepEqual(decodeJwtPayload(twoSegmentToken), { role: 'R1' });
});

test('decodeJwtRole extracts the role claim from a valid token', () => {
  assert.equal(decodeJwtRole(makeToken({ role: 'R42', user: 'U1' })), 'R42');
});

test('decodeJwtRole returns null for an undecodable token', () => {
  assert.equal(decodeJwtRole('garbage'), null);
  assert.equal(decodeJwtRole(null), null);
});

test('decodeJwtRole returns null when the role claim is absent from an otherwise-valid payload', () => {
  assert.equal(decodeJwtRole(makeToken({ user: 'U1' })), null);
});

test('decodeJwtUser extracts the user claim from a valid token', () => {
  assert.equal(decodeJwtUser(makeToken({ role: 'R1', user: 'U99' })), 'U99');
});

test('decodeJwtUser returns null for an undecodable token', () => {
  assert.equal(decodeJwtUser('garbage'), null);
  assert.equal(decodeJwtUser(undefined), null);
});

test('decodeJwtUser returns null when the user claim is absent from an otherwise-valid payload', () => {
  assert.equal(decodeJwtUser(makeToken({ role: 'R1' })), null);
});
