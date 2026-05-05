# Vendor Payments + Returns to Vendor

> Tema: Compras · Dev: D · Semanas: S4 (19/05) → S5 (26/05) · Prioridad: 🟢 P2

## Intent

Close the loop on the AP side: register payments to suppliers (with SEPA batch generation) AND handle the reverse flow when goods are returned to the vendor (return-to-vendor + return-to-vendor-shipment + credit note from supplier).

## Scope (What this should do)

### Vendor Payments (mirror of `cash-flow-payment-in.md` for AP)

- From a purchase invoice or supplier view: "Register payment" CTA.
- Bulk pay: select multiple supplier invoices, settle in one Payment Out.
- SEPA XML generation for selected payments (covered in `../finanzas/payment-out-standard-cost.md` — this task surfaces the action on the Compras surface).
- Schedule a future payment (post-dated) — appears in cash-flow forecast as a planned outflow.

### Returns to Vendor

- Create a return-to-vendor from a purchase order / receipt / invoice.
- Reasons catalog: defective / wrong item / over-shipment / other.
- Create the return-to-vendor-shipment when goods physically leave; decrements stock.
- Receive the supplier's credit note (often via OCR) and match it against the return.
- Status pipeline: Requested → Approved → Shipped → Credited.

## Subtareas (How)

1. Surface the "Register payment" action on the purchase-invoice and BP supplier views; under the hood it calls payment-out.
2. Bulk-pay UI on the supplier view; reuse the same engine as Cobros (`../finanzas/cash-flow-payment-in.md`).
3. Implement post-dated payment scheduling: `c_payment.duedate` + scheduler that marks them as posted on the date.
4. Audit: extend [return-to-vendor.md](../../../generated-custom-windows/return-to-vendor.md) and [return-to-vendor-shipment.md](../../../generated-custom-windows/return-to-vendor-shipment.md). Wire the create-from-PO/Receipt/Invoice action.
5. Match the supplier credit note (OCR-imported or manual) against the return; reduce supplier balance accordingly.
6. SII / Verifactu negative-tax flow on supplier credit note registration.

## Dependencies

- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- [payment-out.md](../../../generated-custom-windows/payment-out.md)
- [return-to-vendor.md](../../../generated-custom-windows/return-to-vendor.md)
- [return-to-vendor-shipment.md](../../../generated-custom-windows/return-to-vendor-shipment.md)
- `../finanzas/payment-out-standard-cost.md` — SEPA + Payment Out engine
- `../localizacion/sii-spain.md` — supplier credit notes
- `goods-receipt-flow.md`

## Acceptance criteria

- [ ] Bulk-pay 4 supplier invoices: each settles, total matches SEPA control sum.
- [ ] Post-dated payment doesn't post until its scheduled date.
- [ ] Return-to-vendor from a receipt pre-fills lines with received quantities.
- [ ] Return shipment decrements stock at the right warehouse and locator.
- [ ] Supplier credit note matched to the return reduces AP balance accordingly.
- [ ] SII registers the supplier credit note correctly (negative-tax flow).
- [ ] Approval threshold blocks shipping a return until approved.

## Related windows / artifacts

- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- [payment-out.md](../../../generated-custom-windows/payment-out.md)
- [return-to-vendor.md](../../../generated-custom-windows/return-to-vendor.md)
- [return-to-vendor-shipment.md](../../../generated-custom-windows/return-to-vendor-shipment.md)
- `../finanzas/payment-out-standard-cost.md`
- `../ventas/customer-returns-credit-notes.md` — symmetric flow

## Notes / Risks

- Returns to vendor are less frequent than customer returns but higher-stakes per event (large quantities, large amounts).
- Don't allow the supplier credit note to exceed the original invoice amount without explicit override.
- Currency on returns must match the original purchase to avoid FX mess.
