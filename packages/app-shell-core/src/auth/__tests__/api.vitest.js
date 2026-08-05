import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCookieSession, deleteCookieSession } from '../api.js';

// ETP-4576 cycle 4a — behavioral coverage for the session fetcher that moves
// into the platform (app-shell-core) and becomes AuthProvider's DEFAULT
// `restoreSession`.
//
// Why a Vitest file and not the sibling `api.test.js`: that one runs under plain
// `node --test`, where `api.js` cannot even be imported (it touches `window` and
// `import.meta.env` at module scope), so it is limited to source-reading
// assertions. Vitest gives us jsdom + the Vite transform, so the real function
// can be called and its REQUEST inspected — which is the part that matters for
// security (credentials: 'include', no Authorization/Bearer) and the part
// source-reading can only approximate. `api.vitest.js` is picked up by this
// package's vitest.config.js (`src/**/*.vitest.{js,jsx}`) and deliberately not
// by the `node --test` glob (`src/auth/__tests__/*.test.js`), so it runs exactly
// once. The complementary structural assertions stay in `api.test.js`, which is
// the suite `npm test` runs.
const SESSION_PATH = '/sws/go/session';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

let fetchStub;

beforeEach(() => {
  fetchStub = vi.fn();
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCookieSession — GET /sws/go/session on the session cookie alone (ETP-4576)', () => {
  it('is exported as a function', () => {
    expect(typeof fetchCookieSession).toBe('function');
  });

  it('requests the session endpoint on the given base URL', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await fetchCookieSession('/etendo');

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(String(fetchStub.mock.calls[0][0])).toBe(`/etendo${SESSION_PATH}`);
  });

  it('falls back to the module default base URL when called with no argument', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await fetchCookieSession();

    // detectBaseUrl() resolves to '' under jsdom (no '/web/' segment in the
    // pathname); assert on the suffix so a configured VITE_API_BASE cannot make
    // this brittle.
    expect(String(fetchStub.mock.calls[0][0])).toMatch(/\/sws\/go\/session$/);
  });

  it('sends the request with credentials: "include" so the __Host- cookie travels', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await fetchCookieSession('');

    const [, init] = fetchStub.mock.calls[0];
    expect(init.credentials).toBe('include');
  });

  it('uses the GET method', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await fetchCookieSession('');

    const [, init] = fetchStub.mock.calls[0];
    expect((init.method || 'GET').toUpperCase()).toBe('GET');
  });

  it('never sends an Authorization header or a Bearer scheme (the security point of ETP-4576)', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await fetchCookieSession('');

    const [, init] = fetchStub.mock.calls[0];
    const serialized = JSON.stringify(init ?? {});
    expect(serialized).not.toMatch(/Authorization/i);
    expect(serialized).not.toMatch(/Bearer/i);
  });

  it('returns the parsed JSON payload when the response is ok', async () => {
    const payload = {
      account: { name: 'Ada' },
      environment: { clientId: 'client-1', roleId: 'role-1', orgId: 'org-1' },
      roleList: [{ id: 'role-1', name: 'Admin' }],
      csrfToken: 'csrf-abc',
    };
    fetchStub.mockResolvedValue(jsonResponse(payload));

    await expect(fetchCookieSession('')).resolves.toEqual(payload);
  });

  it('fails closed with null on a 401 — the ordinary "no active session" answer', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ error: 'unauthorized' }, { ok: false, status: 401 }));

    await expect(fetchCookieSession('')).resolves.toBeNull();
  });

  it('fails closed with null on any other non-ok status (5xx, 403, ...)', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ error: 'boom' }, { ok: false, status: 500 }));

    await expect(fetchCookieSession('')).resolves.toBeNull();
  });

  it('fails closed with null when fetch itself rejects (offline / DNS / CORS)', async () => {
    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchCookieSession('')).resolves.toBeNull();
  });

  it('fails closed with null when the body is not parseable JSON', async () => {
    fetchStub.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    });

    await expect(fetchCookieSession('')).resolves.toBeNull();
  });

  it('never throws — the caller (AuthProvider mount effect) must not need a try/catch', async () => {
    fetchStub.mockRejectedValue(new Error('anything at all'));

    let thrown = null;
    try {
      await fetchCookieSession('');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeNull();
  });
});

// ETP-4576 — server-side logout. The counterpart of fetchCookieSession: the
// session lives in an httpOnly `__Host-` cookie, so clearing client state is NOT
// a logout any more — the cookie survives and the session stays valid on the
// server. DELETE /sws/go/session is the endpoint that revokes it server-side and
// expires the cookies (ETP-4575 built it; ADR-0001 describes it as "invalidates
// it server-side"), and until this cycle NOTHING in the frontend called it.
//
// Two request properties are non-negotiable:
//   - `credentials: 'include'`, because the cookie IS the credential; and
//   - `X-Go-CSRF`, because DELETE is an unsafe method and the backend rejects it
//     with 403 without the session-bound proof (same guarded pattern
//     `createApiFetch` already uses: only set when the token is truthy).
//
// And one behavioral property: it must NEVER throw or reject. Local logout is
// fire-and-forget on top of this call, so a network blip, a 403 or a 500 cannot
// be allowed to trap the user inside a session they asked to close.
describe('deleteCookieSession — DELETE /sws/go/session with the CSRF proof (ETP-4576)', () => {
  it('is exported as a function', () => {
    expect(typeof deleteCookieSession).toBe('function');
  });

  it('sends a DELETE to the session endpoint on the given base URL', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await deleteCookieSession('csrf-abc', '/etendo');

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init = {}] = fetchStub.mock.calls[0];
    expect(String(url)).toBe(`/etendo${SESSION_PATH}`);
    expect((init.method || '').toUpperCase()).toBe('DELETE');
  });

  it('falls back to the module default base URL when no base URL is given', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await deleteCookieSession('csrf-abc');

    expect(String(fetchStub.mock.calls[0][0])).toMatch(/\/sws\/go\/session$/);
  });

  it('sends the request with credentials: "include" so the __Host- cookie travels', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await deleteCookieSession('csrf-abc', '');

    const [, init] = fetchStub.mock.calls[0];
    expect(init.credentials).toBe('include');
  });

  it('sends the X-Go-CSRF header with the given token — the backend rejects an unsafe method without it', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await deleteCookieSession('csrf-abc', '');

    const [, init] = fetchStub.mock.calls[0];
    expect(init.headers?.['X-Go-CSRF']).toBe('csrf-abc');
  });

  it('omits the X-Go-CSRF header (and does not throw) when the token is null', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await expect(deleteCookieSession(null, '')).resolves.toBeDefined();

    const [, init = {}] = fetchStub.mock.calls[0];
    expect(init.headers ?? {}).not.toHaveProperty('X-Go-CSRF');
  });

  it('omits the X-Go-CSRF header (and does not throw) when the token is undefined', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await expect(deleteCookieSession(undefined, '')).resolves.toBeDefined();

    const [, init = {}] = fetchStub.mock.calls[0];
    expect(init.headers ?? {}).not.toHaveProperty('X-Go-CSRF');
  });

  it('never sends an Authorization header or a Bearer scheme (the security point of ETP-4576)', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));

    await deleteCookieSession('csrf-abc', '');

    const [, init] = fetchStub.mock.calls[0];
    const serialized = JSON.stringify(init ?? {});
    expect(serialized).not.toMatch(/Authorization/i);
    expect(serialized).not.toMatch(/Bearer/i);
  });

  it('resolves (never rejects) when fetch itself rejects — offline logout must still proceed locally', async () => {
    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(deleteCookieSession('csrf-abc', '')).resolves.toBeDefined();
  });

  it('resolves (never rejects) on a 4xx — e.g. a rejected/expired CSRF proof', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ error: 'forbidden' }, { ok: false, status: 403 }));

    await expect(deleteCookieSession('csrf-abc', '')).resolves.toBeDefined();
  });

  it('resolves (never rejects) on a 5xx', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ error: 'boom' }, { ok: false, status: 500 }));

    await expect(deleteCookieSession('csrf-abc', '')).resolves.toBeDefined();
  });

  it('reports whether the server confirmed the revocation, without ever throwing', async () => {
    fetchStub.mockResolvedValue(jsonResponse({ status: 'success' }));
    await expect(deleteCookieSession('csrf-abc', '')).resolves.toBe(true);

    fetchStub.mockResolvedValue(jsonResponse({ error: 'boom' }, { ok: false, status: 500 }));
    await expect(deleteCookieSession('csrf-abc', '')).resolves.toBe(false);

    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(deleteCookieSession('csrf-abc', '')).resolves.toBe(false);
  });

  it('never throws synchronously either — the caller does not wrap it in a try/catch', () => {
    fetchStub.mockImplementation(() => {
      throw new TypeError('synchronous fetch explosion');
    });

    let thrown = null;
    let returned;
    try {
      returned = deleteCookieSession('csrf-abc', '');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeNull();
    return expect(returned).resolves.toBe(false);
  });
});
