# Asset Amortization + Disposal

> Tema: Activos · Dev: D · Semanas: S6 (02/06) · Prioridad: 🟠 P3

## Intent

Automate fixed-asset lifecycle: register an asset (often from a purchase invoice line), schedule periodic amortization entries, and handle disposal (sale or write-off) with the corresponding journal entries — all from a single guided window.

## Scope (What this should do)

- Register an asset: header (description, category, asset class, useful life, salvage value, amortization method) + acquisition info (date, cost, source invoice line).
- Auto-schedule amortization periods based on useful life + method (straight line, declining balance, units of production).
- Monthly job runs amortization for all active assets, posts the corresponding journal entry, and updates the asset's net book value.
- Disposal action: sale (creates an invoice) or write-off (creates an adjustment journal); posts the gain / loss on disposal.
- Asset register report: list of all assets with cost, accumulated depreciation, net book value, period-on-period.
- "Bring-in from invoice" action on purchase invoice lines: highlights lines marked as "asset" and creates the asset record automatically.

## Subtareas (How)

1. Confirm [assets.md](../../../generated-custom-windows/assets.md) covers the model (it does, per the existing guide). Extend `decisions.json` for the missing actions (schedule, post period, dispose).
2. Implement the amortization scheduler: job iterates active assets, computes the period's amortization, posts the journal, updates net book value.
3. Asset disposal handler: gain/loss = sale price − net book value; posts to the right gain/loss account.
4. Bring-in flow: on a purchase invoice line marked `is_asset = Y`, a "Create asset" action pre-fills the asset record.
5. Asset register report — reuses `../finanzas/financial-reports.md` infrastructure.

## Dependencies

- [assets.md](../../../generated-custom-windows/assets.md)
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md) — source of acquisitions
- `../finanzas/manual-journal-entries.md` — posting infrastructure
- `../finanzas/financial-reports.md` — register report
- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md) — gain/loss accounts

## Acceptance criteria

- [ ] Register a €12,000 asset with 5-year SL useful life and verify monthly entries of €200.
- [ ] Year-end run produces 12 monthly entries equal to €2,400 total.
- [ ] Disposal at €5,000 of an asset with €4,000 net book value posts €1,000 gain to the right account.
- [ ] Asset register report totals match `SUM(net book value)` per category.
- [ ] Bring-in from a purchase invoice line creates the asset with the right cost and category.
- [ ] Re-running the monthly job is idempotent (won't double-post the same period).

## Related windows / artifacts

- [assets.md](../../../generated-custom-windows/assets.md)
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- `../finanzas/manual-journal-entries.md`
- `../finanzas/financial-reports.md`

## Notes / Risks

- Amortization methods and useful-life rules differ by jurisdiction — make them configurable per category, not hardcoded.
- Periods that span fiscal year boundaries must respect the year-end close (`../finanzas/year-end-close.md`).
- Disposal partial transfers (sell part of a fleet) are out of scope here; flag for a follow-up.
