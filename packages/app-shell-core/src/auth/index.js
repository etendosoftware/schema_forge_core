export { AuthProvider, useAuth } from './AuthContext.jsx';
// ETP-4576 — `isTokenExpired` used to be re-exported here; it was deleted from
// api.js when the bearer token went away, leaving this barrel re-exporting a
// binding that no longer exists (silently `undefined` under Vite's transform, a
// link error under native ESM).
export { createApiFetch, buildHeaders, detectBaseUrl, fetchCookieSession } from './api.js';
export {
  createLocalAuthStorage,
  createMemoryAuthStorage,
  normalizeAuthSession,
  purgeLegacyAuthStorage,
} from './session.js';
// ETP-4576 — the one place that decides bearer-vs-cookie. Host call sites import
// the two header builders and `credentialOptions` from here and never branch on
// the scheme themselves; the provider owns `setSessionCredentials`.
export {
  CREDENTIAL_MODES,
  credentialOptions,
  getCredentialMode,
  jsonHeaders,
  resetSessionCredentials,
  setSessionCredentials,
  writeHeaders,
} from './sessionCredentials.js';
export { LogoutRoute } from './LogoutRoute.jsx';
export { resolveLogoutDestination } from './logoutRoute.js';
export { useApiFetch } from './useApiFetch.js';
export { useWindowAccess, useHasCapability } from './useWindowAccess.js';
export { WindowAccessGuard } from './WindowAccessGuard.jsx';
