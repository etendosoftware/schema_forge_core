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
  // Depend on WHETHER there is a session, never on the context object's identity: a provider
  // (or a test double) that hands back a fresh object each render would otherwise produce a
  // fresh request function each render, and any effect that lists it as a dependency would
  // re-fire forever.
  const hasSession = auth != null;

  return useMemo(() => createApiFetch(
    baseUrl,
    hasSession ? () => token : getAmbientToken,
    logout || notifyAmbientUnauthorized,
  ), [baseUrl, hasSession, token, logout]);
}
