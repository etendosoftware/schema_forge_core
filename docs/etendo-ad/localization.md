# Etendo AD Localization Model

## Translation Tables (`_trl`)

Every translatable AD entity has a parallel `_trl` table with the same text columns plus `ad_language` and `istranslated`.

| Base Table | TRL Table | Translated Columns |
|------------|-----------|-------------------|
| `ad_element` | `ad_element_trl` | name, printname, description, help, po_name, po_printname, po_description, po_help |
| `ad_field` | `ad_field_trl` | name, description, help |
| `ad_window` | `ad_window_trl` | name, description, help |
| `ad_tab` | `ad_tab_trl` | name, description, help |
| `ad_menu` | `ad_menu_trl` | name, description |
| `ad_process` | `ad_process_trl` | name, description, help |
| `ad_ref_list` | `ad_ref_list_trl` | name, description |
| `ad_reference` | `ad_reference_trl` | name, description |
| `ad_message` | `ad_message_trl` | msgtext, msgtip |

Total: 38 `_trl` tables in the system.

## Label Chain (field → element)

```
ad_element.printname   → short UI label     ("Date Ordered")
ad_element.name        → formal name        ("Order Date")
ad_element.description → tooltip/help text
ad_field.name          → override at field level (takes precedence)
```

Fields inherit labels from their element via `ad_column.ad_element_id`.
`ad_field.name` can override the element-level label for a specific window context.

## Field-to-Label Match (Key Finding)

The **join key** between our schema and Etendo labels is `ad_column.columnname`,
which maps 1:1 to the `column` property in `schema-curated.json` fields.

```
schema field.column  →  ad_column.columnname  →  ad_field.name (window-specific label)
                                                →  ad_element.printname (generic short label)
```

### Current `toLabel()` vs Actual DB Labels (Sales Order)

The `toLabel()` function derives labels from camelCase field names. Many are wrong:

| field.name (schema) | column | toLabel() output | DB field_label (correct) |
|---------------------|--------|-----------------|--------------------------|
| datePromised | DatePromised | Date Promised | **Scheduled Delivery Date** |
| grandTotal | GrandTotal | Grand Total | **Total Gross Amount** |
| totalLines | TotalLines | Total Lines | **Total Net Amount** |
| docStatus | DocStatus | Doc Status | **Document Status** |
| salesRep | SalesRep_ID | Sales Rep | **Sales Representative** |
| poReference | POReference | Po Reference | **Order Reference** |
| documentNo | DocumentNo | Document No | **Document No.** |
| invoiceAddress | BillTo_ID | Invoice Address | Invoice Address (match) |
| businessPartner | C_BPartner_ID | Business Partner | Business Partner (match) |

### Labels Currently Embedded in Generated Code

The `generate-frontend.js` uses `toLabel(f.name)` and embeds the result directly
in each generated `*Form.jsx` and `*Table.jsx` as a static `label` property:

```js
// Generated OrderForm.jsx — label is a hardcoded string, NOT a key
{ key: 'datePromised', label: 'Date Promised', type: 'date' }
```

`EntityForm.jsx` and `DataTable.jsx` consume `field.label` directly.
There are ~244 generated JSX files with embedded labels across all artifacts.

## Language Activation

- `ad_language.isbaselanguage` — the source language (usually `en_US`)
- `ad_language.issystemlanguage` — marks a language as active for translation
- When a language is activated (`issystemlanguage = 'Y'`), Etendo populates `_trl` rows copying the base language text
- Translators then update the `name`/`printname` columns and set `istranslated = 'Y'`

### Current State (etendo_sf instance)

- Base language: `en_US` (system language)
- No other languages activated — all `_trl` tables are **empty**
- 100 languages defined in `ad_language` but none with `issystemlanguage = 'Y'` except `en_US`

## Query Pattern for Localized Labels

```sql
SELECT
  f.name                                    AS field_key,
  COALESCE(ft.name, f.name)                AS field_label,
  COALESCE(et.printname, e.printname)      AS print_label,
  COALESCE(et.description, e.description)  AS description
FROM ad_field f
JOIN ad_column c  ON f.ad_column_id  = c.ad_column_id
JOIN ad_element e ON c.ad_element_id = e.ad_element_id
LEFT JOIN ad_field_trl   ft ON f.ad_field_id  = ft.ad_field_id  AND ft.ad_language = $1
LEFT JOIN ad_element_trl et ON e.ad_element_id = et.ad_element_id AND et.ad_language = $1
```

Fallback: if no translation row exists, `COALESCE` returns the English base value.

## Volume Considerations

Relevant counts per window (Sales Order as reference):
- ~80 fields across header + line tabs
- Each field has 1 element (shared across windows)
- With N languages active, each field generates N rows in `ad_field_trl`

Total system-wide:
- `ad_element`: ~4000+ rows → 4000 × N languages in `ad_element_trl`
- `ad_field`: ~10000+ rows → 10000 × N languages in `ad_field_trl`

## MVP: Static JSON Dictionaries

For the MVP, labels are resolved from **static JSON files bundled in the app**.
No backend endpoint, no runtime fetch. The JSON is generated from the Etendo DB
by a CLI extractor and committed to the repo.

### Why static for MVP

- Zero infrastructure — no endpoint, no caching, no Service Worker
- Works offline by default (PWA-ready)
- Fast: labels are imported at build time, zero latency
- Good enough while translations change infrequently

### JSON shape (keyed by column name)

The JSON uses `ad_column.columnname` as key — the same value stored in
`schema-curated.json` field `column` property. This is the stable join key.

```json
{
  "fields": {
    "C_BPartner_ID": { "label": "Business Partner", "description": "Anyone who takes part in daily business operations..." },
    "DateOrdered": { "label": "Order Date", "description": "The time listed on the order." },
    "DatePromised": { "label": "Scheduled Delivery Date", "description": "The date that a task is to be completed by." },
    "GrandTotal": { "label": "Total Gross Amount" },
    "DocStatus": { "label": "Document Status" }
  },
  "windows": {
    "Sales Order": { "label": "Sales Order" }
  },
  "tabs": {
    "Header": { "label": "Header" },
    "Lines": { "label": "Lines" }
  },
  "menus": {
    "Sales Order": { "label": "Sales Order" }
  }
}
```

### File structure

```
tools/app-shell/src/locales/
  en_US.json    ← extracted from DB (base language)
  es_ES.json    ← future: extracted from DB _trl tables
```

### What gets localized

| Entity | Used For |
|--------|----------|
| Field labels (by column name) | Form field labels, column headers, placeholders |
| Window names | Page title, breadcrumb |
| Tab names | Tab headers in master-detail |
| Menu items | Sidebar navigation |

### What stays in English (code-level)

- Field keys in schema/contract (e.g., `businessPartner`)
- Visibility categories (`editable`, `readOnly`, `system`, `discarded`)
- API field names in DTOs
- Test descriptions

---

## Implementation Plan

### Step 1: Extract labels from DB → `en_US.json`

Create `cli/src/extract-labels.js` that:
- Connects to Etendo DB (same config as `extract-fields.js`)
- Queries all field labels per window: `ad_field.name` keyed by `ad_column.columnname`
- Queries window names, tab names, menu items
- For non-base languages, queries `_trl` tables with COALESCE fallback
- Outputs a single JSON file per language

```bash
node cli/src/extract-labels.js --lang en_US --out tools/app-shell/src/locales/en_US.json
```

**Scope:** CLI tool only. No frontend changes yet.
**Test:** Verify JSON output matches expected labels for Sales Order fields.

### Step 2: Create `useLabel()` hook + `LocaleProvider`

Create `tools/app-shell/src/i18n/`:
- `LocaleProvider.jsx` — React context, loads JSON by locale, provides `t()` function
- `useLabel.js` — hook that returns `t(columnName)` → localized label

```jsx
// LocaleProvider wraps the app
<LocaleProvider locale="en_US">
  <App />
</LocaleProvider>

// Any component
const t = useLabel();
t("C_BPartner_ID")  →  "Business Partner"
t("DatePromised")   →  "Scheduled Delivery Date"
```

Resolution: `t(columnName)` looks up `fields[columnName].label`.
Fallback: if key not found, derive from camelCase name (existing `toLabel()` behavior).

**Scope:** i18n infrastructure only. Not wired to generated components yet.
**Test:** Unit test `useLabel` with mock locale data.

### Step 3: Modify `generate-frontend.js` — stop embedding labels

Change the generator so generated `*Form.jsx` and `*Table.jsx` files
use the `column` as a lookup key instead of a hardcoded `label` string.

Before:
```js
{ key: 'datePromised', label: 'Date Promised', type: 'date' }
```

After:
```js
{ key: 'datePromised', column: 'DatePromised', type: 'date' }
```

The `label` property is removed from generated field configs.

**Scope:** Generator + all regenerated artifacts.
**Test:** Existing `generate-frontend.test.js` updated. Contract tests still pass.

### Step 4: Update `EntityForm` + `DataTable` to use `useLabel()`

Modify the shared UI components to resolve labels via the hook:

```jsx
// EntityForm.jsx
const t = useLabel();
// Where it currently reads f.label, it now reads:
const label = t(f.column) ?? toLabel(f.key);  // fallback to camelCase
```

Same for `DataTable.jsx` column headers.

**Scope:** 2 files in `tools/app-shell/src/components/contract-ui/`.
**Test:** Manual verification + existing snapshot/visual tests.

### Step 5: Regenerate all artifacts

Run the generator for all windows to remove embedded `label` strings.
The generated forms now only carry `key` + `column`, and labels resolve at runtime.

```bash
# Regenerate all windows
for dir in artifacts/*/; do
  node cli/src/generate-frontend.js "$dir"
done
```

**Scope:** ~244 generated JSX files updated.
**Test:** App still renders correctly. Labels now match DB values.

### Execution order

```
Step 1 (extract-labels.js)     ← independent, can start immediately
Step 2 (useLabel hook)          ← independent, can start in parallel with Step 1
Step 3 (generator changes)     ← depends on Step 2 design (needs to know column key pattern)
Step 4 (EntityForm/DataTable)  ← depends on Step 2
Step 5 (regenerate all)        ← depends on Step 3
```

Steps 1 and 2 can run in parallel. Steps 3-5 are sequential.

---

## Future: Runtime Resolution from DB

> This section documents the target architecture for post-MVP.
> When the app needs dynamic translations without recompilation,
> migrate from static JSON to a backend endpoint + sessionStorage cache.

### Architecture

```
Login → GET /api/dictionary?lang=es_ES (~80KB gzip) → sessionStorage + DictionaryContext
Refresh → read sessionStorage (sync, instant)
Language switch → sessionStorage hit? instant. Miss? fetch, store, re-render.
UI chrome → stays as static JSON (different owner, different change cadence)
```

### Data volume (measured on etendo_sf instance)

| Source | Rows | Raw text size |
|--------|------|---------------|
| `ad_element` (base labels) | 3,221 | 192 KB |
| `ad_field` overrides (name ≠ element) | 533 | 9 KB |
| `ad_window` | 256 | — |
| `ad_tab` | 739 | — |
| `ad_menu` | 380 | — |
| `ad_process` | 291 | — |
| `ad_ref_list` | 1,327 | — |

All entities for one language ≈ **~80 KB gzipped**. 4 languages ≈ ~320 KB.

### Backend query pattern

```sql
SELECT
  f.name                                           AS field_key,
  COALESCE(ft.name, et.printname, e.printname)    AS label,
  COALESCE(et.description, e.description)         AS description
FROM ad_field f
JOIN ad_tab t     ON f.ad_tab_id    = t.ad_tab_id
JOIN ad_column c  ON f.ad_column_id = c.ad_column_id
JOIN ad_element e ON c.ad_element_id = e.ad_element_id
LEFT JOIN ad_field_trl   ft ON f.ad_field_id   = ft.ad_field_id   AND ft.ad_language = :lang
LEFT JOIN ad_element_trl et ON e.ad_element_id = et.ad_element_id AND et.ad_language = :lang
WHERE t.ad_window_id = :windowId
ORDER BY t.tablevel, f.seqno
```

### Invalidation

- sessionStorage scoped to browser session — re-fetched on next login
- Optional TTL check (24h) for long-lived sessions
- No Service Worker, no IndexedDB, no version polling
