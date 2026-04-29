---
name: etendo-go-architecture-audit
description: Use when auditing Etendo Go / NEO Headless module architecture, especially MCP/OAuth boundaries, generic Neo* services, process/report access, selector policy, handlers, widgets, or onboarding transactions.
---

# Etendo Go Architecture Audit

## Overview

Audit `etendo_core/modules/com.etendoerp.go` for architecture boundary drift and missing control points. The goal is not to list every smell; it is to identify design decisions represented in the wrong layer, repeated across handlers, or enforced only at presentation time.

## Non-Negotiables

- Read-only unless the user explicitly asks for fixes.
- Read `etendo_core/modules/com.etendoerp.go/AGENTS.md` before inspecting module code.
- Every issue needs exact file paths and observed line evidence.
- Mark inference explicitly.
- Separate normal window/entity handlers from leaked policy in generic core.
- Severity must be justified by blast radius, security impact, coupling, and maintenance risk.

## Protected Boundaries

Generic NEO services must execute metadata and extension points, not own concrete window/entity policy:

- `NeoServlet`
- `NeoCrudHandler`
- `NeoSelectorService`
- `NeoDefaultsService`
- `NeoCalloutService`
- `NeoProcessService`
- `NeoReportService`

Window/entity-specific behavior belongs in metadata, a named policy provider, or a `NeoHandler` selected through `Java_Qualifier`.

## Required Workflow

1. **Confirm scope**
   - Verify repo path, branch, and working tree.
   - State whether the root repo and nested module repo differ.
   - Do not modify files during audit.

2. **Map source layers**
   - NEO generic core: `src/com/etendoerp/go/schemaforge/Neo*.java`, `util/Neo*.java`.
   - NEO handlers/actions: `*Handler.java`, document/payment/process helpers.
   - MCP: `src/com/etendoerp/go/mcp`.
   - OAuth/JWT/REST: `src/com/etendoerp/go/oauth2`, `src/com/etendoerp/go/rest`.
   - Onboarding: `src/com/etendoerp/go/onboarding`.
   - Tests: `src-test/src/com/etendoerp/go`.

3. **Search before reading**
   Use targeted searches for:
   - Generic core leaks: `specName`, `entityName`, `ProductByPriceAndWarehouse`, `BusinessPartner`, `contacts`, `locationAddress`, `grossUnitPrice`, `lineNetAmount`, `orderedQuantity`, `invoicedQuantity`, `uOM`, `taxRate`.
   - Hardcoded metadata: `DEFAULT_*_ID`, UUID literals, `Posted`, AD reference IDs, static maps of IDs to HQL.
   - Authorization gaps: `setAdminMode`, `neo:*`, `tools/call`, `NO_ACTIVE_FILTER`, `roleOrgIds`, `hasProcessAccess`, `validateToken`, `decodeToken`.
   - Transaction ownership: `commitAndClose`, `rollbackAndClose`, `flush`, swallowed exceptions, boolean failure returns.
   - Duplicate handlers: manual `new ...Handler()`, duplicated `handle()` switch/if chains, boolean polarity wrappers.

4. **Read evidence sections**
   For each candidate, answer:
   - What layer is this file in?
   - What concrete concept does it know about?
   - Is the same decision repeated elsewhere?
   - Is this metadata execution, a handler concern, or a generic workaround?
   - Is an access/transaction decision made before privilege escalation?

5. **Classify severity**

| Severity | Criteria |
|---|---|
| Critical | Observed issue can directly corrupt data broadly or bypass a primary security boundary with demonstrated exploit path. |
| High | Generic privileged path, auth boundary, or core service owns concrete policy that can affect many windows/tools. |
| Medium | Repeated domain policy or hidden coupling likely to diverge, but limited to a family of handlers/features. |
| Low | Localized compatibility fallback or naming smell with narrow blast radius. |

6. **Recommend the control point**
   Name the owner that should hold the decision: metadata, `NeoHandler`, selector policy registry, `McpAuthorizationService`, `NeoAccessHelper`, OAuth client policy, onboarding application service, or protocol adapter.

## Evidence Patterns

### MCP discovery/execution mismatch

Report when `tools/list` filters capabilities but `tools/call` routes by caller-supplied names without equivalent scope/RBAC checks. Discovery is presentation; execution must be the security boundary.

Better direction: `McpAuthorizationService` validates operation, spec/window access, process/report access, and field write policy before routing.

### JWT fallback with broad MCP scopes

Report when an MCP bearer token fallback converts a legacy JWT into `neo:*`. OAuth2 scope administration is not authoritative if another auth model receives full scopes.

Better direction: accept OAuth2 only for MCP or map compatibility JWTs to explicit least-privilege scopes.

### Admin mode before access decision

Report when process/report/button/selector code enters `OBContext.setAdminMode()` before deriving access from server-side role/client/org.

Better direction: central `NeoAccessHelper` gate before admin mode; request-provided filters are not access control.

### Generic selector policy leaks

Report concrete product, price list, business partner, address wrapper, or AD reference override logic inside `NeoSelectorService`.

Better direction: selector policy metadata or named policy provider; generic selector code executes resolved policy only.

### Commercial line policy in generic CRUD/defaults/callouts

Report hardcoded line amount, tax, UOM, or price fields in generic services.

Better direction: one commercial line policy/control point used consistently by order, quotation, and invoice line flows.

### Handler duplication with manual delegates

Report repeated action dispatch chains, manual `new Handler()` construction, or duplicated true/false wrappers around the same service.

Better direction: CDI-managed action router/registry and a single domain service parameterized by metadata or domain direction.

### Transaction ownership split

Report when servlet/application flow owns rollback but inner services call `commitAndClose()` or swallow failures into boolean results.

Better direction: one transaction owner, or explicit persisted phases with retry/cleanup semantics.

## Report Format

```markdown
# Etendo Go Architecture Audit

Scope observed:
- Repo: [path]
- Branch: [branch]
- Working tree: [clean/dirty summary]

## Executive Summary
- Critical: N
- High: N
- Medium: N
- Low: N

## Issues

### [Severity] [Title]

Evidence:
- `path:line` — observed fact
- `path:line-line` — observed fact

Why it matters:
- [security/coupling/wrong layer/blast radius]

Recommendation:
- [target control point/owner]
- [clean cutover; no aliases unless compatibility requires it]

Confidence: High|Medium|Low
```

## Current Hotspots

| Hotspot | Evidence pattern | Correct owner |
|---|---|---|
| MCP execution auth | `tools/list` filters but `tools/call` routes by `toolName` | `McpAuthorizationService` / router execution gate |
| JWT MCP fallback | fallback JWT identity gets `neo:*` | MCP auth boundary |
| OAuth DCR | public clients default to write scope, redirect URIs not persisted/validated | OAuth client policy |
| Process/report privilege | `setAdminMode` before central access check | `NeoAccessHelper` gate |
| Report selectors | request-supplied `roleOrgIds` in admin-mode SQL | server-derived selector access policy |
| Selector business policy | product price, BP customer/vendor, address virtual fields in `NeoSelectorService` | selector metadata/policy provider |
| Commercial lines | gross/net/tax/UOM fields in CRUD/defaults/callouts | commercial line policy / handlers |
| Document actions | duplicated shipment/receipt/invoice projection helpers | commercial document factory/service |
| Onboarding transactions | inner import commits while servlet owns rollback | onboarding application service |

## Common Mistakes

| Mistake | Correction |
|---|---|
| Reporting every handler as wrong | Handlers are allowed; report repeated policy or wrong-layer decisions. |
| Treating client-provided filters as authorization | Access must be derived server-side before admin mode. |
| Blaming admin mode itself | Admin mode is often required; missing pre-gate or scoped cleanup is the issue. |
| Suggesting more hardcoded branches | Move decisions to metadata, named policy providers, or handlers. |
| Recommending aliases by default | Default to clean cutover; name compatibility boundaries only when required. |

## Completion Checklist

Before yielding:

- [ ] Scope and repo state are stated.
- [ ] Module `AGENTS.md` was read.
- [ ] Every issue has file/line evidence.
- [ ] Severity is justified.
- [ ] Recommendations name the target control point.
- [ ] Observed facts and inference are separated.
- [ ] No edits were made unless explicitly requested.
