# ETP-3938 Agentic Corrections Plan

## Context

JuanCarlos.mbox contains eight agentic validation reports from May 11, 2026 covering 33+ Schema Forge / Etendo Go windows through MCP-style NEO tools. The reports show that master-data windows are mostly agent-ready, while transactional document windows still block autonomous agents during creation and lifecycle execution.

Planning branch: `feature/ETP-3938-agentic-plan`

Base: latest `origin/epic/ETP-3504` at the time this document was created.

This document is planning-only. Implementation work should be split across the Jira tasks listed below and should preserve the project phase order:

`DEV -> REVIEW -> QA -> DOCS`

## Main Findings

Agent-ready areas:

- Product category, price list, payment term, warehouse, payment method, goods movements, contacts, tax, assets, and other master/configuration windows are usable for list/read and usually for basic CRUD.
- LIST and GET are consistently reliable when data exists.
- Defaults often provide useful document values such as dates, currency, status, transaction document, payment method, and price list.

Blocking patterns:

- Required FK selectors return empty values when they need context such as business partner, organization, date, SO/PO mode, or parent record.
- Repeated selector blockers include `partnerAddress`, `invoiceAddress`, `priceList`, `transactionDocument`, and line-level `tax`.
- Transactional document actions are not sufficiently discoverable or executable for agents: `documentAction`, `processNow`, `createLinesFrom`, `createLinesFromOrder`, `createLinesFromShipment`, `receiveMaterials`, `sendMaterials`, payment processing, and related workflow buttons.
- MCP agents do not yet have the same form fidelity as the SPA: callouts, display logic, read-only/hidden/required field evaluation, and session context are not exposed as first-class agent capabilities.
- Transactional schemas expose too much raw surface for agents. Orders and invoices often include 94-152 header fields, many of which are fiscal or accounting details that are not needed for a basic document draft.
- Some specs are not accessible or not applicable as CRUD windows: `bp-location` access denied, `verifactu-config` entity not found, `tbai-facturas-enviadas` entity not found, dashboard widgets, and report specs.

## Work Breakdown

### ETP-3955 - Resolve Contextual FK Selectors

Goal: make required selectors usable without hardcoded IDs.

Scope:

- Fix or configure contextual selector behavior for `partnerAddress`, `invoiceAddress`, `priceList`, `transactionDocument`, and `tax`.
- Prioritize `sales-order`, `sales-invoice`, `purchase-order`, `purchase-invoice`, `sales-quotation`, `goods-receipt`, `goods-shipment`, and return documents sharing `C_Order` or `M_InOut`.
- Preserve generic service boundaries. Window-specific behavior must use `NeoHandler` or another explicit extension point.

Acceptance focus:

- Agents can create draft transactional documents by resolving required FKs from selectors/defaults.
- Tax selectors return valid line taxes for the correct date and SO/PO context.

### ETP-3956 - Expose Document and Process Actions

Goal: let agents complete document lifecycles, not just create drafts.

Scope:

- Make document/process actions discoverable and executable through MCP/NEO agent flows.
- Cover `documentAction`, `processNow`, `createLinesFrom`, `createLinesFromOrder`, `createLinesFromShipment`, `receiveMaterials`, `sendMaterials`, `invoicefromshipment`, `aPRMProcessPayment`, and `aprmExecutepayment`.
- Add action metadata that explains valid states, payloads, preconditions, and side effects.

Acceptance focus:

- Agents can discover and run primary lifecycle actions without UI-only knowledge.
- Existing SPA behavior remains compatible with the same NEO endpoints.

### ETP-3957 - Expose Form Fidelity for MCP Agents

Goal: expose the same form intelligence agents need before create/update.

Scope:

- Evaluate or expose callout execution for derived values.
- Evaluate display logic and field state for the current record.
- Expose required/read-only/hidden metadata in an agent-readable shape.
- Add a session/context primer such as `neo_whoami`.
- Define or implement dry-run behavior for high-risk writes and actions.

Acceptance focus:

- Agents can ask which fields are visible, required, and writable for a current record.
- Agents can obtain callout-derived values before persisting.
- Agents can inspect current client/org/role/user/language/currency/date context.

### ETP-3958 - Define Agent Profile Metadata per Spec

Goal: make raw schemas understandable to agents.

Scope:

- Define a stable metadata shape, likely sourced from `decisions.json` and propagated into contracts or MCP descriptions.
- Include purpose, when-to-use, minimum create fields, contextual selector requirements, lifecycle actions, examples, and edge cases.
- Keep master-data specs lightweight; focus richer metadata on transactional and process-heavy specs.

Acceptance focus:

- Priority document specs include actionable agent guidance.
- Metadata is generated or propagated from source artifacts, not manually patched in generated outputs.

### ETP-3959 - Architecture Review and Quality Gates

Goal: keep the implementation aligned with Schema Forge and NEO Headless rules.

Scope:

- Review changes against project constraints:
  - never hardcode or guess window/process/menu IDs;
  - never manually edit `artifacts/*/generated/`;
  - do not add window-specific logic to `NeoSelectorService`, `NeoDefaultsService`, `NeoCrudHandler`, or `NeoServlet`;
  - use `NeoHandler` for window/entity-specific behavior;
  - if `push-to-neo.js` runs, run `./gradlew export.database` in the Etendo root afterward.

Acceptance focus:

- Architecture review notes are captured before QA.
- Generic service changes are justified and remain generic.

### ETP-3960 - QA and Behavioral Coverage

Goal: turn the validation findings into repeatable checks.

Scope:

- Cover contextual selector resolution.
- Cover document draft creation without hardcoded IDs.
- Cover line tax selector behavior.
- Cover representative document/process actions.
- Cover callout/display metadata if exposed.
- Re-run the relevant test baseline, including `make test`.

Acceptance focus:

- QA states which JuanCarlos.mbox blockers are fixed, deferred, or out of scope.
- Each process-heavy flow has at least three documented or tested edge cases.

### ETP-3961 - Documentation and Feedback Updates

Goal: carry the validation evidence into versioned repository documentation.

Scope:

- Append findings to `feedback.md`.
- Update affected window guides under `docs/generated-custom-windows/`.
- Add or update an agent-facing guide for creating and completing documents without hardcoded IDs.
- Document selector context requirements and process-action behavior.
- Include deploy/export reminders where relevant.

Acceptance focus:

- Behavior-changing changes include matching docs.
- Docs explain what agents can now do and what remains unsupported.

## Target Window Groups

Highest priority transactional windows:

- `sales-order`
- `sales-quotation`
- `sales-invoice`
- `purchase-order`
- `purchase-invoice`
- `goods-receipt`
- `goods-shipment`
- `return-from-customer`
- `return-to-vendor`
- `return-material-receipt`
- `return-to-vendor-shipment`

Master/configuration windows to use as positive baselines:

- `product-category`
- `price-list`
- `payment-term`
- `warehouse`
- `payment-method`
- `goods-movements`
- `contacts`
- `tax`
- `assets`

## Open Decisions

- Whether agent metadata lives only in Schema Forge artifacts or is also persisted into `ETGO_SF_*` runtime tables.
- Whether action metadata should be generated from AD process/button data, curated in `decisions.json`, or supplied by `NeoHandler` descriptions.
- Whether dry-run is implemented as a flag on write/action tools or as a separate endpoint/tool.
- Whether widgets and reports should become part of this ETP-3938 branch or remain a follow-up after document operability is fixed.
- Whether the existing `feature/ETP-3938` branch should be recreated, rebased, or superseded by this planning branch, because older local branch refs contain commits not based on the latest epic.

## References

- `docs/plans/etendo-go-mcp-gap-analysis.md`
- `docs/neo-headless-extensibility.md`
- `docs/generated-custom-windows/INDEX.md`
- `docs/e2e-testing-guide.md`
- Local validation source: `/Users/sebastianbarrozo/Downloads/Takeout/Correo/JuanCarlos.mbox`
