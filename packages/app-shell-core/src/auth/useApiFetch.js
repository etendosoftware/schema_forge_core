import { useMemo } from 'react';
import { createApiFetch, notifyAmbientUnauthorized } from './api.js';
import { getSessionCsrfToken } from './sessionCredentials.js';
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

  // The fallback reads the CSRF proof off the active scheme, NOT `getAmbientToken`. That
  // slot is the proof, and the ambient token is the bearer: handing it over sent the
  // credential out as `X-Go-CSRF` under the bearer scheme, and under the cookie one it put
  // a value that is not the proof where the proof belongs — so every unsafe request from a
  // component rendered outside a provider came back 403.
  return useMemo(() => createApiFetch(
    baseUrl,
    hasSession ? () => csrfToken : getSessionCsrfToken,
    logout || notifyAmbientUnauthorized,
  ), [baseUrl, hasSession, csrfToken, logout]);
}
