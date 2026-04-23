# Return to Vendor

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It stays focused on return-to-vendor-specific behavior and does not repeat shared shell concerns such as authentication, generic route protection, embedded mode, or common `useEntity` loading semantics.

- Purpose / surface: Create a vendor return order, pick returnable lines from prior receipts, and process the return through its order lifecycle.
- Route: `/return-to-vendor`, `/return-to-vendor/:recordId`
- Visibility: Visible in the Purchases menu.
- Implementation: Generated window entry in `tools/app-shell/src/windows/registry.js`.

## Key functional cues

- The contract defines a default-layout return order on `C_Order`, uses `returnReason` as the notes-oriented field, and advertises `relatedDocuments: true`.
- The header stays focused on the return authorization/order itself: vendor reference, order date, business partner, partner address, return reason, warehouse, payment method, payment terms, price list, and document status.
- Draft records expose two lifecycle-driving buttons:
  - **Pick/Edit Lines** (`RM_Pickfromreceipt`) while the record is still unprocessed
  - **Process Order** (`DocAction`, default `CO`) while the document is not voided or closed
- The main child dataset is `lines` (`C_OrderLine`); the contract also exposes `lineTax`.
- Return lines are receipt-driven rather than free-form. The contract ties each line back to a **Goods Receipt Line** (`M_Inoutline_ID`) and keeps core commercial fields such as return quantity, net/gross amounts, tax, and delivered quantity on the line.
- Most line fields are read-only in the current frontend contract, which matches the intended workflow: users pick receipt lines first, then process the return order instead of building the line payload from scratch in-grid.

## Manual verification

1. Open `/return-to-vendor/:recordId` on a draft record and confirm the header shows both **Pick/Edit Lines** and **Process Order**.
2. Use **Pick/Edit Lines** to bring lines from a prior receipt and confirm the generated line rows carry a **Goods Receipt Line** reference.
3. Verify the line surface shows the return quantity, tax/amount fields, and return reason context without exposing a completely free-form line editor.
4. Process the order and confirm the document status moves out of draft and the draft-only actions disappear or become unavailable.
5. If linked documents already exist, confirm the generated related-documents affordance is present and routes back to the relevant purchasing record set, because the contract explicitly marks this window as related-document capable.

## Automated evidence

- No dedicated return-to-vendor UI test was found in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- Evidence sources:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `artifacts/return-to-vendor/contract.json`
