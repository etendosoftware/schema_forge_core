# Goods Receipt

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It stays focused on goods-receipt-specific behavior and does not repeat shared shell concerns such as authentication, generic route protection, embedded mode, or common `useEntity` loading semantics.

- Purpose / surface: Receive vendor goods, capture receipt lines, optionally import them from a purchase order, and follow linked purchasing documents.
- Route: `/goods-receipt`, `/goods-receipt/:recordId`
- Visibility: Visible in the Purchases menu.
- Implementation: Custom window override in `tools/app-shell/src/windows/registry.js`.

## Key functional cues

- The contract defines a default-layout header on `M_InOut` plus a `goodsReceiptLine` child dataset on `M_InOutLine`.
- Header fields center on warehouse, business partner, partner address, movement/accounting dates, order reference, and document status. The contract also enables draft processing through `documentAction=CO`.
- The child line contract is operational rather than financial: product, movement quantity, UOM, storage bin, invoiced quantity, purchase-order line reference, and optional accounting dimensions.
- The custom detail view replaces the generated line table with a reduced receipt-focused table: product, movement quantity, UOM, storage bin, and invoiced quantity.
- The custom bottom panel adds two receipt-specific affordances:
  - a draft empty state with **Add Lines** and **Import from Purchase Order** actions
  - a draft detail action that keeps **Import from Purchase Order** available even after some lines already exist
- The import modal reads both open purchase orders for the same business partner and the existing receipt lines, then posts selected lines into the current receipt.
- The custom detail view also adds a **Related Documents** tab that links back to the originating purchase order and forward to linked purchase invoices.
- Unlike purchase order and purchase invoice, the contract itself does not advertise `relatedDocuments: true`; the related-documents behavior here comes from the custom window code.

## Manual verification

1. Open `/goods-receipt/:recordId` on a draft receipt and confirm the visible line columns are product, movement quantity, UOM, storage bin, and invoiced quantity.
2. Use a draft receipt with a selected business partner but no lines and confirm the empty state offers both **Add Lines** and **Import from Purchase Order**.
3. Import lines from a purchase order and confirm new receipt lines are created under the current receipt, including the purchase-order line linkage.
4. With lines already present, confirm the line-area extra action still exposes **Import from Purchase Order** while the document remains in draft.
5. Process or confirm the receipt and verify the status changes out of draft and the editable draft-only affordances disappear.
6. Open the **Related Documents** tab and confirm the purchase-order chip routes back to the source order and any invoice chips route to `/purchase-invoice/:id`.

## Automated evidence

- No dedicated goods-receipt UI test was found in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- Evidence sources:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `artifacts/goods-receipt/contract.json`
  - `tools/app-shell/src/windows/custom/goods-receipt/index.jsx`
  - `tools/app-shell/src/windows/custom/goods-receipt/GoodsReceiptBottomPanel.jsx`
  - `tools/app-shell/src/windows/custom/goods-receipt/ImportFromPurchaseOrderModal.jsx`
  - `tools/app-shell/src/windows/custom/goods-receipt/RelatedDocuments.jsx`
