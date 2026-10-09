// @covers packages/app-shell-core/src/auth/api.js
// ETP-5489 — a 401 from a data endpoint only logs the user out when GET /sws/go/session agrees.
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiFetch, createApiFetch, isSessionAliveUnauthorized, registerApiSession, resetApiSessionForTests,
} from '../api.js';
import { createSessionController } from '../sessionController.js';
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

  it('each distinct logout handler fires once for the same probe', async () => {
    const calls = stubServer(res(401));
    let a = 0;
    let b = 0;
    const one = createApiFetch('', () => null, () => { a += 1; });
    const two = createApiFetch('', () => null, () => { b += 1; });
    await Promise.allSettled([one('/neo/1'), one('/neo/2'), two('/neo/3'), two('/neo/4')]);
    assert.equal(probes(calls), 1);
    assert.deepEqual([a, b], [1, 1]);
  });

  it('a session replaced while the probe is in flight is not logged out by the old 401', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    globalThis.fetch = async (url) => {
      if (String(url).endsWith(SESSION_URL)) { await gate; return res(401); }
      return res(401);
    };
    let token = 'old';
    let logouts = 0;
    const pending = createApiFetch('', () => token, () => { logouts += 1; })('/neo/x').catch((e) => e);
    await new Promise((resolve) => setTimeout(resolve, 0));
    token = 'new';
    release();
    assert.equal((await pending).name, 'AbortError');
    assert.equal(logouts, 0);
  });

  for (const boundary of ['registration', 'generation']) {
    it(`a new ${boundary} does not consume the previous session's pending probe`, async () => {
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      let probeCount = 0;
      globalThis.fetch = async (url) => {
        if (!String(url).endsWith(SESSION_URL)) return res(401);
        probeCount += 1;
        if (probeCount === 1) { await gate; return res(401); }
        return res(200, { account: { id: 'b' } });
      };
      let logouts = 0;
      const scope = createSessionController({ clientId: 'a' });
      const session = { getToken: () => null, onUnauthorized: () => { logouts += 1; }, baseUrl: '', scope };
      registerApiSession(session);
      const a = apiFetch('/neo/a').catch((error) => error);
      await new Promise(setImmediate);
      if (boundary === 'registration') registerApiSession(session);
      else scope.replace({ clientId: 'b' });
      const b = apiFetch('/neo/b').catch((error) => error);
      await new Promise(setImmediate);
      release();
      const [oldError, currentError] = await Promise.all([a, b]);
      assert.equal(probeCount, 2);
      assert.equal(oldError.name, 'AbortError');
      assert.equal(isSessionAliveUnauthorized(currentError), true);
      assert.equal(logouts, 0);
    });
  }

  it('deduplicates logout across settled probes until the generation changes', async () => {
    const calls = stubServer(res(401));
    let logouts = 0;
    const scope = createSessionController({ clientId: 'a' });
    registerApiSession({ getToken: () => null, onUnauthorized: () => { logouts += 1; }, baseUrl: '', scope });
    await apiFetch('/neo/first').catch(() => {});
    await apiFetch('/neo/second').catch(() => {});
    assert.equal(probes(calls), 2);
    assert.equal(logouts, 1);
    scope.invalidate();
    await apiFetch('/neo/new-generation').catch(() => {});
    assert.equal(logouts, 2);
  });

  it('a silent bearer rotation shares the probe within the same identity', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let probeCount = 0;
    globalThis.fetch = async (url) => {
      if (!String(url).endsWith(SESSION_URL)) return res(401);
      probeCount += 1;
      await gate;
      return res(200);
    };
    const scope = createSessionController({ token: 'old', clientId: 'a' });
    let logouts = 0;
    registerApiSession({
      getToken: () => scope.getSnapshot().session.token,
      onUnauthorized: () => { logouts += 1; }, baseUrl: '', scope,
    });
    const a = apiFetch('/neo/a').catch((error) => error);
    await new Promise(setImmediate);
    scope.replace({ token: 'new', clientId: 'a' }, { bump: false });
    const b = apiFetch('/neo/b').catch((error) => error);
    await new Promise(setImmediate);
    release();
    const errors = await Promise.all([a, b]);
    assert.equal(probeCount, 1);
    assert.equal(errors.every(isSessionAliveUnauthorized), true);
    assert.equal(logouts, 0);
  });

  it('the probe is cookie-only: it never carries an Authorization header', async () => {
    const seen = [];
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith(SESSION_URL)) seen.push(options);
      return res(String(url).endsWith(SESSION_URL) ? 200 : 401);
    };
    await createApiFetch('', () => 'tok', () => {})('/neo/x').catch(() => {});
    assert.equal(seen.length, 1);
    assert.equal(seen[0].credentials, 'include');
    assert.equal(seen[0].headers?.Authorization, undefined);
  });

  it('a 402 still passes through untouched, with no probe', async () => {
    const calls = stubServer(res(200));
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return res(402, { message: 'Environment access is not available: BLOCKED' });
    };
    const response = await createApiFetch('', () => null, () => {})('/neo/x');
    assert.equal(response.status, 402);
    assert.equal(probes(calls), 0);
  });
});
