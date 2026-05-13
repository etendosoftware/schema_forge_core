# Unit of Measure

## Intent

Use this window to maintain the unit catalog that other business records depend on when they need a measurable quantity. A user should be able to define the base identity of a unit of measure, classify it by measurement family, and maintain the conversion rules that let one unit translate into another compatible unit.

Current evidence supports the master-data intent clearly. It only partially supports conversion maintenance in the visible SPA.

## What this window should allow

- Create, review, edit, and delete unit-of-measure records.
- Maintain the visible header data for each unit: EDI Code, Name, Symbol, Standard Precision, Costing Precision, Default, and UOM Type.
- Classify a unit under one of the currently exposed UOM Type values: Area, Length, Time, Volume, or Weight.
- Support base-versus-conversion semantics: the header record represents the source unit itself, while conversion rows should define how that source unit translates to another unit through `To UOM`, `Multiple Rate By`, and `Divide Rate By`.

The contract and generated assets indicate that conversion handling is part of the intended window behavior, but the current page evidence does not show that capability to the user.

## Interaction model

- Route: `/:windowName` and `/:windowName/:recordId`, concretely `/unit-of-measure` and `/unit-of-measure/:recordId` in the app shell.
- Visibility: visible under `System > Settings` in the side menu.
- Implementation type: generated window loaded through `tools/app-shell/src/windows/registry.js`.
- Window shape: intended master-child window (`unitOfMeasure` header with `conversion` detail entity in the contract), but the current mounted page behaves like a single-entity header window because it only renders the header list/detail flow.
- List behavior: the generated list uses the header entity and shows Name, Symbol, and a rendered UOM Type badge.
- Detail behavior: opening a record mounts the generated `UnitOfMeasureForm` for the header entity only; the current page does not mount a child conversion panel or subtable.
- An **Attachments** tab is available in the detail tab strip, allowing files to be attached to the current record.

## Reactive behavior and dependencies

- Parent/child interaction: the backend contract declares `conversion` as the detail entity and documents child filtering through `parentId={id}`, so conversions are expected to depend on the selected unit-of-measure header. That parent-child behavior is not visible in the current `UnitOfMeasurePage.jsx` because only the header form is mounted.
- Dependent selectors: conversion rows define `To UOM` as a selector-backed foreign key, so conversion creation should depend on choosing another UOM from the selector endpoint.
- Reactive conversion behavior: both `Multiple Rate By` and `Divide Rate By` keep the `SL_Conversion_Rate` callout, and decisions metadata describes reciprocal recalculation in both directions. This indicates that entering one rate should update the other.
- Validation dependency: the kept `C_UOM_Validation` rule says the target UOM must be compatible with the source type and cannot be the same UOM. That is the main observable business dependency for conversion rows.
- Header defaults and reactions: the contract includes a computed default of `N` for `Use In Production`, but that field is not currently surfaced in the generated detail page. No totals, discount, tax, or status-driven actions are visible in current evidence.
- Base-versus-conversion semantics: current evidence shows classification at the header level through `UOM Type`, while compatibility enforcement for conversions is delegated to backend validation rather than explained in the visible UI.

## Gap assessment

- Gap: conversion maintenance is modeled in the contract and generated with `ConversionTable.jsx` and `ConversionForm.jsx`, but the current `UnitOfMeasurePage.jsx` does not surface those components. Users can maintain header data in the SPA, but conversion rows are not visibly manageable from this window today.
- Gap: the contract contains additional header fields (`Description`, `Breakdown`, `Use In Production`) that are not mounted in the current generated form, so the visible page exposes only part of the documented UOM setup.
- Gap: the intended distinction between a source/base UOM and its allowed conversion targets is mostly implicit in backend metadata. The current page does not visibly explain or enforce that relationship until conversion UI is surfaced.
- Ambiguity: the `Default` checkbox is exposed, but current evidence does not show whether the UI or backend communicates any exclusivity rule when multiple records are edited over time.

## Manual verification

1. Open `/unit-of-measure` and confirm the list loads under `System > Settings`.
2. Open `/unit-of-measure/<recordId>` and confirm the detail page exposes EDI Code, Name, Symbol, Standard Precision, Costing Precision, Default, and UOM Type.
3. Open the UOM Type field and confirm it offers Area, Length, Time, Volume, and Weight.
4. Save a header change and reopen the record to confirm the updated values persist.
5. Confirm the current detail page does not expose a conversion table or conversion form, even though conversion behavior exists in the contract and generated bundle.
6. Open a saved record and confirm the **Attachments** tab is visible in the tab strip. Upload a file and verify it appears in the table. Download it and delete it. When multiple files exist, confirm 'Download all (ZIP)' and 'Delete all' appear in the table header and that 'Delete all' shows a confirmation dialog before removing all files.

## Automated evidence

- `tools/app-shell/src/menu.json` exposes `unit-of-measure` under `System > Settings`.
- `tools/app-shell/src/windows/registry.js` registers `unit-of-measure` as a generated window.
- `artifacts/unit-of-measure/contract.json` defines `unitOfMeasure` as the primary entity and `conversion` as the detail entity, including the `To UOM` selector, conversion CRUD endpoints, parent-child filtering guidance, conversion-rate callouts, and the `C_UOM_Validation` rule for compatible/non-self conversions.
- `artifacts/unit-of-measure/generated/web/unit-of-measure/UnitOfMeasureForm.jsx` exposes the current header fields and UOM Type enum options.
- `artifacts/unit-of-measure/generated/web/unit-of-measure/UnitOfMeasurePage.jsx` mounts only the header list/detail flow, which is why conversion maintenance is currently a documented gap.
- There is no dedicated SPA test proving visible conversion behavior for this window; current automated evidence is contract- and source-shape-based rather than browser-level.
- The generated `UnitOfMeasurePage.jsx` includes `AttachmentsTab` in its `customTabs` prop, wired to the `C_UOM` AD table.

## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to this window.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component; this window has no required header fields so the array is empty and there is no behavioral change.
