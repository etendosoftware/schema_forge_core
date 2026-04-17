import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createShellClient } from '../src/shellClient.js';

async function withMockBff(handler, run) {
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise(r => server.listen(0, r));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('shell.me() calls /api/me with Bearer token', async () => {
  let receivedAuth = null;
  let receivedPath = null;
  await withMockBff(
    (req, res) => {
      receivedAuth = req.headers.authorization;
      receivedPath = req.url;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ userId: 'u1', tenant: 't1', org: '0' }));
    },
    async (base) => {
      const shell = createShellClient({ appId: 'demo', token: 'tok-abc', bffBaseUrl: base });
      const me = await shell.me();
      assert.deepEqual(me, { userId: 'u1', tenant: 't1', org: '0' });
      assert.equal(receivedAuth, 'Bearer tok-abc');
      assert.equal(receivedPath, '/api/me');
    }
  );
});

test('shell.fetch() prefixes /api/etendo and sends Authorization', async () => {
  let receivedAuth = null;
  let receivedPath = null;
  await withMockBff(
    (req, res) => {
      receivedAuth = req.headers.authorization;
      receivedPath = req.url;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ response: { totalRows: 42 } }));
    },
    async (base) => {
      const shell = createShellClient({ appId: 'demo', token: 'tok-xyz', bffBaseUrl: base });
      const body = await shell.fetch('/neo/product/product?_pageSize=1');
      assert.equal(body.response.totalRows, 42);
      assert.equal(receivedAuth, 'Bearer tok-xyz');
      assert.equal(receivedPath, '/api/etendo/neo/product/product?_pageSize=1');
    }
  );
});

test('shell.fetch() throws TokenExpiredError on 401', async () => {
  await withMockBff(
    (_req, res) => { res.statusCode = 401; res.end(JSON.stringify({ error: 'expired' })); },
    async (base) => {
      const shell = createShellClient({ appId: 'demo', token: 't', bffBaseUrl: base });
      await assert.rejects(() => shell.fetch('/neo/x'), (err) => err.name === 'TokenExpiredError');
    }
  );
});

test('shell.on(event, cb) returns an unsubscribe function (stub in v1)', () => {
  const shell = createShellClient({ appId: 'demo', token: 't' });
  const unsubscribe = shell.on('locale-changed', () => {});
  assert.equal(typeof unsubscribe, 'function');
  unsubscribe(); // should not throw
});
