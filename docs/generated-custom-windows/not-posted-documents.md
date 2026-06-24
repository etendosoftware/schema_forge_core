# Not Posted Documents

## Intent

Use this window to find and mass-post all accounting documents that are still pending posting across the organization. It aggregates unposted documents of every supported type into a single cross-document list, lets the user filter by type, accounting status, and date range, and exposes a **Post** action per row as well as a **Post selected** bulk action.

The window has no backing AD window — it is 100 % custom. Data is served by `NotPostedDocumentsHandler` (`@Named("not-posted-documents")`), which delegates to `NoPostedDocumentDS` from `bulk.posting-3.0.0.jar`.

## What this window should allow

- Display all unposted documents for the current organization in a flat list.
- Filter by document type (Sales Invoice, Purchase Invoice, Goods Shipment, etc.), accounting status, and date range (from / to).
- Post a single document directly from the row action button.
- Select multiple rows (including a select-all with indeterminate state) and post them all in one bulk operation.
- Show a success / partial / failure toast after every post attempt.
- Refresh the list automatically after a successful post without resetting active filters.

## Data architecture

```
NotPostedDocumentsPage (React)
  │
  ├── GET /header?_mode=filter-options
  │     → NotPostedDocumentsHandler.buildFilterOptions()
  │           → refListOptions(DOCUMENT_TYPE_REF_ID)     ← AD_Ref_List "ETBLKP_Documents"
  │           → refListOptions(ACCOUNTING_STATUS_REF_ID) ← AD_Ref_List accounting status
  │           returns { documentTypes: [{value,label}], accountingStatuses: [{value,label}] }
  │
  ├── GET /header?document=X&accountingStatus=Y&dateFrom=Z&dateTo=W
  │     → NotPostedDocumentsHandler.buildDocumentGrid(params)
  │           → AccessibleDS.fetchAll(dsParams)  (subclass exposing NoPostedDocumentDS.getData)
  │           → enriches each row with tableId from DOCUMENT_TYPE_TO_TABLE_ID
  │           returns { rows: [...], total: N }
  │
  ├── POST /header/{recordId}/action/post          body: { tableId, recordId }
  │     → NotPostedDocumentsHandler.handleSinglePost()
  │           → DocumentPostingService.post(tableId, recordId)
  │
  └── POST /header/0/action/bulk-post              body: { rows: [{tableId,recordId,label}] }
        → NotPostedDocumentsHandler.handleBulkPost()
              → DocumentPostingService.post() per row
              returns { ok, total, results: [{recordId, tableId, success, message}] }
```

## Backend — `NotPostedDocumentsHandler`

File: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/handlers/NotPostedDocumentsHandler.java`

CDI qualifier: `@Named("not-posted-documents")` — **`@Named` only, no normal scope** (see CLAUDE.md NeoHandler rules).

### `NoPostedDocumentDS` access pattern

`getData()` is declared `protected` in the JAR. The handler bridges this via a private static inner subclass:

```java
private static class AccessibleDS extends NoPostedDocumentDS {
  List<Map<String, Object>> fetchAll(Map<String, String> p) {
    return getData(p, 0, Integer.MAX_VALUE);
  }
}
```

### `tableId` enrichment

`NoPostedDocumentDS` returns a `documentType` string (e.g. `"Sales Invoice"`) but not the `AD_Table_ID`. The handler maintains a static `DOCUMENT_TYPE_TO_TABLE_ID` map populated from `NoPostedConstants` string constants and an AD_Table lookup:

| Document type string | AD_Table_ID | Table |
|---------------------|-------------|-------|
| `Sales Invoice` / `Purchase Invoice` / `Invoice` | `318` | `C_Invoice` |
| `Goods Shipment` / `Goods Receipt` / `ShipmentInOut` / `Return to Vendor Shipment` / `Return Material Receipt` | `319` | `M_InOut` |
| `Movement` | `323` | `M_Movement` |
| `Amortization` | `800060` | `A_Amortization` |
| `GL Journal` | `224` | `GL_Journal` |
| `Inventory` | `321` | `M_Inventory` |

### Filter criteria mapping

Frontend query params are translated to SmartClient `AdvancedCriteria` JSON before being passed to `getData`:

| Frontend param | Criteria field | Operator |
|----------------|---------------|----------|
| `document` | `document` | `iEquals` |
| `accountingStatus` (single) | `accountingStatus` | `iEquals` |
| `accountingStatus` (comma-separated) | `accountingStatus` | `inSet` |
| `dateFrom` | `accountingDate` | `greaterOrEqual` |
| `dateTo` | `accountingDate` | `lessOrEqual` |

### AD_Ref_List constants

| Constant | AD_Reference_ID |
|---------|-----------------|
| `DOCUMENT_TYPE_REF_ID` | `DE94535164E741AB9B1A560EF3F72854` (`ETBLKP_Documents`) |
| `ACCOUNTING_STATUS_REF_ID` | `D674E22A40DE4CEE931AB96F4CD914F9` |

Filter option labels are returned in the user's session language via `ListTrl.getADListTrlList()`, falling back to the base `List.getName()` when no translation is found.

### API responses

**`GET /header?_mode=filter-options`**
```json
{
  "response": {
    "data": [{ "documentTypes": [{"value":"X","label":"Y"}], "accountingStatuses": [...] }]
  }
}
```

**`GET /header?...`**
```json
{ "response": { "data": [{ "rows": [...], "total": N }] } }
```
Each row includes: `documentType`, `documentId`, `description`, `accountingDate`, `organization`, `tableId` (enriched by handler).

**`POST /header/{id}/action/post`**
```json
{ "response": { "data": [{ "success": true|false, "message": "..." }] } }
```
Returns HTTP 422 on failure (non-ok `PostResult`).

**`POST /header/0/action/bulk-post`**
```json
{ "response": { "data": [{ "ok": N, "total": M, "success": true|false, "results": [...] }] } }
```
Always returns HTTP 200; per-row `success` fields indicate individual outcomes.

## NEO spec / entity DB records

Inserted by `cli/src/push-not-posted-documents.js` (idempotent — checks for existence before inserting):

| Table | ID |
|-------|----|
| `ETGO_SF_SPEC` | `4B056F343EAE4ACCAEB67E1B653CACF3` |
| `ETGO_SF_ENTITY` | `08E40F2DE08442FABAC3B540DB516036` |

Spec name: `not-posted-documents` (kebab-case, matches `toSpecName()` convention).
Entity name: `header`. Java_Qualifier: `not-posted-documents`.
No backing AD window — `AD_Window_ID` is null.

## Frontend component — `NotPostedDocumentsPage`

File: `tools/app-shell/src/windows/custom/not-posted-documents/NotPostedDocumentsPage.jsx`

Props: `{ token, apiBaseUrl }` — `apiBaseUrl` is already spec-scoped (e.g. `.../swebsf/not-posted-documents`), used directly as `neoUrl`.

### Lifecycle

1. **Mount** — fetches filter options (`GET /header?_mode=filter-options`); fetches initial row list with no filters.
2. **Apply filters** — calls `fetchRows(filters)` with the current filter state; clears the selection set.
3. **Post row** — fires `POST /header/{recordId}/action/post`; on success shows a toast and re-fetches the list without resetting filters.
4. **Post selected** — fires `POST /header/0/action/bulk-post` with all selected rows that have a resolved `tableId`; on success shows a partial/complete/failure toast and re-fetches.

### Selection model

- Per-row checkboxes managed by a `Set<documentId>` state.
- Select-all checkbox uses `ref` to set `indeterminate` when some (not all) rows are checked.
- Selection is cleared on filter apply and on successful bulk post.

### Toast keys

| Scenario | i18n key |
|----------|----------|
| Single post success | `documentPosted` |
| Bulk post — all ok | `postingComplete` |
| Bulk post — partial | `postingPartial` (substitutes `{ok}` and `{total}`) |
| Any failure | `postingFailed` |

## Interaction model

- Route: `/not-posted-documents` (custom window).
- Implementation type: `layoutType: "custom"` — loaded from `customLoaders` in `tools/app-shell/src/windows/registry.js`.
- Entry point: `NotPostedDocumentsPage.jsx`.
- Requests carry AbortController signals — switching filters or unmounting cancels in-flight fetches.

## Manual verification

1. Open `/not-posted-documents` — confirm the filter bar renders with Document type and Accounting status dropdowns populated from the real AD_Ref_List data.
2. Confirm the table loads with unposted documents for the current org on first render (no Apply needed).
3. Select a document type filter and click Apply — confirm the table refreshes with only that document type.
4. Click **Post** on a single row — confirm a success (or error) toast appears and the row disappears from the list after refresh.
5. Select several rows using the row checkboxes — confirm the **Post selected (N)** button appears in the toolbar.
6. Click **Post selected** — confirm a toast with the `postingComplete` or `postingPartial` message appears and the table refreshes.
7. Select all rows via the header checkbox — confirm the indeterminate state transitions to checked. Deselect one row — confirm it goes back to indeterminate.
8. With no rows matching the filters, confirm the empty-state illustration renders instead of an empty table.
9. Confirm the page title and record count in the topbar update to reflect the number of rows in the table.

## Automated evidence

- `artifacts/not-posted-documents/decisions.json` — `layoutType: "custom"`, `javaQualifier: "not-posted-documents"`, Finance category.
- `cli/src/push-not-posted-documents.js` — idempotent ETGO_SF_SPEC + ETGO_SF_ENTITY insert; `--dry-run` flag supported.
- `cli/src/validate-pipeline.js` — `not-posted-documents` listed in `CUSTOM_ONLY_ARTIFACTS`; pipeline contract validation skipped.
- `tools/app-shell/src/windows/registry.js` — `not-posted-documents` in `customLoaders`.
- `tools/app-shell/src/menu.json` — entry in the Finance group (after `amortization`).
- `tools/app-shell/src/windows/custom/not-posted-documents/NotPostedDocumentsPage.jsx` — main component; AbortController fetch cancellation; select-all indeterminate via ref.
- `tools/app-shell/src/windows/custom/not-posted-documents/not-posted-documents.css` — scoped `npd-*` CSS; design-system custom properties.
- `tools/app-shell/src/windows/custom/not-posted-documents/index.jsx` — re-export barrel.
- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/handlers/NotPostedDocumentsHandler.java` — `@Named("not-posted-documents")`; `AccessibleDS` inner subclass; `DOCUMENT_TYPE_TO_TABLE_ID` static map; `refListOptions` + `getTranslatedName` AD_Ref_List helpers; package-private `setPostingService` seam for unit tests.
- `modules/com.etendoerp.go/src-db/database/sourcedata/ETGO_SF_SPEC.xml` — persisted spec record.
- `modules/com.etendoerp.go/src-db/database/sourcedata/ETGO_SF_ENTITY.xml` — persisted entity record.
- i18n keys: `notPostedDocuments`, `postSelected`, `postingComplete`, `postingPartial`, `postingFailed`, `filterDocumentType`, `filterAccountingStatus`, `accountingDate` in `en_US.json` / `es_ES.json`.
- `e2e/tests/flows/not-posted-documents.mocked.spec.js` — Playwright mocked E2E: filter options load, row table render, single-row Post action, bulk Post selected action, empty state.
