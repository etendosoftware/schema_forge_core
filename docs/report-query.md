# Report query route and access checks (ETP-6080)

`POST /api/reports/:id/query` returns a report's data as JSON, for the interactive report view. The handler is `handleReportQuery` in `cli/src/report-query.js`. Both engines call it, so the session, the access checks and the response shape cannot drift between dev and production: `tools/report-server/server.js` (production) and the functional repo's Vite plugin `vite-plugins/report-api.js` (`make dev`).

## Request and answer

Body: `{ params, locale, limit? }`. `params` are the contract's parameters, the same values `/render` takes. A JSON `null` body reads as `{}`. `limit` caps the main query only and must be a positive safe integer.

| Report kind | Answer |
|---|---|
| Account tree (contract with `sql.operandsQuery`) | `{ kind: 'tree', rows }`, every level at once, with variation fields when `compareTo: 'true'` |
| Account tree with `periods` (needs `sql.periodQuery`, ETP-6239) | `{ kind: 'tree', rows, periods, hiddenCount }`, rows with `cells[]`, `visible`, `parentIds` (see *Columns by period*) |
| Split (`splitBy` + `splitNodeId` + `splitSign`, needs `sql.splitQuery`) | `{ kind: 'split', rows }` |
| Split with `periods` (needs `sql.splitPeriodQuery`, ETP-6239) | `{ kind: 'split', rows, periods, hiddenCount }`, rows with `cells[]` |
| Listing (General Ledger, Journal Entries) | `{ kind: 'rows', rows, openingRows }` |

Errors are `{ error, code }`:

| Status | Code | Meaning |
|---|---|---|
| 401 | `NO_SESSION` | no session cookie, Etendo rejected it, or no resolvable client |
| 403 | `CSRF_REJECTED` | missing or mismatched `X-Go-CSRF` |
| 403 | `REPORT_ACCESS_DENIED` | the role cannot open this report (no SQL runs) |
| 403 | `ORG_ACCESS_DENIED` | the role has no access to the requested organization (no SQL runs) |
| 502 | `REPORT_ACCESS_UNAVAILABLE` | the report-access check could not be read (fail closed) |
| 502 | `SESSION_BACKEND_UNAVAILABLE` | the session check failed |
| 404 | `REPORT_NOT_FOUND` | unknown report id |
| 400 | `QUERY_NOT_SUPPORTED`, `INVALID_LIMIT`, `SPLIT_NOT_SUPPORTED` | bad request for this report |
| 400 | `INVALID_PERIODS`, `PERIOD_RANGE_TOO_LONG` | a bad `periods` value (ETP-6239); `/render` answers the same `{ error, code }` |
| 504 | `REPORT_TIMEOUT` | the query ran past the statement timeout (ETP-6146); the UI shows a translated message |
| 499 | `REPORT_CANCELLED` | the client disconnected; the SQL was cancelled (nobody reads this answer) |
| 500 | `QUERY_FAILED` | logged server-side; the SQL and the DB message never reach the client |

## One SQL runner

`runReportSql(pool, contract, { clientId, params, locale, limit, mainSql })` runs the contract's main query plus the optional `openingQuery` and `operandsQuery`, with the same placeholder rules everywhere. `/query`, the report-server `/render` and the dev plugin's render all call it, so the screen and the exports read the same numbers. `limit` is spliced into the SQL text, so anything but a positive safe integer throws a `TypeError`.

## Access checks (`cli/src/report-auth.js`)

`/render` and `/query` run, in order: session, CSRF, `assertReportAccess`, `assertReportOrgAccess`, then SQL.

- `assertReportAccess(session, reportId, { etendoBase })` reads NEO `myreportaccess` (`SFMyReportAccess` in `com.etendoerp.go`). `governed` lists the report ids the Informes access catalog controls; `reportAccess` lists the ones the role can open (any tier). A governed report missing from `reportAccess` throws `403 REPORT_ACCESS_DENIED`. A report outside `governed` (a printable, a report open by design) passes.
- Fail closed: a network error, a non-2xx answer or an unreadable body throws `502 REPORT_ACCESS_UNAVAILABLE`. It is never reported as 401 or 403.
- Deploy skew: a backend that does not send `governed` yet (older `com.etendoerp.go`) is not enforced. Drop that branch once every environment runs the module version that sends it.

## `expandedNodeIds` (`cli/src/report-grouping.js`)

Hidden report parameter, a comma-joined string of expanded tree row ids. Absent or blank means "not sent": the export keeps the `accountLevel` cutoff (the old viewer sends `''` for every parameter it has no value for). `'none'` (`NO_EXPANDED_NODES`) means nothing is open, so only the top rows print. Any other value prints exactly those rows.

Functional reference for the first consumer: `docs/generated-custom-windows/profit-loss.md` in `etendo_schema_forge`.

## Columns by period (ETP-6239)

**Compatibility: without `periods`, nothing changes.** `runReportSql`, `handleReportQuery`, the render and every response are exactly what they were; the new code only runs when the request carries `periods` AND the contract declares the period query. A contract without `sql.periodQuery` / `sql.splitPeriodQuery` ignores `periods`. That is what lets this ship to core `main` alone, ahead of the functional change that sends it (the report-server runs core `main`).

### Contract keys

- `sql.periodQuery`: per-account amounts for each period, `account_id, idx, own_amt, own_amt_sly, own_amt_prev`. It reads `fact_acct` once over the date hull (grouped by account and day, `MATERIALIZED`), then joins the days to the periods.
- `sql.splitPeriodQuery`: the same, grouped by `dimension_id, dimension_name, idx`, for the account split (`splitBy`/`splitNodeId`).
- Both must contain `__PERIODS__`, the `VALUES` list `(idx, from, to, slyFrom, slyTo, prevFrom, prevTo)`, and keep the main query's predicates (a parity test per contract; Profit & Loss: `report-profit-loss-account-tree.test.js` in the functional repo). The existing `sql.query` / `sql.splitQuery` are never changed for this: other callers (the MCP handler) mirror them by hand.

### `periods` and `__PERIODS__` (`cli/src/report-periods.js`)

`periods` is a request value, **not a declared contract parameter**: `applyPlaceholders` pastes a declared one into the SQL raw. It is a string of tuples joined by commas, bucket 0 (the whole range) first:

```
2026-01-01..2026-03-31|2025-01-01..2025-03-31|2025-12-01..2026-02-28,2026-01-01..2026-01-31|2025-01-01..2025-01-31|2025-12-01..2025-12-31,...
 range      |same period last year|previous period            (one tuple per bucket)
```

`buildPeriodValues(raw, { maxBuckets, grain, hiddenCount, capRange })` validates it and returns `{ values, hull, periods, hiddenCount, grain }`; every date that reaches the SQL is re-serialised from a parsed real day, so nothing from the request is concatenated. Rules (anything else is `400 INVALID_PERIODS`, except the length rules, `400 PERIOD_RANGE_TOO_LONG`):

| Rule | Limit |
|---|---|
| Shape | non-empty string up to 2000 characters; each tuple is `range\|sly\|prev`, each range `yyyy-MM-dd..yyyy-MM-dd` and a real day (no 31 Feb) |
| Order | `from <= to` in every range |
| `columns` (`grain`) | `total`, `month` or `quarter`; `total` takes exactly one tuple, a grain takes the range plus at least one period |
| Periods inside the range | every period after bucket 0 lies within bucket 0 |
| Length | a month bucket and its compared ranges at most 31 days, a quarter 92 (`PERIOD_RANGE_TOO_LONG`) |
| Compared range distance | its `from` and `to` at most 460 days from its period's (plus the range's own length for bucket 0, whose "previous period" shifts by it) |
| Bucket count | at most `SCREEN_MAX_BUCKETS` = 13 (the range plus 12 months, the most any mode shows; `SCREEN_PERIODS` in `report-periods.js`) on `/query` and for pdf/html; `EXPORT_MAX_BUCKETS` = 25 for xlsx/csv (`maxPeriodBucketsFor(format)`), else `PERIOD_RANGE_TOO_LONG` |
| Range cap (`capRange`, xlsx/csv only) | bucket 0 and its compared ranges may not end after `from` + 24 months (`PERIOD_RANGE_TOO_LONG`); on screen and in the PDF any range works |
| `hiddenCount` | integer 0-1000 (the earlier periods the screen left out) |
| Reserved token | a parameter value containing `__PERIODS__` is refused (`assertNoPeriodsToken`) |

**Substitution.** The `VALUES` text replaces `__PERIODS__` **after** `applyPlaceholders` (`substitutePeriods`), so the request can never inject it. `applyPlaceholders` runs over the **date hull** (`hullParams`: the earliest to the latest date of any range, `compareTo=false`, no year), which fills the main query's window clauses exactly. A period query without the placeholder is a contract bug: `500 QUERY_FAILED` (logged), never a literal sent to the database.

### Response shapes

`/query` with `periods`, **in every `columns` mode, `total` included** (one period):

```json
{ "kind": "tree",
  "periods": [{ "idx": 0, "dateFrom": "2026-01-01", "dateTo": "2026-03-31", "partial": false },
              { "idx": 1, "dateFrom": "2026-01-01", "dateTo": "2026-01-31", "partial": false }],
  "hiddenCount": 0,
  "rows": [{ "node_id": "...", "parentId": "...", "amount": 100, "amount_ref": 80,
             "cells": [{ "amount": 100,
                         "sly":  { "amount": 80, "variationAmount": 20, "variationPct": 25, "trend": "improves" },
                         "prev": { "amount": 90, "variationAmount": 10, "variationPct": 11.1, "trend": "improves" } }],
             "visible":   { "none": true, "sly": true, "prev": true },
             "parentIds": { "none": "...", "sly": "...", "prev": null } }] }
```

- `cells[i]` belongs to `periods[i]`; `idx` 0 is the range. `sly` is the same period last year, `prev` the previous period, each with `addVariation`'s `variationAmount`, `variationPct` and `trend` (`trend` only when the contract declares `"trend": "result"`).
- `visible` and `parentIds` answer, for each comparison mode, whether the row shows and its nearest ancestor that shows (`showOnlyAccountsWithValue`: a row shows in a mode when any of its cells, current or compared in that mode, is non-zero, or it is *always shown*). The client switches mode with no new request. In comparison mode (`sly`/`prev`) only the range total and the last `comparedPeriods` periods (`SCREEN_PERIODS[grain].compared`: 6 months, 4 quarters) count, the ones the screen shows with a comparison; `none` and a render look at every requested period. `parentId` stays the unfiltered one.
- The top-level `amount` / `amount_ref` / variation fields are bucket 0's current and same-period-last-year values.
- Each period is the existing `buildAccountReportTree` run on that period's own amounts (`buildPeriodAccountTree`), so roll-ups, formulas and ShowValueCond behave as in a single-range report. Consequence: a clamped period need not add up to the clamped total for a *P/N* summary node; each column equals the report for its own range.
- **Split** (`splitBy` + `splitNodeId`, with `periods`): `{ kind: 'split', rows, periods, hiddenCount }`, each row `{ node_id, name, sign, amount, amount_ref, cells }`, signed like the account and sorted by the range's absolute amount.

### Balance block and income-summary split (ETP-6083)

Both are opt-in and structural (no report id in code); a contract without them answers exactly as before.

**`balanceCheck: true`** (contract top level, server-side, not forwarded in the descriptor). The `/query` tree answer (plain or with `periods`) gets `balance: { balanced, activo, pnPasivo, diff }`: the rows with no `parentId` (the top of each side) per `group` in the displayed sign, the first group (Activo) against the second (Patrimonio Neto y Pasivo); `diff = activo - pnPasivo`, `balanced` when `|diff| < 0.005`. Anything but exactly two root groups -> `balance: null`. `balanceRef` is the same shape for the comparison: with `periods`, `{ sly, prev }` (bucket 0); without, the plain `amount_ref` block, present only with `compareTo=true`. `/query` only: `/render` does not ship it (no template prints it). Computed from the rows the answer shows. The roots of a side may include its TOTAL, a formula row (`isFormula`) over its siblings: when a side has one, that row is the side's value, otherwise the non-formula roots are summed. `activo` / `pnPasivo` are simply the first / second root group (document order), not looked up by name.

**Result split.** A query that returns `result_onthefly` (`result_onthefly_ref` for the comparison) on a node, or `own_result` / `own_result_sly` / `own_result_prev` in the period queries (the same columns in the split queries), marks the income-summary account: the amount it shows includes an unregularized result. The raw debit - credit goes through the row's sign multiplier and the row gets, in DISPLAYED sign, `result: { onTheFly, posted }` with `posted = amount - onTheFly`:

- tree row: `result` (current) and `resultRef` (the comparison period) when `result_onthefly_ref` is returned;
- period row: `cells[i].result = { onTheFly, posted, sly: {onTheFly, posted}, prev: {onTheFly, posted} }` (a missing `sly`/`prev` result column reads as on-the-fly 0); the row's own top-level `result` / `resultRef` are bucket 0 current / same period last year;
- split rows (`kind: 'split'`), plain (`result`, `resultRef`) and with periods (`cells[i].result`).

Summary and formula nodes get none: only the node whose query returned the columns.

### Render side (`/render`)

Both engines pass `periodRows` and `periodSpec` from `runReportSql` into `buildRenderAccountTree(rows, operandRows, params, contract, period)`, which builds the same period tree and keeps the rows of the export's `compareMode` (`none`, `sly`, `prev`; anything else is `none`; `selectPeriodMode`). The `hiddenCount` / `columns` / `compareMode` params are read from the request like `periods`.

`buildPeriodMeta(spec, { format, compareMode })` adds to the template data (`{}` without periods, so a plain render's data is unchanged):

- `meta.periods`: `[{ idx, dateFrom, dateTo, partial }]`.
- `meta.notes`: `{ hiddenCount, hasPartial }`.
- `meta.columnPages` and `meta.columnPageSize` (PDF only): the period indexes cut in pages, 2 per page with a comparison (the range counts as a group), and without one every group in a single page (`buildPeriodMeta` does not split it). `columnPageSize` is that page size. A template must print through `periodPages`, which moves the range last and re-cuts the pages at that size; it also caps the size at 7 and balances the pages, so 12 months + the range come out as 7 + 6.

The templates read them through the canonical helpers in `templates/reports/helpers/report-html-helpers.js` (`createReportHelpers`, mirrored in `JSREPORT_HELPER_SOURCES` so they cross into the jsreport container; the parity test and `parity.json` guard it): `periodLabel(period, columns, locale, totalLabel)` (`sep 26`, `T3 26` / `Q3 26`, `*` when partial, the caller's label for the range), `periodOrder(periods)` (indexes with the range last, for Excel/CSV), `periodPages(columnPages, pageSize)` (the PDF pages with the range last, cut at `meta.columnPageSize`), `periodCompared(periodsParam, idx, mode, columns, locale)` (what a Comparado group is compared against: `ene 25`, `T1 25` or the compared dates) and `periodComparedHeader(caption, ...)` (`Comparado (ene 25)`, for the single Excel / CSV header cell), `periodMode(value)` (`sly`/`prev`, else empty) and `periodSpan(groups, mode)` (columns a group header spans). Never write a second copy in a report's own `helpers.js`.

Functional reference for the first consumer, with the client side (Columnas, the PDF pages, the 24-month export cap in the UI): `docs/generated-custom-windows/profit-loss.md` in `etendo_schema_forge`.

### Export filter grid: `excludeFromSummary` (ETP-6083)

`filterAndTransformParams` (`cli/src/report-filters.js`, used by `/render` and the dev plugin) builds the filter grid printed in PDF/HTML headers. A contract parameter with `"excludeFromSummary": true` stays a live control in the viewer but is never printed. Use it for a parameter that only drives the interactive view, such as the `ledgerStart` `dateFrom` of a point-in-time balance. Section-level `excludeFromSummary` works the same way for a whole section. Absent or `false`: unchanged.

## Shared DB pool, timeout and cancel (ETP-6146)

`cli/src/report-db.js`. The report server (`tools/report-server/server.js`) keeps one module-level pool for `/render`, `/query`, the logo lookup and the selectors, capped at `REPORT_DB_POOL_MAX` pooled connections. Dedicated cancellation connections are an explicit exception to that cap, described below. `handleReportQuery` takes `pool` (shared, never ended) instead of `createPool` (per request, ended: the dev engine); `createPool` still works.

| Env | Default | Meaning |
|---|---|---|
| `REPORT_DB_POOL_MAX` | 10 | max connections |
| `REPORT_DB_CONNECT_TIMEOUT_MS` | 10000 | wait for a connection |
| `REPORT_DB_IDLE_TIMEOUT_MS` | 30000 | idle connection lifetime |
| `REPORT_STATEMENT_TIMEOUT_MS` | 30000 | `statement_timeout` of the pool's connections (`/query`, selectors); past it `/query` answers `504 REPORT_TIMEOUT` |
| `REPORT_RENDER_STATEMENT_TIMEOUT_MS` | 120000 | `statement_timeout` for `/render` (large PDF/XLSX/CSV exports), set on its connection and reset afterwards; past it `/render` answers `504 REPORT_TIMEOUT` |
| `REPORT_TENANT_CONCURRENCY` | 2 | in-flight `/query` per `ad_client_id`; the rest wait |
| `REPORT_TENANT_WAIT_TIMEOUT_MS` | 30000 | maximum tenant queue wait; past it `/query` answers `504 REPORT_TIMEOUT` without starting SQL |

`/query` checks out one connection per request. When the browser aborts (`res` closes before the answer is finished), the backend query is cancelled with `pg_cancel_backend(processID)` and the connection is destroyed instead of reused. An abort before the connection is ready, or between the statements of one report, stops the next statement from running. The cancel goes over a short-lived dedicated connection (application_name `etendo-report-cancel`), not the pool, so it works when the pool is saturated. The pooled connection is held until that cancel finishes, including cleanup after failure. Each checked-out client can have only one cancel, so the per-process connection budget is at most **2 × `REPORT_DB_POOL_MAX`** (20 by default), including dedicated cancels. Cancellation connections use `REPORT_DB_CONNECT_TIMEOUT_MS` for connection, statement and client query timeouts. A 57014 (SQLSTATE, language independent) after our own abort is `REPORT_CANCELLED`; any other 57014 is `REPORT_TIMEOUT`. The pool logs an idle-client error instead of crashing, and is closed on SIGTERM/SIGINT.

Tenant waiters leave the queue on abort or after `REPORT_TENANT_WAIT_TIMEOUT_MS`; either path removes the waiter without consuming a slot, preserving FIFO handoff for remaining requests. This bounds queue residence time even when a browser stays connected. It does not impose a maximum queue length for a burst of simultaneous requests.

The session lookup and the report-access check of `/query` run in parallel; a session failure still wins over an access one.
