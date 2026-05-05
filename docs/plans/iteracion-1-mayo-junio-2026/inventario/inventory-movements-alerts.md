# Inventory Movements, Adjustments + Stock Alerts

> Tema: Inventario · Dev: C · Semanas: S6 (02/06) · Prioridad: 🟠 P3

## Intent

Provide the user-facing surface for inventory operations beyond the natural flow of sales/purchases: warehouse-to-warehouse transfers, physical inventory counts, manual adjustments — and proactive low-stock alerts.

## Scope (What this should do)

- Goods movement (warehouse → warehouse): from + to locator, lines with product + qty, complete action posts the dual transaction.
- Manual adjustments (count vs system): one-line corrections with a mandatory reason code (shrinkage / damage / found / correction).
- Physical inventory: planned counts, freeze stock during count, reconcile differences as adjustments.
- Internal consumption: post stock out for non-sale uses (samples, internal use, breakage).
- Alerts: when stock for a product drops below `minimumstockqty`, raise an alert visible on the dashboard + send email to the responsible buyer.
- Reorder suggestions: list products under min level with suggested reorder quantity (based on `reorderqty` or moving average).

## Subtareas (How)

1. Confirm [goods-movements.md](../../../generated-custom-windows/goods-movements.md), [physical-inventory.md](../../../generated-custom-windows/physical-inventory.md), [internal-consumption.md](../../../generated-custom-windows/internal-consumption.md) cover the data model. Extend `decisions.json` for missing actions (complete, post adjustment).
2. Add reason-code dropdown on adjustments; reasons configurable per org.
3. Implement the alerts engine: nightly job + real-time on every transaction, writing rows into `etgo_stock_alert`.
4. Surface alerts in: finance/operations dashboard, a dedicated "Alerts" inbox window, and email digest.
5. Reorder suggestions list view with one-click "Create purchase requisition" action.
6. Wire the buyer-of-record per product (or per category) to know who gets the alert.

## Dependencies

- [goods-movements.md](../../../generated-custom-windows/goods-movements.md)
- [physical-inventory.md](../../../generated-custom-windows/physical-inventory.md)
- [internal-consumption.md](../../../generated-custom-windows/internal-consumption.md)
- `multi-warehouse-stock.md`
- [purchase-order.md](../../../generated-custom-windows/purchase-order.md) — reorder target

## Acceptance criteria

- [ ] Warehouse transfer of 50 units posts -50 at source and +50 at destination atomically.
- [ ] Manual adjustment with reason creates the corresponding accounting entry per Etendo's costing rules.
- [ ] Physical inventory completes only when all lines have been counted (no skipped lines).
- [ ] Stock dropping below min triggers an alert visible on dashboard within 30s.
- [ ] Email digest of alerts goes out daily to the configured buyer.
- [ ] "Create reorder PO" generates a draft purchase order with the suggested quantities.

## Related windows / artifacts

- [goods-movements.md](../../../generated-custom-windows/goods-movements.md)
- [physical-inventory.md](../../../generated-custom-windows/physical-inventory.md)
- [internal-consumption.md](../../../generated-custom-windows/internal-consumption.md)
- `multi-warehouse-stock.md`

## Notes / Risks

- Adjustments post to a "Stock Adjustment" account — make sure it's seeded by the localization pack.
- Physical inventory locks the warehouse for the duration; warn users so other operations queue rather than fail.
- Alert fatigue is real — let users tune thresholds per product.
