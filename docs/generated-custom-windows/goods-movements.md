# Goods Movements

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for Goods Movements.

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
- **Manual verification:**
  1. Open `/goods-movements` and create a draft movement header.
  2. Open the new record and add at least one line with Product, Movement Quantity, source Storage Bin, and destination New Storage Bin.
  3. Confirm Document No. is read-only on the header and UOM is read-only on the line.
  4. Process the movement and confirm the status changes from draft/unprocessed to processed.
- **Automated evidence:** No dedicated window-specific test file was found for Goods Movements. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared loader/route coverage.
