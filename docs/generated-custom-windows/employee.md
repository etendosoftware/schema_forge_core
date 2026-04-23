# Employee

This guide covers the generated **Employee** window and complements [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared app-shell routing and loading behavior.

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
