export { AuthProvider, useAuth, useAuthOptional } from './AuthContext.jsx';
// ETP-4576 — `isTokenExpired` is gone from api.js along with the bearer token it
// asked about, so it is not re-exported here: a barrel re-exporting a binding that
// no longer exists is `undefined` under Vite's transform and a link error under
// native ESM.
export {
  apiFetch, authHeaders, buildHeaders, buildWriteHeaders, createApiFetch, detectBaseUrl,
  deleteCookieSession, fetchCookieSession, getAmbientToken, notifyAmbientUnauthorized,
  registerApiSession, resetApiSessionForTests, resolveApiUrl,
} from './api.js';
export {
  createLocalAuthStorage,
  createMemoryAuthStorage,
  normalizeAuthSession,
  purgeLegacyAuthStorage,
} from './session.js';
// ETP-4576 — the one place that decides bearer-vs-cookie. Host call sites import
// the header builders from here and never branch on the scheme themselves; the
// provider owns `setSessionCredentials`.
export {
  CREDENTIAL_MODES,
  credentialOptions,
  getCredentialMode,
  jsonHeaders,
  readCredentialHeaders,
  resetSessionCredentials,
  setSessionCredentials,
  writeHeaders,
} from './sessionCredentials.js';
export { LogoutRoute } from './LogoutRoute.jsx';
export { resolveLogoutDestination } from './logoutRoute.js';
export { useApiFetch } from './useApiFetch.js';
export { useWindowAccess, useHasCapability } from './useWindowAccess.js';
export { WindowAccessGuard } from './WindowAccessGuard.jsx';
