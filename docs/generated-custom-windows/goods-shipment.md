# Goods Shipment

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) and focuses on what a user can verify inside the Goods Shipment window.

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
- Manual verification:
  1. Open `/goods-shipment?DocStatus=CO` and confirm the list is prefiltered to completed shipments.
  2. Select multiple completed shipments for the same customer and verify **Create Invoice** is enabled only when the selection is invoiceable.
  3. Run the bulk invoice flow and confirm it produces a draft sales invoice and offers navigation into that invoice.
  4. Open a completed shipment detail record and verify the top bar exposes both **Create Invoice** and **Create Return**.
  5. Use **Related Documents** on a saved shipment and confirm the linked sales order and invoice chips navigate correctly when those downstream documents exist.
- Automated evidence: I only found source-shape tests for shipment-specific custom components such as the bulk invoice action. There is no dedicated browser automation for shipment flows in this worktree.
