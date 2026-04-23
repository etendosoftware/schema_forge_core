# Internal Consumption

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for Internal Consumption.

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
- **Manual verification:**
  1. Open `/internal-consumption`, create a new header, and set at least Movement Date and Name.
  2. Add one or more lines with Product, Movement Quantity, and Storage Bin.
  3. Open the More menu, run **Process**, and confirm the record moves from Draft to Completed.
  4. If a voided record exists in the environment, open it and confirm the custom **Process** action is not shown.
- **Automated evidence:** `artifacts/internal-consumption/custom/__tests__/InternalConsumptionActions.test.js` verifies the custom process-action component shape, the `processNow` POST endpoint, the `action: 'CO'` body, refresh behavior, and the "hide on voided" rule. Shared route/loading evidence is covered in [app-shell-functional-flows.md](app-shell-functional-flows.md).
