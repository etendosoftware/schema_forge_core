# Production Architecture Documentation

Infrastructure documentation for the **BUILD, DEPLOY, and END USER** lifecycle of Schema Forge generated modules.

## Scope

This documentation covers everything that happens **after code has been generated**: how to build it, how to deploy it, how it runs in production, and how to operate it.

> **Out of scope:** This documentation does NOT cover Schema Forge development tools (extractors, classifiers, decision panels, contract generators). For those, see [docs/TDD.md](../TDD.md).

## Document Map

| # | Document | Description |
|---|----------|-------------|
| 01 | [Production Topology](01-production-topology.md) | System context, component inventory, network topology, environment matrix |
| 02 | [Build Pipeline](02-build-pipeline.md) | Backend and frontend build steps; DB migration status; failure points and CD gates |
| 03 | Deployment Procedures | Step-by-step deployment for each environment (planned) |
| 04 | Database Migrations | Schema migrations via Liquibase (under evaluation, not yet implemented) |
| 05 | Frontend Delivery | Static asset serving, CDN configuration, cache strategy (planned) |
| 06 | [Frontend Delivery](06-frontend-delivery.md) | SPA architecture, code splitting, asset delivery, PWA lifecycle, performance budget |
| 07 | [Authentication and Security](07-auth-and-security.md) | Auth flow, session management, RBAC, CSRF/XSS/injection prevention, TLS, CSP |
| 08 | [Continuous Delivery](08-continuous-delivery.md) | Two CD pipelines, stage gates, deployment strategies, rollback procedures |
| 09 | Internationalization | Locale loading, label resolution, adding new languages (planned) |
| 10 | Monitoring and Observability | Health checks, logging, alerting, key metrics (planned) |
| 11 | Performance Tuning | JVM tuning, connection pools, frontend bundle budgets (planned) |
| 12 | Disaster Recovery | Backup strategy, restore procedures, RTO/RPO targets (planned) |

## Reading Order by Role

### DevOps Engineer
1. Production Topology (01) -- understand what you are operating
2. Build Pipeline (02) -- understand how artifacts are produced
3. Continuous Delivery (08) -- learn the full CD pipeline and deployment strategies
4. Database Operations (04, planned) -- learn schema and data management
5. Monitoring and Observability (10, planned) -- set up alerting
6. Disaster Recovery (12, planned) -- prepare for failures

### Backend Developer
1. Production Topology (01) -- understand the runtime environment
2. Build Pipeline (02) -- learn how your code gets compiled and deployed
3. Authentication and Security (07) -- understand the auth model and security requirements
4. Continuous Delivery (08) -- understand deployment and rollback procedures

### Frontend Developer
1. Production Topology (01) -- understand where the SPA runs
2. Build Pipeline (02) -- learn the Vite build process
3. Frontend Delivery (06) -- understand code splitting, caching, PWA lifecycle, performance budget
4. Authentication and Security (07) -- understand the auth flow and token management
5. Internationalization (09, planned) -- understand label resolution

### SRE (Site Reliability Engineer)
1. Production Topology (01) -- understand all components and dependencies
2. Frontend Delivery (06) -- understand CDN, caching, and PWA failure modes
3. Authentication and Security (07) -- understand security hardening requirements
4. Continuous Delivery (08) -- understand deployment and rollback procedures
5. Performance Tuning (11, planned) -- optimize for production load
6. Disaster Recovery (12, planned) -- plan for failures

## Severity Legend

Throughout these documents, severity indicators are used:

- **CRITICAL** -- Blocks production. System is down or data is at risk. Immediate action required.
- **WARNING** -- Degraded experience. System is functional but users are impacted. Action needed soon.
- **HEALTHY** -- No action needed. Informational context for understanding normal operation.

## Troubleshooting Quick Reference

| If this is broken... | Read this |
|---|---|
| Java module fails to compile | [Build Pipeline: Backend Build](02-build-pipeline.md#backend-build) |
| Frontend build produces errors | [Build Pipeline: Frontend Build](02-build-pipeline.md#frontend-build) |
| Database migration fails or UUIDs conflict | [Build Pipeline: Database Migrations](02-build-pipeline.md#database-migrations-pending) |
| Module loads but REST endpoints return 404 | [Production Topology: Component Inventory](01-production-topology.md#component-inventory) |
| React SPA shows blank page | [Production Topology: Static Assets](01-production-topology.md#network-topology) |
| Login fails or sessions expire unexpectedly | [Authentication and Security: Session Management](07-auth-and-security.md#session-management) |
| PWA does not update after deploy | [Frontend Delivery: PWA Behavior](06-frontend-delivery.md#pwa-behavior) |
| Stale frontend after deploy (old chunks) | [Frontend Delivery: Critical Failure Points](06-frontend-delivery.md#critical-failure-points) |
| Need to roll back a deployment | [Continuous Delivery: Rollback Procedures](08-continuous-delivery.md#rollback-procedures) |
| Backend API change breaks frontend | [Continuous Delivery: Coordinated Deployment](08-continuous-delivery.md#coordinated-deployment-api-breaking-changes) |
| Labels show raw keys instead of text | Internationalization (09, planned) |
| Tomcat runs out of memory | Performance Tuning (11, planned) |
| Database connections exhausted | [Production Topology: DB Connections](01-production-topology.md#network-topology) |
