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
 * @param {(token: string, account: object) => Promise<void>} [params.onAuthenticated]
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

export async function completeAuthentication({
  token,
  account,
  authMethod,
  persistAuth,
  onAuthenticated,
}) {
  await persistAuth(token, account, {
    route: !onAuthenticated,
    authMethod,
  });

  if (onAuthenticated) {
    await onAuthenticated(token, account);
  }
}

export default completeAuthentication;
