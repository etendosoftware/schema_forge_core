# Return from Customer

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-specific notes for Return from Customer.

- Purpose and surface: Register customer returns against previously shipped material. The header emphasizes return status, totals, return reason, order date, business partner, address, warehouse, and sales representative; child lines focus on product, returned quantity, UOM, unit price, tax, and the originating shipment line.
- Route: `/return-from-customer` and `/return-from-customer/:recordId`
- Visibility: Visible in the Sales menu. Not hidden.
- Implementation: Generated window.
- Key functional cues:
  - Contract layout type is `default`, with primary entity `customerReturn` and child entity `customerReturnLine`.
  - Even though this window is generated, the generated page still exposes a related-documents tab. That tab resolves the originating goods shipments by following the selected shipment lines.
  - Line editing includes a direct relation to `goodsShipmentLine`, so the return can stay anchored to the outbound shipment being reversed.
  - Header actions include document processing plus return-specific actions such as receive materials, add orphan line, pick from shipment, create invoice, and create order.

## Manual verification

1. Open `/return-from-customer` and confirm the generated window loads with header and lines instead of a placeholder state.
2. Create or edit a return and verify business partner selection drives the dependent partner-address selector.
3. Add a line and confirm the UI can relate the line back to a shipment line, alongside product, return reason, UOM, and tax.
4. Open **Related Documents** and confirm the shipment chips navigate back to the originating goods shipment records.
5. Run one return-specific action such as pick from shipment, create invoice, or create order, then confirm the record refresh still preserves the shipment-linked context.

- Automated evidence: I did not find dedicated browser automation for this window. Shared route/loading coverage still comes from the shared app-shell guide.
