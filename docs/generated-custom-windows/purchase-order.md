# Purchase Order

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It stays focused on purchase-order-specific behavior and does not repeat shared shell concerns such as authentication, generic route protection, embedded mode, or common `useEntity` loading semantics.

- Purpose / surface: Create, confirm, and follow vendor purchase orders from list view through line editing, receiving, invoicing, and related documents.
- Route: `/purchase-order`, `/purchase-order/:recordId`
- Visibility: Visible in the Purchases menu.
- Implementation: Custom window override in `tools/app-shell/src/windows/registry.js`.

## Key functional cues

- The contract declares a default-layout order header on `C_Order`, marks the window as `relatedDocuments: true`, hides delete when complete, hides print in the generic contract surface, and adds custom topbar slots (`PurchaseOrderActions`, `PurchaseOrderDraftChips`).
- The main child dataset is `lines` (`C_OrderLine`). The same contract also exposes `lineTax` and `paymentDetails` child datasets, so the order is not just a flat header form.
- The custom list view narrows the visible columns to document number, order date, business partner, document status, total gross amount, delivery status, and invoice status.
- The list accepts two meaningful entry filters:
  - `?DocStatus=<status>` pre-filters by document status.
  - `?filter=pendingDelivery` activates the custom quick filter that keeps only orders whose delivery progress is still below 100%.
- Opening a record keeps the generated detail flow but replaces the line table with a simplified purchase-order line surface: product, description, ordered quantity, unit price, discount, tax, and line gross amount.
- The custom topbar behavior changes with the document lifecycle:
  - Draft (`DR`): save, confirm, delete, and print actions are exposed together.
  - Confirmed (`CO`): the topbar switches to **Receive Goods** and **Create Invoice**, plus email and print icons.
- Confirmed orders also show two status pills in the header: **Delivery Status** and **Invoice Status**.
- The **Receive Goods** action deep-links to `/goods-receipt/new?fromOrder=<recordId>`.
- The **Create Invoice** action calls the order action endpoint and, on success, offers a direct jump to the new purchase invoice.
- The custom related-documents tab aggregates downstream **Goods Receipt**, **Purchase Invoice**, and **Payment Out** records and navigates directly to those windows.
- The list view supports cloning through the shared `CloneOrderModal`, so duplicated purchase orders are part of the current UX, not just a backend-only capability.

## Manual verification

1. Open `/purchase-order` and confirm the list columns match the purchase-oriented custom set instead of the full generated table.
2. Open `/purchase-order?filter=pendingDelivery` and confirm fully delivered rows are excluded while partially delivered rows remain.
3. Open a draft record at `/purchase-order/:recordId` and confirm the draft action set is present: save, confirm, delete, and print.
4. Confirm the same order and verify the topbar switches to **Receive Goods** and **Create Invoice**, and that the delivery/invoice status pills become visible.
5. Click **Receive Goods** and confirm the browser lands on a goods-receipt creation route with `fromOrder=<recordId>` in the query string.
6. Click **Create Invoice** on a confirmed order and confirm the success toast offers navigation to the created purchase invoice.
7. Open the **Related Documents** tab on an order that already has receipts, invoices, or payments and confirm each chip routes to the linked window.

## Automated evidence

- No dedicated purchase-order UI test was found in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- There is one indirect automated clue at hook level: `tools/app-shell/src/hooks/__tests__/useEntity-defaults.test.js` exercises the defaults endpoint with the `/sws/neo/purchase-order` base URL, but that is not a window-specific render test.
- Evidence sources:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `artifacts/purchase-order/contract.json`
  - `tools/app-shell/src/windows/custom/purchase-order/index.jsx`
  - `tools/app-shell/src/windows/custom/purchase-order/PurchaseOrderActions.jsx`
  - `tools/app-shell/src/windows/custom/purchase-order/PurchaseOrderTopbar.jsx`
  - `tools/app-shell/src/windows/custom/purchase-order/RelatedDocuments.jsx`
