# Price List

This window-specific guide complements `app-shell-functional-flows.md`. Use the shared guide for authenticated shell behavior, generic `/:windowName` loading, and shared list/detail data behavior.

- **Purpose and surface:** Maintains price-list headers plus per-product pricing. The visible header form exposes `Name`, `Currency`, `Sales Price List`, `Price list based on cost`, `Price includes Tax`, and `Default`.
- **Route:** `/price-list` and `/price-list/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `tools/app-shell/src/menu.json`.
- **Implementation type:** Custom window. `tools/app-shell/src/windows/registry.js` declares both a generated loader and a custom loader for this slug, and the custom loader wins.
- **Key functional cues:**
  - The current contract defines a header entity (`priceList`) plus a child entity (`priceListLine`), searchable by `name` and `product` respectively.
  - The custom wrapper does not follow the stock generated child-grid flow. It wraps the generated app, disables the generated `detailEntity`, and injects a custom `Product Price` workspace instead.
  - That workspace resolves the hidden price-list version first and then manages `productPrice` rows with `Product`, `Unit Price`, and `List Price` columns.
  - Unsaved headers show a save-first message. Saved headers without a hidden version show an explicit empty state instead of a broken child grid.
  - The current contract declares no process/action endpoints for this window.
- **Manual verification:**
  1. Open `/price-list` and confirm the list shows existing price lists.
  2. Open `/price-list/new` and confirm the detail area asks you to save the header before managing products.
  3. Open `/price-list/<recordId>` and confirm the record shows a custom **Product Price** area rather than the stock generated line table.
  4. On a saved record with a hidden version, add a product and confirm `Product`, `Unit Price`, and `List Price` appear in the table.
  5. Select a product-price row, update the two price fields in the side panel, save, then delete the row and confirm the table refreshes.
  6. On a saved record without a hidden version, confirm the screen shows the explicit empty-state warning instead of failing silently.
- **Automated evidence:** `artifacts/price-list/contract.json` includes schema-level checks for both `priceList` and `priceListLine`, including searchable filter coverage for `product`. There is no dedicated SPA test for the custom wrapper or its side-panel editing flow.