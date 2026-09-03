/**
 * Post-authentication continuation shared by every authentication branch of
 * `LoginStep` (password and each SSO provider).
 *
 * ETP-4958: this used to be duplicated inline in both branches. When the
 * caller-owned `onAuthenticated` continuation was introduced only the password
 * copy was updated, so an SSO login on the invitation page persisted the
 * session and then did nothing — the caller never got its callback and the user
 * was stranded on the login form. Keeping a single implementation makes that
 * class of divergence impossible.
 *
 * The contract, in order:
 *   1. Persist the authentication state (token, account name, auth method).
 *   2. Route by environments ONLY when the caller has not taken ownership of
 *      the continuation — a caller that passes `onAuthenticated` is resuming
 *      its own flow and must not be navigated away from it.
 *   3. Hand control to the caller, if it asked for it.
 *
 * @param {object} params
 * @param {string} params.token           Session token returned by the backend.
 * @param {object} [params.account]       Authenticated account payload.
 * @param {'password'|'sso'} params.authMethod  How the session was obtained.
 * @param {(token: string, account: object, options: {route: boolean, authMethod: string}) => Promise<void>} params.persistAuth
 *        Persists auth state and performs the default environment routing.
 * @param {'cookie'|'bearer'} [params.scheme] Which credential the backend issued —
 *        see {@link credentialSchemeFromLoginResponse}. Forwarded to the caller so it
 *        knows how to SEND `token` back; without it the caller has to guess, and
 *        guessing wrong is silent (a CSRF proof sent as a bearer earns a 401, a bearer
 *        sent as a CSRF proof earns a 403).
 * @param {(token: string, account: object, meta: {scheme: string}) => Promise<void>} [params.onAuthenticated]
 *        Caller-owned continuation. When present, default routing is skipped.
 */
/**
 * Where the auth METHOD is recorded. Not the credential — that is never stored.
 *
 * The distinction is the whole reason this export exists. ETP-4576 removed both
 * keys at once, which was too broad: this one is not a credential, it records
 * how the user signed in, and the host's UserAvatarButton reads it to hide the
 * change-password action from SSO users. With nothing written,
 * `getItem(...) !== 'sso'` holds for everyone and an SSO user is offered a
 * password they never set.
 */
export const AUTH_METHOD_STORAGE_KEY = 'sf_platform_auth_method';

/**
 * Records how the session was obtained. Called by every step that authenticates,
 * so the note above lives in one place instead of being pasted into each.
 *
 * @param {'password'|'sso'} authMethod
 */
export function persistAuthMethod(authMethod) {
  localStorage.setItem(AUTH_METHOD_STORAGE_KEY, authMethod);
}

/** The two credential schemes a login response can carry. */
export const CREDENTIAL_SCHEMES = Object.freeze({ cookie: 'cookie', bearer: 'bearer' });

/**
 * Which scheme a login/SSO response used, decided by the ONE signal that separates
 * them: a `csrfToken` is only ever issued alongside a `__Host-` session cookie.
 *
 * ETP-4576 — this exists so the rule lives in a single place. `LoginStep` already
 * collapsed both shapes into one `csrfToken ?? token` credential, which loses the
 * very information the caller needs to send it back correctly: under `cookie` the
 * value is a CSRF proof that belongs in `X-Go-CSRF` (with the cookie riding along),
 * under `bearer` it is a token that belongs in `Authorization`. Putting one in the
 * other's slot fails, and fails DIFFERENTLY on each side (401 vs 403), which is how
 * the invitation accept spent a week looking like two unrelated bugs.
 *
 * @param {{csrfToken?: string, token?: string}} data login response payload
 * @returns {'cookie'|'bearer'}
 */
export function credentialSchemeFromLoginResponse(data) {
  return data?.csrfToken ? CREDENTIAL_SCHEMES.cookie : CREDENTIAL_SCHEMES.bearer;
}

export async function completeAuthentication({
  token,
  account,
  authMethod,
  scheme,
  persistAuth,
  onAuthenticated,
}) {
  await persistAuth(token, account, {
    route: !onAuthenticated,
    authMethod,
  });

  if (onAuthenticated) {
    await onAuthenticated(token, account, { scheme });
  }
}

export default completeAuthentication;
