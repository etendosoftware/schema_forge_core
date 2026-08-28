import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createApiFetch, apiFetch, resolveApiUrl, registerApiSession, resetApiSessionForTests,
} from '../api.js';
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
