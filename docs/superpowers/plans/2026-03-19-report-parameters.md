# Report Parameters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parameter forms to reports so users can filter by date range, organization, business partner, etc. before running a report — matching Etendo classic report behavior.

**Architecture:** Parameters are defined in `report-contract.json` as a `parameters` array. The UI shows a collapsible form panel above the report preview. User-entered values are sent as part of the render request body. The backend merges them into NEO body or SQL placeholders before executing.

**Tech Stack:** React (form UI), Vite plugin (parameter merging), existing report contracts

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `artifacts/*/report-contract.json` | Modify | Add `parameters` array to each report |
| `tools/app-shell/src/pages/ReportViewerPage.jsx` | Modify | Add `ReportParamsForm` component and parameter state |
| `tools/app-shell/vite-plugins/report-api.js` | Modify | Merge user params into NEO body / SQL placeholders |
| `cli/src/extract-from-jasper.js` | Modify | Extract parameters from jrxml into contract |

---

### Task 1: Define parameter schema in contracts

**Files:**
- Modify: `artifacts/aging-receivable/report-contract.json`
- Modify: `artifacts/aging-payable/report-contract.json`
- Modify: `artifacts/balance-sheet/report-contract.json`
- Modify: `artifacts/profit-loss/report-contract.json`
- Modify: `artifacts/report-general-ledger/report-contract.json`
- Modify: `artifacts/report-order-not-shipped/report-contract.json`

- [ ] **Step 1: Add parameters to Aging Receivable**

```json
"parameters": [
  { "name": "currentDate", "label": { "en_US": "As of Date", "es_ES": "Fecha corte" }, "type": "date", "default": "__TODAY__" },
  { "name": "column1", "label": { "en_US": "Bucket 1 (days)", "es_ES": "Tramo 1 (días)" }, "type": "number", "default": "30" },
  { "name": "column2", "label": { "en_US": "Bucket 2", "es_ES": "Tramo 2" }, "type": "number", "default": "60" },
  { "name": "column3", "label": { "en_US": "Bucket 3", "es_ES": "Tramo 3" }, "type": "number", "default": "90" },
  { "name": "column4", "label": { "en_US": "Bucket 4", "es_ES": "Tramo 4" }, "type": "number", "default": "120" }
]
```

Add the same to Aging Payable (identical parameters).

- [ ] **Step 2: Add parameters to Balance Sheet**

```json
"parameters": [
  { "name": "dateFrom", "label": { "en_US": "Date From", "es_ES": "Desde" }, "type": "date" },
  { "name": "dateTo", "label": { "en_US": "Date To", "es_ES": "Hasta" }, "type": "date", "default": "__TODAY__" }
]
```

Add SQL date placeholders: `AND fa.dateacct >= '__DATE_FROM__' AND fa.dateacct <= '__DATE_TO__'`

- [ ] **Step 3: Add parameters to P&L** (same as Balance Sheet)

- [ ] **Step 4: Add parameters to General Ledger**

```json
"parameters": [
  { "name": "dateFrom", "label": { "en_US": "Date From", "es_ES": "Desde" }, "type": "date" },
  { "name": "dateTo", "label": { "en_US": "Date To", "es_ES": "Hasta" }, "type": "date", "default": "__TODAY__" }
]
```

The GL's Jasper SQL already has date filters — the report-api will inject them.

- [ ] **Step 5: Add parameters to Orders Awaiting Delivery**

```json
"parameters": [
  { "name": "dateFrom", "label": { "en_US": "Order Date From", "es_ES": "Fecha pedido desde" }, "type": "date" },
  { "name": "dateTo", "label": { "en_US": "Order Date To", "es_ES": "Fecha pedido hasta" }, "type": "date" }
]
```

- [ ] **Step 6: Commit**

```
Feature ETP-3572: Add parameter definitions to all report contracts
```

---

### Task 2: Build ReportParamsForm component

**Files:**
- Modify: `tools/app-shell/src/pages/ReportViewerPage.jsx`

- [ ] **Step 1: Add ReportParamsForm component**

A collapsible panel that renders form fields from `report.parameters`. Shows above the preview iframe. Fields: date pickers, number inputs, text inputs. "Run Report" button submits params.

```jsx
function ReportParamsForm({ parameters, values, onChange, onSubmit, loading }) {
  // parameters: [{ name, label, type, default }]
  // Renders input per type: date → <input type="date">, number → <input type="number">
  // "Run Report" button calls onSubmit(values)
}
```

Types to support:
- `date` → `<input type="date">`
- `number` → `<input type="number">`
- `text` → `<input type="text">`
- `select` → `<select>` with options from parameter definition

- [ ] **Step 2: Wire params into ReportViewer state**

Add `params` state. Initialize from `report.parameters` defaults. Show form if report has parameters. Auto-run on first load with defaults. Re-run when user submits new values.

```jsx
const [params, setParams] = useState(() => {
  const defaults = {};
  for (const p of report.parameters || []) {
    defaults[p.name] = p.default === '__TODAY__' ? new Date().toISOString().split('T')[0] : (p.default || '');
  }
  return defaults;
});
```

- [ ] **Step 3: Pass params in render request**

Change the fetch body from `{ format }` to `{ format, params }`:

```js
body: JSON.stringify({ format, params })
```

- [ ] **Step 4: Commit**

```
Feature ETP-3572: Add parameter form to Report Viewer UI
```

---

### Task 3: Backend parameter merging

**Files:**
- Modify: `tools/app-shell/vite-plugins/report-api.js`

- [ ] **Step 1: Extract params from request body**

In the render endpoint, read `params` from the POST body alongside `format`:

```js
const { format = 'html', limit, params = {} } = JSON.parse(body || '{}');
```

Pass `params` to `fetchReportData`:

```js
fetchReportData(reportId, { limit, authToken, params })
```

- [ ] **Step 2: Merge params into NEO body**

For NEO-sourced reports, merge user params into the default body:

```js
const neoBody = { ...contract.neo.body, ...params };
```

This way `currentDate`, `column1-4` etc. override defaults.

- [ ] **Step 3: Merge params into SQL placeholders**

For SQL-sourced reports, replace `__PARAM_NAME__` placeholders:

```js
for (const [key, value] of Object.entries(params)) {
  sql = sql.replace(new RegExp(`__${key.toUpperCase()}__`, 'g'), value.replace(/'/g, "''"));
}
// Remove unreplaced optional placeholders (params not provided)
sql = sql.replace(/AND\s+\w+\s*[><=]+\s*'__\w+__'/gi, '');
```

- [ ] **Step 4: Commit**

```
Feature ETP-3572: Merge user parameters into report data sources
```

---

### Task 4: Update SQL queries with date placeholders

**Files:**
- Modify: `artifacts/balance-sheet/report-contract.json`
- Modify: `artifacts/profit-loss/report-contract.json`

- [ ] **Step 1: Add date filter to Balance Sheet SQL**

Append to the WHERE clause:
```sql
AND ('__DATE_FROM__' = '' OR fa.dateacct >= '__DATE_FROM__'::date)
AND ('__DATE_TO__' = '' OR fa.dateacct <= '__DATE_TO__'::date)
```

Map parameter names: `dateFrom` → `DATE_FROM`, `dateTo` → `DATE_TO`

- [ ] **Step 2: Same for P&L SQL**

- [ ] **Step 3: Test with and without date filters**

- [ ] **Step 4: Commit**

```
Feature ETP-3572: Add date filter placeholders to BS and P&L SQL
```

---

### Task 5: Show active filters in report output

**Files:**
- Modify: `tools/app-shell/vite-plugins/report-api.js`

- [ ] **Step 1: Pass filter metadata to jsreport template**

Build `meta.filters` from user params:

```js
const activeFilters = Object.entries(params)
  .filter(([_, v]) => v && v !== '')
  .map(([k, v]) => {
    const paramDef = contract.parameters?.find(p => p.name === k);
    return { label: paramDef?.label?.en_US || k, value: v };
  });
```

Pass as `meta.filters` in the jsreport payload. Templates already render this via the `{{#if meta.filters.length}}` block.

- [ ] **Step 2: Commit**

```
Feature ETP-3572: Show active parameter filters in report header
```

---

### Task 6: Update skill documentation

**Files:**
- Modify: `~/.claude/skills/etendo-report/SKILL.md`

- [ ] **Step 1: Add parameter documentation to skill**

Document the `parameters` array format, supported types, placeholder syntax for SQL, and how NEO body merging works.

- [ ] **Step 2: Commit**

```
Feature ETP-3572: Document report parameters in /etendo:report skill
```
