# Product

## Intent
Product lets a user maintain the commercial and inventory identity of an item, then continue into the product-specific surfaces that matter after the master record exists: pricing, stock visibility, transaction history, and the contract-backed child datasets attached to the selected product.

On `origin/develop`, the visible product page is still a generated route with custom surfaces embedded into it: a gallery list, a grouped `Additional Info` panel, a pricing tab, and a product-specific inventory sidebar.

## What this window should allow
- Browse products from the Inventory menu and recognize them quickly by image, name, search key, and category.
- Create or update the core product definition, including search key, name, description, product type, category, UOM, image, tax category, sale/purchase flags, stocked flag, weight, UOM for weight, attribute set, brand, lifecycle status, returnable flag, and UPC/EAN.
- Move between a main `General` tab and a separate `Additional Info` tab so commercial and logistics settings are grouped instead of mixed into one form.
- Review and edit pricing from a dedicated `Price` tab without leaving the product page. Pricing tables are entered via per-table pencil icons (one for Sales lists, one for Purchase lists) that open a focused dialog.
- Click a product image to open a lightbox for full-size inspection. Upload, replace, and remove the image from within the same field in the form grid.
- Inspect stock availability and stock movement context from the custom sidebar.
- Use the contract-backed product children and actions when the generated page exposes them, while treating the exact visible tab set beyond the custom surfaces as partially evidenced.

## Interaction model
- **Route:** `/product` and `/product/:recordId`.
- **Visibility:** visible from the `Inventory` section as `Product`.
- **Implementation type:** generated window route loaded through `tools/app-shell/src/windows/registry.js`, with product-specific custom surfaces embedded in the generated page: `ProductGallery`, `ProductAdditionalInfoPanel`, `ProductPriceBar`, and `ProductSidebar`.
- **Window shape:** master-child workspace. The selected product is the master entity, and product-related child datasets are attached to that record.

The list surface is gallery-based rather than a plain grid. Product cards show the image when one exists and fall back to a package icon when no image is available. Opening a record takes the user into a detail screen with two primary tabs: `General` and `Additional Info`.

The detail screen also changes the standard generated behavior in four visible ways:
- pricing is surfaced through a custom **Price** tab (`ProductPriceBar`), declared via `customPanelTabs` in `decisions.json`
- the sidebar is product-specific (`ProductSidebar`)
- print and the generic More menu are hidden
- both the **Price** tab and the **Attachments** tab are placed after the bottom primary tab strip (both use `customTabsAfterBottom: true`), so they are accessible without displacing the stock and sidebar surfaces that dominate the upper part of the detail page

The product image field is `inline: true` in `decisions.json`, which keeps it inside the four-column form grid spanning two rows (`row-span-2`) rather than rendering it separately above the form. The field renders with an upload button inside the container, a hover overlay with zoom and remove/replace actions, and a lightbox via a portal to `document.body` (ESC to close). When an image is present the cursor is `cursor-zoom-in`.

## Reactive behavior and dependencies
- **Master/child dependency:** the selected product drives price, stock, and transaction loading through `parentId=<productId>`.
- **Gallery/detail dependency:** selecting a product card in the gallery navigates into that product's detail route.
- **Additional Info grouping:** the `Additional Info` tab is a custom panel rendered as two-column row sections. Each row section has a left column (148 px wide) containing a section title and description, and a right column (`flex-1`) holding an `EntityForm`. The `Commercial` row groups `Tax Category`, `Sale`, and `Purchase`; an HR divider separates it from the `Logistics` row, which groups `Stocked`, `Returnable`, `Weight`, and `UOM for Weight`. The outer wrapper applies `[&_input]:bg-white` so all input fields, including `Weight`, render on a white background.
- **Selector dependencies:** the current evidence shows selector-backed maintenance for category, tax category, UOM, UOM for weight, attribute set, brand, lifecycle status, warehouse, currency, characteristic, characteristic subset, storage bin, and price-list-version references where relevant.
- **Pricing tab states:**
  - When the product has not been saved yet, the `Price` tab shows a save-first message and blocks pricing maintenance.
  - When the product exists but has no price rows yet, the tab shows an empty state plus `Set Pricing`. That action opens an inline create mode with two cards labeled `Sales price` and `Purchase price`. Each card has two inputs: `Unit price` and `List price`.
  - The initial create mode requires at least one entered amount across all four inputs, but it does not ask the user to choose a price list version. `ProductPriceBar` resolves the sales price list version (`salesPriceList = true`) and the purchase price list version (`salesPriceList = false`) automatically: it reads `/price/defaults`, routes that default to the matching side, then fills any missing side from the selector catalog and finally from `/price/selectors/<column>`.
  - Each side is saved as an independent `M_ProductPrice` row in its own price list version. The sales card maps to the sales-flagged version; the purchase card maps to the purchase-flagged version. Within a single row, when only `Unit price` or `List price` is provided, the missing column falls back to the entered one so `standardPrice`, `listPrice` and `priceLimit` stay consistent. If the user leaves an entire side blank, **no row is created for that side** — values are never replicated across sales and purchase.
  - Once price rows exist, the tab switches to two summary tables: `Sales lists` and `Purchase lists`. Each table header carries a pencil icon; clicking the pencil for `Sales lists` opens `PricingDialog` with `focusedSection="sales"`, and clicking the pencil for `Purchase lists` opens it with `focusedSection="purchase"`. The dialog shows only the relevant section rather than both at once.
  - Inside the dialog, added rows are split by sales-vs-purchase selector metadata, duplicate price-list-version rows are blocked, and staged adds/edits/deletes are only applied when `Save changes` is pressed.
  - Selector catalogs are not eagerly loaded (see `useCatalogs`), so the dialog lazily fetches the available price list versions from `/price/selectors/<column>` on first open. While the fetch is in flight, the add-row dropdown is disabled and shows the loading label.
  - Closing the dialog with unsaved changes triggers a confirmation overlay offering discard vs save.
- **Sidebar reactions:**
  - The inventory sidebar has two tabs: `Summary` and `Warehouses`.
  - `Summary` shows on-hand, available, and reserved stat cards. Stat card values are `text-xl` with `p-3` padding and `text-xs` subtitles. The `Available` and `Reserved` stat cards are hidden when `reserved === 0` to reduce visual noise in products that are never reserved.
  - `Warehouses` shows a total on-hand callout plus per-warehouse cards with on-hand / available / reserved mini-stats.
  - A horizontal divider separates the inventory overview section from the stock movement section.
  - A separate `Stock movement` card is only shown when transaction rows exist for the selected product.
  - The stock-movement chart uses smooth bezier curves (SVG cubic `C` command), dashed gridlines (`strokeDasharray="4,3"`), `vectorEffect="non-scaling-stroke"` to keep the line width crisp at all scales, and asymmetric horizontal padding (`PAD_X=36` for the left Y-label area, `PAD_R=8` on the right). The mini chart sets `preserveAspectRatio="none"` so it fills its container; the expanded modal uses the default `xMidYMid meet`. No permanent dot is shown on the line — the hover dot appears only on mouse interaction.
  - An "Expand" link (rendered with the `ExternalLink` icon from lucide-react) sits below the chart title and opens the full modal.
  - The period-switch row (`1M`, `3M`, `6M`, `1Y`, `2Y`) uses a pill-style container: `bg-gray-100 rounded-xl p-1` wrapping buttons styled as `rounded-lg py-1.5`. The active period gets `bg-white text-gray-900 shadow-sm`, matching the Contacts sidebar pattern.
  - Code-backed inference: when transactions exist but recent months are flat, the chart stays visible as a flat line anchored to current stock.
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
4. In `Additional Info`, verify the `Commercial` section contains `Tax Category`, `Sale`, and `Purchase` in a right-side `EntityForm` with a section title and description on the left. Confirm an HR divider separates it from the `Logistics` section, which contains `Stocked`, `Returnable`, `Weight`, and `UOM for Weight`. All input backgrounds should be white.
5. Open `/product/new` and confirm the `Price` tab says the product must be saved before pricing can be maintained.
6. For a saved product with no price rows, confirm the `Price` tab shows `Set Pricing` and that the inline create state exposes four inputs: `Unit price` and `List price` for `Sales price`, and the same pair for `Purchase price`. Entering values only on one side must create just that row; entering values on both sides must create two separate rows in their respective price list versions.
7. After price rows exist, confirm the `Price` tab shows separate `Sales lists` and `Purchase lists` tables, each with a pencil icon in the table header. Click the pencil on `Sales lists` and verify the dialog opens showing only the sales section. Click the pencil on `Purchase lists` and verify the dialog opens showing only the purchase section.
8. In the dialog, stage an edit or add/delete action, try closing it, and confirm the unsaved-changes overlay appears.
9. Open a product with an image. Verify the image renders inside the form grid (not above it), spanning two rows alongside adjacent fields. Click the image and confirm the lightbox opens portal-rendered over the page. Press ESC and confirm the lightbox closes. Hover the image thumbnail in the form and confirm the overlay appears with zoom, remove, and replace actions.
10. Confirm the sidebar exposes `Summary` and `Warehouses`, and that `Stock movement` only appears when the product has transaction history. When it appears, verify the chart uses smooth curves, dashed gridlines, and a pill-style period-switch row. Click "Expand" below the chart title and verify the modal opens with the period switches and warehouse drill-down.
11. In `Summary`, confirm `Available` and `Reserved` stat cards are hidden when `reserved === 0`. Open a product that has reserved stock and confirm those cards are visible.
12. If the business depends on BOM, costing, transactions, characteristics, stock, category price rule version, alternate UOM, or variant actions, verify which of those surfaces are actually visible in the running page. Current repo evidence does not fully prove all of them.
13. Select the **Attachments** tab (sits alongside the **Price** tab after the primary tab strip). Upload a file, verify it shows up in the table with name, size, and upload date, and that downloading and deleting it work correctly. When multiple files exist, confirm "Download all (ZIP)" and "Delete all" appear and that "Delete all" prompts a confirmation dialog.

## Automated evidence
- Route registration and menu visibility are grounded in `tools/app-shell/src/windows/registry.js` and `tools/app-shell/src/menu.json`, which register `product` as a generated/custom window reachable from the Inventory section.
- Shared shell/route behavior is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`, especially the generated/custom window loading flow and the shared entity list/detail flow.
- Product-specific behavior is grounded in current code under `tools/app-shell/src/windows/custom/product/`:
  - `ProductGallery.jsx` for gallery browsing
  - `ProductAdditionalInfoPanel.jsx` for the two-column row layout with `Commercial` and `Logistics` sections and HR divider between them
  - `ProductPriceBar.jsx` for product pricing fetch/create/edit behavior. Unit prices and list prices shown in the pricing tables are formatted using the org's configured currency via `useCurrency()` and `formatCurrency()`. `PricingDialog` accepts a `focusedSection` prop (`"sales"` or `"purchase"`) that controls which table is shown.
  - `ImageField.jsx` was fully redesigned for ETP-4190: upload button inside the container, hover overlay with zoom icon and remove/replace actions, lightbox via `createPortal(document.body)` with ESC-to-close, `cursor-zoom-in` when an image exists.
  - `ProductSidebar.jsx` for stock and transaction-driven sidebar summaries, including pill-style period tabs, bezier-curve SVG chart, dashed gridlines, expand link, smaller stat cards, conditional visibility of `Available`/`Reserved` cards, and divider between sections.
- The generated product page at `artifacts/product/generated/web/product/ProductPage.jsx` wires those custom surfaces into the product window and declares the attached child CRUD endpoints.
- The product contract at `artifacts/product/contract.json` provides evidence for layout (`gallery`, sidebar layout, primary tabs), selectors, child entities, default values, and declared actions.
- `artifacts/product/decisions.json` declares:
  - `customPanelTabs` — registers `ProductPriceBar` as the `Price` tab alongside `Attachments`
  - `attachments: true` and `customTabsAfterBottom: true` — positions both tabs after the primary tab strip
  - `inline: true` on the image field — keeps the image inside the four-column form grid
  - `labelOverrides` — overrides `M_Product_Category_ID` to "Category"/"Categoría" and `ProductType` to "Type"/"Tipo" using the locale-nested format `{ "en_US": {...}, "es_ES": {...} }`
  - `sidebarClassName`, `formCardPadding`, `toolbarPaddingX`, `tabsBarPaddingX`, `listbarPaddingX`, `tablePaddingX` — layout props for 30%-width sidebar with left border, 8px horizontal padding throughout
  - `primaryTabsVariant: "pill"` — pill-style primary tab bar
- `tools/app-shell/src/windows/custom/product/__tests__/ProductSidebar.test.js` verifies that `ProductSidebar` uses the shared `formatDashboardAxisTick` utility for Y-axis labels and does not define a local formatting function. Beyond that, automated evidence in this repo is structural and contract-backed rather than end-to-end proof of the full product workflow.

## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to the custom surfaces.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component. For this window the declared required fields are `searchKey`, `name`, `uOM`, `productCategory`, `taxCategory`, `purchase`, `sale`, `productType`, `stocked`, and `returnable` — making the existing required-field contract explicit in the generated page rather than relying on implicit form validation.
- LinesTable template updated in ETP-3908 to include the inline-editable add-row alignment fix. This window uses `linesLayout: "classic"` so the new template branch is dead code here — no behavioral change.

## Pipeline regeneration — ETP-4190

Updated on 2026-06-08 as part of the feature/ETP-4190 branch. Significant changes to custom surfaces; regeneration was required.

- `ProductPriceBar` promoted from a footer to a `customPanelTabs` entry named `Price`. The `attachments` tab also moved into the same `customPanelTabs` array so both tabs share the `customTabsAfterBottom: true` placement.
- `Edit Pricing` button replaced by per-table pencil icons. `PricingDialog` now accepts `focusedSection` to show only the sales or purchase section on open.
- Image field set to `inline: true` so it renders inside the four-column form grid. `ImageField.jsx` was replaced with a fully redesigned component including hover overlay, lightbox, upload, and remove/replace actions.
- Sidebar redesigned: smaller stat cards, conditional visibility of `Available`/`Reserved`, pill-style period tabs, bezier-curve chart with dashed gridlines and expand link, divider between inventory overview and stock movement.
- `ProductAdditionalInfoPanel.jsx` redesigned from card-based (`FieldGroup`) to two-column row layout with HR divider between `Commercial` and `Logistics`.
- New `decisions.json` keys: `labelOverrides`, `sidebarClassName`, `formCardPadding`, `toolbarPaddingX`, `tabsBarPaddingX`, `listbarPaddingX`, `tablePaddingX`, `primaryTabsVariant`.
