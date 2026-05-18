# Warehouse

## Intent

Use this window to maintain the warehouse master record and understand what is physically stored and moving through that warehouse. The business intent is broader than basic warehouse setup: users should be able to define the warehouse itself, review current stock by product, inspect the warehouse's storage bins, and trace inventory movements that explain how stock arrived, moved internally, or left the warehouse.

## What this window should allow

- Create, review, and update a warehouse header with at least Search Key, Name, Description, Location / Address, optional Warehouse Rule, and the Allocated flag when that field is visible in the current environment.
- Open a saved warehouse and use the detail surface as an operational workspace rather than only a master-data form.
- Review stock summarized by product across the warehouse, not only bin by bin, so users can understand on-hand quantity at warehouse level.
- Start a stock-transfer flow from a stocked product to another warehouse when the product has available quantity.
- Review storage-bin records that belong to the warehouse, including locator coordinates, relative priority, barcode, default-bin flag, and inventory-status context.
- Review warehouse transactions so users can understand stock history by movement date, product, movement type, and quantity.
- Inspect bin-content records when the business process requires looking below warehouse totals into product/UOM/on-hand detail at storage-bin level.

## Interaction model

- Route: `/warehouse`, `/warehouse/:recordId`.
- Visibility: visible in the Inventory menu as `Warehouse`.
- Implementation type: custom window. `tools/app-shell/src/windows/registry.js` resolves `warehouse` through `customLoaders`, and the custom wrapper mounts generated warehouse detail behavior plus custom summary, Products, and Transactions surfaces.
- Window shape: single-entity warehouse master with additional child/secondary surfaces. The contract declares no single `detailEntity`; instead, the record page combines the warehouse header with storage-bin, bin-content, products, and transactions interactions around the selected warehouse.
- List interaction: the list is the warehouse master list, searchable by `searchKey` and `name`. Opening a record switches to the warehouse detail workspace.
- Detail interaction: the detail page keeps the warehouse form as the main record, adds sidebar summary content, adds a custom `Products` primary tab, and exposes a `Transactions` secondary tab. Storage-bin and bin-content data remain part of the available warehouse child surface area through the generated contract/API, even though the custom window emphasizes product and transaction views.
- An **Attachments** tab is available in the detail tab strip, allowing files to be attached to the current record.

## Reactive behavior and dependencies

- Warehouse creation has an explicit post-save reaction in the custom wrapper: after a warehouse is created, the UI attempts to create a default storage bin using the pattern `<warehouse-searchKey>-0-0-0`. If that follow-up call fails, the warehouse still stays created and the user receives a warning toast instead of a silent failure.
- Product stock is reactive to child data, not entered directly on the warehouse header. `useWarehouseStock` loads all storage bins for the selected warehouse, then loads each bin's `binContents` and `productTransactions`. The Products tab aggregates `quantityOnHand` across bin-content rows by product, so the visible warehouse stock summary depends on child rows under the warehouse's storage bins.
- The Products tab is therefore warehouse-wide and cross-bin. It does not show separate stock rows per bin; it sums quantities into one row per product and resolves the displayed UOM from selector-backed UOM metadata when available.
- Stock-movement behavior is status-like but implemented as an explicit action flow rather than a header document status. From a product row, `MoveStockModal` lets the user choose another warehouse, constrain quantity to the current on-hand quantity, create a goods-movement header and line, and then process that movement immediately. This means the warehouse view is expected to trigger downstream stock movement documents, not only display stock.
- Movement execution depends on both source and destination warehouses having at least one storage bin. The transfer flow fetches the first available storage bin in the current warehouse and the destination warehouse before creating the movement line. If either side has no storage bin, the flow fails with an error toast.
- Storage-bin behavior is partly reactive through field defaults and actions. Current evidence shows default relative priority (`50`), a default inventory status, a `Default` flag, and a `Change Status` process action on storage bins. The change-status action is only exposed when the locator is not virtual according to the contract display logic.
- Transaction review is child-driven and read-only in current evidence. The transaction form exposes product, attribute set value, movement quantity, movement date, movement type, and links back to source records such as goods-shipment lines, physical-inventory lines, movement lines, production lines, and project issues. The custom Transactions tab adds filtering and sorting on date, product, type, and quantity so users can interpret warehouse activity without editing those records from this view.
- Bin-content behavior is also child-driven. Current generated form evidence shows product, UOM, order UOM, quantity on hand, quantity in draft transactions, and referenced inventory fields. This supports the expectation that warehouse stock depends on underlying locator-level detail and draft transactional state, even though the custom warehouse page does not foreground a dedicated bin-contents tab.
- No parent-selector chains or header-dependent selectors beyond the warehouse's own Location / Address and Warehouse Rule were visible in the current warehouse-specific evidence. The main dependencies here are warehouse-to-storage-bin, storage-bin-to-bin-contents, and storage-bin-to-product-transactions.

## Gap assessment

- Automatic default-bin creation is clearly implemented in the SPA wrapper, but the current evidence does not prove whether the backend enforces uniqueness, whether every warehouse is required to have exactly one default bin, or how conflicts are handled when a bin with the same `<searchKey>-0-0-0` pattern already exists. Treat those business guarantees as unverified.
- The move-stock flow is clearly intended to create and process a transfer, but the current evidence does not prove whether the first storage bin returned for each warehouse is always the correct business bin to use. The implementation picks the first available bin, so any richer source/destination-bin selection semantics remain a gap.
- The custom warehouse page makes Products and Transactions central, but current evidence does not show an equally visible custom surface for bins or raw bin contents inside this same page. The contract exposes `storageBin` and `binContents`, yet the reviewed custom code does not prove exactly how users reach those child records from the warehouse detail page in the current SPA. That is an open usability ambiguity, not confirmed absence.
- Manual cost adjustment exists as a declared action on product transactions, but the reviewed custom Transactions tab is a read-only analytical table. Current evidence does not show that this action is surfaced from the custom warehouse page, so transaction-side corrective workflows should be treated as only partially evidenced here.
- WarehouseSummary is mounted as sidebar content, and it uses warehouse stock data, but the current reviewed evidence does not fully enumerate every metric or chart users see there. It is safe to say the sidebar provides warehouse summary/stock context; it is not safe to overstate the exact KPI contract without further UI evidence.
- The stock trend/chart logic derives values from cumulative product transactions over recent months, but current evidence does not prove that those visualizations are the authoritative business measure for every warehouse scenario. They should be treated as current UI analytics, not as a complete statement of inventory accounting behavior.
- The Stock trend chart (line and bar) uses `niceScale` from `@/lib/dashboardNumberFormat` to produce rounded Y-axis ticks and `formatDashboardAxisTick` to render them (e.g. `1K`, `500`, `250`), consistent with the Dashboard and Contact sidebar charts. Data points in the line chart are invisible by default and appear only on hover; no permanent dot markers are rendered on the line.

## Manual verification

1. Open `/warehouse` and confirm the list shows the warehouse master and supports searching by Search Key and Name.
2. Create a warehouse with Search Key, Name, and Location / Address, save it, and confirm the record opens as a custom detail workspace with sidebar summary content, a `Products` tab, and a `Transactions` tab.
3. After creation, confirm a default storage bin is created automatically with the expected coordinate pattern; if it is not, confirm the UI warns that warehouse creation succeeded but default-bin creation failed.
4. In `Products`, confirm stocked products are shown as warehouse-level aggregates with product, UOM, and on-hand quantity rather than one row per storage bin.
5. Start `Move Stock` from a stocked product and confirm the modal requires a destination warehouse and a quantity no greater than the displayed on-hand amount.
6. Complete a move and confirm the flow creates a warehouse transfer effect that is later visible in warehouse transactions or refreshed stock totals.
7. In `Transactions`, confirm filtering and sorting work on movement date, product, type, and quantity, and confirm the rows behave as historical review rather than inline editing.
8. Verify whether the current warehouse detail page exposes a direct way to inspect or maintain storage bins and raw bin contents from the same workspace; if that path is missing or indirect, record it as a functional gap.
9. Open a saved record and confirm the **Attachments** tab is visible in the tab strip. Upload a file and verify it appears in the table. Download it and delete it. When multiple files exist, confirm 'Download all (ZIP)' and 'Delete all' appear in the table header and that 'Delete all' shows a confirmation dialog before removing all files.

## Automated evidence

- `tools/app-shell/src/windows/__tests__/registry.test.js` proves the warehouse slug is registered in the window map built from `menu.json`, which backs route loading for `/warehouse` and `/warehouse/:recordId`.
- `cli/test/warehouse-aggregate.test.js` verifies the product aggregation helper used by the custom Products tab, including cross-bin quantity summation, UOM label resolution, numeric coercion, and filtering of zero-total products.
- `tools/app-shell/src/windows/custom/warehouse/index.jsx`, `useWarehouseStock.js`, `WarehouseProductsTab.jsx`, and `MoveStockModal.jsx` provide direct source evidence for the custom summary/products/transfer behavior described above.
- `artifacts/warehouse/contract.json` and generated warehouse files provide direct source evidence for the available warehouse, storage-bin, product-transactions, and bin-contents entities, selectors, and declared actions.
- `tools/app-shell/src/windows/custom/warehouse/__tests__/WarehouseSummary.test.js` verifies that `WarehouseSummary` uses `niceScale` and `formatDashboardAxisTick` for both chart types, that no local `fmtY` function is present, that line-chart dots are hover-only, and that the bar-chart tooltip receives the `ui` prop.
- No dedicated browser-level warehouse window test was found for the full multi-surface interaction flow. Use `docs/generated-custom-windows/app-shell-functional-flows.md` for shared shell/route/loading evidence and rely on manual verification for warehouse-specific behavior.
- The generated `WarehousePage.jsx` includes `AttachmentsTab` in its `customTabs` prop, wired to the `M_Warehouse` AD table.

## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to this window.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component; this window has no required header fields so the array is empty and there is no behavioral change.
- LinesTable template updated in ETP-3908 to include the inline-editable add-row alignment fix. This window uses `linesLayout: "classic"` so the new template branch is dead code here — no behavioral change.
