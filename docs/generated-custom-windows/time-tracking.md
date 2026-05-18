# Time Tracking

## Intent
Capture individual time entries against an employee and a project so the business can keep a dated record of work performed, classify that work, and mark whether the entry is billable and what workflow status it is currently in.

## What this window should allow
- List existing time entries.
- Open a single entry to review or edit it.
- Create a new time entry with the required operational context: employee, project, work date, hours, category, billable flag, and status.
- Add optional narrative detail through the description field.
- Search the list by employee, project, and status when narrowing operational review.
- Delete a time entry when it should no longer remain in the dataset.

## Interaction model
- Route: `/time-tracking` for the list and `/time-tracking/:recordId` for a specific entry.
- Visibility: route-only in current evidence. The window is registered in the app shell, but the `Projects` menu group is hidden, so users are not expected to discover it from visible navigation.
- Implementation type: generated window loaded through the generic window registry.
- Window shape: single-entity window over `timeTracking`; no child entities are declared.
- Form interaction: the detail form exposes required selectors for employee, project, category, billable, and status, plus required date and hours inputs and an optional description textarea.
- List interaction: the table shows the same business fields and supports list filters for employee, project, and status.

## Reactive behavior and dependencies
- Employee, project, category, billable, and status are selector-backed fields, so this window depends on those reference datasets being available.
- The current generated contract and form show no parent/child interaction because this is not a master-child window.
- No dependent selector behavior is visible in current evidence. The project selector does not show an observed dependency on employee, and category/status do not show context-sensitive filtering in the generated form.
- No totals, discounts, taxes, or rollups are present in the current contract.
- No defaulting rules are visible beyond the shared shell capability to request generic entity defaults; there is no time-tracking-specific default logic documented for employee, project, date, category, billable, or status.
- No status-driven actions or process endpoints are declared. Status is captured as a required field, but the current contract does not show approve, submit, lock, reopen, or similar workflow actions.

## Gap assessment
- The business purpose suggests downstream consequences such as approval, overtime handling, payroll impact, or billing/export to invoicing, but none of those reactions are visible in the current contract, generated form, or process endpoints. Treat them as gaps or external behavior not evidenced here.
- The current evidence does not show validation rules such as preventing negative hours, enforcing project/employee assignment compatibility, or limiting entries by status. If those controls are required, they are not visible here.
- Because the window is route-only in current navigation, discoverability is a gap unless another surface links users directly to `/time-tracking`.
- The contract exposes billable as a required selector, but no observable behavior shows how billable entries affect billing workflows or reporting.
- Status is required, but the current evidence does not show which statuses exist, which transitions are valid, or whether some statuses should make the record read-only.

## Manual verification
1. Open `/time-tracking` directly and confirm the list loads even though the window is not exposed through visible menu navigation.
2. Create a new entry and confirm the form requires employee, project, date, hours, category, billable, and status, while keeping description optional.
3. Confirm employee, project, category, billable, and status are rendered as selector inputs rather than free text.
4. Save the record, reopen it through `/time-tracking/:recordId`, and confirm the same values load in detail view.
5. From the list, filter by employee, project, and status and confirm those filters affect the visible result set.
6. Check whether changing status produces any visible workflow effect, field locking, or follow-up action. If nothing changes, record that as current behavior.

## Automated evidence
- `artifacts/time-tracking/contract.json` defines a single `timeTracking` entity with required fields for employee, project, date, hours, category, billable, and status; searchable fields are limited to employee, project, and status; `computedFields` is empty; and `processEndpoints` is empty.
- `artifacts/time-tracking/generated/web/time-tracking/TimeTrackingForm.jsx` shows the generated form fields and confirms selector-based inputs for employee, project, category, billable, and status.
- `artifacts/time-tracking/generated/web/time-tracking/TimeTrackingTable.jsx` confirms the list columns and the available table filters.
- `artifacts/time-tracking/generated/web/time-tracking/index.jsx` confirms this is a generated single-entity list/detail window with no child area.
- `tools/app-shell/src/menu.json` shows the window under the hidden `Projects` group, and `tools/app-shell/src/windows/registry.js` registers the `time-tracking` route.
- No time-tracking-specific frontend test was found in the current repository. Shared route-loading behavior is described in `docs/generated-custom-windows/app-shell-functional-flows.md`, but it is not a window-specific browser test for this surface.
