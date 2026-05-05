# Sales — Payment Collection + Email Engine

> Tema: Ventas · Dev: C · Semanas: S3 (12/05) → S4 (19/05) · Prioridad: 🟢 P2

## Intent

Tie together the AR side of sales: register collections against open sales invoices (Payment In), automate the dunning workflow (overdue reminders), and provide the templated email engine that powers reminders, quotations, invoices, and statements.

## Scope (What this should do)

### Payment Collection (sales-side wrapper around `payment-in`)

- From a sales invoice header: "Register payment" CTA opens a modal with payment date, method, amount, and bank account.
- Quick collection from the customer view: list open invoices, select multiple, collect in one transaction.
- Mirror of `../finanzas/cash-flow-payment-in.md` but accessed from the Sales surface.

### Email Engine

- Generic email sending service with templates: quotation, order confirmation, shipment notice, invoice, payment receipt, overdue reminder, statement.
- Templates are HTML with Liquid/Handlebars variables; one per language; org can override the defaults.
- Send single (one customer) or batch (all overdue customers).
- Preview pane before sending.
- Log all sent emails per BP for audit.

## Subtareas (How)

1. Build a thin "Register payment" form on the sales-invoice header that delegates to the payment-in flow under the hood (no duplicate logic).
2. Build the `EmailEngineService` (Java, in com.etendoerp.go) with: template registry, variable resolver, attachment composer, sender (delegates to org SMTP).
3. Define the seed templates in `tools/seed-data/email-templates/` (ES + EN per template).
4. Build a "Send statement" action on the customer view — generates a PDF of all open invoices and sends it.
5. Build a dunning scheduler: org sets days-after-due thresholds (e.g. 7d / 30d / 60d) → engine sends a reminder per threshold automatically.
6. Build the email log window so users can see what was sent to whom and when.

## Dependencies

- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- [payment-in.md](../../../generated-custom-windows/payment-in.md)
- `../finanzas/cash-flow-payment-in.md` — reuses the same backend
- `../configuracion/onboarding-roles-email.md` — SMTP config

## Acceptance criteria

- [ ] Registering a €1,000 collection on a €1,000 invoice marks it Paid and creates the corresponding journal entries.
- [ ] Customer view "Send statement" produces a PDF listing all open invoices grouped by aging bucket.
- [ ] Dunning scheduler triggers the right template at the right threshold; idempotent (won't double-send).
- [ ] Each template renders correctly with sample variables in both ES and EN.
- [ ] Email log captures from / to / template / status / open-tracking events.
- [ ] Preview-before-send works for batch sends — user can deselect rows in the batch.

## Related windows / artifacts

- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- [payment-in.md](../../../generated-custom-windows/payment-in.md)
- `../finanzas/cash-flow-payment-in.md`
- `quotations.md` — uses the same email engine
- `../compras/email-invoice-ingestion.md` — uses the same email infrastructure (inbound)

## Notes / Risks

- Centralize email logic in ONE engine — having quotations, invoices, dunning each implement their own send logic ruins maintainability.
- Dunning idempotency: track `last_reminder_sent_at` per (invoice, threshold) so the scheduler never spams.
- Honor unsubscribe / do-not-contact flags at the BP level even if a workflow tries to send.
