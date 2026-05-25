import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { createLocalAuthStorage, normalizeAuthSession } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children, storage, initialSession, onSessionChange }) {
  const authStorage = useMemo(() => storage || createLocalAuthStorage(), [storage]);
  const [session, setSessionState] = useState(() => normalizeAuthSession({
    ...authStorage.read(),
    ...initialSession,
  }));

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
  }, [authStorage, onSessionChange]);

  const selectOrg = useCallback((org) => {
    persistSession({ ...session, selectedOrg: org || null });
  }, [persistSession, session]);

  const selectRole = useCallback((role) => {
    persistSession({ ...session, selectedRole: role || null });
  }, [persistSession, session]);

  const setSession = useCallback((nextSession) => {
    persistSession({ ...session, ...nextSession });
  }, [persistSession, session]);

  const value = useMemo(() => ({
    ...session,
    isAuthenticated: !!session.token,
    setSession,
    login: setSession,
    selectRole,
    selectOrg,
    logout,
  }), [session, setSession, selectRole, selectOrg, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
