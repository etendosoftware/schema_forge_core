# 01 -- Production Topology

Complete topology of a production deployment running Schema Forge generated modules on the Etendo platform.

## System Context

```
                          ┌─────────────────────────┐
                          │    End User Browser      │
                          │  (React SPA + PWA)       │
                          └────────────┬─────────────┘
                                       │ HTTPS
                                       ▼
                          ┌─────────────────────────┐
                          │  Load Balancer /         │
                          │  Reverse Proxy (nginx)   │
                          └──────┬──────────┬────────┘
                                 │          │
                    /etendo_sf/* │          │ /web/* (static)
                                 ▼          ▼
              ┌──────────────────────┐   ┌─────────────────────┐
              │   Etendo Tomcat 9    │   │ Static File Server  │
              │   (Java 17, CDI)     │   │ or CDN              │
              │                      │   │                     │
              │ ├─ Classic UI        │   │ └─ React SPA        │
              │ ├─ RequestHandlers   │   │    (app-shell +     │
              │ │  (REST API)        │   │     generated        │
              │ ├─ EventHandlers     │   │     windows)         │
              │ │  (CDI observers)   │   │                     │
              │ ├─ DalProcesses      │   └─────────────────────┘
              │ │  (business logic)  │
              │ └─ SelectorHandlers  │
              │    (FK search)       │
              │                      │
              └──────────┬───────────┘
                         │ JDBC (HikariCP pool)
                         ▼
              ┌──────────────────────┐
              │   PostgreSQL 14+     │
              │                      │
              │ ├─ AD_* tables       │
              │ │  (Application      │
              │ │   Dictionary)      │
              │ ├─ Business tables   │
              │ │  (C_Order, etc.)   │
              │ └─ AD_Session        │
              │    (auth state)      │
              └──────────────────────┘
```

## Component Inventory

### Etendo Tomcat (Application Server)

| Attribute | Value |
|-----------|-------|
| **What it is** | Apache Tomcat 9 running the Etendo Classic web application |
| **Where it runs** | JVM (Java 17) on a Linux server or container |
| **State it holds** | In-memory HTTP sessions (AD_Session), Hibernate L1/L2 cache, CDI bean instances |
| **Dependencies** | JDK 17, PostgreSQL 14+, Etendo Core JARs, generated module .class files |
| **If it is down** | All REST API endpoints are unavailable; SPA cannot fetch/save data; Classic UI is inaccessible |
| **Resources** | CPU: 2-4 cores; Memory: 2-4 GB heap (production); Disk: 500 MB for WAR + compiled classes |

**Key subsystems within Tomcat:**

#### RequestHandlers (REST API)
Generated classes implementing the `com.etendoerp.go` RequestHandler interface. Each window gets a versioned endpoint under `/etendo_sf/` serving CRUD operations (list, get, create, update, delete). These are NOT JAX-RS resources -- they use Etendo's own request dispatch mechanism from the `com.etendoerp.go` base module.

#### EventHandlers (CDI Observers)
CDI-managed beans annotated with `@Observes` that hook into Etendo's entity lifecycle (beforeSave, afterSave, beforeDelete). Handle field derivations (computed fields, defaults, cascading updates). Execute within the same OBDal transaction as the triggering operation -- no separate transaction boundaries.

#### DalProcesses (Business Logic)
AD_Process implementations for actions like "Complete Order" or "Post Document". Invoked via button clicks in the SPA, routed through Etendo's process infrastructure. Each process runs in its own OBDal transaction.

#### SelectorHandlers (FK Search)
Handle typeahead/search requests for foreign key fields (e.g., searching for a Business Partner by name). Return filtered result sets for selector dropdowns in the SPA.

#### PreconditionValidators
Check whether a process button should be enabled/disabled based on entity state. Called by the SPA before showing action buttons.

#### ErrorSerializer
Translates Java exceptions and OBDal constraint violations into structured JSON error responses that the SPA can display to users.

### React SPA (Frontend)

| Attribute | Value |
|-----------|-------|
| **What it is** | Single-page application built with React 18, served as static files |
| **Where it runs** | End user's browser |
| **State it holds** | Auth token (memory), current route, form state, cached entity data |
| **Dependencies** | Static file server or CDN, Etendo Tomcat API endpoints |
| **If it is down** | Users cannot access the modern UI; Classic UI still works independently |
| **Resources** | Browser: 50-100 MB memory; Server: negligible (static files) |

**Architecture details:**
- **App shell**: `tools/app-shell/` -- provides navigation, auth, theme, i18n, and the window loader
- **Window registry**: `registry.js` maps 35+ window slugs to dynamic imports from `@generated` alias
- **Code splitting**: Each window is a separate chunk loaded on demand via `() => import('@generated/...')`
- **PWA**: Service worker with `registerType: 'prompt'` -- users get an update notification, not forced refresh
- **i18n**: en_US + es_ES with 2,884 field labels; locale switcher persists preference
- **Auth flow**: Login via `/sws/login`, Bearer token in subsequent requests, 401 triggers re-login
- **API proxy**: Dev server proxies `/etendo_sf` to `localhost:8080` (Tomcat)

### PostgreSQL (Database)

| Attribute | Value |
|-----------|-------|
| **What it is** | Relational database storing all Etendo data and metadata |
| **Where it runs** | Dedicated server or managed service (RDS, Cloud SQL) |
| **State it holds** | All persistent state: business data, Application Dictionary (AD), sessions, audit trails |
| **Dependencies** | None (leaf node in the dependency graph) |
| **If it is down** | Complete system outage -- Tomcat cannot start, all reads/writes fail |
| **Resources** | CPU: 2-4 cores; Memory: 4-8 GB; Disk: 10-100 GB depending on data volume |

**Key table groups:**
- `AD_*` -- Application Dictionary: window, tab, field, column, process definitions. Populated during module installation (database migration strategy via Liquibase is under evaluation).
- Business tables (`C_Order`, `C_Invoice`, `M_Product`, etc.) -- the actual ERP data.
- `AD_Session` -- active user sessions with token, IP, timestamps.
- All `_ID` columns are `VARCHAR` (strings), even when values look numeric.

### Load Balancer / Reverse Proxy

| Attribute | Value |
|-----------|-------|
| **What it is** | nginx or cloud load balancer routing traffic to Tomcat and static file server |
| **Where it runs** | Edge server or cloud service |
| **State it holds** | TLS certificates, routing rules, optionally sticky sessions |
| **Dependencies** | DNS, TLS certificates |
| **If it is down** | No external access to the application |
| **Resources** | Minimal CPU/memory |

## Network Topology

### Browser to API (REST)
```
Browser ──HTTPS──▶ Load Balancer ──HTTP──▶ Tomcat:8080/etendo_sf/*
```
- Protocol: HTTPS (TLS terminated at load balancer) or HTTP in dev
- Auth: Bearer token in `Authorization` header
- Content-Type: `application/json`
- Session: Stateless requests with token; session state in `AD_Session` table

### Browser to Static Assets
```
Browser ──HTTPS──▶ Load Balancer ──HTTP──▶ Static Server (or Tomcat /web/*)
```
- Files: `index.html`, JS chunks, CSS, icons, `manifest.json`, service worker
- Caching: Long-lived cache for hashed assets (`index-BeTaPoxF.js`), no-cache for `index.html`
- Compression: gzip/brotli at the load balancer or static server level

### Tomcat to PostgreSQL (JDBC)
```
Tomcat ──JDBC──▶ PostgreSQL:5432
```
- Connection pool: HikariCP (Etendo default), configured in `Openbravo.properties`
- Pool size: typically 10-50 connections
- Transactions: OBDal manages Hibernate sessions; single DB transaction per request
- Failover: connection validation on borrow, auto-reconnect

### Internal (Same JVM)
```
RequestHandler ──▶ OBDal ──▶ Hibernate Session ──▶ JDBC
EventHandler   ──▶ OBDal ──▶ (same Hibernate Session as triggering request)
DalProcess     ──▶ OBDal ──▶ (own Hibernate Session/Transaction)
```
All backend components share the same JVM. EventHandlers execute synchronously within the calling request's transaction. No inter-service network calls.

## Environment Matrix

| Environment | Purpose | Components | Data | Who Accesses | Notes |
|-------------|---------|------------|------|--------------|-------|
| **Local Dev** | Fast loop preview, UI iteration | Vite dev server (port 3100) + mockFetch | Mock data from `mockData.js` files | Developer | No Tomcat or DB needed; `VITE_MOCK=true` |
| **Local Full** | Backend integration testing | Etendo Tomcat + PostgreSQL + Vite proxy | Local DB (dev data) | Developer | Vite proxies `/etendo_sf` to Tomcat |
| **Integration (CI)** | Automated verification | Etendo Tomcat + generated module + PostgreSQL | Test DB (seeded) | CI/CD pipeline | `gradlew smartbuild` + contract tests + JUnit |
| **Staging** | Pre-production validation | Full stack + reverse proxy | Anonymized production data | QA team | Mirrors production topology |
| **Production** | End users | Full stack + CDN + monitoring | Real data | Everyone | HA configuration, backups, alerting |

## Infrastructure Dependencies

| Dependency | Version | Required By | Purpose | Build-time | Runtime |
|------------|---------|-------------|---------|------------|---------|
| JDK | 17 | Tomcat, Gradle | Java compilation and runtime | Yes | Yes |
| Apache Tomcat | 9.x | Etendo Core | Servlet container | No | Yes |
| PostgreSQL | 14+ | Etendo Core | Data persistence | No | Yes |
| Node.js | 22.x | Frontend build | Vite build toolchain | Yes | No |
| npm | 10.x | Frontend build | Package management | Yes | No |
| Gradle (gradlew) | 7.x (wrapper) | Backend build | Java compilation orchestration | Yes | No |
| Etendo Core JARs | 26.x | Generated module | Platform APIs (OBDal, CDI, etc.) | Yes | Yes |
| `com.etendoerp.go` | latest | Generated module | RequestHandler interface, base module | Yes | Yes |

## Deployment Artifacts

| Artifact | Format | Source | Destination | Deployed How |
|----------|--------|--------|-------------|--------------|
| Java classes | `.class` files | `gradlew smartbuild` | `WEB-INF/classes/` under Tomcat | Copy + Tomcat restart |
| Frontend bundle | JS/CSS/HTML | `npm run build` (Vite) | `web/{window}/` or CDN | File copy (no restart needed) |
| DB migrations | SQL/Liquibase changesets | TBD (under evaluation) | AD_* tables in PostgreSQL | TBD (Liquibase runner or Etendo import) |
| Module metadata | `build.gradle` | Generated | `modules/{module-javapackage}/` | Part of module installation |
| PWA assets | `sw.js`, `manifest.json` | Vite PWA plugin | Served alongside frontend | File copy |
| i18n bundles | JSON (`en_US.json`, `es_ES.json`) | Curated label files | Bundled with frontend | Included in Vite build |
