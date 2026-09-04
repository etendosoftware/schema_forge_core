/**
 * The single place that decides how a request proves who is making it.
 *
 * Two credential schemes coexist while ETP-4576 lands:
 *
 *  - `bearer`  — today's shipped behaviour. `Authorization: Bearer <token>`, the
 *                token held in the client and read from the auth session.
 *  - `cookie`  — the SEC-10 target. The session lives in the `__Host-go_session`
 *                cookie, which the page cannot read, so no header carries a
 *                credential; unsafe methods instead prove intent with
 *                `X-Go-CSRF`.
 *
 * A host normally asks for neither by name and passes `auto`, which resolves to
 * whichever scheme the backend actually issued (see AUTO below). `bearer` remains
 * the fallback for anything unrecognised, so an instance that has not opted in —
 * or a control plane that answers with garbage — keeps working exactly as it does
 * today. The explicit modes stay available for pinning one in a test or rolling
 * back without a redeploy: that is the whole point of routing both through here.
 *
 * WHY MODULE STATE rather than parameters: every caller would otherwise have to
 * thread both credentials AND the mode through to the fetch, which is ~170 call
 * sites across the core and the host. Reading it here means a call site only has
 * to stop hand-building headers — it never learns which scheme is active. The
 * cost is a singleton, which is safe in a browser SPA (one session per document)
 * and is reset between tests by `resetSessionCredentials()`.
 *
 * The auth provider owns the write side: it calls `setSessionCredentials`
 * whenever the session or the preference changes. Nothing else should.
 *
 * DELIBERATELY IMPORT-FREE, and exported as its own `./auth/sessionCredentials.js`
 * subpath alongside the `./auth` barrel. The barrel re-exports `AuthContext.jsx`,
 * so importing the header builders through it drags React — and a `.jsx` file —
 * into the module graph. That is fine under Vite and fatal under plain Node:
 * `node --test` has no JSX loader, so every host unit test whose subject
 * transitively imports a header builder dies with ERR_UNKNOWN_FILE_EXTENSION
 * before a single assertion runs. Asking "what headers does a request carry?"
 * must not require a provider, so keep this file a leaf: no imports, ever.
 */

const BEARER = 'bearer';
const COOKIE = 'cookie';
/**
 * "Whichever one the backend actually issued." Not a third scheme: it is resolved
 * to `bearer` or `cookie` before it ever reaches a header builder.
 *
 * It exists because declaring the scheme by hand is a claim about the BACKEND
 * that the frontend cannot verify, and getting it wrong fails silently in the
 * worst direction. Declaring `cookie` against a backend whose login still
 * answers with a bearer token means the client holds no CSRF proof, so
 * `writeHeaders()` sends none and every unsafe request comes back 403 — while
 * reads keep working, because the browser attaches whatever session cookie
 * exists on its own. That combination (reads fine, writes 403) is exactly what
 * took down the integration suite once the hard-coded `cookie` met a backend
 * that had not been redeployed yet.
 *
 * The backend already tells us which scheme it runs: a cookie session issues a
 * CSRF token (in the login response and in GET /sws/go/session), a bearer
 * backend issues a token and no CSRF. So the presence of a CSRF proof IS the
 * answer, and `auto` reads it instead of being told.
 */
const AUTO = 'auto';

const DEFAULTS = Object.freeze({ mode: BEARER, token: null, csrfToken: null });

let current = { ...DEFAULTS };

/** Credential schemes, for callers that need to branch on more than headers. */
export const CREDENTIAL_MODES = Object.freeze({ bearer: BEARER, cookie: COOKIE, auto: AUTO });

/**
 * Resolves `auto` against the credentials actually held; passes the explicit
 * modes through untouched so a host can still pin one for a test or a rollback.
 *
 * A held CSRF token means the backend issued one, which only a cookie session
 * does. No CSRF token means bearer — including the boot window before the
 * session is restored, where sending nothing is correct anyway because there is
 * no session yet.
 */
function resolveMode(mode, csrfToken) {
  if (mode === COOKIE || mode === BEARER) return mode;
  if (mode === AUTO) return csrfToken ? COOKIE : BEARER;
  return BEARER;
}

/**
 * Publishes the credentials every request builder below will use.
 *
 * Unknown modes fall back to `bearer` rather than throwing: a control plane that
 * answers with garbage must degrade to the working scheme, not break every
 * request in the app.
 *
 * `token` accepts a function as well as a value. ETP-5022's registerApiSession reads
 * the token on EVERY request so a re-login is picked up without re-registering, and
 * storing a snapshot here would have quietly frozen it at whatever was held when the
 * session was declared.
 *
 * @param {{mode?: string, token?: string|(() => string|null)|null, csrfToken?: string|null}} next
 */
export function setSessionCredentials(next = {}) {
  current = {
    mode: resolveMode(next.mode, next.csrfToken ?? null),
    token: next.token ?? null,
    csrfToken: next.csrfToken ?? null,
  };
  return current;
}

/** Restores the defaults. Registered as a global `beforeEach` by test setup. */
export function resetSessionCredentials() {
  current = { ...DEFAULTS };
  return current;
}

/** The active scheme, for the rare caller that needs to branch on it. */
export function getCredentialMode() {
  return current.mode;
}

/** The held CSRF proof, so a caller republishing credentials does not drop it. */
export function getSessionCsrfToken() {
  return current.csrfToken;
}

/**
 * The credential a caller-supplied token would produce, for the one case where the
 * token does not come from the session: a plain module handed a token by its caller
 * (importers, descriptors, report builders — ETP-5022's `token` request option).
 *
 * Lives here rather than at the call site for the same reason as everything else in
 * this module: the literal belongs to the scheme, so under `cookie` this is empty and
 * the request authenticates with the cookie, exactly like every other one.
 */
export function credentialHeadersForToken(token) {
  return current.mode === BEARER && token ? { Authorization: `Bearer ${token}` } : {};
}

/** Resolves `token`, which may have been published as a value or as a provider. */
function currentToken() {
  return typeof current.token === 'function' ? current.token() : current.token;
}

/**
 * Headers for safe methods (GET/HEAD).
 *
 * Under `cookie` these carry no credential at all — the browser attaches the
 * `__Host-` cookie and a read needs no CSRF proof. Under `bearer` they carry the
 * Authorization header, and omit it when no token is held rather than sending
 * the string "Bearer undefined", which is what a template literal over a missing
 * token produces and what earns a 401 that looks like a server fault.
 */
export function jsonHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = currentToken();
  if (current.mode === BEARER && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Headers for unsafe methods (POST/PUT/PATCH/DELETE).
 *
 * Adds `X-Go-CSRF` under `cookie` when a proof is held, and omits the header
 * entirely when it is not, rather than sending an empty value the backend
 * rejects as malformed.
 */
export function writeHeaders() {
  const headers = jsonHeaders();
  if (current.mode === COOKIE && current.csrfToken) {
    headers['X-Go-CSRF'] = current.csrfToken;
  }
  return headers;
}

/**
 * The active credential with NO `Content-Type`, for a request that must not
 * declare one: a bodyless GET against a cross-origin backend, where
 * `application/json` is not a CORS-safelisted value and forces a preflight
 * OPTIONS on every call. Safe methods only — a read carries no CSRF proof.
 *
 * Under `cookie` this is an empty object, which is correct: the browser
 * attaches the `__Host-` cookie and nothing else is needed. A caller must
 * therefore never treat "no headers" as "not authenticated" — that assumption
 * is exactly what a `!token` gate encodes, and it silently cancels the request
 * under a cookie session.
 */
export function readCredentialHeaders() {
  const headers = { ...jsonHeaders() };
  delete headers['Content-Type'];
  return headers;
}

/**
 * Fetch options every caller should spread, so the cookie travels under
 * `cookie` and the choice stays in one place.
 *
 * `credentials: 'include'` is unconditional: under `bearer` it is a no-op for
 * the same-origin requests this app makes, and hard-coding it per mode would
 * mean a second thing to get right at every call site.
 */
export function credentialOptions() {
  return { credentials: 'include' };
}
