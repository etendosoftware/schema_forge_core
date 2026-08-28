import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createApiFetch, apiFetch, resolveApiUrl, registerApiSession, resetApiSessionForTests,
} from '../api.js';
import {
  rememberRecordVersion, getRecordVersion, resetRecordVersionsForTests,
} from '../../lib/recordVersions.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The checks below that read the source predate ETP-5022, when api.js still touched
// `window` at module scope and could not be imported here at all. It is importable now
// (browser-only code is guarded and the base URL is resolved lazily), so the behaviour
// added since is covered by real assertions further down instead of by regex.
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'api.js'), 'utf8');

describe('authHeaders', () => {
  // ETP-5022: the canonical READ-request header builder. Selectors that hand-rolled
  // `{ Authorization: Bearer <token> }` omitted Accept-Language, so the backend
  // silently fell back to the user's AD language and returned reference data
  // (countries, UoMs) in English while the UI was in Spanish.
  it('is exported as a named function', () => {
    assert.match(src, /export function authHeaders/);
  });

  it('sets Accept-Language from getStoredLocale so the backend honors the UI locale', () => {
    const body = src.slice(src.indexOf('export function authHeaders'));
    const fn = body.slice(0, body.indexOf('\n}'));
    assert.match(fn, /'Accept-Language': getStoredLocale\(\)/);
  });

  it('omits Content-Type — a GET has no body, so declaring one is wrong', () => {
    const body = src.slice(src.indexOf('export function authHeaders'));
    const fn = body.slice(0, body.indexOf('\n}'));
    assert.doesNotMatch(fn, /Content-Type/);
  });

  it('sets Authorization with a Bearer prefix only when a token is given', () => {
    const body = src.slice(src.indexOf('export function authHeaders'));
    const fn = body.slice(0, body.indexOf('\n}'));
    assert.match(fn, /if \(token\)/);
    assert.match(fn, /Authorization.*Bearer/s);
  });
});

describe('buildHeaders', () => {
  it('is exported as a named function', () => {
    assert.match(src, /export function buildHeaders/);
  });

  it('sets Authorization header with Bearer prefix when token is provided', () => {
    assert.match(src, /Authorization.*Bearer.*token/s);
  });

  it('sets Content-Type to application/json', () => {
    assert.match(src, /Content-Type.*application\/json/);
  });

  it('sets Accept-Language header using getStoredLocale for backend i18n', () => {
    assert.match(src, /Accept-Language/);
    assert.match(src, /getStoredLocale/);
  });
});

describe('isTokenExpired', () => {
  it('is exported as a named function', () => {
    assert.match(src, /export function isTokenExpired/);
  });

  it('returns truthy for falsy token values', () => {
    assert.match(src, /!token/);
  });
});

describe('createApiFetch — FormData handling', () => {
  it('deletes Content-Type when body is FormData so the browser sets the multipart boundary', () => {
    assert.match(src, /instanceof FormData[\s\S]*?delete headers\[.Content-Type.\]/);
  });
});

describe('detectBaseUrl', () => {
  it('is exported and reads window.location.pathname', () => {
    assert.match(src, /export function detectBaseUrl/);
    assert.match(src, /window\.location\.pathname/);
  });

  it('falls back to VITE_API_BASE env variable', () => {
    assert.match(src, /VITE_API_BASE/);
  });

  it('can be loaded by a local-core Node test without Vite injecting import.meta.env', () => {
    assert.match(src, /import\.meta\.env\?\.VITE_API_BASE/);
  });
});


// ---------------------------------------------------------------------------
// ETP-5022 — behaviour of the unified request helper. These are the guarantees
// that let a raw `fetch` call site be replaced by `apiFetch` without changing
// what goes over the wire.
// ---------------------------------------------------------------------------

function stubFetch(response = { status: 200 }) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return response;
  };
  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

describe('resolveApiUrl', () => {
  it('prefixes a bare path with the base', () => {
    assert.equal(resolveApiUrl('/etendo', '/spec/entity'), '/etendo/spec/entity');
  });

  it('leaves a URL that already carries the base alone', () => {
    // ~147 pre-existing call sites build `${apiBaseUrl}/entity` themselves; prefixing
    // again would produce /etendo/etendo/entity and 404 on every one of them.
    assert.equal(resolveApiUrl('/etendo', '/etendo/spec/entity'), '/etendo/spec/entity');
  });

  it('leaves a fully-qualified URL alone', () => {
    assert.equal(resolveApiUrl('/etendo', 'https://host/x'), 'https://host/x');
  });

  it('is a no-op when there is no base (app served from the domain root)', () => {
    assert.equal(resolveApiUrl('', '/spec/entity'), '/spec/entity');
  });
});

describe('createApiFetch', () => {
  it('sends the canonical headers, so Accept-Language is never missing', async () => {
    const f = stubFetch();
    try {
      await createApiFetch('', () => 'tok', () => {})('/x');
      assert.equal(f.calls[0].options.headers['Authorization'], 'Bearer tok');
      assert.ok(f.calls[0].options.headers['Accept-Language']);
    } finally { f.restore(); }
  });

  it('omits Content-Type on a bodyless request and sets it when there is a body', async () => {
    const f = stubFetch();
    try {
      const request = createApiFetch('', () => 'tok', () => {});
      await request('/x');
      assert.equal(f.calls[0].options.headers['Content-Type'], undefined);
      await request('/x', { method: 'POST', body: '{}' });
      assert.equal(f.calls[1].options.headers['Content-Type'], 'application/json');
    } finally { f.restore(); }
  });

  it('lets the caller add headers without losing the canonical ones', async () => {
    const f = stubFetch();
    try {
      await createApiFetch('', () => 'tok', () => {})('/x', { headers: { 'X-Extra': '1' } });
      assert.equal(f.calls[0].options.headers['X-Extra'], '1');
      assert.equal(f.calls[0].options.headers['Authorization'], 'Bearer tok');
    } finally { f.restore(); }
  });

  it('defaults credentials to include and lets a call site override it', async () => {
    const f = stubFetch();
    try {
      const request = createApiFetch('', () => null, () => {});
      await request('/x');
      assert.equal(f.calls[0].options.credentials, 'include');
      await request('/x', { credentials: 'omit' });
      assert.equal(f.calls[1].options.credentials, 'omit');
    } finally { f.restore(); }
  });

  it('logs out and throws on a 401', async () => {
    const f = stubFetch({ status: 401 });
    let loggedOut = 0;
    try {
      await assert.rejects(
        () => createApiFetch('', () => 'tok', () => { loggedOut += 1; })('/x'),
        /Unauthorized/,
      );
      assert.equal(loggedOut, 1);
    } finally { f.restore(); }
  });

  it('hands a 401 back untouched when the call site owns that case', async () => {
    // e.g. lib/upgrade/api.js maps 401 to its own `sessionExpired` error code, and
    // probes that read "unauthorized" as "feature unavailable".
    const f = stubFetch({ status: 401 });
    let loggedOut = 0;
    try {
      const res = await createApiFetch('', () => 'tok', () => { loggedOut += 1; })(
        '/x', { on401: 'ignore' },
      );
      assert.equal(res.status, 401);
      assert.equal(loggedOut, 0);
    } finally { f.restore(); }
  });

  it('lets one call opt out of the base URL for an already-complete URL', async () => {
    const f = stubFetch();
    try {
      await createApiFetch('/api/product', () => null, () => {})(
        '/api/price-list/priceList', { baseUrl: '' },
      );
      assert.equal(f.calls[0].url, '/api/price-list/priceList');
    } finally { f.restore(); }
  });

  it('lets a plain module pass its own token instead of the session one', async () => {
    const f = stubFetch();
    try {
      await createApiFetch('', () => 'session-tok', () => {})('/x', { token: 'explicit' });
      assert.equal(f.calls[0].options.headers['Authorization'], 'Bearer explicit');
    } finally { f.restore(); }
  });

  it('does not leak its own options through to fetch', async () => {
    const f = stubFetch();
    try {
      await createApiFetch('', () => null, () => {})('/x', { on401: 'ignore', baseUrl: '', token: 't' });
      assert.equal('on401' in f.calls[0].options, false);
      assert.equal('baseUrl' in f.calls[0].options, false);
      assert.equal('token' in f.calls[0].options, false);
    } finally { f.restore(); }
  });

  it('forwards everything else (method, body, signal) unchanged', async () => {
    const f = stubFetch();
    const controller = new AbortController();
    try {
      await createApiFetch('', () => null, () => {})('/x', {
        method: 'POST', body: '{}', signal: controller.signal,
      });
      assert.equal(f.calls[0].options.method, 'POST');
      assert.equal(f.calls[0].options.body, '{}');
      assert.equal(f.calls[0].options.signal, controller.signal);
    } finally { f.restore(); }
  });
});

describe('ambient apiFetch', () => {
  it('uses the registered session token and base URL', async () => {
    const f = stubFetch();
    registerApiSession({ getToken: () => 'ambient-tok', baseUrl: '/etendo' });
    try {
      await apiFetch('/spec/entity');
      assert.equal(f.calls[0].url, '/etendo/spec/entity');
      assert.equal(f.calls[0].options.headers['Authorization'], 'Bearer ambient-tok');
    } finally { f.restore(); resetApiSessionForTests(); }
  });

  it('reads the token on every call, so a re-login is picked up', async () => {
    const f = stubFetch();
    let token = 'first';
    registerApiSession({ getToken: () => token, baseUrl: '' });
    try {
      await apiFetch('/x');
      token = 'second';
      await apiFetch('/x');
      assert.equal(f.calls[1].options.headers['Authorization'], 'Bearer second');
    } finally { f.restore(); resetApiSessionForTests(); }
  });

  it('routes a 401 to the registered logout handler', async () => {
    const f = stubFetch({ status: 401 });
    let loggedOut = 0;
    registerApiSession({ getToken: () => 'tok', onUnauthorized: () => { loggedOut += 1; }, baseUrl: '' });
    try {
      await assert.rejects(() => apiFetch('/x'), /Unauthorized/);
      assert.equal(loggedOut, 1);
    } finally { f.restore(); resetApiSessionForTests(); }
  });

  it('falls back to an anonymous request when no session is registered', async () => {
    // A module can load before the provider mounts, or in a suite that never mounts one.
    // Behaving like the raw `fetch` it replaced beats throwing at import time.
    const f = stubFetch();
    resetApiSessionForTests();
    try {
      await apiFetch('/x');
      assert.equal(f.calls[0].options.headers['Authorization'], undefined);
    } finally { f.restore(); }
  });

  it('unregister only clears the session it registered', async () => {
    const first = () => 'a';
    const unregisterFirst = registerApiSession({ getToken: first, baseUrl: '' });
    registerApiSession({ getToken: () => 'b', baseUrl: '' });
    unregisterFirst();
    const f = stubFetch();
    try {
      await apiFetch('/x');
      assert.equal(f.calls[0].options.headers['Authorization'], 'Bearer b');
    } finally { f.restore(); resetApiSessionForTests(); }
  });
});

// ── ETP-5073 / DOC-04 ───────────────────────────────────────────────────────
//
// The backend now REFUSES an update that does not carry the `updated` value of the record as
// it was read — that is what makes core's optimistic-locking check actually evaluate, instead
// of being silently skipped so the last writer overwrites the first. Attaching the token here
// rather than at the ~41 update call sites is what stops the next new panel from forgetting it.

/**
 * Stubs `fetch` and returns a recorder of what was sent, plus a restore.
 *
 * `clone()` is provided because `harvestWrittenVersion` uses it — deliberately as a real
 * `Response` would, so these cases exercise the harvest path rather than its guard.
 */
function stubVersionedFetch(responseBody = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      clone: () => ({ json: async () => responseBody }),
      json: async () => responseBody,
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function sentBody(calls, index = 0) {
  return JSON.parse(calls[index].opts.body);
}

describe('apiFetch optimistic-locking token (ETP-5073)', () => {
  beforeEach(() => resetRecordVersionsForTests());

  it('attaches the remembered updated to a PATCH of a record it has read', () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: '2026-08-28T09:00:00' });
    return createApiFetch('', () => 't', () => {})(
      '/sales-invoice/header/REC1', { method: 'PATCH', body: JSON.stringify({ description: 'x' }) },
    ).then(() => {
      assert.deepEqual(sentBody(calls), {
        description: 'x', updated: '2026-08-28T09:00:00',
      });
      restore();
    });
  });

  it('attaches it on PUT too', () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    return createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'PUT', body: JSON.stringify({ a: 1 }) },
    ).then(() => {
      assert.equal(sentBody(calls).updated, 'v1');
      restore();
    });
  });

  it('reads the id from the body when present, not only from the URL tail', () => {
    // A write whose URL is a collection but whose body names the record.
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'FROM-BODY', updated: 'v9' });
    return createApiFetch('', () => 't', () => {})(
      '/some/collection', { method: 'PATCH', body: JSON.stringify({ id: 'FROM-BODY' }) },
    ).then(() => {
      assert.equal(sentBody(calls).updated, 'v9');
      restore();
    });
  });

  it('leaves a POST alone — a create has no prior version to conflict with', () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    return createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'POST', body: JSON.stringify({ a: 1 }) },
    ).then(() => {
      assert.deepEqual(sentBody(calls), { a: 1 });
      restore();
    });
  });

  it('leaves a write to an id it never read alone, so a non-NEO PUT is never corrupted', () => {
    // The cache miss IS the guard: an OAuth2 or fiscal-config PUT has no entry, so nothing
    // is added to its body.
    const { calls, restore } = stubVersionedFetch();
    return createApiFetch('', () => 't', () => {})(
      '/oauth2/config/UNKNOWN', { method: 'PUT', body: JSON.stringify({ a: 1 }) },
    ).then(() => {
      assert.deepEqual(sentBody(calls), { a: 1 });
      restore();
    });
  });

  it('never overrides an updated the caller set explicitly', () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'remembered' });
    return createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'PATCH', body: JSON.stringify({ updated: 'explicit' }) },
    ).then(() => {
      assert.equal(sentBody(calls).updated, 'explicit');
      restore();
    });
  });

  it('leaves a FormData body alone — an upload is not a JSON record write', () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    const form = new FormData();
    return createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'PATCH', body: form },
    ).then(() => {
      assert.equal(calls[0].opts.body, form);
      restore();
    });
  });

  it('leaves a non-JSON string body alone instead of throwing', () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    return createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'PATCH', body: 'not json' },
    ).then(() => {
      assert.equal(calls[0].opts.body, 'not json');
      restore();
    });
  });

  it('remembers the version a successful write returned, so a second edit is not a conflict', async () => {
    // Without this the second save in one sitting would replay the token the first save
    // consumed, and the server would correctly reject it — against the user's own change.
    const { restore } = stubVersionedFetch({ response: { data: [{ id: 'REC1', updated: 'v2' }] } });
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    await createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'PATCH', body: JSON.stringify({ a: 1 }) },
    );
    // The harvest is deliberately not awaited by the request, so let its microtasks drain.
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(getRecordVersion('REC1'), 'v2');
    restore();
  });

  it('never consumes the caller\'s body when clone() is not independent', async () => {
    // A real Response.clone() gives an independent body, but a hand-rolled double may return
    // `this`. Reading it here would consume the single-use json() the CALLER was about to read,
    // starving the very request being decorated. Harvesting is worth nothing next to that.
    const original = globalThis.fetch;
    let jsonReads = 0;
    const res = {
      ok: true,
      status: 200,
      json: async () => { jsonReads += 1; return { response: { data: [{ id: 'REC1', updated: 'v2' }] } }; },
    };
    res.clone = () => res;   // the hazard: not a copy
    globalThis.fetch = async () => res;
    const answer = await createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'PATCH', body: JSON.stringify({ a: 1 }) },
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    // The caller's read is the FIRST and only one.
    await answer.json();
    assert.equal(jsonReads, 1);
    assert.equal(getRecordVersion('REC1'), undefined, 'nothing was harvested, deliberately');
    globalThis.fetch = original;
  });

  it('does not blow up when the response has no clone(), as a stubbed fetch may not', async () => {
    // Harvesting is an optimisation; it must never be the reason a caller's request throws.
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    await assert.doesNotReject(createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'PATCH', body: JSON.stringify({ a: 1 }) },
    ));
    globalThis.fetch = original;
  });
});
