# Goods Movements

## Intent

Goods Movements should let an inventory user register a stock transfer from one storage bin to another under a single movement header. The business intent is to capture when inventory is relocated, preserve a movement identifier and date, and process the transfer only after the line set is complete.

## What this window should allow

- browse existing movement headers by name, movement date, document number, and processed status
- create a draft movement header with at least Name and Movement Date, plus optional description
- review the read-only document number that identifies the transfer after the header exists
- open a movement record and add one or more transfer lines under that header
- define each line with product, movement quantity, source storage bin, destination storage bin, and optional description
- review the line UOM as a read-only value instead of editing it directly in the simplified UI
- process the movement from draft once the transfer lines are ready

## Interaction model

- **Route:** `/goods-movements`, `/goods-movements/:recordId`
- **Visibility:** visible from the Inventory menu as **Goods Movement** (Spanish sidebar label: **Movimiento entre almacenes**)
- **Implementation type:** custom window wrapper at `tools/app-shell/src/windows/custom/goods-movements/index.jsx`, registered in `customLoaders` in `tools/app-shell/src/windows/registry.js`. The wrapper passes `SortIconComponent` and `RefreshIconComponent` (custom SVG icons from `@/components/ui/custom-icons`) to `GeneratedApp`. All column definitions — including `movementDate.dot: false` and the `processed` status enumLabels — are driven entirely by `decisions.json` through the generated `MovementTable`; the wrapper contains no `COLUMNS` override.
- **Window shape:** master-child. The list route shows movement headers; the record route shows one `movement` header with child `movementLine` rows.
- Lines tab layout: this window uses `window.linesLayout = "inlineEditable"`. Rows render at 40 px with pencil and trash hover-action icons on the right; clicking pencil flips the row into inline edit; trash removes the row after confirmation. When the add-row form is open, existing rows stay in `InlineLinesPanel` so column widths remain stable; the form renders in a header-hidden `DataTable` below that handles callouts, selectors, and focus. Clicking "Añadir línea" while a form is already open saves the current line and opens a fresh form scrolled into view. See `docs/ui-customization.md` section 13 for the full reference.
- **List behavior:** the list shows Name, Movement Date, Document No., and Status columns. Movement Date has `dot: false` so no red/green date dot appears on that column. Filters are available on Name and Movement Date. The toolbar uses custom sort and refresh SVG icons. The toolbar padding is reduced (`listbarPaddingX: "px-2"`, `tablePaddingX: "px-2"`). The link button, print button, and "All statuses" filter pill are all hidden (`hideLink: true`, `hidePrint: true`, `listViewOptions.hideStatusFilter: true`).
- **Status column:** the `Processed` field is exposed as a status badge with the column label overridden to **Status** (EN) / **Estado** (ES) via `labelOverrides`. The badge resolves i18n keys through `enumLabels`: `false` maps to `statusDraft` → "Draft" / "Borrador"; `true` maps to `statusProcessed` → "Processed" / "Procesado". The conditional filter in the list uses the same enum keys, so the filter picker shows the localized labels rather than raw `true`/`false` values.
- **Record behavior:** the header form exposes Name, Movement Date, Description, and read-only Document No. The detail area manages movement lines with Line No., Product, Movement Quantity, UOM, Storage Bin, and New Storage Bin.
- An **Attachments** tab is available in the detail tab strip, allowing files to be attached to the current record.

## Reactive behavior and dependencies

- Header and lines follow the shared generated entity flow documented in `docs/generated-custom-windows/app-shell-functional-flows.md`: opening a record loads both the header and its child rows, and adding a child row uses the parent record id so the line remains attached to the current movement.
- Processing is status-driven in current evidence. The generated page exposes **Process Movements** only while `processed` is false, and the contract marks that action as `requiresLines: true`, so the transfer should not be confirmed before at least one line exists.
- Read-only behavior is also status-driven. `artifacts/goods-movements/decisions.json` keeps processed-state read-only logic for both header and line fields, so movement data should stop being editable after completion.
- Line numbering is defaulted from the parent context. The line form computes the next line number from existing rows on the current movement, so new rows should continue the header's sequence rather than starting from an arbitrary value.
- Source and destination storage bins are separate selector-backed fields. The generated API exposes dedicated selector endpoints for `storageBin` and `newStorageBin`, which supports controlled selection for both the source and destination bins.
- Product selection has a declared classic callout in the contract, and the decisions file says the simplified SPA omits that callout. That means UOM or storage-bin-related defaults may still be resolved by the backend on save, but there is no current frontend evidence that choosing a product immediately refreshes UOM or either storage-bin selector in the browser.
- No current evidence shows dependent filtering between source and destination bins, stock-availability feedback, or inline quantity reactions when the user changes product, quantity, or either locator. Those dependencies should be treated as unproven until manually verified.

## Gap assessment

- The backend contract exposes action endpoints for `moveBetweenLocators` and `posted`, but the current generated detail page only surfaces **Process Movements**. If users are expected to run a bulk locator-move action or a posting action from this window, that expectation is not supported by the current visible UI.
- The business flow strongly suggests the destination bin should differ from the source bin, or at least be validated against the same warehouse and locator rules, but no visible browser-side validation for source-versus-destination consistency appears in the current evidence.
- Stock transfer flows often need availability checks before processing or while entering quantity. No current evidence shows inline stock-availability validation, negative-stock prevention messaging, or quantity warnings in this SPA surface.
- The retained classic callout names suggest product-to-UOM or quantity conversion behavior exists in the legacy model, but the decisions file explicitly omits those client-side reactions in the simplified UI. If users expect immediate UOM autofill or quantity conversion before save, that is currently a gap or an open ambiguity rather than a confirmed behavior.

## Manual verification

1. Open `/goods-movements` and confirm the list shows movement headers with Name, Movement Date, Document No., and Status.
2. Create a draft movement header and confirm Name and Movement Date are editable while Document No. is read-only.
3. Open the saved record, add a line, and confirm the line form exposes Product, Movement Quantity, Storage Bin, New Storage Bin, optional Description, and read-only UOM.
4. Add at least one line and confirm the line is attached to the current header rather than appearing as a standalone record.
5. Try combinations of source and destination bins and verify whether the selectors restrict invalid choices or whether the UI allows the same bin on both sides; if no restriction appears, treat that as a functional gap.
6. Change Product and Movement Quantity on a draft line and verify whether UOM, quantity conversion, or availability feedback reacts immediately; if not, treat those reactions as backend-only or missing.
7. Process the movement and confirm the header status changes to processed and previously editable header and line fields become read-only.
8. Open a saved record and confirm the **Attachments** tab is visible in the tab strip. Upload a file and verify it appears in the table. Download it and delete it. When multiple files exist, confirm 'Download all (ZIP)' and 'Delete all' appear in the table header and that 'Delete all' shows a confirmation dialog before removing all files.

## Automated evidence

- `tools/app-shell/src/menu.json` places **Goods Movement** in the visible Inventory menu (English label). The Spanish sidebar label **Movimiento entre almacenes** is resolved from `packages/app-shell-core/src/locales/es_ES.json` under `menus["Goods Movement"]`.
- `tools/app-shell/src/windows/registry.js` registers `goods-movements` in `customLoaders` to `tools/app-shell/src/windows/custom/goods-movements/index.jsx`. The wrapper passes `SortIconComponent={SortIcon}` and `RefreshIconComponent={RefreshIcon}` (from `@/components/ui/custom-icons`) to `GeneratedApp`; it contains no `COLUMNS` override.
- `artifacts/goods-movements/decisions.json` is the source of truth for all list view config: `listbarPaddingX`, `tablePaddingX`, `hideLink`, `hidePrint`, `listViewOptions.hideStatusFilter`, `labelOverrides` (renaming "Processed" to "Status"/"Estado"), `enumValues` for the status badge, and `movementDate.dot: false`.
- `artifacts/goods-movements/generated/web/goods-movements/MovementTable.jsx` reflects all column decisions. The generated `columns` array is:
  ```js
  { key: 'name',         column: 'Name',         type: 'string', label: 'Name' }
  { key: 'movementDate', column: 'MovementDate',  type: 'date',   label: 'Movement Date', dot: false }
  { key: 'documentNo',   column: 'DocumentNo',    type: 'string', label: 'Document No.' }
  { key: 'processed',    column: 'Processed',     type: 'status', label: 'Status', enumLabels: { 'true': 'statusProcessed', 'false': 'statusDraft' } }
  ```
- `artifacts/goods-movements/generated/web/goods-movements/index.jsx` defines the live generated route behavior: list/detail structure, `processed` status field, the `Process Movements` action, line-entry fields, and selector endpoints for Product, UOM, Storage Bin, and New Storage Bin.
- `artifacts/goods-movements/generated/web/goods-movements/MovementForm.jsx` and `MovementLineForm.jsx` show the current visible header and line fields.
- `artifacts/goods-movements/contract.json` and `artifacts/goods-movements/decisions.json` provide supporting evidence for the required-lines processing rule, processed-state read-only logic, omitted classic callouts, and omitted `moveBetweenLocators` / `posted` actions.
- No dedicated browser test or window-specific automated UI test was found for Goods Movements; shared route and generated-window loading evidence is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- The generated `MovementPage.jsx` includes `AttachmentsTab` in its `customTabs` prop, wired to the `M_Movement` AD table.