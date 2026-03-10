# Aggregate Contracts — Design Document

**Date:** 2026-03-09
**Status:** Approved
**Decision maker:** Sebastian Barrozo

## Problem

Overview pages (Dashboard, Sales, Purchases, Inventory, Contacts) have hardcoded mock data inline in the component. They exist outside the contract system — no schema, no tests, no generated mockData. This leads to:

- Data/UI coupling (spaghetti risk)
- No validation that data shapes are consistent
- No test coverage for overview page data integrity
- Inconsistency with entity windows (which are fully contract-driven)

## Solution

Introduce **aggregate contracts** — a new contract type for overview/dashboard pages that aggregates data from multiple entities into a single view.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source | Declared in contract (not calculated from entities) | Simple, predictable, no cross-mock dependencies |
| UI generation | Manual — UI imports config + mockData from contract | Overview layouts vary too much for auto-generation |
| Contract location | `artifacts/{module}/aggregate-contract.json` | Same level as entity contracts, consistent naming |
| Section types | All supported from day 1 | Avoids incremental schema changes later |
| Test categories | 8 categories (section-presence, kpi-integrity, etc.) | Structural validation matching entity contract pattern |

## Aggregate Contract Schema

```json
{
  "version": "0.1.0",
  "type": "aggregate",
  "module": "<module-name>",
  "label": "<Display Label>",
  "icon": "<lucide-icon-name>",
  "route": "/<route>",

  "sections": [
    {
      "id": "<unique-id>",
      "type": "<section-type>",
      "title": "<Display Title>",
      "icon": "<lucide-icon-name>",
      // ... type-specific config (columns, fields, severities, etc.)
    }
  ],

  "layout": {
    "type": "grid",
    "areas": [
      { "section": "<section-id>", "span": "full|2/3|1/3" }
    ]
  },

  "actions": [
    { "label": "<text>", "route": "/<path>", "variant": "default|outline" }
  ],

  "mockData": {
    "<section-id>": { /* data matching section config */ }
  }
}
```

### Supported Section Types

| Type | Config Fields | mockData Shape |
|------|--------------|----------------|
| `kpi-header` | `kpis[]: { key, label, format, icon?, trend? }` | `{ [key]: value }` |
| `data-table` | `columns[], filters[]` | `[{ id, ...row }]` |
| `kanban` | `columns[]: { id, title, color }` | `[{ id, columnId, title, subtitle, value?, badges? }]` |
| `alerts-panel` | `severities[], fields: { label, current, threshold }` | `[{ name, current, minimum, severity }]` |
| `activity-feed` | `fields: { direction?, label, detail, location?, time }` | `[{ id, ...fields }]` |
| `chart` | `chartType: "line"|"bar", xAxis, yAxis` | `{ labels[], values[] }` |
| `quick-actions` | (none — defined in `actions[]`) | (none) |
| `chatter` | (none — uses Chatter component defaults) | `[{ id, author, text, timestamp, type }]` |

## Generator: `generate-aggregate.js`

Reads `aggregate-contract.json` -> produces 2 files in `artifacts/{module}/generated/`:

### `config.js`
Exports: `meta`, `kpisConfig`, `sections`, `layout`, `actions`
- Structured JS objects extracted from the contract
- Ready to import by React components

### `mockData.js`
Exports: one named export per section id
- KPIs as object `{ key: value }`
- Tables/kanban/alerts/feed as arrays
- Chart as `{ labels[], values[] }`

### CLI Usage
```bash
# Generate one module
node cli/src/generate-aggregate.js artifacts/inventory/aggregate-contract.json

# Generate all aggregates
node cli/src/generate-aggregate.js --all
```

## Contract Tests: `run-aggregate-tests.js`

| Category | Validates | Failure Example |
|----------|-----------|-----------------|
| `section-presence` | Each section has mockData | Section declared, mockData missing |
| `kpi-integrity` | KPIs have label, valid format, value exists | `format: "money"` (invalid) |
| `table-column-match` | Table columns exist as keys in mockData rows | Column `sku` but rows lack `sku` field |
| `kanban-column-match` | Card columnId exists in columns | `columnId: "pending"` but no such column |
| `alert-severity` | Alert severity in declared set | `severity: "critical"` not in severities |
| `link-validity` | Action routes exist in menu.json | Route `/invoices` not in menu |
| `layout-coverage` | All sections referenced in layout | Section declared but not in layout |
| `mockData-shape` | Arrays non-empty, objects have keys | `mockData.stockLevels: []` |

### CLI Usage
```bash
node cli/src/run-aggregate-tests.js artifacts/inventory/aggregate-contract.json
node cli/src/run-aggregate-tests.js --all
```

## UI Consumption Pattern

```jsx
import { meta, kpisConfig, sections, layout, actions } from '@generated/inventory/config';
import * as mockData from '@generated/inventory/mockData';

// KPIs: merge config + data
const kpis = kpisConfig.map(k => ({ ...k, value: mockData.kpis[k.key] }));

// DataTable: config provides columns/filters, mockData provides rows
<DataTable columns={sections.stockLevels.columns} data={mockData.stockLevels} />
```

**Rule: UI never defines data or column config inline. Everything comes from generated files.**

## Modules to Create

| Module | Route | Sections | Existing Page |
|--------|-------|----------|---------------|
| dashboard | /dashboard | kpis, chart, quick-actions, activity-feed, chatter | DashboardPage.jsx |
| sales | /sales | kpis, kanban, data-table | SalesPage.jsx |
| purchases | /purchases | kpis, kanban, data-table | PurchasesPage.jsx |
| inventory | /inventory | kpis, data-table, alerts-panel, activity-feed | InventoryPage.jsx |
| contacts | /contacts | kpis, kanban, data-table, chatter | ContactsPage.jsx |

## Migration Strategy

Each existing page is refactored to:
1. Remove all hardcoded data
2. Import `config.js` + `mockData.js` from generated files
3. Keep manual layout/UX (per design decision)

## Files Created/Modified

```
NEW  cli/src/generate-aggregate.js
NEW  cli/src/run-aggregate-tests.js
NEW  cli/test/run-aggregate-tests.test.js
NEW  artifacts/dashboard/aggregate-contract.json
NEW  artifacts/sales/aggregate-contract.json
NEW  artifacts/purchases/aggregate-contract.json
NEW  artifacts/inventory/aggregate-contract.json
NEW  artifacts/contacts/aggregate-contract.json
NEW  artifacts/{each}/generated/config.js        (generated)
NEW  artifacts/{each}/generated/mockData.js       (generated)
NEW  .claude/skills/aggregate-contracts/SKILL.md
MOD  tools/app-shell/src/pages/DashboardPage.jsx  (migrate to contract)
MOD  tools/app-shell/src/pages/SalesPage.jsx
MOD  tools/app-shell/src/pages/PurchasesPage.jsx
MOD  tools/app-shell/src/pages/InventoryPage.jsx
MOD  tools/app-shell/src/pages/ContactsPage.jsx
MOD  tools/app-shell/src/App.jsx                  (register mockData imports)
```
