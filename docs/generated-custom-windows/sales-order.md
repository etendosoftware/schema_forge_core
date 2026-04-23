# Sales Order

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) and focuses on what a user can verify inside the Sales Order window.

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
- Manual verification:
  1. Open `/sales-order?filter=pendingDelivery` and confirm the list starts in the pending-delivery view instead of the full list.
  2. From the list, use the clone action on one row and confirm the workflow opens a new sales order record rather than mutating the original.
  3. Open a draft order and verify confirm and send actions are available, and that business partner selection still allows inline contact creation from the record page.
  4. Open a completed order with open fulfillment or invoicing work and verify the top-bar action leads into the shipment or invoice creation flow rather than a generic process screen.
  5. Open **Related Documents** on a completed order and confirm the quotation, shipment, invoice, and payment chips navigate to the expected downstream documents when those records exist.
- Automated evidence: The repo contains source-shape tests around sales-order custom components and related-documents wiring, but not browser-level proof. Use the shared app-shell guide for shared loader and data-flow coverage.
