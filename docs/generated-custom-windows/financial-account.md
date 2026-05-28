# Financial Account — Account Management (ETP-4096)

> This section covers the **create / edit / archive** flows introduced in ETP-4096. The detail view (movements, reconciliation, statements) is documented below.

## What ETP-4096 adds

- `+ Nueva cuenta` button in the Cuentas list opens a **multi-step wizard** (`NewAccountWizard.jsx`) for offline account creation.
- Each row kebab gains **Edit account** (opens `EditAccountModal.jsx`) and **Archive account** (opens `ArchiveAccountDialog.jsx`).
- A new backend spec `financial-account` (`FinancialAccountHandler`) powers create / update / archive / defaults over a single report-style endpoint.

## New Account Wizard — step flow

```
TYPE          → 3 cards: Bank / Cash / Card
  Bank        → CONNECTION (toggle Connected[disabled] / Without connection)
                  Without connection → BANK      (flag-area search + popular grid + skip link)
                                        → INSTITUTION (bank display field + institution list)
                                           → FORM-BANK (Name* / IBAN / BIC-SWIFT / Currency)
  Cash        → FORM-CASH (Name* / Currency)
  Card        → CARD-SOON (placeholder — PSD2 required)
```

- State is kept in a single `{ step, accountType, connection, selectedBank, selectedInstitution, query }` object inside `NewAccountWizard.jsx`. No external store.
- The back `←` button reverts one step. For the form step the target depends on `selectedBank`: if the user skipped bank selection (`null`), back goes to BANK; if they chose one, it goes to INSTITUTION.
- The `+` button in `AccountsToolbar.jsx` opens the wizard; on success the Cuentas list reloads via `useFinancialAccounts().reload`.

### Bank picker (BANK step)

- Flag-area input field: left side shows `<Landmark>` + `<ChevronDown>` in a 60 px border-right box; right side is a plain `<input>` that filters `bankCatalog.js`.
- Popular grid: 3-column, `gap-5` (20 px). Each card is 104 px tall: 40 px icon button + bank name. No bank logo yet — uses `<Landmark>` placeholder.
- "Continue without selecting a bank" link skips BANK → INSTITUTION and sets `selectedBank = null`.

### Institution step (INSTITUTION step)

- Top section displays the selected bank's name in the same flag-area input used in BANK (read-only `<span>` instead of `<input>`).
- Institution list: `gap-4` (16 px) rows; each row has a 24 px circular avatar, institution name, and `<ChevronRight>`. Clicking any row advances to the form.
- There is **no** "Añadir · Sin conexión" row — the user is already in the offline flow.

### Account form (FORM-BANK / FORM-CASH)

- Bank mode fields: Name (required), IBAN (optional, validated with `validateIban`), BIC/SWIFT (optional), Currency (required, populated from `fetchDefaults()`).
- Cash mode fields: Name (required), Currency (required). No IBAN / BIC.
- Form layout: `gap-5` (20 px) between fields; `gap-2` (8 px) between label and input; white inputs (`bg-white`) with `shadow-[0_1px_2px_rgba(18,18,23,0.05)]`.
- Submit button: pill-shaped (`rounded-full`), black background, yellow hover, `#D1D4DB` when disabled.
- Submit calls `createAccount(payload)` from `useAccountMutations`. On 409 the duplicate-name error shows as an inline validation message (not a toast).

## Edit Account Modal

`EditAccountModal.jsx` — rendered from the row kebab "Edit account" action.

- **Account data** section: editable Name, IBAN, BIC/SWIFT, Currency. Same field styling as the wizard form.
- **Bank connection** section: labelled "Available in the next iteration" — shown but non-interactive (T3 PSD2 scope).
- Submit calls `updateAccount(id, payload)`. Only fields present in the payload overwrite the stored value (IBAN / BIC omitted → server keeps existing values).

## Archive Dialog

`ArchiveAccountDialog.jsx` — rendered from the row kebab "Archive account" action.

- Confirmation dialog: title + body copy + Cancel / Archive buttons.
- Archive calls `archiveAccount(id)`. On 409 (open reconciliations) the backend message surfaces as a toast error — the dialog stays open.
- On success the dialog closes and the list reloads.

## Backend endpoint — `financial-account` spec

`FinancialAccountHandler` (`@Named("financial-account")`) is a report-style spec (`SPEC_TYPE=R`). It routes internally on HTTP method + `action` query param:

| Operation | HTTP | Query params | Notes |
|-----------|------|--------------|-------|
| Create | `POST` | — | body: `{ name, currencyId, type?, iban?, swiftCode? }` |
| Update | `POST` | `action=update&id=<id>` | same body shape; omitting `iban`/`swiftCode` keys preserves stored values |
| Archive | `POST` | `action=archive&id=<id>` | soft-delete; 409 if open reconciliations |
| Defaults | `GET` | `action=defaults` | returns session currency + active currency list |

**Create / Update validations:**
- `name` required, max 60 chars, unique per org (active accounts).
- `currencyId` required and must resolve to an active `Currency`.
- `iban` max 34 chars, `swiftCode` max 20 chars.
- `type` normalised: `'C'` → Cash, anything else → `'B'` (Bank, default).

**Create auto-assigns matching algorithm:** the handler calls `listMatchingAlgorithms()` (active, sorted by name) and assigns the first result. If no algorithm exists the field is left null. This wires up the reconciliation engine automatically — no frontend field.

**Defaults response shape:**
```json
{
  "response": {
    "data": {
      "defaultCurrencyId": "102",
      "defaultCurrencyIso": "EUR",
      "currencies": [
        { "id": "102", "iso": "EUR", "symbol": "€" }
      ]
    }
  }
}
```

The spec + entity source-data records live in `src-db/database/sourcedata/ETGO_SF_SPEC.xml` and `ETGO_SF_ENTITY.xml` of `com.etendoerp.go`.

## New components

| File | Role |
|------|------|
| `windows/custom/financial-account/NewAccountWizard.jsx` | Wizard shell — step state, back/forward logic, dialog chrome |
| `windows/custom/financial-account/AccountFormStep.jsx` | Shared form for Bank (Name/IBAN/BIC/Currency) and Cash (Name/Currency) modes |
| `windows/custom/financial-account/EditAccountModal.jsx` | Edit modal — Account data section + read-only Bank connection section |
| `windows/custom/financial-account/ArchiveAccountDialog.jsx` | Confirmation dialog for soft-delete |
| `windows/custom/financial-account/bankCatalog.js` | Static popular-bank list (`{ id, name, country, institutions[] }`); designed for swap to a live endpoint |

## New hooks

| Hook | Operations |
|------|------------|
| `hooks/useAccountMutations.js` | `createAccount(payload)`, `updateAccount(id, payload)`, `archiveAccount(id)`, `fetchDefaults()` — plain `fetch` with bearer-token auth (same pattern as `useNeoResource` but for writes). Errors carry `.status` so callers can branch (e.g. 409 → inline message). |

## New utilities

| File | Purpose |
|------|---------|
| `validateIban.js` (root `src/`) | `isValidIban(str)` — strips spaces, uppercases, rearranges, runs mod-97. Returns `true` for valid IBANs. Used by `AccountFormStep` to gate the submit button. |

## i18n keys — account management

All keys added to both `en_US.json` and `es_ES.json`.

| Key group | Covers |
|-----------|--------|
| `financeAccountsNew*` | Wizard steps, type picker, connection toggle, bank picker, institution list, form fields, validation messages, toasts |
| `financeAccountsEdit*` | Edit modal sections, save button, success/error toasts |
| `financeAccountsArchive*` | Confirmation dialog copy, button labels, success/error toasts including the 409 open-reconciliation message |
| `financeAccountsMenu*` | Row kebab actions (`financeAccountsMenuEdit`, `financeAccountsMenuArchive`) |

Key reference (English):

```
financeAccountsNewTitle              "New account"
financeAccountsNewTypeBank           "Bank"
financeAccountsNewTypeCash           "Cash"
financeAccountsNewTypeCard           "Card"
financeAccountsNewConnectionOffline  "Without connection"
financeAccountsNewConnectionSoon     "Available in the next iteration"   (PSD2 badge)
financeAccountsNewBankTitle          "Choose which bank the account belongs to"
financeAccountsNewBankSkip           "Continue without selecting a bank"
financeAccountsNewBankPopular        "Popular"
financeAccountsNewInstitutions       "Institutions"
financeAccountsNewFieldName          "Account name"
financeAccountsNewFieldIban          "IBAN"
financeAccountsNewFieldBic           "BIC/SWIFT"
financeAccountsNewFieldCurrency      "Currency"
financeAccountsNewIbanInvalid        "The IBAN is not valid"
financeAccountsNewSubmit             "Add account"
financeAccountsNewCreateSuccess      "Account created"
financeAccountsNewNameExists         "An account with this name already exists"
financeAccountsEditTitle             "Edit account"
financeAccountsEditConnectionSoon    "Available in the next iteration"
financeAccountsEditSave              "Save changes"
financeAccountsEditSuccess           "Changes saved"
financeAccountsArchiveConfirmTitle   "Archive account"
financeAccountsArchiveConfirm        "Archive"
financeAccountsArchiveSuccess        "Account archived"
financeAccountsArchiveOpenRecon      "Cannot archive an account with open reconciliations"
financeAccountsMenuEdit              "Edit account"
financeAccountsMenuArchive           "Archive account"
```

## Not implemented yet (follow-up tasks)

- **PSD2 / Connected mode** (T3): connection toggle is visible but both the "Connected" option and the Bank connection section in the edit modal are disabled.
- **Real bank logos**: `bankCatalog.js` uses `<Landmark>` as a placeholder icon for all banks.
- **Card accounts**: the CARD step shows a "Coming soon" placeholder — actual card creation requires PSD2.
- **Bank catalog from endpoint**: `bankCatalog.js` is a static list; the component is designed so the data source can be swapped to a live endpoint without changing the layout.

---

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
- Reconciliation tab body — placeholder with Scale icon.
- Imported Statements tab body — placeholder with FileText icon.
- Unreconcile / Post row actions — visible but disabled, with tooltip.
- Real bank logos (Santander, BBVA, etc.) — uses the generic `AccountLogoAvatar` for all accounts.
- Server-side filtering for movements — filters are applied client-side over the full movement list returned by the endpoint.

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
    ReconciliacionTab.jsx          — placeholder
    ExtractosImportadosTab.jsx     — placeholder
```

## Shared primitives introduced or used

| Primitive | Path | Notes |
|-----------|------|-------|
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | `components/ui/tabs.jsx` | Manual implementation (no Radix react-tabs). Underline-style active indicator in `#121217`. Accepts `icon` and `badge` on `TabsTrigger`. Context value memoized via `useMemo`. |
| `MoneyAmount` | `components/ui/money-amount.jsx` | Props: `value`, `currency`, `tone` (`auto`/`positive`/`negative`/`neutral`), `compact`. Locale: `es-ES`. `tone='auto'` colors positive green (`#1E874C`), negative red (`#D50B3E`), zero neutral. Sign prefix `+`/`-` applied automatically. |
| `DateRangePopover` / `DateRangePopoverContent` | `components/ui/date-range-popover.jsx` | Canonical date range picker — same UX as the grid views (Sales Order, etc.). Presets list (Hoy / Ayer / Últimos 7/30 días / Últimos 12 meses / Todo el tiempo / Personalizado) + dual-month calendar with year selector. Value shape: `null \| { presetId } \| { from, to }`. `DateRangePopoverContent` is the inner panel — use it when you need a custom trigger button (as `ListFilterBar.jsx` does). |
| `DistinctValuesFilter` | `components/ui/distinct-values-filter.jsx` | Reusable Popover-wrapped `DistinctValuesList` for in-memory fixed code lists (no backend pagination). Used by `StatusFilter` and `TypeFilter`. |

## Hooks

| Hook | Path | Notes |
|------|------|-------|
| `useNeoResource({ path, deps, mapPayload, timeoutMs, label })` | `hooks/useNeoResource.js` | Generic NEO fetch with auth + abort + timeout. Returns `{ data, loading, error, reload }`. Passing `path: null` keeps the hook idle (useful when the path depends on a not-yet-known id). Consumed by `useFinancialAccount` and `useAccountMovements`. |
| `useFinancialAccount(id)` | `hooks/useFinancialAccount.js` | Thin wrapper over `useNeoResource` — hits `/sws/neo/financial-accounts-page` and filters client-side by `id`. Returns `{ account, loading, error, reload }`. Follow-up: replace with dedicated `/sws/neo/financial-account/{id}` endpoint once that spec is live. |
| `useAccountMovements(accountId)` | `hooks/useAccountMovements.js` | Thin wrapper over `useNeoResource` — hits `/sws/neo/financial-account-transactions?FIN_Financial_Account_ID={id}` (powered by `FinancialAccountTransactionsHandler` on the Etendo Go side). Returns `{ movements, totals, loading, error, reload }`. |

## Backend endpoint

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

## Known deviations from the Figma frame

- **Row kebab visible on hover only** — appears via CSS `opacity-0 group-hover:opacity-100`. Figma shows it always-visible.
- **Posting status sub-label** is derived provisionally from `paymentStatus` (RPPC → "Contabilizado" / green dot, else → "Sin contabilizar" / orange dot). Will be replaced by the real `ETBR_PostStatus` field once it exists.
- **Bank logo** is the generic `AccountLogoAvatar` (icon by account type). Real brand logos (Santander/BBVA/etc.) are a future enhancement.
