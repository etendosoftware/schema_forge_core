import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';
import { Buffer } from 'node:buffer';
import { mountEtendoBff } from '../src/mountEtendoBff.js';

function makeEs256(expSeconds) {
  const h = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ exp: expSeconds, user: 'u' })).toString('base64url');
  return `${h}.${p}.sig`;
}

test('mountEtendoBff wires /health, /api/me, /api/etendo/* end-to-end', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 't', alg: 'RS256', use: 'sig' });
  const jwks = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise(r => jwks.listen(0, r));
  const jwksUrl = `http://127.0.0.1:${jwks.address().port}/`;

  let upstreamAuth = null;
  let upstreamPath = null;
  const etendo = http.createServer((req, res) => {
    if (req.url === '/sws/login' && req.method === 'POST') {
      const exp = Math.floor(Date.now() / 1000) + 600;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ token: makeEs256(exp) }));
      return;
    }
    upstreamAuth = req.headers.authorization;
    upstreamPath = req.url;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ response: { totalRows: 7 } }));
  });
  await new Promise(r => etendo.listen(0, r));
  const etendoUrl = `http://127.0.0.1:${etendo.address().port}`;

  const app = express();
  mountEtendoBff(app, {
    appId: 'demo',
    jwksUrl,
    etendoUrl,
    serviceAuth: { user: 'admin', password: 'admin' },
  });
  const bff = app.listen(0);
  const bffBase = `http://127.0.0.1:${bff.address().port}`;

  const appToken = await new SignJWT({ tenant: 'T', org: '0' })
    .setProtectedHeader({ alg: 'RS256', kid: 't' })
    .setAudience(['etendo-go', 'demo'])
    .setIssuer('etendo-go')
    .setExpirationTime('5m')
    .setSubject('USER-1')
    .sign(privateKey);

  const healthRes = await fetch(`${bffBase}/health`);
  const health = await healthRes.json();
  assert.equal(health.ok, true);

  const meRes = await fetch(`${bffBase}/api/me`, {
    headers: { Authorization: `Bearer ${appToken}` },
  });
  const me = await meRes.json();
  assert.equal(me.userId, 'USER-1');
  assert.equal(me.tenant, 'T');
  assert.equal(me.org, '0');

  const neoRes = await fetch(`${bffBase}/api/etendo/neo/product/product?_pageSize=1`, {
    headers: { Authorization: `Bearer ${appToken}` },
  });
  const neo = await neoRes.json();
  assert.equal(neoRes.status, 200);
  assert.equal(neo.response.totalRows, 7);
  assert.equal(upstreamPath, '/sws/neo/product/product?_pageSize=1');
  assert.ok(upstreamAuth.startsWith('Bearer '), 'service token must be sent');
  assert.notEqual(upstreamAuth, `Bearer ${appToken}`, 'inbound JWT must NOT be forwarded');

  bff.close();
  etendo.close();
  jwks.close();
});
