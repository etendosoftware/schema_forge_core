# Etendo Go Apps — External Apps Framework

**Status:** Draft — pending stakeholder approval
**Date:** 2026-04-17
**Author:** Sebastián Barrozo
**Technical annex:** [etendo-go-apps-technical-annex.md](etendo-go-apps-technical-annex.md)

---

## 1. Problem

Etendo Go is a SaaS product built on a simplified, metadata-driven interface over the Etendo core. Today, extending it requires modifying the core or the Schema Forge pipeline, which:

- Couples partners to the Etendo release cycle
- Forces every extension to go through our team
- Limits the technology stack of extensions to what the core supports
- Blocks the emergence of a partner ecosystem around Etendo Go

We need a way for **third parties** (and, initially, ourselves) to build functionality on top of Etendo Go without touching the core.

## 2. Proposal

Define **Etendo Go Apps**, a framework for building satellite apps on top of Etendo Go. Each app runs in its own stack (database + server + UI), integrates with the shell declaratively via an **app descriptor**, authenticates with JWTs issued by Etendo Go, and consumes NEO Headless for core data — modelled after **Atlassian Connect** in Jira.

**Why now:** Etendo Go is already API-first (NEO Headless serves dynamic REST APIs from the `ETGO_SF_*` tables). Adding external apps is the natural extension of that model, not a re-foundation.

## 3. Scope (MVP)

The first iteration delivers a minimal but end-to-end vertical slice:

- **Integration surface:** menu entries only. Apps register menu items in Etendo Go's sidebar; clicking opens the app UI inside an iframe within the shell.
- **UI embedding:** iframe for v1. Module federation (native micro-frontend) reserved for certified partners in a later phase.
- **Authentication:** JWT signed by Etendo Go (RS256) with a JWKS endpoint. One token is accepted by both NEO Headless and the app server.
- **Install model:** hybrid — admin pastes a descriptor URL (pull) **or** uploads a descriptor file (manual). A marketplace comes later.
- **Stack:** fixed stack for v1 — React + Vite + Tailwind on the UI, Node.js 22 ESM + Postgres on the server. Matches the Etendo Go stack. The SDK ships a working server as the starting point.

Additional integration surfaces (webhooks, custom entities, business-logic hooks) are **out of scope** for v1 and deferred to later phases.

## 4. Phases

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| **F1 — Foundations** | `ETGO_APP_*` tables, JWT issuer (RS256) + JWKS, shell menu slot, iframe host with postMessage handshake | A hardcoded "hello world" app can be installed manually and its menu item appears in the shell |
| **F2 — SDK + reference app** | `create-etendo-app` scaffolder (jwt-middleware, neo-client, NEO proxy route, example UI). We build **one real internal app** (candidate: Notes, Approvals, or Expenses) | Reference app is in production and used by at least one customer |
| **F3 — Full lifecycle** | Pull descriptor from URL, manual upload, install/uninstall webhooks, update detection, admin UI for "Installed Apps" | An admin can install/uninstall apps without developer intervention |
| **F4 — Public partner SDK** | Public docs, versioned descriptor spec, certification programme, partner staging environment, examples, support channel | First external partner app in production |
| **F5 — Marketplace** | Public directory, 1-click install, reviews/ratings, versioning, optional pricing hooks | Marketplace live with 3+ partner apps |

**Delivery priority:** F1 → F2 is the minimum vertical slice required to validate the architecture end-to-end with something customers can already use. F3 enables self-service. F4–F5 open the ecosystem.

## 5. Value

- **Partners build without touching the core** → frees the Etendo Go roadmap
- **Each app lives and scales in its own stack** → zero impact on ERP performance from satellite workloads
- **Future commercial model**: revenue share via marketplace
- **Faster iteration**: an app ships on its own cadence, independent of Etendo Go releases

## 6. Key risks

| Risk | Mitigation |
|------|------------|
| Descriptor schema breaks installed apps on change | Versioned descriptor (`descriptorVersion`); support N and N-1 |
| Compromised app accesses tenant data | Explicit scopes in descriptor, admin consent at install, short-lived JWTs (5 min), JWKS rotation, per-install revocation |
| NEO proxy adds latency | Co-located app server + connection pooling + optional short-TTL cache; p95 metrics per endpoint |
| Menu proliferation (20 apps → unusable menu) | Forced grouping under an "Apps" node + favourites + existing shell search |
| Abandoned partner (descriptor URL goes dark) | Unreachable-descriptor detection + grace period + admin alert; last valid version stays cached |
| Fixed stack limits partners | Conscious choice for F1–F3; in F4 we can relax server runtime if demand appears. UI stays React (non-negotiable) |
| Cost of maintaining JWKS + tables + admin UI | F1 gets its own budget; not carved out of other roadmaps |

## 7. KPIs

- **F1–F2:** reference app in production; proxy-NEO p95 latency < 150 ms; zero reported CORS/auth incidents
- **F3:** mean install time (click → operational) < 2 minutes
- **F4:** 3 partners with an app under development within 60 days of SDK launch
- **F5:** GMV; active apps; tenants with ≥ 1 installed app

## 8. Next steps

1. **Approve this proposal** with stakeholders
2. **Pick the F2 reference app** — recommend Notes or Approvals (low risk, universal utility)
3. **Create the F1 implementation plan** — concrete tickets for tables, JWT issuer, shell slot (via `superpowers:writing-plans`)
4. **Technical spike (1 week):** hardcoded descriptor, RS256 JWT, iframe with one NEO proxy route. Rules out unknowns before committing to full F1

---

For architecture, descriptor schema, JWT/JWKS details, BFF pattern, lifecycle flows, and SDK contents, see the [Technical Annex](etendo-go-apps-technical-annex.md).
