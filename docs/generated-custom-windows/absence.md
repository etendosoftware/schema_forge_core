# Absence

This guide covers the generated **Absence** window and complements [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared app-shell routing and loading behavior.

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
