# Multi-Warehouse Stock + Locators

> Tema: Inventario · Dev: C · Semanas: S5 (26/05) → S6 (02/06) · Prioridad: 🟠 P3

## Intent

Surface accurate, real-time stock per product across all warehouses and locators. Today Etendo's data model already supports it; we need a usable UI that lets the user see "what is where", drill into transactions, and trust the numbers as the system of record.

## Scope (What this should do)

- Stock view per product: total on-hand, broken down by warehouse → locator.
- Stock view per warehouse: list of products with current quantity.
- Reserved vs available distinction (reserved by open sales orders).
- Drill into the transactions that brought the current level (ins, outs, adjustments) — ledger view.
- Filters: warehouse, locator, product category, product, low-stock-only.
- Export current snapshot to XLSX.
- Real-time refresh after a goods receipt / shipment / movement / adjustment.

## Subtareas (How)

1. Confirm Etendo `m_storage_detail` is populated correctly for the org. If not, run the storage refresh routine.
2. Build a custom "Stock" window that pivots `m_storage_detail` by product / warehouse / locator.
3. Add the reserved column: `SUM(c_orderline.qty - qtydelivered)` for open sales orders.
4. Build the ledger drill-down: opening a row shows the underlying `m_transaction` rows ordered by date.
5. Add the low-stock indicator using `m_product.minimumstockqty` (or per-warehouse override).
6. XLSX export reuses the `xlsx` skill.

## Dependencies

- [warehouse.md](../../../generated-custom-windows/warehouse.md)
- [warehouse-storage-bins.md](../../../generated-custom-windows/warehouse-storage-bins.md)
- [product.md](../../../generated-custom-windows/product.md)
- `../ventas/sales-shipments.md`, `../compras/goods-receipt-flow.md` — feed stock movements
- `inventory-movements-alerts.md` — sibling task

## Acceptance criteria

- [ ] Stock view loads in <2s for a catalog with 5,000 products and 3 warehouses.
- [ ] Reserved + available = on-hand exactly.
- [ ] After a shipment, the stock view refreshes within 5s.
- [ ] Ledger drill-down shows all transactions for a product/locator pair, ordered by date.
- [ ] Low-stock filter narrows the list to products under min level.
- [ ] XLSX export contains the same numbers as the screen.

## Related windows / artifacts

- [warehouse.md](../../../generated-custom-windows/warehouse.md)
- [warehouse-storage-bins.md](../../../generated-custom-windows/warehouse-storage-bins.md)
- [product.md](../../../generated-custom-windows/product.md)
- `inventory-movements-alerts.md`

## Notes / Risks

- `m_storage_detail` consistency: if it drifts from `m_transaction`, the user sees wrong numbers. Add a periodic verifier job.
- Pagination matters; do NOT load 100k rows at once.
- Reserved-quantity calculation can be expensive; cache for short TTL or denormalize.
