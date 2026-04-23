# Return Material Receipt

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-specific notes for Return Material Receipt.

- Purpose and surface: Receive material back into stock after a sales-side return flow. The header emphasizes movement date, business partner, warehouse, partner address, source sales order, and receipt status; child lines focus on product, movement quantity, UOM, order quantity, and the originating sales order line.
- Route: `/return-material-receipt` and `/return-material-receipt/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Generated window.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `returnMaterialReceipt` and child entity `returnMaterialReceiptLine`.
  - Related documents are enabled and the generated page includes a related-documents tab that links back to the originating sales order.
  - Header selectors cover business partner, warehouse, partner address, and sales order; line selectors cover product, UOM, and sales order line.
  - Header actions include receive materials, create lines from, document action, posted, calculate freight, send materials, generate to, update lines, invoice from shipment, and process goods.

## Manual verification

1. Open `/return-material-receipt` and confirm the generated receipt workspace loads with both header and lines.
2. Create or edit a receipt and verify the header can search for business partner, warehouse, and source sales order, with partner address following the selected customer.
3. Use **Create From** or another line-population action and confirm the line grid fills with product, quantity, UOM, and sales-order-line context.
4. Open **Related Documents** and confirm the sales-order chip navigates back to the originating order.
5. Complete or update the receipt and verify the order-linked and line-linked context remains intact after save or process actions.

- Automated evidence: I did not find dedicated browser automation for this window. Shared route/loading coverage still comes from the shared app-shell guide.
