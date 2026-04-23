# Return to Vendor Shipment

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It stays focused on return-to-vendor-shipment-specific behavior and does not repeat shared shell concerns such as authentication, generic route protection, embedded mode, or common `useEntity` loading semantics.

- Purpose / surface: Execute the physical outbound shipment for a vendor return after the return order exists.
- Route: `/return-to-vendor-shipment`, `/return-to-vendor-shipment/:recordId`
- Visibility: Visible in the Purchases menu.
- Implementation: Generated window entry in `tools/app-shell/src/windows/registry.js`.

## Key functional cues

- The contract defines a default-layout shipment on `M_InOut`, uses `description` as the notes field, and advertises `relatedDocuments: true`.
- The header centers on RMA vendor reference, business partner, partner address, movement date, accounting date, warehouse, description, document status, and two shipment-driving buttons.
- Draft records expose two lifecycle actions:
  - **Pick/Edit Lines** (`RM_Shipment_Pickedit`) while the shipment is still unprocessed
  - **Process Shipment** (`DocAction`, default `CO`) while the shipment is not closed or voided
- The main child dataset is `lines` (`M_InOutLine`).
- Shipment lines are downstream of the return order rather than independent receipt lines. The line contract includes a foreign-key reference back to the **Return to Vendor line** (`C_OrderLine_ID`), plus movement quantity, UOM, storage bin, product, description, and optional product-attribute values.
- Most operational line fields are read-only once surfaced, which matches a pick/process shipment flow rather than a manual free-form shipment builder.

## Manual verification

1. Open `/return-to-vendor-shipment/:recordId` on a draft record and confirm the header shows both **Pick/Edit Lines** and **Process Shipment**.
2. Use **Pick/Edit Lines** and confirm the resulting shipment lines reference the originating **Return to Vendor line**.
3. Verify the line surface shows movement quantity, product/UOM, and storage-bin context instead of a generic editable free-form shipment row.
4. Process the shipment and confirm the document status moves out of draft and the draft-only actions disappear or become unavailable.
5. If linked documents already exist, confirm the generated related-documents affordance is present and routes back to the return-order flow, because the contract explicitly marks this window as related-document capable.

## Automated evidence

- No dedicated return-to-vendor-shipment UI test was found in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- Evidence sources:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `artifacts/return-to-vendor-shipment/contract.json`
