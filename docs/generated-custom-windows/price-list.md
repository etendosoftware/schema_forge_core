# Price List

## Intent
This window should let a user maintain a price-list header and then manage product-specific selling prices that belong to that price list.

At header level, the current contract exposes the commercial definition of the list: `Name`, `Currency`, `Sales Price List`, `Price list based on cost`, `Price includes Tax`, and `Default`. At line level, the current custom experience focuses on assigning products and maintaining their `Unit Price` and `List Price` for the selected price list.

## What this window should allow
- Create, review, and update price-list headers.
- Identify whether a price list is sales-oriented, tax-inclusive, cost-based, and default.
- Open an existing price list and inspect the product prices associated with it.
- Add a product to the selected price list and define its `Unit Price` and `List Price`.
- Select an existing product-price row, adjust the two visible price values, and delete the row when it is no longer needed.
- Search the header list by price-list name and the child pricing area by product.

## Interaction model
- **Route:** `/price-list` and `/price-list/:recordId`.
- **Visibility:** Visible in `System > Settings`; the menu entry is present in `tools/app-shell/src/menu.json` and is not marked hidden.
- **Implementation type:** Custom window. `tools/app-shell/src/windows/registry.js` declares both generated and custom loaders for `price-list`, and the custom loader takes precedence.
- **Window shape:** Master-child. The header entity is `priceList`, but the visible child workspace is not the stock generated `priceListLine` table. The custom wrapper disables the generated detail entity and injects a custom `Product Price` workspace instead.

## Reactive behavior and dependencies
- The child pricing area depends on the header being saved first. When the record has no persistent id yet, the UI shows a save-first message instead of allowing product-price maintenance.
- After the header exists, the custom child workspace first resolves a hidden `priceListVersion` record using the header id. Product-price rows are then loaded with `parentId=<versionId>`. This means product pricing is functionally dependent on a hidden version layer, not directly on the visible header record alone.
- If no hidden version is found, the UI shows an explicit empty-state warning that product prices cannot be shown yet.
- Adding a product-price row depends on that hidden version being available. The add flow sends `priceListVersion`, `product`, `standardPrice`, `listPrice`, and a fixed `priceLimit: 0`.
- The product selector in the add flow is context-aware through `selectorContext={ parentId: versionId }`, so child-row operations are scoped to the resolved hidden version.
- Editing a selected row opens a side panel. Saving or deleting a row refreshes the child table afterward, so the visible prices react immediately to the operation.
- No totals, discounts, tax recalculations, status-driven actions, or parent-header-driven pricing reactions are visible in the current custom implementation. The header booleans exist in the contract, but current repo evidence does not show the SPA recalculating or propagating child prices when those flags change.

## Gap assessment
- The generated contract still describes a standard child entity `priceListLine` with `Product`, `List Price`, `Unit Price`, `Limit Price`, and read-only `UOM`, but the visible custom workspace actually reads and writes `productPrice` rows through a resolved `priceListVersion`. That mismatch is a material ambiguity in the current documented behavior.
- The visible custom child UI only exposes `Product`, `Unit Price`, and `List Price`. There is no visible support for editing `Limit Price` or viewing `UOM`, even though those fields are part of the generated line contract.
- The add flow hardcodes `priceLimit: 0`, but the current evidence does not explain whether that is a temporary implementation shortcut, an intended business rule, or a backend requirement.
- The business meaning of `Sales Price List`, `Price list based on cost`, `Price includes Tax`, and `Default` suggests downstream pricing behavior, but no current SPA evidence shows those flags propagating changes to product-price rows or enforcing exclusive/default rules. That expected pricing reaction remains a gap or open ambiguity.
- Hidden version creation and lifecycle are not visible in the current UI evidence. The window can detect that a version exists or does not exist, but the current code does not show how or when the required hidden version is created.
- There are no current process/action endpoints declared for this window, so any expected mass repricing, copy-from-other-list behavior, or propagation workflow is not evidenced here.

## Manual verification
1. Open `/price-list` and confirm the list shows existing price lists and supports opening a selected record.
2. Open `/price-list/new` and confirm the child workspace does not allow product pricing before the header is saved.
3. Save a new price-list header and confirm whether the screen either resolves a product-pricing workspace or shows the explicit missing-version message.
4. Open `/price-list/<recordId>` for a record that already has product prices and confirm the detail area is labeled and behaves as a custom `Product Price` workspace rather than the stock generated child grid.
5. Add a product-price row and confirm `Product`, `Unit Price`, and `List Price` are captured and the table refreshes after save.
6. Select an existing product-price row, change both visible price fields in the side panel, save, and confirm the refreshed row reflects the edit.
7. Delete a product-price row and confirm the table refreshes and the row disappears.
8. Change header flags such as `Price includes Tax` or `Price list based on cost` and verify whether any visible child-price recalculation happens; if nothing reacts, treat that as confirming the current documented gap.

## Automated evidence
- `artifacts/price-list/contract.json` defines the header entity `priceList` and the generated child entity `priceListLine`, including searchable coverage for `name` and `product`.
- `artifacts/price-list/generated/web/price-list/PriceListPage.jsx` shows the generated baseline is a normal master-child window using `priceList` and `priceListLine`.
- `tools/app-shell/src/windows/custom/price-list/index.jsx` overrides that generated detail flow by disabling the generated detail entity and injecting `PriceListProductPrices`.
- `tools/app-shell/src/windows/custom/price-list/PriceListProductPrices.jsx` provides the observable custom behavior: save-first gating, hidden `priceListVersion` lookup, `productPrice` CRUD, side-panel editing, and post-save/post-delete refresh.
- `tools/app-shell/src/windows/registry.js` and `tools/app-shell/src/menu.json` confirm the route is menu-backed and resolved through the custom window loader.
- There is no dedicated automated SPA test in the current repo that exercises the custom price-list wrapper, hidden-version path, or product-price side-panel behavior end to end.