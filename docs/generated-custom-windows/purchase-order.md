# Purchase Order

## Intent

This window should let a buyer prepare a supplier order, maintain its commercial header and line details, confirm it, and then follow the downstream procurement flow through receipts, purchase invoices, and payments.

The current evidence shows a purchase-order-specific experience rather than a generic generated order screen: the list is narrowed to purchasing signals, the detail page keeps the generated master-child layout, and the top bar adds procurement actions and follow-up status cues.

## What this window should allow

- Create a purchase order for a selected vendor with the key commercial header data: vendor, vendor address, order date, scheduled delivery date, payment method, payment terms, and price list.
- Start a new unsaved order with visible `Save`, `Save draft`, and `Cancel` controls while the order-line tab is already available before the first save.
- Add and maintain order lines with at least product, description, ordered quantity, unit price, discount, tax, and the resulting line gross amount.
- Review purchase progress from the order itself through delivery status, invoice status, related receipts, related purchase invoices, and linked payments.
- Confirm a draft order and, from the confirmation flow or later follow-up actions, create the operational documents that fulfill it.
- Clone an existing order and send the document from the top bar.

## Interaction model

- Route: `/purchase-order` for the list and `/purchase-order/:recordId` for the detail view.
- Visibility: visible from the Purchases menu.
- Implementation type: custom window override in `tools/app-shell/src/windows/registry.js`, with a custom list wrapper in `tools/app-shell/src/windows/custom/purchase-order/index.jsx` and a generated detail page that injects purchase-order-specific top-bar and related-document components from `artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx`.
- Window shape: master-child. The primary entity is the order header and the main child dataset is `lines`; the contract also exposes `lineTax` and `paymentDetails` child datasets.
- List interaction: the list view is tailored to procurement review and shows document number, order date, business partner, document status, total gross amount, delivery status, and invoice status. It supports `?DocStatus=<status>` filtering and a `?filter=pendingDelivery` quick filter that keeps only orders whose delivery progress is still below 100%.
- Detail interaction: opening a record keeps the generated detail flow but swaps the visible lines table to a purchasing-focused subset of columns. The generated detail page also enables a related-documents tab.
- New-record behavior evidenced by Playwright coverage: opening `New Order` should immediately show the header form, the order-line tab, and `Save` / `Save draft` / `Cancel` controls without forcing a first intermediate save.
- Top-bar interaction: on draft orders the detail page exposes confirmation, delete, clone, and send actions. On confirmed orders it computes whether receipt and/or invoice follow-up is still pending and exposes a management action accordingly; related draft/completion chips can also appear in the top bar.

## Reactive behavior and dependencies

- Header-to-selector dependency is explicitly modeled for vendor addresses: `partnerAddress` is a dependent selector filtered by `businessPartner`, so the address choices should react to the selected vendor.
- Header visibility changed in the merged code: `paymentTerms` is now exposed as a visible principal-section selector in the generated purchase-order header form, next to the already visible scheduled delivery date, payment method, and price list.
- Header defaults are partially evidenced in the contract: `orderDate` and `scheduledDeliveryDate` default to the current date, while `currency` is derived from context. The lines entity also derives `scheduledDeliveryDate`, `partnerAddress`, and `currency` from the parent context.
- Line defaults are also explicit in the contract: new lines start with ordered quantity `1`, discount `0`, and line gross amount `0` before the user edits values.
- The line surface mixes editable commercial inputs with read-only results. `orderedQuantity`, `unitPrice`, `discount`, and `tax` are editable, while `lineGrossAmount` is read-only. That indicates pricing should react to line edits, but the current UI evidence does not show the recalculation mechanics directly.
- Save behavior is status-sensitive in the generated detail page. New drafts expose `Save` and `Save draft`, but `HeaderPage` hides save controls for `CO`, `CL`, and `VO` statuses through `hideSaveStatuses`.
- Header totals and progress are status-driven rather than freeform. `grandTotalAmount`, `summedLineAmount`, `deliveryStatusPurchase`, and `invoiceStatus` are read-only contract fields, and the top bar uses confirmed-order data plus fetched receipts, invoices, and delivered quantities to decide whether receipt or invoice work is still pending.
- Confirmed-order follow-up is procurement-aware. The generated purchase-order actions fetch existing goods receipts, purchase invoices, and line delivery quantities, then drive follow-up actions from remaining quantity and remaining uninvoiced amount.
- The top bar also reacts to downstream state by showing draft or completion chips. Current evidence shows chips for draft receipts, draft invoices, all received, and all invoiced states.
- The related-documents tab aggregates downstream goods receipts, purchase invoices, and payment-out records and routes directly to those windows.
- The contract exposes `lineTax` and `paymentDetails`, but the current purchase-order-specific documentation evidence does not show custom interactions for editing those child datasets beyond their availability in the generated detail flow.

## Gap assessment

- Vendor-driven defaulting is still only partially evidenced. The contract proves that vendor address is dependent on vendor selection, but it does not clearly prove whether choosing a vendor automatically defaults address, payment method, payment terms, price list, or warehouse in the current UI. Treat those behaviors as open ambiguities.
- Price and tax recalculation is implied by the editable commercial fields and read-only totals, but the current code reviewed for this document does not make the recalculation behavior explicit at the purchase-order-specific UI layer. The exact reaction timing and whether header totals update immediately should be treated as a gap in observed evidence.
- Downstream receipt and invoice creation is clearly part of the intent, but the current evidence does not fully describe business safeguards such as partial-receipt constraints, over-receipt prevention, or invoice quantity controls. Those remain open functional questions.
- The contract exposes payment-detail and line-tax child entities, yet the current purchase-order-specific evidence does not explain when a user should work with them directly from this window. Their role is available structurally but not functionally documented.
- The save-control hiding for completed/closed/voided orders is grounded in generated code, but there is no purchase-order browser test that exercises those status transitions directly. That still needs manual verification.

## Manual verification

1. Open `/purchase-order` and confirm the list shows the purchasing-focused columns instead of the full generated header table.
2. Open `/purchase-order?filter=pendingDelivery` and confirm fully delivered orders are excluded while orders with remaining delivery progress stay visible.
3. Open `New Order` and verify the header immediately exposes `Scheduled Delivery Date`, `Payment Method`, `Payment Terms`, and `Price List`, while `Save`, `Save draft`, `Cancel`, and the order-line tab are visible before the first save.
4. Select a vendor and verify the partner-address selector becomes enabled and scoped to that vendor.
5. Confirm a draft order and verify the confirmation flow offers downstream procurement follow-up rather than only a status change.
6. Open a confirmed order with remaining receipt and/or invoice work and verify the top bar exposes the corresponding management action based on pending quantities or pending amount.
7. Open a confirmed order that already has draft receipts or a draft invoice and verify the top-bar chips link the user toward those downstream documents.
8. Open a completed, closed, or voided order and verify the save controls are hidden.
9. Open the Related Documents tab on an order with receipts, purchase invoices, or payments and verify each chip routes to the linked document window.

## Automated evidence

- There is no dedicated purchase-order UI test covering the tailored list, detail top bar, or procurement follow-up flow in `tools/app-shell`.
- Shared shell and generic window-loading behavior are documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- `origin/develop:artifacts/purchase-order/generated/web/purchase-order/HeaderForm.jsx` at merge commit `36f10538` proves that `paymentTerms` is now a visible principal-section selector in the generated header form.
- `origin/develop:artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx` at `36f10538` proves `hideSaveStatuses={['CO','CL','VO']}` on the detail page.
- `artifacts/purchase-order/contract.json` proves dependent selectors, visible payment-terms selector endpoints, default values, read-only totals, and downstream child entities.
- `artifacts/purchase-order/custom/PurchaseOrderActions.jsx` proves the procurement-specific follow-up logic for receipts and invoices.
- `artifacts/purchase-order/custom/PurchaseOrderDraftChips.jsx` proves the draft/completion chip behavior for downstream procurement documents.
- `artifacts/purchase-order/custom/RelatedDocuments.jsx` proves goods-receipt, purchase-invoice, and payment related-document resolution.
- `e2e/tests/flows/purchase-order-create.spec.js` provides browser-level checks for the new-order `Save` / `Save draft` / `Cancel` controls, order-line-tab visibility before first save, and cancel-to-list navigation.
- `e2e/tests/flows/purchase-order-partner-address-bug.spec.js` provides browser-level evidence that the partner-address selector is expected to enable and offer vendor locations after business-partner selection.
