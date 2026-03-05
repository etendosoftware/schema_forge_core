const DEFAULT_BASE_URL = '/etendo';

export function buildHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function isTokenExpired(token) {
  return !token;
}

export async function login(baseUrl, username, password) {
  const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}/sws/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: username, password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Login failed: ${res.status}`);
  }
  return res.json();
}

export function createApiFetch(baseUrl, getToken, onUnauthorized) {
  return async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...buildHeaders(token),
        ...options.headers,
      },
    });
    if (res.status === 401) {
      onUnauthorized();
      throw new Error('Unauthorized');
    }
    return res;
  };
}
