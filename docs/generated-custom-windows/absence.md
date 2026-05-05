# Absence

## Intent

The Absence window should let HR or line-management users register an employee absence request or record, capture the requested date range, and track where that absence sits in its lifecycle from submission through review or approval.

## What this window should allow

- Create and update an absence record with the responsible employee, absence type, start date, end date, status, and optional reason.
- Review absence records in a list by employee, type, date range, duration, status, and approver context.
- Search the list by employee, absence type, and status when users need to find requests that are pending, approved, rejected, or otherwise in progress.
- Open an individual record to confirm the requested period, the tracked number of days, and whether an approver has been assigned.

## Interaction model

- **Route:** `/absence` for the list and `/absence/:recordId` for the detail form.
- **Visibility:** Route-only. `menu.json` declares the window as hidden, so users are not expected to reach it from the visible navigation.
- **Implementation type:** Generated standard list/detail window backed by `ListView`, `DetailView`, `DataTable`, and `EntityForm`.
- **Window shape:** Single-entity window. Current evidence shows one primary `absence` entity with no child tables or master-child structure.

## Reactive behavior and dependencies

- The form depends on selector inputs for `employee`, `type`, and `status`, plus a read-only selector for `approvedBy`. Current evidence shows these as plain selector fields; no dependent-selector behavior is visible.
- The date range is captured explicitly through `startDate` and `endDate`. A read-only `days` field is present, which suggests duration should be derived or maintained elsewhere, but no visible client-side reaction shows how or when that value recalculates.
- `status` is editable and `approvedBy` is read-only, which suggests lifecycle tracking is part of the record. However, no window-specific status-driven actions, approval buttons, or process endpoints are visible in the current contract or generated entry.
- There is no parent/child interaction, related-documents panel, totals, discount, tax, or other cross-row reactive behavior visible in current evidence.
- No explicit defaulting behavior is declared for absence-specific fields in the contract or generated form. Generic app-shell defaults support may exist at runtime, but no absence-specific defaults are visible here.

## Gap assessment

- A practical absence workflow usually needs clear approval semantics such as submit, approve, reject, or cancel. The current evidence exposes a `status` field and read-only `approvedBy`, but does not show the workflow steps, transition rules, or who is allowed to change them. Treat approval behavior as an open gap or ambiguity.
- Overlap validation is commonly expected for absence periods so an employee cannot create conflicting records. No overlap check, date-order validation, or conflict warning is visible in the current contract, generated form, or generated entry.
- The presence of a read-only `days` field implies that absence duration should react to the selected date range, but the current evidence does not show where that calculation happens or whether weekends, holidays, or partial-day rules are applied.
- Because the window is hidden from the menu, discoverability depends on direct routing or links from another flow. If this window is meant for routine HR use, route-only visibility may itself be a functional gap.

## Manual verification

1. Open `/absence` directly and confirm the list loads even though the window is hidden from the visible menu.
2. Verify the list exposes employee, absence type, start date, end date, days, status, and approver context, and that search/filtering is available for employee, type, and status.
3. Create or open a record at `/absence/<recordId>` and confirm the form allows editing employee, type, start date, end date, status, and reason while keeping `days` and `approvedBy` read-only.
4. Change the date range and observe whether `days` updates automatically, only after save, or not at all.
5. Try an approval-oriented lifecycle change by modifying `status` and confirm whether `approvedBy` is populated automatically or remains unchanged.
6. Try entering an overlapping or inverted date range and note whether the window blocks it, warns about it, or accepts it without validation.

## Automated evidence

- `tools/app-shell/src/menu.json` marks `absence` as hidden, which supports the route-only visibility claim.
- `tools/app-shell/src/windows/registry.js` registers an `absence` window loader, which supports `/absence` and `/absence/:recordId` as loadable generated routes.
- `artifacts/absence/generated/web/absence/index.jsx` shows the generated list/detail pattern for a single `absence` entity with no child sections.
- `artifacts/absence/generated/web/absence/AbsenceForm.jsx` exposes editable `employee`, `type`, `startDate`, `endDate`, `status`, and `reason` fields plus read-only `days` and `approvedBy`.
- `artifacts/absence/generated/web/absence/AbsenceTable.jsx` exposes list columns for employee, type, start date, end date, days, status, and approvedBy, and filters for employee, type, and status.
- `artifacts/absence/contract.json` declares CRUD endpoints for `absence` and a `testManifest` with 26 node-runner checks for field presence, field types, searchable filters, frontend visibility, and backend-only system fields. No dedicated absence-specific executed test file was found in the current repo evidence.