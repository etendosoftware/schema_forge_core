# Lead

This guide covers the generated **Lead** window and complements [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared app-shell routing and loading behavior.

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
