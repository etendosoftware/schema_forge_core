/**
 * Service-account login cache for the F1 spike BFF.
 *
 * The BFF authenticates the incoming request via RS256 (Etendo Go Apps JWT)
 * but NEO Headless upstream expects an Etendo-native JWT. To bridge the two,
 * the BFF maintains a long-lived Etendo session via /sws/login with a service
 * credential and forwards that token to upstream.
 *
 * SPIKE CAVEAT: hard-coded admin credentials are dev-only. F1 proper needs a
 * real service-account model (dedicated user + role + scoped permissions), or
 * upstream support for RS256 verification so this bridge becomes unnecessary.
 */
export function createEtendoAuth({ etendoUrl, username, password, refreshSkewMs = 60_000 }) {
  let cache = null; // { token, expiresAtMs }
  let pending = null;

  async function fetchToken() {
    const res = await fetch(`${etendoUrl}/sws/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Etendo login failed ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const token = json.token;
    if (!token) throw new Error('Etendo login returned no token');

    // Decode exp without verifying — we only use it to schedule refresh.
    const payload = decodeJwtPayload(token);
    const expiresAtMs = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 30 * 60_000;
    return { token, expiresAtMs };
  }

  async function getToken() {
    if (cache && cache.expiresAtMs - Date.now() > refreshSkewMs) {
      return cache.token;
    }
    if (!pending) {
      pending = fetchToken()
        .then((fresh) => {
          cache = fresh;
          return fresh.token;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  return { getToken };
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  try {
    return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}
