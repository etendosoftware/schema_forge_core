# Unit of Measure

This guide covers the current **System > Settings** Unit of Measure window exposed by `tools/app-shell/src/menu.json`. It complements `app-shell-functional-flows.md`: use the shared guide for authenticated shell behavior, generic `/:windowName` loading, and shared list/detail data behavior.

- **Purpose and surface:** Maintains unit-of-measure master data and, at the contract level, the conversion rows attached to each unit.
- **Route:** `/unit-of-measure` and `/unit-of-measure/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Generated window.
- **Key functional cues:**
  - The contract declares a default-layout header entity plus a `conversion` child entity.
  - The current generated header form exposes `EDI Code`, `Name`, `Symbol`, `Standard Precision`, `Costing Precision`, `Default`, and `UOM Type`.
  - `UOM Type` is backed by the contract enum values `Area`, `Length`, `Time`, `Volume`, and `Weight`.
  - The broader frontend contract also describes additional header fields under secondary sections (`Description`, `Breakdown`, `Use In Production`), but the current generated page only wires the base header fields listed above.
  - The `conversion` child entity defines `To UOM`, `Multiple Rate By`, and `Divide Rate By`, with callout metadata for rate recalculation. Generated `ConversionTable.jsx` and `ConversionForm.jsx` exist, but `UnitOfMeasurePage.jsx` does not currently mount a conversion detail pane.
  - The current contract declares no process/action endpoints.
- **Manual verification:**
  1. Open `/unit-of-measure` and confirm the list view loads.
  2. Open `/unit-of-measure/<recordId>` and confirm the detail page exposes the base header fields listed above.
  3. Open the `UOM Type` selector and confirm it offers `Area`, `Length`, `Time`, `Volume`, and `Weight`.
  4. Save a change and reopen the record to confirm the edited header values persist.
  5. Confirm the current detail page does not surface a conversion subtable, even though conversion contract metadata and generated conversion components exist in the bundle.
- **Automated evidence:** `artifacts/unit-of-measure/contract.json` includes schema-level checks for both header and `conversion`, including selector coverage for `toUOM` and callout declarations for the conversion-rate fields. There is no dedicated SPA test for the visible Unit of Measure page.
