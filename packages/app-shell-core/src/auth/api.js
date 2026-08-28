import { getStoredLocale } from '../i18n/useLocaleState.js';
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
 * Always use this (or {@link buildHeaders} for writes) instead of hand-rolling
 * `{ Authorization: `Bearer ${token}` }` — that omission is exactly the defect
 * this helper exists to prevent, and a repo guardrail test enforces it.
 *
 * @param {string} [token] bearer token; omitted when absent
 * @returns {Record<string,string>} headers for a read request
 */
export function authHeaders(token) {
  const headers = {
    'Accept-Language': getStoredLocale(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Headers for a WRITE request (POST/PUT/DELETE with a JSON body): everything
 * {@link authHeaders} sends, plus `Content-Type: application/json`.
 */
export function buildHeaders(token) {
  return {
    ...authHeaders(token),
    'Content-Type': 'application/json',
  };
}

export function isTokenExpired(token) {
  return !token;
}

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
 * Silent in production: it says nothing a user can act on, and the legitimate non-record writes
 * would make it noise.
 */
function warnUnversionedUpdate(method, path) {
  if (import.meta.env?.DEV !== true) return;
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
  res.clone().json().then((data) => {
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
export function createApiFetch(baseUrl, getToken, onUnauthorized) {
  return async function apiFetch(path, options = {}) {
    const {
      on401, credentials, baseUrl: baseUrlOverride, token: tokenOverride,
      headers: extraHeaders, ...rest
    } = options;
    const token = tokenOverride !== undefined ? tokenOverride : getToken();
    // A bodyless request (GET, DELETE) gets authHeaders, which deliberately omits
    // Content-Type — declaring a body type on a request that has no body is wrong, and
    // it also keeps a migrated call site byte-identical on the wire to the raw `fetch`
    // it replaced.
    const canonical = rest.body === undefined ? authHeaders(token) : buildHeaders(token);
    const headers = { ...canonical, ...extraHeaders };
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
      onUnauthorized?.();
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
  ambientSession = {
    getToken: typeof getToken === 'function' ? getToken : () => null,
    onUnauthorized: typeof onUnauthorized === 'function' ? onUnauthorized : () => {},
    baseUrl,
  };
  return function unregister() {
    if (ambientSession && ambientSession.getToken === getToken) ambientSession = null;
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
}

/**
 * Authenticated `fetch` bound to the ambient session — same contract and same extra
 * options as the function {@link createApiFetch} returns.
 */
export function apiFetch(path, options = {}) {
  const session = ambientSession;
  return createApiFetch(
    session ? session.baseUrl : undefined,
    session ? session.getToken : () => null,
    session ? session.onUnauthorized : () => {},
  )(path, options);
}
