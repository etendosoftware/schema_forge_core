# Business Partner

This guide complements `app-shell-functional-flows.md` with window-specific notes for the Business Partner surface.

- **Purpose / surface:** Reference-style business partner maintenance with a header record plus location rows.
- **Route:** List route `/business-partner`; detail route `/business-partner/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation:** Generated master-detail window. `artifacts/business-partner/generated/web/business-partner/BusinessPartnerPage.jsx` renders a `ListView` for the header list and a `DetailView` with a child table/form for locations.
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
