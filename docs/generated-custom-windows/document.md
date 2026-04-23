# Document

## Intent

Use this window to maintain document header metadata rather than the document payload itself. The current evidence supports a record-maintenance surface where users classify a document, link it to a project, review upload metadata, track status, and preserve audit history around who created or updated the record.

## What this window should allow

Users should be able to:
- browse existing document records by name, category, or status
- create a document metadata record with the required identification and classification fields
- link a document to a project when the file belongs to project work
- update status and descriptive tags as the document moves through its lifecycle
- review read-only upload metadata such as who uploaded the record, when it was uploaded, file size, and version
- open a document record directly by id for review or maintenance

Current evidence shows editable business fields for `Name`, required `Category`, optional `Project`, required `Status`, and optional `Tags`. It also shows read-only metadata fields for `Uploaded By`, `Upload Date`, `File Size`, and `Version`. Backend-only system audit fields `createdBy`, `updatedBy`, `created`, and `updated` exist in the contract but are not exposed in the generated frontend.

## Interaction model

- Route: `/document` for the list and `/document/:recordId` for the detail form
- Visibility: route-only; the Projects menu group contains Document but the entire group is hidden in the shell, so users cannot currently reach it from visible navigation
- Implementation type: generated standard list/detail window loaded through the generic window registry
- Window shape: single-entity window with primary entity `document`; no child tabs, attachments sub-grids, or master-child sections are declared in current evidence

The list view exposes searchable filters for `name`, `category`, and `status`. The detail view uses one generated document form with no custom side panels, no related-record sections, and no window-specific process actions.

## Reactive behavior and dependencies

Visible dependencies:
- `Category` depends on a `DocumentCategory` selector
- `Project` depends on a `Project` selector
- `Status` depends on a `DocumentStatus` selector
- `Uploaded By` is a read-only `User` selector that displays existing metadata rather than letting the user pick an uploader

Visible behavior in current evidence:
- list/detail loading follows the shared generated-window behavior from the app shell
- create, update, and delete use the standard single-entity CRUD flow for `document`
- direct detail access depends on the record id route parameter
- upload-oriented metadata is presented as read-only review data in the form and table

Not visible in current evidence:
- no parent/child interaction, because no child entities are defined for this window
- no dependent selector logic between category, project, status, or tag fields
- no status-driven actions, approval buttons, publish actions, or lifecycle locks tied to `status`
- no totals, discounts, taxes, or other calculated commercial reactions, because this window is metadata-oriented and single-entity
- no document-specific defaulting behavior beyond shared app-shell defaults support
- no visible file-content upload, download, preview, replacement, or binary-storage workflow in the generated window evidence

## Gap assessment

Observed gaps or open ambiguities:
- The window name suggests a full document-management experience, but current evidence only supports document metadata maintenance. If users are expected to upload, replace, download, preview, or manage binary file content here, that workflow is not visible in the current contract or generated UI.
- Read-only metadata fields such as `Uploaded By`, `Upload Date`, `File Size`, and `Version` imply an upstream upload or synchronization process, but the source of those values and when they change are not documented in current evidence.
- `Status` is required, but there is no visible evidence that status changes trigger transitions, field locking, notifications, or downstream process availability.
- The backend contract includes system audit fields `createdBy`, `updatedBy`, `created`, and `updated`, but the generated frontend does not expose them. If users need visible audit history in the window, that is currently a gap.
- Because the Projects menu group is hidden, this window behaves as a maintained route instead of a discoverable document workspace.
- No document-specific automated UI evidence was found beyond contract/test-manifest structure, so richer expectations about review, audit, or file-handling behavior remain unverified.

## Manual verification

1. Open `/document` directly and confirm the list loads even though the Projects menu group is hidden.
2. Verify the list exposes document name, category, project, uploaded-by metadata, upload date, file size, version, status, and tags, with filters for name, category, and status.
3. Create or open a record at `/document/:recordId` and confirm the form requires `Name`, `Category`, and `Status` while keeping `Project` and `Tags` optional.
4. Confirm `Uploaded By`, `Upload Date`, `File Size`, and `Version` render as read-only metadata rather than editable inputs.
5. Update `Project`, `Status`, or `Tags` and confirm the record persists through the standard single-entity CRUD flow.
6. Check whether the UI exposes any upload, download, preview, or file-replacement action; if none appears, record that the window currently manages metadata only.
7. Inspect whether created/updated audit history is visible anywhere in the detail view; if it is not visible, confirm that audit fields remain backend-only in current behavior.

## Automated evidence

Grounded evidence for this document comes from:
- `docs/generated-custom-windows/document.md` previous window summary for the original route, visibility, and metadata framing
- `artifacts/document/contract.json` for the entity shape, required fields, selector references, CRUD endpoints, searchable filters, and backend-only system audit fields
- `artifacts/document/generated/web/document/index.jsx` for the generated list/detail routing pattern
- `artifacts/document/generated/web/document/DocumentForm.jsx` for editable versus read-only fields and selector dependencies
- `artifacts/document/generated/web/document/DocumentTable.jsx` for visible list columns and list filters
- `tools/app-shell/src/menu.json` for the hidden Projects menu group and route-only visibility
- `tools/app-shell/src/windows/registry.js` for generated window registration
- `docs/generated-custom-windows/app-shell-functional-flows.md` for the shared shell route model and generic generated-window/entity CRUD behavior

The contract test manifest provides structural evidence for field presence, field types, searchable filters, frontend visibility, and backend-only system fields for `document`, but no dedicated executed browser-level document workflow test was found in the current repo evidence.