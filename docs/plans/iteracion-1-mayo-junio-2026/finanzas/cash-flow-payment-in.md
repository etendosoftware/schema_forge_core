# Cash Flow + Payment In (Customer Collections)

> Tema: Finanzas · Dev: B · Semanas: S5 (26/05) → S6 (02/06) · Prioridad: 🔵 P1

## Intent

Complete the Payment In flow so a finance user can register customer collections against open invoices, see expected vs actual cash flow over the next 30/60/90 days, and chase overdue receivables — all from a single screen.

## Scope (What this should do)

- Payment In: select customer → list open invoices ordered by due date → check the ones being paid → enter amount + payment method → save → invoices update to `paid` or `partially paid`.
- Bulk collection: one Payment In can settle multiple invoices.
- Cash Flow forecast view: chart + table of expected inflows (open AR by due date) and outflows (open AP by due date) over 30/60/90 days, drill down per BP.
- Overdue chase actions: from the AR aging view, "Send reminder email" button per BP — generates a templated email with the open invoices attached as PDFs.
- Partial payments: an invoice can be partially settled and the remaining balance stays open.

## Subtareas (How)

1. Extend the existing `payment-in.md` window — its contract is already in `artifacts/payment-in/`. Verify the line-level invoice multi-select works; if not, fix in `decisions.json` (do not patch generated files).
2. Add a "Cash Flow Forecast" custom window at `/finance/cash-flow` reusing the chart components from the accounting dashboard.
3. Implement the forecast SQL: aggregate open invoices by `c_invoice.duedate` bucketed by week.
4. Build the reminder email action: a NeoHandler (`PaymentInReminderHandler`) that renders a Liquid/Handlebars template, attaches invoice PDFs, and sends via the org's email config.
5. Wire the chase action into the AR aging view (`financial-reports.md`).
6. Test partial-payment scenarios end-to-end: register €500 against a €1,200 invoice and verify the invoice stays open with €700 remaining.

## Dependencies

- [payment-in.md](../../../generated-custom-windows/payment-in.md) — the base window
- `financial-reports.md` — aging is the chase entry point
- Email config: `configuracion/onboarding-roles-email.md`
- PDF skill for invoice attachments

## Acceptance criteria

- [ ] Bulk-paying 3 invoices in one Payment In transaction settles all three atomically (test rollback by forcing an error mid-save).
- [ ] Partial payment leaves correct remaining balance on the invoice.
- [ ] Cash flow forecast totals match `SUM(c_invoice.grandtotal - c_invoice_paid)` grouped by due-date bucket.
- [ ] Reminder email arrives with the correct PDFs attached and a working "Pay now" link (if Stripe / payment link is configured).
- [ ] All payment-in actions are logged with user + timestamp.

## Related windows / artifacts

- [payment-in.md](../../../generated-custom-windows/payment-in.md)
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- `accounting-dashboard.md` — cash flow KPI source
- `financial-reports.md` — aging source

## Notes / Risks

- OBDal transaction discipline is critical here — any partial save corrupts the invoice paid amount. Wrap the whole operation in a single transaction; let it roll back on any error.
- Currency mismatches between invoice and payment must convert at the saved rate, not at today's rate.
