import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createEtendoProxy } from '../src/etendo-proxy.js';

test('proxy forwards requests and re-injects Authorization header', async () => {
  let capturedAuth = null;
  let capturedPath = null;

  const upstream = http.createServer((req, res) => {
    capturedAuth = req.headers.authorization;
    capturedPath = req.url;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ items: [{ id: 'p1' }, { id: 'p2' }] }));
  });
  await new Promise(r => upstream.listen(0, r));
  const upstreamPort = upstream.address().port;

  const app = express();
  app.use('/api/etendo', (req, _res, next) => {
    req.jwtRaw = 'faked-token';
    next();
  }, createEtendoProxy({ target: `http://localhost:${upstreamPort}` }));

  const server = app.listen(0);
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/api/etendo/neo/entity/product`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.items.length, 2);
  assert.equal(capturedAuth, 'Bearer faked-token');
  assert.equal(capturedPath, '/neo/entity/product');

  server.close();
  upstream.close();
});
