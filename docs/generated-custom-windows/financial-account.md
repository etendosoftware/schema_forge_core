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
  Card        → CONNECTION (toggle Connected[disabled, future PSD2] / Without connection)
                  Without connection → BANK → INSTITUTION → FORM-CARD (Name* / Currency)
```

The **Card** type comes from the **PSD2 module**, which adds the `AD_Ref_List` value `VALUE=CA` ("Card")
to the core "Financial account type" reference (`A6BDFA712FF948CE903C4C463E832FC1`). Schema Forge reuses it
(it does NOT define its own). `FinancialAccountHandler.normalizeType` keeps `C`/`CA` and coerces everything
else to `B`; the frontend `ACCOUNT_TYPE.CARD` is `'CA'`.

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

## Backend endpoint — `financial-account` spec (W, generic CRUD + hook)

**ETP-4239 converted the spec from report-style (`SPEC_TYPE=R`, `?action=` routing) to a generic W (window) spec** over the core Financial Account AD window (`94EAA455D2644E04AB25D93BE5157B6D`). The `account` header entity is served by the generic NEO CRUD, with `FinancialAccountHandler` (`@Named("financialAccountHeaderHandler")`, wired via `ETGO_SF_ENTITY.Java_Qualifier`) running as a **pre/post hook** — the same pattern as `SalesInvoiceHeaderHandler`. This also makes the entity **agentic**: MCP agents can `neo_list` / `neo_create` financial accounts of the 3 types (Bank `B` / Cash `C` / Card `CA`).

| Operation | HTTP | URL | Notes |
|-----------|------|-----|-------|
| List | `GET` | `/sws/neo/financial-account/account` | generic list (included fields only) |
| Create | `POST` | `/sws/neo/financial-account/account` | body (DAL names): `{ name, currency, type?, iBAN?, swiftCode? }` |
| Update | `PUT` | `/sws/neo/financial-account/account/{id}` | omitting `iBAN`/`swiftCode` keys preserves stored values |
| Archive | `DELETE` | `/sws/neo/financial-account/account/{id}` | hook short-circuits with a **soft-archive** (`IsActive='N'`); 409 if open reconciliations |
| Currencies | `GET` | `/sws/neo/financial-account/account/selectors/C_Currency_ID` | generic FK selector (replaces `?action=defaults` currency list) |
| Defaults | `GET` | `/sws/neo/financial-account/account/defaults` | generic defaults; `defaults.currency` = org currency |

**Hook behavior (`handle()` pre-phase):**
- POST: validates `name` (required, max 60, unique per org → 409), `currency` (required, valid), `iBAN` ≤ 34 / `swiftCode` ≤ 20; normalises `type` (`'C'`/`'CA'` kept, anything else → `'B'`); then **mutates the request body** injecting `country` (derived from the IBAN ISO prefix — required by trigger `FIN_FINANCIAL_ACCOUNT_TRG2`) and a default `matchingAlgorithm` (first active) when absent, and returns `null` so the generic CRUD persists.
- PUT/PATCH: name uniqueness (excluding self) + IBAN→country re-sync via body mutation.
- DELETE: open-reconciliations guard (409), otherwise soft-archives and returns 204 (never reaches the generic hard delete).
- `country` and `matchingAlgorithm` are declared `visibility: "system"` in `decisions.json` so their `ETGO_SF_FIELD` rows stay **included** — required for the injected values to survive `NeoFieldFilter`.

**MCP hook parity (ETP-4239, runtime change):** `McpToolRouter` now resolves the entity's `NeoHandler` by `Java_Qualifier` and runs `handle()` (pre, may mutate the body) / `afterHandle()` (post) around `neo_create` / `neo_update` / `neo_delete` — previously MCP writes bypassed ALL entity hooks (no validation, no derivation). This applies to every W spec, not just financial-account.

The spec + entity + field source-data records live in `src-db/database/sourcedata/ETGO_SF_SPEC.xml`, `ETGO_SF_ENTITY.xml` and `ETGO_SF_FIELD.xml` of `com.etendoerp.go` (regenerated by `push-to-neo financial-account` + `export.database`).

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
| `hooks/useAccountMutations.js` | `createAccount(payload)`, `updateAccount(id, payload)`, `archiveAccount(id)`, `fetchDefaults()` — plain `fetch` with bearer-token auth against the W CRUD endpoints (`POST`/`PUT`/`DELETE /sws/neo/financial-account/account[...]`). Callers keep the SPA payload `{ name, type, currencyId, iban, swiftCode }`; the hook maps it to DAL names (`currency`, `iBAN`) and parses the W envelope (`response.data[0]`). `fetchDefaults()` keeps its legacy return shape (`{ currencies: [{id, iso, symbol}], defaultCurrencyId }`) but is now backed by the generic currency selector + `/defaults`. Errors carry `.status` so callers can branch (e.g. 409 → inline message). |

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

Display the full detail of a financial account: a summary strip with KPIs, and three tabs for Movements, Reconciliation and Imported Statements. The Movements tab is the primary working surface; the Reconciliation tab hosts the manual bank reconciliation split panel (T6); the Imported Statements tab is a placeholder pending a later iteration.

## What this view does

- Navigate to `/financial-account/:id` from the Cuentas list (row click).
- Topbar shows `{accountName}` as title and `Finanzas / Cuentas / {accountName}` as breadcrumb via `useSetPageMeta` (inlined in `index.jsx` — no per-window header bar).
- Account Summary Strip (single horizontal bar inside the Movements tab body): avatar + IBAN (chunked in groups of 4, with copy-to-clipboard) | Saldo total | Entradas (30D) | Salidas (30D). The three KPI sections use `flex-1` so they spread evenly.
- Three tabs with counts: Movements (live data), Reconciliation (live data — manual reconciliation split panel, T6), Imported Statements (placeholder).
- Right-side tab-strip action is contextual. On **Movements** and **Imported Statements** it shows the Export button and performs a CSV download. On **Reconciliation** it switches to a disabled **Automatch** button placeholder (enabled in T7). **All exports go through the generic backend CSV flow** (`?export=csv`, see `neo-headless.md` §4.3) via the shared `useCsvExport` hook, so the server streams the file and large lists never get assembled in the browser:
  - **Movements tab** → exports the filtered movements (`GET /sws/neo/financial-account-transactions?...&export=csv`, `ids` = filtered movement ids). Classic-parity columns (Transaction Type / Status labels, Deposit/Withdrawal split, synthetic "Payment", Processed flag) are **pre-derived server-side** on the transaction rows so the exporter stays generic. Column order/labels live in `MOVEMENT_CSV_COLUMNS` (`index.jsx`).
  - **Imported Statements tab, no statement selected** → exports the filtered statement **headers** (`GET /sws/neo/bank-statements?...&export=csv&ids=<filtered ids>`).
  - **Imported Statements tab, statement(s) selected** → exports the **lines** of the selected statement(s) (`...&action=lines&statementIds=<ids>`), mirroring Classic's line export.
  - Column labels/order and `ids`/`statementIds` are passed as query params; the statements tab exposes the current selection + filtered headers to the window via a ref (`getSelectedStatementIds` / `getFilteredStatements`), the movements tab via `getFilteredMovements`.
- Movements toolbar: back arrow `←`, status filter (8 payment statuses, search-enabled), date range filter (preset list + dual calendar, same picker as grid views), type filter (BPD/BPW, search-enabled), amount filter (presets + manual min/max), search input, `+ Nuevo movimiento` button (yellow hover, fires toast — real action is T8).
- Movements table: Expand chevron | Checkbox | Date | Payment | Contact | Description | Status (`MovementStatusBadge`) | Type (with `PostingStatusDot` sub-label) | G/L Item | Amount | Balance | kebab.
- **Payment column** (`Pago`): when the movement has a related payment, the document number renders as an underlined link (with an `ArrowUpRight` icon) that navigates to `/payment-in/:id` (received payments, `paymentIsReceipt === 'Y'`) or `/payment-out/:id` (made payments). Movements with no payment show plain text.
- **Expandable "more info" panel**: the leading circular chevron (or a click anywhere on the row) toggles an inline panel showing the accounting dimensions enabled in the chart of accounts that have a value on the transaction (Organization, Project, Cost Center, Activity, Campaign, Sales Region, User1, User2). The business partner is excluded (it already has its own Contacto column). Dimensions are rendered read-only as label + value (no selector chrome), in a 1/2/4-column responsive grid. The header row and panel form one elevated card (shadow at the bottom only, no seam line — the header row sits at `z-20` over the panel's `z-10` to hide the shadow bleed). When no enabled dimension has a value, the panel shows a "no dimensions" message. The chevron only renders when the account reports at least one enabled dimension (`enabledDimensions`).
- Locale-aware date format in the Date column (es_ES → `dd/MM/yyyy`, en_US → `M/d/yyyy`).
- Individual row checkbox + select-all (indeterminate when partial).
- Row hover: subtle shadow elevation + kebab appears (Unreconcile / Post disabled with tooltip).
- Back arrow in the toolbar runs `navigate(-1)`.
- `+ Nuevo movimiento` button (yellow hover) — currently fires a "coming soon" toast.

### Reconciliation tab (T6)

The Reconciliation tab renders `ReconciliationSplitPanel` (`tools/app-shell/src/components/contract-ui/ReconciliationSplitPanel.jsx`), a 50/50 split panel that composes the backend at `/sws/neo/bank-reconciliation` (handler `@Named("bankReconciliation")`). It never reimplements Etendo's reconciliation logic — the POST hands the grouped ids over to the Classic flow.

- **Left panel — pending statement lines** (`usePendingStatementLines(accountId, filters)`): a movements-style toolbar with **back arrow** + status dropdown + date-range picker + search. The current T6 backend only exposes pending lines, so the status dropdown is wired but currently contains `Pendiente (N)` only. Below it, a table with **radio single-select** rows (Fecha · Descripción + status badge · Importe with sign tone) and a `Total: X,XX €` footer.
- **Right panel — candidate operations** (`useCandidateOperations(accountId, lineId, docType)` — does NOT fetch while no line is selected): an empty state (`Selecciona un movimiento` / hint) until a line is picked, then a `SelectedLineHeader` (line metadata + amount in red/green), a real docType/date/search toolbar, and a table with **checkbox multi-select** rows (Fecha · Información = documentNo + partnerName + badge · Saldo pendiente · Importe). Backend-suggested candidates carry a blue **"Sugerida"** badge; the rest "Pendiente".
- **Action bar**: `Documentos seleccionados: ±X,XX €` · `Restante por conciliar: ±X,XX €` · `[Cancelar selección] [Transferir] [Nuevo documento] [Conciliar (N)]`. `Conciliar` is enabled only when `|line.amount − sum(selected ops)| ≤ 0.01`. On click → `useReconcileGroup().reconcile({ financialAccountId, statementLineId, operationIds })` → success toast (`sonner`) + `onReconcileSuccess()` (reloads the account so the tab badge `pendingCount` decrements, and reloads movements) + clears the selection.
- When a **reconciled** line is selected, the `Conciliar` button label switches to `Reactivar` and stays disabled (its handler lands in T8).
- The right-side header action becomes a disabled `Automatch` button while the Reconciliation tab is active (enabled in T7). `Transferir` / `Nuevo documento` render but fire a "próximamente" toast (follow-up).
- i18n keys: `financeReconcile*` in `packages/app-shell-core/src/locales/{en_US,es_ES}.json`.
- Hooks: `tools/app-shell/src/hooks/useReconciliation.js` — `usePendingStatementLines`, `useCandidateOperations`, `useReconcileGroup` (all over `useNeoResource` / the shared auth+fetch pattern). The reconcile POST surfaces the backend `{ error: { message } }` text on the thrown Error so it shows in the error toast.

## Not implemented yet

- `+ Nuevo movimiento` real action — toast placeholder for now.
- Reconciliation against **invoices** (creating a payment via `FIN_AddPayment`) — T6 reconciles only against existing financial-account transactions; invoice reconciliation is a follow-up.
- `Automatch` functional behaviour — T7.
- `Reactivar` execution — T8 (T6 only prepares the disabled label/state).
- `Transferir` / `Nuevo documento` real actions — render but show a "próximamente" toast.
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
    Header action button (inline)  — right of tab strip; Export for Movements/Statements, disabled Automatch for Reconciliation
    MovimientosTab.jsx             — toolbar + summary strip + table; runs applyFilters client-side
      MovementsToolbar/index.jsx   — back ←, 4 filters, search, + Nuevo movimiento
        StatusFilter.jsx           — wraps DistinctValuesFilter (8 codes)
        DateRangeFilter.jsx        — wraps DateRangePopover
        TypeFilter.jsx             — wraps DistinctValuesFilter (BPD, BPW)
        AmountFilter.jsx           — presets + manual min/max + Apply/Cancel
      AccountSummaryStrip.jsx      — avatar, IBAN (chunked + copy), 3 KPI values
      MovementsTable.jsx           — header + rows / skeleton / empty-state; renderBody helper
        DimensionsPanel (inline)   — expandable read-only accounting-dimensions grid
        MovementStatusBadge.jsx    — 8 status chips (5 color families)
        PostingStatusDot.jsx       — derived posting status (RPPC → posted/green, else → orange)
        MovementRowKebab.jsx       — on-hover kebab (Unreconcile/Post disabled)
    ReconciliacionTab.jsx          — placeholder (T6)
    ImportedStatementsTab.jsx      — orchestrates list ↔ lines state machine
      StatementsToolbar.jsx        — back ←, date range, status filter, "Filtro por condicionales" (AdvancedFilterBuilder, same as movements), search, import split-button (▾ → "Create manually")
      StatementsTable.jsx          — columns: docNo, name (falls back to line date range), file name, notes, import/transaction dates, lines, out (red, −) / in (green, +), status pill (DRAFT/PENDING/PARTIAL/RECONCILED), per-row kebab (when `actions` is passed); expand chevron is a round bordered button rotating 180° (same as movements)
      statementAdvancedFilter.js   — column metadata + applyAdvancedFilter for the statements list (delegates to the shared advancedFilterApply evaluator)
      advancedFilterApply.js       — generic client-side evaluator for the AdvancedFilterBuilder condition tree (OPERATORS + applyConditions), shared by movements and statements
        StatementStatusBadge.jsx   — 3 status chips (COMPLETED / WITH_ISSUES / IN_PROGRESS)
        StatementRowKebab.jsx      — per-row "…" menu: Edit / Process / Delete, enabled ONLY for drafts (processed='N'); disabled with tooltip on processed statements
        ProgressRing              — SVG circular progress indicator (new primitive)
      StatementLinesInline.jsx     — lines table shown in the expanded accordion row: date, description, contact name (free text), contact (BP FK name), G/L item (concepto contable), out, in, match status
      StatementLinesView.jsx       — sub-view: header with ← + lines table
        StatementLinesTable.jsx    — 7-column lines table (lineNo, date, desc, ref, bpartner, amount, matched)
      ImportStatementModal.jsx     — multi-step import modal (Upload → Review → Done): dropzone, preview KPIs + lines, base64 POST. White surface (var(--surface-overlay)), borderless footer, round red-hover remove button.
      ManualStatementModal.jsx     — "Create/Edit statement" modal (Classic field parity): header (name, transaction/import dates, file name, notes) + per-line grid (date, Reference No, contact name + Business Partner lookup, G/L item lookup, out, in) + live totals bar. Per line the required fields are **date, Reference No, out and in** (marked with `*`); contact/G/L item are optional. A line auto-commits to a read-only row when you click outside it (re-edit via the pencil), but only when complete — an incomplete line stays editable and blocks save. Create POSTs ?action=create; with a `statement` prop it hydrates from the draft and POSTs ?action=update. No file involved.
      StatementConfirmDialog.jsx   — shared confirm dialog for the Process / Delete row actions (destructive tone for delete)
      LookupPicker.jsx             — shared text-input + dropdown lookup (BP / G/L item), used by NewMovementDialog and ManualStatementModal.
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
| `useAccountMovements(accountId)` | `hooks/useAccountMovements.js` | Thin wrapper over `useNeoResource` — hits `/sws/neo/financial-account-transactions?FIN_Financial_Account_ID={id}` (powered by `FinancialAccountTransactionsHandler` on the Etendo Go side). Returns `{ movements, totals, enabledDimensions, loading, error, reload }`. Each movement carries `paymentId` / `paymentIsReceipt` (for the Payment link) and a `dimensions` object (per-row dimension values); `enabledDimensions` is the account-level list of dimension keys enabled in the chart of accounts. |
| `useBankStatements(accountId)` | `hooks/useBankStatements.js` | Fetches imported bank statements — hits `GET /sws/neo/bank-statements?FIN_Financial_Account_ID={id}`. Returns `{ statements, loading, error, reload }`. |
| `useBankStatementLines(statementId)` | `hooks/useBankStatementLines.js` | Fetches lines of one statement — hits `GET /sws/neo/bank-statements?action=lines&statementId={id}`. Returns `{ lines, loading, error, reload }`. |
| `useStatementImport()` | `hooks/useStatementImport.js` | Mutation hook for C43 import — posts `{ FIN_Financial_Account_ID, fileName, contentBase64 }` to `POST /sws/neo/bank-statements?action=import`. Returns `{ importStatement, importing, error }`. |
| `useCreateStatement()` | `hooks/useCreateStatement.js` | Mutation hook for manual statement creation — posts `{ FIN_Financial_Account_ID, name, transactionDate, importDate, fileName, notes, lines[] }` to `POST /sws/neo/bank-statements?action=create`. Returns `{ createStatement, creating, error }`. |
| `useStatementActions()` | `hooks/useStatementActions.js` | Mutation hook for the draft row actions — `processStatement(id)` (`?action=process`), `updateStatement({ id, ...header, lines })` (`?action=update`), `deleteStatement(id)` (`?action=delete`). All only valid for drafts (backend returns 400 otherwise). Returns `{ processStatement, updateStatement, deleteStatement, busy, error }`. |

## Backend endpoints

### Movements

```
GET /sws/neo/financial-account-transactions?FIN_Financial_Account_ID={id}
GET /sws/neo/financial-account-transactions?...&export=csv&columns=...&ids=...   → CSV download (generic, see neo-headless.md §4.3)
```

Implemented by `com.etendoerp.go.schemaforge.FinancialAccountTransactionsHandler` (CDI bean registered via `@Named("financial-account-transactions")`). The handler:

- Queries `FIN_Finacc_Transaction` joined with `FIN_Financial_Account`, `C_Currency`, `FIN_Payment`, and `C_BPartner` (resolved from either the transaction or its parent payment).
- Joins the 9 accounting-dimension FK tables (`ad_org`, `c_bpartner`, `c_project`, `c_costcenter`, `c_activity`, `c_campaign`, `c_salesregion`, `user1`, `user2`) to marshal a `dimensions` object per row, and surfaces the related payment (`paymentId` + `paymentIsReceipt`) so the frontend can deep-link to the payment window.
- Computes the account's `enabledDimensions` by reading `C_AcctSchema_Element` (the dimensions enabled in the chart of accounts), returned once at the payload level (not per row).
- Computes a per-row running balance anchored to `FIN_Financial_Account.currentbalance` (window function: `currentbalance − SUM(subsequent)` over `statementdate ASC, line ASC`).
- Returns a `totals` object with the current balance, 30-day inflows, 30-day outflows, and the account currency. The 30-day cutoff is **computed in Java** (`Instant.now().minus(30, ChronoUnit.DAYS)`) and bound as a `Timestamp` parameter — no PostgreSQL-specific `NOW() − INTERVAL` syntax, so the query stays portable across PostgreSQL and Oracle.
- Each row also carries **CSV-export fields** consumed by the generic `?export=csv` path so the exporter stays a dumb serializer: `transactionTypeLabel`, `statusLabel` (Classic English labels), `depositAmount`/`withdrawalAmount` (the split, from raw `depositamt`/`paymentamt`), `paymentLabel` (synthetic `docNo - date - bp - |amount|`) and `processed`. These replace the retired client-side `movementsCsvExport.js`.

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
          "paymentId": "...", "paymentIsReceipt": "Y",
          "amount": 12450.00, "balance": 211841.01,
          "currencyIso": "EUR", "posted": "Y",
          "dimensions": { "organization": "GOOrg", "project": "..." }
        }
      ],
      "totals": {
        "balance": 211841.01, "inflows": 47820.00,
        "outflows": 22398.82, "currency": "EUR"
      },
      "enabledDimensions": ["organization", "bpartner", "project"]
    }
  }
}
```

The spec + entity records that wire this endpoint live in `src-db/database/sourcedata/ETGO_SF_SPEC.xml` and `ETGO_SF_ENTITY.xml` of `com.etendoerp.go` (so the records survive `update.database`).

### Imported statements

Operations routed by HTTP method + `action` query param, all served by `BankStatementsHandler` (`@Named("bank-statements")`):

```
GET  /sws/neo/bank-statements?FIN_Financial_Account_ID={id}          → list
GET  /sws/neo/bank-statements?action=lines&statementId={id}          → lines (one statement)
GET  /sws/neo/bank-statements?action=lines&statementIds={a,b,c}      → lines (several statements, for CSV export)
GET  /sws/neo/bank-statements?...&export=csv&columns=...&ids=...     → CSV download (generic, see neo-headless.md §4.3)
POST /sws/neo/bank-statements?action=preview                         → in-memory parse (no persist)
POST /sws/neo/bank-statements?action=import                          → C43 / CSV import
     body: { FIN_Financial_Account_ID, fileName, contentBase64 }
POST /sws/neo/bank-statements?action=create                          → manual create (header + lines, no file)
     body: { FIN_Financial_Account_ID, name, transactionDate, importDate,
             fileName, notes, process,
             lines: [{ date, reference, bpartnerName, bpartnerId,
                       glItemId, in, out }] }
POST /sws/neo/bank-statements?action=process   body: { id }            → process a draft
POST /sws/neo/bank-statements?action=update    body: { id, ...create }  → edit a draft (replaces all lines)
POST /sws/neo/bank-statements?action=delete    body: { id }            → delete a draft (+ its lines)
```

The manual-create handler builds the `FIN_BankStatement` (name, dates, `fileName`, `notes`), one `FIN_BankStatementLine` per non-blank line (`in`→`cramount`, `out`→`dramount`, `bpartnerName`→`bpartnername`, `bpartnerId`→`businessPartner` FK, `glItemId`→`gLItem` FK, blank `reference` defaults to `**`). The `process` flag (default `true`) drives the save modal's split button: **Save and process** (`true`) runs the same `processStatement` as import so the lines become reconcilable; **Save as draft** (`false`) just persists the statement with `processed='N'`. Mirrors Classic's manual bank-statement header + line fields.

**Draft row actions** (`process` / `update` / `delete`) are guarded by `requireDraft(id)`, which 400s when the id is missing, the statement does not exist, or it has already been processed (`isProcessed()`). So only drafts can be processed, edited or deleted; processed statements are immutable. `update` re-applies the editable header and **replaces all lines** (deletes the existing ones, then recreates from the body), optionally processing afterwards when `process=true`. `delete` removes the lines then the statement.

**Status derivation** — the list endpoint derives each row's `status` via `BankStatementsSupport.deriveStatementStatus(processed, lineCount, matchedCount)`: not processed → `DRAFT`; otherwise `PENDING` (no matched lines) / `PARTIAL` / `RECONCILED` (all matched). The list also returns `notes`, and `?action=lines` returns each line's `bpartnerId`/`glItemId` (+ joined `bpartnerFkName`/`glItemName`) and separate `in`/`out` so the edit modal can hydrate the FK pickers.

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
- `financeAccountMovementsCol*` — table column headers (`ColDocument` now labels the **Payment** / Pago column).
- `financeAccountMovementsRow*` — kebab actions + their disabled tooltips.
- `financeAccountMovementsMoreInfo` — chevron aria-label for the expandable panel.
- `financeAccountMovementsNoDimensions` — message shown when no enabled dimension has a value.
- `financeAccountMovementsDim*` — accounting-dimension labels (`Organization`, `Bpartner`, `Project`, `Costcenter`, `Activity`, `Campaign`, `Salesregion`, `User1`, `User2`).
- `financeAccountMovementsEmpty` — empty-state message.
- `financeAccountStatements*` — all statements tab keys (search, import, column headers, status labels, dialog, toasts).
- `financeAccountStatementLines*` — all lines sub-view keys (column headers, empty state, matched labels).
- `financeAccountMovementsWizard*` — every label, placeholder, section title, choice card, stepper label, footer and toast/error string of the **New Movement wizard** (`NewMovementWizard/`). The wizard was fully internationalized (it previously hardcoded its Spanish copy); `movementWizardData.DIM_META` now carries a `labelKey` resolved via `ui()` instead of a literal `label`.
- `financeAccountAmountPlaceholder` — shared decimal placeholder (`0,00` / `0.00`) used by the wizard amount inputs and the manual-statement line amounts.

> **i18n allowlists.** `ImportedStatementsTab`, `StatementConfirmDialog` and `ImportStatementModal` keep per-variant config objects whose `error`/`title` values are themselves **i18n keys** (resolved later via `ui(cfg.error)`). The Schema Forge quality-gate i18n check flags those string literals as hardcoded, so each file carries an `// i18n-allowlist: [...]` comment listing the keys — they are not user-facing literals.

## Contract-driven grid columns

The window stays **custom** (`layoutType: "custom"`, bespoke React structure), but its four grids now read their **column set, order, labels and cell types from `contract.json`** instead of hardcoded JSX:

- `components/financial-accounts/contractColumns.js` → `getContractGridColumns(entity)` reads `@generated/financial-account/contract.json` and returns the ordered, grid-flagged fields for an entity (`account`, `transaction`, `importedBankStatements`, `bankStatementLines`).
- Field-level config lives in `artifacts/financial-account/decisions.json` (`grid` / `gridOrder` per field). Edit decisions → `node cli/src/resolve-curated.js --window financial-account --write` regenerates `contract.json`; the grids pick up the change with no JSX edits.
- Adding/removing a grid column or reordering = a `decisions.json` change, **not** a code change. Visibility (`editable`/`readOnly`/`system`/`discarded`) and `readOnlyLogic` also come from the contract.
- `readOnlyLogic.js` for these fields is produced by `generate-contract.js → convertLogicToJs` (AD expression → JS). The translator handles `@Col@='v'`, `!=`, empty (`!''`/`=''`), `null` and numeric (`>0`) forms; any expression that still contains a raw `@token@` after translation is marked `evaluable:false` (never emits invalid JS). All `readonlylogic-valid` contract tests must stay green after a regen.

## Known deviations from the Figma frame

- **Row kebab visible on hover only** — appears via CSS `opacity-0 group-hover:opacity-100`. Figma shows it always-visible.
- **Posting status sub-label** is derived provisionally from `paymentStatus` (RPPC → "Contabilizado" / green dot, else → "Sin contabilizar" / orange dot). Will be replaced by the real `ETBR_PostStatus` field once it exists.
- **Bank logo** is the generic `AccountLogoAvatar` (icon by account type). Real brand logos (Santander/BBVA/etc.) are a future enhancement.
