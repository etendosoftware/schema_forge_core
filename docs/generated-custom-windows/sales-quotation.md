# Sales Quotation

## Intent

Let a sales user prepare a customer quotation, review commercial terms before commitment, and turn an accepted quotation into a downstream sales document without re-entering the header and line data.

## What this window should allow

- Create and review quotation headers with customer, quotation date, validity date, address, price list, payment method, payment terms, notes, and read-only commercial totals.
- Add, edit, and remove quotation lines with product, description, quantity, Net List Price, discount, tax, and line gross amount.
- Keep the quotation in draft while the commercial proposal is being prepared, then explicitly send that draft into an `Under Evaluation` state before final conversion.
- From `Under Evaluation`, create a downstream sales order and, in the current custom overlay, optionally create a draft sales invoice.
- Send the quotation document from the record view.
- Inspect related downstream sales orders and invoices from the quotation record when those documents exist.

## Interaction model

- Route: `/sales-quotation` for the list and `/sales-quotation/:recordId` for the record workspace.
- Visibility: visible from the Sales menu under the Commercial section.
- Implementation type: custom window wrapper over the generated quotation page.
- Window shape: master-child, with `quotation` as the header entity and `quotationLine` as the child entity.
- List interaction: the custom wrapper injects a `CustomQuotationTable` (with `dot: false` on the date column) and a `labelOverrides` that maps `DateOrdered` → "Quotation Date" / "Fecha cotización", overriding the global locale label "Order Date". The visible columns, in order, are: Quotation Date (no dot indicator), Document No., Business Partner, Document Status, Valid Until, and Total Gross Amount. `Valid Until` is placed between Document Status and Total Gross Amount on purpose, so the validity date is adjacent to the total and the user can triage each row by deciding whether the total is still actionable. The wrapper also enables clone-from-grid via the shared `CloneOrderModal` and feeds a `refreshTrigger` counter into the generated `ListView`, so when the user closes the clone result modal the list auto-refreshes and the new draft quotations show up without a manual reload.
- Record interaction: the detail page shows the quotation header form, a child lines table and line form, summary amounts, record status, top-bar actions, and a Related Documents tab.
- Available record-level affordances in current evidence: duplicate and cancel menu entries, a send-document button, and a draft-only confirmation button.

## Reactive behavior and dependencies

- Header dependency: `partnerAddress` is a dependent selector filtered by the selected `businessPartner`, so address choice should narrow after the customer changes.
- Header visibility changed in the merged code: `priceList`, `validUntil`, `paymentMethod`, and `paymentTerms` are now part of the visible quotation header form instead of remaining hidden or collapsed-only fields.
- User-touched field protection on the header form: when the user manually changes an FK field after a callout has already set it (typical case: `paymentTerms` set to "30 días" by the `businessPartner` callout, then changed by the user), follow-up callouts triggered by other fields cannot overwrite that value. The guard lives in `DetailView.jsx` (`userTouchedRef`) and resets when `recordId` changes, so each new or freshly loaded record starts clean. The current callout's trigger field still wins because it represents the user's most recent action.
- Persisted payment-term changes: the `etgo_sf_field` row for `paymentTerms` was historically marked `IsReadOnly=Y`, which made `NeoFieldFilter.filterWriteRequest` strip the field from PATCH bodies and silently drop user changes. The row is now `IsReadOnly=N` (kept in sync via `push-to-neo` and the exported XML in `com.etendoerp.go`), so editing `paymentTerms` on an existing draft quotation actually persists.
- POST-create cascade no longer overwrites user-set FK values: `NeoCrudHandler.executePostCreate` snapshots the keys submitted in the request body before `injectMandatoryDefaults` runs, and passes them as `protectedFields` into the post-create callout cascade. The cascade can still refine missing/derived fields, but it no longer flips `paymentTerms` (or any other user-set field) back to the business-partner default during the initial save.
- Header defaulting and callouts: the contract keeps business-partner, address, price-list, order-date, and valid-until callouts. Current evidence supports customer-driven address and price-list autofill expectations, and it also records an intended default of `validUntil = orderDate + 30 days` for new quotations.
- Pricing dependency: line product selection auto-fills `listPrice` (Net List Price), `tax`, `uOM`, `grossUnitPrice`, and `discount` from the active price list via the `SL_Order_Product` callout. The `forceCalloutFields: ["listPrice","unitPrice","tax","uOM","grossUnitPrice","discount"]` declaration on the `product` field bypasses the `touchedFieldsRef` guard so callout-returned values are applied even when the user has not directly touched those fields. `discount` is included because product/price-list callouts may return a customer- or product-specific discount on product selection. The Classic callout returns the price as `standardPrice` (PriceStd); `DetailView.jsx` maps it to `listPrice` when the callout zeroes out the `listPrice` field.
- Line recalculation — client-side model (ETP-3662): `orderedQuantity`, `listPrice`, and `discount` changes are computed entirely in the browser via `useLineGrossAmount` — no callout round-trip is fired for those fields. The formula is `lineGrossAmount = orderedQuantity × listPrice × (1 − discount/100) × taxFactor`, where `taxFactor` is resolved from (in priority order) the product callout response, the tax selector aux data, an in-memory cache, or a ratio derived from sibling lines. The `tax` field still fires a callout (to obtain `taxRate`), but `orderedQuantity`, `listPrice`, and `discount` are pure client-side. After save, `unitPrice = listPrice × (1 − discount/100)` is injected into the POST body as Classic's `priceActual`; `lineGrossAmount` is trusted by `NeoDefaultsService` and stored as-is. Saved lines trigger the `Line_Recalc_Totals` event handler to refresh header totals.
- Status-driven behavior: editable header fields become read-only when the quotation is processed, the draft-only confirmation button only appears when `documentStatus === 'DR'`, and the generated detail page hides delete/print affordances for completed records.
- Related downstream behavior: the Related Documents tab is intended to surface sales orders and invoices tied to the quotation so the user can navigate into fulfillment and billing from the quotation record.
- Line amount recalculation for `orderedQuantity`, `listPrice`, and `discount` is client-side and instantaneous — no server round-trip is required. The `tax` field change still fires a callout (to obtain `taxRate` and update `lineGrossAmount` via the same `useLineGrossAmount` hook), and product selection fires a callout to fill price, tax, and UOM. Header total fields (`summedLineAmount`, `grandTotalAmount`) refresh only after save, since they are computed server-side by the `Line_Recalc_Totals` event handler.

## Invoice creation flow

The "Facturar directamente" action on the confirmation modal calls
`POST /sws/neo/sales-quotation/header/{id}/action/createDraftInvoice`, routed
to `CreateDraftInvoiceHandler` in `com.etendoerp.go`. The handler reuses the
sales-order code path: it copies the quotation header (business partner,
currency, payment terms, price list) and the lines (product, quantity, prices)
into a new sales invoice in `DR` (Draft) status via the native
`CreateInvoiceLinesFromProcess`.

After the invoice is persisted, the source quotation's DocStatus is set to
`ETGO_CI` ("Closed - Invoice Created") via a direct OBDal write. This mirrors
the standard Etendo pattern in `ConvertQuotationIntoOrder`, which sets DocStatus
to `CA` ("Closed - Order Created") when an order is generated from a
quotation. The transition is performed without invoking `C_Order_Post`, so it
is immune to the `@AlreadyPosted@` raised by that stored procedure regardless
of the quotation's `Processed` flag or prior status.

The line quantity invoiced is `orderedQuantity − invoicedQuantity` per line.
Lines whose pending is zero are skipped; if every line is fully invoiced, the
handler returns HTTP 400 with "No hay líneas a facturar en este pedido".

## Gap assessment

- Duplicate and Cancel are exposed as menu actions in the detail page, but the generated page currently wires both to empty `onClick` handlers. Their presence is visible; their actual behavior is a gap.
- The detail page includes a draft-only confirmation modal that can create an order or draft invoice. Quotation-to-order remains the documented core conversion rule kept in decisions; the quotation-to-draft-invoice path is implemented in `CreateDraftInvoiceHandler` (com.etendoerp.go) by mirroring the sales-order branch — see "Invoice creation flow" above. However, the business contract for draft-invoice creation is not clearly documented in the curated decisions, so that downstream path remains an open ambiguity.
- `lineGrossAmount` updates instantly in the grid on every `orderedQuantity`, `listPrice`, or `discount` keystroke (client-side). Header totals (`summedLineAmount`, `grandTotalAmount`) only refresh after a line save — that timing gap is expected and not a bug.
- The decisions file keeps a rule that should default `validUntil` from `orderDate`, but the generated form only shows `orderDate` with an explicit default value. The intended validity-date default is therefore not clearly evidenced in the current UI layer.
- Related documents are clearly enabled for orders, but invoice lookup currently queries sales invoices by `salesOrder` using the quotation record id. That may work only if backend linkage matches this assumption; otherwise invoice visibility from the quotation tab is an open ambiguity.
- The line form exposes discount and tax fields, but the current evidence does not show whether price-list changes on the header force existing lines to recalculate. If users expect quotation-wide repricing after changing the header price list, that behavior is not clearly evidenced.

## Manual verification

1. Open `/sales-quotation` and confirm the list exposes quotation-focused columns and filters rather than a generic placeholder workspace.
2. Create a draft quotation and verify that selecting a business partner narrows the partner-address selector to that customer.
3. Set or change the price list, add a line, choose a product, and verify that Net List Price and tax are auto-filled from the price list. Confirm `lineGrossAmount` appears immediately (before save) using `qty × listPrice × (1 − discount/100) × taxFactor`.
4. Change quantity, Net List Price, and discount on a line and verify that `lineGrossAmount` refreshes instantly in the grid without a server round-trip. Verify that header totals (`Subtotal`, `Tax`, `Total`) update only after saving the line.
5. While the quotation remains in draft, confirm the top bar shows the quotation confirmation action and the send-document action.
6. Use the confirmation flow to create a downstream document, then verify whether the resulting order or invoice opens in the expected status and whether the quotation remains usable afterward.
7. Open Related Documents after downstream conversion and verify that order chips appear, invoice chips appear when applicable, and each chip navigates to the correct route.
8. Check Duplicate and Cancel from the record menu and confirm whether they perform a real action or remain non-functional placeholders.
9. From the list view, select one or more quotations, run `Clone`, close the result modal and confirm the cloned drafts appear in the list without manually pressing `Refresh`.
10. On a draft quotation with a business partner already chosen, change `Payment Terms` to a different value than the BP default and save. Reopen the record and confirm the chosen value persisted (regression: it used to revert to the BP default).

## Automated evidence

- App-shell route loading for generated/custom windows is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- Menu visibility for Sales Quotation is grounded in `tools/app-shell/src/menu.json`.
- Window registration is grounded in `tools/app-shell/src/windows/registry.js`, where `sales-quotation` resolves to a custom wrapper over the generated window.
- Header/line fields, selectors, actions, related-documents enablement, and retained callout/process expectations are grounded in `artifacts/sales-quotation/contract.json` and `artifacts/sales-quotation/decisions.json`.
- Detail-page composition, including related-documents tab, top-bar actions, summary fields, hidden print/delete behavior, and currently empty duplicate/cancel handlers, is grounded in `artifacts/sales-quotation/generated/web/sales-quotation/QuotationPage.jsx`.
- Draft-only confirmation and send-document behavior are grounded in `artifacts/sales-quotation/custom/QuotationTopbarActions.jsx` and `artifacts/sales-quotation/custom/QuotationConfirmModal.jsx`.
- The only quotation-specific automated test evidence currently observed is source-shape coverage for the top-bar actions component in `artifacts/sales-quotation/custom/__tests__/QuotationTopbarActions.test.js`; no browser-level automation was found for pricing reactions, conversion flow, or related-documents navigation.
- `artifacts/sales-quotation/generated/web/sales-quotation/LinesTable.jsx` — the `unitPrice` column (`PriceActual`) uses `type: 'amount'` so the net unit price renders as a formatted currency value rather than a raw number.