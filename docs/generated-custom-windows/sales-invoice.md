# Sales Invoice

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-specific notes for Sales Invoice.

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

## Manual verification

1. Open `/sales-invoice?filter=overdue` and confirm the list starts in the overdue-only view.
2. Open an invoice detail record and verify the bottom section shows notes, totals, and related-document chips in the same screen.
3. Open the payment-status badge in the top bar and confirm the modal reflects the payment-plan installments rather than only a header total.
4. Open the **Payment Plan** child tab and verify installment records, payment method, currency, amounts, and overdue indicators are present for invoices that have them.
5. Use the clone action from either the list or the detail top bar and confirm the app navigates to a new sales-invoice record.
6. Open **Related Documents** and verify navigation back to the originating quotation or order and linked shipments; for credit notes, also verify the original invoice chips appear when applicable.

- Automated evidence: No dedicated browser automation observed. The repo includes custom invoice components, but current confidence for routing and common data behavior still depends on the shared app-shell guide.
