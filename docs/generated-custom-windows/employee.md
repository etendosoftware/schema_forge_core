# Employee

## Intent

Maintain employee master data for the HR area: who the employee is, which department they belong to, what position they hold, when they started, which status they are in, and who their manager is. In the current generated evidence, this window behaves as a straightforward employee directory and record-maintenance surface rather than a full onboarding or offboarding workspace.

## What this window should allow

Users should be able to open the employee list, search by employee name, department, or status, and then create, review, update, or delete employee records through the standard generated list/detail flow.

For each employee record, the current form evidence shows these editable business fields:
- `name`
- `department`
- `position`
- `email`
- `phone`
- `startDate`
- `status`
- `manager`

The window also shows `employeeId`, but the contract marks it read-only in both frontend and backend evidence. That means the identifier is visible to users yet should not be editable from this window. The current evidence does not show where that identifier is assigned.

The current generated window does not show child tabs, related-document panels, process buttons, approval actions, or HR workflow-specific actions.

## Interaction model

- Route: `/employee` for the list and `/employee/:recordId` for the detail view.
- Visibility: route-only in current app-shell evidence. `menu.json` includes the window with `"hidden": true`, so it is registered but not exposed as a visible side-menu entry.
- Implementation type: generated standard window using `ListView` for the list route and `DetailView` for the detail route.
- Window shape: single-entity window. The generated page only mounts the `employee` entity and shows no master-child structure.

## Reactive behavior and dependencies

The visible reactive behavior is limited.

- `department`, `status`, and `manager` are selector-backed fields, so users should choose values from referenced catalogs rather than free-typing them.
- `status` is a required selector tied to `EmployeeStatus`, which suggests lifecycle meaning, but the current evidence does not show status-driven actions, status-specific field locking, or automatic transitions.
- `manager` is optional and selector-based, which suggests a reporting-line dependency, but no visible validation or filtering confirms whether only eligible managers can be selected.
- `employeeId` is visible but read-only, so any identifier assignment appears to depend on backend/default behavior outside this form.
- No parent/child interaction is visible because this is not a master-child window.
- No totals, discounts, taxes, computed summaries, or line recalculations are visible in the current code or contract.
- The shared app-shell flow supports generic record defaults for generated windows, but there is no employee-specific evidence here showing which fields, if any, are auto-defaulted on creation.

## Gap assessment

- The current evidence supports basic employee record maintenance, but it does not show explicit onboarding semantics such as hire workflow steps, probation handling, auto-generated employee numbers, or startup tasks. If those behaviors are expected by the business, they are gaps or remain undocumented.
- The current evidence also does not show offboarding semantics such as termination date capture, inactive-date enforcement, access removal, archival behavior, or restrictions after a terminal status change. If the employee status is meant to drive those outcomes, that behavior is not currently visible.
- `manager` appears as a plain optional selector to `User`. The current evidence does not prove that the selector is limited to managers, employees in the same organization, or active users only.
- `status` suggests lifecycle control, but no visible code or contract evidence shows dependent field reactions, conditional required fields, or read-only transitions based on status.
- `employeeId` is required and read-only, but the current evidence does not reveal whether it is generated automatically, defaulted from the backend, or populated from another upstream process.

## Manual verification

1. Open `/employee` directly and confirm the window loads even though it is hidden from the visible menu.
2. Confirm the list view shows employee records and supports filtering by `name`, `department`, and `status`.
3. Start a new record and confirm the form exposes editable fields for name, department, position, email, phone, start date, status, and manager.
4. Confirm `employeeId` is visible but cannot be edited.
5. Open an existing record at `/employee/<recordId>` and confirm the window remains a single-record detail flow with no child tables or related-document section.
6. Change `status` and `manager` values and confirm whether any dependent behavior appears; if none appears, treat lifecycle and reporting dependencies as unsupported in current evidence.

## Automated evidence

- `tools/app-shell/src/menu.json` marks `employee` as hidden, supporting the route-only visibility claim.
- `tools/app-shell/src/windows/registry.js` registers the `employee` slug, supporting direct route loading.
- `artifacts/employee/generated/web/employee/index.jsx` shows the generated `ListView`/`DetailView` split and confirms the window is single-entity.
- `artifacts/employee/generated/web/employee/EmployeeForm.jsx` shows editable fields for name, department, position, email, phone, start date, status, and manager, plus read-only `employeeId`.
- `artifacts/employee/generated/web/employee/EmployeeTable.jsx` shows the list columns and searchable filters `name`, `department`, and `status`.
- `artifacts/employee/contract.json` defines the same field set, marks `employeeId` as read-only, exposes no process endpoints, and includes test-manifest coverage for field presence, field types, supported filters, frontend visibility, and backend-only system fields.
- Shared app-shell evidence in `docs/generated-custom-windows/app-shell-functional-flows.md` documents the generic generated-window route loading and standard list/detail entity flow used by this window.
