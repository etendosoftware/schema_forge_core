# Chart of Accounts

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It focuses on the Chart of Accounts finance window exposed through the app shell.

- **Purpose / surface:** Maintain the account master and review debit, credit, and balance figures for each account from the visible **Finance** menu entry.
- **Route:** `/chart-of-accounts` and `/chart-of-accounts/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route.

## Key functional cues

- The surface is intentionally simple: one `account` entity with no child entities and no contract process endpoints.
- Primary editable business fields are **Code**, **Name**, **Account Type**, and optional **Parent Account**.
- The table adds read-only financial review columns for **Debit**, **Credit**, and **Balance**.
- `isActive` is present but read-only in the generated form, so this screen behaves more like account maintenance plus balance review than a free-form activation toggle.
- Search/filter support is limited to `code`, `name`, and `accountType`.

## Manual verification

1. Open `/chart-of-accounts` from the Finance menu and confirm the list exposes account rows.
2. Verify the table shows **Code**, **Name**, **Account Type**, **Parent Account**, **Debit**, **Credit**, **Balance**, and active-state visibility.
3. Filter by **Code**, **Name**, and **Account Type**.
4. Create or edit an account and confirm the business-editable fields are **Code**, **Name**, **Account Type**, and optional **Parent Account**.
5. Open `/chart-of-accounts/:recordId` directly for an existing account and confirm the detail surface matches the list-driven navigation.

## Automated evidence

- No dedicated frontend test file was found for this window.
- The contract includes field-presence and field-type expectations, but route/loading coverage still belongs to the shared app-shell guide.
