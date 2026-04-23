# Inventory Windows

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for the Inventory menu group.

Shared shell behavior is documented in the cross-window guide: authentication, `/:windowName` routing, generic loader states, and shared `useEntity` list/detail behavior are not repeated here unless a window adds its own functional cue.

Current evidence base for this document:
- `tools/app-shell/src/menu.json`
- `tools/app-shell/src/windows/registry.js`
- `artifacts/<slug>/contract.json` for each documented window
- matching generated/custom window files when the contract declares notable custom panels or actions

Contract note: none of the current inventory window contracts declares a `relatedDocuments` block, so the sections below focus on layout, child entities, action endpoints, and custom panels that are actually present.

## Product

- **Purpose / surface:** Product is the inventory master-data window for maintaining sellable or stockable items, then drilling into pricing, stock, characteristics, BOM, costing, and transaction history.
- **Route:** `/product`, `/product/:recordId`
- **Visibility:** Visible in the Inventory menu as **Product**.
- **Implementation type:** Generated route from `registry.js`, with custom product-specific panels embedded by the generated page.
- **Key functional cues:**
  - The contract declares `layoutType: "gallery"` with `sidebarLayout: true`, and the generated page uses `ProductGallery` for list browsing instead of a plain table.
  - The detail surface is explicitly tabbed: **General** plus **Additional Info**. The second tab is backed by `ProductAdditionalInfoPanel`.
  - The detail footer is replaced by `ProductPriceBar`, so pricing is a first-class detail task instead of a detached child table.
  - The detail screen hides print and the generic More menu (`hidePrint`, `hideMoreMenu`) and adds sidebar content through `ProductSidebar`.
  - The contract exposes multiple child datasets behind the product detail API: `price`, `priceRuleVersion`, `billOfMaterials`, `costing`, `transactionAdjustments`, `transactions`, `productCharacteristic`, `stock`, `categoryPriceRuleVersion`, and `alternateUom`.
  - Contract filters for the list are `searchKey`, `name`, `productCategory`, `productType`, and `uPCEAN`.
  - Contract-declared product actions include variant management, variant creation, invariant update, service-relation helpers, tax-copy helpers, and manual cost adjustment on transaction rows.
- **Automated evidence:** No product-specific browser or component test file was found for this window. Use the shared route/loading coverage in [app-shell-functional-flows.md](app-shell-functional-flows.md) for shell-level proof; product-specific panels exist in `tools/app-shell/src/windows/custom/product/` but are not covered by dedicated tests in this repo.
- **Manual verification:**
  1. Open `/product` and confirm the list uses a gallery-style card presentation rather than only a flat grid.
  2. Open any product record and confirm the detail screen exposes **General** and **Additional Info** tabs.
  3. In **Additional Info**, verify commercial/logistics fields such as Tax Category, Sale, Purchase, Stocked, Weight, and UOM for Weight are grouped separately from the main identity fields.
  4. In the detail footer, open the pricing surface and confirm sale/purchase prices can be reviewed or drafted after the product is saved.
  5. Confirm the sidebar shows stock/availability context and a transaction-trend surface for the selected product.

## Product Category

- **Purpose / surface:** Product Category groups products under a shared classification and gives category-level access to the products already assigned to that category.
- **Route:** `/product-category`, `/product-category/:recordId`
- **Visibility:** Visible in the Inventory menu as **Product Category**.
- **Implementation type:** Generated.
- **Key functional cues:**
  - The contract uses `layoutType: "default"` and declares `detailEntity: "assignedProducts"`, so record pages are master/detail rather than single-form only.
  - Category header fields focus on `searchKey`, `name`, `description`, `default`, `summaryLevel`, and `image`.
  - The detail grid is **Assigned Products** and exposes only identifying fields in the frontend contract: Search Key, Name, and Product Type.
  - Assigned-product list filters are `searchKey`, `name`, and `productType`.
  - The contract declares row-level actions on assigned products for processing, creating/managing variants, relating products/categories/services, and updating invariants.
- **Automated evidence:** No dedicated window-specific test file was found for Product Category. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared loader/route coverage.
- **Manual verification:**
  1. Open `/product-category` and verify the list can be filtered by Search Key or Name.
  2. Open a category record and confirm the **Assigned Products** detail grid is present.
  3. Verify the child grid shows identifying product fields only, not the full editable product form.
  4. Inspect an assigned-product row and confirm the environment exposes the contract-declared product-category actions that apply to that row, such as variant or service-relation actions.

## Physical Inventory

- **Purpose / surface:** Physical Inventory is the counting/reconciliation window used to create a warehouse count session, generate counting lines, refresh system quantities, and then process the inventory count.
- **Route:** `/physical-inventory`, `/physical-inventory/:recordId`
- **Visibility:** Visible in the Inventory menu as **Physical Inventory**.
- **Implementation type:** Generated, with custom more-menu actions.
- **Key functional cues:**
  - The contract uses `layoutType: "default"`, `statusField: "processed"`, and a `processNow` override that requires lines before processing.
  - Header fields are centered on movement date, name, warehouse, description, inventory type, and the **Process Inventory Count** action.
  - Record pages use `detailEntity: "inventoryLine"`, so the core operational flow is to fill line items under a selected count header.
  - Quick line entry focuses on Line No., Product, Description, and **User Count**; the line setup derives `Cost` and hides the storage-bin default from the entry form.
  - A custom More menu component (`InventoryMenuContent`) adds **Create Inventory Count List** and **Update List System Count** actions.
  - The create-list modal supports product search key filtering, optional product-category filtering, and quantity-range filtering (`N`, `=`, `<`, `>`).
- **Automated evidence:**
  - `artifacts/physical-inventory/custom/__tests__/InventoryMenuContent.test.js`
  - `artifacts/physical-inventory/custom/__tests__/InventoryCreateListModal.test.js`
  These tests cover the custom menu wiring, action endpoints, modal generation flow, quantity-range options, and category selector loading. Shared route/loading evidence still lives in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- **Manual verification:**
  1. Open `/physical-inventory`, create a record, and set at least Movement Date, Name, and Warehouse.
  2. Open the saved record, use the More menu, and confirm **Create Inventory Count List** opens a modal with Product Search Key, Product Category, and Inventory Quantity filters.
  3. Generate the list and confirm count lines are created under the header.
  4. Use **Update List System Count**, then run **Process Inventory Count**, and confirm the status changes to processed and the process action is no longer offered for that record.

## Goods Movements

- **Purpose / surface:** Goods Movements records stock transfers between source and destination storage bins.
- **Route:** `/goods-movements`, `/goods-movements/:recordId`
- **Visibility:** Visible in the Inventory menu as **Goods Movement**.
- **Implementation type:** Generated.
- **Key functional cues:**
  - The contract uses `layoutType: "default"`, `statusField: "processed"`, and a `processNow` override that requires lines.
  - The header summary emphasizes `documentNo` plus processed status, so the user can track the movement identity and completion state at a glance.
  - Record pages use `detailEntity: "movementLine"` with line entry centered on Product, Movement Quantity, Storage Bin, and New Storage Bin.
  - UOM is present on the line but read-only in the frontend contract.
  - The generated page wires action endpoints for `moveBetweenLocators`, `processNow`, and `posted`.
  - List filters focus on `name` and `movementDate`; line filters focus on `product`.
- **Automated evidence:** No dedicated window-specific test file was found for Goods Movements. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared loader/route coverage.
- **Manual verification:**
  1. Open `/goods-movements` and create a draft movement header.
  2. Open the new record and add at least one line with Product, Movement Quantity, source Storage Bin, and destination New Storage Bin.
  3. Confirm Document No. is read-only on the header and UOM is read-only on the line.
  4. Process the movement and confirm the status changes from draft/unprocessed to processed.

## Internal Consumption

- **Purpose / surface:** Internal Consumption records stock used internally rather than transferred or sold.
- **Route:** `/internal-consumption`, `/internal-consumption/:recordId`
- **Visibility:** Visible in the Inventory menu as **Internal Consumption**.
- **Implementation type:** Generated, with a custom More menu process action.
- **Key functional cues:**
  - The contract uses `layoutType: "default"`, `statusField: "status"`, and a status enum with `Draft`, `Completed`, and `Voided` values.
  - Record pages use `detailEntity: "internalConsumptionLine"`, so the main transaction flow is header first, then lines.
  - Line entry is minimal and operational: Product, Movement Quantity, and Storage Bin, with UOM read-only.
  - The contract declares `customComponents.moreMenuContent = "InternalConsumptionActions"`, and the generated page injects that component into the detail view.
  - The custom action posts `{ action: 'CO' }` to `processNow`, refreshes on success, and hides itself entirely when the current record status is `VO`.
- **Automated evidence:** `artifacts/internal-consumption/custom/__tests__/InternalConsumptionActions.test.js` verifies the custom process-action component shape, the `processNow` POST endpoint, the `action: 'CO'` body, refresh behavior, and the "hide on voided" rule. Shared route/loading evidence is covered in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- **Manual verification:**
  1. Open `/internal-consumption`, create a new header, and set at least Movement Date and Name.
  2. Add one or more lines with Product, Movement Quantity, and Storage Bin.
  3. Open the More menu, run **Process**, and confirm the record moves from Draft to Completed.
  4. If a voided record exists in the environment, open it and confirm the custom **Process** action is not shown.

## Warehouse

- **Purpose / surface:** Warehouse is the operational master for a warehouse plus its stock, product, bin, and transaction views.
- **Route:** `/warehouse`, `/warehouse/:recordId`
- **Visibility:** Visible in the Inventory menu as **Warehouse**.
- **Implementation type:** Custom. `registry.js` resolves `warehouse` through `customLoaders` before the generated loader.
- **Key functional cues:**
  - The base contract exposes multiple child entities: `storageBin`, `productTransactions`, and `binContents`.
  - The contract also declares a `secondaryTabs.productTransactions` panel labeled **Transactions** and backed by `WarehouseTransactionsTable`.
  - The custom wrapper adds a **Products** primary tab, sidebar content through `WarehouseSummary`, and the transactions tab through `WarehouseTransactionsTable`.
  - `WarehouseProductsTab` aggregates stock by product and exposes a move-stock flow through `MoveStockModal`.
  - After warehouse creation, the custom window attempts to auto-create a default storage bin using the pattern `<warehouse-searchKey>-0-0-0`; if that fails, the user gets a warning toast instead of losing the saved warehouse.
  - Contract-declared actions include **Change Status** on storage bins and manual cost adjustment on product transactions.
- **Automated evidence:** No dedicated warehouse window test file was found under `tools/app-shell` or `artifacts/warehouse/**/__tests__`. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared loader/route coverage.
- **Manual verification:**
  1. Open `/warehouse`, create a warehouse, and confirm it appears in the list by Search Key and Name.
  2. Open the saved warehouse and confirm the detail surface shows a sidebar summary, a **Products** tab, and a **Transactions** tab rather than only a plain generated form.
  3. Confirm a default storage bin is created automatically; if it is not, confirm the warning toast explains that warehouse creation succeeded but default-bin creation failed.
  4. In **Products**, verify the move-stock action opens destination-warehouse and quantity controls for a stocked product.
  5. In **Transactions**, verify filtering and sorting work on movement date, product, type, and quantity.

## Warehouse Storage Bins

- **Purpose / surface:** Warehouse Storage Bins is a warehouse-to-locator maintenance view used to manage storage-bin coordinates and defaults under a warehouse.
- **Route:** `/warehouse-storage-bins`, `/warehouse-storage-bins/:recordId`
- **Visibility:** Hidden from the visible Inventory menu (`hidden: true` in `menu.json`). This is a route-only surface.
- **Implementation type:** Generated.
- **Key functional cues:**
  - `buildMenuGroups()` filters out hidden menu items, so this window is not rendered in the side menu.
  - `buildWindowMap()` still registers loaders for every `menu.json` item, including hidden ones, so the route remains directly addressable.
  - The generated page is master/detail on `warehouse -> locator`, not a standalone locator-only list.
  - Warehouse header fields focus on Search Key, Name, Description, address lines, City, Country, and Active status.
  - Locator lines focus on Search Key, X/Y/Z coordinates, Relative Priority, Default, and Active status.
  - Locator search support is limited to `searchKey`.
- **Automated evidence:** No dedicated window-specific test file was found for Warehouse Storage Bins. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared route/loading coverage.
- **Manual verification:**
  1. Confirm there is no visible **Storage Bin** entry in the Inventory menu.
  2. Navigate directly to `/warehouse-storage-bins` and confirm the window loads successfully.
  3. Open a warehouse record from that list, or load `/warehouse-storage-bins/:recordId` directly, and confirm the detail page shows locator rows under the warehouse header.
  4. Create or edit a locator row and confirm the UI exposes Search Key, X, Y, Z, Relative Priority, and Default, while Active remains read-only in the form.
