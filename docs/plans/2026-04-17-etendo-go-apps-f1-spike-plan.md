# Etendo Go Apps — F1 Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the Etendo Go Apps architecture end-to-end with a hardcoded "hello world" app, so we can decide the open questions (JWT transport, proxy viability, NEO JWKS compatibility) before committing to full F1.

**Architecture:** A minimum vertical slice that proves the model: Etendo Go issues an RS256 JWT with JWKS, the React shell opens an iframe to a standalone Node.js app, the app verifies the JWT, proxies a call to NEO Headless, and renders the result.

**Tech Stack:**
- **Etendo Go (Java):** `jjwt` for RS256 signing, one new servlet for token issuance, one for JWKS
- **React shell:** new `AppIframeHost` component + hardcoded menu entry
- **Spike app:** Node.js 22 ESM + `jose` (JWKS verification) + `http-proxy-middleware` + React 18 + Vite + Tailwind
- **Deploy:** runs locally for the spike; no Docker/infra work

**Scope / non-goals:**
- NO database tables (`ETGO_APP_*`) — hardcoded descriptor in the shell
- NO install/uninstall flow
- NO admin UI
- NO scope enforcement in NEO (token is trusted as-is)
- NO partner SDK polish (ergonomics come in F2)

**Spike exit criteria:**
1. Clicking a menu item in the shell opens an iframe
2. The iframe loads the spike app UI
3. The spike app server verifies the RS256 JWT against Etendo Go's JWKS
4. The spike app calls `/api/etendo/products` → its server proxies to NEO with the same JWT → NEO returns data
5. The UI renders: "Hello {user_name}, you have {N} products"
6. One decision document is written comparing URL-fragment vs postMessage JWT transport, with a recommendation for F1

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `<etendo_go_module>/src/com/etendoerp/go/apps/JwtIssuerService.java` | RS256 signing, key loading, JWT builder |
| `<etendo_go_module>/src/com/etendoerp/go/apps/JwtIssuerServlet.java` | `POST /neo/apps/spike/token` — returns signed JWT for current user |
| `<etendo_go_module>/src/com/etendoerp/go/apps/JwksServlet.java` | `GET /neo/apps/.well-known/jwks.json` — publishes the public key |
| `<etendo_go_module>/src/com/etendoerp/go/apps/JwtIssuerServiceTest.java` | Unit test: sign → verify roundtrip |
| `<etendo_go_module>/config/apps-spike/private-key.pem` | Private key (gitignored; sample fixture for dev) |
| `<etendo_go_module>/config/apps-spike/public-key.pem` | Public key |
| `<etendo_go_module>/config/apps-spike/README.md` | How to regenerate keys |
| `tools/spike-hello-app/package.json` | App dependencies |
| `tools/spike-hello-app/server.js` | Express server: JWT middleware + NEO proxy + SPA serving |
| `tools/spike-hello-app/src/App.jsx` | UI: shows user name + product count |
| `tools/spike-hello-app/src/fetchEtendo.js` | Same-origin API helper |
| `tools/spike-hello-app/src/main.jsx` | React entry point |
| `tools/spike-hello-app/index.html` | Vite HTML entry |
| `tools/spike-hello-app/vite.config.js` | Vite config with proxy to server in dev |
| `tools/spike-hello-app/tailwind.config.js` + `postcss.config.js` + `src/index.css` | Tailwind setup (copy from `tools/app-shell/`) |
| `tools/spike-hello-app/test/jwt-middleware.test.js` | Unit test: JWKS verification |
| `tools/spike-hello-app/test/proxy.test.js` | Unit test: proxy re-injects Authorization header |
| `tools/spike-hello-app/README.md` | How to run locally |
| `tools/app-shell/src/windows/spike-apps-host/AppIframeHost.jsx` | Iframe wrapper with JWT transport |
| `tools/app-shell/src/windows/spike-apps-host/index.jsx` | Route handler registered in the menu |
| `tools/app-shell/src/windows/spike-apps-host/__tests__/AppIframeHost.test.jsx` | Component test for iframe + JWT handshake |
| `docs/proposals/etendo-go-apps-spike-learnings.md` | Spike outcome doc — filled in at end |

### Modified files

| Path | Change |
|------|--------|
| `tools/app-shell/src/menu.json` | Add a "Spike Apps" group with one "Hello App" entry |
| `tools/app-shell/src/windows/registry.js` | Register `spike-hello-app` slug → load `AppIframeHost` |
| `<etendo_go_module>/src-db/database/sourcedata/AD_WEB_SERVICE_CLASS.xml` or equivalent WAD registration | Register the two new servlets (follow existing NEO servlet pattern) |

`<etendo_go_module>` resolves to `../modules/com.etendoerp.go/` (sibling of this repo; see CLAUDE.md "Etendo Local Environment").

---

## Task 1: Generate RSA keypair and check in sample keys

**Files:**
- Create: `<etendo_go_module>/config/apps-spike/private-key.pem`
- Create: `<etendo_go_module>/config/apps-spike/public-key.pem`
- Create: `<etendo_go_module>/config/apps-spike/README.md`
- Modify: `<etendo_go_module>/.gitignore` (add `config/apps-spike/private-key.pem`)

- [ ] **Step 1: Generate keypair**

```bash
cd <etendo_go_module>/config/apps-spike
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private-key.pem
openssl rsa -pubout -in private-key.pem -out public-key.pem
```

- [ ] **Step 2: Write README.md**

```markdown
# Apps Spike keys

RSA 2048 keypair used by the spike JWT issuer (F1 spike).

## Regenerate

    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private-key.pem
    openssl rsa -pubout -in private-key.pem -out public-key.pem

## Production

Not for production. F1 production rollout must load keys from secrets manager,
not from the filesystem.
```

- [ ] **Step 3: Gitignore the private key**

Add to `<etendo_go_module>/.gitignore`:

```
config/apps-spike/private-key.pem
```

- [ ] **Step 4: Commit (public key + README + gitignore only)**

```bash
git add config/apps-spike/public-key.pem config/apps-spike/README.md .gitignore
git commit -m "Feature ETP-3805: Generate RSA keypair for apps spike"
```

---

## Task 2: JwtIssuerService with TDD

**Files:**
- Create: `<etendo_go_module>/src/com/etendoerp/go/apps/JwtIssuerService.java`
- Test: `<etendo_go_module>/src-test/com/etendoerp/go/apps/JwtIssuerServiceTest.java`

- [ ] **Step 1: Add jjwt dependency to the module build file**

Find the build descriptor (`build.gradle` or `build.xml`). Add:

```
implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'
```

If the build fails because Etendo uses a different dependency system, follow the existing Etendo pattern for adding libs (check how other NEO services pull in external jars) and bundle the jjwt jars accordingly.

- [ ] **Step 2: Write the failing test**

```java
// src-test/com/etendoerp/go/apps/JwtIssuerServiceTest.java
package com.etendoerp.go.apps;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.security.interfaces.RSAPublicKey;
import java.util.List;

class JwtIssuerServiceTest {

  @Test
  void signedTokenVerifiesWithPublicKey() throws Exception {
    JwtIssuerService svc = new JwtIssuerService(
        "config/apps-spike/private-key.pem",
        "config/apps-spike/public-key.pem",
        "spike-kid-1");

    String token = svc.issue(
        "user-42",
        "acme-prod",
        "acme-hq",
        "spike-hello-app",
        List.of("read:products"));

    RSAPublicKey pub = svc.getPublicKey();

    Claims claims = Jwts.parser()
        .verifyWith(pub)
        .build()
        .parseSignedClaims(token)
        .getPayload();

    assertEquals("user-42", claims.getSubject());
    assertEquals("acme-prod", claims.get("tenant"));
    assertEquals("acme-hq", claims.get("org"));
    assertEquals("spike-hello-app", claims.get("app"));
    assertTrue(((List<?>) claims.get("aud")).contains("etendo-go"));
    assertTrue(((List<?>) claims.get("aud")).contains("spike-hello-app"));
    assertNotNull(claims.getExpiration());
  }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run the Etendo Go module test target (follow existing conventions — e.g., `./gradlew :com.etendoerp.go:test`).
Expected: FAIL with "JwtIssuerService not defined".

- [ ] **Step 4: Implement JwtIssuerService**

```java
// src/com/etendoerp/go/apps/JwtIssuerService.java
package com.etendoerp.go.apps;

import io.jsonwebtoken.Jwts;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

public class JwtIssuerService {
  private final RSAPrivateKey privateKey;
  private final RSAPublicKey publicKey;
  private final String kid;
  private static final long TTL_SECONDS = 300;

  public JwtIssuerService(String privateKeyPath, String publicKeyPath, String kid) throws Exception {
    this.privateKey = loadPrivate(privateKeyPath);
    this.publicKey = loadPublic(publicKeyPath);
    this.kid = kid;
  }

  public String issue(String userId, String tenantId, String orgId,
                      String appId, List<String> scopes) {
    Instant now = Instant.now();
    return Jwts.builder()
        .header().keyId(kid).and()
        .issuer("https://etendo-go.local")
        .subject(userId)
        .audience().add("etendo-go").add(appId).and()
        .claim("tenant", tenantId)
        .claim("org", orgId)
        .claim("app", appId)
        .claim("scopes", scopes)
        .issuedAt(java.util.Date.from(now))
        .expiration(java.util.Date.from(now.plusSeconds(TTL_SECONDS)))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
  }

  public RSAPublicKey getPublicKey() { return publicKey; }
  public String getKid() { return kid; }

  private static RSAPrivateKey loadPrivate(String path) throws Exception {
    String pem = Files.readString(Path.of(path));
    byte[] der = decodePem(pem, "PRIVATE KEY");
    return (RSAPrivateKey) KeyFactory.getInstance("RSA")
        .generatePrivate(new PKCS8EncodedKeySpec(der));
  }

  private static RSAPublicKey loadPublic(String path) throws Exception {
    String pem = Files.readString(Path.of(path));
    byte[] der = decodePem(pem, "PUBLIC KEY");
    return (RSAPublicKey) KeyFactory.getInstance("RSA")
        .generatePublic(new X509EncodedKeySpec(der));
  }

  private static byte[] decodePem(String pem, String type) {
    String begin = "-----BEGIN " + type + "-----";
    String end = "-----END " + type + "-----";
    String body = pem.replace(begin, "").replace(end, "").replaceAll("\\s", "");
    return Base64.getDecoder().decode(body);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run the module test target again. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/com/etendoerp/go/apps/JwtIssuerService.java \
        src-test/com/etendoerp/go/apps/JwtIssuerServiceTest.java \
        build.gradle
git commit -m "Feature ETP-3805: Add JwtIssuerService for apps spike"
```

---

## Task 3: JWKS and token HTTP endpoints

**Files:**
- Create: `<etendo_go_module>/src/com/etendoerp/go/apps/JwksServlet.java`
- Create: `<etendo_go_module>/src/com/etendoerp/go/apps/JwtIssuerServlet.java`
- Modify: Servlet registration XML (follow the same pattern used by `NeoServlet`; search for it in the module to locate the file — likely `src-db/database/sourcedata/AD_MODEL_OBJECT.xml` or a WAD descriptor)

- [ ] **Step 1: Implement JwksServlet**

```java
// src/com/etendoerp/go/apps/JwksServlet.java
package com.etendoerp.go.apps;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Map;

public class JwksServlet extends HttpServlet {
  private final JwtIssuerService issuer;

  public JwksServlet(JwtIssuerService issuer) { this.issuer = issuer; }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws java.io.IOException {
    RSAPublicKey pub = issuer.getPublicKey();
    String n = Base64.getUrlEncoder().withoutPadding()
        .encodeToString(pub.getModulus().toByteArray());
    String e = Base64.getUrlEncoder().withoutPadding()
        .encodeToString(pub.getPublicExponent().toByteArray());

    Map<String, Object> jwk = Map.of(
        "kty", "RSA",
        "use", "sig",
        "alg", "RS256",
        "kid", issuer.getKid(),
        "n", n,
        "e", e);

    String body = "{\"keys\":[" + toJson(jwk) + "]}";
    resp.setContentType("application/json");
    resp.setHeader("Cache-Control", "public, max-age=300");
    resp.getWriter().write(body);
  }

  private static String toJson(Map<String, Object> m) {
    StringBuilder sb = new StringBuilder("{");
    boolean first = true;
    for (var entry : m.entrySet()) {
      if (!first) sb.append(",");
      sb.append('"').append(entry.getKey()).append("\":\"").append(entry.getValue()).append('"');
      first = false;
    }
    return sb.append("}").toString();
  }
}
```

- [ ] **Step 2: Implement JwtIssuerServlet**

```java
// src/com/etendoerp/go/apps/JwtIssuerServlet.java
package com.etendoerp.go.apps;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.openbravo.dal.core.OBContext;
import java.util.List;

public class JwtIssuerServlet extends HttpServlet {
  private final JwtIssuerService issuer;

  public JwtIssuerServlet(JwtIssuerService issuer) { this.issuer = issuer; }

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws java.io.IOException {
    OBContext ctx = OBContext.getOBContext();
    if (ctx == null || ctx.getUser() == null) {
      resp.sendError(HttpServletResponse.SC_UNAUTHORIZED, "No session");
      return;
    }
    String appId = req.getParameter("appId");
    if (appId == null || appId.isBlank()) {
      resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "appId required");
      return;
    }

    String token = issuer.issue(
        ctx.getUser().getId(),
        ctx.getCurrentClient().getId(),
        ctx.getCurrentOrganization().getId(),
        appId,
        List.of("read:products"));

    resp.setContentType("application/json");
    resp.getWriter().write("{\"token\":\"" + token + "\"}");
  }
}
```

- [ ] **Step 3: Wire the servlets into Etendo's servlet registration**

Locate how `NeoServlet` is registered (grep for `NeoServlet` under `<etendo_go_module>/src-db/`). Add two analogous entries mapping:
- `/neo/apps/token` → `JwtIssuerServlet`
- `/neo/apps/.well-known/jwks.json` → `JwksServlet`

Both must share the single `JwtIssuerService` instance. If there is an existing CDI container pattern used in the module, use it; otherwise instantiate once in a `ServletContextListener`.

- [ ] **Step 4: Run module tests + smartbuild**

Follow the existing module dev loop (typically `./gradlew :com.etendoerp.go:test` + `./gradlew smartbuild`).
Expected: module deploys without error, both endpoints reachable.

- [ ] **Step 5: Manual verification**

With a logged-in session cookie:

```bash
curl -b "JSESSIONID=<cookie>" -X POST "http://localhost:8080/etendo/neo/apps/token?appId=spike-hello-app"
# expected: {"token":"eyJhbG..."}

curl "http://localhost:8080/etendo/neo/apps/.well-known/jwks.json"
# expected: {"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":"spike-kid-1","n":"...","e":"AQAB"}]}
```

Paste the JWT into [jwt.io](https://jwt.io) and verify with the public key. Confirm `aud` contains both `etendo-go` and `spike-hello-app`.

- [ ] **Step 6: Commit**

```bash
git add src/com/etendoerp/go/apps/ src-db/database/sourcedata/
git commit -m "Feature ETP-3805: Add JWKS + token endpoints for apps spike"
```

---

## Task 4: Scaffold the spike-hello-app (server + UI skeleton)

**Files:**
- Create: `tools/spike-hello-app/package.json`
- Create: `tools/spike-hello-app/server.js`
- Create: `tools/spike-hello-app/vite.config.js`
- Create: `tools/spike-hello-app/index.html`
- Create: `tools/spike-hello-app/src/main.jsx`
- Create: `tools/spike-hello-app/src/App.jsx`
- Create: `tools/spike-hello-app/src/index.css`
- Create: `tools/spike-hello-app/tailwind.config.js`
- Create: `tools/spike-hello-app/postcss.config.js`
- Create: `tools/spike-hello-app/README.md`
- Modify: root `package.json` (add workspace if workspaces list is explicit)

- [ ] **Step 1: Write package.json**

```json
{
  "name": "@schema-forge/spike-hello-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "node --watch server.js",
    "dev:ui": "vite",
    "dev": "concurrently -k -n server,ui -c blue,green \"npm:dev:server\" \"npm:dev:ui\"",
    "build": "vite build",
    "start": "NODE_ENV=production node server.js",
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "http-proxy-middleware": "^3.0.3",
    "jose": "^5.9.6",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^9.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Copy Tailwind/PostCSS configs from app-shell**

```bash
cp tools/app-shell/tailwind.config.js tools/spike-hello-app/tailwind.config.js
cp tools/app-shell/postcss.config.js tools/spike-hello-app/postcss.config.js
```

Adjust `content` in `tailwind.config.js` to point at `./index.html` and `./src/**/*.{js,jsx}`.

- [ ] **Step 3: Write minimal server.js**

```js
// tools/spike-hello-app/server.js
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = process.env.PORT || 4100;
const ETENDO_URL = process.env.ETENDO_URL || 'http://localhost:8080/etendo';

const app = express();

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// API placeholder — replaced in Task 6
app.get('/api/me', (_req, res) => res.json({ placeholder: true }));

// Static UI (built output)
app.use(express.static('dist'));

app.listen(PORT, () => console.log(`spike app listening on :${PORT}`));
```

- [ ] **Step 4: Write Vite config**

```js
// tools/spike-hello-app/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4100',
    },
  },
  build: { outDir: 'dist' },
});
```

- [ ] **Step 5: Write index.html + React entry**

```html
<!-- tools/spike-hello-app/index.html -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Spike Hello App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

```jsx
// tools/spike-hello-app/src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
```

```jsx
// tools/spike-hello-app/src/App.jsx
import React from 'react';

export default function App() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Spike Hello App</h1>
      <p className="text-gray-500">Scaffold OK.</p>
    </div>
  );
}
```

```css
/* tools/spike-hello-app/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Install and verify both servers start**

```bash
cd tools/spike-hello-app
npm install
npm run dev
```

Expected: UI at `http://localhost:5173` shows "Spike Hello App / Scaffold OK." Server health at `http://localhost:4100/health` returns `{"ok":true}`.

- [ ] **Step 7: Write README.md**

```markdown
# spike-hello-app

Minimum viable Etendo Go app for the F1 spike (ETP-3805).

Proves: RS256 JWT verification, BFF proxy to NEO, iframe embedding.

## Run locally

    npm install
    npm run dev
    # UI:  http://localhost:5173
    # API: http://localhost:4100

Requires Etendo Go running at `http://localhost:8080/etendo`
(override with `ETENDO_URL=...`).
```

- [ ] **Step 8: Commit**

```bash
git add tools/spike-hello-app/
git commit -m "Feature ETP-3805: Scaffold spike-hello-app (server + UI)"
```

---

## Task 5: JWT verification middleware in the app server

**Files:**
- Modify: `tools/spike-hello-app/server.js`
- Create: `tools/spike-hello-app/test/jwt-middleware.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tools/spike-hello-app/test/jwt-middleware.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tools/spike-hello-app
npm test
```

Expected: FAIL — `verifyJwt` is not defined.

- [ ] **Step 3: Implement the middleware**

```js
// tools/spike-hello-app/src/jwt-middleware.js
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Wire into server.js**

Replace the `/api/me` handler:

```js
// tools/spike-hello-app/server.js  (additions)
import { requireJwt } from './src/jwt-middleware.js';

const JWKS_URL = `${ETENDO_URL}/neo/apps/.well-known/jwks.json`;
const APP_ID = 'spike-hello-app';

app.use('/api', requireJwt({ jwksUrl: JWKS_URL, audience: APP_ID }));

app.get('/api/me', (req, res) => {
  res.json({
    userId: req.etendoContext.sub,
    tenant: req.etendoContext.tenant,
    org: req.etendoContext.org,
  });
});
```

- [ ] **Step 6: Commit**

```bash
git add tools/spike-hello-app/src/jwt-middleware.js \
        tools/spike-hello-app/server.js \
        tools/spike-hello-app/test/jwt-middleware.test.js
git commit -m "Feature ETP-3805: Add JWT verification middleware (spike app)"
```

---

## Task 6: NEO proxy with JWT re-injection

**Files:**
- Modify: `tools/spike-hello-app/server.js`
- Create: `tools/spike-hello-app/test/proxy.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tools/spike-hello-app/test/proxy.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- test/proxy.test.js
```

Expected: FAIL — `createEtendoProxy` not defined.

- [ ] **Step 3: Implement the proxy module**

```js
// tools/spike-hello-app/src/etendo-proxy.js
import { createProxyMiddleware } from 'http-proxy-middleware';

export function createEtendoProxy({ target }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { '^/api/etendo': '' },
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.jwtRaw) {
          proxyReq.setHeader('Authorization', `Bearer ${req.jwtRaw}`);
        }
      },
    },
  });
}
```

- [ ] **Step 4: Capture the raw JWT in the middleware**

Update `src/jwt-middleware.js` so `requireJwt` also attaches the raw token:

```js
// add inside requireJwt, right after payload extraction
req.jwtRaw = token;
```

- [ ] **Step 5: Wire the proxy in server.js**

```js
// tools/spike-hello-app/server.js
import { createEtendoProxy } from './src/etendo-proxy.js';

app.use('/api/etendo', requireJwt({ jwksUrl: JWKS_URL, audience: APP_ID }),
        createEtendoProxy({ target: ETENDO_URL }));
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tools/spike-hello-app/src/etendo-proxy.js \
        tools/spike-hello-app/src/jwt-middleware.js \
        tools/spike-hello-app/server.js \
        tools/spike-hello-app/test/proxy.test.js
git commit -m "Feature ETP-3805: Add NEO BFF proxy (spike app)"
```

---

## Task 7: Hello UI — shows user + product count

**Files:**
- Modify: `tools/spike-hello-app/src/App.jsx`
- Create: `tools/spike-hello-app/src/fetchEtendo.js`

- [ ] **Step 1: Write fetchEtendo helper**

```js
// tools/spike-hello-app/src/fetchEtendo.js
export async function fetchEtendo(path, opts = {}) {
  const res = await fetch(`/api/etendo${path}`, opts);
  if (!res.ok) throw new Error(`Etendo call failed: ${res.status}`);
  return res.json();
}

export async function fetchMe() {
  const res = await fetch('/api/me');
  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Replace App.jsx**

```jsx
// tools/spike-hello-app/src/App.jsx
import React, { useEffect, useState } from 'react';
import { fetchEtendo, fetchMe } from './fetchEtendo.js';

export default function App() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchMe();
        const products = await fetchEtendo('/neo/entity/product?limit=1');
        setState({
          loading: false,
          user: me.userId,
          tenant: me.tenant,
          productCount: products?.totalCount ?? products?.items?.length ?? 0,
        });
      } catch (err) {
        setState({ loading: false, error: err.message });
      }
    })();
  }, []);

  if (state.loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (state.error) return (
    <div className="p-8 text-red-600">
      <h1 className="text-xl font-bold">Spike Hello App</h1>
      <p>Error: {state.error}</p>
    </div>
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Spike Hello App</h1>
      <p className="mt-4">
        Hello <b>{state.user}</b> from tenant <b>{state.tenant}</b>,
        you have <b>{state.productCount}</b> products.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Paste a valid JWT (obtained from Task 3's curl) into the URL as `?jwt=<token>` (temporary — Task 9 changes this).
With `npm run dev`, open `http://localhost:5173/?jwt=<token>` and confirm the UI renders with real user + product count.

- [ ] **Step 4: Commit**

```bash
git add tools/spike-hello-app/src/
git commit -m "Feature ETP-3805: Render user + product count in spike UI"
```

---

## Task 8: Shell iframe host + hardcoded menu entry

**Files:**
- Create: `tools/app-shell/src/windows/spike-apps-host/AppIframeHost.jsx`
- Create: `tools/app-shell/src/windows/spike-apps-host/index.jsx`
- Create: `tools/app-shell/src/windows/spike-apps-host/__tests__/AppIframeHost.test.jsx`
- Modify: `tools/app-shell/src/menu.json`
- Modify: `tools/app-shell/src/windows/registry.js`

- [ ] **Step 1: Write failing component test**

```jsx
// tools/app-shell/src/windows/spike-apps-host/__tests__/AppIframeHost.test.jsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AppIframeHost from '../AppIframeHost.jsx';

test('AppIframeHost renders iframe with appUrl', () => {
  const html = renderToString(
    <AppIframeHost appUrl="http://localhost:5173" appId="spike-hello-app" />
  );
  assert.match(html, /<iframe/);
  assert.match(html, /src="http:\/\/localhost:5173/);
  assert.match(html, /sandbox="allow-scripts allow-same-origin allow-forms"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd tools/app-shell
node --test src/windows/spike-apps-host/__tests__/AppIframeHost.test.jsx
```

Expected: FAIL — `AppIframeHost` not defined.

- [ ] **Step 3: Implement AppIframeHost with URL-fragment JWT transport**

For the spike we use the **URL fragment** transport (not query string — fragments are not logged in server access logs). Post-spike decision doc (Task 10) will compare this with postMessage.

```jsx
// tools/app-shell/src/windows/spike-apps-host/AppIframeHost.jsx
import React, { useEffect, useState } from 'react';

async function fetchAppToken(appId) {
  const res = await fetch(`/etendo/neo/apps/token?appId=${encodeURIComponent(appId)}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`token endpoint failed: ${res.status}`);
  const body = await res.json();
  return body.token;
}

export default function AppIframeHost({ appUrl, appId }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await fetchAppToken(appId);
        setSrc(`${appUrl}/#jwt=${token}`);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [appUrl, appId]);

  if (error) return <div className="p-8 text-red-600">App token error: {error}</div>;
  if (!src) return <div className="p-8 text-gray-500">Loading app…</div>;

  return (
    <iframe
      title={appId}
      src={src}
      sandbox="allow-scripts allow-same-origin allow-forms"
      className="w-full h-full border-0"
    />
  );
}
```

- [ ] **Step 4: Implement route wrapper**

```jsx
// tools/app-shell/src/windows/spike-apps-host/index.jsx
import React from 'react';
import AppIframeHost from './AppIframeHost.jsx';

export default function SpikeHelloAppWindow() {
  return (
    <AppIframeHost
      appUrl={import.meta.env.VITE_SPIKE_APP_URL || 'http://localhost:5173'}
      appId="spike-hello-app"
    />
  );
}
```

- [ ] **Step 5: Read the front-end so the app reads `#jwt=<token>`**

Modify `tools/spike-hello-app/src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Extract JWT from URL fragment and stash it for /api calls.
const hash = new URLSearchParams(window.location.hash.slice(1));
const jwt = hash.get('jwt');
if (jwt) {
  // Wrap fetch so every /api call carries Authorization.
  const rawFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api')) {
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${jwt}`);
      return rawFetch(input, { ...init, headers });
    }
    return rawFetch(input, init);
  };
  // Clear JWT from URL so it doesn't linger in history.
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 6: Register the window**

Edit `tools/app-shell/src/windows/registry.js`:

```js
// inside windowLoaders (after last entry, before the closing `};`)
'spike-hello-app': () => import('./spike-apps-host/index.jsx'),
```

- [ ] **Step 7: Add menu entry**

Edit `tools/app-shell/src/menu.json` — add a new group at the end:

```json
{
  "name": "spike-apps",
  "label": { "en_US": "Spike Apps", "es_ES": "Spike Apps" },
  "icon": "lab",
  "items": [
    {
      "name": "spike-hello-app",
      "label": { "en_US": "Hello App (spike)", "es_ES": "Hello App (spike)" }
    }
  ]
}
```

- [ ] **Step 8: Run tests + launch dev**

```bash
# Shell test
cd tools/app-shell && node --test src/windows/spike-apps-host/__tests__/AppIframeHost.test.jsx
# All app-shell tests
npm test
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add tools/app-shell/src/windows/spike-apps-host/ \
        tools/app-shell/src/menu.json \
        tools/app-shell/src/windows/registry.js \
        tools/spike-hello-app/src/main.jsx
git commit -m "Feature ETP-3805: Embed spike app via iframe host + hardcoded menu"
```

---

## Task 9: End-to-end smoke verification

**Files:** none created — verification only.

- [ ] **Step 1: Start Etendo Go**

```bash
cd <etendo_root>
./gradlew smartbuild
# ensure Tomcat is running and /etendo responds
```

- [ ] **Step 2: Start spike app**

```bash
cd tools/spike-hello-app
npm run dev
# UI at 5173, server at 4100
```

- [ ] **Step 3: Build and serve app-shell**

```bash
cd tools/app-shell
npm run dev
# typically at http://localhost:3100
```

- [ ] **Step 4: Execute smoke path**

1. Open shell at `http://localhost:3100`, log in
2. Open sidebar → "Spike Apps" → "Hello App (spike)"
3. Observe: iframe loads; after ~1s, text reads "Hello {yourUserId} from tenant {yourTenantId}, you have {N} products"
4. Open DevTools Network tab:
   - `POST /etendo/neo/apps/token` → 200
   - `GET /api/me` (inside iframe) → 200
   - `GET /api/etendo/neo/entity/product?limit=1` → 200
   - No CORS errors in console

- [ ] **Step 5: Negative checks**

1. Open iframe URL directly without `#jwt=` → UI should show an error (calls to `/api/me` return 401)
2. Tamper with the JWT in URL fragment → same 401
3. Let a JWT sit > 5 min and retry → app fails cleanly (401 from `/api/me`)

- [ ] **Step 6: Record latency numbers**

In DevTools Performance, capture:
- Time from menu click → iframe first byte
- Time from iframe load → first `/api/etendo/*` response
- p50, p95 over 10 reloads

Save the numbers into the learnings doc in the next task.

- [ ] **Step 7: No commit — verification only**

---

## Task 10: Write spike learnings document

**Files:**
- Create: `docs/proposals/etendo-go-apps-spike-learnings.md`
- Modify: `docs/proposals/INDEX.md` (add row)
- Modify: `docs/index.md` (add row under Proposals)

- [ ] **Step 1: Write the learnings doc**

```markdown
# Etendo Go Apps — F1 Spike Learnings

**Date:** <date-of-completion>
**Jira:** ETP-3805
**Proposal:** [etendo-go-apps.md](etendo-go-apps.md)
**Plan:** [../plans/2026-04-17-etendo-go-apps-f1-spike-plan.md](../plans/2026-04-17-etendo-go-apps-f1-spike-plan.md)

## What we built

Hardcoded "hello world" app running end-to-end:
- Etendo Go issues RS256 JWTs (`/neo/apps/token`) + publishes JWKS (`/neo/apps/.well-known/jwks.json`)
- React shell opens an iframe, fetches a JWT, passes it via URL fragment
- Spike app (Node.js + React) verifies JWT via JWKS, proxies to NEO, renders user + product count

## Decisions to lock in for F1

### JWT transport into the iframe

**Chose:** URL fragment (`#jwt=<token>`) cleared from history after read.
**Pros observed:** simpler, no extra round trip, no sync issues on iframe src load.
**Cons observed:** <fill-in — e.g., token visible in DOM briefly; history.replaceState mitigates>.
**Recommendation for F1:** <keep fragment | switch to postMessage handshake | support both>
**Reason:** <concrete data from spike>

### NEO JWKS compatibility

<Did NEO Headless accept the RS256 JWT as an authenticated session? yes/no/partially>
<What code changes, if any, were needed in NEO to validate tokens issued by /neo/apps/token?>
<Any session/user resolution gotchas (e.g., OBContext not populated)?>

### BFF proxy viability

<Latency numbers captured in Task 9 Step 6>
<p50 ___ ms / p95 ___ ms for /api/etendo/* round-trip>
<Any streaming or large-payload issues?>
<Any unexpected header forwarding problems?>

### CORS

<Was any CORS configuration needed? Document exactly what and where.>

## Unknowns closed

- [x] JWT transport: decided above
- [x] NEO accepts RS256 JWTs: <yes/no — evidence>
- [x] Proxy latency acceptable: <yes/no — numbers>
- [x] Same-origin browser → server works without CORS friction: <yes/no>

## Unknowns still open (for F1 plans)

- Scope catalogue (which scopes does NEO honour?)
- Key rotation procedure (how to rotate without breaking in-flight tokens)
- Descriptor schema version 1 fields — final list after we see real app needs
- Admin UI scope (F3) — which install management flows are truly required

## Recommended next steps

1. Write F1.1 plan: `ETGO_APP_*` tables + descriptor ingestion
2. Write F1.2 plan: production-grade JWT issuer (key rotation, multi-tenant, scopes)
3. Write F1.3 plan: shell menu slot wired to `ETGO_APP_MENU` (replace hardcoded entry)
4. Write F1.4 plan: lifecycle webhooks + first real internal app (F2 candidate: Notes)
```

- [ ] **Step 2: Fill in all `<...>` placeholders**

Go back through the doc and fill every bracketed placeholder with the actual observations from the spike. **Do not commit until all placeholders are replaced.**

- [ ] **Step 3: Update INDEX.md and docs/index.md**

Add to `docs/proposals/INDEX.md` table:

```
| [etendo-go-apps-spike-learnings.md](etendo-go-apps-spike-learnings.md) | Done | Spike outcomes — decisions for F1 plans |
```

Add to `docs/index.md` under Proposals:

```
| [proposals/etendo-go-apps-spike-learnings.md](proposals/etendo-go-apps-spike-learnings.md) | Done | F1 spike learnings and decisions for F1 plans |
```

- [ ] **Step 4: Commit**

```bash
git add docs/proposals/etendo-go-apps-spike-learnings.md \
        docs/proposals/INDEX.md \
        docs/index.md
git commit -m "Feature ETP-3805: Document apps spike learnings"
```

---

## Self-Review Results

**Spec coverage:** Each proposal section covered:
- §2 Proposal → Tasks 2–9 (JWT, iframe, BFF, hello-world demo)
- §3 Scope (menu entries only) → Task 8 (menu.json entry + iframe window)
- §4 Phases → This plan is F1 spike; F1.1–F1.4 sub-plans called out in Task 10
- §5 Value / §6 Risks / §7 KPIs → Not implemented code, proposal-level; no tasks needed
- §8 Next steps (#4 "Technical spike") → Entire plan
- Annex §3 JWT+JWKS → Task 2 (service) + Task 3 (endpoints)
- Annex §4 BFF → Task 6 (proxy) + Task 5 (JWT middleware)
- Annex §5 Lifecycle → Out of scope for spike; F1.1 plan
- Annex §6 Tables → Out of scope for spike; F1.1 plan
- Annex §7 SDK → Out of scope; F2 plan
- Annex §8.1 open questions (JWT transport) → Tasks 8 + 10 (decide + document)

**Placeholder scan:** The `<...>` placeholders inside the learnings doc (Task 10) are intentional — they are filled by the engineer during execution based on real spike observations. All other steps contain concrete code and commands.

**Type consistency:** Functions used across tasks are consistent:
- `JwtIssuerService.issue(...)` and `.getPublicKey()` / `.getKid()` — Tasks 2, 3
- `verifyJwt(token, {jwksUrl, audience})` and `requireJwt({jwksUrl, audience})` — Tasks 5, 6
- `createEtendoProxy({target})` — Task 6
- `fetchEtendo(path)` / `fetchMe()` — Task 7
- `AppIframeHost({appUrl, appId})` — Task 8
- URL fragment key `jwt` — Tasks 8, 8-Step 5 (spike app reads it)

All match.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-17-etendo-go-apps-f1-spike-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
