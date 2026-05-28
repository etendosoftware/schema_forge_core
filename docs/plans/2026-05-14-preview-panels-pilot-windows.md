# Preview Panels — Pilot Windows (Sales Quotation, Sales Order, Purchase Order)

**Jira:** ETP-3951 (continuation)
**Status:** ✅ Complete
**Owner:** Forge team
**Started:** 2026-05-14
**Completed:** 2026-05-18
**Branch:** feature/ETP-3951

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture As-Built](#2-architecture-as-built)
3. [Phase 0 — Shared PDF Infrastructure](#phase-0--shared-pdf-infrastructure-)
4. [Phase 1 — OrderPreview (Sales Order + Purchase Order)](#phase-1--orderpreview-sales-order--purchase-order-)
5. [Phase 2 — QuotationPreview (Sales Quotation)](#phase-2--quotationpreview-sales-quotation-)
6. [Phase 3 — E2E Tests + decisions.json](#phase-3--e2e-tests--decisionsjson-)
7. [Phase 4 — Shared Preview Cards + Bug Fixes](#phase-4--shared-preview-cards--bug-fixes-)
8. [Post-implementation Fixes](#post-implementation-fixes)
9. [File Inventory](#file-inventory)
10. [i18n Keys Added](#i18n-keys-added)
11. [Risks and Constraints](#risks-and-constraints)
12. [Out of Scope](#out-of-scope)

---

## 1. Problem Statement

`GenericPreviewModal` and `InvoicePreview` were built as part of ETP-3951 Phase 1/2 and are live on Sales Invoice and Purchase Invoice. The three remaining pilot windows — Sales Quotation, Sales Order, Purchase Order — still navigated to the detail form on row click. Each required a preview panel consistent with the established design:

- **Sales Quotation:** lateral panel with PDF (generated via jsreport), summary card, actions, emails.
- **Sales Order:** lateral panel with PDF (same generation approach), summary card, actions, emails.
- **Purchase Order:** lateral panel — right panel only (no PDF, no drop zone), summary card, actions.

Additionally, `useInvoicePdf.js` had all PDF rendering machinery hardcoded for `sales-invoice`. Each document type now has its own independent hook file so templates can diverge independently.

---

## 2. Architecture As-Built

```
sales-order/index.jsx
  └─ <ListView renderPreview={renderPreview} (useCallback)>
       └─ <OrderPreview specName="sales-order" ...>
            ├─ useOrderPdf(id, apiBaseUrl, token) → pdfBlob
            └─ <GenericPreviewModal leftPanel=<PdfViewer> attachmentConfig={storeCondition: !isDraft} ...>

purchase-order/index.jsx
  └─ <ListView renderPreview={renderPreview} (useCallback)>
       └─ <OrderPreview specName="purchase-order" ...>
            └─ <GenericPreviewModal leftPanel=undefined attachmentConfig={storeCondition:false}
                 width=380px (auto when no leftPanel)>

sales-quotation/index.jsx
  └─ GeneratedApp {...rest includes renderPreview (useCallback) + rowQuickActions}
       └─ QuotationPage {...props}
            └─ <ListView>
                 └─ <QuotationPreview ...>
                      ├─ useQuotationPdf(id, apiBaseUrl, token) → pdfBlob
                      └─ <GenericPreviewModal leftPanel=<PdfViewer> attachmentConfig={storeCondition: !isDraft} ...>

documentPdf.js  ← shared: TEMPLATE, CSS, HELPERS, renderDocumentPdf, fetch helpers
useOrderPdf.js      ← imports documentPdf.js, own buildOrderData()
useQuotationPdf.js  ← imports documentPdf.js, own buildQuotationData()
useInvoicePdf.js    ← refactored to import documentPdf.js, same public interface

preview-cards/
  SummaryCard.jsx         ← all 5 windows
  PaymentsCard.jsx        ← invoices only
  EmailsCard.jsx          ← all 5 windows
  CategorizationCard.jsx  ← invoices only (hidden via rows=[] for orders/quotations)
```

### 2.1 PDF caching strategy (final, as-built)

The caching condition is `!isDraft` (`documentStatus !== 'DR'`) across **all** document types. This supersedes the initial plan which only cached on completed statuses.

| Window | Draft (`DR`) | Any other status |
|--------|-------------|-----------------|
| Sales Invoice | Live PDF, no cache | Cached in `ETGO_PREVIEW_FILE` |
| Purchase Invoice | N/A (drop zone) | Drop zone → stored in `ETGO_PREVIEW_FILE` |
| Sales Order | Live PDF, no cache | Cached in `ETGO_PREVIEW_FILE` |
| Purchase Order | Live PDF, no cache | Cached in `ETGO_PREVIEW_FILE` |
| Sales Quotation | Live PDF, no cache | Cached in `ETGO_PREVIEW_FILE` |

**Rationale:** Quotations have many non-draft, non-completed statuses (`UE`, `IP`, etc.) that should benefit from caching on first open and serve from storage on subsequent opens.

### 2.2 Left panel behavior (as-built)

```
Sales Quotation / Sales Order — draft:
  leftPanel = <PdfViewer />
  attachmentConfig = { storeCondition: false }   → modal uses leftPanel as-is

Sales Quotation / Sales Order — non-draft:
  leftPanel = <PdfViewer />                      → fallback while caching
  attachmentConfig = {
    storeCondition: true,
    sourceBlob: pdfBlob,
    autoFetch: true,
  }

Purchase Order — draft:
  leftPanel = <PdfViewer />
  attachmentConfig = { storeCondition: false }   → modal uses leftPanel as-is

Purchase Order — non-draft:
  leftPanel = <PdfViewer />                      → fallback while caching
  attachmentConfig = {
    storeCondition: true,
    sourceBlob: pdfBlob,
    autoFetch: true,
  }
```

### 2.3 Sales-quotation prop passthrough

`sales-quotation/index.jsx` passes `rowQuickActions`, `renderPreview`, `externalPreviewRow`, `onExternalPreviewClose` via `{...rest}` → `GeneratedApp` → `QuotationPage` → `ListView`. Works because `QuotationPage.jsx` (generated) spreads `{...props}` after its own `rowQuickActions={{}}`:

```jsx
<ListView
  rowQuickActions={{}}   // hardcoded by generator
  {...props}             // wins — overrides rowQuickActions
/>
```

This survives pipeline re-runs as long as `{...props}` stays last in the ListView spread.

### 2.4 Status label resolution

All preview windows use `statusLabel(code, null, ui)` from `@/lib/statusBadge.js` to resolve status codes to human-readable labels, and `getStatusBadgeProps(code)` for the badge variant/color. Raw `$_identifier` values from the API are not used for display (they reflect Etendo AD language, not app locale).

### 2.5 RelatedDocumentsCard placement

`RelatedDocumentsCard` is placed in the General tab of the preview panel, below `CategorizationCard`. It is shown for Sales Order and Sales Quotation only. Purchase Order does not include it.

The card accepts a `specs` array of fetch descriptors and an optional `fetchExtra` callback. Each spec fetches records via the NEO Headless API and renders them as document rows (icon, document number, amount, `StatusTag` status pill). A refresh button on the card header re-triggers all fetches in parallel. The card returns `null` when `specs` is empty or undefined, so passing no specs safely hides it.

---

## Phase 0 — Shared PDF Infrastructure ✅

### Piece 0-A — `documentPdf.js` ✅

**File:** `tools/app-shell/src/windows/custom/shared/documentPdf.js`

Exports: `DOCUMENT_HELPERS`, `DOCUMENT_CSS`, `DOCUMENT_TEMPLATE`, `fetchJson`, `fetchAll`, `fetchOptionalJson`, `fetchLocationAddress`, `blobToDataUrl`, `fetchImageDataUrl`, `renderDocumentPdf`.

Template key `{{labels.documentSection}}` (not `invoiceSection`) — each hook's labels object maps its own i18n key to `documentSection`. Includes `{{#if validUntil}}` conditional row (only set by quotation hook).

### Piece 0-B — Refactor `useInvoicePdf.js` ✅

Imports shared functions from `documentPdf.js`. Public interface unchanged: `useInvoicePdf(invoiceId, apiBaseUrl, token)` → `{ pdfUrl, pdfBlob, loading, error }`.

---

## Phase 1 — OrderPreview (Sales Order + Purchase Order) ✅

### Piece 1-A — `useOrderPdf.js` ✅

**File:** `tools/app-shell/src/windows/custom/shared/useOrderPdf.js`

Fetches `${base}/sales-order/header/${orderId}` and `${base}/sales-order/lines?parentId=${orderId}`. Maps `header.orderDate` → `invoiceDate` (template key reuse). No `validUntil`. Labels: `documentSection: ui('orderPdfSection')`.

Guard: returns early if `!orderId || !apiBaseUrl || !token`.

### Piece 1-B — `OrderPreview.jsx` ✅

**File:** `tools/app-shell/src/windows/custom/shared/OrderPreview.jsx`

- `isSalesOrder = specName === 'sales-order'`
- `useOrderPdf` always called (React rules), guarded by `isSalesOrder ? order?.id : null`
- `usePurchaseOrderPdf` always called (React rules), guarded by `!isSalesOrder ? order?.id : null`
- `leftPanel`: `<PdfViewer ...>` for both SO and PO (using the respective hook's `pdfUrl`)
- `isDraft = order?.documentStatus === 'DR'`
- Both SO and PO `attachmentConfig`: `!isDraft → storeCondition: true, sourceBlob: pdfBlob, autoFetch: true` / `isDraft → storeCondition: false`
- `RelatedDocumentsCard` added to `OrderGeneralTab` for Sales Order only (specs: shipments, invoices, chained payment-in)
- Tabs: General (`OrderGeneralTab` with shared cards), Messages, History

### Piece 1-C — Wire `sales-order/index.jsx` ✅

Added: `renderPreview` (memoized with `useCallback`), `documentPreview: true` in `rowQuickActions`, `savedRecord`/`effectiveRecord`/`clearSavedRecord` pattern, `externalPreviewRow`, `onExternalPreviewClose`.

### Piece 1-D — Wire `purchase-order/index.jsx` ✅

Identical changes. `specName="purchase-order"`.

---

## Phase 2 — QuotationPreview (Sales Quotation) ✅

### Piece 2-A — `useQuotationPdf.js` ✅

**File:** `tools/app-shell/src/windows/custom/shared/useQuotationPdf.js`

Fetches `${base}/sales-quotation/quotation/${quotationId}` (entity `quotation`, NOT `header`) and `${base}/sales-quotation/quotationLine?parentId=${quotationId}`. Sets `validUntil: header.validUntil || null` — triggers `{{#if validUntil}}` row in the PDF template.

### Piece 2-B — `QuotationPreview.jsx` ✅

**File:** `tools/app-shell/src/windows/custom/shared/QuotationPreview.jsx`

- Always shows PDF left panel
- `isDraft = quotation.documentStatus === 'DR'`
- `attachmentConfig`: `!isDraft → storeCondition: true, sourceBlob: pdfBlob, autoFetch: true`
- Tabs: General (`QuotationGeneralTab` with shared cards), Messages, Related

### Piece 2-C — Wire `sales-quotation/index.jsx` ✅

Added: `renderPreview` (memoized with `useCallback`), custom `rowQuickActions` with `documentPreview: true` and `menuActions` for Reject, `useRowDelete` with `entity: 'quotation'`, `savedRecord` pattern.

**Bug fixed:** `CustomQuotationTable` had `useMemo(..., [ui])` where `useUI()` returns a new function reference every render → infinite re-render loop. Fixed by using `dictionary` from `useLocale()` as the stable memo dependency instead of `ui`.

---

## Phase 3 — E2E Tests + decisions.json ✅

### Piece 3-A — `row-quick-actions.mocked.spec.js` ✅

- Added `'sales-quotation'` to `FIELDS` and `SPECS`
- `FIELDS['sales-quotation']`: `entityPath: 'quotation'`, extra with `orderDate`, `validUntil`, `grandTotalAmount`
- `installListMock` updated: `const entityPath = cfg.entityPath ?? 'header'` — used in route pattern, list discriminator, and detail ID extractor regex
- Added `test.describe('Preview panel — row click opens preview')` covering `['sales-order', 'purchase-order', 'sales-quotation']`
- Close button: `getByRole('button', { name: /cerrar|close/i })` (both locales)

### Piece 3-B — `decisions.json` annotations ✅

Added `window.preview` annotation (documentation only, not read by generator) to:
- `artifacts/sales-order/decisions.json`
- `artifacts/purchase-order/decisions.json`
- `artifacts/sales-quotation/decisions.json`

---

## Phase 4 — Shared Preview Cards + Bug Fixes ✅

### Card component matrix (as-built)

| Card | Sales Invoice | Purchase Invoice | Sales Order | Purchase Order | Sales Quotation |
|------|:---:|:---:|:---:|:---:|:---:|
| `SummaryCard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PaymentsCard` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `EmailsCard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CategorizationCard` | ✅ | ✅ | ❌ (rows=[]) | ❌ (rows=[]) | ❌ (rows=[]) |
| `RelatedDocumentsCard` | ❌ | ❌ | ✅ (SO only) | ❌ | ✅ |

`CategorizationCard` renders `null` when `rows.length === 0`. Orders and quotations pass `rows={[]}`, so the card is hidden. Invoices pass the accounting account row.

### Piece 4-A — `SummaryCard.jsx` ✅

**File:** `tools/app-shell/src/windows/custom/shared/preview-cards/SummaryCard.jsx`

Props: `currencyCode`, `grandTotal`, `contact`, `date`, `statusCode`, `statusLabel`, `validUntil?`, `dueDate?`, `invoicePercent?`, `deliveryPercent?`, `children?`.

- Status badge uses `getStatusBadgeProps(statusCode)` from `@/lib/statusBadge.js` (full color semantics: green for CO/CA/etc., blue for CL/PA, red for VO/CJ, amber for IP, etc.)
- `dueDate` prop renders between Date and Status (before Status badge) — used by invoices
- `validUntil` renders after Date (before dueDate if both present) — used by quotations
- `children` slot appended after standard rows — used by invoices for fiscal status rows (SII/TBAI/Verifactu)
- Exports `InfoRow` for use by callers that need to inject rows into `children`

### Piece 4-B — `PaymentsCard.jsx` ✅

**File:** `tools/app-shell/src/windows/custom/shared/preview-cards/PaymentsCard.jsx`

Props: `payments`, `currencyCode`, `totalOutstanding`, `canAddPayment`, `isFullyPaid`, `loading`, `onAddPayment`.

### Piece 4-C — `EmailsCard.jsx` ✅

**File:** `tools/app-shell/src/windows/custom/shared/preview-cards/EmailsCard.jsx`

Props: `onSend`. Renders section header + placeholder text. All 5 windows use this.

### Piece 4-D — `CategorizationCard.jsx` ✅

**File:** `tools/app-shell/src/windows/custom/shared/preview-cards/CategorizationCard.jsx`

Props: `rows: Array<{ label, value }>`. Returns `null` when `rows.length === 0`. Renders `InfoRow` for each row including those with `value: null` (shown as "—").

### Piece 4-E — Refactor `InvoicePreview.jsx` ✅

Replaced local `SectionCard`, `InfoRow`, `StatsPanel` with shared cards. Fiscal rows (SII/TBAI/Verifactu) slotted into `SummaryCard` via `children`. `dueDate` passed as prop (renders before Status). `CategorizationCard` receives `[{ label, value: accountingAccount }]`.

Caching condition changed from `isCompleted` to `!isDraft` — `isCompleted` retained for `canAddPayment` logic.

### Piece 4-F — Refactor `OrderPreview.jsx` ✅

Replaced `OrderSummaryPanel` with shared cards. Bugs fixed:
- Status label: `resolveStatusLabel(statusCode, null, ui)` from `statusBadge.js` (was `$_identifier` raw value — showed "Booked" instead of "Completado")
- Invoice/Delivery percents: `Number(order.invoiceStatus)` formatted as `invoicePercent` prop → displayed as a `PercentBar` (same track+fill style as the grid columns: `w-16 h-1.5`, emerald/amber/slate by completion level)

### Piece 4-G — Refactor `QuotationPreview.jsx` ✅

Replaced `QuotationSummaryPanel` with shared cards. Status label via `resolveStatusLabel`. `validUntil` passed as prop to `SummaryCard`.

---

## Post-implementation Fixes

### F1 — Status badge color regression ✅

After Phase 4, `SummaryCard` used a simplified `resolveVariant` function (`'CO' → 'success'`) instead of `getStatusBadgeProps`. The `Badge` component has no `success` variant — green requires `variant: 'default', className: 'bg-emerald-600 ...'`. Fixed by replacing `resolveVariant` with `getStatusBadgeProps` from `@/lib/statusBadge.js`.

### F2 — Due date order in invoice card ✅

"Fecha de vencimiento" was appearing after Status because it was passed as a `children` row. Added a dedicated `dueDate` prop to `SummaryCard` that renders between Date and Status. Added `previewCardDueDate` i18n key.

### F3 — `statusComplete` translation in en_US ✅

`en_US.json` had `"statusComplete": "Confirmed"`. Changed to `"Completed"` to match user expectation ("Completed" in English, "Completado" in Spanish).

### F4 — `GenericPreviewModal` width when no left panel ✅

When `resolvedLeftPanel` is null, the modal was still full-width (`min(calc(100vw - 308px), 1400px)`) but only the 380px right panel had content — large empty white area on the left. Fixed: width is now `resolvedLeftPanel != null ? 'min(calc(100vw - 308px), 1400px)' : 380`.

### F5 — Purchase Order drop zone removed ✅

Initial plan had PO with drop zone (`storeCondition: true, autoFetch: false`). Requirement clarified: PO should show "right panel only, no PDF". Changed PO `attachmentConfig` to `storeCondition: false` — no left panel rendered, modal narrows to 380px.

### F6 — `renderPreview` inline function causing infinite re-renders ✅

All three windows had `renderPreview` as an inline arrow function in JSX. `DataTable` uses `renderPreview` in a `useEffect` dependency — new function reference every render → infinite setState loop. Fixed by memoizing with `useCallback([token, apiBaseUrl, windowName])` in all three windows.

### F7 — `CustomQuotationTable` infinite re-render ✅

`useMemo(() => buildQuotationColumns(ui), [ui])` — `useUI()` returns a new closure every render so the memo recomputed every render, producing a new `columns` array every render, triggering `DataTable`'s column-change effect. Fixed by using `dictionary` from `useLocale()` (stable context reference) as the dependency instead of `ui`.

### F8 — Caching strategy: `!isDraft` replaces completed-status check ✅

Initial implementation cached only for `COMPLETED_STATUSES` (quotation) or `status === 'CO'` (order/invoice). Requirement clarified: cache for all non-draft statuses across all document types. Changed all three preview files to use `isDraft = documentStatus === 'DR'` and `storeCondition: !isDraft`.

### F9 — `CategorizationCard` hiding logic ✅

Initial implementation filtered rows with `value == null` and hid the card if none remained. This caused the invoice categorization card to disappear while `accountingAccount` loaded (starts as `null`). Changed to hide only when `rows.length === 0` — null values render as "—", matching the original behavior.

### F10 — Tab name regression: 'related' → 'history' ✅

`OrderPreview` and `QuotationPreview` had tab key `'related'` (label "Related"/"Relacionados") — inconsistent with the original `InvoicePreview` design that always used "General, Messages, History". Renamed to `key: 'history'` with i18n keys `orderPreviewHistory` / `quotationPreviewHistory`.

### F11 — goods-shipment entity name wrong in SO specs ✅

`fetchByCriteria('goods-shipment', 'header', 'salesOrder', ...)` was passing `'header'` as the entity name. The NEO API entity for goods-shipment is `goodsShipment` (from `decisions.json → entities[*].name`). Fixed to `'goodsShipment'`. Symptom: shipments never appeared in `RelatedDocumentsCard` for sales orders (only invoices showed).

### F12 — RelatedDocumentsCard status badges too prominent ✅

Initial implementation used `Badge` with `getStatusBadgeProps()` → dark solid `bg-emerald-600`. Requirement was lighter pill style matching the form view. Replaced with `StatusTag` from `@/components/ui/status-tag` which uses `getStatusTone()` + `TONE_STYLES` (`success` tone: `{ background: '#EEFBF4', color: '#17663A' }`).

### F13 — Purchase Order PDF restored ✅

Purchase Order had its left panel removed in a previous session. PO requires its own generated PDF preview (per functional analyst confirmation). Created `usePurchaseOrderPdf.js` hook; restored PO left panel in `OrderPreview.jsx`; unified attachment config (`storeCondition: !isDraft`) for both SO and PO. Both hooks always called per React rules of hooks, with `null` passed to the inactive one.

### F14 — Discount breakdown missing from all PDF hooks ✅

All 4 PDF hooks (`useOrderPdf`, `useQuotationPdf`, `usePurchaseOrderPdf`, `useInvoicePdf`) and the shared `documentPdf.js` template were missing discount breakdown rows. Documents with per-product discounts or a header-level `etgoTotalDiscount` showed only a flat subtotal with no explanation of how it was derived. Added: CSS `.row.discount` style, template conditional rows (`grossAmount`/`discountPerProduct`/`totalDiscountAmt`), and computation in all 4 hooks. Fields are `null` when no discount exists — template blocks stay hidden.

`grossAmount` computation: sum of `(qty × listPrice)` across all lines, falling back to `lineNetAmount / (1 − discount/100)` when `listPrice` is null. `discountPerProduct`: `max(0, grossAmount − productNetAmount)`, `null` when no per-product discount. `etgoTotalDiscount`: from `header.etgoTotalDiscount`, `null` when 0. `totalDiscountAmt`: `productNetAmount × etgoTotalDiscount / 100`, `null` when 0.

### F15 — PDF column header "Precio unitario" → "Precio tarifa" ✅

i18n key `invoicePdfColUnitPrice` rendered "Unit Price"/"P. Unitario" but the form view labels this column "Precio tarifa"/"List Price" (the PriceList column). Changed value to "List Price"/"Precio tarifa" in both locale files. Applies to all 4 document type PDFs since they share the key.

---

## File Inventory

### New files

| File | Phase | Description |
|------|-------|-------------|
| `tools/app-shell/src/windows/custom/shared/documentPdf.js` | 0 | Shared PDF infrastructure |
| `tools/app-shell/src/windows/custom/shared/useOrderPdf.js` | 1 | PDF hook for sales order |
| `tools/app-shell/src/windows/custom/shared/OrderPreview.jsx` | 1 | Preview for SO + PO |
| `tools/app-shell/src/windows/custom/shared/useQuotationPdf.js` | 2 | PDF hook for sales quotation |
| `tools/app-shell/src/windows/custom/shared/QuotationPreview.jsx` | 2 | Preview for sales quotation |
| `tools/app-shell/src/windows/custom/shared/preview-cards/SummaryCard.jsx` | 4 | Shared total/contact/date/status card |
| `tools/app-shell/src/windows/custom/shared/preview-cards/PaymentsCard.jsx` | 4 | Payments list (invoices only) |
| `tools/app-shell/src/windows/custom/shared/preview-cards/EmailsCard.jsx` | 4 | Emails section (all windows) |
| `tools/app-shell/src/windows/custom/shared/preview-cards/CategorizationCard.jsx` | 4 | Generic key/value card |
| `tools/app-shell/src/windows/custom/shared/usePurchaseOrderPdf.js` | Post-impl | PDF hook for purchase order |
| `tools/app-shell/src/windows/custom/shared/preview-cards/RelatedDocumentsCard.jsx` | Post-impl | Related documents card for SO and SQ preview panels |

### Modified files

| File | Phase/Fix | Change |
|------|-----------|--------|
| `tools/app-shell/src/windows/custom/shared/useInvoicePdf.js` | 0 / Post-impl (F14) | Import shared functions from `documentPdf.js`; discount breakdown computation + 3 new labels |
| `tools/app-shell/src/windows/custom/shared/InvoicePreview.jsx` | 4 / F1 F2 F8 | Shared cards; `!isDraft` caching; `dueDate` prop |
| `tools/app-shell/src/windows/custom/shared/OrderPreview.jsx` | 1 / 4 / F5 F6 F8 / Post-impl (F10-F13) | Full implementation + shared cards + PO PDF + RelatedDocumentsCard for SO + history tab |
| `tools/app-shell/src/windows/custom/shared/QuotationPreview.jsx` | 2 / 4 / F8 / Post-impl (F10-F11) | Full implementation + shared cards + `!isDraft` caching + RelatedDocumentsCard + history tab |
| `tools/app-shell/src/windows/custom/shared/GenericPreviewModal.jsx` | F4 | Auto-narrow to 380px when no left panel |
| `tools/app-shell/src/windows/custom/shared/useOrderPdf.js` | Post-impl (F14) | Discount breakdown computation + 3 new labels |
| `tools/app-shell/src/windows/custom/shared/useQuotationPdf.js` | Post-impl (F14) | Discount breakdown computation + 3 new labels |
| `tools/app-shell/src/windows/custom/shared/usePurchaseOrderPdf.js` | Post-impl (F14) | Discount breakdown computation + 3 new labels |
| `tools/app-shell/src/windows/custom/shared/documentPdf.js` | Post-impl (F14) | CSS `.row.discount` + conditional template rows |
| `tools/app-shell/src/components/related-documents/docChipTypes.jsx` | Post-impl | Added 4 chip types: sales-order, sales-invoice, shipment, payment-in |
| `tools/app-shell/src/windows/custom/sales-order/index.jsx` | 1 / F6 | `renderPreview` (useCallback), `documentPreview`, savedRecord |
| `tools/app-shell/src/windows/custom/purchase-order/index.jsx` | 1 / F6 | Same as sales-order |
| `tools/app-shell/src/windows/custom/sales-quotation/index.jsx` | 2 / F6 F7 | `renderPreview` (useCallback), `rowQuickActions`, useLocale dep fix |
| `tools/app-shell/src/locales/en_US.json` | 1+2+4 / F3 / Post-impl | `orderPdf*`, `quotationPdf*`, `orderPreview*`, `quotationPreview*`, `previewCard*` keys; `statusComplete` → "Completed"; post-impl keys (see i18n section) |
| `tools/app-shell/src/locales/es_ES.json` | 1+2+4 / Post-impl | Same keys in Spanish |
| `e2e/tests/flows/row-quick-actions.mocked.spec.js` | 3 | `sales-quotation` + preview tests |
| `artifacts/sales-order/decisions.json` | 3 | `window.preview` annotation |
| `artifacts/purchase-order/decisions.json` | 3 | `window.preview` annotation |
| `artifacts/sales-quotation/decisions.json` | 3 | `window.preview` annotation |

---

## i18n Keys Added

### Order PDF
`orderPdfGenerating`, `orderPdfError`, `orderPdfTitle`, `orderPdfDocumentNo`, `orderPdfSection`, `orderPdfDate`, `orderPdfColQty`

### Quotation PDF
`quotationPdfGenerating`, `quotationPdfError`, `quotationPdfTitle`, `quotationPdfDocumentNo`, `quotationPdfSection`, `quotationPdfDate`, `quotationPdfValidUntil`, `quotationPdfColQty`

### Order preview panel
`orderPreviewGeneral`, `orderPreviewMessages`, `orderPreviewRelated`, `orderPreviewSend`, `orderPreviewEdit`, `orderPreviewDownloadPdf`, `orderPreviewTotal`, `orderPreviewContact`, `orderPreviewDate`, `orderPreviewStatus`, `orderPreviewInvoiceStatus`, `orderPreviewDeliveryStatus`

### Quotation preview panel
`quotationPreviewGeneral`, `quotationPreviewMessages`, `quotationPreviewRelated`, `quotationPreviewSend`, `quotationPreviewEdit`, `quotationPreviewDownloadPdf`, `quotationPreviewTotal`, `quotationPreviewContact`, `quotationPreviewDate`, `quotationPreviewValidUntil`, `quotationPreviewStatus`

### Shared preview cards
`previewCardTotal`, `previewCardContact`, `previewCardDate`, `previewCardStatus`, `previewCardValidUntil`, `previewCardDueDate`, `previewCardInvoicePercent`, `previewCardDeliveryPercent`, `previewCardEmails`, `previewCardSendEmail`, `previewCardNoEmailHistory`, `previewCardCategorization`, `previewCardPayments`, `previewCardAddPayment`, `previewCardNoPaymentsRecorded`

### Post-implementation

#### Purchase Order PDF
`purchaseOrderPdfGenerating`, `purchaseOrderPdfError`, `purchaseOrderPdfTitle`, `purchaseOrderPdfDocumentNo`, `purchaseOrderPdfSection`

#### Related Documents card
`previewCardRelatedDocuments`, `noRelatedDocuments`

#### Tab rename (related → history)
`orderPreviewHistory` (replaces `orderPreviewRelated`), `quotationPreviewHistory` (replaces `quotationPreviewRelated`)

#### Changed (not new)
`invoicePdfColUnitPrice` value updated from "Unit Price"/"P. Unitario" to "List Price"/"Precio tarifa" in both locale files. Applies to all 4 document type PDFs.

---

## Risks and Constraints

### R1 — `rowQuickActions` override fragility in sales-quotation
`QuotationPage.jsx` (generated) has `rowQuickActions={{}}` before `{...props}`. If a generator change moves `rowQuickActions` after `{...props}`, our override will stop working silently. A comment in `sales-quotation/index.jsx` documents this dependency.

### R2 — `useRowDelete` entity name for sales-quotation
Must use `entity: 'quotation'` (not `'header'`). Wrong entity name → DELETE calls fail silently.

### R3 — PDF caching race on slow connections
If `pdfBlob` is still loading when `GenericPreviewModal` mounts, `sourceBlob` will be null and auto-store won't trigger. PDF will be regenerated on the next open. Acceptable — same behavior as invoices.

---

## Out of Scope

- **Messages tab content.** Empty placeholder.
- **History tab content.** Empty placeholder (tab renamed from "Related" to "History" to match InvoicePreview; content is not yet implemented).
- **RelatedDocumentsCard for Purchase Order and invoices.** Purchase Order shows no RelatedDocumentsCard in the preview panel. Invoice previews are out of scope for this card.
- **Purchase Invoice PDF.** Drop-zone behavior unchanged.
- **Contact preview.** Row click still opens edit form directly.
- **Mobile / responsive layout.** Preview panel is desktop-only.
- **PDF template divergence.** All three PDF templates share the same Handlebars template. Document-type-specific template changes are a future iteration.
