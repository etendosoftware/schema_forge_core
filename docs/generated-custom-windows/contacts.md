# Contacts

## Intent

The Contacts window should let users maintain a shared contact/account master record for organizations or people that the business treats as customers, vendors, or both. From one surface, users should be able to maintain the commercial header, related people, bank accounts, addresses, and the financial preferences that drive downstream sales and purchasing behavior.

## What this window should allow

- Create and update a contact header with commercial identity data such as search key, commercial name, tax data, web, email, phone, category, and role flags.
- Keep one record visible in the People menu for contact maintenance instead of exposing separate customer and vendor windows.
- Review the list with quick segmentation for all visible contacts, customer contacts, and vendor contacts.
- Open a detail view with a General tab for the core record and a Financial tab for billing and credit preferences.
- Add and maintain child people in the Person area.
- Add and maintain bank accounts in the Bank Account area.
- Add and maintain addresses in the Location area, including shipping and invoicing flags.
- Maintain customer-side and vendor-side financial preferences once the header already exists.

## Interaction model

- Route: list route `/contacts`; detail route `/contacts/:recordId`.
- Visibility: visible as the only non-hidden item in the People menu group.
- Implementation type: generated `contacts` window loaded from the app-shell registry, with custom contacts-specific components for the list table, financial panel, location modal, and sidebar.
- Shape: master-child window. The master record is `businessPartner`; child work areas are `contact` (Person), `bankAccount`, and `locationAddress`, while the Financial tab also edits related customer/vendor preference fields and discount data.

## Reactive behavior and dependencies

- The list is constrained to records marked as customer or vendor, then offers quick filters for All, Customers, and Vendors.
- The custom list enriches each row with a derived location column by loading location-address records separately and showing the first address found for the business partner.
- Person, Bank Account, and Location all require a saved header record before users can add child entries.
- The Financial tab behaves as a dependent surface:
  - credit limit is editable there;
  - credit used is shown read-only;
  - customer billing fields appear only when the customer flag is enabled;
  - vendor billing fields appear only when the vendor flag is enabled.
- Before the header is saved, the financial panel suppresses effective billing-preference editing and clears prefilled billing values from the unsaved draft so those values are not posted too early.
- The discount card is only active after the header exists and creates, updates, or deletes a related discount row against the current business partner.
- Customer-side and vendor-side account selectors depend on the selected payment method through validation rules, so the eligible account set should react when payment method changes.
- The payment method fields also carry a payment-method callout in the contract, so account-related behavior is expected to react to payment-method choice.
- In the Location modal, country is required; choosing a country clears the region and reloads region options through country-filtered selectors.
- New locations default shipping address and invoicing address to true, and the modal creates or updates the business-partner location plus underlying location data through the same `locationAddress` endpoint.
- Bank account defaults are partially visible in current evidence: country defaults from configuration and bank format defaults to `GENERIC`. A bank-account format field exists, but current evidence does not prove how the form reacts between generic, IBAN, SWIFT, and Spanish modes.
- A right-side sidebar is present in detail view and loads contact-specific KPIs/trend data from `bp-stats` and `bp-trend` endpoints.
- No parent/child total, tax, or document-status reactions are visible in current evidence.

## Gap assessment

- The surface clearly mixes customer and vendor semantics, but current evidence does not prove the full business rule for when a contact should be customer-only, vendor-only, both, or neither. The document should therefore treat those role semantics as supported flags, not as a fully explained business classification model.
- New master records default `customer` to true in the contract, while the list only shows customer or vendor records. Current evidence does not prove whether a user is expected to create non-customer/non-vendor contacts here or what should happen if both flags are cleared.
- The contract exposes additional related entities such as `customer`, `vendorCreditor`, `employee`, and accounting-oriented variants, but the current UI evidence shows only the General tab, Financial tab, and the three child work areas. It is ambiguous which deeper role-specific records are intentionally hidden, auto-managed, or still missing from the UI.
- The contract contains richer customer fields such as invoice terms and invoice schedule, but the current custom financial panel does not visibly expose all of them. That is a real gap or deliberate simplification; current evidence is not enough to state which.
- The custom list shows a single derived location string per record. Current evidence does not prove how users discover multiple addresses from the list alone.
- Bank-account behavior beyond defaults is only partially evidenced. The presence of bank format options implies conditional behavior, but the current code reviewed for this document does not prove the exact field-level reactions.

## Manual verification

1. Open People -> Contacts and confirm Contacts is the only visible People window.
2. Confirm the list route loads at `/contacts` and shows the All, Customers, and Vendors quick filters.
3. Confirm the list hides print, row-eye, counter, link, and filter affordances.
4. Open an existing record at `/contacts/:recordId` and confirm General and Financial tabs are present, along with the right-side sidebar.
5. In detail view, verify Person, Bank Account, and Location cannot be added until the header is saved.
6. In the Financial tab, toggle customer and vendor flags and confirm the related billing-preference sections appear or disappear accordingly.
7. Change payment method in the financial section and confirm the eligible account selector reacts to that choice.
8. Open the Location add flow and confirm it uses a modal, requires country, clears region when country changes, and defaults shipping/invoicing flags on a new address.
9. Add or edit a location and confirm the saved address is reflected back in the contact detail and list enrichment.
10. Add a bank account and confirm the saved row stays linked to the current contact.

## Automated evidence

- `artifacts/contacts/contract.json` defines the Contacts window as a `businessPartner`-based multi-entity surface with primary tabs, secondary child tabs, role flags, quick filters, and saved-record requirements.
- `artifacts/contacts/generated/web/contacts/BusinessPartnerPage.jsx` confirms the runtime composition: custom list table, Financial panel, Location modal, sidebar, General/Financial tabs, and Person/Bank Account/Location child areas.
- `tools/app-shell/src/windows/custom/contacts/ContactsTable.jsx` confirms list enrichment for contact type badges and derived location lookup.
- `tools/app-shell/src/windows/custom/contacts/ContactsFinancialPanel.jsx` and `BillingPreferencesForm.jsx` confirm post-save financial editing, customer/vendor-dependent sections, credit-limit persistence, and discount-row maintenance.
- `tools/app-shell/src/windows/custom/contacts/LocationEditorModal.jsx` confirms saved-header dependency, country/region selector dependency, and atomic create/update/delete behavior through the `locationAddress` endpoint.
- `tools/app-shell/src/menu.json` and `tools/app-shell/src/windows/registry.js` confirm menu visibility and route-to-loader registration for `/contacts`.
- No contacts-specific automated test was found in the current repo. Generic route-loading and shared entity-flow evidence lives in `docs/generated-custom-windows/app-shell-functional-flows.md`, including registry-backed window loading and shared child-refresh/defaults behavior.