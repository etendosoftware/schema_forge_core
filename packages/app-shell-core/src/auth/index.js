export { AuthProvider, useAuth, useAuthOptional } from './AuthContext.jsx';
// ETP-4576 — `isTokenExpired` is gone from api.js along with the bearer token it
// asked about, so it is not re-exported here: a barrel re-exporting a binding that
// no longer exists is `undefined` under Vite's transform and a link error under
// native ESM.
export {
  apiFetch, authHeaders, buildHeaders, buildWriteHeaders, createApiFetch, detectBaseUrl,
  deleteCookieSession, fetchCookieSession, readCookieSession, isSessionUnavailable,
  isSessionAliveUnauthorized,
  sessionUnavailableError, whenSessionRevokeSettles, getAmbientToken, notifyAmbientUnauthorized,
  registerApiSession, resetApiSessionForTests, resolveApiUrl,
  replaceAmbientSession,
} from './api.js';
// ETP-5424 — the error apiFetch throws for a transport failure, and the one-time hook the host
// app uses to localize its message.
export {
  DEFAULT_API_TIMEOUT_MS, NETWORK_ERROR_FALLBACK, NETWORK_ERROR_KEY, NetworkError,
  isNetworkError, registerErrorTranslator, resetErrorTranslatorForTests,
} from './networkError.js';
export {
  createLocalAuthStorage,
  createMemoryAuthStorage,
  decodeJwtPayload,
  decodeJwtRole,
  decodeJwtUser,
  mapRestoredSession,
  normalizeAuthSession,
  purgeLegacyAuthStorage,
} from './session.js';
// ETP-4576 — the one place that decides bearer-vs-cookie. Host call sites import the
// header builders from here and never branch on the scheme themselves; the provider
// owns `setSessionCredentials`.
export {
  ACCOUNT_HEADER,
  CREDENTIAL_MODES,
  credentialOptions,
  getCredentialMode,
  getSessionAccountId,
  getSessionCsrfToken,
  jsonHeaders,
  readCredentialHeaders,
  resetSessionCredentials,
  setSessionCredentials,
  writeHeaders,
} from './sessionCredentials.js';
export {
  ACCOUNT_MISMATCH_MESSAGE,
  SESSION_CHANNEL_NAME,
  SESSION_RECHECK_INTERVAL_MS,
  announceSessionAccount,
  clearSessionConflict,
  compareLiveSessionAccount,
  getSessionConflict,
  isAccountMismatchText,
  listenSessionAccount,
  observeSessionConflictResponse,
  reportSessionConflict,
  resetSessionConflictForTests,
  subscribeSessionConflict,
} from './sessionConflict.js';
export { LogoutRoute } from './LogoutRoute.jsx';
export { resolveLogoutDestination } from './logoutRoute.js';
export { useApiFetch } from './useApiFetch.js';
export { useWindowAccess, useHasCapability } from './useWindowAccess.js';
export { WindowAccessGuard } from './WindowAccessGuard.jsx';
