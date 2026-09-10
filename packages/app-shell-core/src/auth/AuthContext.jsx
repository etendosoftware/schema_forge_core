import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createLocalAuthStorage, normalizeAuthSession, decodeJwtRole } from './session.js';
import { registerApiSession, createApiFetch } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children, storage, initialSession, onSessionChange, fetchWindowAccess }) {
  const authStorage = useMemo(() => storage || createLocalAuthStorage(), [storage]);
  const [session, setSessionState] = useState(() => normalizeAuthSession({
    ...authStorage.read(),
    ...initialSession,
  }));
  // ETP-4520 — per-window access tier ("none" | "read-only" | "full") and named
  // capability flags, resolved from the SFWindowAccessMap webhook. Transient
  // (NOT persisted via `storage`): re-fetched every time a role is selected, so
  // it never goes stale across a role switch and never survives a stale reload
  // with the wrong tenant's access. Fail-closed defaults ({}) — useWindowAccess
  // / useHasCapability treat an unloaded map the same as "no access granted".
  const [windowAccess, setWindowAccess] = useState({});
  const [capabilities, setCapabilities] = useState({});
  // ETP-4520 — request-sequencing guard against a stale-response race: if
  // role A is selected then role B before A's fetchWindowAccess resolves, A's
  // slower response can land AFTER B's and overwrite B's correct maps with
  // A's stale ones. Every selectRole() call increments this ref immediately;
  // only the response whose captured id still matches the ref's CURRENT value
  // at resolution time is allowed to apply state (i.e. no newer selectRole
  // call has started since). A plain monotonic counter is enough here — no
  // AbortController, since the host app's fetchWindowAccess isn't guaranteed
  // to accept a cancellation signal.
  const selectRoleRequestIdRef = useRef(0);
  // ETP-4520 — tracks the role we've already fetched (or started fetching)
  // window access for. Shared between selectRole() and the hydration effect
  // below so an explicit selectRole() call doesn't get immediately re-fired by
  // the effect once `session.selectedRole` settles to the same value.
  const fetchedForRoleRef = useRef(undefined);

  const persistSession = useCallback((nextSession) => {
    const normalized = normalizeAuthSession(nextSession);
    setSessionState(normalized);
    authStorage.write(normalized);
    onSessionChange?.(normalized);
    return normalized;
  }, [authStorage, onSessionChange]);

  const logout = useCallback(() => {
    const clearedSession = normalizeAuthSession();
    setSessionState(clearedSession);
    authStorage.clear();
    onSessionChange?.(clearedSession);
    setWindowAccess({});
    setCapabilities({});
    // ETP-4520 — abandon any in-flight selectRole() fetch too: bumping the
    // ref makes its stale-response guard (`selectRoleRequestIdRef.current
    // !== thisRequestId`) discard a late-arriving resolution instead of
    // repopulating windowAccess/capabilities with the pre-logout role's data.
    selectRoleRequestIdRef.current += 1;
    fetchedForRoleRef.current = undefined;
  }, [authStorage, onSessionChange]);

  const selectOrg = useCallback((org) => {
    persistSession({ ...session, selectedOrg: org || null });
  }, [persistSession, session]);

  // ETP-4520 — fetches the window-access map for the given (already-persisted)
  // session. Shared by selectRole() and the hydration effect below, so there is
  // exactly one place that calls the host-supplied `fetchWindowAccess` fetcher
  // and applies its result with the stale-response guard. Fire-and-forget: the
  // caller is not blocked on the network round trip. On failure (or when no
  // fetcher is configured) the fail-closed defaults are left in place.
  const runFetchWindowAccess = useCallback((nextSession) => {
    const thisRequestId = ++selectRoleRequestIdRef.current;
    // Fail closed IMMEDIATELY: clear the previous role's maps before kicking
    // off the fetch, so the UI never briefly (or permanently, on failure)
    // keeps showing a prior role's access while this fetch is in flight.
    setWindowAccess({});
    setCapabilities({});
    if (typeof fetchWindowAccess !== 'function') return;
    // Deferring the call itself into the promise chain (rather than
    // `Promise.resolve(fetchWindowAccess(nextSession))`) also catches a
    // SYNCHRONOUS throw from the host app's fetcher, routing it through the
    // same `.catch()` as a rejected promise instead of propagating out
    // uncaught.
    Promise.resolve()
      .then(() => fetchWindowAccess(nextSession))
      .then((result) => {
        // Stale-response guard: if a newer fetch has started since this one
        // (another selectRole call, or the hydration effect firing again),
        // its result already owns windowAccess/capabilities — a late-arriving
        // response for an abandoned request must never overwrite it.
        if (selectRoleRequestIdRef.current !== thisRequestId) return;
        setWindowAccess(result?.windowAccess ?? {});
        setCapabilities(result?.capabilities ?? {});
      })
      .catch(() => {
        // Fail closed: leave the (already cleared, default {}) maps in place.
      });
  }, [fetchWindowAccess]);

  const selectRole = useCallback((role) => {
    // Bump the request id FIRST, on every path (including the immediate-
    // return "no role" branch) — this abandons any in-flight fetch from a
    // previous selectRole call before it can ever apply its result.
    selectRoleRequestIdRef.current += 1;
    const nextSession = persistSession({ ...session, selectedRole: role || null });
    fetchedForRoleRef.current = role || null;
    if (!role) {
      setWindowAccess({});
      setCapabilities({});
      return;
    }
    runFetchWindowAccess(nextSession);
  }, [persistSession, session, runFetchWindowAccess]);

  // ETP-4520 — hydration bootstrap: covers session state that already carries
  // a `selectedRole` WITHOUT ever going through selectRole() itself — e.g. a
  // page reload that rehydrates a persisted session from storage, or a host
  // app whose login flow sets `selectedRole` directly via setSession()/login()
  // rather than calling selectRole(). Without this, windowAccess/capabilities
  // would stay at their fail-closed {} defaults for the entire session (this
  // was a real gap: fetchWindowAccess was previously ONLY reachable from
  // inside selectRole(), which no host app call site actually invokes today).
  useEffect(() => {
    if (!session.selectedRole) return;
    if (fetchedForRoleRef.current === session.selectedRole) return;
    fetchedForRoleRef.current = session.selectedRole;
    runFetchWindowAccess(session);
    // Only re-run when the role value itself changes — not on every session
    // update (e.g. selectOrg) — and intentionally reads the latest `session`/
    // `runFetchWindowAccess` closures rather than listing them as deps, since
    // this effect's own identity only needs to track the role value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.selectedRole]);

  const setSession = useCallback((nextSession) => {
    persistSession({ ...session, ...nextSession });
  }, [persistSession, session]);

  // ETP-5195 — silent refresh: `GET /sws/neo/refreshtoken` (SFRefreshToken.java) reissues the
  // caller's own token with their CURRENT AD_User.Default_Ad_Role_ID, closing the gap where a
  // promote/demote-admin change doesn't take effect until a full logout/login (every NEO
  // request authenticates off the `role` claim embedded at login time, which never re-derives
  // from the DB on its own). Reads the token through a ref rather than the `session` closure so
  // this function's identity stays stable and the effects below never need to re-subscribe.
  const refreshSessionRef = useRef(session);
  refreshSessionRef.current = session;

  const silentlyRefreshToken = useCallback(async () => {
    const currentSession = refreshSessionRef.current;
    if (!currentSession.token) return;
    try {
      // A dedicated fetcher bound to THIS token, independent of the ambient session
      // registered further below — this must work regardless of effect ordering, and
      // `on401: 'ignore'` means an expired/invalid token degrades to a no-op refresh
      // instead of forcing a logout (see the catch block below for the same rule on any
      // other failure).
      const fetchRefreshToken = createApiFetch(undefined, () => currentSession.token, () => {});
      const res = await fetchRefreshToken('/sws/neo/refreshtoken', { on401: 'ignore' });
      if (!res.ok) return;
      const data = await res.json();
      const newToken = data?.token;
      if (!newToken) return;
      const currentRole = decodeJwtRole(currentSession.token);
      const newRole = decodeJwtRole(newToken);
      // No-op when the role hasn't actually changed, to avoid an unnecessary re-render /
      // storage write on every mount and every tab-focus.
      if (!newRole || newRole === currentRole) return;
      // Stale-response guard: if the session this refresh was started against is no longer
      // the CURRENT session (a logout cleared it, or another refresh already swapped its
      // token) by the time this fetch resolves, applying `newToken` now would silently
      // revive a session that's no longer live — e.g. resurrecting a token the user just
      // logged out of. Bail out silently; the in-flight request simply loses the race.
      if (refreshSessionRef.current.token !== currentSession.token) return;
      persistSession({ ...refreshSessionRef.current, token: newToken });
    } catch (err) {
      // Best-effort: a failed background refresh (network error, unexpected 401/500) must
      // never crash the app or force a logout — the existing session/token is left as-is.
      // eslint-disable-next-line no-console
      console.warn('[ETP-5195] Silent token refresh failed; keeping existing session.', err);
    }
  }, [persistSession]);

  // Fires unconditionally once on mount (app bootstrap) ...
  useEffect(() => {
    silentlyRefreshToken();
  }, [silentlyRefreshToken]);

  // ... and again every time the tab regains focus, since a promote/demote can happen from
  // another tab/session while this one is backgrounded. No existing "tab became active again"
  // pattern was found elsewhere in this package (ETP-5195) — `visibilitychange` was chosen over
  // a `window` `focus` listener because it only fires on a genuine tab-visibility transition,
  // not on every window-manager focus event (e.g. a devtools panel gaining focus).
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentlyRefreshToken();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [silentlyRefreshToken]);

  const value = useMemo(() => ({
    ...session,
    isAuthenticated: !!session.token,
    windowAccess,
    capabilities,
    setWindowAccess,
    setCapabilities,
    setSession,
    login: setSession,
    selectRole,
    selectOrg,
    logout,
    // ETP-5195 — imperative trigger for the same silent-refresh flow the mount/tab-focus
    // effects above already run automatically. Lets a caller that just performed a
    // self-service change to ITS OWN role (e.g. a self-promote/demote-admin action) swap
    // the token immediately, without waiting for the next mount or tab-focus. Safe to call
    // any number of times — `silentlyRefreshToken` is itself a no-op when the role claim
    // hasn't actually changed (see its own doc comment above).
    refreshToken: silentlyRefreshToken,
  }), [session, windowAccess, capabilities, setSession, selectRole, selectOrg, logout, silentlyRefreshToken]);

  // ETP-5022 — publishes the live session to the ambient `apiFetch` accessor, so a plain
  // (non-React) module can make an authenticated request without its callers threading
  // `token` and `apiBaseUrl` through every signature. Registered ONCE and reading through
  // refs, deliberately: re-registering on every token change would churn the accessor for
  // no gain, and a stale closure over `session` would hand out a logged-out token after a
  // re-login.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  useEffect(() => registerApiSession({
    getToken: () => sessionRef.current.token,
    onUnauthorized: () => logoutRef.current(),
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Same as {@link useAuth}, but returns `null` instead of throwing when there is no
 * `AuthProvider` above. For infrastructure that must not force every consumer's test to
 * mount a provider — `useApiFetch` is the one caller today.
 */
export function useAuthOptional() {
  return useContext(AuthContext);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
