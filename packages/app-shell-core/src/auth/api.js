import { getStoredLocale } from '../i18n/useLocaleState.js';

export function detectBaseUrl() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env?.VITE_API_BASE || '';
}

const DEFAULT_BASE_URL = detectBaseUrl();
console.log('[api.js] DEFAULT_BASE_URL:', JSON.stringify(DEFAULT_BASE_URL), 'pathname:', window.location.pathname, 'VITE_API_BASE:', import.meta.env?.VITE_API_BASE);

/**
 * Headers for a READ request (GET): auth + the UI locale, and deliberately no
 * `Content-Type` (a GET has no body, so declaring one is wrong).
 *
 * `Accept-Language` is what makes the backend resolve reference data (`*_Trl`
 * names: countries, UoMs, AD_Ref_List, ...) into the locale the user picked in
 * the UI. When it is missing, `NeoAuthenticator.applyRequestLanguage` is a
 * SILENT no-op and the backend falls back to the user's AD language — so
 * selectors come back in English with no error anywhere (ETP-4685, ETP-5022).
 *
 * Always use this (or {@link buildHeaders} for writes) instead of hand-rolling
 * `{ Authorization: `Bearer ${token}` }` — that omission is exactly the defect
 * this helper exists to prevent, and a repo guardrail test enforces it.
 *
 * @param {string} [token] bearer token; omitted when absent
 * @returns {Record<string,string>} headers for a read request
 */
export function authHeaders(token) {
  const headers = {
    'Accept-Language': getStoredLocale(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Headers for a WRITE request (POST/PUT/DELETE with a JSON body): everything
 * {@link authHeaders} sends, plus `Content-Type: application/json`.
 */
export function buildHeaders(token) {
  return {
    ...authHeaders(token),
    'Content-Type': 'application/json',
  };
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
