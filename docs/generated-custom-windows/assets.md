# Assets

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It focuses on the Assets finance window exposed through the app shell.

- **Purpose / surface:** Maintain fixed assets, configure depreciation behavior, review amortization progress, and inspect accounting mappings from the visible **Finance** menu entry.
- **Route:** `/assets` and `/assets/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route with visible custom panels wired into the generated page.

## Key functional cues

- The page is intentionally more guided than a stock list/detail view. The generated page wires `AssetsAmortizationPanel` as a footer area, `AssetsConfigPanel` as a named primary tab, and `AssetsSidebar` as detail-side content.
- Window-level presentation is specialized: sidebar layout is enabled, print and more-menu affordances are hidden, the content background is customized, and the page hides list filters in the shell even though the table still defines filterable fields.
- The main record is `assets`; child surfaces are **Asset Amortization** (`amortizationLine`) and **Accounting** (`assetAcct`).
- The primary tabs are **Overview** and **Depreciation Setup**.
- The key business setup fields are **Search Key**, **Name**, **Asset Category**, **Depreciate**, **Depreciation Type**, **Calculate Type**, **Annual Depreciation %**, **Amortize**, **Usable Life - Years**, **Usable Life - Months**, and purchase/acquisition dates and values.
- The contract adds a positive asset process action. At window level it is presented as **Create Amortization**; the underlying field is `processAsset` / **Generate Amortization Plan**.
- List/search support targets `searchKey`, `name`, `assetCategory`, `depreciate`, and `fullyDepreciated`.
- Detail ordering for amortization lines is explicit: `sEQNoAsset asc`.

## Manual verification

1. Open `/assets` from the Finance menu and confirm the list loads without the usual list-filter chrome, print button, or more-menu affordances.
2. Create or edit an asset and confirm the base flow starts with **Search Key**, **Name**, and **Asset Category**.
3. Toggle **Depreciate** and confirm the depreciation-oriented setup becomes relevant in the **Depreciation Setup** tab.
4. Switch between depreciation calculation styles and confirm the visible inputs change accordingly:
   - percentage-based setup should emphasize **Annual Depreciation %**
   - time-based setup should emphasize **Amortize** and usable-life fields
5. On a saved asset, confirm the page shows the custom footer area, the right-side sidebar content, and the child surfaces for **Asset Amortization** and **Accounting**.
6. When depreciation is enabled, confirm the emphasized amortization action is available and review the resulting amortization rows in sequence order.

## Automated evidence

- No dedicated app-shell test file was found for `assets`.
- The repo does show concrete generated-page wiring for the custom footer, sidebar, and setup tab, which supports the functional expectations above.
- Use the shared guide for the common route and CRUD mechanics.
