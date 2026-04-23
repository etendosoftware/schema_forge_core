# Product

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for Product.

- **Purpose / surface:** Product is the inventory master-data window for maintaining sellable or stockable items, then drilling into pricing, stock, characteristics, BOM, costing, and transaction history.
- **Route:** `/product`, `/product/:recordId`
- **Visibility:** Visible in the Inventory menu as **Product**.
- **Implementation type:** Generated route from `registry.js`, with custom product-specific panels embedded by the generated page.
- **Key functional cues:**
  - The contract declares `layoutType: "gallery"` with `sidebarLayout: true`, and the generated page uses `ProductGallery` for list browsing instead of a plain table.
  - The detail surface is explicitly tabbed: **General** plus **Additional Info**. The second tab is backed by `ProductAdditionalInfoPanel`.
  - The detail footer is replaced by `ProductPriceBar`, so pricing is a first-class detail task instead of a detached child table.
  - The detail screen hides print and the generic More menu (`hidePrint`, `hideMoreMenu`) and adds sidebar content through `ProductSidebar`.
  - The contract exposes multiple child datasets behind the product detail API: `price`, `priceRuleVersion`, `billOfMaterials`, `costing`, `transactionAdjustments`, `transactions`, `productCharacteristic`, `stock`, `categoryPriceRuleVersion`, and `alternateUom`.
  - Contract filters for the list are `searchKey`, `name`, `productCategory`, `productType`, and `uPCEAN`.
  - Contract-declared product actions include variant management, variant creation, invariant update, service-relation helpers, tax-copy helpers, and manual cost adjustment on transaction rows.
- **Manual verification:**
  1. Open `/product` and confirm the list uses a gallery-style card presentation rather than only a flat grid.
  2. Open any product record and confirm the detail screen exposes **General** and **Additional Info** tabs.
  3. In **Additional Info**, verify commercial/logistics fields such as Tax Category, Sale, Purchase, Stocked, Weight, and UOM for Weight are grouped separately from the main identity fields.
  4. In the detail footer, open the pricing surface and confirm sale/purchase prices can be reviewed or drafted after the product is saved.
  5. Confirm the sidebar shows stock/availability context and a transaction-trend surface for the selected product.
- **Automated evidence:** No product-specific browser or component test file was found for this window. Use the shared route/loading coverage in [app-shell-functional-flows.md](app-shell-functional-flows.md) for shell-level proof; product-specific panels exist in `tools/app-shell/src/windows/custom/product/` but are not covered by dedicated tests in this repo.
