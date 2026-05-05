import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { createServiceAuth } from '../src/createServiceAuth.js';

function makeEs256Token(expSeconds) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds, user: 'u' })).toString('base64url');
  return `${header}.${payload}.sig`;
}

async function startEtendo(handler) {
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise(r => server.listen(0, r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('getToken() fetches, caches, and reuses within TTL', async () => {
  let calls = 0;
  const { server, base } = await startEtendo((req, res) => {
    if (req.url === '/sws/login' && req.method === 'POST') {
      calls += 1;
      res.setHeader('Content-Type', 'application/json');
      const exp = Math.floor(Date.now() / 1000) + 600;
      res.end(JSON.stringify({ token: makeEs256Token(exp) }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  const auth = createServiceAuth({ etendoUrl: base, user: 'admin', password: 'admin' });
  const t1 = await auth.getToken();
  const t2 = await auth.getToken();
  assert.equal(typeof t1, 'string');
  assert.equal(t1, t2);
  assert.equal(calls, 1);

  server.close();
});

test('getToken() refreshes when near expiry', async () => {
  let calls = 0;
  const { server, base } = await startEtendo((req, res) => {
    calls += 1;
    res.setHeader('Content-Type', 'application/json');
    // First response expires in 10s so it is inside the skew window.
    const exp = Math.floor(Date.now() / 1000) + 10;
    res.end(JSON.stringify({ token: makeEs256Token(exp) }));
  });

  const auth = createServiceAuth({ etendoUrl: base, user: 'admin', password: 'admin', refreshSkewMs: 60_000 });
  await auth.getToken();
  await auth.getToken();
  assert.equal(calls, 2);

  server.close();
});

test('getToken() coalesces concurrent refreshes', async () => {
  let calls = 0;
  const { server, base } = await startEtendo((req, res) => {
    calls += 1;
    setTimeout(() => {
      const exp = Math.floor(Date.now() / 1000) + 600;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ token: makeEs256Token(exp) }));
    }, 50);
  });

  const auth = createServiceAuth({ etendoUrl: base, user: 'admin', password: 'admin' });
  const [a, b, c] = await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(calls, 1);

  server.close();
});

test('getToken() throws when Etendo login fails', async () => {
  const { server, base } = await startEtendo((_req, res) => {
    res.statusCode = 401;
    res.end('bad creds');
  });

  const auth = createServiceAuth({ etendoUrl: base, user: 'x', password: 'y' });
  await assert.rejects(() => auth.getToken(), /Etendo login failed 401/);

  server.close();
});
