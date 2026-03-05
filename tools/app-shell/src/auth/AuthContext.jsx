import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { login as apiLogin } from './api.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'sf_auth_token';
const USERNAME_KEY = 'sf_auth_user';

export function AuthProvider({ children, baseUrl }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY));

  const login = useCallback(async (user, password) => {
    const data = await apiLogin(baseUrl, user, password);
    const jwt = data.token;
    setToken(jwt);
    setUsername(user);
    localStorage.setItem(STORAGE_KEY, jwt);
    localStorage.setItem(USERNAME_KEY, user);
    return jwt;
  }, [baseUrl]);

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }, []);

  const value = useMemo(() => ({
    token,
    username,
    isAuthenticated: !!token,
    login,
    logout,
  }), [token, username, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
