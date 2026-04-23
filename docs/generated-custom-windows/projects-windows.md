# Projects windows

This guide complements `docs/generated-custom-windows/app-shell-functional-flows.md` and focuses on the generated windows currently grouped under Projects.

The entire **Projects** menu group is marked `hidden: true` in `tools/app-shell/src/menu.json`, so these windows are currently route-only surfaces. Users reach them directly by URL rather than through the visible side menu.

Automation note: I did not find dedicated browser-style app-shell tests for these individual windows. The shared route/loading coverage still comes from `tools/app-shell/src/windows/__tests__/registry.test.js` plus the shared app-shell guide.

## Project

- **Purpose and surface:** Maintain project master data for delivery work, ownership, scheduling, and budget tracking.
- **Route:** `/project` and `/project/:recordId`
- **Visibility:** Hidden at menu level because the Projects group is hidden.
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

## Time Tracking

- **Purpose and surface:** Record time entries against employees and projects, including category, billable status, and approval state.
- **Route:** `/time-tracking` and `/time-tracking/:recordId`
- **Visibility:** Hidden at menu level because the Projects group is hidden.
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

## Document

- **Purpose and surface:** Maintain uploaded document metadata, including category, project linkage, uploader, status, tags, and read-only audit fields.
- **Route:** `/document` and `/document/:recordId`
- **Visibility:** Hidden at menu level because the Projects group is hidden.
- **Implementation:** Generated window.
- **Key functional cues:**
  - The window is a single-entity surface with primary entity `document` and no child entities.
  - Required editable fields are `Name`, `Category`, and `Status`.
  - Optional editable fields are `Project` and `Tags`.
  - `Uploaded By`, `Upload Date`, `File Size`, and `Version` are read-only review fields in the current contract.
  - Searchable list fields are `name`, `category`, and `status`.
  - No related-documents panel, window-specific menu actions, or custom components are declared in the current contract.
- **Manual verification:**
  1. Open `/document` directly and confirm the list loads without any visible Projects menu entry.
  2. Create or edit a document and confirm the form requires name, category, and status.
  3. Confirm project linkage and tags are optional.
  4. Verify uploader, upload date, file size, and version render as read-only metadata rather than editable inputs.
  5. Reopen `/document/:recordId` directly and confirm the same metadata is preserved.
- **Automated evidence:** No document-specific frontend test was found. Use the shared app-shell guide for generic route/loading and CRUD behavior.
