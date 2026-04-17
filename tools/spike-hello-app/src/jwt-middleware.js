import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksCache = new Map();

function getJwks(url) {
  if (!jwksCache.has(url)) {
    jwksCache.set(url, createRemoteJWKSet(new URL(url)));
  }
  return jwksCache.get(url);
}

export async function verifyJwt(token, { jwksUrl, audience }) {
  const { payload } = await jwtVerify(token, getJwks(jwksUrl), {
    audience,
    algorithms: ['RS256'],
  });
  return payload;
}

export function requireJwt({ jwksUrl, audience }) {
  return async function(req, res, next) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : req.query.jwt;
    if (!token) return res.status(401).json({ error: 'missing token' });
    try {
      req.etendoContext = await verifyJwt(token, { jwksUrl, audience });
      next();
    } catch (err) {
      res.status(401).json({ error: 'invalid token', detail: err.message });
    }
  };
}
