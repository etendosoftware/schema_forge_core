# Accounting Dashboard + Bank Accounts

> Tema: Finanzas · Dev: A · Semanas: S1 (01/05) → S2 (06/05) · Prioridad: 🔵 P1

## Intent

Provide a single Finance landing page where the user sees the company's cash position at a glance: bank balances per account, recent movements, pending reconciliations, and KPIs (cash on hand, AR overdue, AP due this week). The dashboard is the entry point that drives the rest of the Finance flows (PSD2 sync, reconciliation, payments).

## Scope (What this should do)

- List all bank accounts with current balance, last movement date, last reconciliation status, and a quick action to open the reconciliation flow.
- KPI cards above the list: Cash on hand (sum of bank balances), AR > 30d, AP due this week, Unreconciled movements count.
- Bank account CRUD: create / edit / archive a bank account with IBAN, currency, accounting account link, and PSD2 connection state.
- Drill-through: click a bank account → opens its reconciliation list filtered by that account.
- Empty state when no bank accounts exist with a CTA "Add your first bank account".

## Subtareas (How)

1. Add a `finance-dashboard` window route in `tools/app-shell/src/menu.json` and register it in `tools/app-shell/src/windows/registry.js`.
2. Create the dashboard window as a custom layout (`layoutType: "custom"` in `decisions.json`) under `tools/app-shell/src/windows/custom/finance-dashboard/`.
3. Implement KPI calculation hooks reading from `bankAccount`, `bankReconciliation`, `paymentIn`, `paymentOut` entities via NEO Headless.
4. Build a bank-account quick CRUD (modal form) reusing the generic entity form.
5. Wire the drill-through navigation to `/bank-reconciliation?bankAccount=<id>`.
6. Add ES/EN locale keys for all dashboard labels.

## Dependencies

- `bankAccount` entity must be exposed via NEO Headless (verify with `cli/src/menu-cache.js search "bank account"`).
- `chart-of-accounts.md` window must already be working (accounting account link).
- Locale keys go in `tools/app-shell/src/locales/{en_US,es_ES}.json`.

## Acceptance criteria

- [ ] `/finance-dashboard` route loads in <1s with KPI cards filled from real data.
- [ ] Creating a bank account via the dashboard immediately reflects on the list and KPIs.
- [ ] Drill-through to bank reconciliation preserves the bank-account filter.
- [ ] Empty state renders when there are no bank accounts.
- [ ] All strings translated in ES/EN — no hardcoded English.
- [ ] E2E test (`tests/e2e/finance-dashboard.spec.js`) covers list, create, drill-through, empty state.

## Related windows / artifacts

- [bank-reconciliation.md](../../../generated-custom-windows/bank-reconciliation.md) — drill-through target
- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md) — accounting account link
- [payment-in.md](../../../generated-custom-windows/payment-in.md) — feeds AR KPI
- [payment-out.md](../../../generated-custom-windows/payment-out.md) — feeds AP KPI

## Notes / Risks

- KPI queries can be expensive — cache for 30s in the SPA, recompute server-side via dedicated NEO endpoint if SQL is slow.
- The "bank account" entity already exists in AD; do NOT create a parallel concept.
