# Etendo Apps SDK — Internal Apps v1

> **Status:** Draft / Pending approval
> **Goal:** Extract the ETP-3805 spike plumbing into two versioned packages so internal apps (starting with `quick-order`) can be built without hand-rolling auth, JWKS verification, service-token bridging, or NEO proxying.
> **Scope:** Internal apps only. Third-party addons are explicitly out of scope for v1 — see §10.
> **Last updated:** 2026-04-20
> **Implementation status (2026-04-20):** Phase A+B+C complete. SDK packages live (`@etendoerp/apps-sdk` + `@etendoerp/apps-sdk-bff`), spike and quick-order consume them. First real consumer (`tools/quick-order-app/`) ships with two menu entries (Quick Sales Order, Quick Purchase Order) driven by the same `QuickOrderWindow` and `?type=sales|purchase`.

---

## 1. Context

The ETP-3805 spike proved the end-to-end flow: RS256 app JWT minted by the shell, verified in an Express BFF via JWKS, swapped for an Etendo-native service token, and forwarded to NEO Headless. The code that made it work lives in `tools/spike-hello-app/src/`:

- `jwt-middleware.js` — `requireJwt({ jwksUrl, audience })`
- `etendo-proxy.js` — `createEtendoProxy({ target, etendoAuth })` (returns two-stage middleware because `http-proxy-middleware` v3's `on.proxyReq` is synchronous)
- `etendo-auth.js` — `createEtendoAuth({ etendoUrl, user, password })` with exp-based refresh
- `fetchEtendo.js` — browser-side `fetch` wrapper that sends the app JWT

The spike also taught us a set of non-obvious things (Tomcat context is `/etendo_sf2/`, Etendo login returns ES256, http-proxy-middleware is not async-safe, Express strips mount prefixes, the inbound token must never reach NEO). Those lessons should be baked into the SDK so future consumers do not rediscover them.

Today copying this for `quick-sales-order` or `quick-purchase-order` would mean duplicating ~200 lines of BFF glue per app. With two consumers on the horizon and more coming, an SDK is justified.

## 2. Objective

Deliver two npm workspace packages inside this monorepo:

- `@etendoerp/apps-sdk` — browser SDK consumed by the iframe app
- `@etendoerp/apps-sdk-bff` — Node/Express SDK consumed by the app's BFF

Both packages replace hand-written code in any internal app and enforce the correct token flow by construction.

## 3. Non-Goals (v1)

- No publishing to public npm. Packages consumed via `workspace:*`.
- No third-party addon support (no scopes-per-capability, no CSP sandbox, no API stability promise, no addon store, no audit log).
- No descriptor file (`apps.json`) — descriptor format deferred until 3rd-party work begins.
- No breaking-change policy — semver resets with each internal consumer migration.
- No TypeScript in v1. JS + JSDoc types, to match the rest of the monorepo.

## 4. Architecture

```
┌────────────────────┐   RS256 app JWT   ┌────────────────────┐
│ shell (app-shell)  │──────────────────▶│ iframe: quick-order│
│ port 3100          │   via postMessage │   @etendoerp/apps-sdk │
│ mints via          │◀─ handshake ─────│                    │
│ /sws/apps/token    │                   └──────────┬─────────┘
└────────────────────┘                              │ Authorization: Bearer <app-jwt>
                                                    ▼
                                          ┌────────────────────┐
                                          │ app BFF (Express)  │
                                          │ port 4101..N       │
                                          │ @etendoerp/apps-sdk-  │
                                          │         bff       │
                                          └──────────┬─────────┘
                                                     │ service-account JWT
                                                     ▼
                                          ┌────────────────────┐
                                          │ NEO Headless       │
                                          │ /etendo_sf2/sws/*  │
                                          └────────────────────┘
```

## 5. Monorepo Layout

Add `packages/` to the workspaces list:

```
packages/
  apps-sdk/            # browser
    src/index.js
    src/shellClient.js
    test/*.test.js
    package.json       # name: "@etendoerp/apps-sdk"
  apps-sdk-bff/        # node/express
    src/index.js
    src/requireAppJwt.js
    src/createEtendoProxy.js
    src/createServiceAuth.js
    src/mountEtendoBff.js
    test/*.test.js
    package.json       # name: "@etendoerp/apps-sdk-bff"
```

Root `package.json` workspaces list adds `"packages/*"`. Consumers depend on `"@etendoerp/apps-sdk": "workspace:*"`.

## 6. Browser SDK — `@etendoerp/apps-sdk`

### 6.1 Public API (v1)

```js
import { createShellClient } from '@etendoerp/apps-sdk';

const shell = createShellClient({
  appId: 'quick-order',
  token,             // string — passed from the iframe host via props/URL
  bffBaseUrl: '',    // default '' → same-origin /api
});

const me = await shell.me();
// → { userId: 'C17F…', tenant: '041D…', org: '0' }

const rows = await shell.fetch('/neo/product/product?_pageSize=10');
// → parsed JSON body, throws on non-2xx

// Reserved for v1.1 (stub in v1 — returns noop unsubscribe):
shell.on('locale-changed', (locale) => …);
shell.on('theme-changed', (theme) => …);
shell.on('user-changed', (user) => …);
```

### 6.2 Internals

- Single `fetch` wrapper that always prefixes `/api/etendo` and sends `Authorization: Bearer <token>`.
- `shell.me()` calls `/api/me`.
- Event bus is a no-op in v1 — just records listeners so callers that adopt it now keep working when the postMessage protocol lands in v1.1.
- No in-iframe token refresh in v1. The shell mints a **1-hour** token (Vite plugin `ttlSeconds: 3600`), which covers quick-order flows even with distraction. Silent `postMessage`-based refresh is deferred to v1.1. If a request hits 401, the SDK surfaces a typed `TokenExpiredError` and the consumer decides how to recover; no implicit retry.

### 6.3 Testing

- Unit: mock `fetch`, verify headers and URL composition.
- Integration: `node:test` spins up a tiny Express BFF using the BFF SDK + a mock NEO and asserts the full loop.

## 7. BFF SDK — `@etendoerp/apps-sdk-bff`

### 7.1 Public API (v1)

```js
import express from 'express';
import { mountEtendoBff } from '@etendoerp/apps-sdk-bff';

const app = express();
mountEtendoBff(app, {
  appId: 'quick-order',
  jwksUrl: process.env.JWKS_URL,
  etendoUrl: process.env.ETENDO_URL, // e.g. http://localhost:8080/etendo_sf2
  serviceAuth: {
    user: process.env.ETENDO_SERVICE_USER,
    password: process.env.ETENDO_SERVICE_PASSWORD,
  },
});
// mounts:
//   GET  /health            → { ok: true }
//   GET  /api/me            → { userId, tenant, org } (requires app JWT)
//   *    /api/etendo/*      → proxies to ${etendoUrl}/sws/* with service token

app.listen(process.env.PORT || 4100);
```

Low-level exports (for apps that need a different shape):

```js
import {
  requireAppJwt,     // (opts) → Express middleware
  createEtendoProxy, // (opts) → [attachServiceToken, proxyMiddleware]
  createServiceAuth, // (opts) → { getToken }
} from '@etendoerp/apps-sdk-bff';
```

### 7.2 Guarantees baked in

- Inbound `Authorization` header is **never** forwarded upstream. The proxy replaces it with the service-account token.
- `on.proxyReq` reads the token synchronously from `req.etendoServiceToken` (set by the async `attachServiceToken` middleware that runs before the proxy). This is the fix we discovered the hard way.
- Service token is cached and refreshed 60s before `exp`. Concurrent refresh requests are coalesced.
- Path rewrite prepends `/sws` after Express strips the mount prefix (`/api/etendo/neo/x` → `/sws/neo/x`).

### 7.3 Testing

- Unit: each middleware in isolation against mocked Etendo + mocked JWKS.
- Integration: end-to-end — mint RS256 with a test key, run the BFF in-process, stub upstream, assert header swap and path rewrite.
- Regression: ensure the inbound JWT is not forwarded upstream (this is the single most important security invariant and easy to break).

## 8. Token flow (unchanged from spike)

1. User logs in to the shell (Etendo session → ES256 cookie/token).
2. Shell renders `<iframe src={app.iframeUrl}>` and POSTs `/sws/apps/token?appId=<id>` with the Etendo Bearer → receives RS256 app JWT (aud: `[etendo-go, appId]`, 5-min TTL).
3. Shell passes the token to the iframe (props for same-origin dev, postMessage handshake for prod — dev-only shortcut in v1 is fine, we already do this).
4. Iframe app loads `@etendoerp/apps-sdk` with that token, calls its BFF.
5. BFF `requireAppJwt` verifies signature via JWKS, audience, expiry → attaches `req.etendoContext`.
6. BFF `/api/etendo/*` swaps Authorization for cached service-account token → proxies upstream to NEO.

## 9. App registry — hardcoded v1

No DB table. No `decisions.json` entry. The list of allowed `appId`s lives in a single JS module inside the shell:

```js
// tools/app-shell/src/apps-registry.js
export const INTERNAL_APPS = [
  { appId: 'spike-hello-app',  iframeUrl: 'http://localhost:5173' },
  { appId: 'quick-order',      iframeUrl: 'http://localhost:5174' },
];
```

The Vite `apps-spike.js` plugin already validates `appId` on `/sws/apps/token` — it should read this list instead of accepting any string. The iframe host window reads the same list to know which URL to embed.

**When we add DB-backed registration (future), this module becomes a fallback/seed.** No API change to the SDK — the change is shell-internal.

## 10. Out of scope (v1) — parked for later

| Item | Why deferred |
|------|--------------|
| 3rd-party addons | Different security model (scoped perms, CSP, sandbox, audit) — changes package shape |
| Descriptor file (`apps.json`) | Only needed for declarative registration of untrusted apps |
| Silent token refresh (postMessage) | v1 uses a 1-hour TTL instead; postMessage refresh protocol lands in v1.1 together with the rest of the shell event bus |
| postMessage event bus | Stubbed API now, wired in v1.1 when first consumer needs it |
| TypeScript types | JSDoc is enough for internal consumers; publishable types come with npm publish |
| npm publish | Workspace-only until a consumer outside the monorepo exists |
| Capability grants / scopes | Currently `scopes: ['read:products','read:users']` hardcoded in shell plugin; irrelevant for internal apps that have full NEO access via service token |

## 11. First consumer — `quick-order-app`

Single iframe app, driven by `?type=sales|purchase`. Lives at `tools/quick-order-app/`. Plan lives in its own doc (§13).

High-level:
- Same form, same lines grid, same validations.
- SDK call for header+lines fetching: `shell.fetch('/neo/sales-order/sales-order' | '/neo/purchase-order/purchase-order')`.
- Two menu entries in the shell host, both pointing to the same iframe URL with different `type` query params.
- Uses `@etendoerp/apps-sdk` + `@etendoerp/apps-sdk-bff` directly, **without touching the packages**. If we cannot build quick-order without editing the SDK, the SDK is not v1-ready.

## 12. Migration plan

**Phase A — extract (no consumer breakage)**
1. Create `packages/apps-sdk` and `packages/apps-sdk-bff` with code moved verbatim from `tools/spike-hello-app/src/*`.
2. Add unit + integration tests inside each package (the spike has a few tests; bring them over and expand).
3. Update root `package.json` workspaces.

**Phase B — refactor the spike (regression proof)**
4. `tools/spike-hello-app` uses the SDK instead of its own `src/*`. Delete the duplicated files.
5. Rerun the full spike E2E: login → token mint → `/api/me` → `/api/etendo/neo/product/product` must still return 200 with product data.

**Phase C — build quick-order**
6. Scaffold `tools/quick-order-app` (Vite + Express BFF), consume SDK only.
7. Add two shell menu entries + registry entries.
8. E2E through shell iframe for both `type=sales` and `type=purchase`.

Each phase is its own branch/PR under a new Jira issue (child of ETP-3805 or sibling epic — TBD with product).

## 13. Follow-up docs (not in this proposal)

- `docs/plans/<date>-apps-sdk-extraction-plan.md` — Phase A + B step-by-step
- `docs/plans/<date>-quick-order-app-plan.md` — Phase C step-by-step
- `docs/proposals/etendo-apps-sdk-v2-3rd-party.md` — scoped addons, descriptor, CSP (future)

## 14. Port allocation convention

Fixed ranges, documented here and respected by every new internal app:

- **Vite dev server:** `5173 + N`
- **BFF:** `4100 + N`

Each new app gets the next `N` and the pair is written into its `package.json` scripts (no env-var juggling in dev). Allocation table:

| N | App | Vite | BFF |
|---|-----|------|-----|
| 0 | spike-hello-app | 5173 | 4100 |
| 1 | quick-order-app | 5174 | 4101 |

The app's own Vite config proxies `/api/*` from its port (`5173+N`) to its BFF port (`4100+N`), so the iframe always talks same-origin. The shell does not need to know the BFF port — only the Vite URL, which is already in the hardcoded registry (§9).

## 15. Open questions

- **How does the shell learn the BFF URL for each app?** It does not — see §14. The shell only knows the iframe URL (Vite); the iframe calls its BFF same-origin through Vite's proxy. Closed.

## 16. Decision log

- 2026-04-17:
  - #1 Monorepo layout under `packages/apps-sdk/` and `packages/apps-sdk-bff/` via npm workspaces — **approved**.
  - #2 Public API surface (`createShellClient`, `mountEtendoBff` + low-level exports) — **approved**.
  - #3 App registry hardcoded in a JS module under the shell — **approved**.
  - #4 Token refresh strategy: **C — 1-hour TTL for v1**, silent postMessage refresh deferred to v1.1.
  - #5 Package namespace: **`@etendoerp/*`** (aligns with `com.etendoerp.go` and existing GitHub org).
  - #6 Jira parenting: **all work stays under ETP-3805** (no new epic, subtasks/branches under the same ticket).
  - #7 Port allocation: **fixed ranges** (Vite `5173+N`, BFF `4100+N`) as documented in §14.
