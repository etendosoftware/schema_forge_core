export class TokenExpiredError extends Error {
  constructor(message = 'token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class ShellFetchError extends Error {
  constructor(status, body) {
    super(`shell fetch failed: ${status}`);
    this.name = 'ShellFetchError';
    this.status = status;
    this.body = body;
  }
}

export function createShellClient({ appId, token, bffBaseUrl = '' }) {
  if (!appId) throw new Error('createShellClient: appId is required');
  if (!token) throw new Error('createShellClient: token is required');

  const base = bffBaseUrl.replace(/\/+$/, '');

  async function rawFetch(path, opts = {}) {
    const headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(`${base}${path}`, { ...opts, headers });
    if (res.status === 401) {
      const body = await res.text().catch(() => '');
      throw new TokenExpiredError(body || 'token expired');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ShellFetchError(res.status, body);
    }
    return res.json();
  }

  return {
    appId,
    me: () => rawFetch('/api/me'),
    fetch: (path, opts) => rawFetch(`/api/etendo${path}`, opts),
    on: (_event, _cb) => {
      // v1: no-op. postMessage event bus lands in v1.1.
      return () => {};
    },
  };
}
