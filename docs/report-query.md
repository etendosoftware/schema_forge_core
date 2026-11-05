# Report query route and access checks (ETP-6080)

`POST /api/reports/:id/query` returns a report's data as JSON, for the interactive report view. The handler is `handleReportQuery` in `cli/src/report-query.js`. Both engines call it, so the session, the access checks and the response shape cannot drift between dev and production: `tools/report-server/server.js` (production) and the functional repo's Vite plugin `vite-plugins/report-api.js` (`make dev`).

## Request and answer

Body: `{ params, locale, limit? }`. `params` are the contract's parameters, the same values `/render` takes. A JSON `null` body reads as `{}`. `limit` caps the main query only and must be a positive safe integer.

| Report kind | Answer |
|---|---|
| Account tree (contract with `sql.operandsQuery`) | `{ kind: 'tree', rows }`, every level at once, with variation fields when `compareTo: 'true'` |
| Split (`splitBy` + `splitNodeId` + `splitSign`, needs `sql.splitQuery`) | `{ kind: 'split', rows }` |
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
