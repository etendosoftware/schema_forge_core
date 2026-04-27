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
- List interaction: the custom wrapper injects a `CustomQuotationTable` (with `dot: false` on the date column) and a `labelOverrides` that maps `DateOrdered` → "Quotation Date" / "Fecha cotización", overriding the global locale label "Order Date". The visible columns, in order, are: Quotation Date (no dot indicator), Document No., Business Partner, Document Status, Valid Until, and Total Gross Amount. `Valid Until` is placed between Document Status and Total Gross Amount on purpose, so the validity date is adjacent to the total and the user can triage each row by deciding whether the total is still actionable.
- Record interaction: the detail page shows the quotation header form, a child lines table and line form, summary amounts, record status, top-bar actions, and a Related Documents tab.
- Available record-level affordances in current evidence: duplicate and cancel menu entries, a send-document button, and a draft-only confirmation button.

## Reactive behavior and dependencies

- Header dependency: `partnerAddress` is a dependent selector filtered by the selected `businessPartner`, so address choice should narrow after the customer changes.
- Header visibility changed in the merged code: `priceList`, `validUntil`, `paymentMethod`, and `paymentTerms` are now part of the visible quotation header form instead of remaining hidden or collapsed-only fields.
- Header defaulting and callouts: the contract keeps business-partner, address, price-list, order-date, and valid-until callouts. Current evidence supports customer-driven address and price-list autofill expectations, and it still records an intended default of `validUntil = orderDate + 30 days` for new quotations.
- Pricing dependency: line product selection is expected to auto-fill unit price and tax from the active price list according to the retained `Product_AutoFill_Price` rule.
- Line recalculation: quantity, unit price, and discount are expected to recalculate line amounts through the retained `Line_Calc_NetAmount` callout, and saved lines are expected to refresh header totals through the retained `Line_Recalc_Totals` handler.
- Status-driven behavior: editable header fields become read-only when the quotation is processed, the draft-only confirmation button only appears when `documentStatus === 'DR'`, and the generated detail page hides delete/print affordances for completed records.
- Related downstream behavior: the Related Documents tab is intended to surface sales orders and invoices tied to the quotation so the user can navigate into fulfillment and billing from the quotation record.
- Current visible evidence does not show inline formulas or client-side calculators for discount, tax, or totals; the observable design is server-driven recalculation after selector, callout, save, and modal action flows.

## Gap assessment

- Duplicate and Cancel are exposed as menu actions in the detail page, but the generated page currently wires both to empty `onClick` handlers. Their presence is visible; their actual behavior is a gap.
- The detail page includes a draft-only confirmation modal that can create an order or draft invoice, but the documented core conversion rule kept in decisions is specifically quotation-to-order. Draft-invoice creation exists in custom code, yet its business contract is not clearly documented in the curated decisions, so that downstream path remains an open ambiguity.
- Discount, tax, line gross amount, total net amount, and total gross amount are all present in the schema, and retained rules imply recalculation, but there is no browser automation proving how quickly those values refresh or whether they update before save versus only after backend round-trips. That reaction timing is a gap.
- The decisions file keeps a rule that should default `validUntil` from `orderDate`, but the generated form only shows `orderDate` with an explicit default value. The intended validity-date default is therefore not clearly evidenced in the current UI layer.
- Related documents are clearly enabled for orders, but invoice lookup currently queries sales invoices by `salesOrder` using the quotation record id. That may work only if backend linkage matches this assumption; otherwise invoice visibility from the quotation tab is an open ambiguity.
- The line form exposes discount and tax fields, but the current evidence does not show whether price-list changes on the header force existing lines to recalculate. If users expect quotation-wide repricing after changing the header price list, that behavior is not clearly evidenced.

## Manual verification

1. Open `/sales-quotation` and confirm the list exposes quotation-focused columns and filters rather than a generic placeholder workspace.
2. Create a draft quotation and verify that selecting a business partner narrows the partner-address selector to that customer.
3. Set or change the price list, add a line, choose a product, and verify unit price and tax are populated or recalculated as expected for that quotation context.
4. Change quantity, unit price, and discount on a line and verify whether line gross amount, total net amount, and total gross amount refresh immediately, on save, or only after record reload.
5. While the quotation remains in draft, confirm the top bar shows the quotation confirmation action and the send-document action.
6. Use the confirmation flow to create a downstream document, then verify whether the resulting order or invoice opens in the expected status and whether the quotation remains usable afterward.
7. Open Related Documents after downstream conversion and verify that order chips appear, invoice chips appear when applicable, and each chip navigates to the correct route.
8. Check Duplicate and Cancel from the record menu and confirm whether they perform a real action or remain non-functional placeholders.

## Automated evidence

- App-shell route loading for generated/custom windows is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- Menu visibility for Sales Quotation is grounded in `tools/app-shell/src/menu.json`.
- Window registration is grounded in `tools/app-shell/src/windows/registry.js`, where `sales-quotation` resolves to a custom wrapper over the generated window.
- Header/line fields, selectors, actions, related-documents enablement, and retained callout/process expectations are grounded in `artifacts/sales-quotation/contract.json` and `artifacts/sales-quotation/decisions.json`.
- Detail-page composition, including related-documents tab, top-bar actions, summary fields, hidden print/delete behavior, and currently empty duplicate/cancel handlers, is grounded in `artifacts/sales-quotation/generated/web/sales-quotation/QuotationPage.jsx`.
- Draft-only confirmation and send-document behavior are grounded in `artifacts/sales-quotation/custom/QuotationTopbarActions.jsx` and `artifacts/sales-quotation/custom/QuotationConfirmModal.jsx`.
- The only quotation-specific automated test evidence currently observed is source-shape coverage for the top-bar actions component in `artifacts/sales-quotation/custom/__tests__/QuotationTopbarActions.test.js`; no browser-level automation was found for pricing reactions, conversion flow, or related-documents navigation.