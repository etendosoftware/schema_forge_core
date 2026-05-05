# Sales Shipments — Goods Shipment Flow

> Tema: Ventas · Dev: C · Semanas: S2 (06/05) → S3 (12/05) · Prioridad: 🟢 P2

## Intent

Close the gap between a sales order and its physical fulfillment: let warehouse staff create shipments from open sales orders, pick from the right warehouse/locator, print delivery notes, and trigger invoicing on completion.

## Scope (What this should do)

- Create a goods shipment from a sales order (one or many orders → one shipment).
- Header: customer, warehouse, ship date, transport method, tracking number.
- Lines: pre-filled from the open quantities of the source order(s); editable to ship less than ordered (partial shipments).
- Locator picker per line so picking respects multi-warehouse / bin location structure.
- "Complete" action posts the inventory movement (decrements stock) and updates the linked order's delivered quantity.
- Delivery note PDF: printable / emailable.
- "Create invoice from shipment" action — generates a draft sales invoice from the shipped lines.
- Bulk invoicing: select multiple shipments → create a single consolidated invoice per customer.

## Subtareas (How)

1. Confirm [goods-shipment.md](../../../generated-custom-windows/goods-shipment.md) covers the model. Extend `decisions.json` for the missing actions (complete, create invoice).
2. Implement "Complete" as a NeoHandler that wraps Etendo's `M_InOut_Post` — atomic stock decrement + status flip.
3. Locator picker dependency: when the warehouse changes, locator selectors refresh.
4. Bulk invoicing process: `BulkInvoiceFromShipmentsHandler` groups shipments by BP + currency and creates one invoice per group.
5. Delivery note PDF template — share with the invoice template renderer where applicable.
6. Add the inventory hooks so `multi-warehouse-stock.md` accurately reflects the post-shipment levels.

## Dependencies

- [sales-order.md](../../../generated-custom-windows/sales-order.md) — source
- [goods-shipment.md](../../../generated-custom-windows/goods-shipment.md) — base window
- [warehouse.md](../../../generated-custom-windows/warehouse.md), [warehouse-storage-bins.md](../../../generated-custom-windows/warehouse-storage-bins.md)
- `../inventario/multi-warehouse-stock.md` — read/decrement stock
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md) — invoice creation target

## Acceptance criteria

- [ ] Shipping 3 of 10 ordered units leaves the order open with 7 remaining.
- [ ] Complete action is atomic: forced error mid-flow rolls back stock and status (verify with SQL).
- [ ] Locator picker only shows locators belonging to the selected warehouse.
- [ ] Bulk invoice from 5 shipments to the same customer creates one invoice with 5 line groups.
- [ ] Delivery note PDF prints all shipped lines with the correct quantities.
- [ ] E2E test: order → ship partial → ship rest → invoice all → reconcile.

## Related windows / artifacts

- [sales-order.md](../../../generated-custom-windows/sales-order.md)
- [goods-shipment.md](../../../generated-custom-windows/goods-shipment.md)
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- [warehouse.md](../../../generated-custom-windows/warehouse.md)
- `../inventario/multi-warehouse-stock.md`

## Notes / Risks

- Stock decrement must NEVER happen without the corresponding accounting movement — keep them in the same transaction.
- Partial shipments are common — make sure the order shows "delivered / pending / total" clearly.
- Bulk invoicing groups by BP + currency + payment terms; mixing payment terms in one invoice is wrong.
