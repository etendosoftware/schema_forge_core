# ETP-4267 Cross-Domain Plan — Warehouse window visual redesign and valuation feature

## Purpose

Full visual and functional redesign of the Warehouse window: list view, detail view,
sidebar, Products tab, and Transactions tab. Adds a persisted valuation column
(`EM_ETGO_VALUATION`) on `M_Storage_Detail` and a navigable Document column in the
Transactions tab resolved server-side by a new `ProductTransactionsHandler` NeoHandler.

## Domains Touched

| Domain | Files | Justification |
|--------|-------|---------------|
| window:warehouse | `artifacts/warehouse/*`, `tools/app-shell/src/windows/custom/warehouse/**`, `docs/generated-custom-windows/warehouse.md` | All warehouse-specific artifacts: decisions, contract, generated files, custom components (list table, sidebar summary, products tab, transactions table), tests, and updated functional guide. |
| app-shell-core | `packages/app-shell-core/src/locales/en_US.json`, `packages/app-shell-core/src/locales/es_ES.json`, `packages/app-shell-core/src/components/ui/custom-icons.jsx` | i18n keys for all new warehouse UI labels (valuation, stock data, document column, tab headers) in both locales. Custom icon (`WarehouseProductsIcon`) added for the Products tab icon. |
| platform-change | `tools/app-shell/src/components/contract-ui/DetailView.jsx`, `tools/app-shell/src/components/contract-ui/ListView.jsx` | New layout props (`sidebarAboveTabsOnly`, `tabsSeparator`, `contentOverflow`, `listbarPaddingY`, `tablePaddingBottom`) added to shared components. Props are additive and backward-compatible; no existing window behavior changes. |

## Risk Assessment

- `platform-change` additions are purely additive props with default values — no
  existing window is affected unless it explicitly opts in.
- `EM_ETGO_VALUATION` is a new nullable column on `M_Storage_Detail`; no NOT NULL
  constraint, no data migration required. Default value is null until the costing
  engine runs.
- `CostingValuationHandler` uses native SQL UPDATE (no Hibernate entities) to avoid
  session corruption during costing batch — same pattern validated in prior tickets.
- `ProductTransactionsHandler` is a read-only post-hook (GET enrichment only); it
  cannot modify any record.
- `javaQualifier` on `productTransactions` entity is pipeline-safe: declared in
  `decisions.json`, written by `push-to-neo`, exported to `ETGO_SF_ENTITY.xml`.

## Test Plan

- Unit tests for `StorageDetailValuationHandler`, `CostingValuationHandler`, and
  `ProductTransactionsHandler` — all pass, >90% coverage.
- `WarehouseSummary.vitest.jsx` — updated and passing (4/4).
- `make validate-pipeline ONLY=warehouse` — 0 violations.
- Manual verification per `docs/generated-custom-windows/warehouse.md` §Manual verification.

## Rollback

Revert the two commits on `feature/ETP-4267`:
- `Feature ETP-4267: Warehouse window visual redesign and valuation feature` (schema_forge)
- `Feature ETP-4267: Add valuation column and transaction navigation` (com.etendoerp.go)

The `EM_ETGO_VALUATION` column can remain in the DB (nullable, no impact); dropping it
requires a separate migration if desired.
