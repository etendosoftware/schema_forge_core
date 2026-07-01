# Tests Relocated to etendo_schema_forge (Phase 3 TODO)

Removed from schema_forge_core's cli/test/ during Phase 2 cleanup because their subject-under-test
lives in content that moved to etendo_schema_forge. Phase 3 must re-add these, adapted to import
from the installed `@etendosoftware/schema-forge-cli` package instead of relative `../src/*.js`
paths where they test cli/ logic, and relocated to sit next to their source under
`tools/app-shell/src/windows/custom/<window>/__tests__/` where they test functional utility code.

## Group A — tests functional-side utility code (relocate next to source, adapt to that area's test runner)

- `bottom-panels-rollout.test.js` — tests bottom-panel wiring across artifacts/tools/app-shell custom dirs for goods-movements, goods-receipt, goods-shipment, internal-consumption, physical-inventory, return-material-receipt, return-to-vendor-shipment.
- `eval-tab-readonly.test.js` — tests `tools/app-shell/src/components/contract-ui/evalTabReadOnly.js`.
- `fiscal-monitor.mockdata.test.js` — tests `tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitorMockData.js`.
- `fiscal-config.utils.test.js` — tests `tools/app-shell/src/windows/custom/fiscal-config/fiscalConfig.utils.js` and reads several fiscal-config page source files plus `registry.js`.
- `fiscal-monitor.utils.test.js` — tests `tools/app-shell/src/windows/custom/fiscal-monitor/fiscalMonitor.utils.js`.
- `useFiscalMonitor.test.js` — reads `tools/app-shell/src/windows/custom/fiscal-monitor/useFiscalMonitor.js` source text.
- `useFiscalConfig.test.js` — reads `tools/app-shell/src/windows/custom/fiscal-config/useFiscalConfig.js` source text.
- `warehouse-aggregate.test.js` — tests `tools/app-shell/src/windows/custom/warehouse/warehouseUtils.js`.
- `pipeline-window-steps.test.js` — writes/reads/restores `tools/app-shell/src/windows/custom/<throwaway>/*` and `tools/app-shell/src/windows/registry.js`.

## Group B — tests cli/ generator/validator logic against real window data (re-add importing the installed CLI package)

- `contract-all.test.js` — walks the real `artifacts/*/contract.json` tree.
- `etendogo-agentic-risk-integration.test.js` — imports `tools/app-shell/src/lib/selectorContext.js`, reads several windows' `contract.json`.
- `generate-frontend-extra-tabs.test.js` — reads `artifacts/*/generated/...`, `artifacts/*/decisions.json`, sales-invoice/purchase-invoice custom index files.
- `generate-frontend-statusbar-coverage.test.js` — reads `artifacts/sales-order/generated/web/sales-order/*.jsx`.
- `labels-naming.test.js` — reads several windows' `decisions.json` and `tools/app-shell/src/windows/custom/sales-quotation/index.jsx`.
- `purchase-invoice-readonly.test.js` — reads `artifacts/purchase-invoice/{contract.json,decisions.json,generated/web/purchase-invoice/HeaderForm.jsx}`.
- `purchase-invoice-labels.test.js` — reads `artifacts/purchase-invoice/decisions.json` and its custom index file.
- `processes-valid.test.js` — reads `artifacts/sales-order/processes.json`.
- `validate-field-names.test.js` — writes its fixture inside the real `artifacts/` directory.
- `wiring-completeness.test.js` — walks the whole `artifacts/` tree and reads `tools/app-shell/src/{menu.json,windows/registry.js,App.jsx}`.

## Group C — discovered after the initial 19-file investigation (broader re-scan caught these; original grep required a trailing "/" after "artifacts" and never searched for "core-maps")

- `i18n-integration.test.js` — reads the real `../../artifacts` tree for "generated artifacts i18n compliance".
- `menu-actions-policy.test.js` — reads `../../artifacts/<window>/decisions.json`.
- `reports-naming.test.js` — reads `../../artifacts/<name>/report-contract.json`.

**Correction:** `core-maps.test.js` does NOT relocate — it stayed in `schema_forge_core`. Investigation found 3 of the 4 `core-maps/*.json` files are static, hand-authored Etendo AD reference data (`system-columns.json`, `ad-reference-map.json`, `impact-messages.json` — standard framework column/reference-type/messaging tables, not instance-specific), consumed directly by `cli/src/validate-schema.js` and `cli/src/extract-fields.js`. Only `ad-menu-cache.json` (has a `refreshedAt` timestamp — a genuine live-DB-refreshed cache) actually moves here. The Disposition Table in the design spec needs a correction: `core-maps/` is not wholesale functional — split it (3 static files stay core, `ad-menu-cache.json` moves here).

## Group D — found via actual test-suite failures after Task 3's deletions ran (real ENOENT/assertion failures, not caught by any static grep)

- `asset-group.contract.test.js` — reads real `artifacts/asset-group/{contract.json,generated/web/asset-group/*}`.
- `inline-lines-rollout.test.js` — reads the real `artifacts/` tree across 16 windows' `linesLayout` config.
- `invoice-delivery-status.test.js` — reads real `artifacts/purchase-invoice/{decisions.json,contract.json}`.
- `report-html-helpers.test.js` — reads real `artifacts/aging-payable/helpers.js` and other report artifacts.
- `check-window-docs.test.js` — mostly pure-function tests (fine), but one test (`fails when a window changes without its dedicated doc update`) does a real `existsSync`-style check against `docs/generated-custom-windows/`. The underlying `cli/src/check-window-docs.js` script stays in `schema_forge_core` (core logic, gets invoked via the installed CLI); only this test — which needs real committed docs to check freshness against — moves. Fits with `window-doc-freshness.yml` already being classified functional for the same reason.
