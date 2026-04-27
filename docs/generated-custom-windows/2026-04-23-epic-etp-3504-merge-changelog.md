# Generated/Custom Windows Change Log — epic/ETP-3504 -> develop

## Context

- Observed merge target: `origin/develop` at `36f10538` (`Merge pull request #417 from etendosoftware/epic/ETP-3504`).
- Baseline compared against the pre-merge `develop` tip `dcdf2266`.
- Scope is limited to user-visible generated/custom window behavior that changed, or that became materially clearer in the merged code and therefore required a documentation refresh.

This is not a commit-by-commit release note for the whole repository. It records the generated/custom window deltas that matter to QA, product review, and window-level verification.

## Included documentation refresh

The merge required updates to these window guides:

- `docs/generated-custom-windows/contacts.md`
- `docs/generated-custom-windows/physical-inventory.md`
- `docs/generated-custom-windows/sales-quotation.md`
- `docs/generated-custom-windows/sales-order.md`
- `docs/generated-custom-windows/purchase-order.md`
- `docs/generated-custom-windows/price-list.md`
- `docs/generated-custom-windows/product.md`
- `docs/generated-custom-windows/tax.md`

## Change log

### Contacts

- The header now has a visible Company/Person toggle that switches the primary form between commercial-name fields and first-name/last-name fields.
- Creating a child Person, Bank Account, or Location from an unsaved contact now auto-saves the header first, then reopens the requested child editor on `/contacts/:recordId`.
- The Contacts location editor is now the same reusable modal used by shared inline partner-address creation flows outside the Contacts window.
- The current code still does not prove that Company/Person mode is persisted from record data when reopening an existing contact. The toggle is clearly visible; its persistence semantics remain ambiguous.
- Evidence: commits `8bb69008`, `feb07fcd`, `0ddf60c8`; `tools/app-shell/src/windows/custom/contacts/{index.jsx,ContactsContext.jsx,ContactsBusinessPartnerForm.jsx,ContactTypeToggle.jsx,LocationEditorModal.jsx}`; `tools/app-shell/src/components/contract-ui/{DetailView.jsx,PartnerAddressPicker.jsx}`; `artifacts/contacts/generated/web/contacts/BusinessPartnerPage.jsx`.

### Physical Inventory

- The detail view now exposes two inventory-specific more-menu actions: `Create Inventory Count List` and `Update List System Count`.
- Creating lines from a brand-new header now saves the header first and then reopens the persisted record before line entry continues.
- Child selector context is now passed with the saved parent id, which is the key frontend fix behind the selector-context issue in physical-inventory line entry.
- The process action is documented as line-gated and status-gated: it is only shown while the header is unprocessed and at least one line exists.
- Evidence: commits `e5876cec`, `f26c171b`; `artifacts/physical-inventory/custom/{InventoryMenuContent.jsx,InventoryCreateListModal.jsx}`; `artifacts/physical-inventory/generated/web/physical-inventory/{InventoryPage.jsx,InventoryLineForm.jsx,InventoryTable.jsx}`; `tools/app-shell/src/components/contract-ui/DetailView.jsx`.

### Sales Quotation

- The quotation header now visibly exposes `Price List`, `Valid Until`, `Payment Method`, and `Payment Terms`.
- Draft quotations no longer jump directly from `DR` to order confirmation. The visible flow is now `DR -> Under Evaluation -> downstream conversion`.
- A send-to-evaluation modal is now the primary draft action, and the under-evaluation confirmation modal can create either a downstream sales order or a draft sales invoice.
- The menu configuration now exposes `Cancel` for `UE`/`CO`, but the inspected generated page still wires the menu action to an empty handler. The entry is visible; the implemented user action is not proven.
- Evidence: commits `e4ca5961`, `5121e090`, `8ce27173`; `artifacts/sales-quotation/custom/{QuotationTopbarActions.jsx,SendToEvaluationModal.jsx,QuotationConfirmModal.jsx}`; `artifacts/sales-quotation/generated/web/sales-quotation/{QuotationForm.jsx,QuotationPage.jsx}`.

### Sales Order

- The header now visibly exposes `Payment Terms` alongside the existing order-entry fields.
- The current new-order flow keeps the order-line tab visible before the first save and shows `Save`, `Save draft`, and `Cancel` instead of forcing an intermediate first-save step.
- The develop-state documentation now aligns the order guide with the current draft-management and fulfillment-management flows already visible in the merged code.
- Warehouse remains an open functional gap: backend and tests still treat it as required, but the generated header form does not expose it in the inspected current UI.
- Evidence: commits `10e0c495`, `54de4483`; `artifacts/sales-order/generated/web/sales-order/HeaderForm.jsx`; `tools/app-shell/src/windows/custom/sales-order/index.jsx`; `e2e/tests/flows/sales-order-crud.spec.js`.

### Purchase Order

- The header now visibly exposes `Payment Terms` in the generated purchase-order form.
- The current new-order flow keeps the order-line tab visible before the first save and shows `Save`, `Save draft`, and `Cancel`.
- The detail page explicitly hides save controls once the order reaches `CO`, `CL`, or `VO`, which is now called out in the functional documentation.
- Vendor-address dependency remains explicit, but vendor-driven defaulting beyond that dependency is still not fully proven in the inspected current UI.
- Evidence: commit `10e0c495`; `artifacts/purchase-order/generated/web/purchase-order/{HeaderForm.jsx,HeaderPage.jsx}`; `artifacts/purchase-order/custom/PurchaseOrderActions.jsx`; `e2e/tests/flows/{purchase-order-create.spec.js,purchase-order-partner-address-bug.spec.js}`.

### Price List

- The merged generated metadata now models `priceListVersion` and `productPrice` explicitly.
- The visible SPA still does not expose a generated version grid or a version switcher. Users continue to manage prices through the custom `Product Price` workspace that resolves the first hidden version for the selected header.
- The documentation now makes that split explicit: generated metadata became richer, but the live page still routes pricing work through the custom wrapper.
- Evidence: commit `19f31dd4`; `tools/app-shell/src/windows/custom/price-list/{index.jsx,PriceListProductPrices.jsx}`; `artifacts/price-list/{contract.json,generated/web/price-list/PriceListPage.jsx}`.

### Product

- The product page is now documented around the states actually visible in the merged UI: gallery list, `Additional Info` grouped cards, pricing footer states, and the product-specific stock sidebar.
- The pricing footer now has three distinct visible states worth calling out: save-first gating, empty-pricing `Set Pricing`, and existing-pricing `Edit Pricing` with staged changes.
- The sidebar now clearly documents `Summary` / `Warehouses` tabs plus the conditional `Stock movement` card and modal behavior.
- Declared child datasets and actions still exceed what the inspected page makes explicit. The refreshed guide now distinguishes visible surfaces from metadata-only declarations.
- Evidence: commits `ba6910d8`, `e3c6bf1f`, `af305cc4`, `123ef1ba`; `artifacts/product/generated/web/product/ProductPage.jsx`; `tools/app-shell/src/windows/custom/product/{ProductGallery.jsx,ProductAdditionalInfoPanel.jsx,ProductPriceBar.jsx,ProductSidebar.jsx}`.

### Tax

- The list no longer reads like raw database output. Tax rate is rendered as a green percentage tag and applicability is rendered as `Sales` / `Purchase` tags.
- The visible form is now documented around the six fields actually exposed after the merged decisions update, rather than the broader set still present in raw metadata.
- The change log also captures the fact that `Description` stays discarded and `Active` stays hidden in the current merged UI.
- Evidence: commit `15a2288a`; `artifacts/tax/{decisions.json,generated/web/tax/TaxTable.jsx,generated/web/tax/TaxForm.jsx,generated/web/tax/index.jsx}`.

## Out of scope for this log

- Mock-catalog churn with no visible behavior change.
- Pipeline-only refactors, code-movement cleanups, or test-only additions that did not change the current window UX.
- Backend guarantees that are only implied by contracts or endpoint names and were not proven by the inspected UI code/tests.
