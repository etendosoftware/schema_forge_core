import { useMemo } from 'react';
import { createApiFetch, getAmbientToken, notifyAmbientUnauthorized } from './api.js';
import { useAuthOptional } from './AuthContext.jsx';

/**
 * The authenticated `fetch` for a component or hook: {@link createApiFetch} bound to the
 * current session, with the same contract and the same extra options (`on401`,
 * `credentials`).
 *
 * Works WITHOUT an `AuthProvider` above it, falling back to the ambient session
 * (ETP-5022). That is not cosmetic: this hook replaced a raw `fetch` in ~105 components
 * whose existing tests render them bare, and throwing "useAuth must be used within
 * AuthProvider" would have forced a provider wrapper into hundreds of test files — a
 * larger and riskier change than the migration it was enabling. In the running app the
 * ambient session is registered by `AuthProvider`, so the token resolves either way; in
 * a test with neither, the request goes out anonymous, which is exactly what the raw
 * `fetch` it replaced did.
 *
 * @param {string} [baseUrl] prefix for relative paths; omit to use the base detected
 *   from the page location
 */
export function useApiFetch(baseUrl) {
  const auth = useAuthOptional();
  const token = auth?.token ?? null;
  const logout = auth?.logout;

  return useMemo(() => createApiFetch(
    baseUrl,
    auth ? () => token : getAmbientToken,
    logout || notifyAmbientUnauthorized,
  ), [baseUrl, auth, token, logout]);
}
