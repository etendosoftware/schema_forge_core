# Financial Account Detail

Detail view for a single `FIN_Financial_Account` reached from the Cuentas list page.

## Intent

Display the full detail of a financial account: a summary strip with KPIs, and three tabs for Movements, Reconciliation and Imported Statements. The Movements tab is the primary working surface; the other two are placeholders pending later iterations.

## What this view does

- Navigate to `/financial-account/:id` from the Cuentas list (row click).
- Topbar shows `{accountName}` as title and `Finanzas / Cuentas / {accountName}` as breadcrumb via `useSetPageMeta` (inlined in `index.jsx` — no per-window header bar).
- Account Summary Strip (single horizontal bar inside the Movements tab body): avatar + IBAN (chunked in groups of 4, with copy-to-clipboard) | Saldo total | Entradas (30D) | Salidas (30D). The three KPI sections use `flex-1` so they spread evenly.
- Three tabs with counts: Movements (live data), Reconciliation (placeholder), Imported Statements (placeholder).
- Export button at the right of the tab strip — fires a toast (real export is out of scope).
- Movements toolbar: back arrow `←`, status filter (8 payment statuses, search-enabled), date range filter (preset list + dual calendar, same picker as grid views), type filter (BPD/BPW, search-enabled), amount filter (presets + manual min/max), search input, `+ Nuevo movimiento` button (yellow hover, fires toast — real action is T8).
- Movements table: Checkbox | Date | Document | Contact | Description | Status (`MovementStatusBadge`) | Type (with `PostingStatusDot` sub-label) | Amount | Balance.
- Locale-aware date format in the Date column (es_ES → `dd/MM/yyyy`, en_US → `M/d/yyyy`).
- Individual row checkbox + select-all (indeterminate when partial).
- Row hover: subtle shadow elevation + kebab appears (View detail active toast; Unreconcile / Post disabled with tooltip).
- Back arrow in the toolbar runs `navigate(-1)`.
- `+ Nuevo movimiento` button (yellow hover) — currently fires a "coming soon" toast.

## Not implemented yet

- `+ Nuevo movimiento` real action — toast placeholder for now.
- Reconciliation tab body — placeholder (T6/T7).
- Statement matching / reconciliation — import leaves statements with `processed='N'` (T6/T7).
- Unreconcile / Post row actions — visible but disabled, with tooltip.
- Real bank logos (Santander, BBVA, etc.) — uses the generic `AccountLogoAvatar` for all accounts.
- Server-side filtering for movements and statements — filters are applied client-side.

## Routing

- URL: `/financial-account/:id` — catch-all route `/:windowName/:recordId` in `App.jsx` → `WindowLoader` → `customLoaders['financial-account']`.
- Entry in `menu.json` under the Finance group (`hidden: true`) so `buildWindowMap()` registers it.
- Entry in `registry.js` `customLoaders`: `'financial-account': () => import('./custom/financial-account/index.jsx')`.

## Component tree

```
index.jsx                          — receives { recordId }, sets page meta, mounts TooltipProvider
  DetailTabs.jsx + Tabs primitives — 3 tabs with icon + label + badge
    ExportButton (inline)          — right of tab strip, toast
    MovimientosTab.jsx             — toolbar + summary strip + table; runs applyFilters client-side
      MovementsToolbar/index.jsx   — back ←, 4 filters, search, + Nuevo movimiento
        StatusFilter.jsx           — wraps DistinctValuesFilter (8 codes)
        DateRangeFilter.jsx        — wraps DateRangePopover
        TypeFilter.jsx             — wraps DistinctValuesFilter (BPD, BPW)
        AmountFilter.jsx           — presets + manual min/max + Apply/Cancel
      AccountSummaryStrip.jsx      — avatar, IBAN (chunked + copy), 3 KPI values
      MovementsTable.jsx           — header + rows / skeleton / empty-state; renderBody helper
        MovementStatusBadge.jsx    — 8 status chips (5 color families)
        PostingStatusDot.jsx       — derived posting status (RPPC → posted/green, else → orange)
        MovementRowKebab.jsx       — on-hover kebab (View detail active, Unreconcile/Post disabled)
    ReconciliacionTab.jsx          — placeholder (T6)
    ImportedStatementsTab.jsx      — orchestrates list ↔ lines state machine
      StatementsToolbar.jsx        — back ←, search, import button
      StatementsTable.jsx          — 7-column table (file, data, period, lines, progress, status, imported)
        StatementStatusBadge.jsx   — 3 status chips (COMPLETED / WITH_ISSUES / IN_PROGRESS)
        ProgressRing              — SVG circular progress indicator (new primitive)
      StatementLinesView.jsx       — sub-view: header with ← + lines table
        StatementLinesTable.jsx    — 7-column lines table (lineNo, date, desc, ref, bpartner, amount, matched)
      UploadStatementDialog.jsx    — Dialog for C43 file upload (file input + base64 POST)
```

## Shared primitives introduced or used

| Primitive | Path | Notes |
|-----------|------|-------|
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | `components/ui/tabs.jsx` | Manual implementation (no Radix react-tabs). Underline-style active indicator in `#121217`. Accepts `icon` and `badge` on `TabsTrigger`. Context value memoized via `useMemo`. |
| `MoneyAmount` | `components/ui/money-amount.jsx` | Props: `value`, `currency`, `tone` (`auto`/`positive`/`negative`/`neutral`), `compact`. Locale: `es-ES`. `tone='auto'` colors positive green (`#1E874C`), negative red (`#D50B3E`), zero neutral. Sign prefix `+`/`-` applied automatically. |
| `DateRangePopover` / `DateRangePopoverContent` | `components/ui/date-range-popover.jsx` | Canonical date range picker — same UX as the grid views (Sales Order, etc.). Presets list (Hoy / Ayer / Últimos 7/30 días / Últimos 12 meses / Todo el tiempo / Personalizado) + dual-month calendar with year selector. Value shape: `null \| { presetId } \| { from, to }`. `DateRangePopoverContent` is the inner panel — use it when you need a custom trigger button (as `ListFilterBar.jsx` does). |
| `DistinctValuesFilter` | `components/ui/distinct-values-filter.jsx` | Reusable Popover-wrapped `DistinctValuesList` for in-memory fixed code lists (no backend pagination). Used by `StatusFilter` and `TypeFilter`. |
| `ProgressRing` | `components/ui/progress-ring.jsx` | SVG circular progress ring. Props: `value` (0–100), `size` (default 32), `strokeWidth` (default 3). Track is `#E8EAEF`, fill is `#26A95F`. |

## Hooks

| Hook | Path | Notes |
|------|------|-------|
| `useNeoResource({ path, deps, mapPayload, timeoutMs, label })` | `hooks/useNeoResource.js` | Generic NEO fetch with auth + abort + timeout. Returns `{ data, loading, error, reload }`. Passing `path: null` keeps the hook idle (useful when the path depends on a not-yet-known id). Consumed by `useFinancialAccount` and `useAccountMovements`. |
| `useFinancialAccount(id)` | `hooks/useFinancialAccount.js` | Thin wrapper over `useNeoResource` — hits `/sws/neo/financial-accounts-page` and filters client-side by `id`. Returns `{ account, loading, error, reload }`. Follow-up: replace with dedicated `/sws/neo/financial-account/{id}` endpoint once that spec is live. |
| `useAccountMovements(accountId)` | `hooks/useAccountMovements.js` | Thin wrapper over `useNeoResource` — hits `/sws/neo/financial-account-transactions?FIN_Financial_Account_ID={id}` (powered by `FinancialAccountTransactionsHandler` on the Etendo Go side). Returns `{ movements, totals, loading, error, reload }`. |
| `useBankStatements(accountId)` | `hooks/useBankStatements.js` | Fetches imported bank statements — hits `GET /sws/neo/bank-statements?FIN_Financial_Account_ID={id}`. Returns `{ statements, loading, error, reload }`. |
| `useBankStatementLines(statementId)` | `hooks/useBankStatementLines.js` | Fetches lines of one statement — hits `GET /sws/neo/bank-statements?action=lines&statementId={id}`. Returns `{ lines, loading, error, reload }`. |
| `useStatementImport()` | `hooks/useStatementImport.js` | Mutation hook for C43 import — posts `{ FIN_Financial_Account_ID, fileName, contentBase64 }` to `POST /sws/neo/bank-statements?action=import`. Returns `{ importStatement, importing, error }`. |

## Backend endpoints

### Movements

```
GET /sws/neo/financial-account-transactions?FIN_Financial_Account_ID={id}
```

Implemented by `com.etendoerp.go.schemaforge.FinancialAccountTransactionsHandler` (CDI bean registered via `@Named("financial-account-transactions")`). The handler:

- Queries `FIN_Finacc_Transaction` joined with `FIN_Financial_Account`, `C_Currency`, `FIN_Payment`, and `C_BPartner` (resolved from either the transaction or its parent payment).
- Computes a per-row running balance anchored to `FIN_Financial_Account.currentbalance` (window function: `currentbalance − SUM(subsequent)` over `statementdate ASC, line ASC`).
- Returns a `totals` object with the current balance, 30-day inflows, 30-day outflows, and the account currency. The 30-day cutoff is **computed in Java** (`Instant.now().minus(30, ChronoUnit.DAYS)`) and bound as a `Timestamp` parameter — no PostgreSQL-specific `NOW() − INTERVAL` syntax, so the query stays portable across PostgreSQL and Oracle.

Response shape:

```json
{
  "response": {
    "data": {
      "transactions": [
        {
          "id": "...", "date": "2026-05-06T00:00:00Z", "documentNo": "PAY-001",
          "contact": "DHL Technologies SL", "description": "Invoice No.: ...",
          "paymentStatus": "RPPC", "trxType": "BPD",
          "amount": 12450.00, "balance": 211841.01,
          "currencyIso": "EUR", "posted": "Y"
        }
      ],
      "totals": {
        "balance": 211841.01, "inflows": 47820.00,
        "outflows": 22398.82, "currency": "EUR"
      }
    }
  }
}
```

The spec + entity records that wire this endpoint live in `src-db/database/sourcedata/ETGO_SF_SPEC.xml` and `ETGO_SF_ENTITY.xml` of `com.etendoerp.go` (so the records survive `update.database`).

### Imported statements

Three operations routed by HTTP method + `action` query param, all served by `BankStatementsHandler` (`@Named("bank-statements")`):

```
GET  /sws/neo/bank-statements?FIN_Financial_Account_ID={id}          → list
GET  /sws/neo/bank-statements?action=lines&statementId={id}          → lines
POST /sws/neo/bank-statements?action=import                          → C43 import
     body: { FIN_Financial_Account_ID, fileName, contentBase64 }
```

The import handler:
- Decodes base64 → `ByteArrayInputStream`
- Instantiates the Cuaderno 43 parser (`org.openbravo.module.cuaderno43.es.utility.Cuaderno43`) via reflection (no compile-time dependency on the commercial JAR)
- Calls `init(account)` + `loadFile(stream, statement)` headlessly (no servlet context needed)
- Saves `FIN_BankStatement` + `FIN_BankStatementLine` rows in one transaction
- Returns `201 { id, fileName, lineCount }` on success

#### Cuaderno 43 lookup requirements (MANDATORY)

The Cuaderno 43 parser does **not** read fields from `c_bank` / `c_bankaccount`. It runs an OBCriteria over `FIN_FinancialAccount` looking for an **exact match** on three fields, scoped to the **current user's client** (organization filter is disabled via `setFilterOnReadableOrganization(false)`):

| Header record 11 position | `FIN_FinancialAccount` property | DB column |
|---------------------------|---------------------------------|-----------|
| Entity (pos 3–6, 4 digits) | `bankCode` | `codebank` |
| Branch (pos 7–10, 4 digits) | `branchCode` | `codebranch` |
| Account (pos 11–20, 10 digits) | `partialAccountNo` | `codeaccount` |

Additionally, after the lookup the parser asserts that the account returned is the **same instance** as `statement.getAccount()` (i.e. the financial account from which the user triggered the import). If either check fails, the import aborts with `Error en la cuenta bancaria. La cuenta bancaria no existe. ({entity}-{branch}-{account})`.

**Therefore, to enable C43 import on a financial account:**
1. The user's session must belong to the same `ad_client_id` as the account.
2. `codebank`, `codebranch`, and `codeaccount` must be populated and match the values encoded in the file header record (type 11).
3. `bank_digitcontrol` + `account_digitcontrol` are used to render the displayed IBAN/CCC but do not participate in the lookup; they must still be consistent with the IBAN if you want the UI to display it correctly.
4. The user must trigger the import from the same financial account whose codes match the file. Importing a file from a different account will fail even if the codes exist somewhere else in the database.

Local dev account that is already configured: **Cuenta de Banco** (client GOClient, id `5521767A6D3C47E1957AF82D1334BFE4`) — `codebank=2100`, `codebranch=0418`, `codeaccount=0200051332`, DC `45`. The C43 fixtures under `e2e/fixtures/bank-statements/` target this account.

Status derivation in list response: `COMPLETED` = processed=Y AND posted=Y; `WITH_ISSUES` = processed=Y AND matchedCount < lineCount; `IN_PROGRESS` = processed=N.

#### Statement status config
`statementStatusConfig.js` — 3 statuses: `COMPLETED` (green `#EEFBF4`), `WITH_ISSUES` (orange `#FFF1D6`), `IN_PROGRESS` (yellow `#FFF7E0`).

## Pipeline / artifact status

The artifact directory `artifacts/financial-account/` only contains a stub `decisions.json` (`layoutType: "custom"`). It is whitelisted in `cli/src/validate-pipeline.js → CUSTOM_ONLY_ARTIFACTS` because there is no contract pipeline: the window is fully hand-written and consumes real NEO endpoints.

## Client-side filtering

`MovimientosTab` runs all filters in a single `useMemo` over the movement array returned by `useAccountMovements`:

| Filter | Value shape | Logic |
|--------|-------------|-------|
| Status | `null \| 'RPAP' \| 'RPAE' \| 'RPVOID' \| 'RPR' \| 'PPM' \| 'PWNC' \| 'RDNC' \| 'RPPC'` | `m.paymentStatus === value` |
| Date range | `null \| { presetId } \| { from, to }` | `presetBounds()` resolves preset IDs to `{from, to}` Dates; custom range normalised to whole-day bounds (00:00 → 23:59.999) |
| Type | `null \| 'BPD' \| 'BPW'` | `m.trxType === value` |
| Amount | `null \| { presetId: 'gt0' \| 'lt0' } \| { min, max }` | Preset: signed comparison. Manual range: signed comparison (`min: 0` ⇒ only inflows; `max: 0` ⇒ only outflows). Either bound is optional. |
| Search | `string` | Case-insensitive substring over `documentNo + contact + description` |

Selection is cleared whenever the filters object reference changes (every dropdown change creates a new filters object).

## Payment status mapping

| Search key | Family | Visual |
|------------|--------|--------|
| RPAP | pending | yellow bg `#FFF7E0` |
| RPAE | pending | yellow bg `#FFF7E0` |
| RPVOID | voided | gray bg `#F5F7F9` |
| RPR | executed | purple bg `#EFEAFE` |
| PPM | executed | purple bg `#EFEAFE` |
| PWNC | inTransit | orange bg `#FFF1D6` |
| RDNC | inTransit | orange bg `#FFF1D6` |
| RPPC | cleared | green bg `#EEFBF4` |

Full token palette in `components/financial-accounts/tokens.js` (`MOVEMENT_STATUS_TONE`).
Config (family + i18n key per search_key) in `windows/custom/financial-account/movementStatusConfig.js`.

## i18n keys

All keys prefixed `financeAccountDetail*` and `financeAccountMovements*`, added to both `en_US.json` and `es_ES.json`. Run `grep financeAccount tools/app-shell/src/locales/en_US.json` for the full list. Key groups:

- `financeAccountDetailTab*` — tab labels + placeholders.
- `financeAccountDetailKpi*` — summary strip labels.
- `financeAccountDetailIbanCopied` — IBAN-copy success toast.
- `financeAccountMovementsFilter*` — filter labels and search placeholders.
- `financeAccountMovementsStatus*` — labels for the 8 payment statuses.
- `financeAccountMovementsType{BPD,BPW}` — trxType labels (Cobro / Pago in es).
- `financeAccountMovementsCol*` — table column headers.
- `financeAccountMovementsRow*` — kebab actions + their disabled tooltips.
- `financeAccountMovementsEmpty` — empty-state message.
- `financeAccountStatements*` — all statements tab keys (search, import, column headers, status labels, dialog, toasts).
- `financeAccountStatementLines*` — all lines sub-view keys (column headers, empty state, matched labels).

## Known deviations from the Figma frame

- **Row kebab visible on hover only** — appears via CSS `opacity-0 group-hover:opacity-100`. Figma shows it always-visible.
- **Posting status sub-label** is derived provisionally from `paymentStatus` (RPPC → "Contabilizado" / green dot, else → "Sin contabilizar" / orange dot). Will be replaced by the real `ETBR_PostStatus` field once it exists.
- **Bank logo** is the generic `AccountLogoAvatar` (icon by account type). Real brand logos (Santander/BBVA/etc.) are a future enhancement.
