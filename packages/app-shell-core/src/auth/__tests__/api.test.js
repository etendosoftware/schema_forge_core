import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createApiFetch, apiFetch, resolveApiUrl, registerApiSession, resetApiSessionForTests,
  entityFromPath,
} from '../api.js';
import { CREDENTIAL_MODES, setSessionCredentials } from '../sessionCredentials.js';
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

// Negative assertions run against a comment-stripped copy: api.js documents its own
// guarantee ("no Authorization header", ADR-0001) in prose, and a raw source read
// cannot tell code from comment, so that sentence alone would trip them.
const codeOnly = src.replace(/^\s*\/\/.*$/gm, '');

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

  // ETP-4576 — this used to assert `if (token)` and a Bearer literal. The credential
  // now comes from the active scheme, so the function takes no token at all: under
  // `bearer` readCredentialHeaders puts the Authorization header back, under `cookie`
  // it sends none and the `__Host-` session travels on its own.
  it('takes its credential from the active scheme, never a Bearer literal', () => {
    const body = src.slice(src.indexOf('export function authHeaders'));
    const fn = body.slice(0, body.indexOf('\n}'));
    assert.match(fn, /readCredentialHeaders\(\)/);
    const fnCode = fn.replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(fnCode, /Bearer/);
  });

  it('is exported as a zero-argument function (no token parameter)', () => {
    assert.match(src, /export function authHeaders\s*\(\s*\)/);
  });
});

describe('buildHeaders', () => {
  it('is exported as a named function', () => {
    assert.match(src, /export function buildHeaders/);
  });

  // Content-Type is no longer asserted here: it comes from jsonHeaders, which
  // owns that contract and is covered by sessionCredentials.test.js. Asserting
  // the delegation instead is what keeps the scheme switchable — a buildHeaders
  // that hardcodes its own headers silently ignores the active scheme, which is
  // how the bearer fallback broke before the preference existed.
  it('delegates the credential decision to jsonHeaders rather than building one', () => {
    assert.match(src, /import \{[^}]*jsonHeaders[^}]*\} from '\.\/sessionCredentials\.js'/);
    assert.match(src, /export function buildHeaders\s*\(\s*\)\s*\{\s*return \{\s*\.\.\.jsonHeaders\(\)/);
  });

  it('sets Accept-Language header using getStoredLocale for backend i18n', () => {
    assert.match(src, /Accept-Language/);
    assert.match(src, /getStoredLocale/);
  });

  it('never references an Authorization header anywhere in the module', () => {
    assert.doesNotMatch(codeOnly, /Authorization/);
  });

  it('never references a Bearer-token scheme anywhere in the module', () => {
    assert.doesNotMatch(src, /Bearer/);
  });
});

// The write-path pair of buildHeaders. It exists so no caller has to remember to
// append the proof by hand: every site that did (13 of them across the host)
// silently omitted it the moment the variable it read went out of scope.
describe('buildWriteHeaders — the write-path pair of buildHeaders', () => {
  it('is exported as a zero-argument function', () => {
    assert.match(src, /export function buildWriteHeaders\s*\(\s*\)/);
  });

  it('delegates to writeHeaders so unsafe methods carry the active scheme proof', () => {
    assert.match(src, /import \{[^}]*writeHeaders[^}]*\} from '\.\/sessionCredentials\.js'/);
    assert.match(src, /export function buildWriteHeaders\s*\(\s*\)\s*\{\s*return \{\s*\.\.\.writeHeaders\(\)/);
  });

  it('carries the locale too, so write responses are translated like reads', () => {
    assert.match(
      src,
      /export function buildWriteHeaders\s*\(\s*\)\s*\{\s*return \{[^}]*'Accept-Language': getStoredLocale\(\)/,
    );
  });
});

describe('isTokenExpired — removed entirely', () => {
  it('is no longer defined or exported anywhere in the module', () => {
    assert.doesNotMatch(src, /isTokenExpired/);
  });
});

describe('createApiFetch — CSRF header on unsafe methods, session lives in an httpOnly cookie', () => {
  it('is exported with the (baseUrl, getCsrfToken, onUnauthorized) signature', () => {
    assert.match(
      src,
      /export function createApiFetch\s*\(\s*baseUrl\s*,\s*getCsrfToken\s*,\s*onUnauthorized\s*\)/
    );
  });

  it('normalizes options.method case-insensitively before deciding safe vs unsafe', () => {
    assert.match(src, /options\.method[\s\S]{0,40}\.toUpperCase\(\)|\.toUpperCase\(\)[\s\S]{0,40}options\.method/);
  });

  it('defines an unsafe-method list covering POST, PUT, PATCH and DELETE', () => {
    assert.match(
      src,
      /(['"]POST['"])[\s\S]{0,120}(['"]PUT['"])[\s\S]{0,120}(['"]PATCH['"])[\s\S]{0,120}(['"]DELETE['"])/
    );
  });

  it('sets the X-Go-CSRF header (exact casing) somewhere in apiFetch', () => {
    assert.match(src, /X-Go-CSRF/);
  });

  it('guards the X-Go-CSRF assignment behind a truthy check on getCsrfToken()', () => {
    // The header assignment (bracket or object-literal form) must be reachable
    // only through a conditional that both calls getCsrfToken() and checks
    // truthiness — i.e. it must NOT be an unconditional assignment.
    assert.match(
      src,
      /if\s*\([^)]*\)[\s\S]{0,300}getCsrfToken\(\)[\s\S]{0,200}X-Go-CSRF|getCsrfToken\(\)[\s\S]{0,200}if\s*\([^)]*\)[\s\S]{0,200}X-Go-CSRF/
    );
  });

  it('never calls getCsrfToken() unconditionally at the top of apiFetch (only inside the unsafe-method branch)', () => {
    // A naive "always call it" implementation would put `getCsrfToken()` right
    // next to `const headers = ...buildHeaders()`, unconditioned by method.
    // Guard against that regression pattern.
    assert.doesNotMatch(
      src,
      /const\s+headers\s*=\s*\{\s*\.\.\.buildHeaders\(\)[^}]*\}\s*;\s*[\s\S]{0,80}headers\[.X-Go-CSRF.\]\s*=\s*getCsrfToken\(\)\s*;/
    );
  });

  it('keeps credentials: "include" so the __Host- session cookie still travels with every request', () => {
    assert.match(src, /credentials:\s*['"]include['"]/);
  });

  it('keeps deleting Content-Type when body is FormData so the browser sets the multipart boundary', () => {
    assert.match(src, /instanceof FormData[\s\S]*?delete headers\[.Content-Type.\]/);
  });

  it('keeps calling onUnauthorized() and throwing on a 401 response (no auto-refresh here)', () => {
    assert.match(src, /res\.status\s*===\s*401/);
    assert.match(src, /onUnauthorized\(\)/);
    assert.match(src, /throw new Error\(['"]Unauthorized['"]\)/);
  });
});

// ETP-4576 cycle 4a — the GET /sws/go/session fetcher moves INTO the platform.
// Three consumers already needed it (the onboarding api, the schema_forge host,
// and tools/etendo-go-ar which passed nothing at all and was therefore broken),
// so api.js owns it and AuthProvider defaults `restoreSession` to it.
// Behavioral coverage — request shape, fail-closed paths — lives in the sibling
// api.vitest.js, which can actually import this module; these are the structural
// invariants, asserted in the suite `npm test` runs.
describe('fetchCookieSession — the platform session fetcher (ETP-4576)', () => {
  it('is exported as an async function taking an optional baseUrl', () => {
    assert.match(src, /export async function fetchCookieSession\s*\(\s*baseUrl\s*=/);
  });

  // ETP-5022 replaced the module-level constant with a lazy resolver: reading
  // `window` at import time made this module unloadable under plain `node --test`.
  it('defaults its baseUrl to the lazily resolved base', () => {
    assert.match(src, /export async function fetchCookieSession\s*\(\s*baseUrl\s*=\s*defaultBaseUrl\(\)\s*\)/);
  });

  it('requests the /sws/go/session endpoint', () => {
    assert.match(src, /\/sws\/go\/session/);
  });

  it('sends credentials so the __Host- session cookie travels (already asserted module-wide, pinned here for the fetcher)', () => {
    assert.match(src, /credentials:\s*['"]include['"]/);
  });

  it('fails closed by returning null on a non-ok response instead of throwing', () => {
    assert.match(src, /if\s*\(\s*!res\.ok\s*\)\s*return null;/);
  });

  it('swallows fetch/parse failures with a catch that also yields null', () => {
    assert.match(src, /catch[\s\S]{0,40}return null;/);
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
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok' });
      await createApiFetch('', () => null, () => {})('/x');
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
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok' });
      await createApiFetch('', () => null, () => {})('/x', { headers: { 'X-Extra': '1' } });
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
    // ETP-5112: the harvest keys the returned record by the entity derived from the path, so the
    // fresh token lands in the `x` bucket — which is the one the next PATCH to `/x/REC1` reads.
    assert.equal(getRecordVersion('REC1', 'x'), 'v2');
    // The `null` bucket still holds the token this test seeded by hand. That is correct and not
    // a regression: a write harvested under a real entity must not refresh a bucket that may
    // name a different row sharing the id (see the ad_org / ad_orginfo case).
    assert.equal(getRecordVersion('REC1', null), 'v1');
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

// ETP-4576 — the bearer must never travel as the CSRF proof.
//
// createApiFetch puts whatever its second argument returns into `X-Go-CSRF` on unsafe
// methods. Both callers used to hand it a TOKEN there — `session.getToken` in apiFetch and
// `getAmbientToken` in useApiFetch — which shipped the credential in the proof's header
// under the bearer scheme, and under the cookie one put a value that is not the proof where
// the backend expects it, so every unsafe request from outside a provider came back 403.
// Source-reading rather than behavioural: the wiring is what regressed, and it regressed
// silently because nothing on the wire complained under bearer.
describe('the CSRF proof does not depend on the scheme the client believes it is in (ETP-4576)', () => {
  // Regression guard. Gating the header on `mode !== bearer` reads tidier and shipped
  // once: it took down every confirm flow in the integration suite with a 403, because
  // the browser attaches the same-origin session cookie regardless of what the client
  // thinks, and the backend validates CSRF as soon as it sees that cookie on an unsafe
  // method. Reads kept working, which is what made it look like anything but this.
  it('sends X-Go-CSRF on an unsafe request even while the active scheme is bearer', async () => {
    const f = stubFetch();
    try {
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok' });
      await createApiFetch('', () => 'csrf-abc', () => {})('/x', { method: 'POST', body: '{}' });
      assert.equal(f.calls[0].options.headers['X-Go-CSRF'], 'csrf-abc');
    } finally { f.restore(); }
  });

  it('still sends nothing on a safe request, whatever the scheme', async () => {
    const f = stubFetch();
    try {
      setSessionCredentials({ mode: CREDENTIAL_MODES.bearer, token: 'tok' });
      await createApiFetch('', () => 'csrf-abc', () => {})('/x');
      assert.equal(f.calls[0].options.headers['X-Go-CSRF'], undefined);
    } finally { f.restore(); }
  });
});

describe('the CSRF slot never receives a credential (ETP-4576)', () => {
  const src = readFileSync(new URL('../api.js', import.meta.url), 'utf8');
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('apiFetch reads the proof off the active scheme, not off the session token', () => {
    const call = codeOnly.slice(codeOnly.indexOf('return createApiFetch('));
    assert.match(call, /getSessionCsrfToken/);
    assert.doesNotMatch(call.slice(0, call.indexOf(')(path')), /getToken/);
      });
    });

// ── ETP-5112 ────────────────────────────────────────────────────────────────
//
// ETP-5073 made the backend REQUIRE the `updated` token, but only `useEntity` remembered one, so
// the ~15 panels that read with `apiFetch` directly patched without it and got a hard 400
// `missing_updated`. Harvesting on every read closes that, and keying by (id, entity) is what
// keeps two rows that legitimately share an id from stealing each other's token.

describe('entityFromPath (ETP-5112)', () => {
  it('takes the segment BEFORE the id when the tail is the record id', () => {
    assert.equal(entityFromPath('/organization/O1', 'O1'), 'organization');
  });

  it('takes the tail itself for a collection read, where the tail is not the id', () => {
    // `/price?parentId=X` — the row ids come from the payload, never from the path.
    assert.equal(entityFromPath('/price?parentId=X', 'R9'), 'price');
    assert.equal(entityFromPath('/price#frag', 'R9'), 'price');
  });

  it('resolves the three-segment NEO record shape to the entity, not the spec', () => {
    assert.equal(entityFromPath('/verifactu-config/VerifactuConfig/R1', 'R1'), 'VerifactuConfig');
  });

  it('decodes the tail before comparing it to the id', () => {
    // NOT cosmetic: `ListModalWindow.jsx` writes to `/${entity}/${encodeURIComponent(row.id)}`.
    // Without decoding, the encoded tail never equals the raw id, so we would return the ENCODED
    // ID as the entity and key the write under a bucket no read ever wrote.
    const id = 'a/b';
    assert.equal(entityFromPath(`/entity/${encodeURIComponent(id)}`, id), 'entity');
    assert.equal(entityFromPath(`/entity/${encodeURIComponent('x y')}`, 'x y'), 'entity');
  });

  it('degrades to the raw segment on a malformed escape instead of throwing', () => {
    // `decodeURIComponent` throws on a stray `%`, and this runs on every request in the app.
    assert.doesNotThrow(() => entityFromPath('/entity/100%', '100%'));
    assert.equal(entityFromPath('/entity/100%', '100%'), 'entity',
      'the raw segment still compares equal to the raw id');
    assert.equal(entityFromPath('/entity/100%', 'OTHER'), '100%');
  });

  it('returns null for a path with no usable segment', () => {
    assert.equal(entityFromPath('', 'X'), null);
    assert.equal(entityFromPath('/', 'X'), null);
    assert.equal(entityFromPath('///', 'X'), null);
    assert.equal(entityFromPath('?a=b', 'X'), null);
  });

  it('returns null for a non-string path rather than throwing', () => {
    for (const bad of [null, undefined, 42, {}, ['/x/1']]) {
      assert.doesNotThrow(() => entityFromPath(bad, 'X'));
      assert.equal(entityFromPath(bad, 'X'), null);
    }
  });

  it('returns null when the only segment IS the id, as there is no entity to name', () => {
    assert.equal(entityFromPath('/O1', 'O1'), null);
  });

  it('returns the tail when no record id is known', () => {
    assert.equal(entityFromPath('/organization/O1', null), 'O1');
    assert.equal(entityFromPath('/organization/O1', undefined), 'O1');
    assert.equal(entityFromPath('/price', undefined), 'price');
  });
});

/**
 * Stubs `fetch` with a JSON response that a real `Response` would produce: a `content-type`
 * header (the gate `harvestReadVersions` checks first) and an INDEPENDENT `clone()`.
 */
function stubReadFetch(bodyForPath, { contentType = 'application/json', ok = true } = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    const body = typeof bodyForPath === 'function' ? bodyForPath(url, opts) : bodyForPath;
    return {
      ok,
      status: ok ? 200 : 500,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
      clone: () => ({ json: async () => body }),
      json: async () => body,
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/** The harvest is deliberately not awaited by the request, so let its microtasks drain. */
const drain = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('apiFetch harvests record versions on read (ETP-5112)', () => {
  beforeEach(() => resetRecordVersionsForTests());

  it('harvests EVERY row of a list GET, not just the first', () => {
    // The main case: inline edit in a grid (Contacts, ProductPriceBar, actividadesDelIae). The
    // row the user edits is rarely row 0, so a first-row-only harvest fixed nothing.
    const { restore } = stubReadFetch({
      response: {
        data: [
          { id: 'R1', updated: 'v1' },
          { id: 'R2', updated: 'v2' },
          { id: 'R3', updated: 'v3' },
        ],
      },
    });
    return createApiFetch('', () => 't', () => {})('/price?parentId=P1')
      .then(drain)
      .then(() => {
        assert.equal(getRecordVersion('R1', 'price'), 'v1');
        assert.equal(getRecordVersion('R2', 'price'), 'v2');
        assert.equal(getRecordVersion('R3', 'price'), 'v3');
        restore();
      });
  });

  it('harvests a bare array and a single-object payload too', () => {
    const { restore } = stubReadFetch((url) => (url.includes('array')
      ? [{ id: 'A1', updated: 'va' }]
      : { id: 'S1', updated: 'vs' }));
    const fetcher = createApiFetch('', () => 't', () => {});
    return fetcher('/array-entity')
      .then(() => fetcher('/single/S1'))
      .then(drain)
      .then(() => {
        assert.equal(getRecordVersion('A1', 'array-entity'), 'va');
        assert.equal(getRecordVersion('S1', 'single'), 'vs');
        restore();
      });
  });

  it('harvests a GET by id under the entity segment before the id', () => {
    const { restore } = stubReadFetch({ response: { data: [{ id: 'O1', updated: 'ORG' }] } });
    return createApiFetch('', () => 't', () => {})('/organization/O1')
      .then(drain)
      .then(() => {
        assert.equal(getRecordVersion('O1', 'organization'), 'ORG');
        // Only that bucket was written: a second read of the same id under another entity gets
        // its own slot rather than overwriting this one (see the satellite-table case below).
        restore();
      });
  });

  it('sends each satellite row its OWN token when two share an id (ad_org / ad_orginfo)', async () => {
    // THE end-to-end regression test of ETP-5112. `OrganizationPage.jsx` reads both rows and
    // patches both with a PARTIAL body carrying neither `id` nor `updated`; under an id-only
    // cache the second GET clobbered the first token and one PATCH went out with the other
    // row's version, which the server correctly refuses as a 409 the user cannot resolve.
    const { calls, restore } = stubReadFetch((url) => ({
      response: {
        data: [{ id: 'O1', updated: url.includes('/information/') ? 'INFO' : 'ORG' }],
      },
    }));
    const fetcher = createApiFetch('', () => 't', () => {});
    await fetcher('/organization/O1');
    await fetcher('/information/O1');
    await drain();

    await fetcher('/organization/O1', { method: 'PATCH', body: JSON.stringify({ name: 'Acme' }) });
    await fetcher('/information/O1', { method: 'PATCH', body: JSON.stringify({ phone: '123' }) });

    const patches = calls.filter((c) => c.opts?.method === 'PATCH');
    assert.deepEqual(JSON.parse(patches[0].opts.body), { name: 'Acme', updated: 'ORG' });
    assert.deepEqual(JSON.parse(patches[1].opts.body), { phone: '123', updated: 'INFO' });
    restore();
  });

  it('ignores a response whose content-type is not JSON', () => {
    // A download or an HTML error page must not be cloned and parsed on every request.
    const { restore } = stubReadFetch({ response: { data: [{ id: 'R1', updated: 'v1' }] } },
      { contentType: 'text/html; charset=utf-8' });
    return createApiFetch('', () => 't', () => {})('/price')
      .then(drain)
      .then(() => {
        assert.equal(getRecordVersion('R1', 'price'), undefined);
        restore();
      });
  });

  it('ignores a response with no content-type at all', () => {
    const { restore } = stubReadFetch({ response: { data: [{ id: 'R1', updated: 'v1' }] } },
      { contentType: null });
    return createApiFetch('', () => 't', () => {})('/price')
      .then(drain)
      .then(() => {
        assert.equal(getRecordVersion('R1', 'price'), undefined);
        restore();
      });
  });

  it('ignores a failed response — an error body is not a record read', () => {
    const { restore } = stubReadFetch({ response: { data: [{ id: 'R1', updated: 'v1' }] } },
      { ok: false });
    return createApiFetch('', () => 't', () => {})('/price')
      .then(drain)
      .then(() => {
        assert.equal(getRecordVersion('R1', 'price'), undefined);
        restore();
      });
  });

  it('does not blow up on a GET whose stubbed response has no clone()', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ response: { data: [{ id: 'R1', updated: 'v1' }] } }),
    });
    await assert.doesNotReject(createApiFetch('', () => 't', () => {})('/price'));
    await drain();
    assert.equal(getRecordVersion('R1', 'price'), undefined, 'nothing harvested, deliberately');
    globalThis.fetch = original;
  });

  it('never consumes the caller\'s body on a GET when clone() is not independent', async () => {
    // A hand-rolled double may return `this` from clone(). Reading it here would consume the
    // single-use json() the CALLER was about to read, starving the very read being decorated.
    const original = globalThis.fetch;
    let jsonReads = 0;
    const res = {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => {
        jsonReads += 1;
        return { response: { data: [{ id: 'R1', updated: 'v1' }] } };
      },
    };
    res.clone = () => res;   // the hazard: not a copy
    globalThis.fetch = async () => res;
    const answer = await createApiFetch('', () => 't', () => {})('/price');
    await drain();
    const payload = await answer.json();
    assert.equal(jsonReads, 1, 'the caller\'s read is the first and only one');
    assert.equal(payload.response.data[0].id, 'R1', 'the caller still gets its body');
    assert.equal(getRecordVersion('R1', 'price'), undefined, 'nothing harvested, deliberately');
    globalThis.fetch = original;
  });

  it('skips a record served without updated (a projection or aggregate row)', () => {
    const { restore } = stubReadFetch({
      response: { data: [{ id: 'AGG1', total: 42 }, { id: 'R2', updated: 'v2' }] },
    });
    return createApiFetch('', () => 't', () => {})('/price')
      .then(drain)
      .then(() => {
        assert.equal(getRecordVersion('AGG1', 'price'), undefined);
        assert.equal(getRecordVersion('R2', 'price'), 'v2', 'the sibling row still lands');
        restore();
      });
  });

  it('survives an unexpected envelope without throwing', () => {
    const { restore } = stubReadFetch(null);
    const fetcher = createApiFetch('', () => 't', () => {});
    return assert.doesNotReject(fetcher('/price').then(drain)).then(() => restore());
  });

  it('does not harvest on a POST — a create is not a read', () => {
    const { restore } = stubReadFetch({ response: { data: [{ id: 'NEW1', updated: 'v1' }] } });
    return createApiFetch('', () => 't', () => {})(
      '/price', { method: 'POST', body: JSON.stringify({ a: 1 }) },
    ).then(drain).then(() => {
      assert.equal(getRecordVersion('NEW1', 'price'), undefined);
      assert.equal(getRecordVersion('NEW1'), undefined);
      restore();
    });
  });

  it('arms an inline grid edit: list read, then PATCH of a row that is not the first', () => {
    const { calls, restore } = stubReadFetch({
      response: { data: [{ id: 'R1', updated: 'v1' }, { id: 'R2', updated: 'v2' }] },
    });
    const fetcher = createApiFetch('', () => 't', () => {});
    return fetcher('/price?parentId=P1')
      .then(drain)
      .then(() => fetcher('/price/R2', { method: 'PATCH', body: JSON.stringify({ qty: 3 }) }))
      .then(() => {
        const patch = calls.find((c) => c.opts?.method === 'PATCH');
        assert.deepEqual(JSON.parse(patch.opts.body), { qty: 3, updated: 'v2' });
        restore();
      });
  });
});

describe('withRecordVersion non-regression (ETP-5073 behaviour under the ETP-5112 key)', () => {
  beforeEach(() => resetRecordVersionsForTests());

  it('leaves a GET and a DELETE untouched — neither is a versioned update', async () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    const fetcher = createApiFetch('', () => 't', () => {});
    await fetcher('/x/REC1');
    await fetcher('/x/REC1', { method: 'DELETE' });
    assert.equal(calls[0].opts.body, undefined);
    assert.equal(calls[1].opts.body, undefined);
    restore();
  });

  it('leaves a JSON array or a JSON null body alone — neither is a record', async () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    const fetcher = createApiFetch('', () => 't', () => {});
    await fetcher('/x/REC1', { method: 'PATCH', body: '[{"a":1}]' });
    await fetcher('/x/REC1', { method: 'PATCH', body: 'null' });
    assert.equal(calls[0].opts.body, '[{"a":1}]');
    assert.equal(calls[1].opts.body, 'null');
    restore();
  });

  it('accepts a lowercase method, so a call site writing `patch` is still versioned', async () => {
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'REC1', updated: 'v1' });
    await createApiFetch('', () => 't', () => {})(
      '/x/REC1', { method: 'patch', body: JSON.stringify({ a: 1 }) },
    );
    assert.equal(sentBody(calls).updated, 'v1');
    restore();
  });

  it('injects nothing when the id is known under other entities but not this one', async () => {
    // The deliberate choice of ETP-5112: a loud 400 `missing_updated` beats guessing another
    // row's token and producing a 409 `stale_record` the user cannot explain.
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'O1', updated: 'ORG' }, 'organization');
    rememberRecordVersion({ id: 'O1', updated: 'INFO' }, 'information');
    await createApiFetch('', () => 't', () => {})(
      '/accounting/O1', { method: 'PATCH', body: JSON.stringify({ a: 1 }) },
    );
    assert.deepEqual(sentBody(calls), { a: 1 });
    restore();
  });

  it('still resolves a token remembered with no entity, as useEntity records it', async () => {
    // ContactsTable / ContactsFinancialPanel never read: they get `data` through props from
    // `useEntity` (which has no path context) and then PATCH `/businessPartner/{id}`.
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'BP1', updated: 'from-useEntity' });
    await createApiFetch('', () => 't', () => {})(
      '/businessPartner/BP1', { method: 'PATCH', body: JSON.stringify({ name: 'x' }) },
    );
    assert.equal(sentBody(calls).updated, 'from-useEntity');
    restore();
  });

  it('keys a write by an encoded id in the URL under the entity, not the encoding', async () => {
    // `ListModalWindow.jsx` writes to `/${entity}/${encodeURIComponent(row.id)}`.
    const { calls, restore } = stubVersionedFetch();
    rememberRecordVersion({ id: 'a/b', updated: 'v1' }, 'entity');
    await createApiFetch('', () => 't', () => {})(
      `/entity/${encodeURIComponent('a/b')}`,
      { method: 'PATCH', body: JSON.stringify({ id: 'a/b', a: 1 }) },
    );
    assert.equal(sentBody(calls).updated, 'v1');
    restore();
  });
});
