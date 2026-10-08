// @covers packages/app-shell-core/src/auth/api.js
// ETP-5489 — a 401 from a data endpoint only logs the user out when GET /sws/go/session agrees.
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiFetch, createApiFetch, isSessionAliveUnauthorized, registerApiSession, resetApiSessionForTests,
} from '../api.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiSessionForTests();
});

const SESSION_URL = '/sws/go/session';
const res = (status, body = {}) => ({
  status, ok: status >= 200 && status < 300, json: async () => body,
  headers: new Headers({ 'content-type': 'application/json' }),
  clone() { return this; },
});

/** NEO answers 401; the session endpoint answers `session` (a response, or a function that throws). */
function stubServer(session) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith(SESSION_URL)) {
      return typeof session === 'function' ? session() : session;
    }
    return res(401);
  };
  return calls;
}
const probes = (calls) => calls.filter((url) => url.endsWith(SESSION_URL)).length;

describe('401 classification against the session endpoint (ETP-5489)', () => {
  it('exports the guard from the auth barrel', () => {
    // The barrel pulls in JSX that node:test cannot load, so read it as text.
    const barrel = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.js'), 'utf8');
    assert.match(barrel, /isSessionAliveUnauthorized/);
  });

  it('a 401 with the session alive throws the typed error and does not log out', async () => {
    const calls = stubServer(res(200, { user: 'u' }));
    let logouts = 0;
    const request = createApiFetch('', () => null, () => { logouts += 1; });
    const error = await request('/neo/x').catch((e) => e);
    assert.equal(isSessionAliveUnauthorized(error), true);
    assert.equal(error.status, 401);
    assert.equal(error.code, 'session_alive_unauthorized');
    assert.equal(logouts, 0);
    assert.equal(probes(calls), 1);
  });

  it('a 401 with the session gone logs out and throws Unauthorized', async () => {
    stubServer(res(401));
    let logouts = 0;
    const request = createApiFetch('', () => null, () => { logouts += 1; });
    await assert.rejects(() => request('/neo/x'), /^Error: Unauthorized$/);
    assert.equal(logouts, 1);
  });

  for (const [name, answer] of [
    ['a 5xx', () => res(503)],
    ['another 4xx', () => res(403)],
    ['a network failure', () => { throw new TypeError('Failed to fetch'); }],
    ['a body that is not JSON', () => ({ ...res(200), json: async () => { throw new SyntaxError('x'); } })],
  ]) {
    it(`${name} from the probe does not log out`, async () => {
      stubServer(answer);
      let logouts = 0;
      const error = await createApiFetch('', () => null, () => { logouts += 1; })('/neo/x').catch((e) => e);
      assert.equal(isSessionAliveUnauthorized(error), true);
      assert.equal(error.sessionState, 'unknown');
      assert.equal(logouts, 0);
    });
  }

  it('N parallel 401s share one probe and log out once', async () => {
    const calls = stubServer(res(401));
    let logouts = 0;
    const request = createApiFetch('', () => null, () => { logouts += 1; });
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => request(`/neo/x${n}`)));
    assert.equal(results.every((r) => r.status === 'rejected'), true);
    assert.equal(probes(calls), 1);
    assert.equal(logouts, 1);
  });

  it('the ambient client behaves the same', async () => {
    stubServer(res(200, {}));
    let logouts = 0;
    registerApiSession({ getToken: () => null, onUnauthorized: () => { logouts += 1; }, baseUrl: '' });
    const error = await apiFetch('/neo/x').catch((e) => e);
    assert.equal(isSessionAliveUnauthorized(error), true);
    assert.equal(logouts, 0);
  });

  it('on401: ignore still hands the response back without probing', async () => {
    const calls = stubServer(res(200));
    const response = await createApiFetch('', () => null, () => {})('/neo/x', { on401: 'ignore' });
    assert.equal(response.status, 401);
    assert.equal(probes(calls), 0);
  });

  it('a bearer client whose probe also 401s keeps today\'s behaviour: logout', async () => {
    stubServer(res(401));
    let logouts = 0;
    await assert.rejects(
      () => createApiFetch('', () => 'tok', () => { logouts += 1; })('/neo/x'),
      /Unauthorized/,
    );
    assert.equal(logouts, 1);
  });

  it('a later 401 probes again: the answer is not cached past its flight', async () => {
    const calls = stubServer(res(200));
    const request = createApiFetch('', () => null, () => {});
    await request('/neo/a').catch(() => {});
    await request('/neo/b').catch(() => {});
    assert.equal(probes(calls), 2);
  });
});
