# Amortization

## Intent

The Amortization window lets a finance user view, edit, and process amortization documents. Each document represents a set of depreciation entries that occurred between two dates for a group of fixed assets. Lines link the document to specific assets and record the depreciation percentage and amount for that period.

Records are typically created from the **Assets** window via the **Create Amortization** action. The Amortization window is where users inspect and edit those records while still in draft, confirm them (triggering the accounting entries), and later reactivate them if a correction is needed.

## What this window should allow

- List existing amortization documents with name, accounting date, starting date, and total amortization formatted with currency symbol, with a status filter dropdown ("All statuses / Borrador / Procesado") in the toolbar.
- Open a document to inspect the header and its amortization lines.
- While in **draft** (`processed='N'`):
  - Edit header fields: name, description, accounting date, starting date, currency.
  - Edit lines inline: asset (required), amortization percentage, amortization amount.
  - Add and delete lines.
  - Press **Confirmar** to open a confirmation modal showing the current total, line count, and a lock warning, then confirm the document.
- Once **processed** (`processed='Y'`):
  - All header and line fields become read-only.
  - The **Delete** action is hidden.
  - A **Reactivar** option appears in the three-dot menu to unprocess the document.
- Attach files via the **Adjuntos** tab.

## Interaction model

- Route: `/amortization` for the list and `/amortization/:recordId` for detail.
- Visibility: Finance menu as **Amortización**, immediately below **Assets**.
- Implementation type: generated window with custom sidebar (`HeaderSidebar`) and confirm modal (`AmortizationConfirmModal`).
- Window shape: master-detail. Header (`A_Amortization`) + lines (`A_Amortizationline`). Accounting tab (Fact_Acct) excluded.
- Detail layout: sidebar panel on the right showing summary metrics; **Adjuntos** tab in the tab strip.
- Lines layout: `inlineEditable` — existing rows use InlineLinesPanel (flex), new rows use a DataTable add-row form. Hovering a row reveals pencil/trash icons in a dedicated 160px action slot (not a trailing-column swap, because `amortizationAmount` has `noTrailing: true`).
- Confirm button: black primary button on the far right, disabled when no lines exist. Opens `AmortizationConfirmModal` rather than executing directly.
- List toolbar: Print and Link buttons are hidden (`hidePrint: true`, `hideLink: true`). Only the status dropdown, funnel, and "New amortization" button are shown.

## Reactive behavior and dependencies

- **Draft/processed lock**: all editable header fields and all line fields carry `readOnlyLogic: @Processed@='Y'`. Delete is suppressed on processed documents.
- **Confirmar button**: wired via `draftMode.processField: "Processed"`. Only visible while draft; disabled when no lines; opens the confirm modal. The modal fetches the record and line count independently, calculates the total from line amounts (not from the stored header field), shows a warning, and submits `POST /action/Processed`. On success, the detail view refetches the header.
- **Reactivar menu action**: appears in the three-dot menu only when `processed='Y'`. Calls `/action/Processed` again, which the backend interprets as an unprocess request. After success, the page reloads.
- **Sidebar totals**: `HeaderSidebar` fetches all lines on mount and whenever `data` changes. The displayed total is always computed from the sum of line `amortizationAmount` values — not from the header's `totalAmortization` field, which can be stale after reactivation and line edits.
- **New record currency default**: the `currency` field defaults to the org's functional currency via `defaultExpr: "@$C_Currency_ID@"` in decisions.json. The currency is editable until the document is processed.
- **Main list total**: the `totalAmortization` column uses `type: 'amount'` (with `summable: true`) so it renders with the currency symbol and a column footer total.
- **Status filter dropdown**: the list toolbar shows an "All statuses ▾" dropdown (same mechanism as Sales Order). It filters by `processed` column value: 'N' → Borrador/Draft, 'Y' → Procesado/Processed. The `processed` column is in the table schema (type `status`, `filterOnly: true`) so `ListFilterBar` can detect it, but is hidden from visual display via `hiddenColumns` and excluded from the Conditional Filter via `filterable: false`.
- Accounting dimensions are discarded: `project`, `salesCampaign`, `activity`, `costcenter`, `User1_ID`, `User2_ID` are not surfaced.

## Gap assessment

- The confirm flow uses `POST /action/Processed` — the same endpoint as the classic "Post Amortization" button. The backend procedure `A_Amortization_Process` handles both process and unprocess based on the record's current state.
- There is no inline recalculation between `amortizationPercentage` and `amortizationAmount` on the line. Both fields are independently editable.
- The Accounting tab (Fact_Acct) is excluded; users cannot review accounting entries from the simplified UI.
- The `currency` column is excluded from the lines grid (redundant — all lines inherit the header currency).

## Manual verification

1. Open `/amortization` from Finance and confirm the list renders with formatted amounts (e.g., `5,000.00 €`) and no currency column.
2. From Assets, trigger **Create Amortization** on a depreciation-enabled asset. Open the new record in `/amortization`.
3. Confirm the record is in draft:
   - Header fields (name, accounting date, starting date, currency) are editable.
   - Lines can be added/edited inline (asset selector, % and amount fields appear in the add-row form).
   - Sidebar shows total (computed from lines), currency, line count, and "Borrador" status.
   - **Confirmar** button is black/primary on the far right; **Guardar** is grey.
4. Edit a line amount and save. Verify the sidebar total updates to reflect the new sum.
5. Press **Confirmar** with no lines and confirm the button is disabled.
6. With at least one line, press **Confirmar** and verify the modal opens showing the correct total (matching the line sum, not the old header value).
7. Confirm in the modal. Verify:
   - Toast "Registro procesado" appears.
   - Fields become read-only.
   - The **Confirmar** button disappears.
   - The three-dot menu shows **Reactivar**.
8. Press **Reactivar**. Verify the document returns to draft (fields editable, Confirmar button visible).
9. Reactivate, change a line amount, then confirm again. Verify the modal shows the updated total (not the previously-processed total).
10. Open the **Adjuntos** tab and upload, download, and delete a file.

## Manual verification (list toolbar)

1. Open `/amortization` list — toolbar shows: **All statuses ▾** | **funnel** | **+ New amortization**. Print and Link buttons are absent.
2. Click "All statuses ▾" — dropdown shows: All statuses ✓ / Borrador / Procesado. Selecting "Borrador" filters to draft records only.
3. Open the funnel (Conditional Filter) — `processed` does NOT appear in the field selector.

## Automated evidence

- `tools/app-shell/src/menu.json` — **Amortización** under Finance, `windowId: 800026`.
- `tools/app-shell/src/windows/registry.js` — `amortization` route.
- `cli/config/regen-windows.json` — `amortization` entry.
- `artifacts/amortization/decisions.json` — source of truth:
  - `linesLayout: "inlineEditable"` with `noTrailing: true` on `amortizationAmount` (dedicated 160px action slot).
  - `asset.grow: true` and `amortizationPercentage.grow: true` for balanced column distribution.
  - `draftMode: { processField: "Processed", label: "confirm", confirmModal: "AmortizationConfirmModal", disableWhenEmpty: true }`.
  - `menuActions: [{ key: "reactivate", visibleWhenFieldTrue: "processed", columnName: "Processed" }]`.
  - `hideDeleteWhenComplete: true`, `hidePrint: true`, `hideLink: true`.
  - `currency.defaultExpr: "@$C_Currency_ID@"`.
  - `processed` header field: `grid: true`, `filterOnly: true`, `columnType: "status"`, `filterable: false` — feeds the status dropdown without showing as a column.
  - Accounting entity excluded; accounting dimensions discarded.
- `artifacts/amortization/custom/HeaderSidebar.jsx` — sidebar with three metric cards: total (sum of line amounts, calculated client-side), currency, line count + status badge. Refetches lines when `data` changes.
- `artifacts/amortization/custom/AmortizationConfirmModal.jsx` — confirmation modal. Fetches lines to calculate current total independently. Calls `POST /action/Processed` on confirm. On success calls `onClose(true)` which triggers `window.location.reload()`.

## Visual polish — ETP-4103

Changes landed in `feature/ETP-4103`. All items below affect the Amortization window specifically or in common with Assets.

- `toolbarBorderBottom: true` in `decisions.json` — adds a horizontal divider line below the toolbar buttons row.
- `sidebarClassName: "w-[30%] shrink-0 overflow-y-auto border-l border-[#E8EAEF] p-2"` in `decisions.json` — sidebar is now proportional (30% of detail width) with a left-border divider and 8 px internal padding. Previously fixed at `w-96`.
- `toolbarButtonSize: "default"` in `decisions.json` — toolbar buttons (including the kebab menu) are now `h-10 w-10`, matching the Contacts window. Previously `sm` (`h-9`).
- `listbarPaddingX: "px-2"` and `tablePaddingX: "px-2"` in `decisions.json` — list-view toolbar and table horizontal padding reduced from 24 px to 8 px.
- `artifacts/amortization/custom/HeaderSidebar.jsx` — outer `rounded-2xl border bg-white shadow-sm` card wrapper removed; the sidebar `border-l` divider from `sidebarClassName` makes the wrapper border redundant.
- `whiteFormBackground: true` in `decisions.json` — forces white background on form inputs and textareas, overriding the `bg-[#F5F7F9]` default on inputs and `bg-background` on textareas. Disabled textareas use `opacity-50` instead of `bg-muted/50` for visual consistency.
- `noHeaderBorder: true` in `decisions.json` — removes the rounded card border around the header form fields, matching the Contacts window layout.
- `primaryTabsVariant: "pill"` in `decisions.json` — tab strip uses pill style, matching Contacts.
- `tabsBarPaddingX: "px-2"` in `decisions.json` — tabs bar horizontal padding set to 8 px.
- `toolbarPaddingX: "px-2"` in `decisions.json` — toolbar horizontal padding set to 8 px.

## Iteration backlog (out of current scope)

- Callout linking `amortizationPercentage` ↔ `amortizationAmount` so that editing one updates the other based on the asset's value.
- Read-only **Accounting** tab showing the resulting Fact_Acct entries.
- Bi-directional integration with the asset's amortization plan so that lines auto-populate from the plan.
