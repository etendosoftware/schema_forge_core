# Physical Inventory

## Intent
Physical Inventory should let a warehouse user create an inventory count session, generate the initial count list, record counted quantities line by line, refresh the system count when needed, and then process the count once the session is ready to close.

## What this window should allow
- Create a physical inventory header with at least Movement Date, Name, and Warehouse.
- Classify the count as a Normal, Opening Inventory, or Closing Inventory session, with Normal as the visible default in current contract evidence.
- Open a saved header and work with its child inventory lines.
- Generate a count list from the header through a dedicated action that filters by product search key, optional product category, and inventory-quantity range.
- Capture user-entered counted quantities on each line while keeping the system count visible as read-only reference data.
- Refresh list system counts before final processing.
- Process the inventory count only when the record still has `processed = false` and at least one line exists.

## Interaction model
- Route: `/physical-inventory` for the list and `/physical-inventory/:recordId` for a specific count session.
- Visibility: visible from the Inventory menu as `Physical Inventory`.
- Implementation type: custom window wrapper at `tools/app-shell/src/windows/custom/physical-inventory/index.jsx`, registered in `customLoaders` in `tools/app-shell/src/windows/registry.js`. The wrapper supplies an explicit `COLUMNS` array to `InventoryTable` (`dot: false` on `movementDate`) and passes a `CustomInventoryTable` to `GeneratedApp`. Custom more-menu actions for count-list generation and system-count refresh come from the generated window.
- Window shape: master-child. The header entity is `inventory`, and the detail entity is `inventoryLine`.
- List/detail behavior: the list page opens inventory headers; the record page shows the header form plus the child line table and line form.

## Reactive behavior and dependencies
- Parent/child interaction: the record page binds `inventory` as the header and `inventoryLine` as the child set, so counting happens under a selected header rather than directly from the list.
- Status-driven actions: `Process Inventory Count` is only exposed while the header is not processed. The contract also marks line description and cost fields as read-only once the record is processed.
- Count-list generation: the custom menu exposes `Create Inventory Count List`, which opens a modal and submits `generateList` to the header action endpoint. Current code shows three filters in that modal: Product Search Key, optional Product Category, and Inventory Quantity range with `N`, `=`, `<`, and `>` options.
- System-count refresh: the same menu exposes `Update List System Count`, which POSTs to `updateQuantities` and reloads the page after success. This is the clearest current evidence for refreshing line-level system counts after list generation or before processing.
- Line-entry behavior: quick add-line entry focuses on Line No., Product, Description, and User Count. The generated line form/table also surfaces `System Count` as a read-only field, which supports side-by-side review of counted versus book quantity.
- Defaulting: current contract evidence shows defaults for Movement Date, Name, Inventory Type, and Processed on the header, plus default line numbering and a warehouse-driven default storage bin on lines.
- Dependent selectors and callouts: Product is a searchable selector with a product callout, and Storage Bin defaults from the selected warehouse context. No explicit UI evidence shows additional client-side reactions such as automatic variance math, totals, taxes, or discounts in this window.

## Gap assessment
- The business intent implies reconciliation between user count and system count, but the current evidence only proves that both values are present and that system counts can be refreshed. It does not clearly show any explicit variance field, reconciliation formula, or review workflow in the UI.
- Processing semantics are partially evidenced: the window exposes `processNow`, requires lines before processing, and hides the action once processed. Current repo evidence does not show the downstream accounting or stock-adjustment effects of processing, so those effects remain an open dependency on backend behavior rather than proven UI behavior.
- The count-list modal receives `warehouseId` from the menu component, but the current modal implementation does not visibly use it in the frontend request payload. If warehouse scoping is required during list generation, that dependency is not explicit in the current UI code.
- There is no browser-level automated evidence here for the full create list -> update system count -> process lifecycle; current proof is source-level and component-test level.

## Manual verification
1. Open `/physical-inventory` and create a new header with Movement Date, Name, and Warehouse.
2. Save the record and open its detail page.
3. Use the More menu and confirm `Create Inventory Count List` opens a modal with Product Search Key, Product Category, and Inventory Quantity filters.
4. Generate the list and confirm inventory lines are created under the header.
5. Open a generated or manually added line and confirm `User Count` is editable while `System Count` is read-only.
6. Run `Update List System Count` and confirm the page reloads and the line-level system counts refresh.
7. Run `Process Inventory Count` and confirm the record moves to processed status and the process action is no longer offered.
8. If the business expects visible variance or reconciliation math, verify whether the UI exposes it; if not, treat that as a functional gap rather than assumed behavior.

## Automated evidence
- `docs/generated-custom-windows/app-shell-functional-flows.md` documents the shared generated-window routing model for `/:windowName` and `/:windowName/:recordId`.
- `tools/app-shell/src/menu.json` includes the visible Inventory menu entry for `physical-inventory`.
- `tools/app-shell/src/windows/registry.js` maps `physical-inventory` in `customLoaders` to `tools/app-shell/src/windows/custom/physical-inventory/index.jsx`, which wraps `InventoryTable` with a custom `COLUMNS` array before forwarding to the generated `GeneratedApp`.
- `artifacts/physical-inventory/contract.json` defines the master-child contract, `processed` status field, `processNow` line requirement, header defaults, line fields including `QtyCount` and `QtyBook`, and action endpoints for `generateList`, `updateQuantities`, and `processNow`.
- `artifacts/physical-inventory/generated/web/physical-inventory/InventoryPage.jsx` binds `inventory` + `inventoryLine`, uses the generated process action, and injects the custom menu content.
- `artifacts/physical-inventory/generated/web/physical-inventory/InventoryLineForm.jsx` and `InventoryLineTable.jsx` show `User Count` as editable and `System Count` as read-only line data.
- `artifacts/physical-inventory/custom/__tests__/InventoryMenuContent.test.js` verifies the custom menu wiring, create-list entry, update-system-count entry, and update action endpoint.
- `artifacts/physical-inventory/custom/__tests__/InventoryCreateListModal.test.js` verifies the generation endpoint, quantity-range options, category loading, wildcard default for product search key, and success callback behavior.
