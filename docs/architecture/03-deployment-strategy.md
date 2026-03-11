# 03 — Deployment Strategy

How generated Etendo modules reach production: artifact composition, deployment sequence, rollback procedures, and failure mitigation.

---

## 1. Deployment Anatomy

A generated module currently produces **two deployment artifacts**, with a third (database migrations) planned:

| # | Artifact | Contents | Destination | Restart Required | Status |
|---|----------|----------|-------------|-----------------|--------|
| 1 | **Java module** | Compiled `.class` files, `hbm.xml` mappings, `AD_Module` descriptor | `modules/com.etendoerp.go.{window}/` inside the Etendo installation | Yes (Tomcat restart + smartbuild) | Implemented |
| 2 | **Frontend SPA** | Static JS/CSS/HTML bundle (React 18) | `web/{window}/` on Tomcat or external CDN/nginx | No (static files) | Implemented |
| 3 | **DB migrations** | AD_Window, AD_Tab, AD_Field, AD_Process, AD_Column records | PostgreSQL via Liquibase (or equivalent) | Restart recommended | **Pending** (Liquibase under evaluation) |

> **Key insight:** The frontend can be deployed independently of the backend. When the database migration strategy is implemented, the Java module and DB migrations will be tightly coupled and should always deploy together.

---

## 2. Deployment Sequence

### 2.1 Standard Deployment (Full Restart)

```
1. Pre-flight checks
2. Stop Etendo (Tomcat)
3. Copy Java module to modules/
4. Run gradlew smartbuild
5. Run database migrations (when implemented)
6. Deploy frontend to web/ or CDN
7. Start Etendo (Tomcat)
8. Verify: health check + smoke test
```

#### Step 1 — Pre-flight Checks

| Check | Command | Purpose |
|-------|---------|---------|
| Etendo version compatibility | Compare `AD_Module.javaPackageVersion` against target | Prevent ClassNotFoundException at runtime |
| Database backup exists | `pg_dump` or verify WAL archiving is current | Enable rollback if database migration corrupts data |
| Disk space | `df -h` on modules/ and Tomcat dirs | Prevent mid-deploy failures |
| No active users | Query `AD_Session` for active sessions | Minimize disruption |

**What can go wrong:** Deploying against an incompatible Etendo version. The module compiles locally but fails at runtime because base classes changed.
**Detection:** `ClassNotFoundException` or `NoSuchMethodError` in Tomcat logs on startup.
**Mitigation:** Always compile against the exact Etendo version running in production.

#### Step 2 — Stop Etendo

```bash
$CATALINA_HOME/bin/shutdown.sh
# Wait for graceful shutdown (max 60s)
# Verify: no java process on port 8080
```

**Time estimate:** 10–30 seconds for graceful shutdown.
**What can go wrong:** Tomcat hangs on shutdown (stuck threads, open DB connections).
**Detection:** Process still running after 60 seconds.
**Rollback:** `kill -9` the Tomcat PID, then investigate stuck threads post-deployment.

#### Step 3 — Copy Java Module

```bash
cp -r build/com.etendoerp.go.{window}/ $ETENDO_HOME/modules/
```

**Time estimate:** < 5 seconds.
**What can go wrong:** File permission issues; partial copy due to disk full.
**Detection:** Compare file counts/checksums before and after copy.
**Rollback:** Remove the module directory, restore from backup.

#### Step 4 — Run `gradlew smartbuild`

```bash
cd $ETENDO_HOME
./gradlew smartbuild
```

This recompiles the Etendo application with the new module integrated. Hibernate mappings are regenerated, and the module's entity classes become available.

**Time estimate:** 2–10 minutes depending on Etendo size and hardware.
**What can go wrong:**
- Compilation error (incompatible API, missing dependency).
- Out of memory during compilation.
- Gradle daemon conflict.

**Detection:** Non-zero exit code from gradlew; compilation errors in stdout.
**Rollback:** Remove the module directory, run `smartbuild` again to restore previous state.

#### Step 5 — Run Database Migrations

> **Status:** Database migration strategy (Liquibase) is under evaluation. Not yet implemented.

When implemented, this step will register AD records (Window, Tab, Field, Process definitions) in PostgreSQL. These records tell the Etendo application dictionary about the new module's UI and business logic structure.

**Expected risks (when implemented):**
- Duplicate `AD_Window_ID` — the migration contains an ID collision with an existing window.
- Partial migration — some records inserted, then an FK constraint fails mid-execution.
- Character encoding issues in translatable fields.

**Rollback:** Database migrations will be the **hardest artifact to rollback**. See Section 4.3 below.

#### Step 6 — Deploy Frontend

```bash
# Option A: Serve from Tomcat
cp -r dist/ $ETENDO_HOME/WebContent/web/{window}/

# Option B: Serve from CDN/nginx
rsync -avz dist/ cdn-server:/var/www/{window}/
```

**Time estimate:** < 10 seconds.
**What can go wrong:** Old files cached by browser/PWA service worker.
**Detection:** Browser shows stale UI after deployment.
**Rollback:** Replace with previous build, invalidate CDN cache, trigger PWA update prompt.

#### Step 7 — Start Etendo

```bash
$CATALINA_HOME/bin/startup.sh
```

**Time estimate:** 30 seconds – 3 minutes (Hibernate initialization, entity scanning).
**What can go wrong:** Port conflict, insufficient memory, corrupted Hibernate cache.
**Detection:** Check `catalina.out` for `Server startup in X ms` message. Absence within 5 minutes indicates failure.
**Rollback:** Check logs, fix configuration, retry. If persistent, restore module backup and rebuild.

#### Step 8 — Verify

| Check | Method | Expected |
|-------|--------|----------|
| Tomcat running | `curl http://localhost:8080/etendo` | HTTP 200 |
| API responding | `GET /api/{entity}?_limit=1` | HTTP 200, valid JSON |
| Frontend loading | Open browser, navigate to window | React app renders |
| AD records present | `SELECT count(*) FROM ad_window WHERE name = '{window}'` | > 0 |
| No errors in log | `tail -100 $CATALINA_HOME/logs/catalina.out` | No exceptions |

**Time estimate:** 2–5 minutes for manual verification; < 30 seconds if automated.

---

## 3. Zero-Downtime Strategy

### 3.1 Tomcat Limitations

Etendo Classic on Tomcat 9 does **not** support true rolling restarts. Hibernate's SessionFactory is initialized once at startup and holds references to all mapped entities. Adding a new module requires Hibernate re-initialization, which requires a restart.

**Conclusion:** Zero-downtime deployment is not achievable with a single Tomcat instance for backend changes.

### 3.2 Blue/Green Deployment

The most practical approach for minimizing downtime:

```
               ┌─────────────────────┐
               │   Load Balancer     │
               │   (nginx/HAProxy)   │
               └──────┬──────┬───────┘
                      │      │
              ┌───────▼──┐ ┌─▼────────┐
              │ Blue     │ │ Green    │
              │ (active) │ │ (staged) │
              │ Tomcat A │ │ Tomcat B │
              └──────────┘ └──────────┘
                      │      │
               ┌──────▼──────▼───────┐
               │   PostgreSQL        │
               │   (shared)          │
               └─────────────────────┘
```

**Procedure:**
1. Deploy to Green (inactive) instance.
2. Run smartbuild + database migrations (when implemented) on Green.
3. Start Green, run health checks.
4. Switch load balancer to Green.
5. Drain Blue connections (wait for active requests to finish).
6. Blue becomes the staging instance for next deployment.

**Constraint:** Both instances share the same PostgreSQL database. Database migrations must be applied **before** switching traffic, meaning Blue (still serving) must be compatible with the new AD records. In practice, additive AD changes (new windows, new fields) are safe. Destructive changes (renamed columns, removed fields) require downtime.

### 3.3 Database Migration Ordering

**Database migrations should be applied BEFORE the new Java module serves traffic.**

Reasoning:
- The new RequestHandlers expect AD records to exist (e.g., for role-based access checks via `AD_Window_Access`).
- If the Java module starts before migrations run, API requests will fail with missing AD context.
- Existing (old) Java code is generally unaffected by new AD records being present — additive changes are safe.

> **Note:** Database migration strategy (Liquibase) is under evaluation. Not yet implemented. The ordering principle above will apply once the migration tooling is in place.

### 3.4 Frontend Independent Deployment

The React SPA communicates with the backend exclusively through REST endpoints. It can be deployed independently:

- **CDN deployment:** Upload new static files, invalidate cache. No Tomcat restart.
- **PWA update:** Service worker detects new version, prompts user to reload.
- **Version compatibility:** The frontend targets a specific `apiVersion`. If the backend API has not changed, frontend-only deployments are safe. If the API changed, deploy backend first.

---

## 4. Rollback Procedures

### 4.1 Frontend-Only Rollback

**Difficulty:** Low
**Downtime:** None

```bash
# 1. Restore previous frontend build
cp -r backup/web/{window}/ $ETENDO_HOME/WebContent/web/{window}/

# 2. Invalidate CDN cache (if using CDN)
# CDN-specific cache purge command

# 3. Force PWA update
# The new service worker hash will differ, triggering update prompt.
# For immediate effect, update the sw.js cache version identifier.
```

**Caveat:** Users with cached PWA may continue seeing the broken version until the service worker detects the change. Include a version check mechanism in the app shell that compares `clientVersion` against a server-side `/version` endpoint.

### 4.2 Backend-Only Rollback

**Difficulty:** Medium
**Downtime:** 5–15 minutes (Tomcat restart required)

```bash
# 1. Stop Tomcat
$CATALINA_HOME/bin/shutdown.sh

# 2. Restore previous module
rm -rf $ETENDO_HOME/modules/com.etendoerp.go.{window}/
cp -r backup/modules/com.etendoerp.go.{window}/ $ETENDO_HOME/modules/

# 3. Rebuild
cd $ETENDO_HOME && ./gradlew smartbuild

# 4. Start Tomcat
$CATALINA_HOME/bin/startup.sh
```

**Caveat:** If the new module's EventHandlers already processed and committed data (e.g., derived fields with new logic), that data remains in PostgreSQL with the new derivations. Rolling back the code does not roll back the data.

### 4.3 Full Rollback (Java + DB Migrations + Frontend)

**Difficulty:** High
**Downtime:** 15–45 minutes

Database migration rollback is the hardest part. Once AD records are written to PostgreSQL, reverting them requires one of:

#### Option A — DELETE Statements (Surgical)

```sql
-- Must delete in reverse dependency order
DELETE FROM ad_field WHERE ad_tab_id IN (
  SELECT ad_tab_id FROM ad_tab WHERE ad_window_id = '{window_id}'
);
DELETE FROM ad_tab WHERE ad_window_id = '{window_id}';
DELETE FROM ad_window WHERE ad_window_id = '{window_id}';
DELETE FROM ad_process WHERE ad_module_id = '{module_id}';
-- ... more tables depending on what the dataset registered
```

**Risk:** Missing a dependent table causes FK constraint violations. AD records may be referenced by user data (e.g., `AD_Window_Access` rows created by admins post-deployment).

#### Option B — Database Snapshot Restore

```bash
# Restore from pre-deployment backup
pg_restore -d etendo -c backup/pre_deploy.dump
```

**Risk:** Loses ALL changes made since the backup, not just the module's AD records. Only viable if rollback happens immediately after deployment, before users create new data.

#### Option C — Liquibase Rollback (When Implemented)

When the Liquibase migration strategy is implemented, each changeset can include rollback instructions. Running `liquibase rollback` would revert the specific AD record changes without affecting unrelated data. This is the preferred approach once available.

**Recommendation:** Always take a PostgreSQL snapshot (`pg_dump`) immediately before running database migrations. Keep it for at least 24 hours post-deployment.

---

## 5. Multi-Module Deployment

When deploying updates to multiple generated windows simultaneously:

### 5.1 Dependency Ordering

```
1. Deploy shared base module (com.etendoerp.go) FIRST
   - Contains RequestHandler interface, ErrorSerializer, base DTOs
   - All window modules depend on this

2. Deploy window modules in any order (they are independent)
   - com.etendoerp.go.purchaseorder
   - com.etendoerp.go.salesinvoice
   - etc.

3. Single smartbuild compiles everything together
```

### 5.2 Shared Base Module Version Compatibility

The base module (`com.etendoerp.go`) defines interfaces that all window modules implement. A breaking change in the base module requires recompiling all window modules.

**Rule:** The base module version must follow semver. Window modules declare a minimum base version dependency. The deployment pipeline must verify version compatibility before proceeding.

### 5.3 Atomic vs Sequential

**Recommended approach:** Atomic (deploy all modules, single smartbuild, single restart).

- Reduces total downtime (one restart instead of N).
- Ensures all modules are compiled against the same Etendo + base module version.
- Database migrations can be applied in a single transaction when the migration strategy is implemented.

**Sequential deployment** (one module at a time) is only needed when modules have interdependencies that must be verified incrementally — which should not happen with generated modules, since each window module is self-contained.

---

## 6. Critical Failure Points

### Severity: Red (Service Down)

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| Duplicate `AD_Window_ID` | DB migration contains an ID collision with an existing window | Etendo fails to start or shows wrong window definition | Ensure generated IDs are UUIDs; verify uniqueness pre-deploy |
| Wrong Etendo version | Module compiled against Etendo 23.x, deployed to 24.x | `ClassNotFoundException` / `NoSuchMethodError` in logs | Pin Etendo version in build pipeline; compile against production version |
| Tomcat restart failure | Port 8080 conflict, `JAVA_HOME` misconfigured, out of memory | Tomcat process exits immediately; nothing on port 8080 | Check `catalina.out`; verify env vars; increase `-Xmx` |
| Smartbuild compilation failure | Incompatible Java code, missing dependency | Non-zero exit from gradlew | Fix code, re-run; if urgent, restore previous module and rebuild |

### Severity: Yellow (Degraded Service)

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| Frontend deployed, backend not ready | Frontend points to API endpoints that do not yet exist | HTTP 404 on API calls; blank screens | Deploy backend before frontend; frontend should show graceful error |
| PWA cache stale | Service worker serves old bundle after backend API changed | UI sends requests with old field names or missing new fields | Version-check endpoint; force SW update on version mismatch |
| Partial DB migration | FK constraint failure mid-migration; some AD records exist, others do not | Missing tabs or fields in the window; Etendo error dialogs | Wrap migration in transaction; verify record counts post-migration |
| Frontend cache not cleared | CDN or browser cache serves old static files | Visual discrepancies; JS errors from old code calling new API | Set `Cache-Control: no-cache` on HTML; hash-based filenames for assets |

---

## 7. Deployment Checklist

```
Pre-Deployment:
  [ ] Database backup taken (pg_dump)
  [ ] Etendo version compatibility verified
  [ ] Base module version compatibility verified
  [ ] All contract tests pass on the build
  [ ] No active user sessions (or maintenance window announced)

Deployment:
  [ ] Tomcat stopped cleanly
  [ ] Java module copied to modules/
  [ ] smartbuild completes without errors
  [ ] Database migrations applied without errors (when implemented)
  [ ] Frontend deployed (web/ or CDN)
  [ ] Tomcat started successfully

Post-Deployment:
  [ ] Health check endpoint returns 200
  [ ] API smoke test (GET list, GET single, POST create)
  [ ] Frontend loads and renders correctly
  [ ] AD records present in database
  [ ] No errors in catalina.out
  [ ] PWA service worker updated
  [ ] Rollback artifacts retained (previous module, DB backup)
```
