# Project

This guide complements `app-shell-functional-flows.md` and covers the generated Project window.

- **Purpose and surface:** Maintain project master data for delivery work, ownership, scheduling, and budget tracking.
- **Route:** `/project` and `/project/:recordId`
- **Visibility:** Hidden route-only window because the Projects menu group is hidden in the app shell.
- **Implementation:** Generated window.
- **Key functional cues:**
  - The window is a single-entity surface with primary entity `project` and no child entities.
  - Core fields are `Name`, `Code`, optional `Client`, required `Manager`, `Status`, `Start Date`, optional `End Date`, optional `Budget`, and required `Priority`.
  - Searchable list fields are `name`, `client`, and `status`.
  - No related-documents panel, window-specific menu actions, or custom components are declared in the current contract.
- **Manual verification:**
  1. Open `/project` directly and confirm the list loads even though there is no visible Projects menu entry.
  2. Create a project and confirm the form requires `Name`, `Code`, `Manager`, `Status`, `Start Date`, and `Priority`.
  3. Verify `Client` remains optional and that `Budget` behaves like a numeric amount field.
  4. Reopen `/project/:recordId` directly and confirm the same record is loaded in detail view.
- **Automated evidence:** No project-specific frontend test was found. Use the shared app-shell guide for generic route/loading and CRUD behavior.
