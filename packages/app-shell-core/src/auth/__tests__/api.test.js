import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// api.js uses window and import.meta.env at module scope — cannot be imported in Node
// (this package's plain `node --test` runner has no window/import.meta.env shim).
// Use source-reading to verify the module's contract instead of importing it.
//
// ETP-4576 (Bearer token -> __Host- cookie session + CSRF header) — RED step.
// These assertions describe the contract api.js MUST implement, and are expected
// to FAIL against the current (pre-migration) source. See ADR-0001 in
// com.etendoerp.go for the backend contract this mirrors.
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'api.js'), 'utf8');

describe('buildHeaders — no more client-side bearer token', () => {
  it('is exported as a zero-argument function (no token parameter)', () => {
    assert.match(src, /export function buildHeaders\s*\(\s*\)/);
  });

  it('sets Content-Type to application/json', () => {
    assert.match(src, /Content-Type.*application\/json/);
  });

  it('sets Accept-Language header using getStoredLocale for backend i18n', () => {
    assert.match(src, /Accept-Language/);
    assert.match(src, /getStoredLocale/);
  });

  it('never references an Authorization header anywhere in the module', () => {
    assert.doesNotMatch(src, /Authorization/);
  });

  it('never references a Bearer-token scheme anywhere in the module', () => {
    assert.doesNotMatch(src, /Bearer/);
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

  it('defaults its baseUrl to the module-level DEFAULT_BASE_URL', () => {
    assert.match(src, /export async function fetchCookieSession\s*\(\s*baseUrl\s*=\s*DEFAULT_BASE_URL\s*\)/);
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
