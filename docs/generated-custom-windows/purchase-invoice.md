# Purchase Invoice

## Intent

Use this window to register supplier invoices, keep the payable document aligned with its invoice lines, and understand what is still owed before or after payments are registered. The current UI is oriented around three linked concerns: the invoice header, the invoice lines that build the commercial amount, and the payable state exposed through outstanding amounts, schedules, and related payment-out records.

## What this window should allow

- Create and edit a purchase invoice header with the supplier, invoice dates, payment terms, payment method, supplier reference, and other payable-identifying fields.
- Add and review invoice lines so the document reflects what the supplier billed, including product, quantity, unit price, tax, and line gross amount.
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
- List interaction: the list uses a narrowed header table driven by `decisions.json` through the generated `HeaderTable` (the custom wrapper no longer hardcodes a column list). The visible columns, in order, are: Invoice Date, Supplier Reference, Business Partner, Document Status, Total Gross Amount, and Total Outstanding. Selecting a row opens a preview modal instead of navigating directly to the detail route.
- Detail interaction: the record page uses the generated header page with a custom lines table, a custom topbar, summary amounts, notes editing, footer totals, and related-document chips. The internal Document No. field is hidden from the grid and the form; the supplier-side reference (`POReference`, displayed as "Supplier reference"/"Referencia de proveedor") is editable on draft invoices and becomes read-only once the invoice is processed (`@Processed@='Y'`).

## Reactive behavior and dependencies

- Header defaults are visible in the contract for invoice date and accounting date (`@#Date@`), document status (`DR`), currency, and zeroed payable amounts such as total paid and outstanding amount. These defaults matter because a new payable document starts as draft and incomplete before lines and payment activity exist.
- Partner address is a dependent selector filtered by the selected business partner. The business partner also drives header callouts, and the custom page blocks line creation until a business partner is present.
- The purchase order reference is part of the header contract and is used by the custom related-documents surface to show the linked purchase order and to fetch related goods receipts for the same order. The supplier reference (`orderReference`, DB column `POReference`) is a free-text header field surfaced both in the grid and the form so the user can reconcile the invoice against the supplier's own document number; it locks when the invoice is processed.
- The detail bottom panel reacts to summary values by showing subtotal, inferred tax, and total. In the current implementation, tax is not read from a dedicated displayed tax row; it is derived as `grand total - summed lines` in the footer.
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
- Label-override duplication is a known piece of technical debt. Because the custom list wrapper bypasses the generated `HeaderPage`, it has to carry its own `LABEL_OVERRIDES` constant (for example, `POReference: "Supplier reference" / "Referencia de proveedor"`) and forward it into the `ListView`. The same labels are also declared in `decisions.json` for the generated surfaces. Any label change has to be made in both places until the wrapper reuses the generated labels.

## Manual verification

1. Open `/purchase-invoice` and confirm the list shows purchase invoices with invoice date, supplier reference, business partner, document status, total gross amount, and total outstanding in that exact column order, and that the internal document number column is not present.
2. Click a list row and confirm the preview modal opens instead of immediate navigation.
3. In the preview modal, verify the General tab shows total, due/payable state, and payment history, while Messages and History remain placeholder states.
4. Open `/purchase-invoice?filter=overdue` and confirm the quick filter keeps invoices with an outstanding amount.
5. Open a draft invoice detail and confirm adding a line is blocked until a business partner is selected.
6. On the detail page, confirm the custom lines table shows product, invoiced quantity, net unit price, tax, and line gross amount, and that the footer shows subtotal, inferred tax, and total.
7. Open a completed invoice with pending balance and confirm the topbar payment-status pill appears, opens the payment modal, and reflects the invoice as pending or paid based on outstanding amount.
8. From the detail footer or related-documents tab, confirm links are available to the source purchase order, related goods receipts, and downstream payment-out records when those relationships exist.
9. Open a completed purchase invoice detail and confirm the kebab menu exposes a `Reactivate` action. Trigger it and verify the document returns to draft status.
10. From the list, select multiple draft invoices and confirm the bulk-complete action is available; then select multiple completed invoices and confirm the bulk-reactivate action is available. Verify each produces the expected status transition and a result toast.

## Automated evidence

- `tools/app-shell/src/components/contract-ui/BulkDocumentAction.jsx` provides the bulk-action component mounted in the purchase-invoice list selection bar, supporting both CO and RE based on selected row statuses. The `Reactivate` kebab menu action in the detail view is declared in `artifacts/purchase-invoice/decisions.json` with `visibleWhenStatus: "CO"` and `documentAction: "RE"`.
- No dedicated purchase-invoice UI test was found under `tools/app-shell`.
- Shared shell and entity-loading behavior is documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- Contract and UI evidence reviewed for this rewrite:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `artifacts/purchase-invoice/contract.json`
  - `tools/app-shell/src/windows/custom/purchase-invoice/index.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceTopbar.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceBottomPanel.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/InvoicePreviewModal.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/InvoiceLineTableCustom.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/RelatedDocuments.jsx`
  - `tools/app-shell/src/windows/custom/shared/InvoicePaymentModal.jsx`