import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';
import { requireAppJwt } from '../src/requireAppJwt.js';

async function startJwks(jwk) {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise(r => server.listen(0, r));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}/` };
}

function runMiddleware(mw, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      _json: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this._json = body; resolve({ res: this, next: false }); return this; },
    };
    const next = () => resolve({ res, next: true });
    mw(req, res, next);
  });
}

test('requireAppJwt attaches req.etendoContext on valid RS256 token', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 't', alg: 'RS256', use: 'sig' });
  const { server, url } = await startJwks(jwk);

  const token = await new SignJWT({ tenant: 'T1' })
    .setProtectedHeader({ alg: 'RS256', kid: 't' })
    .setAudience(['etendo-go', 'demo'])
    .setIssuer('etendo-go')
    .setExpirationTime('5m')
    .setSubject('u1')
    .sign(privateKey);

  const mw = requireAppJwt({ jwksUrl: url, appId: 'demo' });
  const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
  const { next, res } = await runMiddleware(mw, req);

  assert.equal(next, true);
  assert.equal(req.etendoContext.sub, 'u1');
  assert.equal(req.etendoContext.tenant, 'T1');
  assert.equal(req.jwtRaw, token);
  assert.equal(res.statusCode, 200);
  server.close();
});

test('requireAppJwt returns 401 when token missing', async () => {
  const mw = requireAppJwt({ jwksUrl: 'http://127.0.0.1:1/', appId: 'demo' });
  const { next, res } = await runMiddleware(mw, { headers: {}, query: {} });
  assert.equal(next, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res._json.error, 'missing token');
});

test('requireAppJwt returns 401 on wrong audience', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 't', alg: 'RS256', use: 'sig' });
  const { server, url } = await startJwks(jwk);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 't' })
    .setAudience(['someone-else'])
    .setExpirationTime('5m')
    .sign(privateKey);

  const mw = requireAppJwt({ jwksUrl: url, appId: 'demo' });
  const { next, res } = await runMiddleware(mw, { headers: { authorization: `Bearer ${token}` }, query: {} });
  assert.equal(next, false);
  assert.equal(res.statusCode, 401);
  server.close();
});
