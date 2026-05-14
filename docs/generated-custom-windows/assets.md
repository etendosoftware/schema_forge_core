# Assets

## Intent

The Assets window should let a finance user register fixed assets, define how each asset will depreciate or amortize over time, review the resulting amortization schedule, and inspect the accounting mappings that support depreciation posting and reporting.

## What this window should allow

- Create and maintain asset master records with core identity fields such as Search Key, Name, and Asset Category.
- Capture lifecycle and valuation context, including purchase date, depreciation start/end dates, asset value, residual value, and previously depreciated amounts.
- Decide whether the asset is depreciated at all, then configure the depreciation method:
  - depreciation type
  - calculation type
  - annual depreciation percentage for percentage-based setups
  - amortization frequency and usable life for time-based setups
- Review the amortization schedule for the asset through the Asset Amortization child surface.
- Review the accounting setup for the asset through the Accounting child surface, including the general ledger schema and the accumulated-depreciation/depreciation accounts.
- Trigger the visible amortization-generation action when depreciation is enabled.

## Interaction model

- Route: `/assets` for the list and `/assets/:recordId` for record detail.
- Visibility: visible from the Finance menu as **Assets**.
- Implementation type: generated window route with custom detail surfaces layered into the generated page (`AssetsConfigPanel`, `AssetsAmortizationPanel`, `AssetsSidebar`).
- Window shape: master-child. The master entity is `assets`; the child surfaces are `amortizationLine` and `assetAcct`.
- Detail layout: the detail page uses a sidebar layout, exposes an **Overview** tab plus a **Depreciation Setup** tab, and hides print, more-menu, more-details, and list-filter chrome.
- An **Attachments** tab is available in the detail tab strip, allowing files to be attached to the current record.
- List behavior: the list still exposes supported filters in the contract (`searchKey`, `name`, `assetCategory`, `depreciate`, `fullyDepreciated`), but the visible list-filter UI is intentionally hidden in the shell.

## Reactive behavior and dependencies

- Depreciation setup is explicitly state-driven:
  - When **Depreciate** is off, the depreciation-specific setup is not supposed to be shown.
  - When **Depreciate** is on, the window reveals depreciation type and calculation options.
  - When calculation type is **Percentage**, the setup emphasizes **Annual Depreciation %**.
  - When calculation type is **Time**, the setup reveals **Amortize** and then switches between **Usable Life - Years** and **Usable Life - Months** based on the chosen schedule.
- The asset category selector has a callout attached, so category selection is expected to drive or prefill related depreciation behavior. The repo evidence shows that dependency exists, but it does not fully document every value the callout changes.
- Currency defaults from `@C_Currency_ID@` and becomes read-only once amortization progress already exists (`depreciatedPlan` or `depreciatedValue` greater than zero), which indicates that key monetary context should stop changing after planning starts.
- The **Create Amortization** action is only exposed when the asset is marked as depreciated.
- The amortization footer panel and right sidebar both depend on the current asset record id. They fetch amortization lines with `parentId={assetId}` and sort them by `sEQNoAsset asc`, so the child schedule is expected to stay anchored to the selected asset and appear in sequence order.
- After a successful asset process event (`neo:processSuccess` for the current asset), the amortization footer re-fetches its lines. This is the clearest visible evidence that generating an amortization plan should refresh the schedule immediately in the detail view.
- The sidebar derives progress from the amortization lines plus the asset's `depreciatedValue` and `assetValue`, so summary cards should react as line totals and depreciated value evolve.
- In the Asset Amortization child surface, editable fields become read-only when the line is processed, which indicates that posted or finalized schedule lines should no longer be freely editable.
- In the Accounting child surface, selectors are exposed for general ledger, accumulated depreciation, and depreciation accounts. The current evidence shows selectable mappings, but no additional reactive cross-field behavior is visible.
- No totals, discounts, or tax-style recalculations are visible here beyond depreciation progress, planned amount totals, and sequence-based schedule refresh.

## Gap assessment

- The window clearly exposes depreciation inputs and a **Create Amortization** action, but the repo evidence does not prove the business correctness of the generated depreciation plan itself. The exact calculation rules, rounding behavior, and period generation outcomes should be treated as a gap until verified against a live backend.
- The asset-category callout implies dependency-driven defaulting, but the exact fields it mutates are not explicit in the current evidence. That remains an open ambiguity.
- The accounting child surface shows account mappings, but the current evidence does not prove whether those mappings are required before amortization generation, required before posting, or merely informational.
- The sidebar and footer infer completion/progress from line amounts and depreciated values, but there is no evidence here that those figures are reconciled to accounting postings or to a formal close process.
- The action endpoint for `processAsset` is wired as a classic process, but the success/failure outcomes exposed to the end user are not documented here beyond line refresh on success.
- The contract and generated code show no dedicated browser-level automation for this window, so user-facing behavior across setup, generation, and accounting review still depends on manual verification.

## Manual verification

1. Open `/assets` from the Finance menu and confirm the Assets list renders without visible list-filter, print, or more-menu chrome.
2. Open or create an asset and confirm the record starts with core setup fields such as Search Key, Name, and Asset Category.
3. Toggle **Depreciate** off and on and confirm the depreciation setup section appears only when depreciation is enabled.
4. Switch calculation type between percentage-based and time-based setups and confirm the window swaps the expected inputs:
   - percentage path shows **Annual Depreciation %**
   - time path shows **Amortize** and usable-life inputs
5. Save an asset with depreciation enabled and confirm the **Create Amortization** action is available.
6. Trigger **Create Amortization** against a live backend and confirm the amortization footer refreshes and shows ordered schedule rows.
7. Review the right sidebar and confirm depreciation summary metrics react to the loaded amortization lines.
8. Open the **Asset Amortization** child surface and confirm line ordering follows sequence number, with processed rows becoming non-editable.
9. Open the **Accounting** child surface and confirm the record exposes selectors for general ledger, accumulated depreciation, and depreciation accounts.
10. If amortization lines already exist, confirm the asset currency can no longer be edited.
11. Open a saved record and confirm the **Attachments** tab is visible in the tab strip. Upload a file and verify it appears in the table. Download it and delete it. When multiple files exist, confirm 'Download all (ZIP)' and 'Delete all' appear in the table header and that 'Delete all' shows a confirmation dialog before removing all files.

## Automated evidence

- `tools/app-shell/src/menu.json` exposes **Assets** in the Finance menu and routes the slug to `/assets`.
- `tools/app-shell/src/windows/registry.js` registers `assets` as a generated window route.
- `artifacts/assets/generated/web/assets/AssetsPage.jsx` wires the master/detail page, hides list-filter and print chrome, sets the detail sort to `sEQNoAsset asc`, adds the **Depreciation Setup** tab, and injects the custom sidebar and amortization footer.
- `artifacts/assets/contract.json` defines:
  - the `processAsset` action override as **Create Amortization** with display logic tied to `Depreciate`
  - display logic for depreciation fields
  - currency defaulting and read-only logic once amortization progress exists
  - child CRUD surfaces for `amortizationLine` and `assetAcct`
  - selector endpoints for asset category, currency, amortization, accounting schema, accumulated depreciation, and depreciation accounts
  - generated validation entries covering field presence, types, read-only/display logic, CRUD flags, and selector endpoints for the assets, amortizationLine, and assetAcct entities
- `tools/app-shell/src/windows/custom/assets/AssetsConfigPanel.jsx` implements the visible setup logic that switches fields based on depreciation and calculation choices. All field labels (currency, purchase/cancellation/depreciation dates, asset value, residual value, depreciation amount, and previously depreciated amount) are resolved through `useUI()` with keys registered in both `en_US` and `es_ES` locales.
- `tools/app-shell/src/windows/custom/assets/AssetsAmortizationPanel.jsx` fetches amortization lines by `parentId`, refreshes on `neo:processSuccess`, and shows planned totals/status. Monetary amounts in the amortization table and footer total are formatted using the org's configured currency via `useCurrency()` and `formatCurrency()`.
- `tools/app-shell/src/windows/custom/assets/AssetsSidebar.jsx` derives depreciation progress from the asset header plus amortization lines. The asset value and planned depreciation metric cards display amounts using the org's configured currency via `useCurrency()` and `formatCurrency()`.
- No assets-specific browser or component test file was found in `tools/app-shell/test` or `tools/app-shell/src/**/__tests__`, so the automated evidence is structural/code-backed rather than end-to-end behavioral proof.
- The generated `AssetsPage.jsx` includes `AttachmentsTab` in its `customTabs` prop, wired to the `A_Asset` AD table.

## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to this window.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component; this window has no required header fields so the array is empty and there is no behavioral change.
- LinesTable template updated in ETP-3908 to include the inline-editable add-row alignment fix. This window uses `linesLayout: "classic"` so the new template branch is dead code here — no behavioral change.
