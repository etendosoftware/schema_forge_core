# Documentation Index

This file is the entry point to everything under `docs/`. Sub-folders with their own index
(`architecture/`, `etendo-ad/`, `generated-custom-windows/`, `proposals/`) are referenced
both as a group (the sub-index) and individually so every Markdown file in `docs/` is
reachable from here.

## Architecture & System Design

| File | Description |
|------|-------------|
| [architecture-overview.md](architecture-overview.md) | System architecture: Schema Forge (tooling) + Etendo Go (runtime), data flow, component inventory |
| [NEO Headless API Reference](../modules/com.etendoerp.go/docs/neo-headless.md) | Full API reference for the runtime module (NeoServlet, selectors, processes, webhooks) — lives in the `com.etendoerp.go` checkout |
| [neo-headless-extensibility.md](neo-headless-extensibility.md) | How to extend/customize NEO Headless: NeoHandler hooks, configuration, patterns |
| [neo-entity-naming-investigation.md](neo-entity-naming-investigation.md) | Investigation report on `push-to-neo` naming, duplicate entities/fields, runtime endpoint resolution, and unification rule |
| [neo-pending-constraints.md](neo-pending-constraints.md) | UNIQUE constraints applied to ETGO_SF_* tables (2026-04-13) — regression guard against duplicate inserts |
| [neo-duplicates-report-2026-04-13.md](neo-duplicates-report-2026-04-13.md) | Snapshot of spec/entity/field duplicates found on 2026-04-13 (pre-dedupe), plus the 54 AD-label naming cases |
| [widget-endpoints.md](widget-endpoints.md) | How to create widget endpoints: handler pattern, XML registration, frontend `useWidget` hook, response contracts |
| [architecture-radar.md](architecture-radar.md) | Guide for the sf-radar CLI tool — query and update architecture decisions (optional repo) |
| [flow-diagram.md](flow-diagram.md) | Concise Schema Forge → NEO Headless data-flow diagram |
| [priceList-injection-origin.md](priceList-injection-origin.md) | `priceList` injection in `selectorContextByEntity` — origin report |

## Production Architecture (Build, Deploy & Operate)

Lifecycle documentation for what happens *after* code generation — runtime topology,
build pipeline, deployment, frontend delivery, observability.

| File | Description |
|------|-------------|
| [architecture/index.md](architecture/index.md) | Production architecture sub-index (document map, reading order by role) |
| [architecture/01-production-topology.md](architecture/01-production-topology.md) | System context, component inventory, network topology, environment matrix |
| [architecture/02-build-pipeline.md](architecture/02-build-pipeline.md) | Backend and frontend build steps; DB migration status; failure points and CD gates |
| [architecture/03-deployment-strategy.md](architecture/03-deployment-strategy.md) | Deployment strategy across environments |
| [architecture/04-api-layer.md](architecture/04-api-layer.md) | API layer architecture, contracts, routing |
| [architecture/05-data-layer.md](architecture/05-data-layer.md) | Data layer, persistence, migrations |
| [architecture/06-frontend-delivery.md](architecture/06-frontend-delivery.md) | SPA architecture, code splitting, asset delivery, PWA lifecycle, performance budget |
| [architecture/07-auth-and-security.md](architecture/07-auth-and-security.md) | Auth flow, session management, RBAC, CSRF/XSS/injection prevention, TLS, CSP |
| [architecture/08-continuous-delivery.md](architecture/08-continuous-delivery.md) | Two CD pipelines, stage gates, deployment strategies, rollback procedures |
| [architecture/09-reliability.md](architecture/09-reliability.md) | Production reliability, error budgets, retries, circuit breakers |
| [architecture/10-observability.md](architecture/10-observability.md) | Production observability — logging, metrics, tracing |
| [architecture/11-scalability.md](architecture/11-scalability.md) | Production scalability — capacity planning, scaling axes |
| [architecture/12-end-user-experience.md](architecture/12-end-user-experience.md) | End-user experience — performance, accessibility, perceived latency |

## Product & Design Specs

| File | Description |
|------|-------------|
| [PRD.md](PRD.md) | Product requirements, decision map, pipeline, scope |
| [PRD-anex.md](PRD-anex.md) | API versioning model (conceptual) |
| [TDD.md](TDD.md) | Technical design, data models, validation rules, generator specs |
| [TDD-anex.md](TDD-anex.md) | API versioning implementation details |
| [conventions.md](conventions.md) | Edge case conventions (13 rules for extraction, validation, DB access) |
| [decisions-versioning.md](decisions-versioning.md) | Decisions.json versioning system: writing migrations, batch upgrades, FAQ |

## Field & Pipeline Reference

| File | Description |
|------|-------------|
| [decisions-reference.md](decisions-reference.md) | **Complete reference for all `decisions.json` options**: visibility, draftMode, sections, selectors, rules, discard patterns |
| [field-visibility-types.md](field-visibility-types.md) | Field visibility types (editable, readOnly, system, discarded): behavior across pipeline, NEO Headless, and frontend |
| [schema-raw-reference.md](schema-raw-reference.md) | `schema-raw.json` reference — structure of the raw schema produced by `extract-from-db.js` |
| [contract-field-distribution.md](contract-field-distribution.md) | Field distribution across the generated frontend contract — list, form, lookups, hidden buckets |
| [pipeline-validator-reference.md](pipeline-validator-reference.md) | **Pipeline completeness validator**: rules F1–F10, artifact classification, CLI flags, exit codes, and troubleshooting |

## UI & UX

| File | Description |
|------|-------------|
| [ui-customization.md](ui-customization.md) | **UI customization guide**: all extension points driven by `decisions.json` (statusBar, listKpiCards, customComponents, menuActions, layoutType, etc.) with real examples and decision tree |
| [ui-design-guidelines.md](ui-design-guidelines.md) | **UI design guidelines**: z-index scale, scrim opacity, overlay/drawer patterns, monetary amount formatting, column alignment |
| [list-filters.md](list-filters.md) | **List view filters reference**: subset filters, quick filters, document-type filters, advanced filter popover — composition rules, URL-param hooks, when to use which |
| [window-templates.md](window-templates.md) | Window template extensibility — layout types (kanban, calendar, custom), configuration, registry/generator flow |
| [network-performance-audit.md](network-performance-audit.md) | Network performance audit — app-shell request patterns, payload sizes, suggested optimizations |

## Internationalization

| File | Description |
|------|-------------|
| [i18n-guide.md](i18n-guide.md) | **i18n reference**: hooks (`useUI`, `useLabel`, `useMenuLabel`), locale JSON structure, rules for adding translations, decision tree |

## Testing

| File | Description |
|------|-------------|
| [e2e-testing-guide.md](e2e-testing-guide.md) | E2E testing guide: discover with agent-browser, automate with Playwright |

## Tooling

| File | Description |
|------|-------------|
| [developer-tools.md](developer-tools.md) | CLI tools used by the team: RTK (token optimization) and GWS (Google Workspace CLI) |
| [sonarqube-access.md](sonarqube-access.md) | **SonarQube quick access**: bypass RTK with `rtk proxy`, project keys, useful endpoints, local scanner fallback |

## Etendo AD Reference

General findings about how the Etendo Application Dictionary works. Not window-specific.

| File | Description |
|------|-------------|
| [etendo-ad/index.md](etendo-ad/index.md) | Etendo AD sub-index — entry point to AD reference documents |
| [etendo-ad/schema-mappings.md](etendo-ad/schema-mappings.md) | AD table relationships: callouts, logic columns, tab clauses |
| [etendo-ad/process-mechanisms.md](etendo-ad/process-mechanisms.md) | The 3 process mechanisms: tab_process, classic_process, obuiapp_process |
| [etendo-ad/display-logic-variables.md](etendo-ad/display-logic-variables.md) | The 6 types of variables in DisplayLogic: fields, auxiliary inputs, session, preferences, acct dimensions |
| [etendo-ad/openapi-module.md](etendo-ad/openapi-module.md) | `com.etendoerp.openapi` module: CDI plugin architecture, OpenAPIEndpoint interface, flow system, SWS integration |
| [etendo-ad/fic-default-values.md](etendo-ad/fic-default-values.md) | How `FormInitializationComponent` assigns default values on `MODE=NEW` by reference type |
| [etendo-ad/localization.md](etendo-ad/localization.md) | Etendo AD localization model — language records, translation tables, label resolution |
| [etendo-ad/module-structure.md](etendo-ad/module-structure.md) | Module structure of `com.etendoerp.go` inside an Etendo installation |

## Generated / Custom Windows

| File | Description |
|------|-------------|
| [generated-custom-windows/INDEX.md](generated-custom-windows/INDEX.md) | Functional docs for generated/custom windows — sub-index with the per-window guides and the app-shell flows guide |
| [generated-custom-windows/2026-04-23-epic-etp-3504-merge-changelog.md](generated-custom-windows/2026-04-23-epic-etp-3504-merge-changelog.md) | Change log for the `epic/ETP-3504` → `develop` window-level merge deltas documented in generated/custom windows |

Per-window guides (each maps to an artifact under `artifacts/<window>/`) are catalogued
in `generated-custom-windows/INDEX.md`. They are not duplicated here to keep this index
short — open the sub-index for the full list.

## Operations

| File | Description |
|------|-------------|
| [ops/cloudfront-alb-routing.md](ops/cloudfront-alb-routing.md) | CloudFront + ALB routing for the SPA, same-origin `/etendo/*` forwarding, and deployment runbook |
| [ops/copilot-pr-review.md](ops/copilot-pr-review.md) | Copilot-aligned PR review gate: review instructions, deterministic findings, PR comments, and request-changes behavior |
| [ops/window-doc-freshness.md](ops/window-doc-freshness.md) | Window-specific doc freshness warning: diff-based CI review for `docs/generated-custom-windows/<window>.md` |
| [ops/epic-rollup-report.md](ops/epic-rollup-report.md) | Develop-targeted epic rollout report: included feature PRs, prior review findings, and aggregated release-risk summary |

## Bug Reports

| File | Description |
|------|-------------|
| [bug-reports/2026-04-16-contacts-infinite-loop.md](bug-reports/2026-04-16-contacts-infinite-loop.md) | Contacts window — infinite render/fetch loop on open (root cause + fix) |
| [bug-reports/2026-04-17-product-uom-filter-trl-subquery.md](bug-reports/2026-04-17-product-uom-filter-trl-subquery.md) | Product window — UOM filter returns HTTP 500 due to a broken TRL subquery |

## Proposals

Design proposals and RFCs awaiting review and approval. See
[proposals/INDEX.md](proposals/INDEX.md) for the lifecycle (proposal → plan → discarded).

| File | Status | Description |
|------|--------|-------------|
| [proposals/INDEX.md](proposals/INDEX.md) | — | Proposals sub-index (lifecycle and full list) |
| [proposals/etendo-go-apps.md](proposals/etendo-go-apps.md) | Draft / Pending approval | External apps framework for Etendo Go (Jira Connect-style) — executive summary |
| [proposals/etendo-go-apps-technical-annex.md](proposals/etendo-go-apps-technical-annex.md) | Draft / Pending approval | External apps framework — technical annex (architecture, descriptor, JWT+JWKS, BFF, SDK) |
| [proposals/etendo-apps-sdk.md](proposals/etendo-apps-sdk.md) | Draft / Pending approval | Apps SDK v1 (internal apps) — `@etendo/apps-sdk` + `@etendo/apps-sdk-bff`, migration from spike |
| [proposals/apps-sdk-styling.md](proposals/apps-sdk-styling.md) | Draft / Pending approval | Apps SDK styling (Option A) — shared CSS tokens + base.css for iframe apps |
| [proposals/apps-sdk-mock-installer.md](proposals/apps-sdk-mock-installer.md) | Draft / Pending approval | Mock App Store installer — localStorage-backed install toggle and catalog-driven menu entries |
| [proposals/initial-organization-setup-accounting.md](proposals/initial-organization-setup-accounting.md) | Reviewed / Pending plan | Initial Organization Setup accounting — global package reuse, org wiring, completeness validation, standard `AD_Org_Ready` finish |

## Plans

Plans follow a lifecycle: active in `plans/`, completed in `plans/completed/YYYY-MM-DD/`,
discarded in `plans/discarded/`, pending evaluation in `plans/pending/`.

### Active plans

| File | Description |
|------|-------------|
| [plans/2026-03-05-app-shell-design.md](plans/2026-03-05-app-shell-design.md) | App Shell design — production frontend scaffold |
| [plans/2026-03-05-app-shell-plan.md](plans/2026-03-05-app-shell-plan.md) | App Shell implementation plan |
| [plans/2026-03-05-f8-auto-mock-design.md](plans/2026-03-05-f8-auto-mock-design.md) | F8 — auto mock data + fetch wrapper (design) |
| [plans/2026-03-05-f8-auto-mock-plan.md](plans/2026-03-05-f8-auto-mock-plan.md) | F8 — auto mock data + fetch wrapper (implementation plan) |
| [plans/2026-03-05-f8-live-preview-design.md](plans/2026-03-05-f8-live-preview-design.md) | F8 live preview — iframe + Babel standalone (design) |
| [plans/2026-03-05-f8-live-preview-plan.md](plans/2026-03-05-f8-live-preview-plan.md) | F8 live preview — implementation plan |
| [plans/2026-03-05-frontend-generator-design.md](plans/2026-03-05-frontend-generator-design.md) | Frontend code generator (design) |
| [plans/2026-03-05-frontend-generator-plan.md](plans/2026-03-05-frontend-generator-plan.md) | Frontend code generator (implementation plan) |
| [plans/2026-03-05-holded-ui-design.md](plans/2026-03-05-holded-ui-design.md) | Holded-style UI upgrade (design) |
| [plans/2026-03-05-holded-ui-plan.md](plans/2026-03-05-holded-ui-plan.md) | Holded-style UI upgrade (implementation plan) |
| [plans/2026-03-05-useentity-hook-design.md](plans/2026-03-05-useentity-hook-design.md) | `useEntity` hook + UI layer separation (design) |
| [plans/2026-03-05-useentity-hook-plan.md](plans/2026-03-05-useentity-hook-plan.md) | `useEntity` hook + UI layer separation (implementation plan) |
| [plans/2026-03-05-vertical-slice-design.md](plans/2026-03-05-vertical-slice-design.md) | Vertical slice design — Sales Order end-to-end |
| [plans/2026-03-05-vertical-slice-plan.md](plans/2026-03-05-vertical-slice-plan.md) | Vertical slice execution plan — Sales Order end-to-end |
| [plans/2026-03-06-menu-system-plan.md](plans/2026-03-06-menu-system-plan.md) | Menu system implementation plan |
| [plans/2026-03-06-warehouse-sales-financial-plan.md](plans/2026-03-06-warehouse-sales-financial-plan.md) | Warehouse, Sales & Financial Management windows — work plan |
| [plans/2026-03-09-aggregate-contracts-design.md](plans/2026-03-09-aggregate-contracts-design.md) | Aggregate contracts (design) |
| [plans/2026-03-09-aggregate-contracts-plan.md](plans/2026-03-09-aggregate-contracts-plan.md) | Aggregate contracts (implementation plan) |
| [plans/2026-03-09-schema-inspector-design.md](plans/2026-03-09-schema-inspector-design.md) | Schema inspector (design) |
| [plans/2026-03-09-schema-inspector.md](plans/2026-03-09-schema-inspector.md) | Schema inspector (implementation plan) |
| [plans/2026-03-25-draft-processed-mode.md](plans/2026-03-25-draft-processed-mode.md) | Configurable draft/processed mode |
| [plans/2026-03-26-ci-auto-regeneration.md](plans/2026-03-26-ci-auto-regeneration.md) | CI auto-regeneration on epic merge |
| [plans/2026-04-13-neo-dedupe-plan.md](plans/2026-04-13-neo-dedupe-plan.md) | NEO dedupe plan |
| [plans/2026-04-14-grid-filter-display-pagination-report.md](plans/2026-04-14-grid-filter-display-pagination-report.md) | Grid filters and sorting — display-value analysis and paginated proposal |
| [plans/2026-04-16-auto-sync-develop-to-epic.md](plans/2026-04-16-auto-sync-develop-to-epic.md) | Auto-sync `develop` → `epic/ETP-3504` |
| [plans/2026-04-16-pipeline-completeness-validator.md](plans/2026-04-16-pipeline-completeness-validator.md) | Pipeline completeness validator — proposal |
| [plans/2026-04-16-pipeline-validator-implementation.md](plans/2026-04-16-pipeline-validator-implementation.md) | Pipeline completeness validator — implementation plan |
| [plans/2026-04-17-apps-sdk-extraction-plan.md](plans/2026-04-17-apps-sdk-extraction-plan.md) | Etendo Apps SDK — extraction & spike migration plan |
| [plans/2026-04-17-etendo-go-apps-f1-spike-plan.md](plans/2026-04-17-etendo-go-apps-f1-spike-plan.md) | Etendo Go Apps — F1 spike implementation plan (validates JWT+JWKS+BFF end-to-end) |
| [plans/2026-04-17-quick-order-app-plan.md](plans/2026-04-17-quick-order-app-plan.md) | Quick-Order external app — Phase C implementation plan |
| [plans/2026-04-29-artifact-formatting-stability.md](plans/2026-04-29-artifact-formatting-stability.md) | Artifact formatting & output stability |
| [plans/2026-05-03-discount-feature-status.md](plans/2026-05-03-discount-feature-status.md) | Discount feature — status and next steps |
| [plans/2026-05-07-dirty-state-save-button.md](plans/2026-05-07-dirty-state-save-button.md) | Dirty-state save button — design |
| [plans/2026-05-11-row-quick-actions-plan.md](plans/2026-05-11-row-quick-actions-plan.md) | Row quick actions — plan |
| [plans/2026-05-12-send-document-quick-action-plan.md](plans/2026-05-12-send-document-quick-action-plan.md) | Envelope quick-action + configurable Send/Download modal |
| [plans/2026-05-13-code-dedup-plan.md](plans/2026-05-13-code-dedup-plan.md) | Code duplication cleanup & cognitive complexity reduction |
| [plans/callout-endpoint-reuse-report.md](plans/callout-endpoint-reuse-report.md) | Callout endpoint — analysis report & implementation proposal |
| [plans/cascading-classification-logic.md](plans/cascading-classification-logic.md) | Cascading classification logic |
| [plans/defaults-endpoint.md](plans/defaults-endpoint.md) | `GET /defaults` endpoint for new records |
| [plans/entity-naming-refactor.md](plans/entity-naming-refactor.md) | Entity naming refactor — `tabName` instead of `tableName` |
| [plans/etendo-go-mcp-gap-analysis.md](plans/etendo-go-mcp-gap-analysis.md) | Etendo Go ↔ MCP — gap analysis |
| [plans/inline-row-save-fixes.md](plans/inline-row-save-fixes.md) | Inline row save — pending fixes |
| [plans/jenkins-pipeline-steps.md](plans/jenkins-pipeline-steps.md) | Jenkins pipeline — Schema Forge setup |
| [plans/line-defaults-via-backend.md](plans/line-defaults-via-backend.md) | Resolve line defaults via `/defaults` (NEO Headless) |
| [plans/sales-order-save-performance.md](plans/sales-order-save-performance.md) | Sales Order save — remove request cascade and flicker |
| [plans/supercallout-unification-report.md](plans/supercallout-unification-report.md) | SuperCallout unification vs column-level callout compatibility — report |
| [plans/translation-fix-ETP-3647.md](plans/translation-fix-ETP-3647.md) | Fix UI translations — ETP-3647 |

### Completed plans

| File | Description |
|------|-------------|
| [plans/completed/2026-03-10/contract-v2-improvements.md](plans/completed/2026-03-10/contract-v2-improvements.md) | Contract v2 improvements |
| [plans/completed/2026-03-11/hybrid-display-logic.md](plans/completed/2026-03-11/hybrid-display-logic.md) | Hybrid DisplayLogic evaluation |
| [plans/completed/2026-03-11/js-direct-db-writer.md](plans/completed/2026-03-11/js-direct-db-writer.md) | Replace webhooks with direct JS database writer |
| [plans/completed/2026-03-12/process-and-report-pipeline.md](plans/completed/2026-03-12/process-and-report-pipeline.md) | Process & Report pipeline support — **all 4 phases complete** |
| [plans/completed/2026-03-13/neo-headless-2.0.md](plans/completed/2026-03-13/neo-headless-2.0.md) | NEO Headless 2.0 — proposal (SUPERSEDED) |
| [plans/completed/2026-03-14/fix-write-operations.md](plans/completed/2026-03-14/fix-write-operations.md) | Fix broken write operations (POST, PUT, PATCH) in NEO Headless |
| [plans/completed/2026-03-14/obuisel-selectors.md](plans/completed/2026-03-14/obuisel-selectors.md) | OBUISEL selector support in NEO Headless (2026-03-14) |
| [plans/completed/2026-03-17/obuisel-selectors.md](plans/completed/2026-03-17/obuisel-selectors.md) | OBUISEL selector support in NEO Headless (2026-03-17 follow-up) |
| [plans/completed/2026-03-18/window-template-extensibility.md](plans/completed/2026-03-18/window-template-extensibility.md) | Window template extensibility system |

### Discarded plans

| File | Description |
|------|-------------|
| [plans/discarded/neo-report-endpoint.md](plans/discarded/neo-report-endpoint.md) | NEO Headless report endpoint — discarded design |

### Pending evaluation

| File | Description |
|------|-------------|
| [plans/pending/no-compile-alternatives.md](plans/pending/no-compile-alternatives.md) | Alternatives to compiled code generation — pending evaluation |

### Evaluations

| File | Description |
|------|-------------|
| [plans/evaluations/architecture-review.md](plans/evaluations/architecture-review.md) | Architecture evaluation — Schema Forge |
| [plans/evaluations/day-1-decisions.md](plans/evaluations/day-1-decisions.md) | Day-1 decisions record |
| [plans/evaluations/decisions-resolved.md](plans/evaluations/decisions-resolved.md) | Resolved design decisions |
| [plans/evaluations/onboarding.md](plans/evaluations/onboarding.md) | Onboarding guide |
| [plans/evaluations/risk-assessment.md](plans/evaluations/risk-assessment.md) | External risk assessment |
| [plans/evaluations/risk-register.md](plans/evaluations/risk-register.md) | Consolidated risk register — Day-1 |
| [plans/evaluations/scope-review.md](plans/evaluations/scope-review.md) | Scope evaluation — product owner review |

## Superpowers (Plans & Specs)

Window-targeted plans and design specs produced by the `superpowers` workflow.

### Plans

| File | Description |
|------|-------------|
| [superpowers/plans/2026-03-11-grid-form-redesign.md](superpowers/plans/2026-03-11-grid-form-redesign.md) | Grid + Form redesign — implementation plan |
| [superpowers/plans/2026-03-11-master-detail-card.md](superpowers/plans/2026-03-11-master-detail-card.md) | Master-detail card format — implementation plan |
| [superpowers/plans/2026-03-12-contract-versioning-window-locks.md](superpowers/plans/2026-03-12-contract-versioning-window-locks.md) | Contract versioning & window lock system |
| [superpowers/plans/2026-04-27-fiscal-config.md](superpowers/plans/2026-04-27-fiscal-config.md) | Configuración Fiscal — implementation plan |
| [superpowers/plans/2026-05-04-fiscal-monitor.md](superpowers/plans/2026-05-04-fiscal-monitor.md) | Fiscal Monitor — implementation plan |
| [superpowers/plans/2026-05-07-send-to-sif-button.md](superpowers/plans/2026-05-07-send-to-sif-button.md) | Send to SIF button — Sales Invoice window |
| [superpowers/plans/2026-05-07-sif-data-tabs.md](superpowers/plans/2026-05-07-sif-data-tabs.md) | SIF data tabs — Sales Invoice window |

### Specs

| File | Description |
|------|-------------|
| [superpowers/specs/2026-03-11-grid-form-redesign-design.md](superpowers/specs/2026-03-11-grid-form-redesign-design.md) | Grid + Form redesign — design spec |
| [superpowers/specs/2026-03-11-master-detail-card-design.md](superpowers/specs/2026-03-11-master-detail-card-design.md) | Master-detail card format — design spec |
| [superpowers/specs/2026-04-27-fiscal-config-design.md](superpowers/specs/2026-04-27-fiscal-config-design.md) | Configuración Fiscal — design spec |
| [superpowers/specs/2026-05-04-fiscal-monitor-design.md](superpowers/specs/2026-05-04-fiscal-monitor-design.md) | Fiscal Monitor — design spec |
| [superpowers/specs/2026-05-07-send-to-sif-button-design.md](superpowers/specs/2026-05-07-send-to-sif-button-design.md) | Send to SIF button — design spec |
| [superpowers/specs/2026-05-07-sif-data-tabs-design.md](superpowers/specs/2026-05-07-sif-data-tabs-design.md) | SIF data tabs — design spec |
| [superpowers/specs/2026-05-11-fiscal-refresh-and-invoice-status-design.md](superpowers/specs/2026-05-11-fiscal-refresh-and-invoice-status-design.md) | Fiscal Refresh button + Invoice fiscal status — design spec |

## Reports & Investigations

| File | Description |
|------|-------------|
| [ad-menu-tree-report.md](ad-menu-tree-report.md) | AD menu tree report — structure of the Etendo menu and Schema Forge mapping |
| [etp-3878-findings.md](etp-3878-findings.md) | ETP-3878 findings (architecture audit — ceded to ETP-3981) |
| [faq-shared-tables.md](faq-shared-tables.md) | FAQ: windows that share database tables |
| [possible-limitations.md](possible-limitations.md) | Possible limitations: NEO Headless vs code generation |
| [enterprise-backlog.md](enterprise-backlog.md) | Enterprise Edition — backlog |
| [saas-base-plan.md](saas-base-plan.md) | SaaS Base — implementation plan |

## Team, Workflow & Policy

| File | Description |
|------|-------------|
| [branch-workflow.md](branch-workflow.md) | Branch & worktree workflow — feature/epic strategy across Schema Forge and Etendo Go |
| [team-workflow.md](team-workflow.md) | Team development workflow — coordination conventions across roles |
| [self-documentation-policy.md](self-documentation-policy.md) | Self-documentation policy: triggers, checklists, and phase responsibilities for keeping docs in sync with code |
| [cross-system-checklist.md](cross-system-checklist.md) | Etendo Go cross-system checklist — boundary review before/after changes |
| [onboarding-methodology-shift.md](onboarding-methodology-shift.md) | Methodology shift — onboarding deck (companion to `onboarding-deck.html`) |
| [claude-md-best-practices.md](claude-md-best-practices.md) | Best practices for writing effective CLAUDE.md files (research compilation) |
| [brainstorming-2026-03-10.md](brainstorming-2026-03-10.md) | Brainstorming session — 2026-03-10 |

## Non-Markdown Companion Files

`docs/onboarding-deck.html` is a rendered HTML deck that complements
[onboarding-methodology-shift.md](onboarding-methodology-shift.md). It is intentionally
not linked through the table format above because it is not a Markdown document.
