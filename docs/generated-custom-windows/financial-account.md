# Financial Account Detail

> **Story:** ETP-4098 (T4 of the Bank Reconciliation epic ETP-3504).
> Implements the detail view for a single `FIN_Financial_Account` reached from the Cuentas list page.

## Intent

Display the full detail of a financial account: summary strip with key KPIs, and three tabs for Movements, Reconciliation and Imported Statements. The Movements tab is the primary working surface; the other two are placeholders pending T6 and a future story.

## What this view allows in T4

- Navigate to `/financial-account/:id` from the Cuentas list (row click).
- View account header: name, `SyncStatusInline` indicator, kebab menu (`AccountRowMenu`), and breadcrumb (`Finanzas / Cuentas / {name}`).
- Account Summary Strip (single horizontal bar): avatar + IBAN (copy to clipboard) | Total balance | Inflows 30d | Outflows 30d.
- Three tabs with counts: Movements (real data via mock, connected to NEO spec once live), Reconciliation (placeholder), Imported Statements (placeholder).
- Export button (top-right of the tab strip) — fires a toast.
- Movements toolbar: back arrow `←`, status filter (8 payment statuses), date range filter, type filter, amount filter, search input, Export button, `+ New movement` button.
- Movements table: Checkbox | Date | Document | Contact | Description | Status (`MovementStatusBadge`) | Type (with `PostingStatusDot` sub-label) | Amount | Balance.
- Individual row checkbox + select-all (indeterminate when partial).
- On-hover kebab per row: "View detail" (active, toast TODO), "Unreconcile" (disabled, T8 tooltip), "Post" (disabled, T8 tooltip).
- Back button (`←`) navigates `navigate(-1)` with no explicit fallback needed — `useNavigate` handles it.

## What is intentionally out of scope for T4

- `+ New movement` real action: ETP-4102 (T8). Current: visible + enabled, shows toast.
- Reconciliation tab body: ETP-4100 (T6). Current: placeholder.
- Imported Statements tab body: future story. Current: placeholder.
- Unreconcile / Post row actions: ETP-4102 (T8). Current: disabled.
- Real NEO spec for `FIN_FinAcc_Transaction`: movements use mock data until spec is pushed.
- Real bank logos (Santander, BBVA, etc.): uses generic `AccountLogoAvatar`.

## Routing

- URL: `/financial-account/:id` — catch-all route `/:windowName/:recordId` in `App.jsx` → `WindowLoader` → `customLoaders['financial-account']`.
- Entry in `menu.json` under the Finance group (`hidden: true`) so `buildWindowMap()` registers it.
- Entry in `registry.js` `customLoaders`: `'financial-account': () => import('./custom/financial-account/index.jsx')`.

## Component tree

```
index.jsx                          — receives { recordId }, mounts TooltipProvider
  AccountDetailHeader.jsx          — title, SyncStatusInline, AccountRowMenu, breadcrumb
  DetailTabs.jsx + Tabs primitives — 3 tabs with icon + label + badge
    ExportButton (inline)          — right of tab strip, toast
    MovimientosTab.jsx             — summary strip + toolbar + table
      AccountSummaryStrip.jsx      — avatar, IBAN copy, 3 KPI values
      MovementsToolbar/index.jsx   — back ←, 4 filters, search, export, new movement
        StatusFilter.jsx
        DateRangeFilter.jsx
        TypeFilter.jsx
        AmountFilter.jsx
      MovementsTable.jsx           — DataTable-like table with custom column config
        MovementStatusBadge.jsx    — 8 status chips (5 color families)
        PostingStatusDot.jsx       — derived posting status dot
        MovementRowKebab.jsx       — on-hover kebab (3 actions)
    ReconciliacionTab.jsx          — placeholder "Coming in T6"
    ExtractosImportadosTab.jsx     — placeholder "Coming soon"
```

## Shared primitives introduced

| Primitive | Path | Notes |
|-----------|------|-------|
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | `components/ui/tabs.jsx` | Manual implementation (no Radix react-tabs). Underline-style active indicator in `#121217`. Accepts `icon` and `badge` on `TabsTrigger`. |
| `MoneyAmount` | `components/ui/money-amount.jsx` | Props: `value`, `currency`, `tone` (`auto`/`positive`/`negative`/`neutral`), `compact`. Locale: `es-ES`. `tone='auto'` colors positive green, negative red, zero neutral. |

## Hooks

| Hook | Path | Notes |
|------|------|-------|
| `useFinancialAccount(id)` | `hooks/useFinancialAccount.js` | Fetches `/sws/neo/financial-accounts-page` and filters client-side by id. TODO: replace with `/sws/neo/financial-account/{id}` once `FIN_Financial_Account` NEO spec is live. |
| `useAccountMovements(accountId, filters)` | `hooks/useAccountMovements.js` | Returns mock data (10 rows, all 8 payment statuses). TODO: replace with `/sws/neo/account-movement?FIN_FinancialAccount_ID={id}` once `FIN_FinAcc_Transaction` NEO spec is pushed. |

## Backend contract (planned — not yet active)

```
GET /sws/neo/account-movement?FIN_FinancialAccount_ID={id}&status={status}&...
```

Powered by a future NEO spec for `FIN_FinAcc_Transaction`. The artifact placeholder lives in `artifacts/financial-account/decisions.json` (`layoutType: "custom"`).

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

All keys prefixed `financeAccountDetail*` and `financeAccountMovements*`, added to both `en_US.json` and `es_ES.json`. Run `grep financeAccountDetail tools/app-shell/src/locales/en_US.json` for the full list.

## Known deviations from the Figma frame

- **Row kebab visible on hover only** — not visible by default, appears via CSS group-hover on the table row.
- **Posting status sub-label** is derived provisionally from `paymentStatus` (RPPC → "Contabilizado", else → "Sin contabilizar"). Will be replaced by `ETBR_PostStatus` field in T8.
- **Mock data** for movements until `FIN_FinAcc_Transaction` NEO spec is pushed.
