# Product

## Intent
Product lets a user maintain the commercial and inventory identity of an item, then continue into the product-specific surfaces that matter after the master record exists: pricing, stock visibility, transaction history, and the contract-backed child datasets attached to the selected product.

On `origin/develop`, the visible product page is still a generated route with custom surfaces embedded into it: a gallery list, a grouped `Additional Info` panel, a pricing footer, and a product-specific inventory sidebar.

## What this window should allow
- Browse products from the Inventory menu and recognize them quickly by image, name, search key, and category.
- Create or update the core product definition, including search key, name, description, product type, category, UOM, image, tax category, sale/purchase flags, stocked flag, weight, UOM for weight, attribute set, brand, lifecycle status, returnable flag, and UPC/EAN.
- Move between a main `General` tab and a separate `Additional Info` tab so commercial and logistics settings are grouped instead of mixed into one form.
- Review pricing from the footer area instead of leaving the product page.
- Inspect stock availability and stock movement context from the custom sidebar.
- Use the contract-backed product children and actions when the generated page exposes them, while treating the exact visible tab set beyond the custom surfaces as partially evidenced.

## Interaction model
- **Route:** `/product` and `/product/:recordId`.
- **Visibility:** visible from the `Inventory` section as `Product`.
- **Implementation type:** generated window route loaded through `tools/app-shell/src/windows/registry.js`, with product-specific custom surfaces embedded in the generated page: `ProductGallery`, `ProductAdditionalInfoPanel`, `ProductPriceBar`, and `ProductSidebar`.
- **Window shape:** master-child workspace. The selected product is the master entity, and product-related child datasets are attached to that record.

The list surface is gallery-based rather than a plain grid. Product cards show the image when one exists and fall back to a package icon when no image is available. Opening a record takes the user into a detail screen with two primary tabs: `General` and `Additional Info`.

The detail screen also changes the standard generated behavior in three visible ways:
- pricing is surfaced through a custom footer (`ProductPriceBar`)
- the sidebar is product-specific (`ProductSidebar`)
- print and the generic More menu are hidden

## Reactive behavior and dependencies
- **Master/child dependency:** the selected product drives price, stock, and transaction loading through `parentId=<productId>`.
- **Gallery/detail dependency:** selecting a product card in the gallery navigates into that product's detail route.
- **Additional Info grouping:** the `Additional Info` tab is a custom panel with two cards. `Commercial` groups `Tax Category`, `Sale`, and `Purchase`. `Logistics` groups `Stocked`, `Returnable`, `Weight`, and `UOM for Weight`.
- **Selector dependencies:** the current evidence shows selector-backed maintenance for category, tax category, UOM, UOM for weight, attribute set, brand, lifecycle status, warehouse, currency, characteristic, characteristic subset, storage bin, and price-list-version references where relevant.
- **Pricing footer states:**
  - When the product has not been saved yet, the footer shows a save-first message and blocks pricing maintenance.
  - When the product exists but has no price rows yet, the footer shows an empty state plus `Set Pricing`. That action opens an inline create mode with two draft cards labeled `Sales price` and `Purchase price`.
  - The initial create mode requires at least one entered amount, but it does not ask the user to choose a price list version. Repo evidence shows it resolves defaults from `/price/defaults` and then falls back to selector options automatically.
  - In that initial create mode, the footer posts a single price row. The `Sales price` draft becomes `standardPrice`, the `Purchase price` draft becomes `listPrice`, and if one side is left blank the code mirrors the entered value into the missing one before saving.
  - Once price rows exist, the footer switches to two summary tables: `Sales lists` and `Purchase lists`. The action changes from `Set Pricing` to `Edit Pricing` and opens a dialog.
  - Inside the dialog, added rows are split by sales-vs-purchase selector metadata, duplicate price-list-version rows are blocked, and staged adds/edits/deletes are only applied when `Save changes` is pressed.
  - Closing the dialog with unsaved changes triggers a confirmation overlay offering discard vs save.
- **Sidebar reactions:**
  - The inventory sidebar has two tabs: `Summary` and `Warehouses`.
  - `Summary` shows on-hand, available, and reserved stat cards with color changes based on stock conditions.
  - `Warehouses` shows a total on-hand callout plus per-warehouse cards with on-hand / available / reserved mini-stats.
  - A separate `Stock movement` card is only shown when transaction rows exist for the selected product.
  - The stock-movement card can expand into a modal with period switches (`1M`, `3M`, `6M`, `1Y`, `2Y`) and a warehouse-focused breakdown. Code-backed inference: when transactions exist but recent months are flat, the chart stays visible as a flat line anchored to current stock.
  - The Y-axis of the stock-movement chart formats values using the shared `formatDashboardAxisTick` utility from `@/lib/dashboardNumberFormat` (e.g. `2K`, `1.5M`), consistent with the Dashboard and Contact sidebar charts.
- **Defaults visible in the generated contract:** bill-of-materials line number defaults to the next line sequence, bill-of-materials quantity defaults to `1`, and product category defaults from the SQL default declared in the contract.

## Gap assessment
- The generated contract declares many child datasets and actions, but the inspected page code makes only the gallery, the two primary tabs, the pricing footer, and the product sidebar explicit. Treat the exact visible availability of every child surface beyond those areas as partially evidenced.
- The footer's initial `Set Pricing` flow hides which price list version is chosen. Users only see the drafted values, while the actual target list/version comes from defaults or selector fallback.
- Variant management, service/tax helper actions, and transaction-level manual cost adjustment remain declared in metadata, but the inspected page code does not make their live entry points explicit.
- `ProductDetailHeader.jsx` still returns `null`, so any richer standalone product header is not part of the current visible behavior.

## Manual verification
1. Open `/product` and confirm the list is a gallery of product cards rather than a flat table.
2. Verify product cards show the product image when present and fall back to the package icon when no image exists.
3. Open an existing product and confirm the detail surface exposes `General` and `Additional Info`.
4. In `Additional Info`, verify the `Commercial` card contains `Tax Category`, `Sale`, and `Purchase`, and the `Logistics` card contains `Stocked`, `Returnable`, `Weight`, and `UOM for Weight`.
5. Open `/product/new` and confirm the pricing footer says the product must be saved before pricing can be maintained.
6. For a saved product with no price rows, confirm the footer shows `Set Pricing`, enters the inline `Sales price` / `Purchase price` draft state, and saves successfully when at least one amount is provided.
7. After price rows exist, confirm the footer shows separate `Sales lists` and `Purchase lists` sections and that `Edit Pricing` opens the pricing dialog.
8. In the dialog, stage an edit or add/delete action, try closing it, and confirm the unsaved-changes overlay appears.
9. Confirm the sidebar exposes `Summary` and `Warehouses`, and that `Stock movement` only appears when the product has transaction history. When it appears, expand it and verify the period switches and warehouse drill-down.
10. If the business depends on BOM, costing, transactions, characteristics, stock, category price rule version, alternate UOM, or variant actions, verify which of those surfaces are actually visible in the running page. Current repo evidence does not fully prove all of them.

## Automated evidence
- Route registration and menu visibility are grounded in `tools/app-shell/src/windows/registry.js` and `tools/app-shell/src/menu.json`, which register `product` as a generated/custom window reachable from the Inventory section.
- Shared shell/route behavior is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`, especially the generated/custom window loading flow and the shared entity list/detail flow.
- Product-specific behavior is grounded in current code under `tools/app-shell/src/windows/custom/product/`:
  - `ProductGallery.jsx` for gallery browsing
  - `ProductAdditionalInfoPanel.jsx` for grouped commercial/logistics editing
  - `ProductPriceBar.jsx` for product pricing fetch/create/edit behavior. Unit prices and list prices shown in the pricing tables are formatted using the org's configured currency via `useCurrency()` and `formatCurrency()`, so the currency symbol reflects the organization's setting rather than a hardcoded value.
  - `ProductSidebar.jsx` for stock and transaction-driven sidebar summaries
- The generated product page at `artifacts/product/generated/web/product/ProductPage.jsx` wires those custom surfaces into the product window and declares the attached child CRUD endpoints.
- The product contract at `artifacts/product/contract.json` provides evidence for layout (`gallery`, sidebar layout, primary tabs), selectors, child entities, default values, and declared actions.
- `tools/app-shell/src/windows/custom/product/__tests__/ProductSidebar.test.js` verifies that `ProductSidebar` uses the shared `formatDashboardAxisTick` utility for Y-axis labels and does not define a local formatting function. Beyond that, automated evidence in this repo is structural and contract-backed rather than end-to-end proof of the full product workflow.

## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to the custom surfaces.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component. For this window the declared required fields are `searchKey`, `name`, `uOM`, `productCategory`, `taxCategory`, `purchase`, `sale`, `productType`, `stocked`, and `returnable` — making the existing required-field contract explicit in the generated page rather than relying on implicit form validation.
