# Physical Inventory

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for Physical Inventory.

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
- **Manual verification:**
  1. Open `/physical-inventory`, create a record, and set at least Movement Date, Name, and Warehouse.
  2. Open the saved record, use the More menu, and confirm **Create Inventory Count List** opens a modal with Product Search Key, Product Category, and Inventory Quantity filters.
  3. Generate the list and confirm count lines are created under the header.
  4. Use **Update List System Count**, then run **Process Inventory Count**, and confirm the status changes to processed and the process action is no longer offered for that record.
- **Automated evidence:**
  - `artifacts/physical-inventory/custom/__tests__/InventoryMenuContent.test.js`
  - `artifacts/physical-inventory/custom/__tests__/InventoryCreateListModal.test.js`
  These tests cover the custom menu wiring, action endpoints, modal generation flow, quantity-range options, and category selector loading. Shared route/loading evidence still lives in [app-shell-functional-flows.md](app-shell-functional-flows.md).
