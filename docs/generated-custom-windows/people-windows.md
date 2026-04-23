# People Windows

## Scope

The People group in `tools/app-shell/src/menu.json` currently exposes one visible entry and six hidden route-only windows:

- Visible in the side menu: `contacts`
- Hidden from the side menu but still registered in `tools/app-shell/src/windows/registry.js`: `business-partner`, `deal`, `activity`, `lead`, `employee`, `absence`

All seven slugs are wired to generated window loaders in `registry.js`. None of them are registered through `customLoaders`, although `contacts` is a generated window with extra custom components layered into its generated page.

Automated evidence note: I did not find window-specific automated tests for these seven windows. The shared loader coverage lives in `tools/app-shell/src/windows/__tests__/registry.test.js`, and the shared route/loading expectations are documented in `docs/generated-custom-windows/app-shell-functional-flows.md`. The sections below therefore focus on current implementation evidence plus manual verification.

## Contacts

- **Purpose / surface:** Primary People entry for contact and account maintenance. It is the only visible People item in `menu.json`, so users can enter it from the side menu or by opening `/contacts`. Detail pages use `/contacts/:recordId`.
- **Visibility:** Visible in the People group.
- **Implementation type:** Generated window with custom contacts-specific extensions. The generated entry loads `artifacts/contacts/generated/web/contacts/index.jsx`, which then composes custom pieces such as `ContactsTable`, `ContactsFinancialPanel`, `LocationEditorModal`, and `BusinessPartnerSidebar`.
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

## Business Partner

- **Purpose / surface:** Reference-style business partner maintenance with a header record plus location rows. Route `/business-partner`; detail route `/business-partner/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation type:** Generated master-detail window. `artifacts/business-partner/generated/web/business-partner/BusinessPartnerPage.jsx` renders a `ListView` for the header list and a `DetailView` with a child table/form for locations.
- **Key functional cues:**
  - The contract exposes `businessPartner` as the header entity and `bpLocation` as the child/detail entity.
  - The header form covers the expected reference fields such as name, search key, tax ID, description, credit limit, credit used, and active status.
  - Detail pages include summary chips for **Credit Used** and **Active**.
  - Child-row creation for locations is configured with `name`, `address`, `city`, `postalCode`, `country`, and `phone`.
  - No window-specific processes, related-document panels, or extra badges are declared in the current generated page.
- **Manual verification:**
  1. Open `/business-partner` directly; confirm the window loads even though it is hidden from the People menu.
  2. Select a record or open `/business-partner/<recordId>` directly.
  3. Confirm the detail view shows the business partner header plus a location child grid/form.
  4. Verify the summary surface includes **Credit Used** and **Active** and that new location rows use the configured address/contact fields.
- **Automated evidence:** No business-partner-specific automated test was found. Use the shared app-shell guide for generic route-loading coverage.

## Deal

- **Purpose / surface:** Opportunity/deal tracking for CRM work. Route `/deal`; detail route `/deal/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation type:** Generated standard list/detail window using `ListView` and `DetailView`.
- **Key functional cues:**
  - The primary entity is `deal`.
  - The contract centers the workflow on `name`, `businessPartner`, `stage`, `amount`, and `currency`.
  - Optional qualification and forecasting fields include `probability`, `expectedCloseDate`, `assignedTo`, and `source`.
  - Searchable fields are `name`, `businessPartner`, and `stage`.
  - No child entities, related-documents panel, or window-specific process/menu actions are declared in the current generated entry.
- **Manual verification:**
  1. Open `/deal` directly.
  2. Start a new record or open `/deal/<recordId>`.
  3. Confirm the form exposes the business partner lookup, stage selector, amount, currency, probability, expected close date, assignee, and source fields.
  4. Confirm the surface behaves as a single-record detail view with no child tabs or related-document area.
- **Automated evidence:** No deal-specific automated test was found. Use the shared app-shell guide for generic route-loading coverage.

## Activity

- **Purpose / surface:** CRM task/activity tracking linked to deals and contacts. Route `/activity`; detail route `/activity/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation type:** Generated standard list/detail window using `ListView` and `DetailView`.
- **Key functional cues:**
  - The primary entity is `activity`.
  - Required workflow fields are `type`, `subject`, and `status`.
  - Optional linking and execution fields include `deal`, `contact`, `assignedTo`, `dueDate`, `duration`, and `notes`.
  - Searchable fields are `subject`, `contact`, and `type`.
  - No child entities, related-documents panel, or window-specific process/menu actions are declared in the current generated entry.
- **Manual verification:**
  1. Open `/activity` directly.
  2. Start a new record or open `/activity/<recordId>`.
  3. Confirm the form exposes selectors/lookups for activity type, deal, contact, assignee, due date, status, duration, and notes.
  4. Confirm the page stays in a single-record detail flow with no child tables or related-document area.
- **Automated evidence:** No activity-specific automated test was found. Use the shared app-shell guide for generic route-loading coverage.

## Lead

- **Purpose / surface:** Lead capture and qualification. Route `/lead`; detail route `/lead/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation type:** Generated standard list/detail window using `ListView` and `DetailView`.
- **Key functional cues:**
  - The primary entity is `lead`.
  - The contract prioritizes `name` and `status`, with supporting qualification fields for `company`, `email`, `phone`, `source`, `assignedTo`, `estimatedValue`, and `notes`.
  - Searchable fields are `name`, `company`, and `status`.
  - No child entities, related-documents panel, or window-specific process/menu actions are declared in the current generated entry.
- **Manual verification:**
  1. Open `/lead` directly.
  2. Start a new record or open `/lead/<recordId>`.
  3. Confirm the form exposes company/contact data, source, status, assignee, estimated value, and notes.
  4. Confirm the surface stays a single-record detail flow with no child tables or related-document area.
- **Automated evidence:** No lead-specific automated test was found. Use the shared app-shell guide for generic route-loading coverage.

## Employee

- **Purpose / surface:** Employee directory and assignment maintenance. Route `/employee`; detail route `/employee/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation type:** Generated standard list/detail window using `ListView` and `DetailView`.
- **Key functional cues:**
  - The primary entity is `employee`.
  - Core maintenance fields are `name`, `department`, `position`, `email`, `phone`, `startDate`, `status`, and `manager`.
  - `employeeId` is present in both list and form but marked read-only in the contract.
  - Searchable fields are `name`, `department`, and `status`.
  - No child entities, related-documents panel, or window-specific process/menu actions are declared in the current generated entry.
- **Manual verification:**
  1. Open `/employee` directly.
  2. Start a new record or open `/employee/<recordId>`.
  3. Confirm the form exposes department/status selectors plus manager lookup, while `employeeId` is visible but not editable.
  4. Confirm the page stays a single-record detail flow with no child tables or related-document area.
- **Automated evidence:** No employee-specific automated test was found. Use the shared app-shell guide for generic route-loading coverage.

## Absence

- **Purpose / surface:** HR absence tracking. Route `/absence`; detail route `/absence/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation type:** Generated standard list/detail window using `ListView` and `DetailView`.
- **Key functional cues:**
  - The primary entity is `absence`.
  - Required fields are `employee`, `type`, `startDate`, `endDate`, and `status`.
  - `days` and `approvedBy` are present in the form but marked read-only in the contract.
  - Optional context fields include `reason`.
  - Searchable fields are `employee`, `type`, and `status`.
  - No child entities, related-documents panel, or window-specific process/menu actions are declared in the current generated entry.
- **Manual verification:**
  1. Open `/absence` directly.
  2. Start a new record or open `/absence/<recordId>`.
  3. Confirm the form exposes employee, absence type, date range, status, and reason fields.
  4. Confirm `days` and `approvedBy` are visible as informational/read-only fields and that the page has no child tables or related-document area.
- **Automated evidence:** No absence-specific automated test was found. Use the shared app-shell guide for generic route-loading coverage.
