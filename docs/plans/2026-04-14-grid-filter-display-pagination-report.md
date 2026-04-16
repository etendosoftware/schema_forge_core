# Grid Filters and Sorting: Display-Value Analysis and Paginated Proposal

**Status:** Proposal
**Date:** 2026-04-14
**Scope:** Grid/list filtering **and sorting** in app-shell tables, with focus on display-aligned behavior and backend-applied pagination

---

## 1. Executive Summary

Two coupled problems affect the grid today:

### Problem A — Filtering does not match what the user sees
The current grid filtering logic does **not** consistently filter by the value the user sees on screen. Instead, it mostly filters by raw row values or `$_identifier` fallbacks. This causes visible mismatches for dates, enum/status labels, booleans, and some selector-like fields. Filtering also runs only over already-loaded rows, so paginated datasets are filtered incompletely.

### Problem B — Sorting by non-"name" columns is unreliable
The current backend sort key resolution (`resolveSortKey` in `tools/app-shell/src/hooks/useEntity.js:206-211`) only swaps the sort key to `${col}$_identifier` for FK columns, and only when the **first loaded row** happens to contain that companion key. As a result:

- Enum/status columns sort by raw codes (`CO`, `DR`, `IP`) instead of by the visible translated label (`Completed`, `Draft`, `In Process`).
- Boolean columns sort by raw `true`/`false` instead of by the badge label the user sees (`Complete` / `In Process`).
- FK columns sort by raw UUID when the sample row has that field null/missing, producing apparent random order.
- The very first sort click before any fetch completes falls through to the raw column name (no sample row yet).
- Sorting the visible order therefore diverges from the semantics the user perceives on screen.

**Verdict:** filtering and sorting must be redesigned together around three coordinated layers:

1. **Display-aware parsing** — users can type, and sort by, what they visually see.
2. **Per-column metadata** — each column declares how to filter and how to sort according to its type.
3. **Backend-applied filtering and sorting** — parsed filters and resolved sort keys are converted into request parameters so pagination returns already-filtered, correctly-sorted pages.

---

## 2. Current Behavior

### Current filtering path

In `tools/app-shell/src/components/contract-ui/DataTable.jsx`, both global and per-column filters use:

```js
const val = resolveIdentifier(row, key);
return String(val ?? '').toLowerCase().includes(q);
```

Relevant locations:
- `tools/app-shell/src/components/contract-ui/DataTable.jsx:592`
- `tools/app-shell/src/components/contract-ui/DataTable.jsx:602`

`resolveIdentifier()` only resolves:
- `row[key + '$_identifier']`
- `row[key].name` for object-shaped mock data
- raw value fallback

Relevant location:
- `tools/app-shell/src/lib/resolveIdentifier.js:12-18`

### Current pagination path

In `tools/app-shell/src/hooks/useEntity.js`, the list is fetched from backend with:
- `_sortBy`
- `_startRow`
- `_endRow`
- optional `baseFilter`

Relevant locations:
- `tools/app-shell/src/hooks/useEntity.js:232-279`

This means filtering is **not currently part of the paginated backend query**.

---

## 3. Problem by Case

### 3.1 Date columns

#### What the user sees
A locale-formatted date such as:
- `14/04/2026`

#### What is filtered today
The raw backend value, such as:
- `2026-04-14`
- `2026-04-14T00:00:00`

#### Why this fails
The user naturally filters by the displayed date format, but the current logic compares against the raw serialized value.

#### How it should be corrected
Users should be able to type the displayed date comfortably. The frontend should parse that human-friendly input and convert it into a backend filter.

Recommended behavior:
- `14/04/2026` → exact date filter
- `>14/04/2026` → greater-than filter
- `<01/05/2026` → lower-than filter
- `2026` → year range filter (optional but useful)

Recommended backend translation:
- exact date → `field = '2026-04-14'`
- comparison → `field > '2026-04-14'`
- partial input → translated into date ranges when possible

---

### 3.2 Selector / search / foreign key columns

#### What the user sees
A human-readable identifier such as:
- `A. Datum Corp`
- `Standard Price List`
- `Argentina`

#### What is filtered today
Usually `$_identifier` when present, otherwise raw ID or fallback value.

#### Why this still fails
Even when the visible label is available in loaded rows, the filter does not apply to the backend request, so pagination remains incorrect. Also, some fields need explicit knowledge of the backend text field to query.

#### How it should be corrected
Users should always filter by the displayed label.

Recommended behavior:
- Input: `datum`
- Frontend interpretation: “contains over identifier/label field”
- Backend filter: use the textual companion field, not the raw UUID

Recommended column metadata:

```js
{
  key: 'businessPartner',
  type: 'selector',
  filterMode: 'identifier',
  backendFilterKey: 'businessPartner$_identifier'
}
```

If backend supports filtering directly over identifier fields, use that. Otherwise, columns must declare which backend field represents the visible text.

---

### 3.3 Enum and status columns

#### What the user sees
Friendly or translated labels such as:
- `Draft`
- `Completed`
- `In process`

#### What is filtered today
The raw code or unresolved fallback, such as:
- `DR`
- `CO`
- internal status code values

#### Why this fails
The user filters by the visible label, but the backend ultimately needs the raw enum/status value.

#### How it should be corrected
The frontend should invert the label mapping.

Recommended behavior:
- Input: `completed`
- Frontend resolves label → raw code
- Backend query uses raw code

Example:

```js
{
  key: 'documentStatus',
  type: 'status',
  filterMode: 'enumLabel',
  enumLabels: {
    DR: 'Draft',
    CO: 'Completed'
  }
}
```

Flow:
- user types `comp`
- frontend matches visible label `Completed`
- backend receives `documentStatus = 'CO'`

If multiple labels match, backend can receive an `IN (...)` filter.

---

### 3.4 Boolean columns

#### What the user sees
Depending on the column, the table may display:
- `Yes / No`
- `Complete / In process`
- custom badge labels

#### What is filtered today
Boolean raw values or fallback strings, not the actual visible label set.

#### Why this fails
The visible semantics vary by column, and the filter logic does not respect those semantics.

#### How it should be corrected
Boolean filters should accept user-friendly terms and map them to raw backend values.

Recommended behavior:
- `yes`, `true`, `complete` → `true`
- `no`, `false`, `in process` → `false`

Recommended metadata:

```js
{
  key: 'processed',
  type: 'boolean',
  filterMode: 'booleanLabel',
  badgeLabels: {
    true: 'Complete',
    false: 'In process'
  }
}
```

The frontend should interpret the input against both generic boolean words and the specific visible labels configured for that column.

---

### 3.5 Amount and number columns

#### What the user sees
Formatted numeric values such as:
- `1,234.50`
- `$ 1,234.50`

#### What is filtered today
A raw numeric value converted to string.

#### Why this is weak
Users may type localized numeric formats or comparison expressions. A plain string `contains` filter is not a good experience.

#### How it should be corrected
Numbers and amounts should support numeric parsing and optional operators.

Recommended behavior:
- `1234.5`
- `>1000`
- `<5000`
- `=250`

Recommended backend translation:
- equality and range filters expressed numerically
- avoid text `contains` semantics for numeric columns when possible

---

### 3.6 Plain string columns

#### What the user sees
Plain text.

#### What is filtered today
Plain text over loaded rows only.

#### Why it still needs correction
This is the least problematic case from a display perspective, but it still suffers from the pagination problem.

#### How it should be corrected
Keep `contains` / case-insensitive behavior, but execute it in backend queries so the full dataset is filtered before pagination.

---

## 4. Proposed Solution

### 4.1 General principle

Filtering should be split into three responsibilities:

1. **Display text resolution** — determine what the user visually sees in the cell.
2. **Input parsing** — interpret what the user typed according to the column type.
3. **Backend filter generation** — turn the parsed filter into request parameters or backend filter expressions.

This avoids coupling the filter logic to `resolveIdentifier()` and aligns filtering with the real UI behavior.

---

### 4.2 Proposed utility module

Create a dedicated module such as:

- `tools/app-shell/src/lib/gridFilters.js`

Suggested responsibilities:
- `getDisplayText(row, col, helpers)`
- `parseUserFilter(col, input, helpers)`
- `buildBackendFilter(col, parsed, helpers)`

#### `getDisplayText(row, col, helpers)`
Returns the exact user-facing textual representation.

Use cases:
- fallback local filtering
- export consistency
- QA/debugging

#### `parseUserFilter(col, input, helpers)`
Interprets user input according to column type.

Examples:
- date string → exact date or date range
- enum label → raw enum code
- boolean label → `true` / `false`
- selector text → identifier contains query
- amount operator → numeric comparison

#### `buildBackendFilter(col, parsed, helpers)`
Transforms the parsed result into backend query parameters.

Examples:
- string → `ilike '%term%'`
- selector identifier → `field$_identifier ilike '%term%'`
- enum label → `field = 'CO'`
- date → `field between ...`
- numeric → `field > 1000`

---

### 4.3 Proposed metadata per column

Each column should declare how filtering should work.

Suggested examples:

```js
{
  key: 'orderDate',
  type: 'date',
  filterMode: 'date'
}
```

```js
{
  key: 'businessPartner',
  type: 'selector',
  filterMode: 'identifier',
  backendFilterKey: 'businessPartner$_identifier'
}
```

```js
{
  key: 'documentStatus',
  type: 'status',
  filterMode: 'enumLabel',
  enumLabels: {
    DR: 'Draft',
    CO: 'Completed'
  }
}
```

```js
{
  key: 'processed',
  type: 'boolean',
  filterMode: 'booleanLabel',
  badgeLabels: {
    true: 'Complete',
    false: 'In process'
  }
}
```

This keeps the behavior explicit and prevents special-case guessing inside the generic table component.

---

## 4bis. Sorting by Column Type

Sorting must mirror filtering: the user should be able to sort by what they visually see, and the sort must be performed in the backend so it applies to the full paginated dataset, not only to loaded rows.

### 4bis.1 Current behavior

- `useEntity` stores `sortColumn` / `sortDirection` and puts them into every list request via `_sortBy=<key> <dir>`.
- `resolveSortKey(sortColumn, sampleRow)` swaps `col` → `col$_identifier` only when the sample row contains that key.
- This logic is string-shaped instead of type-shaped: it assumes every FK has an `$_identifier` in the first row, ignores enum/status label mappings, and ignores boolean badge labels.

### 4bis.2 Required behavior by type

| Column type | Backend sort key | Notes |
|-------------|------------------|-------|
| String | raw column | case-insensitive if backend supports it |
| Selector / search / FK | `${col}$_identifier` always | do not depend on sample row; companion field is guaranteed by NEO Headless for FKs |
| Enum / status | server-side custom sort expression over the label map, OR a fallback sort by raw code with an explicit **display order** derived from `enumLabels` | fallback: stable order defined by decisions.json |
| Boolean | raw boolean, but with semantic direction (`true` first vs `false` first) based on `badgeLabels` configuration | direction label should match what "ascending" means visually |
| Date | raw date column | correct by construction |
| Amount / number | raw numeric column | correct by construction |

### 4bis.3 Per-column sort metadata

Each column should declare how to sort. Suggested shape (reusing the same metadata bag used by filtering, §4.3):

```js
{
  key: 'businessPartner',
  type: 'selector',
  backendSortKey: 'businessPartner$_identifier'   // explicit, not sample-row-dependent
}
```

```js
{
  key: 'documentStatus',
  type: 'status',
  sortMode: 'enumLabel',
  enumLabels: { DR: 'Draft', CO: 'Completed', IP: 'In Process' },
  enumOrder: ['DR', 'IP', 'CO']                   // optional explicit display order
}
```

```js
{
  key: 'processed',
  type: 'boolean',
  sortMode: 'booleanLabel',
  badgeLabels: { true: 'Complete', false: 'In Process' }
}
```

### 4bis.4 Resolution strategy

Introduce `resolveBackendSort(col, direction, helpers)` in the same module proposed in §4.2 (`tools/app-shell/src/lib/gridFilters.js` — consider renaming to `gridQuery.js` so it covers both filter and sort concerns). Responsibilities:

- Return the backend `_sortBy` key for the column.
- For enum/status, if the backend cannot sort by translated label, append a secondary client-side resort **of the current page only**, documented as a best-effort fallback until backend supports label-sorted queries.
- Remove the sample-row-dependent branch from `useEntity`. The column metadata is the single source of truth.

### 4bis.5 First-click race fix

`resolveSortKey` currently runs inside `refresh()` / `loadMore()` against `sampleRowRef.current`, which is `null` on the first request. Once sort logic is metadata-driven (§4bis.3) the race disappears — the key is derived from the column definition, not from fetched rows.

---

## 5. Pagination-Aware Filtering

### Current problem
`DataTable` currently filters in memory after rows have already been fetched. With pagination, this means:
- only loaded rows are filtered
- later pages may contain matches that the user never sees
- the visible record count becomes misleading

### Required change
The filter state must move into the data-fetch layer so requests are made with active filters applied.

Recommended direction:
- `DataTable` becomes an input collector for filter values
- `ListView` or parent container stores active filters
- `useEntity` receives those filters and includes them in `refresh()` and `loadMore()` requests

Suggested extension to `useEntity`:

```js
useEntity(entity, null, {
  token,
  apiBaseUrl,
  baseFilter,
  columnFilters,
  globalFilter
})
```

Then both `refresh()` and `loadMore()` should build URLs with the parsed backend filter expression.

---

## 6. Recommended behavior by type

### String
- User types visible text
- Backend uses case-insensitive contains

### Date
- User types displayed date or comparison
- Frontend parses to exact date / range / comparator
- Backend receives normalized date filter

### Selector / search / FK
- User types visible identifier
- Frontend resolves to textual backend field
- Backend filters by identifier-like field, not raw UUID

### Enum / status
- User types visible label
- Frontend maps visible label to raw code
- Backend filters by raw code or `IN (...)`

### Boolean
- User types generic or badge-specific label
- Frontend maps to boolean raw value
- Backend filters by boolean

### Amount / number
- User types numeric expression
- Frontend parses number and operator
- Backend uses numeric comparison

---

## 7. Implementation Recommendation

The work is split into six independently shippable stages. Each stage produces a validatable outcome and can be merged on its own. Stages 2 and 3 are parallelizable after Stage 1; Stages 4 → 5 → 6 are sequential.

```
1 (lib)
 ├──▶ 2 (sort fix)           ← shippable, resolves Problem B
 └──▶ 3 (filter display)     ← shippable, resolves Problem A in-memory
        │
        ▼
        4 (lift state)        ← invisible refactor
        │
        ▼
        5 (backend filter)    ← shippable, resolves pagination correctness
        │
        ▼
        6 (enum label sort)   ← final polish
```

### Stage 1 — Foundation library (no integration) [DONE]
- Introduce `tools/app-shell/src/lib/gridQuery.js`.
- Define per-column metadata shape: `type`, `filterMode`, `sortMode`, `backendFilterKey`, `backendSortKey`, `enumLabels`, `enumOrder`, `badgeLabels`.
- Implement pure functions: `getDisplayText(row, col)`, `parseUserFilter(col, input)`, `resolveBackendSort(col, direction)`, `buildBackendFilter(col, parsed)`.
- No wiring into `DataTable` / `useEntity` yet.
- **Validation:** unit tests covering each column type.
- **Risk:** none (isolated code).

### Stage 2 — Sort bug fix (high value, low risk) [DONE]
- Replace `resolveSortKey(sortColumn, sampleRow)` in `useEntity.js` with `resolveBackendSort(col, direction)` from the library.
- Add minimal sort metadata per column (at least `backendSortKey` for FK columns).
- Does not touch filters.
- **Validation:** clicking sort on an FK / enum / status / boolean column yields consistent order on the first click, independent of `sampleRowRef`.
- **Risk:** low. Resolves Problem B on its own.

### Stage 3 — Display-aware filtering (still in-memory)
- Wire `getDisplayText` + `parseUserFilter` into the existing client-side filter path in `DataTable.jsx`.
- Pagination semantics unchanged (still filters loaded rows only).
- **Validation:** user types `14/04/2026`, `completado`, `complete`, and the filter matches rows whose displayed value matches.
- **Risk:** medium — user-visible filter semantics change.

### Stage 4 — State lift (pure refactor)
- Lift `columnFilters` + `globalFilter` from `DataTable` up to `ListView` (or equivalent parent).
- Behavior unchanged — prepares the plumbing for Stage 5.
- **Validation:** all filters observed in Stage 3 continue to work identically.
- **Risk:** low (refactor without behavior change).

### Stage 5 — Backend-applied filters
- `useEntity.refresh()` and `useEntity.loadMore()` receive active filters and translate them via `buildBackendFilter` into NEO Headless query parameters.
- Preserve existing `baseFilter`.
- **Blocker:** requires §8 NEO Headless validation **before** starting (filter syntax, AND/OR combination, `$_identifier` filtering, date ranges).
- **Validation:** dataset with >200 rows; apply a column filter, scroll to load additional pages, and confirm later pages are also filtered (no late surprises).
- **Risk:** high — backend contract dependency. Resolves the pagination correctness requirement.

### Stage 6 — Enum-label sort fallback
- If NEO Headless cannot sort by translated enum/status label, apply a best-effort client-side resort of the current page only, driven by `enumOrder`.
- Document the fallback and flag it for backend follow-up.
- **Validation:** sorting by `documentStatus` shows `Completed / Draft / In Process` in label order, not raw code order.
- **Risk:** low (opt-in fallback).

### Stage risk summary

| Stage | Risk | Driver |
|-------|------|--------|
| 1 | None | Isolated library with tests |
| 2 | Low | Localized change; failure mode obvious |
| 3 | Medium | Changes user-visible filter semantics |
| 4 | Low | Behavior-preserving refactor |
| 5 | **High** | Depends on NEO Headless contract (§8) |
| 6 | Low | Optional fallback |

### Sequencing caveat
Stages 4 and 5 share the filter pipeline. Stage 4 shipped alone delivers no user-visible benefit — it only prepares Stage 5. Keep them close in time to avoid leaving the refactor dangling.

---

## 8. Key Risks and Validation Points

Before implementation, confirm the exact NEO Headless syntax for:
- text contains / case-insensitive matching
- equality
- date ranges
- numeric comparisons
- filtering by `$_identifier` or equivalent textual companion fields
- combining multiple column filters with `AND`
- combining global search terms with `OR`
- **sorting** by `$_identifier` companion fields for FK columns
- **sorting** by translated enum/status labels (or confirm that this must be emulated client-side on top of paginated results)
- direction semantics for boolean columns (which raw value is "first" when the user says "ascending")

Without this validation, the frontend can parse inputs correctly but still fail to translate them into backend-compatible queries or sort expressions.

---

## 9. Final Recommendation

The correct fix is **not** to only improve `resolveIdentifier()`, and **not** to patch `resolveSortKey()` with more special cases.

Both would provide partial improvements but leave pagination and sort semantics incorrect for several column types.

The robust solution is to:
- make filtering **and sorting** type-aware
- parse and resolve according to displayed values
- translate to backend filters and backend sort keys via explicit column metadata
- execute filtering and sorting inside paginated API requests

This is the only approach that satisfies all three requirements:
1. users filter by what they see
2. users sort by what they see, for any column type — not just `name` / text columns
3. both filtering and sorting apply to the full dataset, not just the loaded page
