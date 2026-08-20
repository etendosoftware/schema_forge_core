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
 * `bearer` is the default, deliberately. The backend preference that turns the
 * cookie session on (see com.etendoerp.go) is what flips this, so an instance
 * that has not opted in — or a control plane that cannot answer — keeps working
 * exactly as it does today. Flipping it back is a database change, not a
 * redeploy: that is the whole point of routing both schemes through here.
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

const DEFAULTS = Object.freeze({ mode: BEARER, token: null, csrfToken: null });

let current = { ...DEFAULTS };

/** Credential schemes, for callers that need to branch on more than headers. */
export const CREDENTIAL_MODES = Object.freeze({ bearer: BEARER, cookie: COOKIE });

/**
 * Publishes the credentials every request builder below will use.
 *
 * Unknown modes fall back to `bearer` rather than throwing: a control plane that
 * answers with garbage must degrade to the working scheme, not break every
 * request in the app.
 *
 * @param {{mode?: string, token?: string|null, csrfToken?: string|null}} next
 */
export function setSessionCredentials(next = {}) {
  current = {
    mode: next.mode === COOKIE ? COOKIE : BEARER,
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
  if (current.mode === BEARER && current.token) {
    headers.Authorization = `Bearer ${current.token}`;
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
