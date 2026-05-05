# Contacts

## Intent

The Contacts window should let users maintain a shared business-partner master record for organizations or individual people that the business treats as customers, vendors, or both. From one surface, users can maintain the commercial/person header, related people, bank accounts, addresses, and the financial preferences that drive downstream sales and purchasing behavior.

## What this window should allow

- Create and update a contact header with the fields currently exposed in the merged UI: read-only identifier, commercial name, first name, last name, tax-id type, tax ID, website, email, and phone.
- Switch the header between Company and Person presentation from a top-bar toggle. In Company mode the form shows Commercial Name and hides first/last name; in Person mode it hides Commercial Name and shows first/last name instead.
- Keep one record visible in the People menu for contact maintenance instead of exposing separate customer and vendor windows.
- Review the list with quick segmentation for all visible contacts, customer contacts, and vendor contacts.
- Read the list's Type badges as customer/vendor business-role flags, not as the Company/Person persona toggle used in the detail header.
- Open a detail view with a General tab for the core record and a Financial tab for billing and credit preferences.
- Add and maintain child people in the Person area.
- Add and maintain bank accounts in the Bank Account area.
- Add and maintain addresses in the Location area, including shipping and invoicing flags.
- Start child-entry creation from a new unsaved contact; the detail view auto-saves the header first, navigates to `/contacts/:recordId`, and then opens the requested Person, Bank Account, or Location editor.
- Maintain customer-side and vendor-side financial preferences once the header already exists.
- Edit the credit limit via a stepper widget (number input with − and + buttons) in the Financial tab. Each button click immediately persists the new value via PATCH. The minimum allowed value is 0; clicking − when the value is already 0 has no effect. Typing a value manually and leaving the field also persists it.
- Review and set the commercial discount for the contact through an inline dropdown selector (visible only after the header is saved).

## Interaction model

- Route: list route `/contacts`; detail route `/contacts/:recordId`.
- Visibility: visible as the only non-hidden item in the People menu group.
- Implementation type: custom `contacts` window registered in the app-shell registry. The wrapper adds a contacts-specific provider, header persona toggle, filtered header form, custom list table, financial panel, location modal, and right-side sidebar around the generated window contract.
- Shape: master-child window. The master record is `businessPartner`; child work areas are `contact` (Person), `bankAccount`, and `locationAddress`, while the Financial tab also edits related customer/vendor preference fields and discount data.

## Reactive behavior and dependencies

- The list is constrained to records marked as customer or vendor, then offers quick filters for All, Customers, and Vendors.
- The custom list enriches each row with customer/vendor type badges and a derived location column by loading `locationAddress` records separately and showing the first address found for the business partner.
- The detail top bar exposes a Company/Person toggle backed by local contacts window context. That toggle changes which header fields are rendered: Company mode excludes first/last name; Person mode excludes commercial name.
- The toggle is persisted via `EM_Etgo_IsPerson` (boolean column on `C_BPartner`, module `com.etendoerp.go`, default N). When an existing record is opened, the toggle initializes from `data.etgoIsperson`. Changing the toggle on a saved record fires an immediate PATCH (same pattern as `CreditLimitStepper`). For new records, if the user selected Person before saving, a PATCH is fired automatically once the record gets its ID.
- Person, Bank Account, and Location child areas still require a persisted header ID, but the detail view now auto-saves a new header and reopens the requested child area instead of forcing the user to save manually first.
- The Financial tab behaves as a dependent surface:
  - credit limit is editable there;
  - credit used is shown read-only;
  - customer billing fields appear only when the customer flag is enabled;
  - vendor billing fields appear only when the vendor flag is enabled.
- Before the header is saved, the financial panel suppresses effective billing-preference editing and clears prefilled billing values from the unsaved draft so those values are not posted too early.
- The discount card is only active after the header exists and creates, updates, or deletes a related discount row against the current business partner.
- Customer-side and vendor-side account selectors depend on the selected payment method through backend SQL validation rules. The `selectorContext` now passes `Fin_Paymentmethod_ID` (for customer) and `PO_Paymentmethod_ID` (for vendor) to the selector request, so the eligible financial account list is filtered in real time as the payment method changes.
- The payment method fields also carry a payment-method callout in the contract, so account-related behavior reacts to payment-method choice.
- In the Location modal, country is required; choosing a country clears the region, reloads region options through country-filtered selectors, and keeps country/region option loading paginated behind searchable pickers.
- New locations default shipping address and invoicing address to true, and the modal creates or updates the business-partner location plus underlying location data through the same `locationAddress` endpoint.
- The same `LocationEditorModal` is also reused by the shared partner-address picker for inline "+ Add address" flows in other windows. That reuse is proved in code/tests, but it is not a distinct extra screen inside `/contacts` itself.
- Bank account defaults are partially visible in current evidence: country defaults from configuration and bank format defaults to `GENERIC`. A bank-account format field exists, but current evidence does not prove how the form reacts between generic, IBAN, SWIFT, and Spanish modes.
- A right-side sidebar is present in detail view and loads contact-specific KPIs/trend data from `bp-stats` and `bp-trend` endpoints. The contacts sidebar has its own implementation (not a re-export of the generic business-partner sidebar): KPI cards show revenue and expenses with contacts-specific color styling, and the trend chart reuses the shared `BPChartSVGContent` component from the business-partner sidebar. Clicking the "last 6 months" link opens an expandable dialog with a 3M/6M period toggle. Chart axis labels are localized based on the active locale.
- No parent/child total, tax, or document-status reactions are visible in current evidence.

## Gap assessment

- The surface clearly mixes customer and vendor semantics, but current evidence does not prove the full business rule for when a contact should be customer-only, vendor-only, both, or neither. The document should therefore treat those role semantics as supported flags, not as a fully explained business classification model.
- The Company/Person toggle is persisted via `EM_Etgo_IsPerson` on `C_BPartner`. The persistence model is resolved: opening a record initializes the toggle from DB, changes fire an immediate PATCH, and new-record saves are followed by a PATCH if Person was selected.
- New master records default `customer` to true in the contract, while the list only shows customer or vendor records. Current evidence does not prove whether a user is expected to create non-customer/non-vendor contacts here or what should happen if both flags are cleared.
- The contract exposes additional related entities such as `customer`, `vendorCreditor`, `employee`, and accounting-oriented variants, but the current UI evidence shows only the General tab, Financial tab, and the three child work areas. It is ambiguous which deeper role-specific records are intentionally hidden, auto-managed, or still missing from the UI.
- The contacts quick-create modal used outside the main `/contacts` route has explicit person/company save logic, but the inspected main window code only proves field-switching behavior. Manual verification is still needed to confirm how a new person created directly in the full Contacts detail route is persisted.
- The contract contains richer customer fields such as invoice terms and invoice schedule, but the current custom financial panel does not visibly expose all of them. That is a real gap or deliberate simplification; current evidence is not enough to state which.
- The custom list shows a single derived location string per record. Current evidence does not prove how users discover multiple addresses from the list alone.
- Bank-account behavior beyond defaults is only partially evidenced. The presence of bank format options implies conditional behavior, but the current code reviewed for this document does not prove the exact field-level reactions.

## Manual verification

1. Open People -> Contacts and confirm Contacts is the only visible People window.
2. Confirm the list route loads at `/contacts` and shows the All, Customers, and Vendors quick filters.
3. Confirm the list hides print, row-eye, counter, link, and filter affordances.
4. Open a record at `/contacts/:recordId` and confirm the detail top bar shows a Company/Person toggle in addition to the General and Financial tabs and the right-side sidebar.
5. Toggle between Company and Person and confirm the header swaps Commercial Name vs. First Name/Last Name fields without changing the list's customer/vendor meaning.
6. From a new unsaved contact, trigger add in Person, Bank Account, and Location and confirm the header auto-saves, the route changes to `/contacts/:recordId`, and the requested child editor opens.
7. In the Financial tab, verify the Credit section shows as a horizontal row: descriptive text on the left, stepper on the right. Click + and − and confirm the value changes and is immediately persisted to the backend. Confirm − does not go below 0.
8. In the Financial tab, verify customer and vendor flags control the related billing-preference sections.
9. Select a payment method in the financial section and confirm the eligible financial account selector is filtered to only accounts compatible with that payment method.
10. Open the Location add flow and confirm it uses a modal, requires country, clears region when country changes, paginates/searches selector options, and defaults shipping/invoicing flags on a new address.
11. Add or edit a location and confirm the saved address is reflected back in the contact detail and list enrichment.
12. Add a bank account and confirm the saved row stays linked to the current contact.
13. In the sidebar, confirm KPI cards show revenue (green) and expenses (red) for the current contact. Click the "last 6 months" link and confirm an expanded chart dialog opens with a 3M/6M period toggle.
14. Reopen an existing person-like contact and verify the toggle shows Person mode (persisted via `EM_Etgo_IsPerson`). Create a new contact in Person mode, save it, and confirm the toggle stays in Person mode after the record is saved.
15. Change the toggle on an existing contact and reload the page; confirm the selection persists.

## Automated evidence

- `tools/app-shell/src/windows/registry.js` and `tools/app-shell/src/menu.json` confirm that `/contacts` resolves to the custom contacts wrapper and remains the only visible People menu entry.
- `tools/app-shell/src/windows/custom/contacts/index.jsx`, `ContactsContext.jsx`, `ContactsBusinessPartnerForm.jsx`, and `ContactTypeToggle.jsx` confirm the Company/Person toggle and the field-exclusion behavior applied on the header form. `ContactTypeToggle.jsx` reads `data.etgoIsperson` on record open, fires an immediate PATCH on toggle change for saved records, and fires a PATCH after first save when the user selected Person on a new record. The `index.jsx` wrapper div carries `flex-1 min-h-0 flex flex-col` to preserve the app-shell flex height chain; without these classes the `ListView` scroll container has no bounded height and the list cannot scroll.
- `artifacts/contacts/generated/web/contacts/BusinessPartnerForm.jsx` and `BusinessPartnerPage.jsx` confirm the header fields, top-bar slot usage, General/Financial tabs, and the Person/Bank Account/Location child areas.
- `tools/app-shell/src/components/contract-ui/DetailView.jsx` confirms the new-header auto-save flow before opening require-saved secondary tabs.
- `tools/app-shell/src/windows/custom/contacts/ContactsTable.jsx` confirms list enrichment for customer/vendor badges and the derived location lookup. The list table exposes eight columns: Commercial Name, First Name, Last Name, Type, Location, Website, Email, and Phone. First Name and Last Name map to `EM_Etgo_Firstname` / `EM_Etgo_Lastname` on the `businessPartner` entity and are i18n-labelled via `firstNameColumn` / `lastNameColumn` genericLabel keys.
- `tools/app-shell/src/windows/custom/contacts/ContactsFinancialPanel.jsx` and `BillingPreferencesForm.jsx` confirm post-save financial editing, customer/vendor-dependent sections, credit-limit persistence, and discount-row maintenance. The Financial tab layout uses a horizontal two-column design (descriptive text fixed-width on the left, interactive widget on the right) for both the Credit and Billing Preferences sections. `ContactsFinancialPanel.jsx` includes an inline `CreditLimitStepper` sub-component that renders a numeric input with − and + buttons and fires an immediate PATCH per step.
- `tools/app-shell/src/windows/custom/contacts/LocationEditorModal.jsx` confirms saved-header dependency, country/region selector dependency, paginated searchable country/region pickers, and atomic create/update/delete behavior through the `locationAddress` endpoint. All user-facing labels including the close button are i18n-driven via `useUI`.
- `tools/app-shell/src/components/contract-ui/PartnerAddressPicker.jsx` and `tools/app-shell/src/components/contract-ui/__tests__/PartnerAddressPicker.test.js` confirm that the same contacts location modal now supports inline "+ Add address" creation for partner-address selectors outside the Contacts window.
- `tools/app-shell/src/components/contract-ui/CreateContactModal.jsx` provides partial supporting evidence for person/company create payload semantics in the shared quick-create flow, but no contacts-window-specific automated test was found for the main detail-route save behavior.
- `tools/app-shell/src/menu.json` and `tools/app-shell/src/windows/registry.js` confirm menu visibility and route-to-loader registration for `/contacts`.
- `tools/app-shell/src/windows/custom/contacts/BusinessPartnerSidebar.jsx` confirms the contacts-specific sidebar implementation: KPI cards with color-coded revenue/expenses, a localized trend chart built on the shared `BPChartSVGContent` exported from `businessPartner/BusinessPartnerSidebar`, and an expandable dialog with a 3M/6M period toggle.
- No contacts-specific automated test was found in the current repo. Generic route-loading and shared entity-flow evidence lives in `docs/generated-custom-windows/app-shell-functional-flows.md`, including registry-backed window loading and shared child-refresh/defaults behavior.
