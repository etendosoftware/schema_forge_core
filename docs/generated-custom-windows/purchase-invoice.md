# Purchase Invoice

## Intent

Use this window to register supplier invoices, keep the payable document aligned with its invoice lines, and understand what is still owed before or after payments are registered. The current UI is oriented around three linked concerns: the invoice header, the invoice lines that build the commercial amount, and the payable state exposed through outstanding amounts, schedules, and related payment-out records.

## What this window should allow

- Create and edit a purchase invoice header with the supplier, invoice dates, payment terms, payment method, the document number captured from the supplier's own invoice (`POReference`, displayed as "Document No." / "Nº documento"), and other payable-identifying fields.
- Add and review invoice lines so the document reflects what the supplier billed, including product, description, quantity, unit price, tax, and line gross amount.
- Review invoice totals at document level, including net amount, gross amount, paid amount, and outstanding amount when those values are available from the header or payment schedule data.
- Inspect the invoice from the list without immediately leaving the list route, then move into full edit mode when needed.
- Understand the payable relationship to the originating purchase order, related goods receipts, and downstream payment-out records.
- Open payment detail flows when the invoice is completed and still has an amount pending.
- Reactivate a completed invoice back to draft from the detail view kebab menu when the invoice status is `CO`.
- Complete multiple draft invoices or reactivate multiple completed invoices at once from the list selection bar using the bulk action.

## Interaction model

- Route: `/purchase-invoice` for the list and `/purchase-invoice/:recordId` for create/edit detail.
- Visibility: visible from the Purchases menu.
- Implementation type: custom window override registered in `tools/app-shell/src/windows/registry.js`, combining generated header/detail scaffolding with custom list preview, topbar, line table, bottom panel, and related-documents behavior.
- Window shape: master-child. The master record is the invoice header and the main child dataset is invoice lines; the detail page also surfaces a custom related-documents tab instead of relying on the generated payment secondary tabs.
- List interaction: the list uses a custom `PurchaseInvoiceHeaderTable` component (`tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceHeaderTable.jsx`). The visible columns, in order, are: Invoice Date (no dot indicator), Document No. (`POReference`, the supplier's own invoice number relabeled from the AD default "Supplier Reference"), Due Date (dot indicator: red if overdue, amber if due today, green if future, computed as the maximum `dueDate` across all payment-plan installments for that invoice via a parallel `paymentPlan?parentId=` batch fetch — shown as "—" when no payment plan exists). Date-only invoice and due-date values are normalized as local calendar dates before rendering so same-day invoices do not shift backward because of timezone conversion, and the final rendered date follows the active app locale just like `Invoice Date`. Business Partner, Document Status, Total Gross Amount, and Total Outstanding complete the list. Selecting a row opens a preview modal instead of navigating directly to the detail route.
- Detail interaction: the record page uses the generated header page with a custom lines table, a custom topbar, summary amounts, notes editing, footer totals, and related-document chips. The internal AD `documentNo` field is hidden from the grid and the form; the supplier's invoice number (`POReference`, displayed as "Document No." / "Nº documento") is editable on draft invoices and becomes read-only once the invoice is processed (`@Processed@='Y'`).

## Reactive behavior and dependencies

- Header defaults are visible in the contract for invoice date and accounting date (`@#Date@`), document status (`DR`), currency, and zeroed payable amounts such as total paid and outstanding amount. These defaults matter because a new payable document starts as draft and incomplete before lines and payment activity exist.
- Partner address is a dependent selector filtered by the selected business partner. The business partner also drives header callouts, and the custom page blocks line creation until a business partner is present.
- The purchase order reference is part of the header contract and is used by the custom related-documents surface to show the linked purchase order and to fetch related goods receipts for the same order. The supplier's invoice number (`orderReference`, DB column `POReference`, displayed as "Document No." / "Nº documento") is a free-text header field surfaced both in the grid and the form so the user can reconcile the invoice against the supplier's own paper document; it locks when the invoice is processed.
- The detail bottom panel reacts to summary values by showing subtotal, inferred tax, and total. In the current implementation, tax is not read from a dedicated displayed tax row; it is derived as `grand total - summed lines` in the footer.
- The line `tax` field is now a dropdown selector (Radix Select) instead of a free-text search input. The list of available taxes is loaded server-side via `GET /sws/neo/purchase-invoice/lines/selectors/C_Tax_ID` and is filtered by `IsSOTrx=N` (purchase taxes) and by the `VAL_Tax_IsSOTrx_Date` validation rule, which keeps only taxes whose `VALIDFROM` is on or before the invoice date (`COALESCE(@DateInvoiced@, @DateOrdered@)`). Previously this field rendered as a text search that always returned "Sin resultados" because the validation rule context was not populated.
- The preview modal and the detail topbar both treat the invoice as a payable document. They read payment-plan and payment/payment-history data to show paid versus outstanding state, and they expose payment actions only when the invoice is completed and still has an outstanding balance.
- The detail topbar shows a payment-status pill only for completed invoices. The pill label and amount react to whether the invoice is fully paid or still pending, and clicking it opens the shared invoice payment modal.
- Related payment records are downstream dependencies, not free-form links. The custom related-documents component resolves payment-out documents through payment-plan and payment-detail relationships, then links users to `/payment-out/:id`.
- The preview modal has General, Messages, and History tabs, but only the General tab is backed by invoice/payment data in current evidence. Messages and History are present as empty states.
- The preview modal also includes a document upload/drop area for purchase invoices, but the current evidence shows only local file preview behavior in the browser; no persisted attachment workflow is visible here.

## Gap assessment

- The UI clearly presents payable amounts and payment registration entry points, but the exact accounting consequences of adding or updating payments are not documented in this window evidence. Treat downstream posting semantics as backend behavior, not confirmed UI behavior here.
- The footer shows tax by subtracting subtotal from total. That is a useful display shortcut, but it is not proof that invoice tax rows, discounts, withholding, or other tax adjustments are fully represented in this custom surface, even though the contract exposes tax-related entities.
- Payment-plan and payment-detail entities exist in the contract and power the custom payment views, but this window does not expose those datasets as first-class editable tabs. If users need schedule editing beyond the modal flows, that remains an open UX gap in current evidence.
- Messages, History, and email history are placeholders today. The business intent suggests traceability around supplier communications and payable events, but the current implementation does not show persisted conversation or activity feeds.
- The purchase-invoice preview supports local document upload/preview, but there is no visible evidence that uploaded files are saved, classified, or linked back to the invoice record.
- No dedicated purchase-invoice automated UI test was found, so the payable flow is code-backed but still relies on manual verification for end-to-end confidence.
- Label-override duplication is a known piece of technical debt. Because the custom list wrapper bypasses the generated `HeaderPage`, it has to carry its own `LABEL_OVERRIDES` constant (currently `POReference: "Document No." / "Nº documento"`) and forward it into the `ListView`. The same labels are also declared in `decisions.json` for the generated surfaces. Any label change has to be made in both places until the wrapper reuses the generated labels.
- Header-date format reformatting for the tax selector context lives in a generic component, `tools/app-shell/src/components/contract-ui/DetailView.jsx`, which converts the ISO `YYYY-MM-DD` invoice date into the `DD-MM-YYYY` form that Etendo Classic's PL/pgSQL `to_date()` expects before sending it as `DateInvoiced` in the selector context. This is technical debt to keep in mind: any future change to date handling has to consider both formats, because sending the raw ISO date triggers HTTP 500 with "date/time field value out of range".

## Manual verification

1. Open `/purchase-invoice` and confirm the list shows: Invoice Date (no dot), Document No. ("Nº documento" in ES — this column is the supplier's invoice number, `POReference`, not the internal AD `documentNo`), Due Date (red dot if overdue / amber dot if due today / green dot if future / "—" if no payment plan), Business Partner, Document Status, Total Gross Amount, and Total Outstanding in that exact column order, and that the internal AD document number column is not present. Also confirm date-only values keep their original calendar day when rendered.
2. Click a list row and confirm the preview modal opens instead of immediate navigation.
3. In the preview modal, verify the General tab shows total, due/payable state, and payment history, while Messages and History remain placeholder states.
4. Open `/purchase-invoice?filter=overdue` and confirm the quick filter keeps invoices with an outstanding amount.
5. Open a draft invoice detail and confirm adding a line is blocked until a business partner is selected.
6. On the detail page, confirm the custom lines table shows product, description, invoiced quantity, net unit price, tax, and line gross amount in that exact column order, and that the footer shows subtotal, inferred tax, and total. Open a line for edit and confirm the `Impuesto`/`Tax` field opens a dropdown listing the configured purchase taxes (filtered by `IsSOTrx=N` and validity against the invoice date), not a free-text search that returns "Sin resultados".
7. Open a completed invoice with pending balance and confirm the topbar payment-status pill appears, opens the payment modal, and reflects the invoice as pending or paid based on outstanding amount.
8. From the detail footer or related-documents tab, confirm links are available to the source purchase order, related goods receipts, and downstream payment-out records when those relationships exist.
9. Open a completed purchase invoice detail and confirm the kebab menu exposes a `Reactivate` action. Trigger it and verify the document returns to draft status.
10. From the list, select multiple draft invoices and confirm the bulk-complete action is available; then select multiple completed invoices and confirm the bulk-reactivate action is available. Verify each produces the expected status transition and a result toast.

## Automated evidence

- `tools/app-shell/src/components/contract-ui/BulkDocumentAction.jsx` provides the bulk-action component mounted in the purchase-invoice list selection bar, supporting both CO and RE based on selected row statuses. The `Reactivate` kebab menu action in the detail view is declared in `artifacts/purchase-invoice/decisions.json` with `visibleWhenStatus: "CO"` and `documentAction: "RE"`.
- `tools/app-shell/src/lib/__tests__/dateOnly.test.js`, `tools/app-shell/src/lib/__tests__/invoiceDueDate.test.js`, and `tools/app-shell/src/windows/custom/purchase-invoice/__tests__/PurchaseInvoiceHeaderTable.test.js` provide source-level and helper-level regression coverage for due-date calendar normalization, locale formatting, max-installment selection, and status-dot rendering in the purchase-invoice list.
- Shared shell and entity-loading behavior is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- Contract and UI evidence reviewed for this rewrite:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `artifacts/purchase-invoice/contract.json`
  - `tools/app-shell/src/windows/custom/purchase-invoice/index.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceTopbar.jsx` — the payment-status pill (paid/pending amounts) formats monetary values using the org's configured currency via `useCurrency()` and `formatCurrency()`.
  - `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceBottomPanel.jsx` — subtotal, inferred tax, and total in the footer are formatted using the org's configured currency via `useCurrency()` and `formatCurrency()`.
  - `tools/app-shell/src/windows/custom/purchase-invoice/InvoicePreviewModal.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/InvoiceLineTableCustom.jsx` — hardcoded column list: product, description, invoiced quantity, net unit price, tax, line gross amount. The `unitPrice` column uses `type: 'amount'` and rows are enriched with `currency$_identifier` from `useCurrency()` so the net unit price renders as a formatted currency value (e.g. `23,00 €`) rather than a raw number.
  - `tools/app-shell/src/windows/custom/purchase-invoice/RelatedDocuments.jsx`
  - `tools/app-shell/src/windows/custom/shared/InvoicePaymentModal.jsx`
