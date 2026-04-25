# Product

## Intent
Product should let a user maintain the commercial and inventory identity of an item, then continue into the related surfaces that usually matter after the master record exists: pricing, stock visibility, transaction history, bill of materials, costing, characteristics, and alternate units of measure.

In current repo evidence, this is not a narrow single-form maintenance screen. It is a multi-surface product workspace intended for browsing products visually, opening one record, and then working across product-specific detail panels and child datasets.

## What this window should allow
- Browse products from the Inventory menu and recognize them quickly by image, name, search key, and category.
- Create or update the core product definition, including search key, name, product type, category, UOM, image, tax category, sale/purchase flags, stocked flag, weight, UOM for weight, attribute set, brand, status, and UPC/EAN.
- Move between a main identity view and a separate Additional Info view so commercial and logistics settings are not mixed into a single crowded form.
- Review and maintain the product's main sales and purchase pricing from the detail footer instead of leaving the record for a separate pricing window.
- Inspect stock availability and stock movement context for the selected product from the custom sidebar.
- Work with product-related child datasets declared by the contract: price, price rule version, bill of materials, costing, transaction adjustments, transactions, characteristics, stock, category price rule version, and alternate UOM.
- Use product-related actions declared in the contract for variant management and service/tax helper flows when the UI exposes them.

## Interaction model
- Route: `/product`, `/product/:recordId`
- Visibility: visible from the Inventory menu as `Product`
- Implementation type: generated window route registered in `tools/app-shell/src/windows/registry.js`, with product-specific custom surfaces embedded in the generated page: `ProductGallery`, `ProductAdditionalInfoPanel`, `ProductPriceBar`, and `ProductSidebar`
- Window shape: master-child window. The product record is the master entity, and multiple child/product-related datasets are attached to the selected record.

The list surface is gallery-based rather than a plain grid. Product cards show image content when available and fall back to an icon when no image is present. Opening a record should take the user into a detail screen with two primary tabs: `General` and `Additional Info`.

The detail screen also changes the standard generated behavior in three visible ways:
- pricing is surfaced through a custom footer bar (`ProductPriceBar`)
- the sidebar is product-specific (`ProductSidebar`)
- print and the generic More menu are hidden by contract

## Reactive behavior and dependencies
- Master/child dependency: the selected product drives child data loading. Pricing, stock, and transactions are fetched with `parentId=<productId>`, so those surfaces should always react to the currently opened product.
- Gallery/detail dependency: selecting a product card in the gallery should navigate into that product's detail route.
- Tab behavior: `Additional Info` is not just a field reorder. It is a custom panel that groups commercial settings (`Tax Category`, `Sale`, `Purchase`) separately from logistics settings (`Stocked`, `Returnable`, `Weight`, `UOM for Weight`).
- Selector dependencies: product maintenance depends on reference selectors for category, tax category, UOM, UOM for weight, attribute set, brand, status, warehouse, currency, characteristic, characteristic subset, storage bin, and price list version where relevant.
- Pricing behavior:
  - the custom price bar separates existing rows into sales and purchase price lists
  - if no pricing exists yet, the user can draft initial sales and purchase prices directly in the footer
  - pricing creation tries to resolve defaults for `priceListVersion` and `priceList`, then falls back to selector options if defaults are unavailable
  - once price rows exist, the dialog supports add, edit, and delete flows for price-list-version rows
- Sidebar reactions:
  - stock totals react to stock rows for the selected product and summarize on-hand, reserved, and available quantities
  - warehouse distribution is aggregated from stock rows and shown in a warehouse-focused view
  - stock movement visualization depends on transaction history for the selected product and is only shown when transaction data exists
- Child-row defaults visible in current evidence:
  - bill-of-materials line number defaults to the next line sequence
  - bill-of-materials quantity defaults to `1`
  - product category defaults to the default category returned by the SQL default in the contract
- Totals, discount, and tax reactions: no product-level discount or tax-total recalculation behavior is visible in the current evidence. Tax handling is visible as master-data selection (`Tax Category`) and service/tax helper actions, not as live amount recalculation inside this window.
- Status-driven actions: variant/service/tax helper actions are declared in the product contract, and a manual cost adjustment action is declared on transaction rows, but the current repo evidence inspected here does not clearly show how those actions are surfaced in the live product UI.

## Gap assessment
- The product contract declares many child datasets, but the current product page evidence inspected here only makes the custom gallery, the two main tabs, the custom pricing footer, and the custom sidebar explicit. It is not clear from the inspected docs/code whether every declared child dataset is currently exposed as a visible child tab or panel in the shipped page.
- Variant management is clearly part of the business intent: the contract declares `manageVariants`, `createVariants`, and `updateInvariants`, and characteristic rows include `variant`, `definesPrice`, and related configuration fields. However, those action fields are marked discarded in the contract, and the inspected product page does not make their UI entry points explicit. Treat variant workflow support as partially evidenced, not fully confirmed.
- Costing and transaction-adjustment capabilities are only partially visible. The contract exposes costing data and a transaction-level manual cost adjustment action, but the inspected evidence does not clearly show whether users can trigger those flows from obvious product-window controls today.
- Stock is strongly represented in the sidebar and child entities, but no explicit stock validation or stock-driven blocking behavior is visible in current evidence. If the business expects stocked/non-stocked or warehouse-specific behavior to change other fields live, that dependency is not clearly shown here.
- Pricing support is explicit, but discount-specific or tax-derived pricing reactions are not visible. The current evidence supports price-list maintenance, not broader promotional or tax-calculation logic inside the product window.
- The custom `ProductDetailHeader` file currently returns `null` and is effectively replaced by the sidebar layout. If stakeholders expect a richer product header summary, that is not part of the current visible behavior.

## Manual verification
1. Open `/product` and confirm the list is a gallery of product cards, not only a flat table.
2. Verify product cards show image content when present and still remain usable when no image is available.
3. Open an existing product and confirm the detail surface exposes `General` and `Additional Info`.
4. In `Additional Info`, verify the commercial group contains Tax Category, Sale, and Purchase, and the logistics group contains Stocked, Returnable, Weight, and UOM for Weight.
5. In the footer, verify pricing is available through the custom pricing bar and that sales and purchase price lists are separated.
6. For a product with no price rows, confirm the window allows entering initial sales and/or purchase pricing only after the product record exists.
7. Confirm the sidebar reacts to the selected product by showing inventory overview figures and, when transaction history exists, stock movement visualization.
8. If child tabs/panels for BOM, costing, transactions, characteristics, stock, category price rule version, and alternate UOM are expected, verify which of them are actually visible in the running window and record any missing surfaces as implementation gaps.
9. If the business relies on variant actions or service/tax helper actions, verify whether those actions are reachable from the product UI; current repo evidence leaves that ambiguous.

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
- No dedicated product browser test or product-specific component test was found in the inspected test files. Automated evidence in this repo is therefore structural and contract-backed rather than end-to-end proof of the full product workflow.