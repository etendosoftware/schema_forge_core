# User

## Intent
This window should let administrators maintain a person’s application identity, review basic security state, define default working context, and assign the roles that control what the user can do in the system.

## What this window should allow
Users should be able to:
- create, find, open, update, and delete user records;
- maintain identity fields such as Name, Username, First Name, Last Name, Email, Description, Position, and Phone;
- connect the user to a Business Partner and Supervisor through search-based selectors;
- set or update the Password while reviewing read-only security indicators such as Expired Password, Locked, and Last Password Update;
- choose default context values for Role, Language, Client, Organization, and Warehouse;
- add, edit, and remove child User Roles rows so a single user can hold multiple roles, including whether a role is marked as Role Administrator.

## Interaction model
- Route: `/user` for the list and `/user/:recordId` for the record detail.
- Visibility: visible in System > Settings from `tools/app-shell/src/menu.json`; it is not marked hidden.
- Implementation type: generated window loaded from `tools/app-shell/src/windows/registry.js` into the shared app-shell list/detail flow.
- Window shape: master-child. The parent entity is `user`, and the visible child entity on the detail page is `userRoles`.
- List behavior: the generated page exposes list filtering by `name`, `username`, and `email`.
- Detail behavior: the detail page renders the main user form plus a child table/form for User Roles.
- An **Attachments** tab is available in the detail tab strip, allowing files to be attached to the current record.


## Reactive behavior and dependencies
- Identity synchronization is implied for Name, First Name, and Last Name because all three fields carry the same `SL_User_Name` callout in the contract. The evidence supports that these fields are intended to react together, but the exact visible UX of that synchronization is not shown in the current SPA code.
- Business Partner and Supervisor are search selectors, so they depend on lookup results rather than free-text entry.
- Default Role is the parent selector for two dependent defaults: Default Client and Default Organization both depend on the selected role.
- Default Warehouse depends on Default Client, so warehouse availability should narrow after the client is chosen.
- The child interaction that is clearly wired today is User Roles. Opening a user record shows the child table, and adding a line exposes Role plus Role Administrator.
- Security state is visible but not user-driven in the current form: Expired Password, Locked, and Last Password Update are read-only fields or summary values.
- No status-driven actions are visible in current evidence. `statusField` is `null`, `extraBadges` is empty, and the page-level `processes` array is empty in `UserPage.jsx`.
- No totals, discount, tax, or document-style recalculation behavior is visible in current evidence for this window.

## Gap assessment
- The contract defines a second child entity, `emailConfiguration`, and generated table/form components exist for it, but `UserPage.jsx` only mounts `userRoles`. Email configuration is therefore a current gap between available contract metadata and visible UI behavior.
- The contract also defines the `smtpconnectiontest` action for `emailConfiguration`, but because the email configuration child is not mounted on the page, there is no visible evidence that a user can trigger that test from this window.
- The contract includes `processNow` and `grantPortalAccess` actions on the parent user entity, but the generated detail page exposes no visible process buttons. This is an open gap between contract capability and current page behavior.
- The shared shell supports defaults loading for new records, but there is no user-window-specific evidence here showing what user defaults are prefilled by the backend for a new record.
- The callout-backed synchronization between Name, First Name, and Last Name is suggested by the contract, but the current evidence does not prove the exact browser interaction, so it should not be treated as confirmed UI behavior without manual verification.

## Manual verification
1. Open `/user` and confirm the list can locate records by `name`, `username`, and `email`.
2. Open `/user/:recordId` and confirm the form shows identity fields, Business Partner and Supervisor lookup fields, security indicators, and default selectors.
3. Change Default Role and confirm Default Client and Default Organization react to that choice; then change Default Client and confirm Default Warehouse reacts to the client.
4. In the child area, add or edit a User Roles row and confirm the row exposes Role and Role Administrator.
5. Confirm Expired Password, Locked, and Last Password Update are displayed as review state rather than normal editable business fields.
6. Confirm the current page does not surface an Email Configuration child pane, SMTP connection test action, Process Now action, or Grant Portal Access action.
7. Open a saved record and confirm the **Attachments** tab is visible in the tab strip. Upload a file and verify it appears in the table. Download it and delete it. When multiple files exist, confirm 'Download all (ZIP)' and 'Delete all' appear in the table header and that 'Delete all' shows a confirmation dialog before removing all files.

## Automated evidence
- Route visibility is grounded in `tools/app-shell/src/menu.json` and `tools/app-shell/src/windows/registry.js`.
- Parent/child wiring, visible summary state, empty process list, and mounted child entity are grounded in `artifacts/user/generated/web/user/UserPage.jsx`.
- Form sections, read-only security fields, search selectors, and dependent default selectors are grounded in `artifacts/user/generated/web/user/UserForm.jsx`.
- User Roles child columns are grounded in `artifacts/user/generated/web/user/UserRolesTable.jsx`.
- Contract evidence for callouts, selectors, child entities, and declared actions is grounded in `artifacts/user/contract.json`.
- Generated but currently unmounted email-configuration UI exists in `artifacts/user/generated/web/user/EmailConfigurationTable.jsx` and `artifacts/user/generated/web/user/EmailConfigurationForm.jsx`.
- Shared list/detail shell behavior and defaults loading behavior are described in `docs/generated-custom-windows/app-shell-functional-flows.md`.
- No dedicated browser automation or user-window-specific SPA test was found for the visible User screen behavior in the current repository evidence.
- The generated `UserPage.jsx` includes `AttachmentsTab` in its `customTabs` prop, wired to the `AD_User` AD table.

## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to this window.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component; this window has no required header fields so the array is empty and there is no behavioral change.
