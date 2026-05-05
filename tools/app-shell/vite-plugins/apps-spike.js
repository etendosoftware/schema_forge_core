import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { INTERNAL_APPS } from '../src/apps-registry.js';

/**
 * Vite plugin that serves the Etendo Go Apps spike (ETP-3805) JWT endpoints
 * locally, mirroring the AppsServlet contract at `/sws/apps/*`.
 *
 * Rationale: during the F1 spike, Tomcat may not pick up the new
 * AD_MODEL_OBJECT_MAPPING without a full context reload. Serving the same
 * endpoints from Vite unblocks the end-to-end flow without rebuilding Etendo.
 *
 * Endpoints:
 *   GET  /sws/apps/.well-known/jwks.json   — public JWK for RS256 verification
 *   POST /sws/apps/token?appId=<id>        — mints RS256 JWT from Bearer HS256
 *
 * The keypair is read from the same PEM files used by the Java servlet so the
 * JWKS stays consistent across both backends.
 *
 * SPIKE CAVEAT: the incoming `Authorization: Bearer <HS256>` is decoded but
 * NOT cryptographically verified — dev-only shortcut. The Java AppsServlet
 * validates the HS256 signature via SecureWebServicesUtils.decodeToken().
 */
export default function appsSpikePlugin(options = {}) {
  const {
    privateKeyPath = path.resolve(
      'etendo_core/modules/com.etendoerp.go/config/apps-spike/private-key.pem'
    ),
    publicKeyPath = path.resolve(
      'etendo_core/modules/com.etendoerp.go/config/apps-spike/public-key.pem'
    ),
    kid = 'apps-spike-1',
    issuer = 'etendo-go',
    ttlSeconds = 3600,
    scopes = ['read:products', 'read:users'],
  } = options;

  let privatePem = null;
  let publicKeyObject = null;

  function loadKeys() {
    if (privatePem && publicKeyObject) return;
    privatePem = fs.readFileSync(privateKeyPath, 'utf8');
    const publicPem = fs.readFileSync(publicKeyPath, 'utf8');
    publicKeyObject = crypto.createPublicKey(publicPem);
  }

  function base64UrlEncode(buf) {
    return Buffer.from(buf)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function base64UrlDecode(str) {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
  }

  function buildJwk() {
    const jwk = publicKeyObject.export({ format: 'jwk' });
    return {
      kty: jwk.kty,
      alg: 'RS256',
      use: 'sig',
      kid,
      n: jwk.n,
      e: jwk.e,
    };
  }

  function signRs256(header, payload) {
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(privatePem);
    return `${signingInput}.${base64UrlEncode(signature)}`;
  }

  function decodeHs256Claims(token) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('malformed JWT');
    return JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  }

  function writeJson(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.end(JSON.stringify(body));
  }

  function writeError(res, status, message) {
    writeJson(res, status, { error: message });
  }

  function handleJwks(res) {
    try {
      loadKeys();
      writeJson(res, 200, { keys: [buildJwk()] });
    } catch (err) {
      console.error('[apps-spike] JWKS failed:', err);
      writeError(res, 500, `JWKS unavailable: ${err.message}`);
    }
  }

  function handleToken(req, res, appId) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      writeError(res, 401, 'Missing or invalid Authorization header');
      return;
    }
    const registered = INTERNAL_APPS.find((a) => a.appId === appId);
    if (!registered) {
      writeError(res, 404, `unknown_app: ${appId}`);
      return;
    }
    const etendoToken = authHeader.slice('Bearer '.length);

    let claims;
    try {
      claims = decodeHs256Claims(etendoToken);
    } catch (err) {
      writeError(res, 401, 'Invalid Etendo session token');
      return;
    }

    const userId = claims.user;
    const clientId = claims.client;
    const orgId = claims.organization;
    if (!userId || !clientId) {
      writeError(res, 401, 'Etendo token missing required claims (user, client)');
      return;
    }

    try {
      loadKeys();
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: 'RS256', typ: 'JWT', kid };
      const payload = {
        iss: issuer,
        sub: userId,
        aud: [issuer, appId],
        tenant: clientId,
        org: orgId ?? null,
        app: appId,
        scopes,
        iat: now,
        exp: now + ttlSeconds,
      };
      const token = signRs256(header, payload);
      writeJson(res, 200, { token, expiresInSeconds: ttlSeconds });
    } catch (err) {
      console.error('[apps-spike] token mint failed:', err);
      writeError(res, 500, `Failed to mint token: ${err.message}`);
    }
  }

  return {
    name: 'apps-spike-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/sws/apps/')) return next();

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.end();
          return;
        }

        const [rawPath, rawQuery = ''] = url.split('?');

        if (req.method === 'GET' && rawPath === '/sws/apps/.well-known/jwks.json') {
          return handleJwks(res);
        }

        if (req.method === 'POST' && rawPath === '/sws/apps/token') {
          const query = new URLSearchParams(rawQuery);
          const appId = query.get('appId');
          if (!appId) {
            writeError(res, 400, "Missing 'appId' parameter");
            return;
          }
          return handleToken(req, res, appId);
        }

        writeError(res, 404, `Unknown endpoint: ${rawPath}`);
      });
    },
  };
}
