# User

This guide covers the current **System > Settings** User window exposed by `tools/app-shell/src/menu.json`. It complements `app-shell-functional-flows.md`: use the shared guide for authenticated shell behavior, generic `/:windowName` loading, and shared list/detail data behavior.

- **Purpose and surface:** Maintains user identity data, security state, role assignments, defaults, and contract-backed email-configuration metadata.
- **Route:** `/user` and `/user/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Generated window.
- **Key functional cues:**
  - The main generated form is split into `principal`, `security`, `details`, and `defaults` sections.
  - The visible form includes identity fields (`Name`, `Username`, `First Name`, `Last Name`, `Email`), search selectors (`Business Partner`, `Supervisor`), security fields (`Password`, `Expired Password`, `Locked`, `Last Password Update`), and default selectors for role/language/client/organization/warehouse.
  - `Name`, `First Name`, and `Last Name` carry the same user-name callout, so those fields are intended to stay synchronized.
  - `Default Client` and `Default Organization` depend on the selected `Default Role`, and `Default Warehouse` depends on `Default Client`.
  - The generated detail page actively wires `userRoles` as the visible child entity. Users can add role rows with a `Role` selector and a `Role Administrator` checkbox.
  - The contract also defines a second child entity, `emailConfiguration`, plus an SMTP connection-test action. Generated table/form files for that child exist, but `UserPage.jsx` does not currently mount an email-configuration detail pane.
  - Contract action metadata also exists for `processNow` and `grantPortalAccess` on the user entity, but the current generated page keeps its `processes` array empty, so there is no visible evidence of dedicated action buttons in this screen.
- **Manual verification:**
  1. Open `/user` and confirm the list supports the current searchable fields: `name`, `username`, and `email`.
  2. Open `/user/<recordId>` and confirm the detail summary shows `Expired Password`, `Locked`, and `Last Password Update`.
  3. In the `defaults` section, choose a `Default Role` and confirm the dependent `Default Client` and `Default Organization` selectors react to that choice; then choose a client and confirm `Default Warehouse` follows that dependency chain.
  4. In the child area, add or edit a `User Roles` row and confirm the row exposes `Role` plus `Role Administrator`.
  5. Confirm the current user detail page does not surface an `Email Configuration` child pane or an SMTP connection-test button, even though the contract and generated bundle define that metadata.
- **Automated evidence:** `artifacts/user/contract.json` includes schema-level checks for user fields, selectors, `userRoles`, `emailConfiguration`, and the SMTP action endpoint metadata. There is no dedicated SPA test covering the visible child-pane behavior on the current user detail page.
