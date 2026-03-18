# jsreport Phase 1: Infrastructure + First Listing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete jsreport pipeline working end-to-end — Docker setup, base templates, CLI tools (`sf-report-contract`, `sf-report-preview`, `sf-report-serve`), Business Partner listing report with mock data, all with tests.

**Architecture:** Three new CLI tools follow existing Schema Forge patterns (ESM, pure function exports, `node:test`). jsreport runs in Docker locally. Report contracts bridge `schema-curated.json` and Handlebars templates. Templates live in `templates/reports/` (base) and `artifacts/{name}/reports/` (per-window). No backend changes in Phase 1.

**Tech Stack:** Node.js 22 (ESM), Docker + docker-compose, jsreport (official image), Handlebars, HTML+CSS.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `docker/jsreport/Dockerfile` | Create | jsreport image with custom config |
| `docker/jsreport/docker-compose.yml` | Create | Dev local: jsreport + template volumes |
| `docker/jsreport/jsreport.config.json` | Create | Engine/recipe/extension config |
| `templates/reports/base-listing.hbs` | Create | Dynamic listing template (iterates columns from contract) |
| `templates/reports/base.css` | Create | Shared report styles (Etendo brand) |
| `templates/reports/helpers/common.js` | Create | Shared Handlebars helpers (formatDate, formatCurrency, i18n) |
| `cli/src/report-contract.js` | Create | Generate/validate report-contract.json from schema-curated.json |
| `cli/src/report-serve.js` | Create | Run jsreport locally in Docker |
| `cli/src/report-preview.js` | Create | Render template with mock data via local jsreport |
| `cli/test/report-contract.test.js` | Create | Tests for report contract generation + validation |
| `cli/test/report-serve.test.js` | Create | Tests for Docker management logic |
| `cli/test/report-preview.test.js` | Create | Tests for preview payload assembly |
| `artifacts/business-partner/report-contract.json` | Create | BP listing report contract |
| `artifacts/business-partner/reports/listing/template.hbs` | Create | BP-specific template (extends base) |
| `artifacts/business-partner/reports/listing/style.css` | Create | BP-specific styles |
| `artifacts/business-partner/reports/listing/mockData.js` | Create | Mock data for preview |
| `artifacts/business-partner/reports/listing/helpers.js` | Create | Report-specific helpers |
| `cli/package.json` | Modify | Add 3 new bin entries |

---

## Chunk 1: Docker jsreport Setup

### Task 1: Docker configuration files

**Files:**
- Create: `docker/jsreport/Dockerfile`
- Create: `docker/jsreport/docker-compose.yml`
- Create: `docker/jsreport/jsreport.config.json`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM jsreport/jsreport:4.7.0

COPY jsreport.config.json /app/jsreport.config.json

EXPOSE 5488

CMD ["node", "server.js"]
```

- [ ] **Step 2: Create jsreport.config.json**

```json
{
  "httpPort": 5488,
  "store": {
    "provider": "fs"
  },
  "extensions": {
    "authentication": {
      "enabled": false
    },
    "chrome-pdf": {
      "launchOptions": {
        "args": ["--no-sandbox", "--disable-dev-shm-usage"]
      },
      "timeout": 30000
    },
    "handlebars": {
      "enabled": true
    },
    "assets": {
      "searchRecursive": true,
      "allowedFiles": "**/*.*"
    }
  },
  "templatingEngines": {
    "timeout": 30000,
    "strategy": "in-process"
  },
  "logger": {
    "console": {
      "transport": "console",
      "level": "info"
    }
  }
}
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
version: "3.8"

services:
  jsreport:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${JSREPORT_PORT:-5488}:5488"
    volumes:
      - ../../templates/reports:/app/data/templates/base:ro
      - ../../artifacts:/app/data/artifacts:ro
    environment:
      - NODE_ENV=development
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5488/api/ping"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped
```

- [ ] **Step 4: Create .dockerignore**

Create `docker/jsreport/.dockerignore`:

```
node_modules
.git
```

- [ ] **Step 5: Verify Docker build works**

Run: `cd docker/jsreport && docker compose build`
Expected: Image builds successfully.

- [ ] **Step 6: Commit**

```bash
git add docker/jsreport/
git commit -m "Feature ETP-3572: Add Docker jsreport configuration"
```

---

## Chunk 2: Base Report Templates

### Task 2: Shared Handlebars helpers

**Files:**
- Create: `templates/reports/helpers/common.js`

- [ ] **Step 1: Write tests for helpers**

Create `cli/test/report-helpers.test.js`:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatDate, formatCurrency, formatBoolean, truncate } from '../../templates/reports/helpers/common.js';

describe('report helpers', () => {
  describe('formatDate', () => {
    it('formats ISO date to locale string', () => {
      assert.equal(formatDate('2026-03-18', 'en_US'), '03/18/2026');
    });

    it('formats ISO date for es_ES', () => {
      assert.equal(formatDate('2026-03-18', 'es_ES'), '18/03/2026');
    });

    it('returns empty string for null', () => {
      assert.equal(formatDate(null, 'en_US'), '');
    });

    it('returns empty string for undefined', () => {
      assert.equal(formatDate(undefined, 'en_US'), '');
    });
  });

  describe('formatCurrency', () => {
    it('formats number with 2 decimals', () => {
      assert.equal(formatCurrency(1234.5, 'en_US'), '1,234.50');
    });

    it('formats for es_ES locale', () => {
      assert.equal(formatCurrency(1234.5, 'es_ES'), '1.234,50');
    });

    it('returns empty string for null', () => {
      assert.equal(formatCurrency(null, 'en_US'), '');
    });
  });

  describe('formatBoolean', () => {
    it('returns Yes/No for en_US', () => {
      assert.equal(formatBoolean(true, 'en_US'), 'Yes');
      assert.equal(formatBoolean(false, 'en_US'), 'No');
    });

    it('returns Si/No for es_ES', () => {
      assert.equal(formatBoolean(true, 'es_ES'), 'Si');
      assert.equal(formatBoolean(false, 'es_ES'), 'No');
    });
  });

  describe('truncate', () => {
    it('truncates long strings', () => {
      assert.equal(truncate('Hello World', 5), 'Hello...');
    });

    it('does not truncate short strings', () => {
      assert.equal(truncate('Hi', 10), 'Hi');
    });

    it('returns empty string for null', () => {
      assert.equal(truncate(null, 10), '');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/report-helpers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `templates/reports/helpers/common.js`:

```javascript
const LOCALE_MAP = {
  en_US: 'en-US',
  es_ES: 'es-ES',
};

function toIntlLocale(locale) {
  return LOCALE_MAP[locale] ?? locale?.replace('_', '-') ?? 'en-US';
}

export function formatDate(value, locale) {
  if (value == null || value === '') return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const intlLocale = toIntlLocale(locale);
  return new Intl.DateTimeFormat(intlLocale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function formatCurrency(value, locale) {
  if (value == null) return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  const intlLocale = toIntlLocale(locale);
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatBoolean(value, locale) {
  if (locale?.startsWith('es')) {
    return value ? 'Si' : 'No';
  }
  return value ? 'Yes' : 'No';
}

export function truncate(value, maxLength) {
  if (value == null) return '';
  const str = String(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Register all helpers with a Handlebars instance.
 * Used by jsreport at template load time.
 */
export function registerAll(handlebars) {
  handlebars.registerHelper('formatDate', (val, opts) => formatDate(val, opts.data?.root?.meta?.locale));
  handlebars.registerHelper('formatCurrency', (val, opts) => formatCurrency(val, opts.data?.root?.meta?.locale));
  handlebars.registerHelper('formatBoolean', (val, opts) => formatBoolean(val, opts.data?.root?.meta?.locale));
  handlebars.registerHelper('truncate', (val, max) => truncate(val, max));
  handlebars.registerHelper('eq', (a, b) => a === b);
  handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
      case '===': return v1 === v2 ? options.fn(this) : options.inverse(this);
      case '!==': return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case '>': return v1 > v2 ? options.fn(this) : options.inverse(this);
      case '<': return v1 < v2 ? options.fn(this) : options.inverse(this);
      default: return options.inverse(this);
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/report-helpers.test.js`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/reports/helpers/common.js cli/test/report-helpers.test.js
git commit -m "Feature ETP-3572: Add shared report Handlebars helpers with tests"
```

### Task 3: Base listing template + CSS

**Files:**
- Create: `templates/reports/base-listing.hbs`
- Create: `templates/reports/base.css`

- [ ] **Step 1: Create base.css**

```css
/* Schema Forge Report Styles — Etendo Brand */

:root {
  --color-primary: #1a1a2e;
  --color-secondary: #16213e;
  --color-accent: #0f3460;
  --color-border: #e2e8f0;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-bg-header: #f8fafc;
  --color-bg-stripe: #f1f5f9;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  font-size: 10pt;
  color: var(--color-text);
  line-height: 1.4;
}

.report-container {
  padding: 20mm 15mm;
}

/* Header */
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8mm;
  padding-bottom: 4mm;
  border-bottom: 2px solid var(--color-primary);
}

.report-title {
  font-size: 16pt;
  font-weight: 700;
  color: var(--color-primary);
}

.report-meta {
  text-align: right;
  font-size: 8pt;
  color: var(--color-text-muted);
}

/* Filters applied */
.report-filters {
  margin-bottom: 6mm;
  padding: 3mm 4mm;
  background: var(--color-bg-header);
  border-radius: 2mm;
  font-size: 8pt;
}

.report-filters span {
  margin-right: 4mm;
  color: var(--color-text-muted);
}

.report-filters strong {
  color: var(--color-text);
}

/* Data table */
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
}

.report-table thead th {
  background: var(--color-bg-header);
  border-bottom: 2px solid var(--color-border);
  padding: 2mm 3mm;
  text-align: left;
  font-weight: 600;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.report-table tbody td {
  padding: 1.5mm 3mm;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.report-table tbody tr:nth-child(even) {
  background: var(--color-bg-stripe);
}

/* Type-specific cell styles */
.cell-number, .cell-amount {
  text-align: right;
  font-family: var(--font-mono);
  font-size: 8.5pt;
}

.cell-boolean {
  text-align: center;
}

.cell-boolean .yes {
  color: #16a34a;
  font-weight: 600;
}

.cell-boolean .no {
  color: var(--color-text-muted);
}

/* Footer */
.report-footer {
  margin-top: 6mm;
  padding-top: 3mm;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  font-size: 8pt;
  color: var(--color-text-muted);
}

.report-summary {
  font-weight: 600;
  color: var(--color-text);
}

/* Truncation indicator */
.report-truncated {
  margin-top: 3mm;
  padding: 2mm 4mm;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 2mm;
  font-size: 8pt;
  color: #92400e;
}

/* Print */
@media print {
  .report-container {
    padding: 0;
  }
}

@page {
  margin: 15mm;
  size: A4 portrait;
}
```

- [ ] **Step 2: Create base-listing.hbs**

```handlebars
<!DOCTYPE html>
<html lang="{{meta.locale}}">
<head>
  <meta charset="UTF-8">
  <style>{{{css}}}</style>
</head>
<body>
  <div class="report-container">

    {{!-- Header --}}
    <div class="report-header">
      <div>
        <div class="report-title">{{meta.title}}</div>
      </div>
      <div class="report-meta">
        <div>{{formatDate meta.generatedAt}}</div>
      </div>
    </div>

    {{!-- Applied filters --}}
    {{#if meta.filters.length}}
    <div class="report-filters">
      {{#each meta.filters}}
        <span><strong>{{this.label}}:</strong> {{this.value}}</span>
      {{/each}}
    </div>
    {{/if}}

    {{!-- Data table --}}
    <table class="report-table">
      <thead>
        <tr>
          {{#each columns}}
            <th style="width: {{this.width}}">{{this.label}}</th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each rows}}
          <tr>
            {{#each ../columns}}
              {{#ifCond this.type '===' 'boolean'}}
                <td class="cell-boolean">
                  {{#if (lookup ../this this.key)}}
                    <span class="yes">{{formatBoolean true}}</span>
                  {{else}}
                    <span class="no">{{formatBoolean false}}</span>
                  {{/if}}
                </td>
              {{else}}
                {{#ifCond this.type '===' 'amount'}}
                  <td class="cell-amount">{{formatCurrency (lookup ../this this.key)}}</td>
                {{else}}
                  {{#ifCond this.type '===' 'date'}}
                    <td>{{formatDate (lookup ../this this.key)}}</td>
                  {{else}}
                    <td>{{lookup ../this this.key}}</td>
                  {{/ifCond}}
                {{/ifCond}}
              {{/ifCond}}
            {{/each}}
          </tr>
        {{/each}}
      </tbody>
    </table>

    {{!-- Truncation warning --}}
    {{#if meta.truncated}}
    <div class="report-truncated">
      Showing first {{rows.length}} of {{summary.totalRows}} results. Apply filters for the complete dataset.
    </div>
    {{/if}}

    {{!-- Footer --}}
    <div class="report-footer">
      <div class="report-summary">
        {{#if summary.totalRows}}
          Total: {{summary.totalRows}} records
        {{/if}}
      </div>
      <div>Generated by Etendo Go</div>
    </div>

  </div>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add templates/reports/base-listing.hbs templates/reports/base.css
git commit -m "Feature ETP-3572: Add base listing template and report CSS"
```

---

## Chunk 3: CLI — sf-report-contract

### Task 4: Report contract generator

**Files:**
- Create: `cli/src/report-contract.js`
- Create: `cli/test/report-contract.test.js`
- Modify: `cli/package.json` (add bin entry)

- [ ] **Step 1: Write tests**

Create `cli/test/report-contract.test.js`:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateReportContract,
  validateReportContract,
  listAvailableFields,
} from '../src/report-contract.js';

// Minimal schema-curated.json fixture
function sampleSchema() {
  return {
    version: '0.1.0',
    window: { id: '200', name: 'Business Partner', primaryEntity: 'businessPartner', category: 'reference' },
    entities: [{
      name: 'businessPartner',
      tableName: 'C_BPartner',
      fields: [
        { name: 'name', column: 'Name', type: 'string', visibility: 'editable', required: true, grid: true, form: true, searchable: true },
        { name: 'searchKey', column: 'Value', type: 'string', visibility: 'editable', required: true, grid: true, form: true, searchable: true },
        { name: 'taxId', column: 'TaxID', type: 'string', visibility: 'editable', required: false, grid: false, form: true, searchable: false },
        { name: 'creditLimit', column: 'SO_CreditLimit', type: 'amount', visibility: 'editable', required: false, grid: false, form: true, searchable: false },
        { name: 'isActive', column: 'IsActive', type: 'boolean', visibility: 'readOnly', required: true, grid: true, form: true, searchable: false },
        { name: 'adClientId', column: 'AD_Client_ID', type: 'id', visibility: 'system', required: true, grid: false, form: false, searchable: false },
      ],
    }],
  };
}

describe('generateReportContract', () => {
  it('generates a valid report contract from schema', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.equal(contract.version, 1);
    assert.equal(contract.type, 'listing');
    assert.equal(contract.entity, 'business-partner');
    assert.ok(contract.columns.length > 0);
    assert.ok(contract.filters.length >= 0);
    assert.ok(contract.defaultSort);
  });

  it('excludes system fields from columns', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const fieldNames = contract.columns.map(c => c.field);
    assert.ok(!fieldNames.includes('adClientId'));
  });

  it('includes grid fields as columns by default', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const fieldNames = contract.columns.map(c => c.field);
    assert.ok(fieldNames.includes('name'));
    assert.ok(fieldNames.includes('searchKey'));
    assert.ok(fieldNames.includes('isActive'));
  });

  it('generates filters for searchable string fields', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const filterFields = contract.filters.map(f => f.field);
    assert.ok(filterFields.includes('name'));
    assert.ok(filterFields.includes('searchKey'));
  });

  it('generates boolean filters for boolean fields', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const boolFilter = contract.filters.find(f => f.field === 'isActive');
    assert.ok(boolFilter);
    assert.equal(boolFilter.type, 'boolean');
  });

  it('sets default sort to first sortable column', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.ok(contract.defaultSort.field);
    assert.equal(contract.defaultSort.direction, 'asc');
  });

  it('includes reportId as entity + type', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.equal(contract.reportId, 'business-partner-listing');
  });

  it('sets outputs to pdf only (Phase 1)', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.deepEqual(contract.outputs, ['pdf']);
  });
});

describe('validateReportContract', () => {
  it('valid contract passes', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const result = validateReportContract(contract, sampleSchema());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('detects column referencing non-existent field', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    contract.columns.push({ field: 'nonExistent', label: {}, type: 'string' });
    const result = validateReportContract(contract, sampleSchema());
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('nonExistent')));
  });

  it('detects missing required fields', () => {
    const result = validateReportContract({}, sampleSchema());
    assert.equal(result.valid, false);
  });
});

describe('listAvailableFields', () => {
  it('returns fields not in the contract', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const available = listAvailableFields(contract, sampleSchema());
    // taxId and creditLimit are non-grid, should be available
    assert.ok(available.some(f => f.name === 'taxId'));
    assert.ok(available.some(f => f.name === 'creditLimit'));
  });

  it('excludes system fields', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const available = listAvailableFields(contract, sampleSchema());
    assert.ok(!available.some(f => f.name === 'adClientId'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/report-contract.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement report-contract.js**

Create `cli/src/report-contract.js`:

```javascript
#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toSpecName } from './push-to-neo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const FILTER_TYPE_MAP = {
  string: 'text',
  boolean: 'boolean',
  foreignKey: 'select',
  id: 'select',
  date: 'dateRange',
  datetime: 'dateRange',
  integer: 'number',
  amount: 'number',
  number: 'number',
};

function defaultWidth(type) {
  switch (type) {
    case 'boolean': return '8%';
    case 'amount': case 'number': case 'integer': return '12%';
    case 'date': case 'datetime': return '12%';
    default: return 'auto';
  }
}

/**
 * Generate a report contract from a curated schema.
 * Pure function — no I/O.
 */
export function generateReportContract(schema, type) {
  const entity = schema.entities[0];
  const specName = toSpecName(schema.window.name);

  // Visible, non-system fields
  const visibleFields = entity.fields.filter(
    f => f.visibility !== 'system' && f.visibility !== 'discarded'
  );

  // Grid fields become columns by default
  const gridFields = visibleFields.filter(f => f.grid);

  const columns = gridFields.map((f, i) => ({
    field: f.name,
    label: { en_US: f.label ?? f.name, es_ES: f.label ?? f.name },
    type: f.type,
    width: defaultWidth(f.type),
    ...(f.searchable ? { sortable: true } : {}),
  }));

  // Searchable fields and booleans become filters
  const filters = [];
  for (const f of visibleFields) {
    if (f.searchable && f.type === 'string') {
      filters.push({
        field: f.name,
        type: 'text',
        label: { en_US: `${f.label ?? f.name} contains`, es_ES: `${f.label ?? f.name} contiene` },
      });
    } else if (f.type === 'boolean') {
      filters.push({
        field: f.name,
        type: 'boolean',
        label: { en_US: f.label ?? f.name, es_ES: f.label ?? f.name },
      });
    }
  }

  // Default sort: first sortable column, or first column
  const firstSortable = columns.find(c => c.sortable) ?? columns[0];

  return {
    version: 1,
    reportId: `${specName}-${type}`,
    type,
    entity: specName,
    title: {
      en_US: schema.window.name,
      es_ES: schema.window.name,
    },
    outputs: ['pdf'],
    columns,
    filters,
    defaultSort: { field: firstSortable?.field ?? columns[0]?.field, direction: 'asc' },
    summary: { totalRows: true },
  };
}

/**
 * Validate a report contract against the curated schema.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateReportContract(contract, schema) {
  const errors = [];

  if (!contract.reportId) errors.push('Missing reportId');
  if (!contract.type) errors.push('Missing type');
  if (!contract.entity) errors.push('Missing entity');
  if (!contract.columns || !Array.isArray(contract.columns)) errors.push('Missing or invalid columns');

  if (errors.length > 0) return { valid: false, errors };

  const entity = schema.entities[0];
  const fieldNames = new Set(entity.fields.map(f => f.name));

  for (const col of contract.columns) {
    if (!fieldNames.has(col.field)) {
      errors.push(`Column '${col.field}' does not exist in schema`);
    }
  }

  for (const filter of (contract.filters ?? [])) {
    if (!fieldNames.has(filter.field)) {
      errors.push(`Filter '${filter.field}' does not exist in schema`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * List schema fields not yet included in the report contract.
 * Excludes system/discarded fields.
 */
export function listAvailableFields(contract, schema) {
  const entity = schema.entities[0];
  const usedFields = new Set(contract.columns.map(c => c.field));

  return entity.fields
    .filter(f => f.visibility !== 'system' && f.visibility !== 'discarded')
    .filter(f => !usedFields.has(f.name))
    .map(f => ({ name: f.name, column: f.column, type: f.type, visibility: f.visibility }));
}

// --- CLI entry (guarded) ---
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length === 0) {
    console.log(`Usage:
  sf-report-contract --artifact <name> --type listing    Generate report contract
  sf-report-contract --artifact <name> --validate        Validate existing contract
  sf-report-contract --artifact <name> --available        List unused fields`);
    process.exit(0);
  }

  const artifactIdx = args.indexOf('--artifact');
  const artifactName = artifactIdx >= 0 ? args[artifactIdx + 1] : null;

  if (!artifactName) {
    console.error('Error: --artifact <name> is required');
    process.exit(1);
  }

  const artifactDir = join(ROOT, 'artifacts', artifactName);
  const schemaPath = join(artifactDir, 'schema-curated.json');

  if (!existsSync(schemaPath)) {
    console.error(`Error: ${schemaPath} not found`);
    process.exit(1);
  }

  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

  if (args.includes('--validate')) {
    const contractPath = join(artifactDir, 'report-contract.json');
    if (!existsSync(contractPath)) {
      console.error(`Error: ${contractPath} not found`);
      process.exit(1);
    }
    const contract = JSON.parse(readFileSync(contractPath, 'utf-8'));
    const result = validateReportContract(contract, schema);
    if (result.valid) {
      console.log('Report contract is valid.');
    } else {
      console.error('Validation errors:');
      result.errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
  } else if (args.includes('--available')) {
    const contractPath = join(artifactDir, 'report-contract.json');
    if (!existsSync(contractPath)) {
      console.error(`Error: ${contractPath} not found. Generate it first.`);
      process.exit(1);
    }
    const contract = JSON.parse(readFileSync(contractPath, 'utf-8'));
    const available = listAvailableFields(contract, schema);
    if (available.length === 0) {
      console.log('All visible fields are already in the contract.');
    } else {
      console.log('Available fields:');
      available.forEach(f => console.log(`  ${f.name} (${f.type}, ${f.visibility})`));
    }
  } else {
    const typeIdx = args.indexOf('--type');
    const type = typeIdx >= 0 ? args[typeIdx + 1] : 'listing';
    const contract = generateReportContract(schema, type);
    const outPath = join(artifactDir, 'report-contract.json');
    writeFileSync(outPath, JSON.stringify(contract, null, 2) + '\n');
    console.log(`Report contract written to ${outPath}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/report-contract.test.js`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/report-contract.js cli/test/report-contract.test.js
git commit -m "Feature ETP-3572: Add sf-report-contract CLI tool with tests"
```

---

## Chunk 4: CLI — sf-report-serve

### Task 5: Docker management tool

**Files:**
- Create: `cli/src/report-serve.js`
- Create: `cli/test/report-serve.test.js`
- Modify: `cli/package.json` (add bin entry)

- [ ] **Step 1: Write tests**

Create `cli/test/report-serve.test.js`:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildComposeArgs,
  buildHealthCheckUrl,
  parseServeArgs,
} from '../src/report-serve.js';

describe('parseServeArgs', () => {
  it('defaults port to 5488', () => {
    const opts = parseServeArgs([]);
    assert.equal(opts.port, 5488);
  });

  it('parses --port flag', () => {
    const opts = parseServeArgs(['--port', '5500']);
    assert.equal(opts.port, 5500);
  });

  it('parses --verbose flag', () => {
    const opts = parseServeArgs(['--verbose']);
    assert.equal(opts.verbose, true);
  });

  it('parses --detach flag', () => {
    const opts = parseServeArgs(['--detach']);
    assert.equal(opts.detach, true);
  });
});

describe('buildComposeArgs', () => {
  it('builds docker compose up command', () => {
    const args = buildComposeArgs({ port: 5488, detach: false, verbose: false });
    assert.ok(args.includes('up'));
    assert.ok(args.includes('--build'));
  });

  it('adds -d flag when detached', () => {
    const args = buildComposeArgs({ port: 5488, detach: true, verbose: false });
    assert.ok(args.includes('-d'));
  });

  it('does not add -d when not detached', () => {
    const args = buildComposeArgs({ port: 5488, detach: false, verbose: false });
    assert.ok(!args.includes('-d'));
  });
});

describe('buildHealthCheckUrl', () => {
  it('builds correct URL with default port', () => {
    assert.equal(buildHealthCheckUrl(5488), 'http://localhost:5488/api/ping');
  });

  it('builds correct URL with custom port', () => {
    assert.equal(buildHealthCheckUrl(5500), 'http://localhost:5500/api/ping');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/report-serve.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement report-serve.js**

Create `cli/src/report-serve.js`:

```javascript
#!/usr/bin/env node

import { execSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const COMPOSE_DIR = join(ROOT, 'docker', 'jsreport');

export function parseServeArgs(argv) {
  const portIdx = argv.indexOf('--port');
  return {
    port: portIdx >= 0 ? Number(argv[portIdx + 1]) : 5488,
    verbose: argv.includes('--verbose'),
    detach: argv.includes('--detach'),
    stop: argv.includes('--stop'),
  };
}

export function buildComposeArgs(opts) {
  const args = ['compose', 'up', '--build'];
  if (opts.detach) args.push('-d');
  return args;
}

export function buildHealthCheckUrl(port) {
  return `http://localhost:${port}/api/ping`;
}

/**
 * Run jsreport in Docker.
 * Not a pure function — spawns Docker process.
 */
export async function serve(opts) {
  if (opts.stop) {
    console.log('Stopping jsreport...');
    execSync('docker compose down', { cwd: COMPOSE_DIR, stdio: 'inherit' });
    return;
  }

  const env = { ...process.env, JSREPORT_PORT: String(opts.port) };
  const args = buildComposeArgs(opts);

  console.log(`Starting jsreport on port ${opts.port}...`);
  if (opts.verbose) console.log(`Command: docker ${args.join(' ')}`);

  const child = spawn('docker', args, {
    cwd: COMPOSE_DIR,
    env,
    stdio: opts.verbose ? 'inherit' : 'pipe',
  });

  if (opts.detach) {
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`jsreport running at ${buildHealthCheckUrl(opts.port)}`);
      } else {
        console.error(`Docker exited with code ${code}`);
        process.exit(1);
      }
    });
  } else {
    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });
  }
}

// --- CLI entry (guarded) ---
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(`Usage:
  sf-report-serve                Start jsreport in Docker (foreground)
  sf-report-serve --detach       Start in background
  sf-report-serve --port 5500    Custom port (default: 5488)
  sf-report-serve --verbose      Show Docker output
  sf-report-serve --stop         Stop running jsreport`);
    process.exit(0);
  }

  const opts = parseServeArgs(args);
  serve(opts);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/report-serve.test.js`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/report-serve.js cli/test/report-serve.test.js
git commit -m "Feature ETP-3572: Add sf-report-serve CLI tool with tests"
```

---

## Chunk 5: CLI — sf-report-preview

### Task 6: Report preview tool

**Files:**
- Create: `cli/src/report-preview.js`
- Create: `cli/test/report-preview.test.js`

- [ ] **Step 1: Write tests**

Create `cli/test/report-preview.test.js`:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildJsreportPayload,
  resolveTemplateFiles,
  parsePreviewArgs,
} from '../src/report-preview.js';

function sampleContract() {
  return {
    version: 1,
    reportId: 'business-partner-listing',
    type: 'listing',
    entity: 'business-partner',
    title: { en_US: 'Business Partners', es_ES: 'Terceros' },
    outputs: ['pdf'],
    columns: [
      { field: 'searchKey', label: { en_US: 'Search Key', es_ES: 'Clave' }, type: 'string', width: '10%', sortable: true },
      { field: 'name', label: { en_US: 'Name', es_ES: 'Nombre' }, type: 'string', width: '25%', sortable: true },
    ],
    filters: [],
    defaultSort: { field: 'name', direction: 'asc' },
    summary: { totalRows: true },
  };
}

function sampleMockData() {
  return [
    { searchKey: 'BP001', name: 'Empresa Demo S.L.' },
    { searchKey: 'BP002', name: 'Test Corp' },
  ];
}

describe('parsePreviewArgs', () => {
  it('parses artifact and report flags', () => {
    const opts = parsePreviewArgs(['--artifact', 'business-partner', '--report', 'listing']);
    assert.equal(opts.artifact, 'business-partner');
    assert.equal(opts.report, 'listing');
  });

  it('defaults format to pdf', () => {
    const opts = parsePreviewArgs(['--artifact', 'bp', '--report', 'listing']);
    assert.equal(opts.format, 'pdf');
  });

  it('parses --format flag', () => {
    const opts = parsePreviewArgs(['--artifact', 'bp', '--report', 'listing', '--format', 'xlsx']);
    assert.equal(opts.format, 'xlsx');
  });

  it('parses --locale flag', () => {
    const opts = parsePreviewArgs(['--artifact', 'bp', '--report', 'listing', '--locale', 'es_ES']);
    assert.equal(opts.locale, 'es_ES');
  });
});

describe('buildJsreportPayload', () => {
  it('builds valid jsreport API payload', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'en_US',
      css: 'body { color: black; }',
      templateContent: '<html>{{meta.title}}</html>',
    });

    assert.equal(payload.template.engine, 'handlebars');
    assert.equal(payload.template.recipe, 'chrome-pdf');
    assert.ok(payload.template.content.includes('{{meta.title}}'));
    assert.equal(payload.data.meta.title, 'Business Partners');
    assert.equal(payload.data.meta.locale, 'en_US');
    assert.equal(payload.data.rows.length, 2);
    assert.equal(payload.data.columns.length, 2);
    assert.equal(payload.data.columns[0].label, 'Search Key');
  });

  it('resolves i18n labels for es_ES', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'es_ES',
      css: '',
      templateContent: '',
    });

    assert.equal(payload.data.meta.title, 'Terceros');
    assert.equal(payload.data.columns[0].label, 'Clave');
  });

  it('includes CSS in data', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'en_US',
      css: '.report { color: red; }',
      templateContent: '',
    });
    assert.equal(payload.data.css, '.report { color: red; }');
  });

  it('includes summary with totalRows', () => {
    const payload = buildJsreportPayload(sampleContract(), sampleMockData(), {
      locale: 'en_US', css: '', templateContent: '',
    });
    assert.equal(payload.data.summary.totalRows, 2);
  });
});

describe('resolveTemplateFiles', () => {
  it('returns expected file paths', () => {
    const files = resolveTemplateFiles('/root', 'business-partner', 'listing');
    assert.ok(files.template.endsWith('template.hbs'));
    assert.ok(files.css.endsWith('base.css'));
    assert.ok(files.mockData.endsWith('mockData.js'));
    assert.ok(files.overrideCss.endsWith('style.css'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/report-preview.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement report-preview.js**

Create `cli/src/report-preview.js`:

```javascript
#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export function parsePreviewArgs(argv) {
  const get = (flag) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : null;
  };
  return {
    artifact: get('--artifact'),
    report: get('--report'),
    format: get('--format') ?? 'pdf',
    locale: get('--locale') ?? 'en_US',
    data: get('--data'),
    port: Number(get('--port') ?? 5488),
    open: !argv.includes('--no-open'),
  };
}

export function resolveTemplateFiles(root, artifact, report) {
  return {
    template: join(root, 'artifacts', artifact, 'reports', report, 'template.hbs'),
    css: join(root, 'templates', 'reports', 'base.css'),
    overrideCss: join(root, 'artifacts', artifact, 'reports', report, 'style.css'),
    mockData: join(root, 'artifacts', artifact, 'reports', report, 'mockData.js'),
    helpers: join(root, 'artifacts', artifact, 'reports', report, 'helpers.js'),
  };
}

/**
 * Resolve an i18n label object to a string for the given locale.
 * Falls back to en_US, then first available key.
 */
function resolveLabel(labelObj, locale) {
  if (typeof labelObj === 'string') return labelObj;
  return labelObj?.[locale] ?? labelObj?.en_US ?? Object.values(labelObj ?? {})[0] ?? '';
}

/**
 * Build the jsreport API payload from contract + mock data.
 * Pure function — no I/O.
 */
export function buildJsreportPayload(contract, rows, { locale, css, templateContent }) {
  const columns = contract.columns.map(col => ({
    key: col.field,
    label: resolveLabel(col.label, locale),
    type: col.type,
    width: col.width,
  }));

  return {
    template: {
      content: templateContent,
      engine: 'handlebars',
      recipe: 'chrome-pdf',
    },
    data: {
      css,
      meta: {
        title: resolveLabel(contract.title, locale),
        generatedAt: new Date().toISOString(),
        locale,
        filters: [],
        truncated: false,
      },
      columns,
      rows,
      summary: {
        totalRows: contract.summary?.totalRows ? rows.length : undefined,
      },
    },
  };
}

/**
 * Send payload to jsreport and return the PDF buffer.
 */
async function renderReport(payload, port) {
  const url = `http://localhost:${port}/api/report`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`jsreport error (${res.status}): ${body}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// --- CLI entry (guarded) ---
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(`Usage:
  sf-report-preview --artifact <name> --report <type>
  sf-report-preview --artifact business-partner --report listing
  sf-report-preview --artifact business-partner --report listing --format xlsx
  sf-report-preview --artifact business-partner --report listing --locale es_ES
  sf-report-preview --artifact business-partner --report listing --data custom.json`);
    process.exit(0);
  }

  const opts = parsePreviewArgs(args);

  if (!opts.artifact || !opts.report) {
    console.error('Error: --artifact <name> and --report <type> are required');
    process.exit(1);
  }

  const files = resolveTemplateFiles(ROOT, opts.artifact, opts.report);

  // Load contract
  const contractPath = join(ROOT, 'artifacts', opts.artifact, 'report-contract.json');
  if (!existsSync(contractPath)) {
    console.error(`Error: ${contractPath} not found. Run sf-report-contract first.`);
    process.exit(1);
  }
  const contract = JSON.parse(readFileSync(contractPath, 'utf-8'));

  // Load template
  if (!existsSync(files.template)) {
    console.error(`Error: Template not found at ${files.template}`);
    process.exit(1);
  }
  const templateContent = readFileSync(files.template, 'utf-8');

  // Load CSS (base + override)
  let css = existsSync(files.css) ? readFileSync(files.css, 'utf-8') : '';
  if (existsSync(files.overrideCss)) {
    css += '\n' + readFileSync(files.overrideCss, 'utf-8');
  }

  // Load mock data or custom data
  let rows;
  if (opts.data) {
    rows = JSON.parse(readFileSync(opts.data, 'utf-8'));
  } else if (existsSync(files.mockData)) {
    const mod = await import(files.mockData);
    rows = mod.default ?? [];
  } else {
    console.error(`Error: No mock data found at ${files.mockData}`);
    process.exit(1);
  }

  // Build payload and render
  const payload = buildJsreportPayload(contract, rows, { locale: opts.locale, css, templateContent });

  console.log(`Rendering ${opts.artifact}/${opts.report} (${opts.locale})...`);

  try {
    const pdf = await renderReport(payload, opts.port);
    const outPath = join(ROOT, 'artifacts', opts.artifact, 'reports', opts.report, `preview.${opts.format}`);
    const { writeFileSync: writeFile } = await import('node:fs');
    writeFile(outPath, pdf);
    console.log(`Preview saved to ${outPath}`);

    if (opts.open) {
      const { execSync } = await import('node:child_process');
      execSync(`open "${outPath}"`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error('Is jsreport running? Start it with: sf-report-serve');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/report-preview.test.js`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/report-preview.js cli/test/report-preview.test.js
git commit -m "Feature ETP-3572: Add sf-report-preview CLI tool with tests"
```

---

## Chunk 6: Business Partner Report Artifact

### Task 7: BP report contract, template, mock data

**Files:**
- Create: `artifacts/business-partner/report-contract.json`
- Create: `artifacts/business-partner/reports/listing/template.hbs`
- Create: `artifacts/business-partner/reports/listing/style.css`
- Create: `artifacts/business-partner/reports/listing/mockData.js`
- Create: `artifacts/business-partner/reports/listing/helpers.js`

- [ ] **Step 1: Generate the report contract**

Run: `node cli/src/report-contract.js --artifact business-partner --type listing`
Expected: Creates `artifacts/business-partner/report-contract.json`.

Review the output. The contract should include columns for `name`, `searchKey`, `isActive` (grid fields) and filters for `name`, `searchKey` (searchable strings) + `isActive` (boolean).

- [ ] **Step 2: Create BP listing template**

Create `artifacts/business-partner/reports/listing/template.hbs` — this extends the base template but can add BP-specific customizations:

```handlebars
<!DOCTYPE html>
<html lang="{{meta.locale}}">
<head>
  <meta charset="UTF-8">
  <style>{{{css}}}</style>
</head>
<body>
  <div class="report-container">

    {{!-- Header --}}
    <div class="report-header">
      <div>
        <div class="report-title">{{meta.title}}</div>
      </div>
      <div class="report-meta">
        <div>{{formatDate meta.generatedAt}}</div>
      </div>
    </div>

    {{!-- Applied filters --}}
    {{#if meta.filters.length}}
    <div class="report-filters">
      {{#each meta.filters}}
        <span><strong>{{this.label}}:</strong> {{this.value}}</span>
      {{/each}}
    </div>
    {{/if}}

    {{!-- Data table --}}
    <table class="report-table">
      <thead>
        <tr>
          {{#each columns}}
            <th style="width: {{this.width}}">{{this.label}}</th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each rows}}
          <tr>
            {{#each ../columns}}
              {{#ifCond this.type '===' 'boolean'}}
                <td class="cell-boolean">
                  {{#if (lookup ../this this.key)}}
                    <span class="yes">{{formatBoolean true}}</span>
                  {{else}}
                    <span class="no">{{formatBoolean false}}</span>
                  {{/if}}
                </td>
              {{else}}
                {{#ifCond this.type '===' 'amount'}}
                  <td class="cell-amount">{{formatCurrency (lookup ../this this.key)}}</td>
                {{else}}
                  <td>{{lookup ../this this.key}}</td>
                {{/ifCond}}
              {{/ifCond}}
            {{/each}}
          </tr>
        {{/each}}
      </tbody>
    </table>

    {{!-- Truncation warning --}}
    {{#if meta.truncated}}
    <div class="report-truncated">
      Showing first {{rows.length}} of {{summary.totalRows}} results.
    </div>
    {{/if}}

    {{!-- Footer --}}
    <div class="report-footer">
      <div class="report-summary">
        {{#if summary.totalRows}}
          Total: {{summary.totalRows}} records
        {{/if}}
      </div>
      <div>Generated by Etendo Go</div>
    </div>

  </div>
</body>
</html>
```

- [ ] **Step 3: Create BP-specific styles**

Create `artifacts/business-partner/reports/listing/style.css`:

```css
/* Business Partner listing — overrides */
@page {
  size: A4 landscape;
}
```

- [ ] **Step 4: Create mock data**

Create `artifacts/business-partner/reports/listing/mockData.js`:

```javascript
export default [
  { searchKey: 'BP001', name: 'Empresa Demo S.L.', taxId: 'B12345678', description: 'Main demo company', creditLimit: 50000.00, isActive: true },
  { searchKey: 'BP002', name: 'F&B International Group', taxId: 'A98765432', description: 'Food and beverage group', creditLimit: 120000.00, isActive: true },
  { searchKey: 'BP003', name: 'Test Corporation', taxId: 'B55555555', description: 'Testing entity', creditLimit: 10000.00, isActive: true },
  { searchKey: 'BP004', name: 'Inactive Partner Ltd.', taxId: 'B11111111', description: 'No longer active', creditLimit: 0, isActive: false },
  { searchKey: 'BP005', name: 'Proveedor Nacional S.A.', taxId: 'A22222222', description: 'National supplier', creditLimit: 75000.00, isActive: true },
  { searchKey: 'BP006', name: 'Quick Services GmbH', taxId: 'DE123456789', description: 'German service provider', creditLimit: 30000.00, isActive: true },
  { searchKey: 'BP007', name: 'Atlantic Trading Co.', taxId: 'GB987654321', description: 'UK trading company', creditLimit: 200000.00, isActive: true },
  { searchKey: 'BP008', name: 'Mediterranean Imports', taxId: 'IT55443322', description: 'Italian imports', creditLimit: 45000.00, isActive: false },
  { searchKey: 'BP009', name: 'Nordic Solutions AB', taxId: 'SE112233445566', description: 'Swedish tech firm', creditLimit: 60000.00, isActive: true },
  { searchKey: 'BP010', name: 'Pacific Exports Inc.', taxId: 'US-EIN-123456', description: 'US export company', creditLimit: 150000.00, isActive: true },
];
```

- [ ] **Step 5: Create report-specific helpers (empty for now)**

Create `artifacts/business-partner/reports/listing/helpers.js`:

```javascript
/**
 * Business Partner listing — report-specific Handlebars helpers.
 * Currently empty — base helpers cover all needs.
 * Add BP-specific formatters here if needed.
 */
export function registerAll(handlebars) {
  // No BP-specific helpers yet
}
```

- [ ] **Step 6: Commit**

```bash
git add artifacts/business-partner/report-contract.json artifacts/business-partner/reports/
git commit -m "Feature ETP-3572: Add Business Partner listing report artifacts"
```

---

## Chunk 7: Integration and Wiring

### Task 8: Package.json bin entries + Makefile

**Files:**
- Modify: `cli/package.json` (add 3 bin entries)
- Modify: `Makefile` (add report targets)

- [ ] **Step 1: Add bin entries to cli/package.json**

Add these entries to the `"bin"` object in `cli/package.json`:

```json
"sf-report-contract": "./src/report-contract.js",
"sf-report-serve": "./src/report-serve.js",
"sf-report-preview": "./src/report-preview.js"
```

- [ ] **Step 2: Add Makefile targets**

Update the `.PHONY` line at the top of the Makefile to include the new targets:

```makefile
.PHONY: test test-frontend generate dev build install deploy clean help report-serve report-serve-detach report-stop report-preview
```

Then append before the `clean:` target:

```makefile
# --- Reports ---

report-serve: ## Start jsreport in Docker (foreground)
	node cli/src/report-serve.js

report-serve-detach: ## Start jsreport in Docker (background)
	node cli/src/report-serve.js --detach

report-stop: ## Stop jsreport Docker container
	node cli/src/report-serve.js --stop

report-preview: ## Preview Business Partner listing report (requires jsreport running)
	node cli/src/report-preview.js --artifact business-partner --report listing
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All existing tests pass + new report tests pass.

- [ ] **Step 4: Commit**

```bash
git add cli/package.json Makefile
git commit -m "Feature ETP-3572: Wire report CLI tools into package.json and Makefile"
```

---

## Chunk 8: End-to-End Validation

### Task 9: Manual E2E test

This task validates the full pipeline works end-to-end. Not automated — manual developer verification.

- [ ] **Step 1: Start jsreport**

Run: `make report-serve-detach`
Expected: Docker container starts, health check passes.

- [ ] **Step 2: Verify jsreport is running**

Run: `curl http://localhost:5488/api/ping`
Expected: Returns OK response.

- [ ] **Step 3: Preview the BP report**

Run: `make report-preview`
Expected: PDF file generated at `artifacts/business-partner/reports/listing/preview.pdf` and opens in the default viewer. The PDF shows a table with the 10 mock Business Partners, styled with Etendo branding.

- [ ] **Step 4: Validate the contract**

Run: `node cli/src/report-contract.js --artifact business-partner --validate`
Expected: "Report contract is valid."

- [ ] **Step 5: List available fields**

Run: `node cli/src/report-contract.js --artifact business-partner --available`
Expected: Shows fields not in the contract (e.g., `taxId`, `creditLimit`, `description`).

- [ ] **Step 6: Stop jsreport**

Run: `make report-stop`
Expected: Container stops cleanly.

- [ ] **Step 7: Add report outputs and Docker runtime paths to .gitignore**

Append to `.gitignore`:

```
# Report preview outputs
artifacts/*/reports/*/preview.*

# Docker jsreport runtime data
docker/jsreport/data/
```

- [ ] **Step 8: Final commit**

```bash
git add .gitignore
git commit -m "Feature ETP-3572: Add report preview output to gitignore"
```

---

## Summary

| Chunk | Tasks | New Files | Tests |
|-------|-------|-----------|-------|
| 1: Docker | 1 | 4 | - (infrastructure) |
| 2: Templates | 2-3 | 3 | 6 test cases |
| 3: sf-report-contract | 4 | 2 | 11 test cases |
| 4: sf-report-serve | 5 | 2 | 6 test cases |
| 5: sf-report-preview | 6 | 2 | 8 test cases |
| 6: BP Artifacts | 7 | 5 | - (generated + manual) |
| 7: Integration | 8 | 0 (modify 2) | Full suite |
| 8: E2E Validation | 9 | 0 | Manual verification |

**Total:** 9 tasks, 18 new files, 2 modified files, ~31 test cases, 8 commits.
