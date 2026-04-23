# Purchases windows

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It stays focused on purchase-facing window behavior and does not repeat shared shell concerns such as authentication, generic route protection, embedded mode, or common `useEntity` loading semantics.

All five windows below are visible menu entries under **Purchases / Operations** in `tools/app-shell/src/menu.json`.

## Purchase Order

| Item | Value |
|---|---|
| Purpose / surface | Create, confirm, and follow vendor purchase orders from list view through line editing, receiving, invoicing, and related documents |
| Route | `/purchase-order`, `/purchase-order/:recordId` |
| Visibility | Visible in the Purchases menu |
| Implementation | Custom window override in `tools/app-shell/src/windows/registry.js` |

### Functional cues

- The contract declares a default-layout order header on `C_Order`, marks the window as `relatedDocuments: true`, hides delete when complete, hides print in the generic contract surface, and adds custom topbar slots (`PurchaseOrderActions`, `PurchaseOrderDraftChips`).
- The main child dataset is `lines` (`C_OrderLine`). The same contract also exposes `lineTax` and `paymentDetails` child datasets, so the order is not just a flat header form.
- The custom list view narrows the visible columns to document number, order date, business partner, document status, total gross amount, delivery status, and invoice status.
- The list accepts two meaningful entry filters:
  - `?DocStatus=<status>` pre-filters by document status.
  - `?filter=pendingDelivery` activates the custom quick filter that keeps only orders whose delivery progress is still below 100%.
- Opening a record keeps the generated detail flow but replaces the line table with a simplified purchase-order line surface: product, description, ordered quantity, unit price, discount, tax, and line gross amount.
- The custom topbar behavior changes with the document lifecycle:
  - **Draft (`DR`)**: save, confirm, delete, and print actions are exposed together.
  - **Confirmed (`CO`)**: the topbar switches to **Receive Goods** and **Create Invoice**, plus email and print icons.
- Confirmed orders also show two status pills in the header: **Delivery Status** and **Invoice Status**.
- The **Receive Goods** action deep-links to `/goods-receipt/new?fromOrder=<recordId>`.
- The **Create Invoice** action calls the order action endpoint and, on success, offers a direct jump to the new purchase invoice.
- The custom related-documents tab aggregates downstream **Goods Receipt**, **Purchase Invoice**, and **Payment Out** records and navigates directly to those windows.
- The list view supports cloning through the shared `CloneOrderModal`, so duplicated purchase orders are part of the current UX, not just a backend-only capability.

### Automation status

- I did not find a dedicated purchase-order UI test in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- There is one indirect automated clue at hook level: `tools/app-shell/src/hooks/__tests__/useEntity-defaults.test.js` exercises the defaults endpoint with the `/sws/neo/purchase-order` base URL, but that is not a window-specific render test.

### Manual verification

1. Open `/purchase-order` and confirm the list columns match the purchase-oriented custom set instead of the full generated table.
2. Open `/purchase-order?filter=pendingDelivery` and confirm fully delivered rows are excluded while partially delivered rows remain.
3. Open a draft record at `/purchase-order/:recordId` and confirm the draft action set is present: save, confirm, delete, and print.
4. Confirm the same order and verify the topbar switches to **Receive Goods** and **Create Invoice**, and that the delivery/invoice status pills become visible.
5. Click **Receive Goods** and confirm the browser lands on a goods-receipt creation route with `fromOrder=<recordId>` in the query string.
6. Click **Create Invoice** on a confirmed order and confirm the success toast offers navigation to the created purchase invoice.
7. Open the **Related Documents** tab on an order that already has receipts, invoices, or payments and confirm each chip routes to the linked window.

### Evidence

- `tools/app-shell/src/menu.json`
- `tools/app-shell/src/windows/registry.js`
- `artifacts/purchase-order/contract.json`
- `tools/app-shell/src/windows/custom/purchase-order/index.jsx`
- `tools/app-shell/src/windows/custom/purchase-order/PurchaseOrderActions.jsx`
- `tools/app-shell/src/windows/custom/purchase-order/PurchaseOrderTopbar.jsx`
- `tools/app-shell/src/windows/custom/purchase-order/RelatedDocuments.jsx`

## Goods Receipt

| Item | Value |
|---|---|
| Purpose / surface | Receive vendor goods, capture receipt lines, optionally import them from a purchase order, and follow linked purchasing documents |
| Route | `/goods-receipt`, `/goods-receipt/:recordId` |
| Visibility | Visible in the Purchases menu |
| Implementation | Custom window override in `tools/app-shell/src/windows/registry.js` |

### Functional cues

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

### Automation status

- I did not find a dedicated goods-receipt UI test in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).

### Manual verification

1. Open `/goods-receipt/:recordId` on a draft receipt and confirm the visible line columns are product, movement quantity, UOM, storage bin, and invoiced quantity.
2. Use a draft receipt with a selected business partner but no lines and confirm the empty state offers both **Add Lines** and **Import from Purchase Order**.
3. Import lines from a purchase order and confirm new receipt lines are created under the current receipt, including the purchase-order line linkage.
4. With lines already present, confirm the line-area extra action still exposes **Import from Purchase Order** while the document remains in draft.
5. Process or confirm the receipt and verify the status changes out of draft and the editable draft-only affordances disappear.
6. Open the **Related Documents** tab and confirm the purchase-order chip routes back to the source order and any invoice chips route to `/purchase-invoice/:id`.

### Evidence

- `tools/app-shell/src/menu.json`
- `tools/app-shell/src/windows/registry.js`
- `artifacts/goods-receipt/contract.json`
- `tools/app-shell/src/windows/custom/goods-receipt/index.jsx`
- `tools/app-shell/src/windows/custom/goods-receipt/GoodsReceiptBottomPanel.jsx`
- `tools/app-shell/src/windows/custom/goods-receipt/ImportFromPurchaseOrderModal.jsx`
- `tools/app-shell/src/windows/custom/goods-receipt/RelatedDocuments.jsx`

## Purchase Invoice

| Item | Value |
|---|---|
| Purpose / surface | Register supplier invoices, edit invoice lines, inspect payment state, and jump between the invoice, its purchase order, receipts, and payments |
| Route | `/purchase-invoice`, `/purchase-invoice/:recordId` |
| Visibility | Visible in the Purchases menu |
| Implementation | Custom window override in `tools/app-shell/src/windows/registry.js` |

### Functional cues

- The contract defines a default-layout invoice header on `C_Invoice`, marks the window as `relatedDocuments: true`, and exposes several child datasets: `lines`, `intrastat`, `paymentPlan`, and `paymentDetails`.
- The main invoice detail remains header-plus-lines, but the custom UI deliberately reshapes how users consume it:
  - the list view uses a compact custom table with document number, invoice date, business partner, status, and gross total
  - clicking a list row opens a preview modal instead of immediately navigating away
  - the detail route uses a custom topbar, bottom panel, custom related-documents tab, and a narrowed line table
- The list accepts two meaningful entry filters:
  - `?DocStatus=<status>` pre-filters the list by document status.
  - `?filter=overdue` activates the custom quick filter that keeps only invoices with a remaining outstanding amount.
- The preview modal is a notable custom surface. It includes **General**, **Messages**, and **History** tabs, exposes edit/send/download actions, fetches payment-plan and invoice-payment data, and shows invoice totals plus payment progress without leaving the list route.
- In the current implementation, **Messages** and **History** are placeholder empty states rather than backed conversation or audit feeds.
- The detail route uses a custom line table with product, invoiced quantity, net unit price, tax, and line gross amount.
- New lines are guarded until the invoice has a business partner (`addLineGuard`).
- The detail topbar exposes two notable custom behaviors:
  - **Clone** on record pages
  - a payment-status pill on completed invoices; clicking it opens the payment modal
- The bottom panel combines three functional surfaces in one place: related-document chips, inline notes editing, and subtotal/tax/total rollups.
- The custom related-documents component links to the source purchase order, sibling goods receipts, and payment-out records.
- The contract exposes payment-plan and payment-detail datasets, and the custom UI uses those datasets to power payment summaries and payment dialogs instead of relying on generic secondary tabs.

### Automation status

- I did not find a dedicated purchase-invoice UI test in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).

### Manual verification

1. Open `/purchase-invoice` and click a row. Confirm a preview modal opens from the list view instead of immediately navigating to the detail route.
2. In that preview modal, switch between **General**, **Messages**, and **History** and confirm only the General tab is data-backed today while the other two remain placeholder states.
3. Open `/purchase-invoice?filter=overdue` and confirm the quick filter keeps invoices with an outstanding balance.
4. From the preview modal, choose **Edit** and confirm the browser navigates to `/purchase-invoice/:recordId`.
5. On the detail route, confirm the line table uses the custom invoice columns and that adding a line is blocked until a business partner is selected.
6. On a completed invoice, click the payment-status pill and confirm the payment modal opens with invoice-specific payment context.
7. In the detail footer or related-documents tab, confirm linked chips route to the source purchase order, related goods receipts, and payment-out records.

### Evidence

- `tools/app-shell/src/menu.json`
- `tools/app-shell/src/windows/registry.js`
- `artifacts/purchase-invoice/contract.json`
- `tools/app-shell/src/windows/custom/purchase-invoice/index.jsx`
- `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceTopbar.jsx`
- `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceBottomPanel.jsx`
- `tools/app-shell/src/windows/custom/purchase-invoice/InvoicePreviewModal.jsx`
- `tools/app-shell/src/windows/custom/purchase-invoice/RelatedDocuments.jsx`

## Return to Vendor

| Item | Value |
|---|---|
| Purpose / surface | Create a vendor return order, pick returnable lines from prior receipts, and process the return through its order lifecycle |
| Route | `/return-to-vendor`, `/return-to-vendor/:recordId` |
| Visibility | Visible in the Purchases menu |
| Implementation | Generated window entry in `tools/app-shell/src/windows/registry.js` |

### Functional cues

- The contract defines a default-layout return order on `C_Order`, uses `returnReason` as the notes-oriented field, and advertises `relatedDocuments: true`.
- The header stays focused on the return authorization/order itself: vendor reference, order date, business partner, partner address, return reason, warehouse, payment method, payment terms, price list, and document status.
- Draft records expose two lifecycle-driving buttons:
  - **Pick/Edit Lines** (`RM_Pickfromreceipt`) while the record is still unprocessed
  - **Process Order** (`DocAction`, default `CO`) while the document is not voided or closed
- The main child dataset is `lines` (`C_OrderLine`); the contract also exposes `lineTax`.
- Return lines are receipt-driven rather than free-form. The contract ties each line back to a **Goods Receipt Line** (`M_Inoutline_ID`) and keeps core commercial fields such as return quantity, net/gross amounts, tax, and delivered quantity on the line.
- Most line fields are read-only in the current frontend contract, which matches the intended workflow: users pick receipt lines first, then process the return order instead of building the line payload from scratch in-grid.

### Automation status

- I did not find a dedicated return-to-vendor UI test in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).

### Manual verification

1. Open `/return-to-vendor/:recordId` on a draft record and confirm the header shows both **Pick/Edit Lines** and **Process Order**.
2. Use **Pick/Edit Lines** to bring lines from a prior receipt and confirm the generated line rows carry a **Goods Receipt Line** reference.
3. Verify the line surface shows the return quantity, tax/amount fields, and return reason context without exposing a completely free-form line editor.
4. Process the order and confirm the document status moves out of draft and the draft-only actions disappear or become unavailable.
5. If linked documents already exist, confirm the generated related-documents affordance is present and routes back to the relevant purchasing record set, because the contract explicitly marks this window as related-document capable.

### Evidence

- `tools/app-shell/src/menu.json`
- `tools/app-shell/src/windows/registry.js`
- `artifacts/return-to-vendor/contract.json`

## Return to Vendor Shipment

| Item | Value |
|---|---|
| Purpose / surface | Execute the physical outbound shipment for a vendor return after the return order exists |
| Route | `/return-to-vendor-shipment`, `/return-to-vendor-shipment/:recordId` |
| Visibility | Visible in the Purchases menu |
| Implementation | Generated window entry in `tools/app-shell/src/windows/registry.js` |

### Functional cues

- The contract defines a default-layout shipment on `M_InOut`, uses `description` as the notes field, and advertises `relatedDocuments: true`.
- The header centers on RMA vendor reference, business partner, partner address, movement date, accounting date, warehouse, description, document status, and two shipment-driving buttons.
- Draft records expose two lifecycle actions:
  - **Pick/Edit Lines** (`RM_Shipment_Pickedit`) while the shipment is still unprocessed
  - **Process Shipment** (`DocAction`, default `CO`) while the shipment is not closed or voided
- The main child dataset is `lines` (`M_InOutLine`).
- Shipment lines are downstream of the return order rather than independent receipt lines. The line contract includes a foreign-key reference back to the **Return to Vendor line** (`C_OrderLine_ID`), plus movement quantity, UOM, storage bin, product, description, and optional product-attribute values.
- Most operational line fields are read-only once surfaced, which matches a pick/process shipment flow rather than a manual free-form shipment builder.

### Automation status

- I did not find a dedicated return-to-vendor-shipment UI test in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).

### Manual verification

1. Open `/return-to-vendor-shipment/:recordId` on a draft record and confirm the header shows both **Pick/Edit Lines** and **Process Shipment**.
2. Use **Pick/Edit Lines** and confirm the resulting shipment lines reference the originating **Return to Vendor line**.
3. Verify the line surface shows movement quantity, product/UOM, and storage-bin context instead of a generic editable free-form shipment row.
4. Process the shipment and confirm the document status moves out of draft and the draft-only actions disappear or become unavailable.
5. If linked documents already exist, confirm the generated related-documents affordance is present and routes back to the return-order flow, because the contract explicitly marks this window as related-document capable.

### Evidence

- `tools/app-shell/src/menu.json`
- `tools/app-shell/src/windows/registry.js`
- `artifacts/return-to-vendor-shipment/contract.json`
