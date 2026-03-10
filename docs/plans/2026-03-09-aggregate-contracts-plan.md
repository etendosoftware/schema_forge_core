# Aggregate Contracts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce aggregate contracts so overview pages (Dashboard, Sales, Purchases, Inventory, Contacts) are contract-driven — no hardcoded data in UI components.

**Architecture:** A new `aggregate-contract.json` schema declares sections (kpis, tables, kanban, alerts, etc.) with their config and mock data. A generator (`generate-aggregate.js`) produces `config.js` + `mockData.js`. A test runner (`run-aggregate-tests.js`) validates structural integrity. UI pages import generated files instead of hardcoding data.

**Tech Stack:** Node.js ESM (zero-dependency), `node:test` + `node:assert`, React (manual pages importing generated config/data)

---

### Task 1: Aggregate Test Runner — Core Validators

**Files:**
- Create: `cli/src/run-aggregate-tests.js`
- Test: `cli/test/run-aggregate-tests.test.js`

**Step 1: Write failing tests for section-presence and kpi-integrity**

Create `cli/test/run-aggregate-tests.test.js`:

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { runAggregateTests } from '../src/run-aggregate-tests.js';

const validContract = {
  version: '0.1.0',
  type: 'aggregate',
  module: 'test-module',
  label: 'Test Module',
  icon: 'Box',
  route: '/test',
  sections: [
    {
      id: 'kpis',
      type: 'kpi-header',
      kpis: [
        { key: 'total', label: 'Total', format: 'number' },
        { key: 'revenue', label: 'Revenue', format: 'currency', trend: true },
      ],
    },
    {
      id: 'items',
      type: 'data-table',
      title: 'Items',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'qty', label: 'Quantity', type: 'amount' },
      ],
      filters: ['name'],
    },
  ],
  layout: {
    type: 'grid',
    areas: [
      { section: 'kpis', span: 'full' },
      { section: 'items', span: '2/3' },
    ],
  },
  actions: [
    { label: 'View All', route: '/product', variant: 'default' },
  ],
  mockData: {
    kpis: { total: 100, revenue: 50000 },
    items: [
      { id: 1, name: 'Widget', qty: 42 },
    ],
  },
};

describe('runAggregateTests', () => {
  it('passes all checks on a valid contract', () => {
    const menuItems = ['product', 'sales-order'];
    const result = runAggregateTests(validContract, menuItems);
    assert.equal(result.failed, 0, `Failures: ${JSON.stringify(result.results.filter(r => !r.passed))}`);
    assert.ok(result.total > 0);
  });

  it('fails section-presence when mockData is missing for a section', () => {
    const bad = structuredClone(validContract);
    delete bad.mockData.items;
    const result = runAggregateTests(bad, ['product']);
    const fail = result.results.find(r => r.category === 'section-presence' && !r.passed);
    assert.ok(fail, 'Expected section-presence failure');
    assert.match(fail.reason, /items/);
  });

  it('fails kpi-integrity when format is invalid', () => {
    const bad = structuredClone(validContract);
    bad.sections[0].kpis[0].format = 'money';
    const result = runAggregateTests(bad, ['product']);
    const fail = result.results.find(r => r.category === 'kpi-integrity' && !r.passed);
    assert.ok(fail, 'Expected kpi-integrity failure');
    assert.match(fail.reason, /money/);
  });

  it('fails kpi-integrity when mockData value is missing for a kpi key', () => {
    const bad = structuredClone(validContract);
    delete bad.mockData.kpis.total;
    const result = runAggregateTests(bad, ['product']);
    const fail = result.results.find(r => r.category === 'kpi-integrity' && !r.passed);
    assert.ok(fail, 'Expected kpi-integrity failure for missing value');
    assert.match(fail.reason, /total/);
  });

  it('fails table-column-match when mockData row misses a column key', () => {
    const bad = structuredClone(validContract);
    bad.mockData.items = [{ id: 1, name: 'Widget' }]; // missing qty
    const result = runAggregateTests(bad, ['product']);
    const fail = result.results.find(r => r.category === 'table-column-match' && !r.passed);
    assert.ok(fail, 'Expected table-column-match failure');
    assert.match(fail.reason, /qty/);
  });

  it('fails link-validity when route is not in menu', () => {
    const result = runAggregateTests(validContract, ['sales-order']); // no 'product'
    const fail = result.results.find(r => r.category === 'link-validity' && !r.passed);
    assert.ok(fail, 'Expected link-validity failure');
    assert.match(fail.reason, /product/);
  });

  it('fails layout-coverage when a section is not in layout', () => {
    const bad = structuredClone(validContract);
    bad.sections.push({ id: 'orphan', type: 'alerts-panel', title: 'Orphan', severities: ['red'], fields: { label: 'x', current: 'y', threshold: 'z' } });
    bad.mockData.orphan = [{ x: 'a', y: 1, z: 2, severity: 'red' }];
    const result = runAggregateTests(bad, ['product']);
    const fail = result.results.find(r => r.category === 'layout-coverage' && !r.passed);
    assert.ok(fail, 'Expected layout-coverage failure');
    assert.match(fail.reason, /orphan/);
  });

  it('fails mockData-shape when array section is empty', () => {
    const bad = structuredClone(validContract);
    bad.mockData.items = [];
    const result = runAggregateTests(bad, ['product']);
    const fail = result.results.find(r => r.category === 'mockData-shape' && !r.passed);
    assert.ok(fail, 'Expected mockData-shape failure');
  });

  it('skips kanban-column-match when no kanban sections exist', () => {
    const result = runAggregateTests(validContract, ['product']);
    const kanbanTests = result.results.filter(r => r.category === 'kanban-column-match');
    assert.equal(kanbanTests.length, 0);
  });

  it('fails alert-severity when severity not in declared set', () => {
    const withAlerts = structuredClone(validContract);
    withAlerts.sections.push({
      id: 'alerts', type: 'alerts-panel', title: 'Alerts',
      severities: ['red', 'amber'],
      fields: { label: 'name', current: 'current', threshold: 'min' },
    });
    withAlerts.layout.areas.push({ section: 'alerts', span: '1/3' });
    withAlerts.mockData.alerts = [
      { name: 'Item A', current: 5, min: 10, severity: 'critical' },
    ];
    const result = runAggregateTests(withAlerts, ['product']);
    const fail = result.results.find(r => r.category === 'alert-severity' && !r.passed);
    assert.ok(fail, 'Expected alert-severity failure');
    assert.match(fail.reason, /critical/);
  });

  it('validates kanban-column-match correctly', () => {
    const withKanban = structuredClone(validContract);
    withKanban.sections.push({
      id: 'pipeline', type: 'kanban',
      columns: [{ id: 'open', title: 'Open', color: 'blue' }, { id: 'closed', title: 'Closed', color: 'green' }],
    });
    withKanban.layout.areas.push({ section: 'pipeline', span: 'full' });
    withKanban.mockData.pipeline = [
      { id: 'c1', columnId: 'open', title: 'Card 1', subtitle: 'Sub' },
      { id: 'c2', columnId: 'invalid', title: 'Card 2', subtitle: 'Sub' },
    ];
    const result = runAggregateTests(withKanban, ['product']);
    const fail = result.results.find(r => r.category === 'kanban-column-match' && !r.passed);
    assert.ok(fail, 'Expected kanban-column-match failure');
    assert.match(fail.reason, /invalid/);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/sebastianbarrozo/Documents/work/epic/schema-forge && node --test 'cli/test/run-aggregate-tests.test.js'`
Expected: FAIL — module `../src/run-aggregate-tests.js` not found.

**Step 3: Implement `run-aggregate-tests.js`**

Create `cli/src/run-aggregate-tests.js`:

```js
/**
 * Aggregate Contract Test Runner
 *
 * Validates structural integrity of aggregate-contract.json files.
 * Same pattern as run-contract-tests.js but for type: "aggregate".
 */

const VALID_FORMATS = ['currency', 'number', 'percent'];
const VALID_SPANS = ['full', '2/3', '1/3'];

/**
 * Check section-presence: every section in sections[] has a matching key in mockData.
 */
function checkSectionPresence(contract) {
  const results = [];
  for (const section of contract.sections) {
    // kpi-header mockData key matches section id
    // quick-actions and chatter with no mockData are optional
    if (section.type === 'quick-actions') continue;
    const hasData = contract.mockData?.[section.id] !== undefined;
    results.push({
      id: `sp-${section.id}`,
      category: 'section-presence',
      description: `Section '${section.id}' has mockData`,
      passed: hasData,
      ...(!hasData && { reason: `mockData.${section.id} is missing for section '${section.id}'` }),
    });
  }
  return results;
}

/**
 * Check kpi-integrity: each KPI has label, valid format, and value in mockData.
 */
function checkKpiIntegrity(contract) {
  const results = [];
  const kpiSections = contract.sections.filter(s => s.type === 'kpi-header');
  for (const section of kpiSections) {
    const data = contract.mockData?.[section.id];
    for (const kpi of section.kpis) {
      // Check format
      const validFormat = VALID_FORMATS.includes(kpi.format);
      if (!validFormat) {
        results.push({
          id: `ki-fmt-${kpi.key}`,
          category: 'kpi-integrity',
          description: `KPI '${kpi.key}' has valid format`,
          passed: false,
          reason: `KPI '${kpi.key}' has format '${kpi.format}', expected one of: ${VALID_FORMATS.join(', ')}`,
        });
        continue;
      }
      // Check label
      if (!kpi.label) {
        results.push({
          id: `ki-lbl-${kpi.key}`,
          category: 'kpi-integrity',
          description: `KPI '${kpi.key}' has label`,
          passed: false,
          reason: `KPI '${kpi.key}' has no label`,
        });
        continue;
      }
      // Check value in mockData
      const hasValue = data && data[kpi.key] !== undefined;
      results.push({
        id: `ki-val-${kpi.key}`,
        category: 'kpi-integrity',
        description: `KPI '${kpi.key}' has value in mockData`,
        passed: hasValue,
        ...(!hasValue && { reason: `mockData.${section.id}.${kpi.key} is missing for KPI '${kpi.key}'` }),
      });
    }
  }
  return results;
}

/**
 * Check table-column-match: every column key exists in mockData rows.
 */
function checkTableColumnMatch(contract) {
  const results = [];
  const tableSections = contract.sections.filter(s => s.type === 'data-table');
  for (const section of tableSections) {
    const rows = contract.mockData?.[section.id];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const firstRow = rows[0];
    for (const col of section.columns) {
      const hasKey = col.key in firstRow;
      results.push({
        id: `tcm-${section.id}-${col.key}`,
        category: 'table-column-match',
        description: `Column '${col.key}' exists in mockData rows for '${section.id}'`,
        passed: hasKey,
        ...(!hasKey && { reason: `Column '${col.key}' not found in mockData.${section.id} rows` }),
      });
    }
  }
  return results;
}

/**
 * Check kanban-column-match: every card's columnId exists in the kanban columns.
 */
function checkKanbanColumnMatch(contract) {
  const results = [];
  const kanbanSections = contract.sections.filter(s => s.type === 'kanban');
  for (const section of kanbanSections) {
    const cards = contract.mockData?.[section.id];
    if (!Array.isArray(cards)) continue;
    const validColumnIds = new Set(section.columns.map(c => c.id));
    for (const card of cards) {
      const valid = validColumnIds.has(card.columnId);
      if (!valid) {
        results.push({
          id: `kcm-${section.id}-${card.id}`,
          category: 'kanban-column-match',
          description: `Card '${card.id}' has valid columnId in '${section.id}'`,
          passed: false,
          reason: `Card '${card.id}' has columnId '${card.columnId}' which is not in columns: ${[...validColumnIds].join(', ')}`,
        });
      }
    }
  }
  return results;
}

/**
 * Check alert-severity: each alert's severity is in the section's declared severities.
 */
function checkAlertSeverity(contract) {
  const results = [];
  const alertSections = contract.sections.filter(s => s.type === 'alerts-panel');
  for (const section of alertSections) {
    const alerts = contract.mockData?.[section.id];
    if (!Array.isArray(alerts)) continue;
    const validSeverities = new Set(section.severities);
    for (const alert of alerts) {
      const valid = validSeverities.has(alert.severity);
      if (!valid) {
        results.push({
          id: `as-${section.id}-${alert[section.fields.label]}`,
          category: 'alert-severity',
          description: `Alert severity is valid in '${section.id}'`,
          passed: false,
          reason: `Severity '${alert.severity}' not in declared set: ${[...validSeverities].join(', ')}`,
        });
      }
    }
  }
  return results;
}

/**
 * Check link-validity: every route in actions[] corresponds to a window in menu.
 */
function checkLinkValidity(contract, menuItems) {
  const results = [];
  const menuSet = new Set(menuItems);
  for (const action of contract.actions ?? []) {
    const windowName = action.route.replace(/^\//, '');
    const valid = menuSet.has(windowName);
    results.push({
      id: `lv-${windowName}`,
      category: 'link-validity',
      description: `Action route '${action.route}' exists in menu`,
      passed: valid,
      ...(!valid && { reason: `Route '${action.route}' (window '${windowName}') not found in menu` }),
    });
  }
  return results;
}

/**
 * Check layout-coverage: every section in sections[] is referenced in layout.areas[].
 */
function checkLayoutCoverage(contract) {
  const results = [];
  const layoutSectionIds = new Set((contract.layout?.areas ?? []).map(a => a.section));
  for (const section of contract.sections) {
    const covered = layoutSectionIds.has(section.id);
    results.push({
      id: `lc-${section.id}`,
      category: 'layout-coverage',
      description: `Section '${section.id}' is referenced in layout`,
      passed: covered,
      ...(!covered && { reason: `Section '${section.id}' is not referenced in layout.areas` }),
    });
  }
  return results;
}

/**
 * Check mockData-shape: arrays are non-empty, objects have at least one key.
 */
function checkMockDataShape(contract) {
  const results = [];
  for (const section of contract.sections) {
    if (section.type === 'quick-actions') continue;
    const data = contract.mockData?.[section.id];
    if (data === undefined) continue; // section-presence catches this
    let valid;
    if (Array.isArray(data)) {
      valid = data.length > 0;
    } else if (typeof data === 'object' && data !== null) {
      valid = Object.keys(data).length > 0;
    } else {
      valid = false;
    }
    results.push({
      id: `ms-${section.id}`,
      category: 'mockData-shape',
      description: `mockData.${section.id} is non-empty`,
      passed: valid,
      ...(!valid && { reason: `mockData.${section.id} is empty or invalid` }),
    });
  }
  return results;
}

/**
 * Run all aggregate contract tests and return a summary.
 *
 * @param {object} contract - The aggregate-contract.json content
 * @param {string[]} menuItems - Array of window names from menu.json
 * @returns {{total: number, passed: number, failed: number, results: Array}}
 */
export function runAggregateTests(contract, menuItems = []) {
  const results = [
    ...checkSectionPresence(contract),
    ...checkKpiIntegrity(contract),
    ...checkTableColumnMatch(contract),
    ...checkKanbanColumnMatch(contract),
    ...checkAlertSeverity(contract),
    ...checkLinkValidity(contract, menuItems),
    ...checkLayoutCoverage(contract),
    ...checkMockDataShape(contract),
  ];

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { total: passed + failed, passed, failed, results };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/sebastianbarrozo/Documents/work/epic/schema-forge && node --test 'cli/test/run-aggregate-tests.test.js'`
Expected: ALL PASS (11 tests)

**Step 5: Commit**

```bash
git add cli/src/run-aggregate-tests.js cli/test/run-aggregate-tests.test.js
git commit -m "feat: add aggregate contract test runner with 8 validation categories"
```

---

### Task 2: Aggregate Generator — `generate-aggregate.js`

**Files:**
- Create: `cli/src/generate-aggregate.js`
- Test: `cli/test/generate-aggregate.test.js`

**Step 1: Write failing tests**

Create `cli/test/generate-aggregate.test.js`:

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateAggregateFiles } from '../src/generate-aggregate.js';

const contract = {
  version: '0.1.0',
  type: 'aggregate',
  module: 'inventory',
  label: 'Inventory',
  icon: 'Package',
  route: '/inventory',
  sections: [
    {
      id: 'kpis',
      type: 'kpi-header',
      kpis: [
        { key: 'totalSkus', label: 'Total SKUs', format: 'number', icon: 'Package' },
        { key: 'stockValue', label: 'Stock Value', format: 'currency', trend: true },
      ],
    },
    {
      id: 'stockLevels',
      type: 'data-table',
      title: 'Stock Levels',
      icon: 'Search',
      columns: [
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Product Name' },
      ],
      filters: ['name'],
    },
  ],
  layout: {
    type: 'grid',
    areas: [
      { section: 'kpis', span: 'full' },
      { section: 'stockLevels', span: '2/3' },
    ],
  },
  actions: [
    { label: 'Physical Inventory', route: '/physical-inventory', variant: 'outline' },
  ],
  mockData: {
    kpis: { totalSkus: 248, stockValue: 1245000 },
    stockLevels: [
      { id: 1, sku: 'PRD-001', name: 'Steel Bolts M8' },
    ],
  },
};

describe('generateAggregateFiles', () => {
  it('returns config.js and mockData.js', () => {
    const files = generateAggregateFiles(contract);
    assert.ok(files['config.js'], 'Missing config.js');
    assert.ok(files['mockData.js'], 'Missing mockData.js');
    assert.equal(Object.keys(files).length, 2);
  });

  it('config.js exports meta with module, label, icon, route', () => {
    const { 'config.js': code } = generateAggregateFiles(contract);
    assert.match(code, /export const meta/);
    assert.match(code, /"inventory"/);
    assert.match(code, /"Inventory"/);
    assert.match(code, /"Package"/);
    assert.match(code, /\/inventory/);
  });

  it('config.js exports kpisConfig array', () => {
    const { 'config.js': code } = generateAggregateFiles(contract);
    assert.match(code, /export const kpisConfig/);
    assert.match(code, /"totalSkus"/);
    assert.match(code, /"stockValue"/);
  });

  it('config.js exports sections object keyed by section id', () => {
    const { 'config.js': code } = generateAggregateFiles(contract);
    assert.match(code, /export const sections/);
    assert.match(code, /"stockLevels"/);
    assert.match(code, /"data-table"/);
  });

  it('config.js exports layout array', () => {
    const { 'config.js': code } = generateAggregateFiles(contract);
    assert.match(code, /export const layout/);
  });

  it('config.js exports actions array', () => {
    const { 'config.js': code } = generateAggregateFiles(contract);
    assert.match(code, /export const actions/);
    assert.match(code, /"Physical Inventory"/);
  });

  it('mockData.js exports one named export per section', () => {
    const { 'mockData.js': code } = generateAggregateFiles(contract);
    assert.match(code, /export const kpis/);
    assert.match(code, /export const stockLevels/);
  });

  it('mockData.js contains actual data values', () => {
    const { 'mockData.js': code } = generateAggregateFiles(contract);
    assert.match(code, /248/);
    assert.match(code, /1245000/);
    assert.match(code, /PRD-001/);
  });

  it('generated files have DO NOT EDIT header', () => {
    const files = generateAggregateFiles(contract);
    assert.match(files['config.js'], /DO NOT EDIT/);
    assert.match(files['mockData.js'], /DO NOT EDIT/);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `node --test 'cli/test/generate-aggregate.test.js'`
Expected: FAIL — module not found.

**Step 3: Implement `generate-aggregate.js`**

Create `cli/src/generate-aggregate.js`:

```js
/**
 * Aggregate Contract Generator
 *
 * Reads an aggregate-contract.json and produces:
 * - config.js: structured exports (meta, kpisConfig, sections, layout, actions)
 * - mockData.js: named exports per section with mock data
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Generate config.js and mockData.js from an aggregate contract.
 *
 * @param {object} contract - The aggregate-contract.json content
 * @returns {{ 'config.js': string, 'mockData.js': string }}
 */
export function generateAggregateFiles(contract) {
  const configCode = generateConfig(contract);
  const mockDataCode = generateMockData(contract);
  return { 'config.js': configCode, 'mockData.js': mockDataCode };
}

function generateConfig(contract) {
  const lines = [
    '// Auto-generated from aggregate-contract.json — DO NOT EDIT',
    '',
  ];

  // meta
  const meta = {
    module: contract.module,
    label: contract.label,
    icon: contract.icon,
    route: contract.route,
  };
  lines.push(`export const meta = ${JSON.stringify(meta, null, 2)};`);
  lines.push('');

  // kpisConfig
  const kpiSection = contract.sections.find(s => s.type === 'kpi-header');
  const kpisConfig = kpiSection ? kpiSection.kpis : [];
  lines.push(`export const kpisConfig = ${JSON.stringify(kpisConfig, null, 2)};`);
  lines.push('');

  // sections (keyed by id, excludes kpi-header)
  const sectionsObj = {};
  for (const section of contract.sections) {
    if (section.type === 'kpi-header') continue;
    const { id, ...config } = section;
    sectionsObj[id] = config;
  }
  lines.push(`export const sections = ${JSON.stringify(sectionsObj, null, 2)};`);
  lines.push('');

  // layout
  lines.push(`export const layout = ${JSON.stringify(contract.layout?.areas ?? [], null, 2)};`);
  lines.push('');

  // actions
  lines.push(`export const actions = ${JSON.stringify(contract.actions ?? [], null, 2)};`);
  lines.push('');

  return lines.join('\n');
}

function generateMockData(contract) {
  const lines = [
    '// Auto-generated from aggregate-contract.json — DO NOT EDIT',
    '',
  ];

  for (const section of contract.sections) {
    if (section.type === 'quick-actions') continue;
    const data = contract.mockData?.[section.id];
    if (data === undefined) continue;
    lines.push(`export const ${section.id} = ${JSON.stringify(data, null, 2)};`);
    lines.push('');
  }

  return lines.join('\n');
}

// --- CLI entry point ---

const args = process.argv.slice(2);

if (args.length > 0 && !args[0].startsWith('-')) {
  // Single file mode: node cli/src/generate-aggregate.js artifacts/inventory/aggregate-contract.json
  const contractPath = resolve(args[0]);
  const contract = JSON.parse(readFileSync(contractPath, 'utf-8'));
  const files = generateAggregateFiles(contract);
  const outDir = resolve(dirname(contractPath), 'generated');
  mkdirSync(outDir, { recursive: true });
  for (const [filename, code] of Object.entries(files)) {
    writeFileSync(resolve(outDir, filename), code, 'utf-8');
    console.log(`  wrote ${outDir}/${filename}`);
  }
} else if (args.includes('--all')) {
  // All mode: find all aggregate-contract.json files
  const artifactsDir = resolve('artifacts');
  if (existsSync(artifactsDir)) {
    for (const dir of readdirSync(artifactsDir)) {
      const contractPath = resolve(artifactsDir, dir, 'aggregate-contract.json');
      if (existsSync(contractPath)) {
        console.log(`Generating: ${dir}`);
        const contract = JSON.parse(readFileSync(contractPath, 'utf-8'));
        const files = generateAggregateFiles(contract);
        const outDir = resolve(artifactsDir, dir, 'generated');
        mkdirSync(outDir, { recursive: true });
        for (const [filename, code] of Object.entries(files)) {
          writeFileSync(resolve(outDir, filename), code, 'utf-8');
          console.log(`  wrote ${outDir}/${filename}`);
        }
      }
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `node --test 'cli/test/generate-aggregate.test.js'`
Expected: ALL PASS (9 tests)

**Step 5: Commit**

```bash
git add cli/src/generate-aggregate.js cli/test/generate-aggregate.test.js
git commit -m "feat: add aggregate contract generator producing config.js and mockData.js"
```

---

### Task 3: Inventory Aggregate Contract

**Files:**
- Create: `artifacts/inventory/aggregate-contract.json`
- Generate: `artifacts/inventory/generated/config.js`
- Generate: `artifacts/inventory/generated/mockData.js`

**Step 1: Write the aggregate contract**

Create `artifacts/inventory/aggregate-contract.json` with the full inventory data (KPIs, stock levels table with 12 rows, 5 low stock alerts, 6 recent movements). Use the data currently hardcoded in `InventoryPage.jsx` — move it into the contract.

Reference: `tools/app-shell/src/pages/InventoryPage.jsx` (in worktree) has the exact data to extract.

The contract should follow the schema from the design doc:
- 4 sections: kpis (kpi-header), stockLevels (data-table), lowStock (alerts-panel), recentMovements (activity-feed)
- Layout: kpis full, stockLevels 2/3, lowStock 1/3, recentMovements 1/3
- Actions: Physical Inventory (outline), Goods Movements (default)
- All mock data from current InventoryPage.jsx

**Step 2: Run the generator**

Run: `node cli/src/generate-aggregate.js artifacts/inventory/aggregate-contract.json`
Expected: `wrote artifacts/inventory/generated/config.js` and `mockData.js`

**Step 3: Run aggregate tests**

Run: `node -e "import { runAggregateTests } from './cli/src/run-aggregate-tests.js'; import { readFileSync } from 'node:fs'; const c = JSON.parse(readFileSync('artifacts/inventory/aggregate-contract.json','utf-8')); const menu = JSON.parse(readFileSync('tools/app-shell/src/menu.json','utf-8')).menu.flatMap(g => g.items.map(i => i.name)); const r = runAggregateTests(c, menu); console.log(JSON.stringify(r.failed === 0 ? {status:'PASS',total:r.total} : r, null, 2));"`
Expected: `{ "status": "PASS", "total": N }`

**Step 4: Commit**

```bash
git add artifacts/inventory/aggregate-contract.json artifacts/inventory/generated/
git commit -m "feat: add inventory aggregate contract with stock levels, alerts, and movements"
```

---

### Task 4: Sales Aggregate Contract

**Files:**
- Create: `artifacts/sales/aggregate-contract.json`
- Generate: `artifacts/sales/generated/config.js`
- Generate: `artifacts/sales/generated/mockData.js`

**Step 1: Write the aggregate contract**

Extract data from `tools/app-shell/src/pages/SalesPage.jsx`:
- 3 sections: kpis (kpi-header), pipeline (kanban with 5 columns + 9 cards), quotations (data-table reusing same cards data as rows)
- Actions: + New Quotation → /sales-quotation

**Step 2: Generate and test** (same pattern as Task 3)

**Step 3: Commit**

```bash
git add artifacts/sales/aggregate-contract.json artifacts/sales/generated/
git commit -m "feat: add sales aggregate contract with pipeline kanban and quotation list"
```

---

### Task 5: Purchases Aggregate Contract

**Files:**
- Create: `artifacts/purchases/aggregate-contract.json`
- Generate: `artifacts/purchases/generated/config.js`
- Generate: `artifacts/purchases/generated/mockData.js`

**Step 1: Write the aggregate contract**

Extract data from `tools/app-shell/src/pages/PurchasesPage.jsx`:
- 3 sections: kpis (kpi-header), pipeline (kanban with 5 columns + 8 cards), orders (data-table)
- Actions: + New PO → /purchase-order

**Step 2: Generate and test** (same pattern)

**Step 3: Commit**

```bash
git add artifacts/purchases/aggregate-contract.json artifacts/purchases/generated/
git commit -m "feat: add purchases aggregate contract with PO pipeline and order list"
```

---

### Task 6: Contacts Aggregate Contract

**Files:**
- Create: `artifacts/contacts/aggregate-contract.json`
- Generate: `artifacts/contacts/generated/config.js`
- Generate: `artifacts/contacts/generated/mockData.js`

**Step 1: Write the aggregate contract**

Extract data from `tools/app-shell/src/pages/ContactsPage.jsx`:
- 4 sections: kpis (kpi-header), directory (kanban with 4 columns + 10 contacts), list (data-table), notes (chatter)
- Extra data: email/phone lookup maps as part of mockData
- Actions: + New Contact → /business-partner

**Step 2: Generate and test**

**Step 3: Commit**

```bash
git add artifacts/contacts/aggregate-contract.json artifacts/contacts/generated/
git commit -m "feat: add contacts aggregate contract with directory kanban and chatter"
```

---

### Task 7: Dashboard Aggregate Contract

**Files:**
- Create: `artifacts/dashboard/aggregate-contract.json`
- Generate: `artifacts/dashboard/generated/config.js`
- Generate: `artifacts/dashboard/generated/mockData.js`

**Step 1: Write the aggregate contract**

Extract data from `tools/app-shell/src/pages/DashboardPage.jsx`:
- 5 sections: kpis (kpi-header), revenueTrend (chart), quickActions (quick-actions), pendingTasks (activity-feed), recentMessages (chatter)
- Chart data: 12 months labels + values
- Actions: + Invoice, + Order, + Contact, + Product (as quickActions section, not top-level actions)

**Step 2: Generate and test**

**Step 3: Commit**

```bash
git add artifacts/dashboard/aggregate-contract.json artifacts/dashboard/generated/
git commit -m "feat: add dashboard aggregate contract with revenue chart, tasks, and chatter"
```

---

### Task 8: Migrate InventoryPage to Contract

**Files:**
- Modify: `tools/app-shell/src/pages/InventoryPage.jsx`
- Modify: `tools/app-shell/src/App.jsx` (add mockData import for inventory aggregate)

**Step 1: Refactor InventoryPage.jsx**

Replace all hardcoded data constants (KPIS, COLUMNS, FILTERS, INVENTORY_DATA, LOW_STOCK_ALERTS, RECENT_MOVEMENTS) with imports from generated files:

```jsx
import { kpisConfig, sections, actions } from '@generated/inventory/config';
import * as mockData from '@generated/inventory/mockData';

// Merge KPI config + data
const KPIS = kpisConfig.map(k => ({ ...k, value: mockData.kpis[k.key] }));
```

Remove all inline data arrays. Keep the layout/JSX structure manual.

**Step 2: Verify build**

Run: `cd tools/app-shell && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add tools/app-shell/src/pages/InventoryPage.jsx
git commit -m "refactor: migrate InventoryPage to aggregate contract — no inline data"
```

---

### Task 9: Migrate SalesPage to Contract

**Files:**
- Modify: `tools/app-shell/src/pages/SalesPage.jsx`

**Step 1: Refactor** — same pattern as Task 8. Replace KPIS, COLUMNS, INITIAL_CARDS, STATUS_LABEL, STATUS_VARIANT with imports from `@generated/sales/config` and `@generated/sales/mockData`.

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add tools/app-shell/src/pages/SalesPage.jsx
git commit -m "refactor: migrate SalesPage to aggregate contract"
```

---

### Task 10: Migrate PurchasesPage to Contract

**Files:**
- Modify: `tools/app-shell/src/pages/PurchasesPage.jsx`

**Step 1: Refactor** — same pattern. Import from `@generated/purchases/config` + `mockData`.

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add tools/app-shell/src/pages/PurchasesPage.jsx
git commit -m "refactor: migrate PurchasesPage to aggregate contract"
```

---

### Task 11: Migrate ContactsPage to Contract

**Files:**
- Modify: `tools/app-shell/src/pages/ContactsPage.jsx`

**Step 1: Refactor** — Import from `@generated/contacts/config` + `mockData`. The detail panel, email/phone maps, chatter messages all come from mockData.

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add tools/app-shell/src/pages/ContactsPage.jsx
git commit -m "refactor: migrate ContactsPage to aggregate contract"
```

---

### Task 12: Migrate DashboardPage to Contract

**Files:**
- Modify: `tools/app-shell/src/pages/DashboardPage.jsx`

**Step 1: Refactor** — Import from `@generated/dashboard/config` + `mockData`. KPIs, chart data (labels/values), quick actions config, pending tasks, chatter messages all from contract.

**Step 2: Verify build**

**Step 3: Commit**

```bash
git add tools/app-shell/src/pages/DashboardPage.jsx
git commit -m "refactor: migrate DashboardPage to aggregate contract"
```

---

### Task 13: Register Aggregate MockData in App.jsx

**Files:**
- Modify: `tools/app-shell/src/App.jsx`
- Modify: `tools/app-shell/vite.config.js` (if `@generated` alias not already configured)

**Step 1: Add `@generated` alias to vite.config.js** (if not present)

Check if `@generated` alias exists. If not, add:
```js
resolve: {
  alias: {
    '@generated': resolve(__dirname, '../../artifacts'),
  }
}
```

**Step 2: Add aggregate mockData imports to `loadAllMockData()`**

In `App.jsx`, add to the `loadAllMockData()` function:
```js
import('@generated/inventory/generated/mockData.js'),
import('@generated/sales/generated/mockData.js'),
import('@generated/purchases/generated/mockData.js'),
import('@generated/contacts/generated/mockData.js'),
import('@generated/dashboard/generated/mockData.js'),
```

**Step 3: Verify full build**

Run: `cd tools/app-shell && npm run build`

**Step 4: Commit**

```bash
git add tools/app-shell/src/App.jsx tools/app-shell/vite.config.js
git commit -m "feat: register aggregate mockData in app-shell loadAllMockData"
```

---

### Task 14: Run All Tests

**Step 1: Run existing test suite**

Run: `cd /Users/sebastianbarrozo/Documents/work/epic/schema-forge && node --test 'cli/test/*.test.js'`
Expected: All existing tests + new aggregate tests pass. Zero regressions.

**Step 2: Run aggregate tests on all 5 contracts**

Run: `node -e "import { runAggregateTests } from './cli/src/run-aggregate-tests.js'; import { readFileSync, readdirSync } from 'node:fs'; const menu = JSON.parse(readFileSync('tools/app-shell/src/menu.json','utf-8')).menu.flatMap(g => g.items.map(i => i.name)); for (const mod of ['dashboard','sales','purchases','inventory','contacts']) { const c = JSON.parse(readFileSync('artifacts/'+mod+'/aggregate-contract.json','utf-8')); const r = runAggregateTests(c, menu); console.log(mod + ': ' + (r.failed === 0 ? 'PASS' : 'FAIL') + ' (' + r.total + ' tests)'); }"`
Expected: All 5 modules PASS.

**Step 3: Verify app build**

Run: `cd tools/app-shell && npm run build`
Expected: Clean build, no errors.

---

### Task 15: Create Aggregate Contracts Skill

**Files:**
- Create: `.claude/skills/aggregate-contracts/SKILL.md`

**Step 1: Write the skill**

Create `.claude/skills/aggregate-contracts/SKILL.md` documenting:
- What aggregate contracts are and when to use them (vs entity contracts)
- The aggregate-contract.json schema (section types, layout, actions, mockData)
- CLI commands: generate-aggregate.js (single + --all), run-aggregate-tests.js
- How UI pages consume config.js + mockData.js
- The 8 test categories
- Common mistakes (forgetting layout coverage, invalid severity, missing mockData keys)

**Step 2: Commit**

```bash
git add .claude/skills/aggregate-contracts/SKILL.md
git commit -m "feat: add aggregate contracts skill for agent reference"
```

---

## Execution Dependencies

```
Task 1 (test runner) ──┐
                       ├── Tasks 3-7 (contracts, parallel)
Task 2 (generator)  ───┘
                            │
                            ▼
                       Tasks 8-12 (migrations, parallel)
                            │
                            ▼
                       Task 13 (App.jsx wiring)
                            │
                            ▼
                       Task 14 (full test run)
                            │
                            ▼
                       Task 15 (skill)
```

Tasks 1-2 are sequential (generator depends on test runner pattern).
Tasks 3-7 are parallelizable (independent contracts).
Tasks 8-12 are parallelizable (independent page migrations).
Tasks 13-15 are sequential.
