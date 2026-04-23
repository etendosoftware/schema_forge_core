# Contacts

This guide complements `app-shell-functional-flows.md` with window-specific notes for the Contacts surface.

- **Purpose / surface:** Primary People entry for contact and account maintenance. It is the only visible People item in `menu.json`, so users can enter it from the side menu or by opening `/contacts`.
- **Route:** List route `/contacts`; detail route `/contacts/:recordId`.
- **Visibility:** Visible in the People group.
- **Implementation:** Generated window with custom contacts-specific extensions. The generated entry loads `artifacts/contacts/generated/web/contacts/index.jsx`, which then composes custom pieces such as `ContactsTable`, `ContactsFinancialPanel`, `LocationEditorModal`, and `BusinessPartnerSidebar`.
- **Key functional cues:**
  - The contract uses `businessPartner` as the primary entity and keeps the layout in `default` mode.
  - The contract is large and multi-entity. Beyond the main business partner header, the generated page wires auxiliary CRUD endpoints for customer, vendor, employee, bank account, location, contact, and other related entities under the same `/sws/neo/contacts` spec.
  - The list is pre-filtered to records that are customers or vendors, and exposes quick filters for **All**, **Customers**, and **Vendors**.
  - The list/header surface is intentionally customized: `customComponents.headerTable` points to `ContactsTable`, and list options hide print, eye, counter, link, and filters.
  - Detail pages expose two primary tabs, **General** and **Financial**. The Financial tab is backed by the custom `ContactsFinancialPanel`.
  - Detail pages also expose three secondary work areas: **Person**, **Bank Account**, and **Location**.
  - Person and Bank Account additions require an already-saved header record. Location uses the custom `LocationEditorModal` instead of a plain inline add form.
  - The contract explicitly excludes the `setNewCurrency` process and hides print/more-menu affordances, so this surface is focused on data maintenance rather than extra header actions.
  - No related-documents panel is declared in the current generated page.
- **Manual verification:**
  1. Open **People -> Contacts** or go directly to `/contacts`.
  2. Confirm the list only exposes the Contacts entry in the People menu and that the list surface shows the **All / Customers / Vendors** quick filters.
  3. Confirm the list does not expose print, filter, row-eye, counter, or link actions.
  4. Open `/contacts/<recordId>` and confirm the detail page shows **General** and **Financial** tabs, plus the right-side/custom sidebar content.
  5. In detail view, verify that **Person** and **Bank Account** additions require a saved header and that **Location** opens a modal editor instead of a plain inline row form.
- **Automated evidence:** No contacts-specific automated test was found. Use the shared app-shell guide for generic `/:windowName` route-loading coverage.
