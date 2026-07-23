import { createContext, useContext, useState, useCallback, useMemo } from 'react';
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
  }, [authStorage, onSessionChange]);

  const selectOrg = useCallback((org) => {
    persistSession({ ...session, selectedOrg: org || null });
  }, [persistSession, session]);

  // ETP-4520 — fetches the window-access map at the same lifecycle moment a
  // role gets selected (mirrors how `selectedRole.orgList` is populated). The
  // actual webhook call (`GET /webhooks/SFWindowAccessMap`) is injected by the
  // host app via the `fetchWindowAccess` prop — this package stays backend-
  // agnostic and never hardcodes a webhook URL. Fire-and-forget: role
  // selection is not blocked on the network round trip. On failure (or when no
  // fetcher is configured) the fail-closed defaults are left in place.
  const selectRole = useCallback((role) => {
    const nextSession = persistSession({ ...session, selectedRole: role || null });
    if (!role) {
      setWindowAccess({});
      setCapabilities({});
      return;
    }
    // Fail closed IMMEDIATELY on every role switch, not just before the
    // first-ever load: clear the previous role's maps before kicking off the
    // fetch, so the UI never briefly (or permanently, on failure) keeps
    // showing a prior role's access while the new role's fetch is in flight.
    setWindowAccess({});
    setCapabilities({});
    if (typeof fetchWindowAccess !== 'function') return;
    // Deferring the call itself into the promise chain (rather than
    // `Promise.resolve(fetchWindowAccess(nextSession))`) also catches a
    // SYNCHRONOUS throw from the host app's fetcher, routing it through the
    // same `.catch()` as a rejected promise instead of propagating out of
    // `selectRole` uncaught.
    Promise.resolve()
      .then(() => fetchWindowAccess(nextSession))
      .then((result) => {
        setWindowAccess(result?.windowAccess ?? {});
        setCapabilities(result?.capabilities ?? {});
      })
      .catch(() => {
        // Fail closed: leave the (already cleared, default {}) maps in place.
      });
  }, [persistSession, session, fetchWindowAccess]);

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
