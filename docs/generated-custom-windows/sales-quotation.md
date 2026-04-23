# Sales Quotation

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) and focuses on what a user can verify inside the Sales Quotation window.

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
- Manual verification:
  1. Open `/sales-quotation` and confirm the list loads as a quotation workspace rather than the generic placeholder state.
  2. Open or create a draft quotation and verify the header can search for a business partner, then narrow the partner address selector from that choice.
  3. Add or edit a line and verify product and tax selectors are available alongside quantity, unit price, discount, and line totals.
  4. While the document is still in draft, confirm the top bar exposes quotation confirmation and document sending.
  5. After confirming a quotation, open **Related Documents** and verify that downstream sales orders and invoices appear as chips and navigate to the correct routes when those documents exist.
- Automated evidence: No dedicated browser automation observed. The repo only shows source-shape checks around quotation-specific custom components, so route/loading confidence still comes from the shared app-shell guide.
