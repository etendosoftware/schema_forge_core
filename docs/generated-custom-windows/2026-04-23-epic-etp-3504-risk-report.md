# Generated/Custom Windows Risk Report — epic/ETP-3504 -> develop

**Suggested email subject:** Potential window-level regressions after `epic/ETP-3504` merge into `develop`

## Executive summary

I reviewed the window-level changes introduced by the `epic/ETP-3504 -> develop` merge, focusing on generated/custom SPA windows and their related NEO action paths. The review found several high-confidence risks where the current UI can expose actions that are not implemented, omit required values, or route data to an ambiguous target.

Most findings are not compile-time failures. They are workflow/data-integrity risks that should be verified with targeted browser/API scenarios before the next release promotion.

## Scope reviewed

- Merge target observed: `origin/develop` at `36f10538` (`Merge pull request #417 from etendosoftware/epic/ETP-3504`).
- Baseline used for context: pre-merge develop tip `dcdf2266`.
- Local branch at review time: `epic/ETP-3504` with documentation-only commit `79785768` on top of the merge.
- Focus areas:
  - Contacts and inline address creation
  - Physical Inventory actions
  - Sales Quotation status/conversion flow
  - Sales/Purchase Order line creation and confirmation flows
  - Price List / Product pricing surfaces
  - Tax table rendering

## Severity summary

| Severity | Count | Main risk theme |
|---|---:|---|
| High | 6 | Workflow can fail, create duplicate downstream documents, or write/read data against the wrong entity/version |
| Medium | 3 | Visible action or state is inconsistent with implementation; likely user confusion or backend rejection |
| Low | 1 | Visual formatting can misrepresent data but does not by itself block the workflow |

## Findings

### 1. Contacts: custom Location modal bypasses the save-first contract

- **Severity:** High
- **Impacted flow:** Contacts -> new Business Partner -> Location tab -> Add Location
- **Risk:** The UI can open the custom Location modal for an unsaved contact and then POST `parentId=null`.
- **Evidence:**
  - `artifacts/contacts/generated/web/contacts/BusinessPartnerPage.jsx` configures the `locationAddress` tab with `customAddModal: LocationEditorModal` and `requireSavedRecord: true`.
  - `tools/app-shell/src/components/contract-ui/DetailView.jsx` opens custom modals directly via `setCustomModalState({ key: st.key, rowId: null })`; the existing save-first flow is only used in the non-custom-modal branch.
  - `DetailView.jsx` passes `bpId={parentRecordId}` to the modal, where `parentRecordId` is null on a new unsaved record.
  - `tools/app-shell/src/windows/custom/contacts/LocationEditorModal.jsx` creates locations with `${contactsApiBase}/locationAddress?parentId=${bpId}` and `businessPartner: bpId`.
- **Impact:** Users can reach an add-address modal that cannot save correctly until the header exists. This breaks the advertised save-first behavior for child tabs and can fail with a backend validation error.
- **Recommended verification/fix:** Create a new contact and add a Location before pressing header Save. The modal path should either auto-save the header first or remain disabled until a persisted parent id exists.

### 2. Contacts: Person mode hides the required Business Partner name without deriving it

- **Severity:** High
- **Impacted flow:** Contacts -> switch to Person -> enter first/last name -> save
- **Risk:** Person mode hides the required `name` field, but the save payload does not derive `name` from `etgoFirstname` / `etgoLastname`.
- **Evidence:**
  - `tools/app-shell/src/windows/custom/contacts/ContactsBusinessPartnerForm.jsx` excludes `name` whenever `personType === 'person'`.
  - `artifacts/contacts/generated/web/contacts/BusinessPartnerForm.jsx` marks `name` as required and exposes first/last name as separate optional fields.
  - `tools/app-shell/src/hooks/useEntity.js` only fills business-partner `name` from `source.name`; it does not derive it from `etgoFirstname` / `etgoLastname`.
- **Impact:** A user creating a person contact from the full Contacts window can fill the visible person fields and still submit a payload missing the required BP name/search key, causing save failure.
- **Recommended verification/fix:** Save a new Person contact with first/last name and no commercial name. Either derive BP `name`/`searchKey` from first+last name before save, or keep a required visible name field in Person mode.

### 3. Sales/Purchase/Quotation lines: hidden required `lineNetAmount` is not reliably recomputed

- **Severity:** High
- **Impacted flow:** Inline line creation in Sales Order, Purchase Order, and Sales Quotation
- **Risk:** The merge removes `lineNetAmount` from the visible add-line fields, while the shared fallback recomputes it from `lineData.invoicedQuantity`. Order and quotation add rows expose `orderedQuantity`, not `invoicedQuantity`.
- **Evidence:**
  - `artifacts/sales-order/generated/web/sales-order/HeaderPage.jsx` add-line entry fields include `orderedQuantity`, `unitPrice`, and `tax`, but no `lineNetAmount`.
  - `artifacts/purchase-order/generated/web/purchase-order/HeaderPage.jsx` uses the same `orderedQuantity`-based add-line shape.
  - `artifacts/sales-quotation/generated/web/sales-quotation/QuotationPage.jsx` also uses `orderedQuantity`, `unitPrice`, and `tax` for line entry.
  - `artifacts/{sales-order,purchase-order,sales-quotation}/contract.json` still marks `lineNetAmount` as required while not visible in the form.
  - `tools/app-shell/src/components/contract-ui/DetailView.jsx` says it always recomputes `lineNetAmount`, but uses `lineData.invoicedQuantity` rather than `orderedQuantity`.
- **Impact:** If callouts do not return `lineNetAmount`, users can submit order/quotation lines without a required amount or with an incorrect zero/missing amount. This can block line creation or corrupt downstream totals.
- **Recommended verification/fix:** Test add-line creation with callouts available and with callout failure/unavailability. The fallback should choose the correct quantity field for the current line entity (`orderedQuantity` for orders/quotations, `invoicedQuantity` for invoices, movement quantity for shipment flows if applicable).

### 4. Sales Quotation: `Invoice directly` option points to an unsupported action path

- **Severity:** High
- **Impacted flow:** Sales Quotation in `UE` -> confirmation modal -> Invoice directly
- **Risk:** The UI exposes invoice creation from a quotation, but the backend draft-invoice handler only supports sales orders and goods shipments.
- **Evidence:**
  - `artifacts/sales-quotation/custom/QuotationConfirmModal.jsx` renders an invoice option and posts to `/sales-quotation/quotation/{id}/action/createDraftInvoice`.
  - `etendo_core/modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/CreateDraftInvoiceHandler.java` documents and handles `createDraftInvoice` only for `sales-order` and `goods-shipment`.
  - The same Java handler returns `null` for unsupported specs, so `sales-quotation` falls through instead of creating an invoice.
  - `artifacts/sales-quotation/contract.json` lists `rMCreateInvoice`, not a `createDraftInvoice` action, for the quotation entity.
- **Impact:** Users can choose `Invoice directly` from an under-evaluation quotation and receive a failed/no-op backend action instead of a draft invoice.
- **Recommended verification/fix:** Either hide/disable the invoice option for quotations until supported, or implement a quotation-specific draft invoice handler/action and add coverage for the `UE -> draft invoice` path.

### 5. Sales Order: confirming with shipment + invoice is not atomic and can duplicate shipments on retry

- **Severity:** High
- **Impacted flow:** Sales Order confirmation modal with both `create shipment` and `create invoice` selected
- **Risk:** The modal creates the shipment first, then the invoice. If invoice creation fails after the shipment succeeds, the UI only shows a generic error and allows retrying with both options still selected.
- **Evidence:**
  - `artifacts/sales-order/custom/OrderConfirmModal.jsx` creates shipment first and stores it only in a local `result` object.
  - It then creates the invoice and throws on invoice failure before committing `setCreatedDocs(result)`.
  - The catch path only sets an error and leaves the modal available for retry.
- **Impact:** A successful shipment followed by a failed invoice can be retried as another `createShipment` call for the same order, risking duplicate downstream shipments.
- **Recommended verification/fix:** Force invoice creation to fail after shipment success and retry. The UI/backend should be idempotent or should persist/display partial success and disable already-created document options.

### 6. Price List: product prices are silently bound to the first hidden version

- **Severity:** High
- **Impacted flow:** Price List -> Product Price workspace when a price list has multiple versions
- **Risk:** The custom workspace suppresses the generated Price List Version layer and always edits product prices for the first returned version.
- **Evidence:**
  - `tools/app-shell/src/windows/custom/price-list/index.jsx` disables the generated detail entity and injects `PriceListProductPrices` as the only visible detail workspace.
  - `tools/app-shell/src/windows/custom/price-list/PriceListProductPrices.jsx` fetches up to 10 versions, assigns `versions[0]`, and loads product prices only for that one version.
  - New product prices are posted with `priceListVersion: versionId`, where `versionId` is that hidden first-returned version.
- **Impact:** If a price list has multiple versions, users cannot see or choose which version they are editing. They may miss existing prices or write new prices to the wrong version.
- **Recommended verification/fix:** Expose a version selector or restore a visible Price List Version layer. At minimum, choose/display a deterministic active/current version and make all product-price actions explicitly scoped to it.

### 7. Physical Inventory: custom actions are available on unsaved records

- **Severity:** Medium
- **Impacted flow:** Physical Inventory -> new header -> More menu -> Create Inventory Count List / Update List System Count
- **Risk:** The custom more-menu actions can run while the record id is still `new`.
- **Evidence:**
  - `tools/app-shell/src/components/contract-ui/DetailView.jsx` passes `recordId={data?.id || recordId}` into custom menu content. For new records this remains `new`.
  - `artifacts/physical-inventory/custom/InventoryMenuContent.jsx` opens the create-list modal unconditionally and uses `recordId` for `/inventory/{recordId}/action/updateQuantities`.
  - `InventoryCreateListModal.jsx` receives that id as `inventoryId` for the generate-list action.
- **Impact:** Users can trigger `/inventory/new/action/...` calls from a brand-new header instead of getting the save-header-first behavior that line entry uses.
- **Recommended verification/fix:** Open a new Physical Inventory record and run both custom actions before saving. Hide these actions until the header has a persisted id, or route them through the same save-first logic used for child line entry. Also verify behavior on `processed = true` records.

### 8. Sales/Quotation visible menu actions are inert placeholders

- **Severity:** Medium
- **Impacted flow:** Sales Order completed record -> Cancel; Sales Quotation -> Duplicate / Cancel
- **Risk:** The UI exposes menu actions whose handlers are empty.
- **Evidence:**
  - `artifacts/sales-order/generated/web/sales-order/HeaderPage.jsx` exposes `Cancel` for `status === 'CO'` with `onClick: () => {}`.
  - `artifacts/sales-quotation/generated/web/sales-quotation/QuotationPage.jsx` exposes `Duplicate` and `Cancel` with empty handlers; `Cancel` is visible for `CO` and `UE`.
- **Impact:** Users see destructive or document-management actions that do nothing. This is especially risky for `Cancel` because it implies a real document status transition.
- **Recommended verification/fix:** Either wire these menu actions to real action endpoints or remove/hide them until implemented. Browser smoke should assert that visible menu entries perform observable work or are absent.

### 9. Contacts: existing person-like records reopen in Company mode

- **Severity:** Medium
- **Impacted flow:** Contacts -> open existing person contact
- **Risk:** The Company/Person mode is initialized from local React state, not from the selected record.
- **Evidence:**
  - `tools/app-shell/src/windows/custom/contacts/ContactsContext.jsx` initializes `personType` to `company` for every Contacts session.
  - `ContactTypeToggle.jsx` receives record data but does not derive mode from it.
  - `ContactsBusinessPartnerForm.jsx` hides first/last-name fields whenever context remains `company`.
- **Impact:** Existing person records can open in Company mode, hiding their first/last-name fields until the user toggles manually. This undermines the new Company/Person split and can lead to accidental edits in the wrong presentation.
- **Recommended verification/fix:** Open known company and person contacts in the same session. Initialize/synchronize contact mode from persisted record data when a record loads or changes.

### 10. Tax: rate tag hardcodes a positive sign

- **Severity:** Low
- **Impacted flow:** Tax list table
- **Risk:** All non-null rates render as `+<rate> %`.
- **Evidence:**
  - `artifacts/tax/generated/web/tax/TaxTable.jsx` returns `<Tag variant="green" label={`+${val} %`} />` for every non-null rate.
- **Impact:** Zero-rate taxes render as `+0 %`; negative/withholding-style rates render as `+-5 %`. This is visually misleading even if it does not block saving.
- **Recommended verification/fix:** Format sign from the numeric value: no plus for zero, preserve negative signs, and apply positive styling only to positive rates.

## Suggested next verification pass

1. Run targeted browser scenarios for the six High-severity findings before promoting further:
   - Contacts Person save and unsaved Location add.
   - Sales/Purchase/Quotation add-line when callouts do not return `lineNetAmount`.
   - Sales Quotation `Invoice directly` from `UE`.
   - Sales Order confirm with shipment success + invoice failure + retry.
   - Price List with two versions and distinct product prices.
2. Add focused regression tests where possible:
   - `DetailView` custom modal save-first behavior.
   - Line amount fallback using entity-specific quantity fields.
   - Quotation modal should not show unsupported invoice action.
   - Order confirmation partial-success/idempotency behavior.
3. Decide product behavior for ambiguous cases:
   - Should Contacts Person mode persist or be derived dynamically?
   - Should Physical Inventory actions be available after processing?
   - Should Price List expose multiple versions explicitly?

## Notes

- This report intentionally excludes pure mock-catalog churn and styling-only changes with no clear behavioral impact.
- Findings are code-evidence based; runtime verification is still required to confirm exact backend responses in the target environment.
