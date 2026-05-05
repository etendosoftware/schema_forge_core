# Etendo Go Apps — Technical Annex

**Status:** Draft — pending stakeholder approval
**Date:** 2026-04-17
**Executive summary:** [etendo-go-apps.md](etendo-go-apps.md)

This annex expands the executive proposal with architecture, contracts, auth, lifecycle, and SDK details.

---

## 1. Architecture overview

```
┌──────────────────────────── Etendo Go (core SaaS) ────────────────────────────┐
│                                                                               │
│  ┌─────────────────┐   ┌─────────────────┐   ┌───────────────────────────┐   │
│  │  NEO Headless   │   │  App Registry   │   │  App Shell (React SPA)    │   │
│  │  (REST API)     │   │  (new tables    │   │  + slot: "Apps" menu      │   │
│  │  ETGO_SF_*      │   │  ETGO_APP_*)    │   │  + iframe host            │   │
│  └────────┬────────┘   └────────┬────────┘   └────────────┬──────────────┘   │
│           │                     │                         │                   │
│           │                ┌────┴────┐           JWT      │                   │
│           │                │  JWT    │◀──────────────────┘                   │
│           │                │ issuer  │   user context                         │
│           │                │ +JWKS   │                                        │
│           │                └────┬────┘                                        │
└───────────┼─────────────────────┼─────────────────────────────────────────────┘
            │ REST (with JWT)     │ webhooks install/uninstall
            │                     │
┌───────────▼─────────────────────▼─────────────────────────────────────────────┐
│                          Etendo Go App (external)                             │
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐                    │
│  │  App server  │  │  App DB      │  │  App UI          │                    │
│  │  (Node ESM)  │  │  (Postgres)  │  │  (React iframe)  │                    │
│  └──────────────┘  └──────────────┘  └──────────────────┘                    │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 New components in Etendo Go

| Component | Responsibility |
|-----------|----------------|
| **App Registry** | Tables `ETGO_APP`, `ETGO_APP_INSTALL`, `ETGO_APP_MENU`: catalogue, per-tenant installs, registered menu entries |
| **Descriptor Fetcher** | Validates and parses `app-descriptor.json` (pull from URL or manual upload). Enforces schema version compatibility |
| **JWT Issuer + JWKS** | Issues short-lived RS256 JWTs with user + tenant + org + app + scopes. Publishes public keys at `/.well-known/jwks.json` |
| **App Shell slot** | The shell renders one menu item per installed app. Click opens an iframe with the JWT pre-passed to the app UI |

### 1.2 Components built by the partner (or by us for internal apps)

| Component | Responsibility |
|-----------|----------------|
| **App descriptor** | Static JSON: `id`, `version`, `baseUrl`, `menuEntries`, `lifecycleHooks`, `scopes` |
| **App server** | Fixed stack in v1: Node.js 22 ESM + `pg`. Verifies incoming JWTs via JWKS, consumes NEO Headless through a BFF proxy, serves its own business logic |
| **App UI** | React 18 + Vite + Tailwind + Radix (same primitives as the shell for consistency). Loaded into the iframe. Module federation is reserved for certified partners in a later phase |
| **App DB** | Postgres. Isolated per app. Not accessed directly by Etendo Go |

### 1.3 Data flow — app that needs to list tenant orders

```
User → App Shell → opens iframe with JWT
                 ↓
               App UI → App Server (verifies JWT via JWKS)
                         ↓
                       App Server calls NEO Headless with same JWT
                         ↓
                       NEO Headless validates → returns tenant data
                         ↓
                       App Server responds → App UI renders
```

No browser → NEO calls. All cross-origin traffic is server-to-server.

---

## 2. App descriptor

Minimal `app-descriptor.json`:

```json
{
  "descriptorVersion": "1",
  "id": "com.acme.expenses",
  "name": "Expenses Tracker",
  "vendor": { "name": "Acme", "url": "https://acme.com" },
  "version": "1.2.0",
  "baseUrl": "https://expenses.acme.com",

  "authentication": {
    "type": "jwt",
    "algorithm": "RS256",
    "jwksVerification": true
  },

  "lifecycle": {
    "installed": "/etendo/installed",
    "uninstalled": "/etendo/uninstalled"
  },

  "menuEntries": [
    {
      "key": "expenses-home",
      "label": { "en_US": "Expenses", "es_ES": "Gastos" },
      "icon": "receipt",
      "path": "/",
      "parent": "apps"
    }
  ],

  "scopes": ["read:employees", "read:organizations"]
}
```

### 2.1 Field reference

| Field | Required | Notes |
|-------|----------|-------|
| `descriptorVersion` | yes | Schema version. Etendo Go supports `N` and `N-1` |
| `id` | yes | Reverse-DNS. Immutable across versions. Identifies the app globally |
| `version` | yes | Semver. Triggers update flow when it changes |
| `baseUrl` | yes | HTTPS only. All relative paths (`menuEntries[].path`, `lifecycle.*`) are resolved against this |
| `authentication.jwksVerification` | yes | Must be `true` in v1. App retrieves public keys from Etendo Go JWKS endpoint |
| `lifecycle.installed` | yes | POST endpoint invoked once per tenant install |
| `lifecycle.uninstalled` | yes | POST endpoint invoked once on uninstall |
| `menuEntries[]` | yes (≥1) | v1 requires at least one menu entry (sole integration surface) |
| `scopes[]` | yes | Scopes requested against NEO Headless. Admin consent required on install |

### 2.2 Schema validation

Etendo Go validates every descriptor against a JSON Schema bundled with the core. Invalid descriptors are rejected with a structured error. The schema is versioned alongside `descriptorVersion` to ensure backward compatibility.

---

## 3. JWT + JWKS (unified token)

### 3.1 Decision

JWT signed with **RS256** (asymmetric). Etendo Go holds the private key. Both NEO Headless and the app server verify tokens using the public key fetched from the JWKS endpoint.

- Endpoint: `https://<tenant>.etendo.go/.well-known/jwks.json`
- Public endpoint, no auth required, cacheable with respect to `Cache-Control` and `kid` rotation.
- One token, two consumers (NEO + app server), zero per-app shared secrets.

### 3.2 Claims

```json
{
  "iss": "https://<tenant>.etendo.go",
  "sub": "user-123",
  "aud": ["etendo-go", "com.acme.expenses"],
  "tenant": "acme-prod",
  "org": "acme-hq",
  "app": "com.acme.expenses",
  "scopes": ["read:employees"],
  "iat": 1713199700,
  "exp": 1713200000
}
```

| Claim | Purpose |
|-------|---------|
| `iss` | Tenant URL. Used for JWKS lookup |
| `aud` | NEO validates `"etendo-go" ∈ aud`; app server validates `appId ∈ aud` |
| `tenant`, `org` | Isolation context. NEO enforces row-level filters from these |
| `app` | App identity. Enables per-app scoping and auditing |
| `scopes` | Permissions granted by admin consent on install |
| `exp` | 5-minute TTL in v1. Shell refreshes transparently for long sessions |

### 3.3 Why not symmetric shared secrets

- Per-app secrets multiply operational surface (rotation, storage, leak blast radius)
- NEO would need to know the secret of every app to validate the same token → leaks tenant data to app-owned secret store
- JWKS is a well-understood standard (OIDC). Partner SDKs already exist in every language

---

## 4. BFF pattern — no CORS, single token in the browser

**Rule:** the app UI never calls NEO Headless directly from the browser. All cross-origin traffic goes through the app server.

```
App UI (iframe)
      │
      │ /api/*                    (same origin → no CORS)
      ▼
App Server ──┬─ /api/etendo/*     (typed proxy to NEO, JWT re-injected)
             └─ /api/app/*        (app's own endpoints)
                     │
                     ▼
              Etendo Go / NEO Headless
                     │
                     ▼
                 App DB
```

### 4.1 What this solves

| Concern | How |
|---------|-----|
| **CORS** | Zero — browser only talks to the app server's origin |
| **Token management in the browser** | Single JWT handled by the UI; the server reuses it for NEO |
| **Security** | Browser never knows NEO's internal URL or extra credentials |
| **Observability** | All outgoing NEO calls are logged in the app server (partner-visible) |
| **Composition** | Server can merge NEO + local DB data in a single UI response |
| **Caching** | Server can cache NEO responses per tenant without trusting the browser |

### 4.2 SDK proxy implementation sketch

```js
// Part of the SDK. Partner doesn't write this.
import { createNeoProxy } from '@etendo/app-sdk';

app.use('/api/etendo', requireJwt(), createNeoProxy({
  target: process.env.ETENDO_GO_URL,
  passJwt: true,
  allowlistedPaths: ['/neo/entities/**', '/neo/selectors/**']
}));
```

### 4.3 Explicit non-goal

Browser-direct NEO calls are **prohibited** in v1. We will not ship CORS configuration for NEO aimed at app origins. If a future use case needs it, it requires a separate RFC.

---

## 5. Lifecycle

### 5.1 Install

```
1. Admin pastes descriptor URL  (or uploads JSON)
2. Etendo Go fetches + validates schema + checks TLS
3. JWT issuer registers the app in JWKS audience list
4. Etendo Go POSTs to lifecycle.installed with { tenantId, appId, installId }
5. App persists tenant context in its own DB
6. Etendo Go creates rows in ETGO_APP_INSTALL + ETGO_APP_MENU
7. Menu items appear in the shell immediately
```

### 5.2 Launch (each menu click)

```
1. Shell requests a JWT from the core → { userId, tenantId, orgId, appId, exp: now+5min }
2. Shell opens iframe: {baseUrl}{menuEntry.path}?jwt=<token>
3. App verifies JWT with JWKS public key → renders
4. App UI calls /api/* on the app server (same origin)
5. App server re-uses the JWT to call /api/etendo/* proxy
```

### 5.3 Update

```
1. Cron in Etendo Go re-fetches the descriptor every N hours
2. If version changed → re-register menu entries and scopes
3. If new scopes require consent → flag to the tenant admin
```

### 5.4 Uninstall

```
1. Admin uninstalls via the UI
2. Etendo Go POSTs lifecycle.uninstalled
3. App cleans up tenant data
4. Etendo Go deletes ETGO_APP_INSTALL / ETGO_APP_MENU rows
5. JWT audience list drops the app → any token still in flight stops validating
```

---

## 6. Schema — new tables in Etendo Go

**Draft schema.** Final column list is decided in the F1 implementation plan.

### 6.1 `ETGO_APP` (global catalogue)

| Column | Type | Notes |
|--------|------|-------|
| `ID` | VARCHAR | PK |
| `APP_ID` | VARCHAR | Reverse-DNS from descriptor |
| `VENDOR_NAME` | VARCHAR | |
| `VENDOR_URL` | VARCHAR | |
| `CURRENT_VERSION` | VARCHAR | Latest seen descriptor version |
| `DESCRIPTOR_URL` | VARCHAR | Nullable (manual uploads) |
| `CREATED` / `UPDATED` | TIMESTAMP | Audit |

### 6.2 `ETGO_APP_INSTALL` (per-tenant instances)

| Column | Type | Notes |
|--------|------|-------|
| `ID` | VARCHAR | PK |
| `APP_ID` | VARCHAR | FK → `ETGO_APP` |
| `TENANT_ID` | VARCHAR | Tenant isolation |
| `INSTALLED_VERSION` | VARCHAR | Version active at install time |
| `STATUS` | VARCHAR | `active`, `suspended`, `uninstalled` |
| `SCOPES_JSON` | JSONB | Granted scopes (snapshot) |
| `INSTALLED_AT` | TIMESTAMP | |
| `UNINSTALLED_AT` | TIMESTAMP | Nullable |

### 6.3 `ETGO_APP_MENU` (registered menu entries)

| Column | Type | Notes |
|--------|------|-------|
| `ID` | VARCHAR | PK |
| `APP_INSTALL_ID` | VARCHAR | FK → `ETGO_APP_INSTALL` |
| `KEY` | VARCHAR | From descriptor |
| `LABEL_JSON` | JSONB | i18n label map |
| `ICON` | VARCHAR | Lucide icon name |
| `PATH` | VARCHAR | Relative to `baseUrl` |
| `PARENT` | VARCHAR | Menu grouping (`apps` by default) |
| `SORT_ORDER` | INT | |

Indexes: `(TENANT_ID, APP_ID)` on install, `(APP_INSTALL_ID, KEY)` on menu (unique).

---

## 7. SDK — `create-etendo-app`

`npx create-etendo-app my-app` scaffolds a repo with:

1. **`jwt-middleware.js`** — validates JWT via JWKS, caches keys, populates `req.etendoContext`
2. **`neo-client.js`** — typed NEO client (`neo.entity('employee').list({ where: ... })`) that re-injects the JWT automatically
3. **Generic proxy route** — `app.use('/api/etendo', neoProxy)` forwards any allowed path to NEO
4. **`fetchEtendo()` in the frontend** — wrapper that calls `/api/etendo/*` (same origin) instead of NEO directly
5. **Preconfigured CORS** — only the shell's origin is allowed (defence-in-depth on top of the iframe)
6. **`app-descriptor.json`** — sample with sensible defaults
7. **Dockerfile + CI workflow** — mirrors `tools/report-server/` conventions
8. **Lifecycle stubs** — `/etendo/installed` and `/etendo/uninstalled` handlers wired but empty
9. **Example feature** — CRUD against the app's own Postgres + one read via NEO, end-to-end

The partner writes business logic; they never touch auth, CORS, or proxying.

### 7.1 Reference stack (v1, fixed)

| Layer | Tech | Reference in the repo |
|-------|------|------------------------|
| App UI | React 18 + Vite + Tailwind + Radix (shadcn) | `tools/app-shell/` |
| App server | Node.js 22 ESM + `pg` | `tools/report-server/` |
| App DB | Postgres | same engine as Etendo Go |
| Deploy | Docker (ECS) | `tools/report-server/Dockerfile` |

Fixed stack rationale: v1 prioritises a tight, supported feedback loop. Every tool, template, and doc we ship assumes this stack. When (and if) partner demand justifies multiple server runtimes, the descriptor contract can accommodate them without breaking existing apps.

---

## 8. Security model

| Threat | Control |
|--------|---------|
| Malicious app registers with a legitimate `id` | Descriptor URL must be HTTPS with valid TLS; first-time registration requires admin confirmation; marketplace (F5) adds signed vendor identity |
| JWT leakage | 5-min TTL; JWKS rotation; the F1 spike passes the app JWT in the iframe URL query string, not the top-level browser URL; production hardening must decide whether to keep query-string launch or move to a fragment/postMessage handshake |
| Scope escalation | Scopes are snapshot at install; new scopes require re-consent by admin |
| Compromised app exfiltrates tenant data | Scopes limit NEO access; per-app audit log; admin can suspend (`ETGO_APP_INSTALL.STATUS = 'suspended'`) → all tokens reject immediately |
| Replay attacks | `jti` + short `exp` + optional nonce on lifecycle webhooks |
| CSRF on app server | Same-origin calls + SameSite cookies if used; JWT in `Authorization` header preferred |

### 8.1 Open security questions (to close in F1 spike)

- JWT transport into the iframe: the F1 spike uses a query-string token. Before production, decide whether to keep that launch shape or move to a fragment/postMessage handshake.
- Descriptor origin verification: do we require a DNS TXT record for the vendor domain, or only TLS?
- Scope catalogue: who defines the initial list of scopes NEO honours? F1 ships a minimal set; F3 formalises the catalogue.

---

## 9. Relationship to existing Etendo Go components

| Component | Relationship |
|-----------|--------------|
| **NEO Headless** | Unchanged in v1. Accepts JWTs with `"etendo-go" ∈ aud`. Future: a per-app scope check layer |
| **Schema Forge pipeline** | Unchanged. Apps are a separate extension surface, not a `decisions.json` feature |
| **App Shell** | Gains a new menu slot (driven by `ETGO_APP_MENU`) and an iframe host component |
| **NeoHandler pattern** (`docs/neo-headless-extensibility.md`) | Remains the in-process extension mechanism for core behaviour; apps are the out-of-process extension mechanism |

Apps and NeoHandlers are complementary, not competitive:
- **NeoHandler** = custom behaviour inside the core, written by us, coupled to the Etendo Go release cycle
- **App** = independent functionality outside the core, written by anyone, on its own release cycle

---

## 10. Open items for the F1 implementation plan

These are decisions deferred to the F1 plan, not blockers to approving the proposal:

1. JWT transport into the iframe (keep query-string launch or move to fragment/postMessage handshake)
2. Concrete NEO proxy allowlist format and default policy
3. Initial NEO scope catalogue
4. Descriptor schema JSON Schema file location and versioning process
5. Admin UI for "Installed Apps" — scope for F3, wireframes deferred
6. Cron / polling cadence for descriptor update detection
7. Feature flag name and tenant opt-in mechanism for F1 rollout

---

## 11. References

- [Atlassian Connect documentation](https://developer.atlassian.com/cloud/jira/platform/understanding-jwt-for-connect-apps/) — conceptual inspiration
- [JWKS (RFC 7517)](https://datatracker.ietf.org/doc/html/rfc7517)
- [`docs/architecture-overview.md`](../architecture-overview.md) — Etendo Go architecture Schema Forge writes into
- [`docs/neo-headless-extensibility.md`](../neo-headless-extensibility.md) — complementary in-process extension mechanism
- [`tools/report-server/`](../../tools/report-server/) — Node.js ESM reference server
- [`tools/app-shell/`](../../tools/app-shell/) — React shell reference
