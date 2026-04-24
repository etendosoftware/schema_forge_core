# Sales Order

## Intent

This window should let a user create, review, confirm, and manage sales orders from one workspace. The primary outcome is turning a customer request into an order whose lines, fulfillment progress, invoicing progress, and related commercial documents remain visible from the order itself.

## What this window should allow

- Create a new sales order with a business partner, partner address, order date, price list, and payment method before saving.
- Add and maintain order lines with product, description, ordered quantity, net unit price, discount, tax, and the resulting line gross amount.
- Review header-level commercial status from the list and detail views, including document status, shipment status, invoice status, total gross amount, and total net amount.
- Confirm a draft order, optionally create a shipment and/or draft invoice from the confirmation flow, send the order document, and clone an existing order.
- Manage follow-on work after confirmation by opening pending shipment or invoice flows, reviewing draft downstream documents, and canceling a completed order when the menu action is available.
- Inspect related quotation, shipments, invoices, and linked payments from the order detail page.

## Interaction model

- Route: `/sales-order` for the list and `/sales-order/:recordId` for record detail.
- Visibility: visible from the `Sales` menu group in `tools/app-shell/src/menu.json`; not hidden.
- Implementation type: custom window wrapper in `tools/app-shell/src/windows/custom/sales-order/index.jsx` over the generated `sales-order` detail/list page.
- Window shape: master-child. The header record is the primary entity and `lines` is the editable child entity.
- List behavior: the list columns are now driven by `decisions.json` through the generated `HeaderTable`. The visible columns, in order, are: Order Date, Document No., Business Partner, Document Status, Total Gross Amount, Invoice Status, and Delivery Status. The custom wrapper adds row cloning support and a `pendingDelivery` quick filter that keeps only rows where `deliveryStatus` is below 100. The Delivery Status column uses a sales-specific label override: `decisions.json` declares `labelOverrides.DeliveryStatus = "Delivery Status" / "Estado de entrega"` (mirrored in the wrapper's `LABEL_OVERRIDES`) to replace the default "Receipt Status"/"Estado del envío" label, which was shipment-oriented and wrong for sales.
- Detail behavior: the generated detail view uses the header form plus child line table/form, exposes a `Related Documents` custom tab, and adds order-specific top-bar actions.

## Reactive behavior and dependencies

- Header to line relationship: the detail view loads one header with editable child lines. Adding or changing lines is expected to refresh the header so totals and progress remain current, consistent with the shared `useEntity` child-refresh flow described in `app-shell-functional-flows.md`.
- Business partner dependency: `partnerAddress` is a dependent selector filtered by the chosen `businessPartner`, and the contract validation further restricts it to active shipping addresses. The current E2E flow explicitly checks that partner address stays disabled until a business partner is selected.
- Contact dependency: `userContact` is configured as dependent on `businessPartner`, and the custom record page wires inline contact creation through `CreateContactModal`, so contact selection can be extended without leaving the order.
- Pricing, discount, and tax reactions: the line contract assigns the same `SL_Order_Amt` callout to ordered quantity, net unit price, discount, gross price fields, and tax. That is direct evidence that price, discount, and tax changes are intended to recalculate monetary values. The visible UI evidence is the editable `discount`, `tax`, and `unitPrice` fields plus read-only `lineGrossAmount`, `summedLineAmount`, and `grandTotalAmount`.
- Defaulting: new headers default `orderDate` to the current date and start in draft status; new lines default ordered quantity to `1` and discount to `0`. Currency is derived from configuration in the contract, but it is not exposed as an editable field in the generated form.
- Status-driven actions: draft orders show confirm and send actions. Confirming can optionally create shipment and/or draft invoice documents. Completed orders switch to management actions that decide whether shipment and/or invoice work is still pending by comparing delivered quantities and invoiced totals against the order lines and header total.
- Fulfillment and invoicing reactions: completed-order chips and action modals derive shipment state from order-line `deliveredQuantity` and invoice state from invoices returned by `listInvoices`. Draft shipment chips navigate directly to the draft shipment, and draft invoice chips navigate directly to the draft invoice.
- Related-document dependencies: the related-documents tab resolves the originating quotation from the header, shipments by `salesOrder`, invoices via `listInvoices`, and payments through payment-plan/payment-detail links. If none exist, the UI explicitly shows `No related documents`.
- Address/invoice behavior ambiguity: the backend endpoint test expects `invoiceAddress` in detail payloads, and the contract includes it as a business-partner-dependent field, but `decisions.json` marks it discarded and the generated header form does not expose it. Current UI evidence therefore supports shipping/partner address selection but not direct invoice-address maintenance.

## Gap assessment

- Warehouse is treated as required by the backend contract and E2E detail selectors, but the generated header form currently hides it (`form: false`). That leaves an open question about how a user supplies or changes warehouse during order entry in the current UI.
- Payment terms, scheduled delivery date, invoice terms, and invoice address exist in backend/detail evidence but are discarded or hidden from the generated form. If the business process expects users to manage those sales-order semantics here, the current window does not clearly expose them.
- The confirm-and-create flow proves shipment and invoice creation endpoints are used, but there is no browser-level evidence that taxes, discounts, net totals, and gross totals visibly recalculate in real time after line edits. The contract strongly suggests that behavior; the repo does not currently prove it end to end.
- Completed-order management uses delivered quantities from order lines and invoice totals from related invoices, but there is no explicit browser proof for partial shipments, partial invoicing, or mixed draft/completed downstream document scenarios.
- The menu action shows `Cancel` only when status is `CO`, but the current generated page wires it with an empty `onClick`. The action is visible in configuration, yet its actual user-facing cancellation behavior is not evidenced here.
- Related documents cover quotation, shipment, invoice, and payment navigation, but there is no evidence that replacement orders, reserved stock, related products, or related services are surfaced to users even though contracts exist for those entities.
- Label-override duplication is a known piece of technical debt. The sales-specific "Delivery Status" label is declared both in `decisions.json` (as `labelOverrides.DeliveryStatus`) and, separately, in the custom wrapper's `LABEL_OVERRIDES` constant, because the custom list wrapper bypasses the generated `HeaderPage` when feeding labels into the `ListView`. Any change to this label has to be made in both places until the wrapper reuses the generated labels.

## Manual verification

1. Open `/sales-order` and confirm the list shows exactly Order Date, Document No., Business Partner, Document Status, Total Gross Amount, Invoice Status, and Delivery Status in that order, and that the Delivery Status header reads "Delivery Status"/"Estado de entrega" rather than the default "Receipt Status"/"Estado del envío".
2. Open `/sales-order?filter=pendingDelivery` and confirm the list starts in the pending-delivery quick filter rather than the full order set.
3. Start a new order and verify business partner is required, partner address stays disabled until a business partner is selected, and inline contact creation is available from the detail page.
4. Add one or more lines and verify the line editor exposes product, ordered quantity, net unit price, discount, tax, and line gross amount, then verify the header totals refresh after saving line changes.
5. Open a draft order and verify confirm, send, and clone actions are available. Use the confirm flow once with no downstream documents and once with shipment and/or invoice creation selected.
6. Open a completed order with remaining fulfillment or invoicing work and verify the top-bar management action opens shipment/invoice handling rather than a generic process entry screen.
7. On a completed order with related records, open `Related Documents` and confirm quotation, shipment, invoice, and payment chips navigate to the expected records.
8. On a completed order, verify whether the `Cancel` menu action performs a real cancellation flow; if it only renders without action, record that as a product gap.

## Automated evidence

- `tools/app-shell/src/windows/custom/sales-order/index.jsx` proves the custom list/detail wrapper, clone modal, inline contact creation wiring, and `pendingDelivery` quick filter.
- `artifacts/sales-order/generated/web/sales-order/HeaderPage.jsx`, `HeaderForm.jsx`, `LinesForm.jsx`, and `LinesTable.jsx` prove the master-child structure, visible header fields, visible line fields, summary totals, and related-documents tab.
- `artifacts/sales-order/contract.json` proves dependent selectors, required fields, default values, status enums, and `SL_Order_Amt` callouts on quantity, price, discount, and tax fields.
- `artifacts/sales-order/custom/OrderCreateInvoice.jsx`, `OrderConfirmModal.jsx`, and `OrderDraftChips.jsx` prove status-driven draft/completed actions, confirm behavior, shipment/invoice creation endpoints, and progress calculations based on delivered quantities and invoiced totals.
- `artifacts/sales-order/custom/RelatedDocuments.jsx` and `artifacts/sales-order/generated/web/sales-order/__tests__/RelatedDocuments.test.js` prove quotation, shipment, invoice, and payment related-document resolution and supported spec names.
- `artifacts/sales-order/custom/__tests__/OrderCreateInvoice.test.js` proves source-level coverage for draft confirm actions, shipment creation, draft invoice creation, and invoice lookup action wiring.
- `e2e/tests/flows/sales-order-crud.spec.js` provides browser-level checks for list columns, filter presence, required new-order fields, order-line tab visibility, cancel-to-list navigation, and the partner-address dependency.
- `tests/test-sales-order-endpoints.sh` provides backend-level evidence for list/detail payloads, required order fields in API responses, and creation of a new sales-order header through the NEO endpoints.
