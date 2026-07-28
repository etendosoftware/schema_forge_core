import { useMemo } from 'react';
import { createApiFetch } from './api.js';
import { useAuth } from './AuthContext.jsx';

export function useApiFetch(baseUrl) {
  const { csrfToken, logout } = useAuth();

  return useMemo(() => {
    function getCsrfToken() {
      return csrfToken;
    }

    return createApiFetch(baseUrl, getCsrfToken, logout);
  }, [baseUrl, csrfToken, logout]);
}
