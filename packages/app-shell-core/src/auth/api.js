import { getStoredLocale } from '../i18n/useLocaleState.js';

export function detectBaseUrl() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env?.VITE_API_BASE || '';
}

const DEFAULT_BASE_URL = detectBaseUrl();
console.log('[api.js] DEFAULT_BASE_URL:', JSON.stringify(DEFAULT_BASE_URL), 'pathname:', window.location.pathname, 'VITE_API_BASE:', import.meta.env?.VITE_API_BASE);

export function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    // Propagate the UI locale so the backend resolves AD_Message translations
    // in the language the user selected in the frontend.
    'Accept-Language': getStoredLocale(),
  };
}

// ETP-4576 — restores the backend-managed session (ADR-0001). This is the
// platform default for AuthProvider's `restoreSession`, so a host gets the
// cookie session without wiring anything; passing the prop overrides it.
// Authenticates purely with the `__Host-` cookie: `credentials: 'include'` and
// no Authorization header, since the browser never holds a bearer token.
// Fails closed with null on the 401 for "no session", a network error, or an
// unparsable body — every one of those means "not authenticated".
export async function fetchCookieSession(baseUrl = DEFAULT_BASE_URL) {
  try {
    const res = await fetch(`${baseUrl}/sws/go/session`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Methods that mutate state and therefore require the session-bound CSRF proof
// (ADR-0001, com.etendoerp.go): the session itself lives in an httpOnly cookie,
// so only this header — never a client-held token — proves the request came
// from the same origin holding a valid session.
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createApiFetch(baseUrl, getCsrfToken, onUnauthorized) {
  return async function apiFetch(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = { ...buildHeaders(), ...options.headers };
    if (UNSAFE_METHODS.has(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) headers['X-Go-CSRF'] = csrfToken;
    }
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
