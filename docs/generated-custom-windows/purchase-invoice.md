# Purchase Invoice

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It stays focused on purchase-invoice-specific behavior and does not repeat shared shell concerns such as authentication, generic route protection, embedded mode, or common `useEntity` loading semantics.

- Purpose / surface: Register supplier invoices, edit invoice lines, inspect payment state, and jump between the invoice, its purchase order, receipts, and payments.
- Route: `/purchase-invoice`, `/purchase-invoice/:recordId`
- Visibility: Visible in the Purchases menu.
- Implementation: Custom window override in `tools/app-shell/src/windows/registry.js`.

## Key functional cues

- The contract defines a default-layout invoice header on `C_Invoice`, marks the window as `relatedDocuments: true`, and exposes several child datasets: `lines`, `intrastat`, `paymentPlan`, and `paymentDetails`.
- The main invoice detail remains header-plus-lines, but the custom UI deliberately reshapes how users consume it:
  - the list view uses a compact custom table with document number, invoice date, business partner, status, and gross total
  - clicking a list row opens a preview modal instead of immediately navigating away
  - the detail route uses a custom topbar, bottom panel, custom related-documents tab, and a narrowed line table
- The list accepts two meaningful entry filters:
  - `?DocStatus=<status>` pre-filters the list by document status.
  - `?filter=overdue` activates the custom quick filter that keeps only invoices with a remaining outstanding amount.
- The preview modal is a notable custom surface. It includes **General**, **Messages**, and **History** tabs, exposes edit/send/download actions, fetches payment-plan and invoice-payment data, and shows invoice totals plus payment progress without leaving the list route.
- In the current implementation, **Messages** and **History** are placeholder empty states rather than backed conversation or audit feeds.
- The detail route uses a custom line table with product, invoiced quantity, net unit price, tax, and line gross amount.
- New lines are guarded until the invoice has a business partner (`addLineGuard`).
- The detail topbar exposes two notable custom behaviors:
  - **Clone** on record pages
  - a payment-status pill on completed invoices; clicking it opens the payment modal
- The bottom panel combines three functional surfaces in one place: related-document chips, inline notes editing, and subtotal/tax/total rollups.
- The custom related-documents component links to the source purchase order, sibling goods receipts, and payment-out records.
- The contract exposes payment-plan and payment-detail datasets, and the custom UI uses those datasets to power payment summaries and payment dialogs instead of relying on generic secondary tabs.

## Manual verification

1. Open `/purchase-invoice` and click a row. Confirm a preview modal opens from the list view instead of immediately navigating to the detail route.
2. In that preview modal, switch between **General**, **Messages**, and **History** and confirm only the General tab is data-backed today while the other two remain placeholder states.
3. Open `/purchase-invoice?filter=overdue` and confirm the quick filter keeps invoices with an outstanding balance.
4. From the preview modal, choose **Edit** and confirm the browser navigates to `/purchase-invoice/:recordId`.
5. On the detail route, confirm the line table uses the custom invoice columns and that adding a line is blocked until a business partner is selected.
6. On a completed invoice, click the payment-status pill and confirm the payment modal opens with invoice-specific payment context.
7. In the detail footer or related-documents tab, confirm linked chips route to the source purchase order, related goods receipts, and payment-out records.

## Automated evidence

- No dedicated purchase-invoice UI test was found in `tools/app-shell`.
- Shared route/loading coverage and generic entity behavior are documented in [app-shell-functional-flows.md](app-shell-functional-flows.md).
- Evidence sources:
  - `tools/app-shell/src/menu.json`
  - `tools/app-shell/src/windows/registry.js`
  - `artifacts/purchase-invoice/contract.json`
  - `tools/app-shell/src/windows/custom/purchase-invoice/index.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceTopbar.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/PurchaseInvoiceBottomPanel.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/InvoicePreviewModal.jsx`
  - `tools/app-shell/src/windows/custom/purchase-invoice/RelatedDocuments.jsx`
