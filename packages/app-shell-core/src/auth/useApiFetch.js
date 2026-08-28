import { useMemo } from 'react';
import { createApiFetch, getAmbientToken, notifyAmbientUnauthorized } from './api.js';
import { useAuthOptional } from './AuthContext.jsx';

// What this hook hands createApiFetch is `csrfToken`, never a client-held credential
// (ETP-4576): under the cookie scheme the browser holds none, the `__Host-` session
// travels on its own, and what the client must supply is the proof of intent on unsafe
// methods. Under the bearer scheme sessionCredentials restores the credential header
// inside the shared builders, so this hook is identical either way.
//
// The optional-context shape and the ambient fallback are ETP-5022's (a module used
// outside a provider still gets an authenticated request). Depends on WHETHER there is
// a session, never on the context object's identity: a provider handing back a fresh
// object each render would otherwise produce a fresh request function each render.
export function useApiFetch(baseUrl) {
  const auth = useAuthOptional();
  const csrfToken = auth?.csrfToken ?? null;
  const logout = auth?.logout;
  const hasSession = auth != null;

  return useMemo(() => createApiFetch(
    baseUrl,
    hasSession ? () => csrfToken : getAmbientToken,
    logout || notifyAmbientUnauthorized,
  ), [baseUrl, hasSession, csrfToken, logout]);
}
