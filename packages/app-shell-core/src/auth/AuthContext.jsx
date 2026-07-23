import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createLocalAuthStorage, normalizeAuthSession } from './session.js';

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
  }), [session, windowAccess, capabilities, setSession, selectRole, selectOrg, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
