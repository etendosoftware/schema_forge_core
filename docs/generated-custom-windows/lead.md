# Lead

## Intent

This window should let a sales or CRM user capture an early commercial opportunity, record who the prospect is, note how the lead arrived, and track whether the lead is still being qualified.

The current contract and generated UI describe a lightweight lead register rather than a full conversion workflow. The exposed data focuses on basic identification, qualification status, ownership, estimated value, and free-form notes.

## What this window should allow

A user should be able to:
- create a new lead with at least a required name and required status;
- record core qualification context such as company, email, phone, source, assigned owner, estimated value, and notes;
- browse existing leads in a list and filter them by name, company, and status;
- open an individual lead to review or update its qualification data.

Based on the current evidence, this window does not expose child records, related documents, or lead-conversion actions. It behaves like a single lead header record per screen.

## Interaction model

- Route: `/lead`
- Detail route: `/lead/:recordId`
- Visibility: route-only; the menu entry exists in `tools/app-shell/src/menu.json` but is marked hidden
- Implementation type: generated standard list/detail window loaded from the app-shell registry and rendered through `ListView` and `DetailView`
- Window shape: single-entity window for the `lead` entity; no master-child layout is visible in the current contract or generated components

In list mode, the table shows name, company, email, phone, source, status, assigned user, and estimated value. In detail mode, the form exposes the same business fields plus notes.

## Reactive behavior and dependencies

The current evidence shows a small amount of reactive behavior:
- `source`, `status`, and `assignedTo` are selector fields, so the form depends on reference data for lead sources, lead statuses, and users.
- The shared app-shell entity flow supports list filtering, detail loading, save/update, delete, pagination, and generic defaults loading for generated windows.
- No parent/child interaction is visible because this window exposes only the `lead` entity.
- No dependent selector chain is visible in the lead-specific contract or generated form. For example, nothing indicates that choosing a source filters available statuses or owners.
- No totals, discounts, taxes, or line-level recalculations are relevant or visible here.
- No status-driven actions are visible in the current evidence. The status field is present, but there is no documented process button, stage transition action, qualification rule, or automatic follow-up behavior.
- Defaulting is only visible at the shared shell level: generated windows can request `/<entity>/defaults`, but no lead-specific default values or defaulting rules are documented in the lead contract or tests.

## Gap assessment

- The business intent of a lead screen usually implies a qualification lifecycle, but the current evidence only proves a free-edit `status` selector. Required stage rules, allowed transitions, or qualification criteria are not visible.
- A CRM lead flow often supports conversion into a deal, contact, account, or similar downstream record. No conversion action, related entity creation flow, or linked follow-up behavior is visible in the contract, generated UI, or process endpoints. This is a functional gap or open ambiguity.
- The window is hidden from the visible menu and appears to be route-only. If lead capture is meant to be part of a standard CRM navigation flow, that discoverability is currently missing.
- No child activities, tasks, communications, attachments, or history are visible. If qualification depends on tracked follow-up work, the current window does not show that behavior.
- Shared defaults plumbing exists, but there is no lead-specific evidence for auto-assignment, default status, default source, or other onboarding rules.
- No lead-specific automated test was found, so current confidence is limited to contract shape, generated component structure, and shared app-shell behavior rather than window-specific user-flow verification.

## Manual verification

1. Open `/lead` directly and confirm the window loads even though the menu entry is hidden.
2. Confirm the list view shows the main lead fields and supports filtering by name, company, and status.
3. Start a new record and confirm the form allows entry of name, company, email, phone, source, status, assigned owner, estimated value, and notes.
4. Confirm `name` and `status` behave as required fields.
5. Open `/lead/<recordId>` and confirm the same lead can be reviewed and updated in detail mode.
6. Confirm the window remains a single-record flow with no child tables, related-document area, or conversion action for creating a downstream deal or contact.
7. If the backend exposes defaults, confirm whether a new lead receives a default status, source, or assignee; if not, treat the absence as current behavior rather than assumed business logic.

## Automated evidence

- `artifacts/lead/contract.json` defines a single `lead` entity with editable fields for `name`, `company`, `email`, `phone`, `source`, `status`, `assignedTo`, `estimatedValue`, and `notes`, plus searchable fields `name`, `company`, and `status`.
- `artifacts/lead/generated/web/lead/index.jsx` shows the route resolves to a standard generated `ListView`/`DetailView` pair for the `lead` entity.
- `artifacts/lead/generated/web/lead/LeadTable.jsx` shows the list columns and filters currently exposed.
- `artifacts/lead/generated/web/lead/LeadForm.jsx` shows the editable form fields and confirms there is no visible child section or custom reactive logic in this generated form.
- `tools/app-shell/src/menu.json` marks the `lead` window as hidden, which supports the route-only visibility claim.
- `tools/app-shell/src/windows/registry.js` registers `lead` in the app-shell loader map.
- Shared automated evidence exists for generated window loading and generic entity behavior, but not for this window specifically: `tools/app-shell/src/windows/__tests__/registry.test.js`, `tools/app-shell/src/hooks/__tests__/useEntity-defaults.test.js`, and `tools/app-shell/src/hooks/__tests__/useEntity-pagination.test.js`.