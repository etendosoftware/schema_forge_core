import { useMemo } from 'react';
import { createApiFetch, getAmbientToken, notifyAmbientUnauthorized } from './api.js';
import { useAuthOptional } from './AuthContext.jsx';

// This hook hands createApiFetch the TOKEN getter, not a CSRF getter (ETP-4576 +
// ETP-5195). The proof of intent on unsafe methods is no longer injected here: api.js
// reads it from ./sessionCredentials.js, whose single writer is AuthProvider. Under the
// cookie scheme the client holds no token and that getter simply returns null — the
// `__Host-` session travels on its own and the builders add the proof — so this hook is
// identical either way, and there is one less way to thread a stale value through.
//
// The optional-context shape and the ambient fallback are ETP-5022's (a module used
// outside a provider still gets an authenticated request). Depends on WHETHER there is
// a session, never on the context object's identity: a provider handing back a fresh
// object each render would otherwise produce a fresh request function each render.
export function useApiFetch(baseUrl) {
  const auth = useAuthOptional();
  const token = auth?.token ?? null;
  const logout = auth?.logout;
  const hasSession = auth != null;
  const scope = auth?.apiSessionScope;

  return useMemo(() => createApiFetch(
    baseUrl,
    scope ? () => scope.getSnapshot().session.token : hasSession ? () => token : getAmbientToken,
    logout || notifyAmbientUnauthorized,
    scope,
  ), [baseUrl, hasSession, token, logout, scope, auth?.authRevision]);
}
