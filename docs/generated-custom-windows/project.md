# Project

## Intent

Use this window to maintain the core record for a project: its identity, client context, responsible manager, lifecycle status, target dates, budget, and priority. From a business perspective, this is the place to define the project header that other operational records can reference.

## What this window should allow

Users should be able to:
- browse existing projects by name, client, or status
- create a new project with the minimum planning data needed to identify and own the work
- update the project header as ownership, status, dates, budget, or priority change
- remove a project record when it should no longer exist
- open a project directly by record id for review or maintenance

Current evidence shows the editable business fields as `Name`, `Code`, optional `Client`, required `Manager`, required `Status`, required `Start Date`, optional `End Date`, optional `Budget`, and required `Priority`.

## Interaction model

- Route: `/project` for the list and `/project/:recordId` for the detail form
- Visibility: route-only; the Projects menu group exists in `menu.json` but is hidden in the shell, so this window is not currently reachable from visible navigation
- Implementation type: generated window loaded through the generic window registry
- Window shape: single-entity window with primary entity `project`; no child tabs or master-child sections are declared in the current contract

The list view exposes searchable filters for `name`, `client`, and `status`. The detail view uses a single project form with no custom panels, related-documents area, or window-specific process actions.

## Reactive behavior and dependencies

Current evidence shows a straightforward header form rather than a reactive planning workspace.

Visible dependencies:
- `Client` depends on a business partner search reference
- `Manager` depends on a user selector
- `Status` depends on a project status selector
- `Priority` depends on a priority selector

Visible behavior in current evidence:
- list/detail loading follows the shared generated-window behavior from the app shell
- create, update, and delete use the standard entity CRUD flow for a single entity
- direct detail access depends on the record id route parameter

Not visible in current evidence:
- no parent/child interaction, because no child entities are defined for this window
- no dependent selector logic between project fields
- no status-driven actions, process buttons, or read-only transitions specific to projects
- no visible reactions that recalculate totals, discounts, taxes, or budget consumption
- no project-specific defaulting rules beyond the app shell's generic defaults flow, and no project defaults endpoint behavior is documented here

The project entity is also used as a selectable reference in other windows such as Document, which means downstream records can depend on project master data even though this window itself does not expose cross-record reactions.

## Gap assessment

The business meaning of a project suggests richer behavior than what is currently evidenced.

Observed gaps or open ambiguities:
- No task, milestone, time-entry, or other execution child records are surfaced here, so project-to-task management is not currently supported by this window evidence.
- A `Budget` field exists, but there is no visible behavior for budget validation, committed-vs-actual tracking, alerts, or recalculation from related records.
- `Status` is required, but there is no visible evidence that status changes lock fields, enable actions, or drive workflow transitions.
- `Start Date` and `End Date` are present, but there is no visible scheduling behavior such as date validation, duration calculation, or dependency handling.
- The hidden Projects menu group means the window currently behaves as a maintained route rather than a discoverable navigation destination.
- No automated evidence was found for project-specific UI behavior beyond contract/test-manifest shape, so interaction expectations remain mostly CRUD-level.

These should be treated as current implementation limits unless separate evidence shows project planning, budgeting, or execution workflows elsewhere.

## Manual verification

1. Open `/project` directly and confirm the list loads even though the Projects menu group is hidden.
2. Filter the list by name, client, and status and confirm those are the available search dimensions.
3. Create a project and confirm the form requires `Name`, `Code`, `Manager`, `Status`, `Start Date`, and `Priority`.
4. Confirm `Client`, `End Date`, and `Budget` remain optional during creation and edit.
5. Open `/project/:recordId` directly and confirm the same record loads in detail view.
6. Save an update to status, dates, or budget and confirm the record persists through the standard single-entity CRUD flow.

## Automated evidence

Grounded evidence for this document comes from:
- `artifacts/project/contract.json` for the entity shape, required fields, supported filters, CRUD endpoints, and the absence of child entities or process endpoints
- `artifacts/project/generated/web/project/index.jsx` for list/detail routing within the generated window
- `artifacts/project/generated/web/project/ProjectForm.jsx` for the current form fields and selector/search references
- `artifacts/project/generated/web/project/ProjectTable.jsx` for visible columns and list filters
- `tools/app-shell/src/menu.json` for the hidden Projects menu group and route-only visibility
- `tools/app-shell/src/windows/registry.js` for generated window registration
- `docs/generated-custom-windows/app-shell-functional-flows.md` for the shared shell route model and generic generated-window/entity CRUD behavior

No project-specific frontend test or browser automation was found. The contract test manifest provides structural evidence for field presence, field types, searchable filters, and backend-only system fields, but not for richer project workflow behavior.
