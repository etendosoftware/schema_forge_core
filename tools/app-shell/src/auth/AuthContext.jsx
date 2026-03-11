import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { login as apiLogin } from './api.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'sf_auth_token';
const ADMIN_TOKEN_KEY = 'sf_admin_token';
const USERNAME_KEY = 'sf_auth_user';
const ROLELIST_KEY = 'sf_auth_rolelist';
const SELECTED_ROLE_KEY = 'sf_auth_selected_role';
const SELECTED_ORG_KEY = 'sf_auth_selected_org';

function safeJsonParse(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export function AuthProvider({ children, baseUrl }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY));
  const [roleList, setRoleList] = useState(() => safeJsonParse(ROLELIST_KEY) || []);
  const [selectedRole, setSelectedRole] = useState(() => safeJsonParse(SELECTED_ROLE_KEY));
  const [selectedOrg, setSelectedOrg] = useState(() => safeJsonParse(SELECTED_ORG_KEY));
  const passwordRef = useRef(null);

  const acquireAdminToken = useCallback(async (base, user, pass) => {
    try {
      const data = await apiLogin(base, user, pass, '0', '0');
      const jwt = data.token;
      setAdminToken(jwt);
      localStorage.setItem(ADMIN_TOKEN_KEY, jwt);
      return jwt;
    } catch (e) {
      console.warn('Could not acquire admin token:', e.message);
      return null;
    }
  }, []);

  const login = useCallback(async (user, password, roleId, orgId) => {
    const data = await apiLogin(baseUrl, user, password, roleId, orgId);
    const jwt = data.token;
    setToken(jwt);
    setUsername(user);
    passwordRef.current = password;
    localStorage.setItem(STORAGE_KEY, jwt);
    localStorage.setItem(USERNAME_KEY, user);

    if (data.roleList) {
      setRoleList(data.roleList);
      localStorage.setItem(ROLELIST_KEY, JSON.stringify(data.roleList));

      const role = roleId
        ? data.roleList.find(r => r.id === roleId)
        : data.roleList[0];
      if (role) {
        setSelectedRole(role);
        localStorage.setItem(SELECTED_ROLE_KEY, JSON.stringify(role));
        const org = orgId
          ? role.orgList?.find(o => o.id === orgId)
          : role.orgList?.[0];
        if (org) {
          setSelectedOrg(org);
          localStorage.setItem(SELECTED_ORG_KEY, JSON.stringify(org));
        }
      }
    }

    // Acquire a separate admin token (role=0, org=0) for Explorer management
    acquireAdminToken(baseUrl, user, password);

    return jwt;
  }, [baseUrl, acquireAdminToken]);

  const switchContext = useCallback(async (roleId, orgId) => {
    const user = localStorage.getItem(USERNAME_KEY);
    const pass = passwordRef.current;
    if (!user || !pass) return;

    const data = await apiLogin(baseUrl, user, pass, roleId, orgId);
    const jwt = data.token;
    setToken(jwt);
    localStorage.setItem(STORAGE_KEY, jwt);

    const role = roleList.find(r => r.id === roleId);
    if (role) {
      setSelectedRole(role);
      localStorage.setItem(SELECTED_ROLE_KEY, JSON.stringify(role));
      const org = orgId
        ? role.orgList?.find(o => o.id === orgId)
        : role.orgList?.[0];
      if (org) {
        setSelectedOrg(org);
        localStorage.setItem(SELECTED_ORG_KEY, JSON.stringify(org));
      }
    }
    return jwt;
  }, [baseUrl, roleList]);

  const logout = useCallback(() => {
    setToken(null);
    setAdminToken(null);
    setUsername(null);
    setRoleList([]);
    setSelectedRole(null);
    setSelectedOrg(null);
    passwordRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(ROLELIST_KEY);
    localStorage.removeItem(SELECTED_ROLE_KEY);
    localStorage.removeItem(SELECTED_ORG_KEY);
  }, []);

  const value = useMemo(() => ({
    token,
    adminToken,
    username,
    isAuthenticated: !!token,
    roleList,
    selectedRole,
    selectedOrg,
    login,
    logout,
    switchContext,
  }), [token, adminToken, username, roleList, selectedRole, selectedOrg, login, logout, switchContext]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
