# Activity

This guide complements `app-shell-functional-flows.md` with window-specific notes for the Activity surface.

- **Purpose / surface:** CRM task/activity tracking linked to deals and contacts.
- **Route:** List route `/activity`; detail route `/activity/:recordId`.
- **Visibility:** Hidden in `menu.json`; route-only/hidden.
- **Implementation:** Generated standard list/detail window using `ListView` and `DetailView`.
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
