# Recurring Invoice

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It focuses on the Recurring Invoice finance window exposed through the app shell.

- **Purpose / surface:** Maintain recurring billing templates with next-run scheduling and status tracking.
- **Route:** `/recurring-invoice` and `/recurring-invoice/:recordId`.
- **Visibility:** Hidden in the Finance menu. `menu.json` marks the item `hidden: true`, and `buildMenuGroups()` filters hidden items out of the visible menu.
- **Implementation:** Generated window route. The slug still exists in `registry.js`, so the page remains reachable by direct URL.

## Key functional cues

- The window is a single-entity surface for `recurringInvoice`; there are no child entities, related-document tabs, or process endpoints in the checked contract.
- Required business fields are **Name**, **Business Partner**, **Frequency**, **Next Date**, **Amount**, **Currency**, **Status**, and **Start Date**.
- **End Date** is optional and **Last Generated** is read-only, so the surface behaves like a schedule template editor rather than a transaction screen.
- Search/filter support is limited to `name`, `businessPartner`, and `status`.
- The generated form groups core identity/scheduling fields in the principal section, with money/status/date controls following in the secondary section.

## Manual verification

1. Sign in and confirm the Finance side menu does **not** show a visible **Recurring Invoice** entry.
2. Navigate directly to `/recurring-invoice` and confirm the generated list loads successfully.
3. Verify the list can be filtered by **Name**, **Business Partner**, and **Status**.
4. Create or edit a recurring invoice and confirm the required fields are **Name**, **Business Partner**, **Frequency**, **Next Date**, **Amount**, **Currency**, **Status**, and **Start Date**.
5. Confirm **Last Generated** is review-only and that `/recurring-invoice/:recordId` loads the same record directly.

## Automated evidence

- No dedicated frontend test file was found for this window.
- The contract includes field/type expectations, but shared route/loading behavior should still be validated through the shared app-shell guide.
