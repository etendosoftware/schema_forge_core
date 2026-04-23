# Time Tracking

This guide complements `app-shell-functional-flows.md` and covers the generated Time Tracking window.

- **Purpose and surface:** Record time entries against employees and projects, including category, billable status, and approval state.
- **Route:** `/time-tracking` and `/time-tracking/:recordId`
- **Visibility:** Hidden route-only window because the Projects menu group is hidden in the app shell.
- **Implementation:** Generated window.
- **Key functional cues:**
  - The window is a single-entity surface with primary entity `timeTracking` and no child entities.
  - Required fields are `Employee`, `Project`, `Date`, `Hours`, `Category`, `Billable`, and `Status`.
  - `Description` is optional.
  - Searchable list fields are `employee`, `project`, and `status`.
  - No related-documents panel, window-specific menu actions, or custom components are declared in the current contract.
- **Manual verification:**
  1. Open `/time-tracking` directly and confirm the list loads without using the side menu.
  2. Create a time entry and confirm the form requires employee, project, date, hours, category, billable status, and workflow status.
  3. Confirm `Hours` behaves like a numeric field and `Description` remains optional.
  4. Reopen `/time-tracking/:recordId` directly and confirm the saved entry loads with the same values.
- **Automated evidence:** No time-tracking-specific frontend test was found. Use the shared app-shell guide for generic route/loading and CRUD behavior.
