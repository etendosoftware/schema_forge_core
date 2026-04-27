# Price List

## Intent
This window lets a user maintain a price-list header and then manage the product prices attached to that price list.

On `origin/develop`, the generated contract was expanded to model `priceListVersion` and `productPrice`, but the user-visible SPA still routes the detail area through the custom `Product Price` workspace. In practice, the visible workflow is still: save the price-list header first, then manage product prices for the hidden version that the custom panel resolves for that header.

## What this window should allow
- Create, review, and update price-list headers.
- Identify whether a price list is sales-oriented, tax-inclusive, cost-based, and default.
- Open an existing price list and inspect the product prices associated with it.
- Add a product to the selected price list and define its `Unit Price` and `List Price`.
- Select an existing product-price row, edit the two visible price fields from the side panel, and delete the row when it is no longer needed.
- Search the header list by price-list name and the custom pricing area by product.

## Interaction model
- **Route:** `/price-list` and `/price-list/:recordId`.
- **Visibility:** visible from the `System` section in `tools/app-shell/src/menu.json`.
- **Implementation type:** custom window. `tools/app-shell/src/windows/registry.js` still registers both generated and custom loaders for `price-list`, and the custom loader takes precedence.
- **Window shape:** master-child. The visible master entity is `priceList`, but the visible detail area is not the generated `Price List Version` grid. The custom wrapper disables the generated detail entity and injects a custom `Product Price` workspace instead.

## Reactive behavior and dependencies
- The pricing area depends on the header being saved first. When the record has no persistent id yet, the UI shows a save-first message instead of allowing line maintenance.
- After the header exists, the custom panel fetches `/priceListVersion?parentId=<priceListId>` and uses only the first returned version. There is no visible version selector in the current SPA.
- If no hidden version exists yet, the UI shows an explicit empty state: product prices cannot be shown until that hidden version exists.
- Adding a row depends on that hidden version id. The add flow requires `Product`, `Unit Price`, and `List Price`, scopes the product selector with `parentId=<versionId>`, and posts `priceLimit: 0` together with the visible values.
- Selecting a row opens a `Price Detail` side panel with `Product` shown read-only and `Unit Price` / `List Price` editable. Saving or deleting from that panel refreshes the table immediately afterward.
- The merged generated contract now contains separate `priceListVersion` and `productPrice` entities, including version-level fields such as `Valid From Date`, `Price List Schema`, and `Base Version (Default)`, plus classic actions for `create` and `generatePriceListVersion`. The current custom wrapper suppresses those generated version surfaces, so those fields and actions are not visible from the live price-list page.

## Gap assessment
- The visible page still collapses all pricing work onto the first resolved hidden version. If a price list has multiple versions, current repo evidence shows no user-facing way to pick which version is being edited.
- `origin/develop` now models `productPrice` with additional generated fields such as `Cost` and `Algorithm`, but the custom workspace still exposes only `Product`, `Unit Price`, and `List Price`.
- The custom add flow still hardcodes `priceLimit: 0`. The current inspected code does not explain whether that is a business rule or just a technical default.
- The generated contract now declares version-level classic actions, but the current custom SPA does not surface any visible control for creating or generating price-list versions.

## Manual verification
1. Open `/price-list` from the `System` menu and confirm the list shows existing price lists.
2. Open `/price-list/new` and confirm the detail area says the price list must be saved before products can be managed.
3. Save a new price-list header and confirm the screen either resolves the custom product-pricing table or shows the explicit hidden-version warning.
4. Open `/price-list/<recordId>` for a record with product prices and confirm the detail area behaves as a custom `Product Price` workspace, not as a generated `Price List Version` grid.
5. Click `+ Add Product` and confirm the add row captures `Product`, `Unit Price`, and `List Price` only.
6. Select an existing row and confirm the `Price Detail` side panel shows read-only `Product` plus editable `Unit Price` and `List Price`, with save and delete actions.
7. If the backend contains multiple price-list versions for one header, confirm the page still exposes no version switcher. Repo evidence indicates the component uses only the first returned version.

## Automated evidence
- `origin/develop` commit `19f31dd4` regenerated the price-list window to add generated `priceListVersion` / `productPrice` entities and version-level actions.
- `origin/develop:tools/app-shell/src/windows/custom/price-list/index.jsx` keeps the user-visible page on the custom `Product Price` workspace by disabling the generated detail surface.
- `origin/develop:tools/app-shell/src/windows/custom/price-list/PriceListProductPrices.jsx` shows the visible behavior that still drives the page: save-first gating, first-version lookup, product-scoped add row, `Price Detail` side panel, and refresh-after-save/delete.
- `origin/develop:artifacts/price-list/contract.json` now defines `priceListVersion`, `productPrice`, their selectors, and the version-level classic actions that exist in generated metadata but are not exposed by the custom wrapper.
- `origin/develop:artifacts/price-list/generated/web/price-list/PriceListPage.jsx`, `PriceListVersionForm.jsx`, and `ProductPriceForm.jsx` show the regenerated baseline the custom wrapper is bypassing.