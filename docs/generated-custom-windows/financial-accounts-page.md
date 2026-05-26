# Financial Accounts (Cuentas)

> **Story:** ETP-4095 (T1 of the Bank Reconciliation epic ETP-3504).
> Replaces the legacy `bank-reconciliation` placeholder as the entry point for the Tesorería / Cuentas surface.

## Intent

Use this page as the entry point to the reconciliation module. It lists the active financial accounts the user can see (banks, cash drawers and cards), exposes the per-currency balances aggregated across them and highlights how many lines are still pending reconciliation. From here the user opens a single account to manage its reconciliation workflow (introduced in T4) or triggers a manual match (T6).

## What this page allows in T1

- List all active `FIN_Financial_Account` records for the current client and accessible organizations.
- Show the aggregated sidebar widgets:
  - Total balance across visible accounts.
  - Balance broken down by ISO currency (EUR, USD, …).
  - Pending counters: accounts with unreconciled `FIN_Bank_Statement_Line`s plus placeholders for the matching engine (introduced in T5).
- Filter the table by account type (Banco, Caja, Tarjeta) and search by name / IBAN / currency.
- Click a row to navigate to `/financial-account/:id` (placeholder route in T1; the real detail view ships in T4).
- Click the pending pill (`Conciliar (N)`) on a row to surface a toast pointing at T6 (`ETP-4100`).
- Click "Reglas de matcheo" to surface a toast pointing at T5 (`ETP-4099`).

## What is intentionally out of scope for T1

- "+ Nueva cuenta" button: disabled in T1, modal arrives with ETP-4096 (T2).
- PSD2 wiring (`Sync now`, `Connect`, `Disconnect`): every kebab item except "Abrir cuenta" is disabled; the connection model arrives with ETP-4097 (T3).
- Matching rules drawer and the suggestions engine: ETP-4099 (T5).
- Manual reconciliation split panel and the reconcile handler: ETP-4100 (T6) and ETP-4101 (T7).
- Deferred accounting and reactivate flow: ETP-4102 (T8).

## Interaction model

- Route: `/finance/accounts` (registered in `App.jsx`).
- Standalone page (Level 4 in the app-shell taxonomy) — not an AD window. The precedent is `DashboardPage.jsx` / `CrmPage.jsx`.
- Layout: 292 px sidebar + flexible main panel with the accounts table.
- The page uses `useSetPageMeta` to render the breadcrumb `Tesorería / Cuentas` on the topbar.

## Backend contract

Single NEO Headless endpoint:

```
GET /sws/neo/financial-accounts-page
```

Powered by `FinancialAccountsPageHandler` (`com.etendoerp.go.schemaforge.FinancialAccountsPageHandler`, qualifier `financial-accounts-page`).

Response shape (envelope `response.data`):

```json
{
  "accounts": [
    {
      "id": "94EAA455D2644E04AB25D93BE5157B6D",
      "name": "BBVA Principal",
      "type": "B",
      "currentBalance": 12345.67,
      "currencyId": "102",
      "currencyIso": "EUR",
      "iban": "ES12...",
      "isDefault": true,
      "pendingCount": 4
    }
  ],
  "summary": {
    "totalBalance": 54321.0,
    "byCurrency": [
      { "currencyIso": "EUR", "total": 32000.0 }
    ],
    "pending": {
      "accountsWithPending": 3,
      "suggestionsReady": 0,
      "byRule": 0
    }
  }
}
```

- `accounts` is filtered by `AD_Client_ID = current client` and the accessible organization tree from `OrganizationStructureProvider`.
- `pendingCount` counts active `FIN_Bank_Statement_Line` rows linked to the account (through `FIN_BankStatement`) whose `fin_finacc_transaction_id IS NULL`.
- `summary.totalBalance` is the raw sum of `CurrentBalance` across visible accounts. Currency normalisation against the GL schema arrives with later stories.
- `summary.pending.suggestionsReady` and `summary.pending.byRule` always return `0` in T1 because the `ETBR_Match_Suggestion` table lands with T5.

## Frontend file map

```
tools/app-shell/src/
├── pages/FinancialAccountsPage.jsx
├── components/financial-accounts/
│   ├── index.js
│   ├── tokens.js
│   ├── CuentasToolbar.jsx
│   ├── CuentasSidebar/
│   │   ├── index.jsx
│   │   ├── BalanceCard.jsx
│   │   ├── BalanceByCurrencyCard.jsx
│   │   └── PendingReconcileCard.jsx
│   ├── AccountsTable/
│   │   ├── index.jsx
│   │   ├── AccountsTableHeader.jsx
│   │   └── AccountRow.jsx
│   ├── AccountLogoAvatar.jsx
│   ├── SyncStatusInline.jsx
│   ├── ReconcilePill.jsx
│   ├── AccountTypeFilter.jsx
│   ├── AccountRowMenu.jsx
│   └── __tests__/
│       ├── ReconcilePill.vitest.jsx
│       ├── AccountTypeFilter.vitest.jsx
│       └── AccountRow.vitest.jsx
└── hooks/useFinancialAccounts.js
```

Locale keys live under `finance.accounts.*` in both `en_US.json` and `es_ES.json`.

The legacy `bank-reconciliation` placeholder entry in `menu.json` is now hidden (`hidden: true`) — the canonical entry in the Finance menu is `financial-accounts` (label "Cuentas" / "Accounts", path `finance/accounts`). The placeholder will be removed in T8 once the full reconciliation flow is shipped.

## Manual verification

1. Start the dev server with `make dev` and visit `http://localhost:3100/finance/accounts` after logging in.
2. The sidebar should match the Figma frame `3012:25602`:
   - Total balance reflects the sum of every active account.
   - "Por moneda" lists each ISO code with its aggregated total.
   - "Pendientes de conciliar" shows the number of accounts with non-zero `pendingCount`.
3. Toggle the type filter (Banco / Caja / Tarjeta / Todas) and confirm the table updates.
4. Type a partial bank name in the search box and confirm the table narrows down.
5. Click "Reglas de matcheo" and verify the toast "Próximamente en T5 (ETP-4099)" appears.
6. Hover the disabled "+ Nueva cuenta" button and verify the tooltip points to T2.
7. Click a row and confirm the navigation to `/financial-account/{id}` (placeholder route).
8. Click the pending pill of a row with `pendingCount > 0` and confirm the toast points to T6.

## Tests

- Backend: `FinancialAccountsPageHandlerTest` (JUnit + Mockito) in `com.etendoerp.go` covers the response builders and HTTP method routing.
- Frontend: `*.vitest.jsx` files under `components/financial-accounts/__tests__/`, `hooks/__tests__/useFinancialAccounts.vitest.jsx` and `pages/__tests__/FinancialAccountsPage.vitest.jsx`.

## Deployment notes

The NEO spec for this endpoint is configured through the Schema Forge artifact at `artifacts/financial-accounts-page/report-contract.json`. After deploying the backend the user must run, in the Etendo root:

```bash
node schema_forge/cli/src/push-to-neo.js financial-accounts-page
./gradlew export.database
./gradlew smartbuild
```

These steps are owned by the developer because the Schema Forge toolchain does not have permission to run Gradle.
