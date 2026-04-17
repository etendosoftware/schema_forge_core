import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';
import http from 'node:http';
import { verifyJwt } from '../src/jwt-middleware.js';

test('verifyJwt accepts a token signed by the JWKS key', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-kid';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const jwks = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise(r => jwks.listen(0, r));
  const port = jwks.address().port;

  const token = await new SignJWT({ app: 'spike-hello-app', tenant: 't1' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setAudience(['etendo-go', 'spike-hello-app'])
    .setIssuer(`http://localhost:${port}`)
    .setExpirationTime('5m')
    .setSubject('user-1')
    .sign(privateKey);

  const payload = await verifyJwt(token, {
    jwksUrl: `http://localhost:${port}/`,
    audience: 'spike-hello-app',
  });

  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.tenant, 't1');
  jwks.close();
});

test('verifyJwt rejects tokens with wrong audience', async () => {
  const { privateKey } = await generateKeyPair('RS256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'x' })
    .setAudience(['someone-else'])
    .setExpirationTime('5m')
    .sign(privateKey);

  await assert.rejects(
    () => verifyJwt(token, { jwksUrl: 'http://127.0.0.1:1/', audience: 'spike-hello-app' })
  );
});
