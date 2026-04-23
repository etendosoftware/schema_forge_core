# Sales windows

This guide complements `docs/generated-custom-windows/app-shell-functional-flows.md` and focuses on what a user can verify inside each Sales window. All routes below come from visible Sales menu items in `tools/app-shell/src/menu.json` and load through `tools/app-shell/src/windows/registry.js`.

Unless a section says otherwise, I did not find dedicated browser-level automation for the window itself. Use the shared app-shell guide for common coverage of authentication, routing, shell chrome, generic window loading, and shared entity data behavior.

## Sales Quotation

- Purpose and surface: Create and confirm customer quotations in a standard header-plus-lines flow. The header emphasizes contact, quotation date, validity, price list, and payment method; child lines focus on product, quantity, price, discount, tax, and line totals.
- Route: `/sales-quotation` and `/sales-quotation/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Custom window wrapper over the generated quotation page.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `quotation` and child entity `quotationLine`.
  - Related documents are enabled and the related-documents tab resolves downstream sales orders and invoices.
  - The top bar adds draft-only quotation confirmation plus document sending.
  - Menu actions include **Duplicate** and **Cancel**.
  - Record pages also keep the inline contact-creation flow available when the user needs to create a sale-side contact while editing the quotation.
- Automated evidence: No dedicated browser automation observed. The repo only shows source-shape checks around quotation-specific custom components, so route/loading confidence still comes from the shared app-shell guide.

### Manual verification

1. Open `/sales-quotation` and confirm the list loads as a quotation workspace rather than the generic placeholder state.
2. Open or create a draft quotation and verify the header can search for a business partner, then narrow the partner address selector from that choice.
3. Add or edit a line and verify product and tax selectors are available alongside quantity, unit price, discount, and line totals.
4. While the document is still in draft, confirm the top bar exposes quotation confirmation and document sending.
5. After confirming a quotation, open **Related Documents** and verify that downstream sales orders and invoices appear as chips and navigate to the correct routes when those documents exist.

## Sales Order

- Purpose and surface: Manage fulfillment and invoicing from the sales order workspace. The header centers on customer, order date, warehouse, price list, payment method, status, and totals; child lines capture product, quantity, price, discount, tax, and delivered or invoiced progress.
- Route: `/sales-order` and `/sales-order/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Custom window wrapper over the generated sales-order page.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `header` and child entity `lines`.
  - Related documents are enabled. The related-documents tab resolves the originating quotation, downstream goods shipments, downstream sales invoices, and linked payments.
  - The detail top bar adds order-specific actions such as confirm, send, clone, create or manage shipment and invoice work, and draft-status chips that deep-link to draft shipment or invoice records.
  - The list view adds cloning support and a `pendingDelivery` quick filter.
  - Menu actions include **Cancel**.
- Automated evidence: The repo contains source-shape tests around sales-order custom components and related-documents wiring, but not browser-level proof. Use the shared app-shell guide for shared loader and data-flow coverage.

### Manual verification

1. Open `/sales-order?filter=pendingDelivery` and confirm the list starts in the pending-delivery view instead of the full list.
2. From the list, use the clone action on one row and confirm the workflow opens a new sales order record rather than mutating the original.
3. Open a draft order and verify confirm and send actions are available, and that business partner selection still allows inline contact creation from the record page.
4. Open a completed order with open fulfillment or invoicing work and verify the top-bar action leads into the shipment or invoice creation flow rather than a generic process screen.
5. Open **Related Documents** on a completed order and confirm the quotation, shipment, invoice, and payment chips navigate to the expected downstream documents when those records exist.

## Goods Shipment

- Purpose and surface: Execute customer shipments and then continue into invoicing or returns from the shipment itself. The header focuses on warehouse, customer, address, movement date, shipment status, and invoicing status; child lines cover shipped product, movement quantity, ordered quantity, and related order-line context.
- Route: `/goods-shipment` and `/goods-shipment/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Custom window route that loads the generated shipment page with shipment-specific list and detail actions.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `goodsShipment` and child entity `goodsShipmentLine`.
  - Related documents are enabled. The related-documents tab resolves the linked sales order and any invoices created from that order; return receipts are reserved for backend support.
  - Detail pages add shipment-specific top-bar actions to create a draft invoice, create a return, and send the shipment document.
  - The list view supports a `DocStatus` query filter and a bulk action that can create one draft invoice from multiple completed shipments when they belong to the same customer and are not already fully invoiced.
  - Menu actions include **Cancel**.
- Automated evidence: I only found source-shape tests for shipment-specific custom components such as the bulk invoice action. There is no dedicated browser automation for shipment flows in this worktree.

### Manual verification

1. Open `/goods-shipment?DocStatus=CO` and confirm the list is prefiltered to completed shipments.
2. Select multiple completed shipments for the same customer and verify **Create Invoice** is enabled only when the selection is invoiceable.
3. Run the bulk invoice flow and confirm it produces a draft sales invoice and offers navigation into that invoice.
4. Open a completed shipment detail record and verify the top bar exposes both **Create Invoice** and **Create Return**.
5. Use **Related Documents** on a saved shipment and confirm the linked sales order and invoice chips navigate correctly when those downstream documents exist.

## Sales Invoice

- Purpose and surface: Issue customer invoices, review totals, monitor payment collection, and navigate back to the originating commercial flow. The header emphasizes business partner, invoice date, billing address, payment terms, payment method, status, and gross totals; child lines cover product, invoiced quantity, unit price, gross amount, and tax. A second child tab exposes the payment plan.
- Route: `/sales-invoice` and `/sales-invoice/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Custom window wrapper over the generated invoice page.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `header`, child entity `lines`, and child entity `paymentPlan`.
  - Related documents are enabled. The detail page renders a related-documents tab plus a bottom panel that combines notes, related-document chips, and totals.
  - The list view adds an overdue quick filter, lateral preview flow, and clone support.
  - The detail top bar adds cloning plus an installment-aware payment-status badge that summarizes the payment plan and opens the payment modal.
  - Related documents can point back to a quotation or sales order, linked shipments, and, for credit notes, original invoices from the same order.
  - Menu actions include **Duplicate** and **Cancel**.
- Automated evidence: No dedicated browser automation observed. The repo includes custom invoice components, but current confidence for routing and common data behavior still depends on the shared app-shell guide.

### Manual verification

1. Open `/sales-invoice?filter=overdue` and confirm the list starts in the overdue-only view.
2. Open an invoice detail record and verify the bottom section shows notes, totals, and related-document chips in the same screen.
3. Open the payment-status badge in the top bar and confirm the modal reflects the payment-plan installments rather than only a header total.
4. Open the **Payment Plan** child tab and verify installment records, payment method, currency, amounts, and overdue indicators are present for invoices that have them.
5. Use the clone action from either the list or the detail top bar and confirm the app navigates to a new sales-invoice record.
6. Open **Related Documents** and verify navigation back to the originating quotation or order and linked shipments; for credit notes, also verify the original invoice chips appear when applicable.

## Return from Customer

- Purpose and surface: Register customer returns against previously shipped material. The header emphasizes return status, totals, return reason, order date, business partner, address, warehouse, and sales representative; child lines focus on product, returned quantity, UOM, unit price, tax, and the originating shipment line.
- Route: `/return-from-customer` and `/return-from-customer/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Generated window.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `customerReturn` and child entity `customerReturnLine`.
  - Even though this window is generated, the generated page still exposes a related-documents tab. That tab resolves the originating goods shipments by following the selected shipment lines.
  - Line editing includes a direct relation to `goodsShipmentLine`, so the return can stay anchored to the outbound shipment being reversed.
  - Header actions include document processing plus return-specific actions such as receive materials, add orphan line, pick from shipment, create invoice, and create order.
- Automated evidence: I did not find dedicated browser automation for this window. Shared route/loading coverage still comes from the shared app-shell guide.

### Manual verification

1. Open `/return-from-customer` and confirm the generated window loads with header and lines instead of a placeholder state.
2. Create or edit a return and verify business partner selection drives the dependent partner-address selector.
3. Add a line and confirm the UI can relate the line back to a shipment line, alongside product, return reason, UOM, and tax.
4. Open **Related Documents** and confirm the shipment chips navigate back to the originating goods shipment records.
5. Run one return-specific action such as pick from shipment, create invoice, or create order, then confirm the record refresh still preserves the shipment-linked context.

## Return Material Receipt

- Purpose and surface: Receive material back into stock after a sales-side return flow. The header emphasizes movement date, business partner, warehouse, partner address, source sales order, and receipt status; child lines focus on product, movement quantity, UOM, order quantity, and the originating sales order line.
- Route: `/return-material-receipt` and `/return-material-receipt/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Generated window.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `returnMaterialReceipt` and child entity `returnMaterialReceiptLine`.
  - Related documents are enabled and the generated page includes a related-documents tab that links back to the originating sales order.
  - Header selectors cover business partner, warehouse, partner address, and sales order; line selectors cover product, UOM, and sales order line.
  - Header actions include receive materials, create lines from, document action, posted, calculate freight, send materials, generate to, update lines, invoice from shipment, and process goods.
- Automated evidence: I did not find dedicated browser automation for this window. Shared route/loading coverage still comes from the shared app-shell guide.

### Manual verification

1. Open `/return-material-receipt` and confirm the generated receipt workspace loads with both header and lines.
2. Create or edit a receipt and verify the header can search for business partner, warehouse, and source sales order, with partner address following the selected customer.
3. Use **Create From** or another line-population action and confirm the line grid fills with product, quantity, UOM, and sales-order-line context.
4. Open **Related Documents** and confirm the sales-order chip navigates back to the originating order.
5. Complete or update the receipt and verify the order-linked and line-linked context remains intact after save or process actions.
