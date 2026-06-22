import { getStoredLocale } from '../i18n/useLocaleState.js';

export function detectBaseUrl() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env.VITE_API_BASE || '';
}

const DEFAULT_BASE_URL = detectBaseUrl();
console.log('[api.js] DEFAULT_BASE_URL:', JSON.stringify(DEFAULT_BASE_URL), 'pathname:', window.location.pathname, 'VITE_API_BASE:', import.meta.env.VITE_API_BASE);

export function buildHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    // Propagate the UI locale so the backend resolves AD_Message translations
    // in the language the user selected in the frontend.
    'Accept-Language': getStoredLocale(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function isTokenExpired(token) {
  return !token;
}

export function createApiFetch(baseUrl, getToken, onUnauthorized) {
  return async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { ...buildHeaders(token), ...options.headers };
    // FormData requires the browser to set Content-Type with the multipart boundary
    if (options.body instanceof FormData) delete headers['Content-Type'];
    const res = await fetch(`${baseUrl != null ? baseUrl : DEFAULT_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });
    if (res.status === 401) {
      onUnauthorized();
      throw new Error('Unauthorized');
    }
    return res;
  };
}
