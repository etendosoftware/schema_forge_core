export { AuthProvider, useAuth, useAuthOptional } from './AuthContext.jsx';
export {
  createApiFetch, apiFetch, authHeaders, buildHeaders, detectBaseUrl, isTokenExpired,
  registerApiSession, resetApiSessionForTests, resolveApiUrl,
  getAmbientToken, notifyAmbientUnauthorized,
} from './api.js';
export { createLocalAuthStorage, createMemoryAuthStorage, normalizeAuthSession } from './session.js';
export { LogoutRoute } from './LogoutRoute.jsx';
export { resolveLogoutDestination } from './logoutRoute.js';
export { useApiFetch } from './useApiFetch.js';
export { useWindowAccess, useHasCapability } from './useWindowAccess.js';
export { WindowAccessGuard } from './WindowAccessGuard.jsx';
