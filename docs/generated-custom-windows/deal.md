# Deal

This guide complements `app-shell-functional-flows.md` with window-specific notes for the Deal surface.

- **Purpose / surface:** Opportunity/deal tracking for CRM work.
- **Route:** List route `/deal`; detail route `/deal/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation:** Generated standard list/detail window using `ListView` and `DetailView`.
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
