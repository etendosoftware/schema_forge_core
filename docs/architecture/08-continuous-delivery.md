# 08 -- Continuous Delivery

The complete CD pipeline from build artifacts to production, covering both platform updates and module updates.

## Two Pipelines

Schema Forge has two distinct deployment pipelines because the **app-shell** (platform) and **generated modules** (per-window) have different change frequencies, risk profiles, and testing strategies.

### Pipeline 1: Platform Updates

Changes to the app-shell, contract-ui primitives, i18n infrastructure, or shared components.

```
[Code Change]
    |
    v
[Lint / Type Check]  -->  fail  -->  Fix and re-push
    |
    v
[Unit Tests]  -->  fail  -->  Fix and re-push
    |
    v
[Build]  -->  fail  -->  Fix and re-push
    |
    v
[Bundle Size Check]  -->  fail  -->  Investigate unexpected imports
    |
    v
[Visual Regression]  -->  fail  -->  Review and approve or fix
    |
    v
[Deploy to Staging]
    |
    v
[Smoke Tests]  -->  fail  -->  Rollback staging, fix, restart pipeline
    |
    v
[Deploy to Production]
    |
    v
[Post-Deploy Verification]
```

### Pipeline 2: Module Updates

A new or changed generated window (new contract, modified schema, added fields).

```
[Contract Change]
    |
    v
[Regenerate Code]  -->  fail  -->  Fix generator or contract
    |
    v
[Contract Tests (Node.js)]  -->  fail  -->  Fix generated code or contract
    |
    v
[Build Backend (gradlew)]  -->  fail  -->  Fix Java compilation errors
    |
    v
[Build Frontend (vite)]  -->  fail  -->  Fix generated JSX/imports
    |
    v
[Integration Tests (JUnit)]  -->  fail  -->  Fix business logic or test expectations
    |
    v
[Deploy to Staging]
    |
    v
[Smoke Tests]  -->  fail  -->  Rollback staging, fix, restart pipeline
    |
    v
[Deploy to Production]
    |
    v
[Post-Deploy Verification]
```

## Stage Definitions

### Pipeline 1: Platform Updates

| Stage | Trigger | Gate (pass/fail) | Artifacts | Timeout | Retry | Rollback |
|-------|---------|-------------------|-----------|---------|-------|----------|
| Lint / Type Check | Push to branch or PR | Zero lint errors, zero type errors | Lint report | 2 min | 0 (fix and re-push) | N/A |
| Unit Tests | Lint passes | All tests pass (`node --test`) | Test report, coverage | 5 min | 1 (flaky test retry) | N/A |
| Build | Tests pass | `vite build` exits 0, zero warnings | `dist/` directory | 5 min | 1 | N/A |
| Bundle Size Check | Build succeeds | Total gzipped < 500 KB, no chunk > 50 KB | Size report | 30 sec | 0 | N/A |
| Visual Regression | Build succeeds | Screenshot diff within tolerance | Diff images | 10 min | 0 (manual review) | N/A |
| Deploy to Staging | All gates pass, PR merged to main | Files copied, app loads | Deployed staging URL | 5 min | 1 | Redeploy previous build |
| Smoke Tests | Staging deployed | Login works, dashboard loads, 3 windows open successfully | Test report | 5 min | 1 | Rollback staging |
| Deploy to Production | Staging smoke passes, manual approval | Files copied, cache invalidated, app loads | Production URL | 5 min | 0 | Redeploy previous build, invalidate CDN |
| Post-Deploy Verification | Production deployed | Spot-check: login, open window, check SW update flow | N/A | 5 min | N/A | Rollback if critical failure |

### Pipeline 2: Module Updates

| Stage | Trigger | Gate (pass/fail) | Artifacts | Timeout | Retry | Rollback |
|-------|---------|-------------------|-----------|---------|-------|----------|
| Regenerate Code | Contract JSON modified | Generator exits 0, all expected files produced | Generated Java + JSX | 2 min | 0 | N/A |
| Contract Tests | Code regenerated | All ~145 contract tests pass (`node --test`) | Test report | 2 min | 0 | Fix contract or generator |
| Build Backend | Contract tests pass | `gradlew smartbuild` exits 0 | Compiled `.class` files | 10 min | 1 | N/A |
| Build Frontend | Contract tests pass (parallel with backend) | `vite build` exits 0 | `dist/` with new window chunk | 5 min | 1 | N/A |
| Integration Tests | Backend build succeeds | All ~100 JUnit tests pass (OBBaseTest) | Test report | 15 min | 1 (test env flakiness) | N/A |
| Deploy to Staging | All tests pass | Backend + frontend deployed, module active | Staging URL | 10 min | 1 | Redeploy previous module version |
| Smoke Tests | Staging deployed | New window loads, CRUD operations work, processes execute | Test report | 5 min | 1 | Rollback staging |
| Deploy to Production | Staging verified, manual approval | Full deploy (see Deployment Strategies below) | Production URL | 15 min | 0 | Rollback (see Rollback Procedures) |
| Post-Deploy Verification | Production deployed | New window accessible, data loads, no 500 errors in logs | N/A | 10 min | N/A | Rollback if critical failure |

## Environment Promotion

```
Dev (local)  -->  Integration (CI)  -->  Staging  -->  Production
```

### Gate Criteria per Environment

| Transition | Automated Gates | Manual Approval |
|-----------|----------------|-----------------|
| Dev to Integration | Push to PR branch triggers CI | None (automatic) |
| Integration to Staging | All CI checks pass + PR merged | None (automatic on merge) |
| Staging to Production | Staging smoke tests pass | Required: team lead or release manager |

### Environment Parity

| Aspect | Staging | Production |
|--------|---------|-----------|
| Infrastructure | Same Tomcat version, same JDK, same PostgreSQL version | Production |
| Configuration | Same `Openbravo.properties` template (different DB URL, credentials) | Production |
| Data | Anonymized copy of production data (refreshed weekly) | Real data |
| Network topology | Same reverse proxy config, same TLS termination | Production |
| Scale | Single instance (cost savings) | May run multiple Tomcat instances behind LB |

## Deployment Strategies

### Backend Deployment

```
1. Stop Tomcat
2. Copy compiled .class files to WEB-INF/classes/
3. Run database migrations if needed (pending Liquibase implementation)
4. Start Tomcat
5. Verify: health check endpoint returns 200
```

**Downtime**: Yes, during stop/start cycle (typically 1-3 minutes).

**Zero-downtime alternative** (if running multiple instances):
1. Remove instance A from load balancer
2. Deploy to instance A, restart, verify
3. Route traffic to instance A
4. Repeat for instance B

### Frontend Deployment

```
1. Copy new dist/ files to static file server (or upload to CDN)
2. Keep old chunk files for at least 1 hour (users with old index.html need them)
3. Invalidate CDN cache for index.html and sw.js ONLY
4. Verify: fetch index.html, confirm it references new chunk hashes
5. After 1 hour: clean up old chunk files
```

**Downtime**: None. New users get the new version immediately. Existing users get it when:
- The SW detects an update and they click "Refresh", or
- They reload the page

### Database Migration Deployment (AD Records) — Pending

> **Status:** Database migration strategy (Liquibase) is under evaluation. Not yet implemented.

When implemented, the migration deployment will:
1. Stop Tomcat (required — migrations run against a live DB but Tomcat must not be serving)
2. Run Liquibase changesets to register AD records (AD_Window, AD_Tab, AD_Field, etc.)
3. Verify: check that all expected AD records exist (window, tab, field, column, process)
4. Start Tomcat

**Expected risks**: Migrations are additive and idempotent for new records, but updates to existing records can overwrite manual customizations. Liquibase changesets should include rollback instructions.

**Mitigation**: Take a database backup before running migrations.

### Coordinated Deployment (API Breaking Changes)

When a backend API change (new apiVersion) requires a matching frontend update:

```
1. Deploy backend with BOTH old and new API versions active
   (old: /api/v1/salesOrder, new: /api/v2/salesOrder)
2. Deploy new frontend that targets the new API version
3. Wait for all users to pick up the new frontend (SW update cycle)
4. After grace period: remove old API version from backend
```

If backward-compatible API versioning is not implemented:

```
1. Put application in maintenance mode
2. Deploy backend
3. Deploy frontend + invalidate caches
4. Take application out of maintenance mode
```

This has downtime but avoids the API mismatch window.

## Recommended CI/CD Implementation

### GitHub Actions Workflow (Conceptual)

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci --workspace=tools/app-shell
      - run: npm run lint --workspace=tools/app-shell
      - run: node --test 'tools/app-shell/test/**/*.test.js'

  build-frontend:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci --workspace=tools/app-shell
      - run: npm run build --workspace=tools/app-shell
      - uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: tools/app-shell/dist/

  build-backend:
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: 17, distribution: temurin }
      - run: ./gradlew smartbuild
      - uses: actions/upload-artifact@v4
        with:
          name: backend-classes
          path: build/classes/

  integration-tests:
    needs: build-backend
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: etendo_test
          POSTGRES_USER: tad
          POSTGRES_PASSWORD: tad
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew test

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: [build-frontend, integration-tests]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
      - run: ./scripts/deploy-staging.sh

  smoke-tests:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/smoke-test.sh $STAGING_URL

  deploy-production:
    needs: smoke-tests
    runs-on: ubuntu-latest
    environment:
      name: production
      # Manual approval configured in GitHub environment settings
    steps:
      - uses: actions/download-artifact@v4
      - run: ./scripts/deploy-production.sh
```

### Key CI/CD Principles

1. **Frontend and backend build in parallel** after lint/test passes
2. **Integration tests require backend build** (need compiled classes)
3. **Staging deploy is automatic** on merge to main
4. **Production deploy requires manual approval** via GitHub environment protection rules
5. **Artifacts are reused** -- the same build artifact deployed to staging is promoted to production (never rebuilt)

## Release Strategy

### Versioning

Schema Forge modules use three independent version numbers:

| Version | Increments When | Who Cares |
|---------|----------------|-----------|
| `moduleVersion` | Any code regeneration | Package managers, deployment scripts |
| `apiVersion` | DTO shape changes (field added/removed/renamed) | Frontend (must match API it was built for) |
| `behavioralVersion` | Business rules or processes change | Test suites (behavioral tests target this version) |

### Release Notes

Auto-generated from contract diffs between versions:
- Fields added/removed/changed
- Processes added/modified
- Visibility changes
- API breaking changes (apiVersion bump)

### Canary Releases

For high-risk changes, deploy to a subset of users first:

1. Deploy new version behind a feature flag or to a specific URL path
2. Route 5-10% of traffic to the new version (load balancer weight)
3. Monitor error rates, response times, user feedback
4. Gradually increase traffic percentage
5. When confident: promote to 100%

**Note**: Canary releases require session affinity or stateless backend design to prevent users from bouncing between versions mid-session.

### Feature Flags

For gradual rollout of new windows:

1. New window is generated and deployed but **not added to `menu.json`**
2. A feature flag (server-side or client-side) controls whether the menu entry appears
3. Enable for internal users first, then beta users, then all users
4. Once stable: add to `menu.json` permanently, remove flag

## Critical Failure Points

### CRITICAL

**Backend deployed with breaking API change, frontend still on old version**
Users with cached old frontend make API calls that fail because field names or shapes have changed.
- **Prevention**: Always deploy backward-compatible API changes. Use apiVersion to maintain old endpoints during transition. See Coordinated Deployment above.
- **Detection**: Monitor 400/500 error rates after backend deploy. Spike in errors indicates mismatch.
- **Recovery**: Rollback backend to previous version. Fix API compatibility. Redeploy.

**Database migration fails mid-way (partial AD records)**
If a database migration crashes partway through, the AD_* tables may have incomplete records (e.g., a window defined but its tabs missing).
- **Prevention**: Take a database backup before every migration. Run migration on staging first. When Liquibase is implemented, wrap changesets in transactions.
- **Detection**: Post-migration validation script that checks all expected AD records exist and are consistent.
- **Recovery**: Restore database from backup. Fix migration changeset. Retry.

**Staging passes but production fails (environment-specific config)**
Production has different database URL, different OAuth config, different network topology. A config difference can cause failures that staging did not catch.
- **Prevention**: Maximize environment parity (see table above). Use the same configuration templates with environment-specific values injected at deploy time. Never hardcode environment-specific values in code.
- **Detection**: Post-deploy verification (login, open window, save record).
- **Recovery**: Rollback to previous version. Compare staging and production configs.

### WARNING

**Long build times block deployment frequency**
If `gradlew smartbuild` takes 10+ minutes and integration tests take 15+ minutes, the feedback cycle is too slow for rapid iteration.
- **Mitigation**: Parallel test execution. Build caching (Gradle build cache). Only rebuild changed modules. Consider splitting integration tests into fast (critical path) and slow (comprehensive) suites.

**No automated rollback (manual intervention required)**
If a production deploy fails, someone must manually redeploy the previous version.
- **Mitigation**: Keep the previous deploy artifacts available (tagged in CI). Script the rollback procedure. Consider blue-green deployment for instant switchback.

**Database schema drift between environments**
If staging and production databases have different column definitions or missing tables, deploys that work in staging will fail in production.
- **Mitigation**: Regular staging database refresh from production (anonymized). Schema comparison tool run as a CD gate.

## Rollback Procedures

### Frontend Rollback

1. Redeploy previous `dist/` files to static server / CDN
2. Invalidate CDN cache for `index.html` and `sw.js`
3. Users pick up old version on next page load or SW update check
4. Time to full rollback: minutes (CDN propagation) to hours (users must refresh)

### Backend Rollback

1. Stop Tomcat
2. Restore previous `.class` files to `WEB-INF/classes/`
3. If DB migrations were applied: restore database backup (or run Liquibase rollback when implemented)
4. Start Tomcat
5. Verify health check

### Full Rollback (Coordinated)

1. Put application in maintenance mode
2. Restore database backup (if DB migrations were applied), or run Liquibase rollback when implemented
3. Redeploy previous backend classes
4. Redeploy previous frontend files
5. Invalidate CDN cache
6. Start Tomcat
7. Take out of maintenance mode
8. Verify full functionality

## Monitoring After Deploy

After every production deployment, monitor for 30 minutes:

| Signal | Normal | Problem |
|--------|--------|---------|
| HTTP 500 error rate | < 0.1% | Spike above 1% |
| HTTP 401 error rate | Stable | Sudden increase (auth regression) |
| API response time (p95) | < 500ms | Increase > 2x baseline |
| Frontend JS errors (browser console) | 0-2 per session | New error patterns |
| SW update toast appearances | Expected after deploy | Not appearing (broken SW update) |
| Login success rate | > 99% | Drop below 95% |
