# Warehouse

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for Warehouse.

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
- **Manual verification:**
  1. Open `/warehouse`, create a warehouse, and confirm it appears in the list by Search Key and Name.
  2. Open the saved warehouse and confirm the detail surface shows a sidebar summary, a **Products** tab, and a **Transactions** tab rather than only a plain generated form.
  3. Confirm a default storage bin is created automatically; if it is not, confirm the warning toast explains that warehouse creation succeeded but default-bin creation failed.
  4. In **Products**, verify the move-stock action opens destination-warehouse and quantity controls for a stocked product.
  5. In **Transactions**, verify filtering and sorting work on movement date, product, type, and quantity.
- **Automated evidence:** No dedicated warehouse window test file was found under `tools/app-shell` or `artifacts/warehouse/**/__tests__`. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared loader/route coverage.
