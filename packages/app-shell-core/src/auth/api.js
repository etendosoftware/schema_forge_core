import { getStoredLocale } from '../i18n/useLocaleState.js';
import {
  credentialHeadersForToken,
  getCredentialMode,
  getSessionCsrfToken,
  jsonHeaders,
  readCredentialHeaders,
  setSessionCredentials,
  writeHeaders,
} from './sessionCredentials.js';
import { getRecordVersion, rememberRecordVersion } from '../lib/recordVersions.js';

export function detectBaseUrl() {
  // Guarded so this module can be imported outside a browser. `plain node --test` runs
  // (the root `npm test` glob) import modules that transitively reach this file, and an
  // unguarded window access made the whole module unloadable there (ETP-5022).
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env?.VITE_API_BASE || '';
}

/**
 * Resolved on first use rather than at import time, for the same reason: evaluating it
 * while the module loads would run browser-only code in every consumer, test runner
 * included. Cached afterwards, so the browser behaviour is unchanged - one resolution
 * per session.
 */
let cachedBaseUrl;
function defaultBaseUrl() {
  if (cachedBaseUrl === undefined) cachedBaseUrl = detectBaseUrl();
  return cachedBaseUrl;
}

/**
 * Headers for a READ request (GET): auth + the UI locale, and deliberately no
 * `Content-Type` (a GET has no body, so declaring one is wrong).
 *
 * `Accept-Language` is what makes the backend resolve reference data (`*_Trl`
 * names: countries, UoMs, AD_Ref_List, ...) into the locale the user picked in
 * the UI. When it is missing, `NeoAuthenticator.applyRequestLanguage` is a
 * SILENT no-op and the backend falls back to the user's AD language — so
 * selectors come back in English with no error anywhere (ETP-4685, ETP-5022).
 *
 * Always use this (or {@link buildWriteHeaders} for writes) instead of hand-building
 * a credential header. Which one the request carries is not this function's call:
 * sessionCredentials owns that decision, so a call site never learns whether the
 * active scheme is the bearer token or the `__Host-` cookie. A guardrail test keeps
 * this module free of any credential literal for the same reason.
 *
 * @returns {Record<string,string>} headers for a read request
 */
export function authHeaders() {
  // ETP-4576 — the credential comes from the active scheme, not from a parameter:
  // `bearer` puts back the Authorization header, `cookie` sends nothing and lets the
  // `__Host-` session travel on its own. Callers still passing a token are harmless,
  // the argument is ignored. `Accept-Language` stays exactly as ETP-4685/ETP-5022
  // left it — without it the backend silently falls back to the user's AD language.
  return { ...readCredentialHeaders(), 'Accept-Language': getStoredLocale() };
}

/**
 * Headers for a WRITE request (POST/PUT/DELETE with a JSON body): everything
 * {@link authHeaders} sends, plus `Content-Type: application/json`.
 */
export function buildHeaders() {
  return { ...jsonHeaders(), 'Accept-Language': getStoredLocale() };
}

// The write-path pair of buildHeaders: same locale, plus whatever proof the active
// scheme requires on unsafe methods. Never use buildHeaders for a POST/PUT/PATCH/DELETE
// — under the cookie scheme that omits the CSRF proof and the backend answers 403.
export function buildWriteHeaders() {
  return { ...writeHeaders(), 'Accept-Language': getStoredLocale() };
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Resolves a request URL against the client's base URL.
 *
 * Call sites reach this helper in two shapes, and both have to keep working during the
 * raw-`fetch` migration (ETP-5022): a bare path (`/spec/entity?x=1`), which is what a
 * freshly written call site passes, and a URL that ALREADY carries the base
 * (`${apiBaseUrl}/entity`), which is how ~147 pre-existing call sites build their URL.
 * Blindly concatenating would turn the second shape into `/etendo/etendo/entity`, so:
 *
 * - a fully-qualified URL (`https://...`) is used verbatim;
 * - a path that already starts with `base` is used verbatim;
 * - anything else is prefixed with `base`.
 *
 * An empty `base` makes every branch a no-op, which is the correct behaviour when the app
 * is served from the domain root.
 */
export function resolveApiUrl(base, path) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  if (base && path.startsWith(base)) return path;
  return `${base}${path}`;
}

/**
 * The verbs that update an existing record, and therefore need the optimistic-locking token
 * (ETP-5073 / DOC-04). POST is absent on purpose: a create has no prior version to conflict with.
 */
const VERSIONED_WRITE_METHODS = new Set(['PUT', 'PATCH']);

/**
 * Best-effort record id from a request path: the last non-empty segment, query string removed.
 *
 * Covers the NEO record shape (`/spec/entity/<id>`) for a body that does not repeat its own id.
 * A path whose tail is not an id (a collection, an `/action/<name>` sub-route) simply produces a
 * key nothing was ever remembered under, so the lookup misses and no token is injected — the
 * guard against injecting into a non-record write is the cache miss itself, not this parse.
 */
function recordIdFromPath(path) {
  if (typeof path !== 'string') return null;
  const withoutQuery = path.split('?')[0].split('#')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1] : null;
}

/**
 * Adds the remembered `updated` to an update's body so the server's concurrency check can run.
 *
 * Every guard here fails OPEN (returns the request untouched) rather than guessing, because this
 * runs on every request in the app and most of them are not record updates:
 *
 * - not PUT/PATCH — nothing to guard;
 * - a non-string body (`FormData`, a blob) — an upload, not a JSON record write;
 * - a body that is not a JSON object — not a record;
 * - the caller already set `updated` — an explicit value always wins over a remembered one;
 * - no remembered version for this id — either the record was never read through this client, or
 *   the endpoint is not a NEO record at all (an OAuth2 PUT, a fiscal-config PUT). This is the
 *   guard that keeps the injection from corrupting an unrelated write: an id we never saw has no
 *   entry, so nothing is added.
 *
 * When the token is genuinely missing the request goes out without it and the server answers 400
 * `missing_updated`. That is deliberate: it is a loud, actionable failure naming the remedy, and
 * the alternative — writing without a concurrency check — is the defect this ticket exists to fix.
 */
function withRecordVersion(path, rest) {
  const method = String(rest.method || 'GET').toUpperCase();
  if (!VERSIONED_WRITE_METHODS.has(method)) return rest;
  if (typeof rest.body !== 'string') return rest;
  let parsed;
  try {
    parsed = JSON.parse(rest.body);
  } catch {
    return rest;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return rest;
  if (parsed.updated) return rest;
  const version = getRecordVersion(parsed.id ?? recordIdFromPath(path));
  if (version === undefined) {
    warnUnversionedUpdate(method, path);
    return rest;
  }
  return { ...rest, body: JSON.stringify({ ...parsed, updated: version }) };
}

/**
 * Development-only notice that an update is going out with no concurrency token.
 *
 * Two very different situations reach here and only one is a defect, which is why this warns
 * instead of throwing: the endpoint may legitimately not be a NEO record (an OAuth2 PUT, a
 * fiscal-config PUT), or it may be a record the panel never read — the case ETP-5073 has to
 * find. The server answers 400 `missing_updated` for the second, so the failure is already
 * loud in QA; this makes it identifiable at the exact call site while a developer is looking,
 * rather than only as a network error after the fact.
 *
 * Gated on `DEV` being explicitly true rather than on `PROD` being false: outside Vite (a plain
 * `node --test` run) `import.meta.env` is undefined, and a `!PROD` check would treat that as
 * "development" and print this on every suite that exercises an update.
 *
 * `MODE` is checked too because Vitest sets `DEV: true, MODE: 'test'` — so the DEV gate alone
 * still fired throughout the vitest suite, printing this into CI logs and adding a `console.warn`
 * call that any test spying on `console.warn` has to tolerate.
 *
 * Silent in production: it says nothing a user can act on, and the legitimate non-record writes
 * would make it noise.
 */
function warnUnversionedUpdate(method, path) {
  const env = import.meta.env;
  if (env?.DEV !== true || env?.MODE === 'test') return;
  // eslint-disable-next-line no-console
  console.warn(
    `[ETP-5073] ${method} ${path} is going out without an \`updated\` token. If this is a NEO `
    + 'record, the server will refuse it with 400 missing_updated: the panel needs to read the '
    + 'record (so its version is remembered) before writing it. If it is not a NEO record, '
    + 'ignore this.',
  );
}

/**
 * Remembers the version of the record a successful write returned, so a second edit of the same
 * record in one sitting does not replay the token the first edit consumed (which the server would
 * correctly reject as a conflict, against a change the user themself just made).
 *
 * Reads a CLONE of the response: the caller still owns the original body and must be able to
 * `json()` it. Entirely best-effort — a 204, a non-JSON body or an unexpected envelope leaves the
 * cache as it was, and the next write falls back to the loud 400/409 path.
 */
function harvestWrittenVersion(res) {
  // `clone` is guarded, not assumed: a real `Response` always has it, but a test that stubs
  // `fetch` with a plain `{ ok, json }` object legitimately does not, and harvesting is an
  // optimisation — it must never be the reason a caller's request throws.
  if (!res?.ok || typeof res.clone !== 'function') return;
  const copy = res.clone();
  // And the clone must be a genuinely INDEPENDENT body. A real `Response.clone()` always is, but
  // a hand-rolled double may return `this` — and then reading it here consumes the single-use
  // `json()` the caller was going to read, starving the very request we are decorating. Harvesting
  // is worth nothing next to that, so an inseparable clone is simply skipped.
  if (!copy || copy === res || typeof copy.json !== 'function') return;
  copy.json().then((data) => {
    const record = data?.response?.data?.[0] ?? data;
    rememberRecordVersion(record);
  }).catch(() => {
    // No body, not JSON, or a shape we do not recognise. Nothing to remember.
  });
}

/**
 * The canonical way to make an authenticated request.
 *
 * On top of `fetch` it guarantees the four things every hand-rolled call site had to
 * remember on its own: the canonical headers (so `Accept-Language` is never missing —
 * see {@link authHeaders}), the base URL, `credentials: 'include'`, dropping
 * `Content-Type` for `FormData`, and routing a 401 to the logout handler instead of
 * letting each call site invent its own expired-session behaviour.
 *
 * Recognised extra options (everything else is forwarded to `fetch` untouched):
 *
 * - `on401: 'ignore'` — do NOT log out or throw; hand the 401 response back to the
 *   caller. For endpoints whose 401 is a domain answer rather than an expired session
 *   (e.g. `lib/upgrade/api.js` maps it to its own `sessionExpired` error code), and for
 *   probes that treat "unauthorized" as "feature unavailable".
 * - `credentials` — overrides the default `'include'`.
 * - `token` — use this bearer token instead of the session's. For a plain module that is
 *   handed a token by its caller (importers, descriptors, report builders): the request
 *   stays explicit about whose token it uses, and the module keeps working with no session
 *   registered at all.
 * - `baseUrl: ''` — for a URL that is already complete, or that points outside the base
 *   (a helper such as `buildCreateUrl` returns a sibling path from the app root, which
 *   the base-prefix guard cannot recognise as already-resolved).
 *
 * @param {string|null|undefined} baseUrl prefix for relative paths; `null`/`undefined`
 *   falls back to the base detected from the page location
 * @param {() => (string|null)} getToken reads the current bearer token
 * @param {() => void} onUnauthorized invoked once when a 401 is not ignored
 */
export function createApiFetch(baseUrl, getCsrfToken, onUnauthorized) {
  return async function apiFetch(path, options = {}) {
    const {
      on401, credentials, baseUrl: baseUrlOverride, token: tokenOverride,
      headers: extraHeaders, ...rest
    } = options;
    const method = (options.method || 'GET').toUpperCase();
    const unsafe = UNSAFE_METHODS.has(method);
    // ETP-5022 — a bodyless request declares no Content-Type. ETP-4576 — an unsafe one
    // still carries the scheme's proof. Independent: a bodyless DELETE needs both.
    let canonical;
    if (rest.body === undefined) {
      canonical = unsafe
        ? { ...writeHeaders(), 'Accept-Language': getStoredLocale() }
        : authHeaders();
      delete canonical['Content-Type'];
    } else {
      canonical = unsafe ? buildWriteHeaders() : buildHeaders();
    }
    const headers = {
      ...canonical,
      ...(tokenOverride ? credentialHeadersForToken(tokenOverride) : {}),
      ...extraHeaders,
    };
    if (unsafe) {
      const csrfToken = getCsrfToken();
      if (csrfToken) headers['X-Go-CSRF'] = csrfToken;
    }
    if (rest.body instanceof FormData) delete headers['Content-Type'];
    const configured = baseUrlOverride !== undefined ? baseUrlOverride : baseUrl;
    const base = configured != null ? configured : defaultBaseUrl();
    // ETP-5073 / DOC-04: the optimistic-locking token is attached here, not at the ~41 call sites
    // that issue an update. See `withRecordVersion` for why every guard fails open.
    const withVersion = withRecordVersion(path, rest);
    const res = await fetch(resolveApiUrl(base, path), {
      ...withVersion,
      credentials: credentials || 'include',
      headers,
    });
    if (VERSIONED_WRITE_METHODS.has(String(rest.method || '').toUpperCase())) {
      harvestWrittenVersion(res);
    }
    if (res.status === 401 && on401 !== 'ignore') {
      onUnauthorized();
      throw new Error('Unauthorized');
    }
    return res;
  };
}

/**
 * Ambient session accessor, so a NON-React module can make an authenticated request
 * without every one of its callers threading `token` and `apiBaseUrl` through the
 * signature (ETP-5022). `useApiFetch` stays the right tool inside a component or hook;
 * this exists for the plain-module layer underneath it (importers, descriptors,
 * webhook clients) where there is no React context to read.
 *
 * Registered once by the app shell. Until then {@link apiFetch} falls back to an
 * anonymous request rather than throwing, so a module that loads before the provider
 * mounts (or in a test that never mounts one) behaves like the raw `fetch` it replaced.
 */
let ambientSession = null;

export function registerApiSession({ getToken, onUnauthorized, baseUrl } = {}) {
  const readToken = typeof getToken === 'function' ? getToken : () => null;
  ambientSession = {
    getToken: readToken,
    onUnauthorized: typeof onUnauthorized === 'function' ? onUnauthorized : () => {},
    baseUrl,
  };
  // ETP-4576 — declaring the session also publishes its credential to the one place
  // that decides. The reader is handed over rather than its current value, so the
  // token is still read on every request (ETP-5022) and a re-login is picked up
  // without re-registering. The mode is left alone: under `cookie` this token is
  // simply never consulted, which is what makes the preference switchable.
  setSessionCredentials({
    mode: getCredentialMode(),
    token: readToken,
    csrfToken: getSessionCsrfToken(),
  });
  return function unregister() {
    if (ambientSession && ambientSession.getToken === getToken) {
      ambientSession = null;
      setSessionCredentials({
        mode: getCredentialMode(),
        token: null,
        csrfToken: getSessionCsrfToken(),
      });
    }
  };
}

/**
 * Reads the ambient bearer token, or null when no session is registered. Lets
 * {@link useApiFetch} keep working in a tree with no `AuthProvider` above it instead of
 * throwing — see its own doc comment for why that matters.
 */
export function getAmbientToken() {
  return ambientSession ? ambientSession.getToken() : null;
}

/** Fires the ambient logout handler, if one is registered. */
export function notifyAmbientUnauthorized() {
  ambientSession?.onUnauthorized();
}

/** Test seam: drops the ambient session so suites do not leak one into the next. */
export function resetApiSessionForTests() {
  ambientSession = null;
  // Also drops the credential the session published: leaving it behind let one test's
  // token authenticate the next one's supposedly anonymous request.
  setSessionCredentials({ mode: getCredentialMode(), token: null, csrfToken: getSessionCsrfToken() });
}

/**
 * Authenticated `fetch` bound to the ambient session — same contract and same extra
 * options as the function {@link createApiFetch} returns.
 */
export function apiFetch(path, options = {}) {
  const session = ambientSession;
  // Second argument is the CSRF proof, not the credential: `session.getToken` returns the
  // bearer, and passing it here shipped it as `X-Go-CSRF`. The proof lives on the active
  // scheme, which registerApiSession keeps up to date.
  return createApiFetch(
    session ? session.baseUrl : undefined,
    getSessionCsrfToken,
    session ? session.onUnauthorized : () => {},
  )(path, options);
}

// ETP-4576 — restores the backend-managed session (ADR-0001). This is the
// platform default for AuthProvider's `restoreSession`, so a host gets the
// cookie session without wiring anything; passing the prop overrides it.
// Authenticates purely with the `__Host-` cookie: `credentials: 'include'` and
// no Authorization header, since the browser never holds a bearer token.
// Fails closed with null on the 401 for "no session", a network error, or an
// unparsable body — every one of those means "not authenticated".
export async function fetchCookieSession(baseUrl = defaultBaseUrl()) {
  try {
    const res = await fetch(`${baseUrl}/sws/go/session`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ETP-4576 — revokes the session server-side (ADR-0001). Without this the
// cookie outlives a "logout" and the session stays valid on the server, so
// clearing client state alone is not a logout at all.
//
// DELETE is an unsafe method, so the backend requires the CSRF proof; callers
// must pass the token the session held BEFORE they cleared it. Never throws:
// the local logout has to proceed even if the network call fails, or a user who
// asked to log out would stay stuck in the session. Returns whether the server
// confirmed the revoke.
export async function deleteCookieSession(csrfToken, baseUrl = defaultBaseUrl()) {
  try {
    const headers = {};
    if (csrfToken) headers['X-Go-CSRF'] = csrfToken;
    const res = await fetch(`${baseUrl}/sws/go/session`, {
      method: 'DELETE',
      credentials: 'include',
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}
