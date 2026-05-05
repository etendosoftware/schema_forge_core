# Customer Returns + Credit Notes

> Tema: Ventas · Dev: C · Semanas: S4 (19/05) → S5 (26/05) · Prioridad: 🟢 P2

## Intent

Handle the full reverse-flow of a sale: customer returns goods, we receive them back into stock (return material receipt), issue a credit note (reversal invoice), and reconcile the customer's balance. Today this lives in three disconnected windows; goal is a single guided flow.

## Scope (What this should do)

- Create a customer return from a source sales order or shipment (to ensure traceability and prevent fraudulent returns).
- Reasons catalog: defective / wrong item / customer cancellation / other.
- Create a return-material-receipt (inbound stock movement) when the goods are physically received back.
- Generate a credit note (rectified invoice) automatically from the receipt — with proper Verifactu/SII A4 signaling (see `../localizacion/verifactu-tbai.md`).
- Refund options: apply credit to BP balance, refund via Payment Out, or leave as credit for next purchase.
- Status pipeline: Requested → Approved → Received → Credited → Refunded (or Closed).
- Approver step (configurable) before credit note generation if the return amount > org-defined threshold.

## Subtareas (How)

1. Audit the existing windows: [return-from-customer.md](../../../generated-custom-windows/return-from-customer.md) and [return-material-receipt.md](../../../generated-custom-windows/return-material-receipt.md). Extend, don't recreate.
2. Add a "Create return" action on the sales-order / shipment / sales-invoice surface that pre-fills the return.
3. Add the reason field to the return header (`m_returnreason` table — verify or create).
4. Build the credit-note generation as a process: `GenerateCreditNoteFromReturnHandler` that reuses Etendo's `c_invoice_return` flow.
5. Approval workflow: if amount > threshold, the return moves to status Approval Pending; an approver role can transition it to Approved.
6. Refund options pane: radio buttons in the credit note view to choose how to settle.
7. Wire SII / Verifactu A4 communication automatically on credit note completion.

## Dependencies

- [return-from-customer.md](../../../generated-custom-windows/return-from-customer.md)
- [return-material-receipt.md](../../../generated-custom-windows/return-material-receipt.md)
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md) — credit notes are rectified invoices
- `../localizacion/verifactu-tbai.md` — A4 communication
- `../localizacion/sii-spain.md` — SII rectified flow
- `payment-out` — for refunds

## Acceptance criteria

- [ ] Creating a return from a shipment pre-fills lines with the shipped quantities.
- [ ] Receiving a return increments stock at the correct warehouse + locator.
- [ ] Credit note auto-generated with the correct rectified-invoice flag and links back to the original invoice.
- [ ] Refund via Payment Out creates the matching outbound payment.
- [ ] Approval threshold blocks credit-note generation until approved.
- [ ] SII / Verifactu submission tagged as rectifying invoice (A4) and references the original.
- [ ] Customer balance reflects the credit / refund correctly.

## Related windows / artifacts

- [return-from-customer.md](../../../generated-custom-windows/return-from-customer.md)
- [return-material-receipt.md](../../../generated-custom-windows/return-material-receipt.md)
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- `../localizacion/sii-spain.md`, `../localizacion/verifactu-tbai.md`

## Notes / Risks

- Credit notes are legally distinct from regular invoices in Spain — ensure the document type is right or SII rejects them.
- Stock reversal at the wrong warehouse is a hard-to-detect bug; force the user to confirm warehouse on receipt.
- Don't allow returns without a source document (order/shipment) — the audit trail is critical.
