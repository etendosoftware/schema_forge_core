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
    const res = await fetch(resolveApiUrl(base, path), {
      ...rest,
      credentials: credentials || 'include',
      headers,
    });
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
  return createApiFetch(
    session ? session.baseUrl : undefined,
    session ? session.getToken : () => null,
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
