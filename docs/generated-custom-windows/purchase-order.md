# Purchase Order

## Intent
This window should let a buyer prepare a supplier order, maintain its commercial header and line details, confirm it, and then follow the downstream procurement flow through receipts, purchase invoices, and payments.

The current evidence shows a purchase-order-specific experience rather than a generic generated order screen: the list is narrowed to purchasing signals, the detail page keeps the generated master-child layout, and the top bar adds procurement actions and follow-up status cues.

## What this window should allow
- Create a purchase order for a selected vendor with the key commercial header data: vendor, vendor address, order date, expected delivery date, document type, warehouse, payment method, payment terms, and price list.
- Add and maintain order lines with at least product, description, ordered quantity, unit price, discount, tax, and the resulting line gross amount.
- Review purchase progress from the order itself through delivery status, invoice status, related receipts, related purchase invoices, and linked payments.
- Confirm a draft order and, from the confirmation flow or later follow-up actions, create the operational documents that fulfill it.
- Clone an existing order and send the document from the top bar.
- Reactivate a confirmed order back to draft from the detail view kebab menu when the order status is `CO`.
- Complete multiple draft orders or reactivate multiple confirmed orders at once from the list selection bar using the bulk action, which calls `documentAction=CO` or `documentAction=RE` based on the status of the selected rows.

## Interaction model
- Route: `/purchase-order` for the list and `/purchase-order/:recordId` for the detail view.
- Visibility: visible from the Purchases menu.
- Implementation type: custom window override in `tools/app-shell/src/windows/registry.js`, with a custom list wrapper in `tools/app-shell/src/windows/custom/purchase-order/index.jsx` and a generated detail page that injects purchase-order-specific top-bar and related-document components from `artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx`.
- Window shape: master-child. The primary entity is the order header and the main child dataset is `lines`; the contract also exposes `lineTax` and `paymentDetails` child datasets.
- List interaction: the list view is tailored to procurement review and is now driven by `decisions.json` through the generated `HeaderTable` (the custom wrapper no longer hardcodes a column list). The visible columns, in order, are: Order Date, Document No., Business Partner, Document Status, Total Gross Amount, Invoice Status, and Delivery Status. It supports `?DocStatus=<status>` filtering and a `?filter=pendingDelivery` quick filter that keeps only orders whose delivery progress is still below 100%.
- Detail interaction: opening a record keeps the generated detail flow but swaps the visible lines table to a purchasing-focused subset of columns. The generated detail page also enables a related-documents tab.
- Top-bar interaction: on draft orders the detail page exposes confirmation, delete, clone, and send actions. On confirmed orders it computes whether receipt and/or invoice follow-up is still pending and exposes a management action accordingly; related draft/completion chips can also appear in the top bar.
- Form surface: the purchase order keeps `documentNo` (the internal document number) visible in both the grid and the form. The supplier-side `orderReference` (DB column `POReference`) field remains hidden from both the grid and the form, because procurement needs to reason about the company's own document number rather than the supplier's reference. An earlier iteration of this PR temporarily mirrored the purchase-invoice pattern (hide `documentNo`, expose supplier reference) but that change was reverted inside the same PR to preserve the internal-document-number behavior.

## Reactive behavior and dependencies
- Header-to-selector dependency is explicitly modeled for vendor addresses: `partnerAddress` is a dependent selector filtered by `businessPartner`, so the address choices should react to the selected vendor.
- Header defaults are partially evidenced in the contract: `orderDate` and `scheduledDeliveryDate` default to the current date, while `currency` is derived from context. The lines entity also derives `scheduledDeliveryDate`, `partnerAddress`, and `currency` from the parent context.
- Line defaults are also explicit in the contract: new lines start with ordered quantity `1`, discount `0`, and line gross amount `0` before the user edits values.
- The line surface mixes editable commercial inputs with read-only results. `orderedQuantity`, `unitPrice`, `discount`, and `tax` are editable, while `lineGrossAmount` is read-only. Pricing reacts to line edits via the `SL_Order_Amt` callout chain wired in the contract.
- Add-line product selection callout: when a user picks a product in the add-line row, the callout system must fire updates for `unitPrice`, `tax`, `uOM`, and `grossUnitPrice`. This is enabled by `forceCalloutFields: ["unitPrice","tax","uOM","grossUnitPrice"]` on the `product` field in `lines` in `decisions.json`. Without this declaration, the `touchedFieldsRef` guard in `DetailView.jsx` silences callout updates for fields the user never directly touched, leaving `tax` empty and `lineGrossAmount` at 0 after product selection.
- `netUnitPrice` derivation for gross price lists: when a callout returns `grossUnitPrice` without a corresponding `netUnitPrice`, `DetailView.jsx` derives `netUnitPrice = grossUnitPrice / (1 + taxRate/100)` using three sources in priority order: (A) `taxRate` injected as a synthetic field in the callout result by `NeoCalloutService.injectTaxRateIfPresent`, (B) `taxRateCacheRef` from previous callout responses, (C) the ratio `lineGrossAmount/lineNetAmount` from an existing line with the same tax. This ensures `lineGrossAmount` is correct in the add-line preview.
- Backend price list handling (`OrderLineHandler.java`): a `NeoHandler` CDI bean registered as `orderLineHandler` intercepts order-line CRUD requests. On POST (new line), it resets `grossUnitPrice` to `0` for net price lists (`isPriceIncludesTax=N`) before the CRUD runs, preventing the DB trigger `c_orderline_trg` from mistakenly using the product's `standardPrice` as a gross price. On PATCH (unit price edit), it detects when the trigger on a gross price list (`isPriceIncludesTax=Y`) produced the wrong `priceActual`, recomputes `grossUnitPrice = sentUnitPrice × (1 + taxRate/100)`, and flushes the correction within the same transaction. The same handler is shared with sales-order and sales-quotation via the same `javaQualifier`.
- Header totals and progress are status-driven rather than freeform. `grandTotalAmount`, `summedLineAmount`, `deliveryStatusPurchase`, and `invoiceStatus` are read-only contract fields, and the top bar uses confirmed-order data plus fetched receipts, invoices, and delivered quantities to decide whether receipt or invoice work is still pending.
- Confirmed-order follow-up is procurement-aware. The generated purchase-order actions fetch existing goods receipts, purchase invoices, and line delivery quantities, then drive follow-up actions from remaining quantity and remaining uninvoiced amount.
- The top bar also reacts to downstream state by showing draft or completion chips. Current evidence shows chips for draft receipts, draft invoices, all received, and all invoiced states.
- The related-documents tab aggregates downstream goods receipts, purchase invoices, and payment-out records and routes directly to those windows.
- The contract exposes `lineTax` and `paymentDetails`, but the current purchase-order-specific documentation evidence does not show custom interactions for editing those child datasets beyond their availability in the generated detail flow.

## Gap assessment
- Vendor-driven defaulting is only partially evidenced. The contract proves that vendor address is dependent on vendor selection, but it does not clearly prove whether choosing a vendor automatically defaults address, payment method, payment terms, price list, or warehouse in the current UI. Treat those behaviors as open ambiguities.
- Tax auto-fill after product selection works only for vendors with a Spanish billing address because `c_gettax` derives the tax zone from the address country. For vendors without a Spanish address, tax remains empty after product selection and must be set manually. This is a core AD constraint, not a UI gap.
- Downstream receipt and invoice creation is clearly part of the intent, but the current evidence does not fully describe business safeguards such as partial-receipt constraints, over-receipt prevention, or invoice quantity controls. Those remain open functional questions.
- The contract exposes payment-detail and line-tax child entities, yet the current purchase-order-specific evidence does not explain when a user should work with them directly from this window. Their role is available structurally but not functionally documented.
- The list and detail behavior are well evidenced, but there is no dedicated purchase-order render test in `tools/app-shell`, so the procurement-specific interactions still rely on manual verification.
- Label-override duplication is a known piece of technical debt. Because the custom list wrapper bypasses the generated `HeaderPage`, it carries its own `LABEL_OVERRIDES` constant that restates `C_BPartner_ID` as "Contacto", `DatePromised` as "Fecha de entrega esperada", and `DeliveryStatusPurchase` as "Estado de entrega" (overriding the default "Receipt Status"/"Estado del envío"). The same labels are also declared in `decisions.json` for the generated surfaces, so label changes have to be made in both places until the wrapper reuses the generated labels.

## Manual verification
1. Open `/purchase-order` and confirm the list shows exactly Order Date, Document No., Business Partner, Document Status, Total Gross Amount, Invoice Status, and Delivery Status in that order, and that legacy columns such as transaction document, warehouse, price list, and priority are no longer present.
2. Open `/purchase-order?filter=pendingDelivery` and confirm fully delivered orders are excluded while orders with remaining delivery progress stay visible.
3. Open a draft order at `/purchase-order/:recordId` and confirm the detail page allows line editing and exposes the draft top-bar actions for confirmation, deletion, cloning, and sending.
4. Confirm a draft order and verify the confirmation flow offers downstream procurement follow-up rather than only a status change.
5. Open a confirmed order with remaining receipt and/or invoice work and verify the top bar exposes the corresponding management action based on pending quantities or pending amount.
6. Open a confirmed order that already has draft receipts or a draft invoice and verify the top-bar chips link the user toward those downstream documents.
7. Open the Related Documents tab on an order with receipts, purchase invoices, or payments and verify each chip routes to the linked document window.
8. Open a confirmed purchase order detail and confirm the kebab menu exposes a `Reactivate` action. Trigger it and verify the document returns to draft status.
9. Select two or more draft purchase orders from the list and confirm the bulk-complete action is available. Trigger it and verify all selected orders move to confirmed status and a result toast appears.
10. Select two or more confirmed purchase orders and confirm the bulk-reactivate action is available. Trigger it and verify the orders return to draft status and a result toast appears.

## Automated evidence
- `tools/app-shell/src/components/contract-ui/BulkDocumentAction.jsx` provides the generic bulk action component; `artifacts/purchase-order/custom/PurchaseOrderReactivateBulkAction.jsx` re-exports it as the list selection bar entry for purchase orders, supporting both CO and RE based on selected row statuses.
- There is no dedicated purchase-order UI test covering the tailored list, detail top bar, or procurement follow-up flow in `tools/app-shell`.
- Shared shell and generic window-loading behavior are documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- One indirect automated clue exists at hook level: `tools/app-shell/src/hooks/__tests__/useEntity-defaults.test.js` verifies defaults fetching against the `/sws/neo/purchase-order` base URL, but it does not assert purchase-order-specific rendering or follow-up behavior.
- `artifacts/purchase-order/decisions.json` → `lines.product.forceCalloutFields` declares `["unitPrice","tax","uOM","grossUnitPrice"]`, which is the source of truth for the add-line callout bypass. The generated `HeaderPage.jsx` emits this into the `addLineFields` prop consumed by `DetailView.jsx`.
- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/OrderLineHandler.java` implements pre- and post-CRUD hooks shared by sales-order, purchase-order, and sales-quotation. The `javaQualifier = "orderLineHandler"` on the `lines` entity in `ETGO_SF_ENTITY` routes requests through this handler.
- Evidence reviewed for this document:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `tools/app-shell/src/windows/custom/purchase-order/index.jsx`
  - `artifacts/purchase-order/contract.json`
  - `artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx`
  - `artifacts/purchase-order/custom/PurchaseOrderActions.jsx` — the order confirmation modal displays the grand total and subtotal using the org's configured currency via `useCurrency()` and `formatCurrency()`.
  - `artifacts/purchase-order/custom/PurchaseOrderDraftChips.jsx`
  - `artifacts/purchase-order/custom/RelatedDocuments.jsx`
