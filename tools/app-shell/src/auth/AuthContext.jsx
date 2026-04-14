import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'sf_auth_token';
const USERNAME_KEY = 'sf_auth_user';
const ROLELIST_KEY = 'sf_auth_rolelist';
const SELECTED_ROLE_KEY = 'sf_auth_selected_role';
const SELECTED_ORG_KEY = 'sf_auth_selected_org';
const PLATFORM_TOKEN_KEY = 'sf_platform_token';

function safeJsonParse(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY));
  const [roleList, setRoleList] = useState(() => safeJsonParse(ROLELIST_KEY) || []);
  const [selectedRole, setSelectedRole] = useState(() => safeJsonParse(SELECTED_ROLE_KEY));
  const [selectedOrg, setSelectedOrg] = useState(() => safeJsonParse(SELECTED_ORG_KEY));

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
    setRoleList([]);
    setSelectedRole(null);
    setSelectedOrg(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(ROLELIST_KEY);
    localStorage.removeItem(SELECTED_ROLE_KEY);
    localStorage.removeItem(SELECTED_ORG_KEY);
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
  }, []);

  const value = useMemo(() => ({
    token,
    username,
    isAuthenticated: !!token,
    roleList,
    selectedRole,
    selectedOrg,
    logout,
  }), [token, username, roleList, selectedRole, selectedOrg, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
