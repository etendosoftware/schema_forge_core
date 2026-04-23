# Sales Quotation

## Intent

Let a sales user prepare a customer quotation, review commercial terms before commitment, and turn an accepted quotation into a downstream sales document without re-entering the header and line data.

## What this window should allow

- Create and review quotation headers with customer, quotation date, validity date, address, price list, payment method, payment terms, notes, and read-only commercial totals.
- Add, edit, and remove quotation lines with product, description, quantity, unit price, discount, tax, and line gross amount.
- Keep the quotation in draft while the commercial proposal is being prepared, then explicitly send that draft into an `Under Evaluation` state before final conversion.
- From `Under Evaluation`, create a downstream sales order and, in the current custom overlay, optionally create a draft sales invoice.
- Send the quotation document from the record view.
- Inspect related downstream sales orders and invoices from the quotation record when those documents exist.

## Interaction model

- Route: `/sales-quotation` for the list and `/sales-quotation/:recordId` for the record workspace.
- Visibility: visible from the Sales menu under the Commercial section.
- Implementation type: custom window wrapper over the generated quotation page.
- Window shape: master-child, with `quotation` as the header entity and `quotationLine` as the child entity.
- List interaction: the list shows document number, quotation date, business partner, validity date, document status, and gross total, with filters for those same business fields.
- Record interaction: the detail page shows the quotation header form, a child lines table and line form, summary amounts, record status, top-bar actions, and a Related Documents tab.
- Available record-level affordances in current evidence: duplicate and cancel menu entries, a send-document button, a draft-only send-to-evaluation modal trigger, and an under-evaluation confirmation modal trigger.

## Reactive behavior and dependencies

- Header dependency: `partnerAddress` is a dependent selector filtered by the selected `businessPartner`, so address choice should narrow after the customer changes.
- Header visibility changed in the merged code: `priceList`, `validUntil`, `paymentMethod`, and `paymentTerms` are now part of the visible quotation header form instead of remaining hidden or collapsed-only fields.
- Header defaulting and callouts: the contract keeps business-partner, address, price-list, order-date, and valid-until callouts. Current evidence supports customer-driven address and price-list autofill expectations, and it still records an intended default of `validUntil = orderDate + 30 days` for new quotations.
- Pricing dependency: line product selection is expected to auto-fill unit price and tax from the active price list according to the retained `Product_AutoFill_Price` rule.
- Line recalculation: quantity, unit price, and discount are expected to recalculate line amounts through the retained `Line_Calc_NetAmount` callout, and saved lines are expected to refresh header totals through the retained `Line_Recalc_Totals` handler.
- Status-driven behavior now follows two visible modal steps. In `DR`, the primary top-bar action opens `SendToEvaluationModal`, POSTs `DocAction`, then closes and reloads the page. In `UE`, the primary action opens `QuotationConfirmModal`, which can create an order through `Convertquotation` or create a draft invoice through `createDraftInvoice`.
- Order conversion has an extra observable follow-up in the custom flow: after creating the sales order, the modal queries the new order and best-effort reactivates it back to `DR` when the backend auto-completes it. Users therefore may land on a downstream order shown as draft even though the conversion path started from quotation confirmation.
- Menu configuration now exposes `Cancel` for both `CO` and `UE`, but the generated detail page still wires that menu action to an empty handler. The entry is visible; the business effect is not implemented in the inspected UI layer.
- Related downstream behavior: the Related Documents tab is intended to surface sales orders and invoices tied to the quotation so the user can navigate into fulfillment and billing from the quotation record.
- Current visible evidence does not show inline formulas or client-side calculators for discount, tax, or totals; the observable design is server-driven recalculation after selector, callout, save, and modal action flows.

## Gap assessment

- Duplicate and Cancel are exposed as menu actions in the detail page, but the generated page still wires both to empty `onClick` handlers. Their presence is visible; their actual behavior remains a gap.
- The draft-invoice path is clearly user-visible in `QuotationConfirmModal`, but the curated decisions still center the quotation-to-order process. Treat draft invoice creation as a custom overlay behavior backed by code, not as a baseline generated-window contract.
- Discount, tax, line gross amount, total net amount, and total gross amount are all present in the schema, and retained rules imply recalculation, but there is no browser automation proving how quickly those values refresh or whether they update before save versus only after backend round-trips. That reaction timing is a gap.
- The decisions file keeps a rule that should default `validUntil` from `orderDate`, but the repo evidence reviewed here does not prove that default at browser level. The intended validity-date default therefore remains partially inferred.
- Related documents are clearly enabled for orders, but invoice lookup still depends on quotation-linked downstream data being resolved the way the custom tab expects. Invoice visibility from the quotation tab remains an open ambiguity until exercised against real data.

## Manual verification

1. Open `/sales-quotation` and confirm the list exposes quotation-focused columns and filters rather than a generic placeholder workspace.
2. Create a draft quotation and verify that the header now exposes `Price List`, `Valid Until`, `Payment Method`, and `Payment Terms` as visible form fields.
3. Select a business partner and verify that the partner-address selector becomes scoped to that customer.
4. Set or change the price list, add a line, choose a product, and verify unit price and tax are populated or recalculated as expected for that quotation context.
5. While the quotation is still in `DR`, click the primary top-bar action and verify the send-to-evaluation modal appears, shows quotation totals/line count, and reloads the page into `Under Evaluation` after confirmation.
6. While the quotation is in `UE`, click the primary top-bar action again and verify the confirmation modal offers downstream order creation and draft-invoice creation.
7. Use the under-evaluation confirmation flow to create a downstream document, then verify whether the created order opens in draft after the best-effort reactivation step and whether the quotation remains usable afterward.
8. Open Related Documents after downstream conversion and verify that order chips appear, invoice chips appear when applicable, and each chip navigates to the correct route.
9. Check Duplicate and Cancel from the record menu and confirm whether they perform a real action or remain non-functional placeholders.

## Automated evidence

- App-shell route loading for generated/custom windows is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- Menu visibility for Sales Quotation is grounded in `tools/app-shell/src/menu.json`.
- Window registration is grounded in `tools/app-shell/src/windows/registry.js`, where `sales-quotation` resolves to a custom wrapper over the generated window.
- Header/line fields, selectors, statuses, actions, and retained callout/process expectations are grounded in `origin/develop:artifacts/sales-quotation/contract.json` and `origin/develop:artifacts/sales-quotation/decisions.json` at merge commit `36f10538`.
- Visible header-field changes are grounded in `origin/develop:artifacts/sales-quotation/generated/web/sales-quotation/QuotationForm.jsx` at `36f10538`, where `validUntil` and `paymentTerms` are part of the principal form.
- The draft `DR -> UE` modal flow is grounded in `origin/develop:artifacts/sales-quotation/custom/QuotationTopbarActions.jsx`, `origin/develop:artifacts/sales-quotation/custom/SendToEvaluationModal.jsx`, and `origin/develop:artifacts/sales-quotation/custom/__tests__/SendToEvaluationModal.test.js` at `36f10538`.
- The `UE -> order|draft invoice` conversion flow is grounded in `origin/develop:artifacts/sales-quotation/custom/QuotationConfirmModal.jsx` at `36f10538`.
- Detail-page composition, related-documents wiring, and the still-empty duplicate/cancel handlers are grounded in `origin/develop:artifacts/sales-quotation/generated/web/sales-quotation/QuotationPage.jsx` at `36f10538`.