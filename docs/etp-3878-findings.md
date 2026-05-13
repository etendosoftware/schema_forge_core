# ETP-3878 findings (architecture audit) — ceded to ETP-3981

- Origin: ETP-3878, author Sebastian Barrozo
- Continued in: ETP-3981 (this branch, `feature/ETP-3981`)
- Saved on: 2026-05-13

## Original description

Scope observed:

- Repo: schema-forge
- Branch: feature/ETP-3877
- Excluded: etendo_core
- Working tree: dirty before audit:
  - Modified: `docs/index.md`
  - Code changes made: none during this audit response.

## Executive Summary

- Critical: 0
- High: 5
- Medium: 6
- Low: 2

## Issues

### High — sales-invoice depends on a concrete purchase-invoice component

**Evidence:**

- `tools/app-shell/src/windows/custom/sales-invoice/index.jsx:8` imports `InvoicePreviewModal` from `../purchase-invoice/InvoicePreviewModal.jsx`.
- `tools/app-shell/src/windows/custom/sales-invoice/index.jsx:146-152` renders that modal with `specName="sales-invoice"`.
- `tools/app-shell/src/windows/custom/purchase-invoice/InvoicePreviewModal.jsx:23-39` documents the modal as "purchase or sales invoice" and defaults `specName = 'purchase-invoice'`.
- `tools/app-shell/src/windows/custom/purchase-invoice/InvoicePreviewModal.jsx:44-49` branches on `specName === 'sales-invoice'`.

**Why it matters:**

- A reusable invoice-preview concept is owned by `purchase-invoice`, but consumed by `sales-invoice`.
- This couples sibling windows. A `purchase-invoice` refactor can break `sales-invoice`.
- The path lies about ownership: sales behavior lives inside a purchase window directory.

**Recommendation:**

- Move `InvoicePreviewModal.jsx` to a neutral owner:
  - `tools/app-shell/src/windows/custom/shared/InvoicePreviewModal.jsx`, or
  - `tools/app-shell/src/components/contract-ui/InvoicePreviewModal.jsx`.
- Update both invoice windows to import the neutral component directly.
- Prefer clean cutover; avoid a forwarding alias in `purchase-invoice`.

Confidence: High

### High — Generic PartnerAddressPicker imports the concrete contacts window modal

**Evidence:**

- `tools/app-shell/src/components/contract-ui/PartnerAddressPicker.jsx:4` imports `LocationEditorModal` from `../../windows/custom/contacts/LocationEditorModal.jsx`.
- `tools/app-shell/src/components/contract-ui/PartnerAddressPicker.jsx:17-23` says the component is registered for all dependent fields whose column is `C_BPartner_Location_ID`.
- `tools/app-shell/src/components/contract-ui/PartnerAddressPicker.jsx:57` derives `contactsApiBase` by replacing the current API segment with `/contacts`.
- `tools/app-shell/src/components/contract-ui/PartnerAddressPicker.jsx:93-101` renders the contacts modal from generic `contract-ui`.

**Why it matters:**

- `contract-ui` is generic infrastructure.
- It now depends on a concrete custom window and route convention.
- Any generated window with a partner-address field indirectly depends on contacts window implementation.

**Recommendation:**

- Move address editing to a neutral owner:
  - `components/contract-ui/LocationEditorModal.jsx`, or
  - `windows/custom/shared/LocationEditorModal.jsx`.
- Make contacts endpoint ownership declarative or injectable:
  - field metadata,
  - shared address service,
  - injected create-address callback.

Confidence: High

### High — DataTable contains Internal Consumption-specific lookup behavior

**Evidence:**

- `tools/app-shell/src/components/contract-ui/DataTable.jsx:20-21` imports `InternalConsumptionProductSearchDrawer` into generic `DataTable`.
- `tools/app-shell/src/components/contract-ui/DataTable.jsx:538-543` branches on `entity === 'internalConsumptionLine' && field.key === 'product'`.
- `tools/app-shell/src/components/contract-ui/DataTable.jsx:557-567` maps `item._aux?._LOC` and warehouse labels into `storageBin` fields.
- `tools/app-shell/src/components/contract-ui/DataTable.jsx:877-890` builds `internalConsumptionWarehouseByLocator` only for `internalConsumptionLine`.
- `tools/app-shell/src/components/contract-ui/DataTable.jsx:950-955` changes storage-bin display only for `internalConsumptionLine`.

**Why it matters:**

- `DataTable` is a generic renderer for generated tables, but knows:
  - one concrete entity,
  - concrete fields,
  - one specialized drawer,
  - one selector aux convention.
- Future special selectors will likely add more `if entity === ...` branches.

**Recommendation:**

- Move this to contract/metadata:
  - `lookupRenderer`
  - `selectorResultMappings`
  - `displayFieldPolicy`
- `DataTable` should execute declared policies, not know `internalConsumptionLine`.

Confidence: High

### High — DetailView contains commercial line amount and callout policies

**Evidence:**

- `tools/app-shell/src/components/contract-ui/DetailView.jsx:594-602` substitutes `orderedQuantity = 1` before callouts for unit-price calculation.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx:695-760` computes `lineNetAmount`, `grossAmount`, tax factor, and tax-rate cache behavior with concrete fields like `invoicedQuantity`, `unitPrice`, `grossAmount`, `lineNetAmount`, `taxRate`.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx:793-823` cascades to `SL_Order_Amt` using `grossUnitPrice`, `unitPrice`, `lineNetAmount`, `inpgrossUnitPrice`, `PriceActual`.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx:854-856` guards concrete quantity fields: `invoicedQuantity`, `orderedQuantity`, `movementQuantity`.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx:858-864` applies tax-included unit price correction using `grossUnitPrice`, `netUnitPrice`, `unitPrice`.

**Why it matters:**

- `DetailView` is generic UI, but implements document-line business policies.
- This makes unrelated windows inherit sales/purchase line behavior.
- Amount/callout rules become harder to reason about because they are hidden in UI infrastructure instead of contract policy.

**Recommendation:**

- Move this behavior behind contract-owned policies:
  - `calloutCascadePolicy`
  - `quantityGuardPolicy`
  - `lineAmountPolicy`
  - `grossNetPricePolicy`
- `DetailView` should evaluate policy declarations, not embed `SL_Order_Amt` / `SL_Invoice_Amt` knowledge.

Confidence: High

### High — Pipeline silently defaults missing windowName to sales-order

**Evidence:**

- `cli/src/pipeline.js:111-114` sets `parsed.windowName = 'sales-order'` when only `windowId` is supplied.
- `cli/src/pipeline.js:340-344` reads `artifacts/${windowName}/schema-raw.json`, `rules-raw.json`, and `decisions.json`.
- `cli/src/pipeline.js:424-425` writes `artifacts/${windowName}/contract.json`.
- `cli/src/pipeline.js:480-489` and `538-545` use `windowName` to choose custom/generated output directories.

**Why it matters:**

- A generic pipeline embeds a concrete business window default.
- If a user passes a non-sales-order `windowId` without `windowName`, extraction and artifact routing can mix different windows.
- This has broad blast radius because it affects generated outputs and artifacts.

**Recommendation:**

- Require `windowName`, or resolve it from DB/menu metadata.
- If compatibility is required, put it behind an explicit legacy flag and warn loudly.
- Do not default generic pipeline behavior to `sales-order`.

Confidence: High

### Medium — Selector fetching/normalization is hand-rolled in multiple layers

**Evidence:**

- `tools/app-shell/src/components/contract-ui/EntityForm.jsx:100-107` fetches selector by id and maps `label || name || value`.
- `tools/app-shell/src/components/contract-ui/EntityForm.jsx:123-137` performs server-side selector search and maps `item.label || item.name || item.id`.
- `tools/app-shell/src/components/contract-ui/EntityForm.jsx:295-320` implements paged selector loading with `limit`, `offset`, `data?.items ?? data?.response?.data ?? Array.isArray(data)`, `label ?? name ?? id`.
- `tools/app-shell/src/components/contract-ui/DataTable.jsx:41-56` implements a debounced selector search and maps `data.items`.
- `tools/app-shell/src/components/contract-ui/CreateContactModal.jsx:124-143` defines local `fetchSel` and `fetchAllPages`.
- `tools/app-shell/src/windows/custom/contacts/LocationEditorModal.jsx:16-25` defines another `fetchSelectorPage`.
- `tools/app-shell/src/hooks/useQuickSalesData.js:26-27` defines `parseSelectorItems`.

**Why it matters:**

- The NEO selector protocol is represented repeatedly:
  - auth headers,
  - URL params,
  - response shapes,
  - pagination,
  - id/label normalization,
  - error behavior.
- Any selector API change requires patching many paths.

**Recommendation:**

- Add a neutral selector client/hook:
  - `tools/app-shell/src/lib/selectorClient.js`
  - `useSelectorSearch`
  - `useSelectorOptions`
  - `fetchAllSelectorPages`
- All generic components and window adapters should consume the same normalized shape.

Confidence: High

### Medium — Contacts country/region selector fallback policy is duplicated and inconsistent

**Evidence:**

- `tools/app-shell/src/components/contract-ui/CreateContactModal.jsx:146-149` tries two country selector URLs:
  - `locationAddress/selectors/C_Country_ID`
  - `bankAccount/selectors/C_Country_ID`
- `tools/app-shell/src/windows/custom/contacts/LocationEditorModal.jsx:182-188` has six country selector fallbacks across:
  - `locationAddress`
  - `intrastatAdquisitions`
  - `bankAccount`
  - `C_Country_ID`
  - `country`
- `tools/app-shell/src/windows/custom/contacts/LocationEditorModal.jsx:294-300` has six region selector fallbacks.
- `tools/app-shell/src/windows/custom/contacts/LocationEditorModal.jsx:309-313` sends both `C_Country_ID` and `country` filter keys.

**Why it matters:**

- Country/region selector aliasing is one contacts compatibility policy.
- It is duplicated with different endpoint coverage.
- Fixing one modal can leave the other inconsistent.

**Recommendation:**

- Centralize contacts selector fallback policy:
  - one policy config,
  - one shared helper,
  - one fallback order,
  - one filter-key alias rule.
- Both `CreateContactModal` and `LocationEditorModal` should use it.

Confidence: High

### Medium — CreateContactModal is in generic contract-ui but owns contacts/Business Partner workflow

**Evidence:**

- `tools/app-shell/src/components/contract-ui/CreateContactModal.jsx:73-82` describes a Business Partner creation wrapper with multi-step save sequence: BP, billing PATCH, address, contacts, bank accounts.
- `tools/app-shell/src/components/contract-ui/CreateContactModal.jsx:120-122` hardcodes contacts subresources:
  - `businessPartner`
  - `vendorCreditor`
- `tools/app-shell/src/components/contract-ui/PartnerAddressPicker.jsx:14-15` notes this same contacts API transform is shared with `useCreateContactModal`.

**Why it matters:**

- `components/contract-ui` is generic, but this module encodes a concrete contacts workflow.
- This creates a mixed layer: generic UI plus contacts orchestration.
- It encourages future one-off business workflows to be placed in shared component infrastructure.

**Recommendation:**

- Keep only reusable modal primitives in `contract-ui`.
- Move contacts orchestration to a contacts/window adapter or shared business-partner service.
- If other windows need "create contact", inject a callback/service rather than importing a concrete workflow.

Confidence: Medium

### Medium — Related-document graph traversal is duplicated across windows

**Evidence:**

- `tools/app-shell/src/windows/custom/purchase-order/RelatedDocuments.jsx:42-56` traverses payment plan → payment details → payment-out with de-dupe.
- `tools/app-shell/src/windows/custom/purchase-invoice/RelatedDocuments.jsx:9-23` repeats the same payment traversal with spec/entity naming differences.
- `tools/app-shell/src/windows/custom/payment-out/RelatedDocuments.jsx:9-53` traverses payment-out lines → invoice/order schedules → invoice/order records.
- `tools/app-shell/src/components/related-documents/helpers.js:12-42` only exposes low-level `fetchByCriteria`, `fetchChild`, and `fetchById`.

**Why it matters:**

- Shared helpers stop at endpoint wrappers.
- Each window still owns graph traversal, de-dupe, fan-out, and document descriptors.
- New related-document features will likely copy another `RelatedDocuments.jsx`.

**Recommendation:**

- Introduce declarative related-document graph config and a shared hook:
  - `useRelatedDocuments({ sourceSpec, sourceId, relations })`
- Relations should declare:
  - child/criteria edge,
  - via field,
  - target spec/entity,
  - de-dupe key,
  - document type.

Confidence: High

### Medium — DocChip rendering rules are repeated per window

**Evidence:**

- `tools/app-shell/src/windows/custom/purchase-order/RelatedDocuments.jsx:85-119` manually maps rows/payments to `DocChip` props.
- `tools/app-shell/src/windows/custom/purchase-invoice/RelatedDocuments.jsx:50-95` manually renders purchase order, goods receipt, and payment chips.
- `tools/app-shell/src/windows/custom/goods-receipt/RelatedDocuments.jsx:31-58` manually renders purchase order and invoice chips.
- `tools/app-shell/src/windows/custom/payment-out/RelatedDocuments.jsx:73-103` manually renders order and invoice chips.

**Why it matters:**

- Route, icon, title, amount, currency, and status rules for each document type are repeated.
- A change to invoice/payment/order chip semantics must be propagated manually.
- Divergence becomes hard to identify as intentional vs accidental.

**Recommendation:**

- Add a document-type chip registry:
  - `DOCUMENT_CHIP_TYPES.order`
  - `DOCUMENT_CHIP_TYPES.invoice`
  - `DOCUMENT_CHIP_TYPES.payment`
  - `DOCUMENT_CHIP_TYPES.receipt`
- Windows should produce normalized descriptors like `{ type: 'invoice', id, row }`.
- One renderer should own `DocChip` props.

Confidence: High

### Medium — Sales/purchase selector context is hardcoded in generic DetailView

**Evidence:**

- `tools/app-shell/src/components/contract-ui/DetailView.jsx:167-177` derives `isSOTrx`, `isCustomer`, and `isVendor` from `api.window.category`.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx:180-187` injects those into primary entity selector context.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx:190-200` injects `parentId`, `IsSOTrx`, `priceList`, and `DateInvoiced` into detail entity selector context using `invoiceDate` / `orderDate`.

**Why it matters:**

- Selector validation context is domain-specific.
- The generic detail renderer knows Etendo sales/purchase variables and concrete document field names.
- Other windows with different selector context needs must modify `DetailView`.

**Recommendation:**

- Represent selector context in contract metadata:
  - context variables,
  - source fields,
  - category-derived values,
  - aliases like `isSOTrx` / `IsSOTrx`.
- `DetailView` should evaluate declared context mappings.

Confidence: High

### Medium — Contacts/businessPartner aliasing is duplicated in quality-gate tooling

**Evidence:**

- `cli/src/quality-gate/detect.js:29-35` maps `businessPartner` custom dir changes to `contacts`.
- `cli/src/quality-gate/checks/i18n.js:44-52` adds `businessPartner` custom files only when `windowName === 'contacts'`.
- `tools/app-shell/src/windows/custom/contacts/BusinessPartnerSidebar.jsx:1` re-exports from `@/windows/custom/businessPartner/BusinessPartnerSidebar`.

**Why it matters:**

- The same concrete alias relationship exists in multiple generic tooling paths.
- Future aliases require editing multiple files.
- A mismatch between detection and checks can produce inconsistent quality-gate coverage.

**Recommendation:**

- Create a single `quality-gate/window-alias` policy source.
- Make `detect` and `checks` consume the same alias metadata.
- Prefer moving shared sidebar ownership to neutral location and removing the alias.

Confidence: High

### Low — Related-document loading/error lifecycle is repeated and inconsistent

**Evidence:**

- `tools/app-shell/src/windows/custom/purchase-order/RelatedDocuments.jsx:66-80` sets loading false only inside `.then`; no local `.catch` or `.finally`.
- `tools/app-shell/src/windows/custom/purchase-invoice/RelatedDocuments.jsx:33-45` uses `.finally(() => setLoading(false))`.
- `tools/app-shell/src/windows/custom/goods-receipt/RelatedDocuments.jsx:12-24` has a separate no-order branch and loading reset.
- `tools/app-shell/src/windows/custom/payment-out/RelatedDocuments.jsx:62-68` has `.catch(() => setDocs([]))` and `.finally(...)`.

**Why it matters:**

- This is lower severity because it is localized to related-doc UI.
- Still, it shows the related-doc abstraction boundary is too low-level.
- UX behavior can diverge across windows.

**Recommendation:**

- Shared `useRelatedDocuments` should own:
  - loading,
  - empty state,
  - error fallback,
  - cancellation/staleness behavior.

Confidence: Medium

### Low — contacts/BusinessPartnerSidebar.jsx is a forwarding alias hiding ownership

**Evidence:**

- `tools/app-shell/src/windows/custom/contacts/BusinessPartnerSidebar.jsx:1` is:
  - `export { default } from '@/windows/custom/businessPartner/BusinessPartnerSidebar';`

**Why it matters:**

- The alias hides a cross-window dependency.
- It can evade searches that only look for normal import statements.
- Lower severity because the direct blast radius is one file.

**Recommendation:**

- Move `BusinessPartnerSidebar` to neutral shared location if both windows own it.
- Or choose one true owner and update call sites explicitly.
- Avoid forwarding aliases as a long-term boundary.

Confidence: High

---

View this issue on Jira: <https://etendoproject.atlassian.net/browse/ETP-3878>
