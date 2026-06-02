import { useMemo } from 'react';
import { createApiFetch } from './api.js';
import { useAuth } from './AuthContext.jsx';

export function useApiFetch(baseUrl) {
  const { token, logout } = useAuth();

  return useMemo(() => {
    function getToken() {
      return token;
    }

    return createApiFetch(baseUrl, getToken, logout);
  }, [baseUrl, token, logout]);
}
