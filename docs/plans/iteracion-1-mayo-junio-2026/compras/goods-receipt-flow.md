# Goods Receipt — Receipt of Merchandise

> Tema: Compras · Dev: D · Semanas: S1 (01/05) → S2 (06/05) · Prioridad: 🟢 P2

## Intent

Close the gap between a purchase order and its physical reception: warehouse staff create a receipt from a purchase order, post it into the right warehouse/locator, optionally print a receipt note, and trigger the matching purchase invoice when the supplier's invoice arrives.

## Scope (What this should do)

- Create a goods receipt from one or many purchase orders (consolidate multi-PO deliveries from the same supplier).
- Header: supplier, warehouse, receipt date, supplier delivery note number, transport reference.
- Lines: pre-filled from open quantities of source order(s); editable to receive partial quantities.
- Locator picker per line (multi-warehouse / bin awareness).
- "Complete" action posts the inventory increment and updates the linked PO's received quantity.
- Receipt note PDF: printable / archivable.
- "Match invoice" action: when the supplier's invoice arrives (manually or via OCR / email ingestion), 3-way match (PO ↔ Receipt ↔ Invoice) — flag discrepancies.
- Receive without a PO (rare but supported): direct receipt with manual product/qty/price.

## Subtareas (How)

1. Confirm [goods-receipt.md](../../../generated-custom-windows/goods-receipt.md) covers the data model. Extend `decisions.json` with the actions (complete, match invoice).
2. Implement "Complete" as a NeoHandler wrapping Etendo's `M_InOut_Post` for inbound movements.
3. Locator picker: same dependency rule as sales shipments — locator depends on warehouse.
4. 3-way match service `ThreeWayMatchService`: compares PO line, receipt line, invoice line on quantity + price + tax; returns mismatches.
5. PDF receipt-note template — share with shipment / invoice templates.
6. Direct (no-PO) receipt path: lighter validation but flagged in the audit log.

## Dependencies

- [purchase-order.md](../../../generated-custom-windows/purchase-order.md) — source
- [goods-receipt.md](../../../generated-custom-windows/goods-receipt.md) — base window
- [warehouse.md](../../../generated-custom-windows/warehouse.md), [warehouse-storage-bins.md](../../../generated-custom-windows/warehouse-storage-bins.md)
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md) — match target
- `../inventario/multi-warehouse-stock.md`

## Acceptance criteria

- [ ] Receiving 8 of 10 ordered units leaves the PO open with 2 remaining.
- [ ] Complete action is atomic (forced error rolls back stock + status).
- [ ] Locator picker filters by selected warehouse.
- [ ] 3-way match flags a price discrepancy between receipt and invoice.
- [ ] Direct receipt (no PO) requires explicit reason and is auditable.
- [ ] E2E test: PO → receive partial → receive rest → invoice → match.

## Related windows / artifacts

- [purchase-order.md](../../../generated-custom-windows/purchase-order.md)
- [goods-receipt.md](../../../generated-custom-windows/goods-receipt.md)
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- [warehouse.md](../../../generated-custom-windows/warehouse.md)
- `../inventario/multi-warehouse-stock.md`

## Notes / Risks

- Stock increment must be in the same transaction as the status update — never split.
- Discrepancies on 3-way match are common; the UX must guide the user (accept / reject / re-negotiate) rather than just blocking.
- Quality control step (inspection before stock posting) is out of scope here but should be reachable from this window in a later iteration.
