# Financial Reports — Balance, P&L, Tax Report, Aging

> Tema: Finanzas · Dev: A · Semanas: post S6 · Prioridad: 🔵 P1

## Intent

Deliver the four reports every SME accountant needs daily: Balance Sheet, Profit & Loss, Tax Report (per period), and AR/AP Aging. They must run in seconds against the live DB, support drill-down to source documents, and export to PDF and XLSX.

## Scope (What this should do)

- Four report routes under `/reports/{balance-sheet | profit-loss | tax-report | aging}`.
- Date / period filter at the top; period defaults to current fiscal period.
- Comparison column: "vs prior period" toggle.
- Drill-down: clicking an account row opens a slide-over with the contributing journal lines; clicking a line jumps to its source document.
- Export buttons: PDF (formatted) and XLSX (raw rows for further analysis).
- Aging report is split into AR (customer aging) and AP (supplier aging) tabs with buckets 0–30 / 31–60 / 61–90 / >90 days.
- Tax report groups by tax rate, shows base + tax amount, and matches the SII / VAT declaration totals.

## Subtareas (How)

1. Use the existing `mcp__9531db3c__generate_aging_receivable` and `generate_tax_report` MCP tools as the data backbone — wrap them in a shared `FinancialReportsService` that the SPA calls via NEO endpoints.
2. Implement Balance Sheet and P&L in the same service: aggregate `fact_acct` per account, classify by `c_elementvalue.elementlevel` and `accounttype`.
3. Build a generic `Report` React component (custom in `tools/app-shell/src/windows/custom/reports/`) that renders any of the four reports given a config (columns, groupBy, drillDownTarget).
4. Add the four routes to the menu under "Finance > Reports".
5. PDF export reuses the `pdf` skill conventions; XLSX export reuses the `xlsx` skill conventions.
6. Drill-down from account → journal lines reuses the same NEO selector that powers `chart-of-accounts.md`.

## Dependencies

- `chart-of-accounts.md` window must be working (drill-down target).
- `manual-journal-entries.md` — drill-down to journal source.
- MCP tools for aging and tax report (already available in this org's connectors).

## Acceptance criteria

- [ ] Each report runs in <2s on a database with 100k journal lines.
- [ ] Balance Sheet balances: Assets = Liabilities + Equity, exactly, with zero rounding error.
- [ ] P&L net income matches the Equity > Retained Earnings movement.
- [ ] Aging totals match `SUM(c_invoice.grandtotal - c_invoice_paid)` per BP.
- [ ] PDF and XLSX exports open correctly and contain the same numbers as the screen.
- [ ] Drill-down from any number lands on the right document within 2 clicks.

## Related windows / artifacts

- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md) — drill-down anchor
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md), [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md) — drill-down targets
- `manual-journal-entries.md` — drill-down target

## Notes / Risks

- Don't compute totals in JavaScript — push everything into SQL, return only the rendered rows.
- Tax report must reconcile to the cent against SII (`localizacion/sii-spain.md`) — coordinate test data with Dev B.
- "Comparison vs prior period" doubles query cost — cache per (period, comparison) pair for 5 min.
