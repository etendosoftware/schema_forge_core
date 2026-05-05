# Etendo Apps SDK — Extraction & Spike Migration Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the BFF and browser plumbing from `tools/spike-hello-app` into two workspace packages (`@etendoerp/apps-sdk`, `@etendoerp/apps-sdk-bff`), then refactor the spike to consume them. The spike's existing E2E (login → token mint → `/api/me` → `/api/etendo/neo/product/product`) must still pass after the migration.

**Architecture:** Two npm workspace packages under `packages/`. Browser package wraps `fetch` with the app JWT; BFF package exports a single `mountEtendoBff(app, opts)` plus low-level middlewares. Workspace `*` linking — no npm publish. See `docs/proposals/etendo-apps-sdk.md` for the approved design.

**Tech Stack:** Node 22 ESM, `node:test`, `jose` (RS256 + JWKS), `express`, `http-proxy-middleware` v3.

**Reference spec:** `docs/proposals/etendo-apps-sdk.md` §5–§7, §12 Phase A+B.

---

## Known non-obvious facts (brief)

- **`http-proxy-middleware` v3's `on.proxyReq` is synchronous.** Pre-fetch the upstream token in an async middleware that runs before the proxy, attach to `req`, read from `req` inside `proxyReq`. See `tools/spike-hello-app/src/etendo-proxy.js`.
- **Express strips the mount prefix before the middleware runs.** `app.use('/api/etendo', proxy)` means the proxy sees `req.url = '/neo/...'`, not `'/api/etendo/neo/...'`. Path rewrite prepends `/sws`.
- **The inbound app JWT must never reach NEO upstream.** NEO rejects RS256 (it verifies ES256 session tokens). Always replace `Authorization` with the cached service-account token.
- **Etendo Tomcat context name is deployment-specific** (dev uses `/etendo_sf2/`, not `/etendo/`). Take `etendoUrl` from config, never hardcode.
- **`tools/spike-hello-app/test/proxy.test.js` is stale.** It was written when `createEtendoProxy` returned a single middleware that forwarded the inbound JWT. Current behavior forwards a service token. The test must be rewritten as part of this plan.

---

## Task 1: Scaffold `packages/apps-sdk` skeleton

**Files:**
- Create: `packages/apps-sdk/package.json`
- Create: `packages/apps-sdk/src/index.js`
- Create: `packages/apps-sdk/README.md`
- Modify: `package.json` (root — add `packages/*` to workspaces)

- [ ] **Step 1: Create the package directory and package.json**

Run:
```bash
mkdir -p packages/apps-sdk/src packages/apps-sdk/test
```

Write `packages/apps-sdk/package.json`:
```json
{
  "name": "@etendoerp/apps-sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "scripts": {
    "test": "node --test test/*.test.js"
  },
  "devDependencies": {
    "jose": "^5.9.6"
  }
}
```

- [ ] **Step 2: Create a placeholder index.js**

Write `packages/apps-sdk/src/index.js`:
```js
// Public API re-exports. Filled in Task 2.
export { createShellClient } from './shellClient.js';
```

- [ ] **Step 3: Add `packages/*` to root workspaces**

Open `package.json` at repo root and change the `workspaces` array from:
```json
  "workspaces": [
    "cli",
    "tools/*",
    "e2e"
  ],
```
to:
```json
  "workspaces": [
    "cli",
    "tools/*",
    "packages/*",
    "e2e"
  ],
```

- [ ] **Step 4: Install to link the workspace**

Run: `npm install`
Expected: creates symlink `node_modules/@etendoerp/apps-sdk` → `packages/apps-sdk`.

- [ ] **Step 5: Verify workspace resolution**

Run: `node -e "console.log(require.resolve('@etendoerp/apps-sdk'))" 2>/dev/null || node --input-type=module -e "import('@etendoerp/apps-sdk').then(m => console.log(Object.keys(m)))"`
Expected: prints `[ 'createShellClient' ]` (empty export throws — the import should not fail, but `createShellClient` is not yet defined. If the import fails with `Cannot find module 'shellClient.js'`, that is expected — we fix it in Task 2.)

- [ ] **Step 6: Commit**

```bash
git add packages/apps-sdk package.json package-lock.json
git commit -m "Feature ETP-3805: Scaffold @etendoerp/apps-sdk workspace package"
```

---

## Task 2: Implement `createShellClient` in the browser SDK

**Files:**
- Create: `packages/apps-sdk/src/shellClient.js`
- Create: `packages/apps-sdk/test/shellClient.test.js`

- [ ] **Step 1: Write the failing test**

Write `packages/apps-sdk/test/shellClient.test.js`:
```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@etendoerp/apps-sdk`
Expected: FAIL — `Cannot find module '../src/shellClient.js'`.

- [ ] **Step 3: Implement `createShellClient`**

Write `packages/apps-sdk/src/shellClient.js`:
```js
export class TokenExpiredError extends Error {
  constructor(message = 'token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class ShellFetchError extends Error {
  constructor(status, body) {
    super(`shell fetch failed: ${status}`);
    this.name = 'ShellFetchError';
    this.status = status;
    this.body = body;
  }
}

export function createShellClient({ appId, token, bffBaseUrl = '' }) {
  if (!appId) throw new Error('createShellClient: appId is required');
  if (!token) throw new Error('createShellClient: token is required');

  const base = bffBaseUrl.replace(/\/+$/, '');

  async function rawFetch(path, opts = {}) {
    const headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(`${base}${path}`, { ...opts, headers });
    if (res.status === 401) {
      const body = await res.text().catch(() => '');
      throw new TokenExpiredError(body || 'token expired');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ShellFetchError(res.status, body);
    }
    return res.json();
  }

  return {
    appId,
    me: () => rawFetch('/api/me'),
    fetch: (path, opts) => rawFetch(`/api/etendo${path}`, opts),
    on: (_event, _cb) => {
      // v1: no-op. postMessage event bus lands in v1.1.
      return () => {};
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@etendoerp/apps-sdk`
Expected: 4/4 tests pass.

- [ ] **Step 5: Re-export error classes from index**

Edit `packages/apps-sdk/src/index.js`:
```js
export { createShellClient, TokenExpiredError, ShellFetchError } from './shellClient.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/apps-sdk/src packages/apps-sdk/test
git commit -m "Feature ETP-3805: Implement createShellClient in @etendoerp/apps-sdk"
```

---

## Task 3: Scaffold `packages/apps-sdk-bff` skeleton

**Files:**
- Create: `packages/apps-sdk-bff/package.json`
- Create: `packages/apps-sdk-bff/src/index.js`

- [ ] **Step 1: Create the directory**

Run: `mkdir -p packages/apps-sdk-bff/src packages/apps-sdk-bff/test`

- [ ] **Step 2: Write `packages/apps-sdk-bff/package.json`**

```json
{
  "name": "@etendoerp/apps-sdk-bff",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "scripts": {
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "http-proxy-middleware": "^3.0.3",
    "jose": "^5.9.6"
  }
}
```

- [ ] **Step 3: Placeholder `src/index.js`**

```js
export { requireAppJwt } from './requireAppJwt.js';
export { createEtendoProxy } from './createEtendoProxy.js';
export { createServiceAuth } from './createServiceAuth.js';
export { mountEtendoBff } from './mountEtendoBff.js';
```

- [ ] **Step 4: Link and verify**

Run: `npm install`
Expected: `node_modules/@etendoerp/apps-sdk-bff` symlinks to the new package.

- [ ] **Step 5: Commit**

```bash
git add packages/apps-sdk-bff package.json package-lock.json
git commit -m "Feature ETP-3805: Scaffold @etendoerp/apps-sdk-bff workspace package"
```

---

## Task 4: Port `requireAppJwt` middleware

**Files:**
- Create: `packages/apps-sdk-bff/src/requireAppJwt.js`
- Create: `packages/apps-sdk-bff/test/requireAppJwt.test.js`
- Reference: `tools/spike-hello-app/src/jwt-middleware.js` (existing `requireJwt`)

- [ ] **Step 1: Copy tests from the spike and adapt naming**

Write `packages/apps-sdk-bff/test/requireAppJwt.test.js`:
```js
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
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: FAIL — `Cannot find module '../src/requireAppJwt.js'`.

- [ ] **Step 3: Implement `requireAppJwt`**

Write `packages/apps-sdk-bff/src/requireAppJwt.js`:
```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: 3/3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/apps-sdk-bff/src/requireAppJwt.js packages/apps-sdk-bff/test/requireAppJwt.test.js
git commit -m "Feature ETP-3805: Port requireAppJwt middleware to @etendoerp/apps-sdk-bff"
```

---

## Task 5: Port `createServiceAuth`

**Files:**
- Create: `packages/apps-sdk-bff/src/createServiceAuth.js`
- Create: `packages/apps-sdk-bff/test/createServiceAuth.test.js`
- Reference: `tools/spike-hello-app/src/etendo-auth.js`

- [ ] **Step 1: Write the test**

Write `packages/apps-sdk-bff/test/createServiceAuth.test.js`:
```js
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
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: the new file fails with "Cannot find module".

- [ ] **Step 3: Implement `createServiceAuth`**

Write `packages/apps-sdk-bff/src/createServiceAuth.js` (copied verbatim from `tools/spike-hello-app/src/etendo-auth.js`, with the factory renamed and arg names normalized to `user`/`password`):
```js
/**
 * Service-account login cache for the Apps SDK BFF.
 *
 * The BFF authenticates inbound requests via RS256 (Etendo Go Apps JWT) but
 * NEO Headless upstream expects an Etendo-native JWT. The BFF maintains a
 * long-lived Etendo session via /sws/login with a service credential and
 * forwards that token upstream.
 *
 * Internal-apps v1 caveat: a dedicated service account + scoped role is the
 * responsibility of the operator. This module handles token lifecycle only.
 */
export function createServiceAuth({ etendoUrl, user, password, refreshSkewMs = 60_000 }) {
  if (!etendoUrl) throw new Error('createServiceAuth: etendoUrl is required');
  if (!user || !password) throw new Error('createServiceAuth: user and password are required');

  let cache = null; // { token, expiresAtMs }
  let pending = null;

  async function fetchToken() {
    const res = await fetch(`${etendoUrl}/sws/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Etendo login failed ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const token = json.token;
    if (!token) throw new Error('Etendo login returned no token');
    const payload = decodeJwtPayload(token);
    const expiresAtMs = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 30 * 60_000;
    return { token, expiresAtMs };
  }

  async function getToken() {
    if (cache && cache.expiresAtMs - Date.now() > refreshSkewMs) return cache.token;
    if (!pending) {
      pending = fetchToken()
        .then((fresh) => { cache = fresh; return fresh.token; })
        .finally(() => { pending = null; });
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
```

- [ ] **Step 4: Run tests**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: 4 new tests pass, plus the 3 from Task 4 = 7/7.

- [ ] **Step 5: Commit**

```bash
git add packages/apps-sdk-bff/src/createServiceAuth.js packages/apps-sdk-bff/test/createServiceAuth.test.js
git commit -m "Feature ETP-3805: Port createServiceAuth to @etendoerp/apps-sdk-bff"
```

---

## Task 6: Port `createEtendoProxy` (with the v3 sync/async fix)

**Files:**
- Create: `packages/apps-sdk-bff/src/createEtendoProxy.js`
- Create: `packages/apps-sdk-bff/test/createEtendoProxy.test.js`
- Reference: `tools/spike-hello-app/src/etendo-proxy.js`

- [ ] **Step 1: Write the test (correct semantics — forwards SERVICE token, strips inbound)**

Write `packages/apps-sdk-bff/test/createEtendoProxy.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createEtendoProxy } from '../src/createEtendoProxy.js';

async function startUpstream(handler) {
  const server = http.createServer(handler);
  await new Promise(r => server.listen(0, r));
  return { server, port: server.address().port };
}

test('proxy rewrites path to /sws/* and replaces inbound Authorization with service token', async () => {
  let receivedAuth = null;
  let receivedPath = null;
  const { server: upstream, port: upstreamPort } = await startUpstream((req, res) => {
    receivedAuth = req.headers.authorization;
    receivedPath = req.url;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });

  const etendoAuth = { getToken: async () => 'service-tok-123' };
  const app = express();
  app.use('/api/etendo',
    ...createEtendoProxy({ target: `http://127.0.0.1:${upstreamPort}`, etendoAuth }));

  const bff = app.listen(0);
  const port = bff.address().port;

  const res = await fetch(`http://127.0.0.1:${port}/api/etendo/neo/product/product`, {
    headers: { Authorization: 'Bearer inbound-app-jwt-DO-NOT-FORWARD' },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, { ok: true });
  assert.equal(receivedPath, '/sws/neo/product/product',
    'path must be rewritten to /sws/* after Express strips the mount prefix');
  assert.equal(receivedAuth, 'Bearer service-tok-123',
    'inbound app JWT must NEVER reach upstream — it must be replaced by the service token');

  bff.close();
  upstream.close();
});

test('proxy returns 502 when service token fetch fails', async () => {
  const etendoAuth = { getToken: async () => { throw new Error('login down'); } };
  const app = express();
  app.use('/api/etendo',
    ...createEtendoProxy({ target: 'http://127.0.0.1:1', etendoAuth }));

  const bff = app.listen(0);
  const port = bff.address().port;

  const res = await fetch(`http://127.0.0.1:${port}/api/etendo/neo/x`);
  const body = await res.json();
  assert.equal(res.status, 502);
  assert.equal(body.error, 'upstream_auth_failed');
  assert.equal(body.detail, 'login down');
  bff.close();
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: FAIL on the new file.

- [ ] **Step 3: Implement `createEtendoProxy`**

Write `packages/apps-sdk-bff/src/createEtendoProxy.js` (copied from `tools/spike-hello-app/src/etendo-proxy.js`, keeping the two-stage middleware structure verbatim because that's the whole point of the file):
```js
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * BFF proxy to Etendo upstream (/sws/*).
 *
 * The inbound request carries an RS256 app JWT; NEO Headless does not verify
 * those, so we swap it for a cached service-account token before forwarding.
 *
 * Returns an array of TWO middlewares — mount them with spread:
 *   app.use('/api/etendo', ...createEtendoProxy({ target, etendoAuth }));
 *
 * http-proxy-middleware v3 treats `on.proxyReq` synchronously; any awaited
 * work inside it races with the request. The first middleware pre-fetches the
 * service token (async) and attaches it to `req`; the second reads it
 * synchronously inside proxyReq.
 */
export function createEtendoProxy({ target, etendoAuth }) {
  if (!target) throw new Error('createEtendoProxy: target is required');
  if (!etendoAuth?.getToken) throw new Error('createEtendoProxy: etendoAuth.getToken is required');

  async function attachServiceToken(req, res, next) {
    try {
      req.etendoServiceToken = await etendoAuth.getToken();
      next();
    } catch (err) {
      console.error('[apps-sdk-bff] failed to obtain service token:', err.message);
      res.status(502).json({ error: 'upstream_auth_failed', detail: err.message });
    }
  }

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    // Express strips the mount prefix before the middleware runs, so req.url
    // enters as `/neo/...`. Prefix `/sws` to reach NEO Headless.
    pathRewrite: (path) => `/sws${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.etendoServiceToken) {
          proxyReq.setHeader('Authorization', `Bearer ${req.etendoServiceToken}`);
        }
      },
    },
  });

  return [attachServiceToken, proxy];
}
```

- [ ] **Step 4: Run tests**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: 2 new tests pass, total 9/9 across the BFF package.

- [ ] **Step 5: Commit**

```bash
git add packages/apps-sdk-bff/src/createEtendoProxy.js packages/apps-sdk-bff/test/createEtendoProxy.test.js
git commit -m "Feature ETP-3805: Port createEtendoProxy with sync-safe service token swap"
```

---

## Task 7: Implement `mountEtendoBff` convenience helper

**Files:**
- Create: `packages/apps-sdk-bff/src/mountEtendoBff.js`
- Create: `packages/apps-sdk-bff/test/mountEtendoBff.test.js`

- [ ] **Step 1: Write the integration test**

Write `packages/apps-sdk-bff/test/mountEtendoBff.test.js`:
```js
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
  // 1. RS256 keypair + JWKS server (simulates the shell's apps-spike plugin)
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 't', alg: 'RS256', use: 'sig' });
  const jwks = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise(r => jwks.listen(0, r));
  const jwksUrl = `http://127.0.0.1:${jwks.address().port}/`;

  // 2. Fake Etendo upstream: /sws/login mints a service token; /sws/neo/x echoes auth header.
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

  // 3. App BFF with mountEtendoBff.
  const app = express();
  mountEtendoBff(app, {
    appId: 'demo',
    jwksUrl,
    etendoUrl,
    serviceAuth: { user: 'admin', password: 'admin' },
  });
  const bff = app.listen(0);
  const bffBase = `http://127.0.0.1:${bff.address().port}`;

  // 4. Mint a valid app JWT.
  const appToken = await new SignJWT({ tenant: 'T', org: '0' })
    .setProtectedHeader({ alg: 'RS256', kid: 't' })
    .setAudience(['etendo-go', 'demo'])
    .setIssuer('etendo-go')
    .setExpirationTime('5m')
    .setSubject('USER-1')
    .sign(privateKey);

  // 5. /health — no auth required.
  const healthRes = await fetch(`${bffBase}/health`);
  const health = await healthRes.json();
  assert.equal(health.ok, true);

  // 6. /api/me — requires the token.
  const meRes = await fetch(`${bffBase}/api/me`, {
    headers: { Authorization: `Bearer ${appToken}` },
  });
  const me = await meRes.json();
  assert.equal(me.userId, 'USER-1');
  assert.equal(me.tenant, 'T');
  assert.equal(me.org, '0');

  // 7. /api/etendo/* — token replaced by service token upstream.
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: FAIL — mountEtendoBff not yet implemented.

- [ ] **Step 3: Implement `mountEtendoBff`**

Write `packages/apps-sdk-bff/src/mountEtendoBff.js`:
```js
import { requireAppJwt } from './requireAppJwt.js';
import { createEtendoProxy } from './createEtendoProxy.js';
import { createServiceAuth } from './createServiceAuth.js';

/**
 * Mount the standard Etendo Apps BFF surface on an Express app:
 *   GET  /health         → { ok: true }
 *   GET  /api/me         → { userId, tenant, org } (requires app JWT)
 *   *    /api/etendo/*   → proxied to ${etendoUrl}/sws/* with service token
 *
 * Apps that need a different shape can compose the low-level exports instead.
 */
export function mountEtendoBff(app, {
  appId,
  jwksUrl,
  etendoUrl,
  serviceAuth: { user, password },
}) {
  if (!appId || !jwksUrl || !etendoUrl) {
    throw new Error('mountEtendoBff: appId, jwksUrl, and etendoUrl are required');
  }

  const etendoAuth = createServiceAuth({ etendoUrl, user, password });
  const requireJwt = requireAppJwt({ jwksUrl, appId });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/me', requireJwt, (req, res) => {
    res.json({
      userId: req.etendoContext.sub,
      tenant: req.etendoContext.tenant,
      org: req.etendoContext.org,
    });
  });

  app.use('/api/etendo',
    requireJwt,
    ...createEtendoProxy({ target: etendoUrl, etendoAuth }));
}
```

- [ ] **Step 4: Run tests**

Run: `npm test --workspace=@etendoerp/apps-sdk-bff`
Expected: 10/10 tests pass across the BFF package.

- [ ] **Step 5: Commit**

```bash
git add packages/apps-sdk-bff/src/mountEtendoBff.js packages/apps-sdk-bff/test/mountEtendoBff.test.js
git commit -m "Feature ETP-3805: Implement mountEtendoBff convenience helper"
```

---

## Task 8: Refactor `tools/spike-hello-app` to consume the SDK (Phase B)

**Files:**
- Modify: `tools/spike-hello-app/package.json`
- Modify: `tools/spike-hello-app/server.js`
- Modify: `tools/spike-hello-app/src/App.jsx`
- Modify: `tools/spike-hello-app/src/fetchEtendo.js` (will become a thin adapter or be deleted)
- Delete: `tools/spike-hello-app/src/jwt-middleware.js`
- Delete: `tools/spike-hello-app/src/etendo-proxy.js`
- Delete: `tools/spike-hello-app/src/etendo-auth.js`
- Delete: `tools/spike-hello-app/test/jwt-middleware.test.js`
- Delete: `tools/spike-hello-app/test/proxy.test.js`

- [ ] **Step 1: Add SDK deps to the spike's package.json**

Edit `tools/spike-hello-app/package.json` `dependencies` block to add:
```json
    "@etendoerp/apps-sdk": "workspace:*",
    "@etendoerp/apps-sdk-bff": "workspace:*",
```

Remove `"jose"` and `"http-proxy-middleware"` from the spike's own deps — they come transitively via the BFF SDK. Keep `express`.

- [ ] **Step 2: Install to link**

Run: `npm install`
Expected: spike's `node_modules/@etendoerp/*` now symlink to `packages/*`.

- [ ] **Step 3: Rewrite `tools/spike-hello-app/server.js`**

Replace the entire file with:
```js
// tools/spike-hello-app/server.js
import express from 'express';
import { mountEtendoBff } from '@etendoerp/apps-sdk-bff';

const PORT = process.env.PORT || 4100;
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo_sf2';
const JWKS_URL = process.env.JWKS_URL || 'http://localhost:3100/sws/apps/.well-known/jwks.json';
const APP_ID = 'spike-hello-app';

const app = express();
mountEtendoBff(app, {
  appId: APP_ID,
  jwksUrl: JWKS_URL,
  etendoUrl: ETENDO_URL,
  serviceAuth: {
    user: process.env.ETENDO_SERVICE_USER || 'admin',
    password: process.env.ETENDO_SERVICE_PASSWORD || 'admin',
  },
});

// Static UI (built output)
app.use(express.static('dist'));

app.listen(PORT, () => console.log(`spike app listening on :${PORT}`));
```

- [ ] **Step 4: Replace `tools/spike-hello-app/src/fetchEtendo.js` with SDK adapter**

Write `tools/spike-hello-app/src/fetchEtendo.js`:
```js
import { createShellClient } from '@etendoerp/apps-sdk';

// The spike receives its token from the shell via URL query param `?jwt=...`
// (v1 shortcut — postMessage handshake is v1.1 work).
function readToken() {
  const url = new URL(window.location.href);
  return url.searchParams.get('jwt') || '';
}

export const shell = createShellClient({ appId: 'spike-hello-app', token: readToken() });
export const fetchEtendo = (path, opts) => shell.fetch(path, opts);
export const fetchMe = () => shell.me();
```

(App.jsx continues to import `fetchEtendo`/`fetchMe` from this module, so its source does not change.)

- [ ] **Step 5: Delete the files that moved into the SDK**

Run:
```bash
git rm tools/spike-hello-app/src/jwt-middleware.js \
       tools/spike-hello-app/src/etendo-proxy.js \
       tools/spike-hello-app/src/etendo-auth.js \
       tools/spike-hello-app/test/jwt-middleware.test.js \
       tools/spike-hello-app/test/proxy.test.js
```

- [ ] **Step 6: Run the spike's own tests**

Run: `npm test --workspace=@schema-forge/spike-hello-app`
Expected: PASS with 0 tests (all tests moved to the SDK packages). No failures.

- [ ] **Step 7: Run the full workspace test suite**

Run: `npm test --workspaces --if-present`
Expected: all SDK tests pass; root CLI tests unaffected.

- [ ] **Step 8: Manual smoke test end-to-end (required)**

In one terminal:
```bash
cd tools/spike-hello-app && npm run dev:with-shell
```

Wait for app-shell on :3100, spike BFF on :4100, spike UI on :5173.

In another terminal, mint a token and hit the BFF:
```bash
# 1. Etendo login → ES256 session token
ETENDO_TOKEN=$(curl -sS -X POST http://localhost:8080/etendo_sf2/sws/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r .token)

# 2. Shell mints RS256 for the app
APP_TOKEN=$(curl -sS -X POST "http://localhost:3100/sws/apps/token?appId=spike-hello-app" \
  -H "Authorization: Bearer $ETENDO_TOKEN" | jq -r .token)

# 3. /api/me — should return the logged-in user context
curl -sS http://localhost:4100/api/me -H "Authorization: Bearer $APP_TOKEN" | jq

# 4. /api/etendo/neo/product/product — should return NEO product spec data
curl -sS "http://localhost:4100/api/etendo/neo/product/product?_pageSize=1" \
  -H "Authorization: Bearer $APP_TOKEN" | jq '.response.totalRows'
```

Expected: `/api/me` returns `{ userId, tenant, org }`; NEO call returns a number > 0.
If either returns 401 or 404, the migration broke something — debug before committing.

- [ ] **Step 9: Commit**

```bash
git add tools/spike-hello-app
git commit -m "Feature ETP-3805: Migrate spike-hello-app to @etendoerp apps SDK"
```

---

## Task 9: Update the SDK proposal with implementation status

**Files:**
- Modify: `docs/proposals/etendo-apps-sdk.md`

- [ ] **Step 1: Add an implementation status line under the header**

Open `docs/proposals/etendo-apps-sdk.md`. Below the `Last updated` line, add:
```
> **Implementation status (2026-04-17):** Phase A+B complete. Packages published in-workspace, spike migrated and passing E2E. Next: Phase C (`quick-order-app`) — see plan in `docs/plans/`.
```

Update `Last updated` date to today.

- [ ] **Step 2: Commit**

```bash
git add docs/proposals/etendo-apps-sdk.md
git commit -m "Feature ETP-3805: Mark Apps SDK Phase A+B implementation complete"
```

---

## Definition of done

- `packages/apps-sdk/` and `packages/apps-sdk-bff/` exist with the API from the proposal.
- All tests green: `npm test --workspaces --if-present`.
- `tools/spike-hello-app` imports only from `@etendoerp/*`; no `jose`/`http-proxy-middleware` in its own deps.
- Manual E2E from Task 8 Step 8 succeeds.
- Proposal status updated.
- No uncommitted work.

## Scope boundaries (not in this plan)

- **No PR yet.** This plan ends with the branch ready. PR / merge happens after Plan C (quick-order) lands, so the SDK and its first real consumer ship together.
- **No `apps-sdk` README beyond the stub.** Sage documents when the SDK stabilizes (post-quick-order).
- **No CI wiring.** Existing workspace test job picks up the new packages automatically via `--workspaces`.
