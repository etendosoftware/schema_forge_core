import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksCache = new Map();

function getJwks(url) {
  if (!jwksCache.has(url)) {
    jwksCache.set(url, createRemoteJWKSet(new URL(url)));
  }
  return jwksCache.get(url);
}

export async function verifyAppJwt(token, { jwksUrl, appId }) {
  const { payload } = await jwtVerify(token, getJwks(jwksUrl), {
    audience: appId,
    algorithms: ['RS256'],
  });
  return payload;
}

export function requireAppJwt({ jwksUrl, appId }) {
  if (!jwksUrl) throw new Error('requireAppJwt: jwksUrl is required');
  if (!appId) throw new Error('requireAppJwt: appId is required');

  return async function appJwtMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : req.query?.jwt;
    if (!token) return res.status(401).json({ error: 'missing token' });
    try {
      req.etendoContext = await verifyAppJwt(token, { jwksUrl, appId });
      req.jwtRaw = token;
      next();
    } catch (err) {
      res.status(401).json({ error: 'invalid token', detail: err.message });
    }
  };
}
