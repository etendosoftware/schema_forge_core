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
