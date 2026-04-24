# Activity

## Intent

Provide a focused CRM activity tracker where a user can record follow-ups, calls, meetings, tasks, and notes tied to ongoing deal and contact work. The current contract positions this window as the place to capture what happened, what should happen next, who owns it, and when it is due for commercial relationship tracking.

## What this window should allow

A user should be able to browse activities, search existing entries, open a record, and create or update an activity with the core tracking fields exposed by the contract. In current evidence, that means recording at least the activity type, subject, and status, with optional linkage to a deal and contact plus operational details such as assignee, due date, duration, and notes.

The window should support using activities as lightweight work items around CRM context rather than as a document with downstream posting behavior. No child lines, approval subflows, or related-document side panels are visible in the current generated implementation.

## Interaction model

- Route: list route `/activity`; detail route `/activity/:recordId`.
- Visibility: route-only. `menu.json` marks the window hidden, so users do not reach it from the visible side menu.
- Implementation type: generated standard `ListView` + `DetailView` window loaded from `registry.js` into the generic `/:windowName` and `/:windowName/:recordId` shell routes.
- Window shape: single-entity window for `activity`; no master-child structure is declared in the contract or generated page.
- List interaction: the table exposes columns for type, subject, deal, contact, assignee, due date, status, and duration, with filters on subject, contact, and type.
- Detail interaction: the form is split into principal and other sections and exposes selectors/search inputs for activity type, deal, contact, assignee, due date, status, notes, and duration.

## Reactive behavior and dependencies

The visible dependencies are relational rather than procedural. A user can link an activity to a deal and a contact, and can assign it to a user, but current evidence only shows independent selectors/search fields for those references. There is no visible parent/child interaction, no dependent selector logic between deal and contact, no child table refresh cycle, and no related records panel specific to this window.

Status, assignee, and due date are present as editable fields, but the generated form does not show status-driven actions, automatic reassignment behavior, overdue highlighting, reminder logic, or due-date calculations. The app shell does support a generic defaults fetch for new records at the entity level, but no activity-specific defaulting rules are evidenced in this window contract or generated files.

Totals, discount, tax, and document lifecycle reactions are not applicable in the current activity surface.

## Gap assessment

- The business intent suggests task tracking, but there is no current evidence of workflow automation tied to status changes such as completion handling, cancellation side effects, or action gating.
- The presence of `assignedTo` suggests ownership tracking, but no code-backed reaction is visible when assignee changes, and no evidence shows queueing, notifications, or filtering by current user.
- The presence of `dueDate` suggests scheduling behavior, but no code-backed overdue state, sorting emphasis, reminders, or calendar integration is visible in the current evidence.
- Because activities can link to both `deal` and `contact`, a user could reasonably expect contextual filtering or synchronization between those lookups. Current evidence does not show that dependency, so it remains an open ambiguity.
- The window is hidden from the visible menu and must be opened by route, which limits discoverability unless another CRM surface links into it.
- No activity-specific automated test was found, so current confidence is based on contract shape, generated window structure, and shared app-shell behavior rather than direct scenario coverage.

## Manual verification

1. Open `/activity` directly and confirm the list loads even though the window is hidden from the visible menu.
2. Verify the list shows the expected tracking columns and allows filtering by subject, contact, and type.
3. Open `/activity/<recordId>` or create a new record and confirm the form exposes type, subject, deal, contact, assignee, due date, status, notes, and duration.
4. Save an activity linked to a deal and contact, then reopen it and confirm the links and tracking values persist.
5. Check whether changing status, due date, or assignee causes any visible reaction beyond field persistence. If nothing changes, record that as the current behavior.
6. Confirm the detail flow remains single-entity with no child grids, no related-documents panel, and no window-specific action bar behavior.

## Automated evidence

- `tools/app-shell/src/menu.json` marks `activity` as hidden, supporting the route-only visibility claim.
- `tools/app-shell/src/windows/registry.js` registers `activity` to the generated activity window loader.
- `artifacts/activity/generated/web/activity/index.jsx` shows a standard generated `ListView`/`DetailView` split based on the optional record id.
- `artifacts/activity/generated/web/activity/ActivityTable.jsx` defines the list columns and the available filters (`subject`, `contact`, `type`).
- `artifacts/activity/generated/web/activity/ActivityForm.jsx` defines a flat `EntityForm` with fields for type, subject, deal, contact, assignee, due date, status, notes, and duration, with no visible custom reactive hooks.
- `artifacts/activity/contract.json` defines the `activity` entity as a single primary entity window and exposes the same editable fields plus GET endpoints for `/activity` and `/activity/:id`.
- `docs/generated-custom-windows/app-shell-functional-flows.md` provides the shared shell evidence for generic `/:windowName` and `/:windowName/:recordId` route loading and generic entity defaults behavior.
