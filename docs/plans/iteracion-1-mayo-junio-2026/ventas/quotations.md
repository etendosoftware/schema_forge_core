# Sales Quotations — Creation, Email, Conversion to Order

> Tema: Ventas · Dev: C · Semanas: S1 (01/05) → S2 (06/05) · Prioridad: 🟢 P2

## Intent

Complete the sales-quotation flow so a salesperson can create a quotation, send it as a branded PDF by email, track whether the customer opened it, and convert it to a sales order in one click when accepted.

## Scope (What this should do)

- Create / edit quotation with header (customer, valid-until date, payment terms, currency) and lines (product, qty, price, discount, tax).
- Generate a branded PDF using the org's invoice template (logo, address, footer).
- "Send by email" action: opens a modal with prefilled to/cc/subject/body (templated), sends via the org's SMTP, attaches the PDF.
- Track open/click events if the email service supports it (e.g. SendGrid webhook).
- Status transitions: Draft → Sent → Accepted → Converted (or → Rejected / Expired).
- "Convert to order" action: clones header + lines into a new sales order, links back to the quotation, and locks the quotation as Converted.
- Quotation list view with filter by status and validity date.

## Subtareas (How)

1. Verify [sales-quotation.md](../../../generated-custom-windows/sales-quotation.md) covers the existing data model. Extend `decisions.json` to add the missing actions (send email, convert to order).
2. Implement "Send Email" as a NeoHandler (`SalesQuotationEmailHandler`) that renders an HTML body using a Liquid template and attaches the PDF.
3. Build the PDF using the `pdf` skill conventions; share the template renderer with sales-invoice and purchase-invoice.
4. "Convert to order" reuses the existing Etendo `OrderFromQuotationProcess` — wrap it in a NeoHandler.
5. Add status badge to the quotation header surface (`statusBar` extension — see `docs/ui-customization.md`).
6. Webhook endpoint to receive email open/click events from SendGrid (or equivalent) and update `lastOpenedAt` on the quotation.

## Dependencies

- Email config (`configuracion/onboarding-roles-email.md`)
- [sales-quotation.md](../../../generated-custom-windows/sales-quotation.md) — base window
- [sales-order.md](../../../generated-custom-windows/sales-order.md) — conversion target
- PDF skill

## Acceptance criteria

- [ ] Creating a quotation with 5 lines and saving takes <1s.
- [ ] PDF renders with org logo, address, totals correct (verify by reopening the saved PDF).
- [ ] Send Email arrives in the customer's inbox within 30s with the PDF attached.
- [ ] Convert to Order creates a sales order with the same lines and totals; quotation locks as Converted.
- [ ] Status filter on the list narrows to Draft / Sent / Accepted / Converted correctly.
- [ ] E2E test covers: create → send → convert.

## Related windows / artifacts

- [sales-quotation.md](../../../generated-custom-windows/sales-quotation.md)
- [sales-order.md](../../../generated-custom-windows/sales-order.md)
- `../configuracion/onboarding-roles-email.md` — SMTP config
- `../compras/email-invoice-ingestion.md` — shares email infrastructure

## Notes / Risks

- Don't store rendered PDFs forever — generate on demand or store with TTL.
- Email deliverability matters: configure SPF/DKIM/DMARC properly via the onboarding wizard.
- Quotation-to-order conversion must be idempotent — clicking twice should not create two orders.
