# Vertical Slice Implementation Plan: Sales Order End-to-End

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full Schema Forge pipeline for Sales Order — from Etendo metadata extraction through code generation — as a vertical slice that proves the architecture.

**Architecture:** Node.js CLI tools extract metadata from a real Etendo PostgreSQL DB, produce JSON artifacts, validate them, pre-classify rules with Claude AI, present decisions via a React web panel, generate contract tests, then generate a Java Etendo module + React SPA. Each phase produces artifacts consumed by the next.

**Tech Stack:** Node.js 22 (CLI, zero-dep where possible), PostgreSQL (`pg`), Ajv (JSON Schema validation), Handlebars (templates), React + Vite (decision tools), Claude Code subagents + skills (AI integration, no direct API), Java (generated Etendo module), node:test (contract tests)

---

## Wave 0: Project Foundation

### Task 1: Initialize npm workspaces monorepo

**Files:**
- Create: `package.json`
- Create: `cli/package.json`
- Create: `schemas/.gitkeep`
- Create: `templates/.gitkeep`
- Create: `core-maps/.gitkeep`
- Create: `artifacts/sales-order/.gitkeep`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "schema-forge",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "workspaces": ["cli", "tools/*"]
}
```

**Step 2: Create cli/package.json**

```json
{
  "name": "@schema-forge/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "dependencies": {
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "ajv": "^8.17.0"
  }
}
```

**Step 3: Create directory placeholders**

```bash
mkdir -p schemas templates core-maps artifacts/sales-order cli/src cli/test
touch schemas/.gitkeep templates/.gitkeep core-maps/.gitkeep artifacts/sales-order/.gitkeep
```

**Step 4: Install dependencies**

Run: `npm install`
Expected: node_modules created, lockfile generated

**Step 5: Verify workspace setup**

Run: `npm ls --workspaces`
Expected: Shows `@schema-forge/cli` workspace

**Step 6: Commit**

```bash
git add package.json package-lock.json cli/package.json schemas/ templates/ core-maps/ artifacts/
git commit -m "feat: initialize npm workspaces monorepo with cli workspace"
```

---

### Task 2: Create core-maps (static configuration)

**Files:**
- Create: `core-maps/system-columns.json`
- Create: `core-maps/ad-reference-map.json`
- Create: `core-maps/impact-messages.json`
- Test: `cli/test/core-maps.test.js`

**Step 1: Write the test for core-maps loading**

```javascript
// cli/test/core-maps.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

describe('core-maps', () => {
  it('system-columns.json is valid JSON with expected keys', async () => {
    const raw = await readFile(
      new URL('../../core-maps/system-columns.json', import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    assert.ok(data['AD_Client_ID'], 'Missing AD_Client_ID');
    assert.ok(data['AD_Org_ID'], 'Missing AD_Org_ID');
    assert.ok(data['Created'], 'Missing Created');
    assert.ok(data['CreatedBy'], 'Missing CreatedBy');
    assert.ok(data['Updated'], 'Missing Updated');
    assert.ok(data['UpdatedBy'], 'Missing UpdatedBy');
    assert.ok(data['IsActive'], 'Missing IsActive');
  });

  it('ad-reference-map.json maps AD_Reference_IDs to schema types', async () => {
    const raw = await readFile(
      new URL('../../core-maps/ad-reference-map.json', import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    assert.equal(data['10'], 'string');
    assert.equal(data['11'], 'integer');
    assert.equal(data['12'], 'amount');
    assert.equal(data['13'], 'id');
    assert.equal(data['20'], 'boolean');
  });

  it('impact-messages.json has entries for each system category', async () => {
    const raw = await readFile(
      new URL('../../core-maps/impact-messages.json', import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    for (const cat of ['accounting','inventory','costing','audit','tax','integration','internal']) {
      assert.ok(data[cat], `Missing category: ${cat}`);
      assert.ok(typeof data[cat] === 'string', `${cat} should be a string message`);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/core-maps.test.js`
Expected: FAIL (files don't exist yet)

**Step 3: Create system-columns.json**

From TDD 3.1, these are the known system columns and their derivation patterns:

```json
{
  "AD_Client_ID": { "systemCategory": "internal", "derivation": { "type": "fromConfig", "source": "context.client" } },
  "AD_Org_ID": { "systemCategory": "internal", "derivation": { "type": "fromConfig", "source": "context.organization" } },
  "Created": { "systemCategory": "audit", "derivation": { "type": "fromConfig", "source": "new Date()" } },
  "CreatedBy": { "systemCategory": "audit", "derivation": { "type": "fromConfig", "source": "context.user" } },
  "Updated": { "systemCategory": "audit", "derivation": { "type": "fromConfig", "source": "new Date()" } },
  "UpdatedBy": { "systemCategory": "audit", "derivation": { "type": "fromConfig", "source": "context.user" } },
  "IsActive": { "systemCategory": "internal", "derivation": { "type": "computed", "source": "true" } },
  "Posted": { "systemCategory": "accounting", "derivation": { "type": "computed", "source": "'N'" } },
  "Processed": { "systemCategory": "internal", "derivation": { "type": "computed", "source": "false" } },
  "Processing": { "systemCategory": "internal", "derivation": { "type": "computed", "source": "false" } },
  "DocumentNo": { "systemCategory": "internal", "derivation": { "type": "sequence", "source": "documentType.sequence" } },
  "DocumentStatus": { "systemCategory": "internal", "derivation": { "type": "computed", "source": "'DR'" } },
  "DocumentAction": { "systemCategory": "internal", "derivation": { "type": "computed", "source": "'CO'" } },
  "C_DocType_ID": { "systemCategory": "internal", "derivation": { "type": "fromConfig", "source": "doctype.salesOrder" } },
  "C_DocTypeTarget_ID": { "systemCategory": "internal", "derivation": { "type": "fromConfig", "source": "doctype.salesOrder" } }
}
```

**Step 4: Create ad-reference-map.json**

From TDD 3.1 AD_Reference_ID mapping:

```json
{
  "10": "string",
  "11": "integer",
  "12": "amount",
  "13": "id",
  "14": "text",
  "15": "date",
  "16": "datetime",
  "17": "enum",
  "18": "foreignKey",
  "19": "foreignKey",
  "20": "boolean",
  "22": "decimal",
  "29": "quantity",
  "35": "price",
  "28": "image",
  "23": "binary"
}
```

**Step 5: Create impact-messages.json**

```json
{
  "accounting": "Removing this field will prevent accounting entries from being generated for this document.",
  "inventory": "Removing this field will prevent inventory movements and stock reservations.",
  "costing": "Removing this field will break cost calculations for products in this transaction.",
  "audit": "This field is required for audit trail compliance. Removing it may violate regulatory requirements.",
  "tax": "Removing this field will prevent tax calculations. Documents may not be legally valid.",
  "integration": "This field is used by external integrations. Removing it will break data exchange.",
  "internal": "This is an internal system field required for Etendo platform operations."
}
```

**Step 6: Run test to verify it passes**

Run: `node --test cli/test/core-maps.test.js`
Expected: 3 tests PASS

**Step 7: Commit**

```bash
git add core-maps/ cli/test/core-maps.test.js
git commit -m "feat: add core-maps (system-columns, ad-reference-map, impact-messages)"
```

---

### Task 3: Create JSON Schemas for all artifact types

**Files:**
- Create: `schemas/schema-raw.schema.json`
- Create: `schemas/schema-curated.schema.json`
- Create: `schemas/rules.schema.json`
- Create: `schemas/processes.schema.json`
- Create: `schemas/contract.schema.json`
- Create: `schemas/step-operation.schema.json`
- Test: `cli/test/schemas.test.js`

**Step 1: Write the test**

```javascript
// cli/test/schemas.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = resolve(__dirname, '../../schemas');

async function loadSchema(name) {
  return JSON.parse(await readFile(resolve(schemasDir, name), 'utf8'));
}

describe('JSON Schemas', () => {
  it('all schema files are valid JSON Schema', async () => {
    const ajv = new Ajv({ allErrors: true });
    const files = [
      'schema-raw.schema.json',
      'schema-curated.schema.json',
      'rules.schema.json',
      'processes.schema.json',
      'contract.schema.json',
      'step-operation.schema.json'
    ];
    for (const f of files) {
      const schema = await loadSchema(f);
      assert.doesNotThrow(() => ajv.compile(schema), `${f} is not valid JSON Schema`);
    }
  });

  it('schema-raw requires version, window, entities', async () => {
    const schema = await loadSchema('schema-raw.schema.json');
    assert.ok(schema.required.includes('version'));
    assert.ok(schema.required.includes('window'));
    assert.ok(schema.required.includes('entities'));
  });

  it('step-operation defines validate, mutation, forEach types', async () => {
    const schema = await loadSchema('step-operation.schema.json');
    const types = schema.oneOf.map(s => s.properties.type.const);
    assert.ok(types.includes('validate'));
    assert.ok(types.includes('mutation'));
    assert.ok(types.includes('forEach'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/schemas.test.js`
Expected: FAIL

**Step 3: Create schema-raw.schema.json**

Build the JSON Schema based on TDD 2.1 data model. This schema defines the output of the Field Extractor.

Key fields: `version` (semver), `generatedAt` (ISO datetime), `sourceChecksum` (hex), `window` (object with id, name, description, primaryEntity, category), `entities` (array of entity objects each with name, table, description, level, parentEntity, parentField, fields array).

Each field has: name, column, label, type (enum of all TDD types), required, visibility (only `editable|readOnly|system` for raw — no `discarded` yet), derivation (optional), reference (optional), validation (optional), displayLogic, readOnlyLogic, sequence, grid, form, searchable.

Write the complete JSON Schema file. Reference TDD 2.1 for all required/optional fields and valid enum values.

**Step 4: Create schema-curated.schema.json**

Same as schema-raw but adds `discarded` to the visibility enum and makes `systemCategory` and `derivation` conditionally required when `visibility === 'system'`.

**Step 5: Create rules.schema.json**

From TDD 2.2. Each rule has: id, type (enum), source (enum), tier (auto|human), autoDecision, decision (keep|replace|simplify|omit|pending), class, expression, translatedExpression, trigger, effects array, complexity, linesOfCode, branches, hasDmlOperations, dmlWarning, description, iaRecommendation, impactIfOmitted, behavioralSpec, simplificationSpec, replacementSpec.

**Step 6: Create processes.schema.json**

From TDD 2.3. Processes array with: name, displayName, entity, trigger, preconditions, steps, edgeCases, transactional. Steps have: order, name, description, type, target, operation, ruleDecision, existingClass, behavioral.

**Step 7: Create step-operation.schema.json (Decision D4/D8)**

Only 3 types per resolved decisions:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Step Operation",
  "description": "Operation definition for process steps. Only 3 types: validate, mutation, forEach.",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "type": { "const": "validate" },
        "assertion": { "type": "string", "description": "Boolean expression to evaluate" },
        "errorMessage": { "type": "string" },
        "errorCode": { "type": "string" }
      },
      "required": ["type", "assertion", "errorMessage", "errorCode"]
    },
    {
      "type": "object",
      "properties": {
        "type": { "const": "mutation" },
        "entity": { "type": "string" },
        "field": { "type": "string" },
        "value": { "description": "Expression or literal value" },
        "condition": { "type": "string", "description": "Optional guard condition" }
      },
      "required": ["type", "entity", "field", "value"]
    },
    {
      "type": "object",
      "properties": {
        "type": { "const": "forEach" },
        "collection": { "type": "string", "description": "Expression yielding the iterable (e.g. 'order.orderLineList')" },
        "as": { "type": "string", "description": "Loop variable name" },
        "steps": {
          "type": "array",
          "items": { "$ref": "#" },
          "description": "Nested steps to execute per item"
        }
      },
      "required": ["type", "collection", "as", "steps"]
    }
  ]
}
```

**Step 8: Create contract.schema.json**

From TDD 2.4. Top-level: version (semver), checksums, frontendContract, backendContract, testManifest.

**Step 9: Run test to verify it passes**

Run: `node --test cli/test/schemas.test.js`
Expected: 3 tests PASS

**Step 10: Commit**

```bash
git add schemas/ cli/test/schemas.test.js
git commit -m "feat: add JSON Schemas for all artifact types"
```

---

### Task 4: Create DB connection utility

**Files:**
- Create: `cli/src/db.js`
- Test: `cli/test/db.test.js`

**Step 1: Write the test**

```javascript
// cli/test/db.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createDbPool, closePool } from '../src/db.js';

describe('db', () => {
  it('createDbPool returns a pool with query method', () => {
    const pool = createDbPool({
      host: 'localhost', port: 5432,
      user: 'test', password: 'test', database: 'test'
    });
    assert.ok(typeof pool.query === 'function');
    pool.end();
  });

  it('createDbPool reads from env when no config provided', () => {
    process.env.ETENDO_DB_HOST = 'testhost';
    process.env.ETENDO_DB_PORT = '5433';
    process.env.ETENDO_DB_USER = 'testuser';
    process.env.ETENDO_DB_PASSWORD = 'testpass';
    process.env.ETENDO_DB_NAME = 'testdb';

    const pool = createDbPool();
    // Pool created without error means env vars read correctly
    assert.ok(pool);
    pool.end();

    delete process.env.ETENDO_DB_HOST;
    delete process.env.ETENDO_DB_PORT;
    delete process.env.ETENDO_DB_USER;
    delete process.env.ETENDO_DB_PASSWORD;
    delete process.env.ETENDO_DB_NAME;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/db.test.js`
Expected: FAIL (module not found)

**Step 3: Implement db.js**

```javascript
// cli/src/db.js
import pg from 'pg';

export function createDbPool(config) {
  return new pg.Pool(config ?? {
    host: process.env.ETENDO_DB_HOST ?? 'localhost',
    port: parseInt(process.env.ETENDO_DB_PORT ?? '5432', 10),
    user: process.env.ETENDO_DB_USER ?? 'etendo',
    password: process.env.ETENDO_DB_PASSWORD ?? '',
    database: process.env.ETENDO_DB_NAME ?? 'etendo_dev',
    max: 5,
  });
}

export async function closePool(pool) {
  await pool.end();
}
```

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/db.test.js`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add cli/src/db.js cli/test/db.test.js
git commit -m "feat: add PostgreSQL connection utility"
```

---

## Wave 1: Extractors + Process Definitions (4 parallel tasks)

### Task 5: Field Extractor (F1a)

**Files:**
- Create: `cli/src/extract-fields.js`
- Test: `cli/test/extract-fields.test.js`
- Output: `artifacts/sales-order/schema-raw.json` (generated at runtime)

**Context:** This CLI tool queries the Etendo PostgreSQL DB for all fields in a given window (by AD_Window_ID), applies the pre-classification logic from TDD 3.1 (using `core-maps/system-columns.json` and `core-maps/ad-reference-map.json`), and produces `schema-raw.json`.

**Step 1: Write the test**

The test should mock the DB query results (an array of field rows) and verify that `classifyField()` and `buildSchema()` produce correct output. Test cases:

1. A system column (`AD_Client_ID`) gets `visibility: 'system'` with correct derivation
2. An audit column (`Created`) gets `visibility: 'system'`, `systemCategory: 'audit'`
3. A hidden field (`IsDisplayed = 'N'`) gets `visibility: 'system'`
4. A read-only field gets `visibility: 'readOnly'`
5. A normal displayed field gets `visibility: 'editable'`
6. AD_Reference_ID `12` maps to type `amount`
7. A field with `DefaultValue = '@AD_Org_ID@'` gets `derivation.type: 'fromConfig'`
8. A field with `DefaultValue = '@SQL=...'` gets `derivation.type: 'lookup'`
9. The output has correct `window`, `entities`, and `version` structure
10. Multi-tab window produces header entity (level 0) and line entity (level 1)

```javascript
// cli/test/extract-fields.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { classifyField, buildSchema, inferDerivation } from '../src/extract-fields.js';

// Load core maps synchronously for tests
import { readFileSync } from 'node:fs';
const systemColumns = JSON.parse(readFileSync(
  new URL('../../core-maps/system-columns.json', import.meta.url), 'utf8'));
const refMap = JSON.parse(readFileSync(
  new URL('../../core-maps/ad-reference-map.json', import.meta.url), 'utf8'));

describe('classifyField', () => {
  it('classifies AD_Client_ID as system/internal', () => {
    const result = classifyField(
      { columnName: 'AD_Client_ID', tableName: 'C_Order',
        isDisplayed: 'N', isReadOnly: 'N', isUpdateable: 'Y',
        defaultValue: null, adReferenceId: '19' },
      systemColumns
    );
    assert.equal(result.visibility, 'system');
    assert.equal(result.systemCategory, 'internal');
    assert.equal(result.derivation.type, 'fromConfig');
  });

  it('classifies Created as system/audit', () => {
    const result = classifyField(
      { columnName: 'Created', tableName: 'C_Order',
        isDisplayed: 'N', isReadOnly: 'Y', isUpdateable: 'N',
        defaultValue: null, adReferenceId: '16' },
      systemColumns
    );
    assert.equal(result.visibility, 'system');
    assert.equal(result.systemCategory, 'audit');
  });

  it('classifies hidden field as system', () => {
    const result = classifyField(
      { columnName: 'SomeHiddenField', tableName: 'C_Order',
        isDisplayed: 'N', isReadOnly: 'N', isUpdateable: 'Y',
        defaultValue: null, adReferenceId: '10' },
      systemColumns
    );
    assert.equal(result.visibility, 'system');
  });

  it('classifies read-only field as readOnly', () => {
    const result = classifyField(
      { columnName: 'GrandTotal', tableName: 'C_Order',
        isDisplayed: 'Y', isReadOnly: 'Y', isUpdateable: 'N',
        defaultValue: null, adReferenceId: '12' },
      systemColumns
    );
    assert.equal(result.visibility, 'readOnly');
  });

  it('classifies normal displayed field as editable', () => {
    const result = classifyField(
      { columnName: 'DateOrdered', tableName: 'C_Order',
        isDisplayed: 'Y', isReadOnly: 'N', isUpdateable: 'Y',
        defaultValue: null, adReferenceId: '15' },
      systemColumns
    );
    assert.equal(result.visibility, 'editable');
  });
});

describe('inferDerivation', () => {
  it('infers fromConfig for @VAR@ pattern', () => {
    const result = inferDerivation('@AD_Org_ID@');
    assert.equal(result.type, 'fromConfig');
    assert.ok(result.source.includes('ad_Org_ID') || result.source.includes('ad_org_id'));
  });

  it('infers lookup for @SQL= pattern', () => {
    const result = inferDerivation("@SQL=SELECT MAX(Line) FROM C_OrderLine WHERE C_Order_ID=@C_Order_ID@");
    assert.equal(result.type, 'lookup');
  });

  it('returns null for no default', () => {
    assert.equal(inferDerivation(null), null);
  });
});

describe('buildSchema', () => {
  it('produces valid schema structure from mock rows', () => {
    const mockRows = [
      { ad_window_id: '143', window_name: 'Sales Order',
        ad_tab_id: '186', tab_name: 'Order', tablevel: 0, tab_seq: 10,
        tablename: 'C_Order',
        ad_field_id: '1', field_name: 'Document No',
        isdisplayed: 'Y', isreadonly: 'Y', displaylogic: null, readonlylogic: null,
        field_seq: 10,
        columnname: 'DocumentNo', ad_reference_id: '10', ismandatory: 'Y',
        isupdateable: 'N', defaultvalue: null, fieldlength: 30,
        valuemin: null, valuemax: null, ad_val_rule_id: null,
        reference_name: 'String', callout_class: null },
      { ad_window_id: '143', window_name: 'Sales Order',
        ad_tab_id: '187', tab_name: 'Order Line', tablevel: 1, tab_seq: 20,
        tablename: 'C_OrderLine',
        ad_field_id: '2', field_name: 'Product',
        isdisplayed: 'Y', isreadonly: 'N', displaylogic: null, readonlylogic: null,
        field_seq: 20,
        columnname: 'M_Product_ID', ad_reference_id: '19', ismandatory: 'Y',
        isupdateable: 'Y', defaultvalue: null, fieldlength: 32,
        valuemin: null, valuemax: null, ad_val_rule_id: null,
        reference_name: 'Product', callout_class: null }
    ];
    const schema = buildSchema(mockRows, systemColumns, refMap);
    assert.equal(schema.window.name, 'Sales Order');
    assert.equal(schema.entities.length, 2);
    assert.equal(schema.entities[0].level, 'header');
    assert.equal(schema.entities[1].level, 'line');
    assert.ok(schema.version);
    assert.ok(schema.generatedAt);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/extract-fields.test.js`
Expected: FAIL

**Step 3: Implement extract-fields.js**

Implement the full Field Extractor with:
- `classifyField(fieldRow, systemColumns)` — applies the TDD 3.1 classification logic
- `inferDerivation(defaultValue)` — parses `@VAR@` and `@SQL=` patterns
- `buildSchema(rows, systemColumns, refMap)` — groups by tab, maps types, produces the schema-raw structure
- `main(windowId)` — connects to DB, runs TDD 3.1 SQL query, calls buildSchema, writes `artifacts/{window}/schema-raw.json`

Export all functions for testability.

Implement the exact SQL from TDD 3.1 (section 3.1 Core SQL). Use the `pg` library for queries.

The `classifyField` function follows the exact priority from TDD 3.1:
1. Primary key column (`columnName === tableName + '_ID'`) → system/internal
2. Known system column (in `system-columns.json`) → use stored category/derivation
3. Audit columns (`Created/CreatedBy/Updated/UpdatedBy`) → system/audit
4. Not displayed (`isDisplayed === 'N'`) → system, infer category
5. Read-only or not updateable → readOnly
6. Everything else → editable

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/extract-fields.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/src/extract-fields.js cli/test/extract-fields.test.js
git commit -m "feat: implement Field Extractor (F1a) with pre-classification"
```

---

### Task 6: Rule Extractor (F1b)

**Files:**
- Create: `cli/src/extract-rules.js`
- Test: `cli/test/extract-rules.test.js`
- Output: `artifacts/sales-order/rules-raw.json` (generated at runtime)

**Context:** Queries Etendo DB for callouts, validation rules, display/readOnly logic, and document processes (4 queries from TDD 3.2). Optionally analyzes Java source files. Produces `rules-raw.json`.

**Step 1: Write the test**

Test the pure functions:
1. `analyzeJavaSource(sourceCode)` — detects `setValue` patterns, counts branches, detects DML
2. `translateExpression(expr)` — translates Etendo expressions, fails safely on framework calls
3. `buildRules(callouts, validations, logics, processes, sourceAnalysis)` — assembles the rules array
4. `isSimpleValidation(sql)` — identifies simple WHERE clauses

```javascript
// cli/test/extract-rules.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  analyzeJavaSource, translateExpression,
  isSimpleValidation, buildRuleFromCallout
} from '../src/extract-rules.js';

describe('analyzeJavaSource', () => {
  it('detects setValue effects', () => {
    const source = `
      public class TestCallout extends SimpleCallout {
        protected void execute(CalloutInfo info) {
          info.addResult("grandTotal", computeTotal());
          info.addResult("taxAmount", computeTax());
        }
      }`;
    const result = analyzeJavaSource(source);
    assert.equal(result.effects.length, 2);
    assert.equal(result.effects[0].field, 'grandTotal');
    assert.equal(result.effects[0].action, 'setValue');
  });

  it('detects DML operations', () => {
    const source = `OBDal.getInstance().createCriteria(Order.class);`;
    const result = analyzeJavaSource(source);
    assert.equal(result.hasDmlOperations, true);
    assert.ok(result.dmlWarning);
  });

  it('counts branches', () => {
    const source = `if (a) { } else if (b) { } switch(c) { }`;
    const result = analyzeJavaSource(source);
    assert.equal(result.branches, 3);
  });

  it('handles missing source gracefully', () => {
    const result = analyzeJavaSource(null);
    assert.deepEqual(result.effects, []);
    assert.equal(result.confidence, 'low');
  });
});

describe('translateExpression', () => {
  it('translates @VAR@ to camelCase', () => {
    const result = translateExpression("@DocumentStatus@='DR'");
    assert.ok(result.success);
    assert.ok(result.result.includes('documentStatus'));
  });

  it('translates Y/N to true/false', () => {
    const result = translateExpression("@IsSalesTransaction@='Y'");
    assert.ok(result.success);
    assert.ok(result.result.includes('true'));
  });

  it('fails on framework calls', () => {
    const result = translateExpression("OB.Utilities.checkValue()");
    assert.equal(result.success, false);
    assert.ok(result.error);
  });

  it('translates | to || and & to &&', () => {
    const result = translateExpression("@A@='Y' | @B@='N'");
    assert.ok(result.success);
    assert.ok(result.result.includes('||'));
  });
});

describe('isSimpleValidation', () => {
  it('identifies simple WHERE clause', () => {
    assert.ok(isSimpleValidation("AD_Org_ID IN (SELECT AD_Org_ID FROM AD_Org WHERE IsActive='Y')"));
  });

  it('rejects complex queries with subqueries and joins', () => {
    assert.ok(!isSimpleValidation(
      "SELECT 1 FROM C_Order o JOIN C_OrderLine ol ON o.C_Order_ID = ol.C_Order_ID WHERE EXISTS (SELECT 1 FROM M_Product)"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/extract-rules.test.js`
Expected: FAIL

**Step 3: Implement extract-rules.js**

Implement:
- 4 SQL queries from TDD 3.2 (callouts, validation rules, display/readOnly logic, document processes)
- `analyzeJavaSource(source)` — regex-based analysis from TDD 3.2
- `translateExpression(expr)` — fail-safe translator from TDD 3.2
- `isSimpleValidation(sql)` — heuristic check
- `findSource(sourceDir, className)` — walks `ETENDO_SOURCE_DIR` to find `.java` file by class name
- `buildRuleFromCallout(row, sourceAnalysis)` — creates a rule object
- `main(windowId)` — orchestrates queries + source analysis, writes `artifacts/{window}/rules-raw.json`

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/extract-rules.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/src/extract-rules.js cli/test/extract-rules.test.js
git commit -m "feat: implement Rule Extractor (F1b) with Java source analysis"
```

---

### Task 7: Process Definitions (F5) — Manual JSON

**Files:**
- Create: `artifacts/sales-order/processes.json`
- Test: `cli/test/processes-valid.test.js`

**Context:** Per design decisions, process definitions are written manually as JSON. This task creates `completeOrder` and `voidOrder` process definitions for Sales Order, following the TDD 2.3 data model and using only the 3 step types: `validate`, `mutation`, `forEach` (Decision D4/D8).

**Step 1: Write the validation test**

This test loads `processes.json` and validates it against the processes schema.

```javascript
// cli/test/processes-valid.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('processes.json', () => {
  it('is valid against processes.schema.json', async () => {
    const schema = JSON.parse(await readFile(
      resolve(__dirname, '../../schemas/processes.schema.json'), 'utf8'));
    const data = JSON.parse(await readFile(
      resolve(__dirname, '../../artifacts/sales-order/processes.json'), 'utf8'));
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(data);
    assert.ok(valid, `Validation errors: ${JSON.stringify(validate.errors, null, 2)}`);
  });

  it('defines completeOrder with >= 3 edge cases', async () => {
    const data = JSON.parse(await readFile(
      resolve(__dirname, '../../artifacts/sales-order/processes.json'), 'utf8'));
    const complete = data.processes.find(p => p.name === 'completeOrder');
    assert.ok(complete, 'completeOrder process must exist');
    assert.ok(complete.edgeCases.length >= 3,
      `completeOrder must have >= 3 edge cases, has ${complete.edgeCases.length}`);
    assert.ok(complete.preconditions.length >= 1, 'Must have preconditions');
  });

  it('defines voidOrder with >= 3 edge cases', async () => {
    const data = JSON.parse(await readFile(
      resolve(__dirname, '../../artifacts/sales-order/processes.json'), 'utf8'));
    const voidProc = data.processes.find(p => p.name === 'voidOrder');
    assert.ok(voidProc, 'voidOrder process must exist');
    assert.ok(voidProc.edgeCases.length >= 3,
      `voidOrder must have >= 3 edge cases, has ${voidProc.edgeCases.length}`);
  });

  it('all steps use only validate|mutation|forEach types', async () => {
    const data = JSON.parse(await readFile(
      resolve(__dirname, '../../artifacts/sales-order/processes.json'), 'utf8'));
    const allowedTypes = ['validate', 'mutation', 'forEach'];
    for (const proc of data.processes) {
      for (const step of proc.steps) {
        assert.ok(allowedTypes.includes(step.type),
          `Step "${step.name}" in "${proc.name}" uses disallowed type: ${step.type}`);
      }
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/processes-valid.test.js`
Expected: FAIL

**Step 3: Write processes.json**

Write the complete process definitions for `completeOrder` and `voidOrder` based on the TDD 4.4 example. Each process must have:
- `preconditions` — validation checks before execution
- `steps` — using only `validate`, `mutation`, `forEach` types with proper `operation` matching `step-operation.schema.json`
- `edgeCases` — at least 3 per process
- `transactional: true`

For `completeOrder`, the steps are (from TDD 4.4):
1. Validate preconditions (document has lines, status is DR/IP, lines have products, positive qty)
2. Assign document number (mutation)
3. Reserve inventory (forEach over lines)
4. Calculate tax (mutation with stub: `// TODO(vertical-slice): implement tax calculation`)
5. Post accounting (mutation with stub: `// TODO(vertical-slice): implement posting`)
6. Update status (mutation: documentStatus='CO', processed=true, documentAction='--')

For `voidOrder`:
1. Validate (status must be CO, not yet voided)
2. Reverse inventory (forEach over lines: set reservedQty to 0)
3. Reverse accounting (mutation stub)
4. Update status (mutation: documentStatus='VO', documentAction='--')

Edge cases for completeOrder:
1. Order with no lines → precondition fails
2. Line with zero quantity → precondition fails
3. Line without product → precondition fails
4. Accounting fails mid-process → full rollback

Edge cases for voidOrder:
1. Draft order → cannot void
2. Already voided order → cannot void again
3. Partial inventory return → all reserved qty must be released

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/processes-valid.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add artifacts/sales-order/processes.json cli/test/processes-valid.test.js
git commit -m "feat: add completeOrder + voidOrder process definitions (F5)"
```

---

### Task 8: Wave 1 Foundation — shared utilities

**Files:**
- Create: `cli/src/utils.js`
- Test: `cli/test/utils.test.js`

**Context:** Shared utilities used by multiple CLI tools: checksum calculation, version generation, file I/O helpers, and schema validation wrapper.

**Step 1: Write the test**

```javascript
// cli/test/utils.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeChecksum, generateVersion, toCamelCase } from '../src/utils.js';

describe('utils', () => {
  it('computeChecksum produces consistent hex hash', () => {
    const hash1 = computeChecksum('hello world');
    const hash2 = computeChecksum('hello world');
    assert.equal(hash1, hash2);
    assert.match(hash1, /^[0-9a-f]{8,}$/);
  });

  it('computeChecksum changes when input changes', () => {
    assert.notEqual(
      computeChecksum('hello'),
      computeChecksum('world')
    );
  });

  it('generateVersion returns semver format', () => {
    const v = generateVersion();
    assert.match(v, /^\d+\.\d+\.\d+$/);
  });

  it('toCamelCase converts column names', () => {
    assert.equal(toCamelCase('DocumentNo'), 'documentNo');
    assert.equal(toCamelCase('AD_Client_ID'), 'adClientId');
    assert.equal(toCamelCase('C_Order_ID'), 'cOrderId');
    assert.equal(toCamelCase('IsActive'), 'isActive');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/utils.test.js`
Expected: FAIL

**Step 3: Implement utils.js**

```javascript
// cli/src/utils.js
import { createHash } from 'node:crypto';

export function computeChecksum(data) {
  return createHash('sha256')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex')
    .substring(0, 8);
}

export function generateVersion() {
  return '0.1.0';
}

export function toCamelCase(columnName) {
  return columnName
    .replace(/_([A-Za-z])/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
}
```

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/utils.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/src/utils.js cli/test/utils.test.js
git commit -m "feat: add shared CLI utilities (checksum, version, camelCase)"
```

---

## Wave 2: Validators + Pre-classification

### Task 9: Schema Validator (F2a)

**Files:**
- Create: `cli/src/validate-schema.js`
- Test: `cli/test/validate-schema.test.js`

**Context:** Implements the 4-level validation from TDD 3.3:
- Level 1 — Structural: required fields, valid enums, no duplicates
- Level 2 — Semantic: entity references valid, FK fields have reference
- Level 3 — Visibility: system fields have derivation, no UI properties on system
- Level 4 — Cross-reference: every system field has derivation OR default OR kept rule

**Step 1: Write the test**

Test each validation level with valid and invalid inputs. Each test creates a minimal schema that triggers specific validation errors.

Test cases:
1. Valid minimal schema → 0 errors
2. Missing required field `window.name` → Level 1 error
3. Duplicate field names in same entity → Level 1 error
4. Invalid visibility value → Level 1 error
5. `primaryEntity` references nonexistent entity → Level 2 error
6. FK field without `reference` → Level 2 error
7. System field without derivation → Level 3 error
8. System field with `searchable: true` → Level 3 error
9. Orphaned field reference → Level 4 warning

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/validate-schema.test.js`
Expected: FAIL

**Step 3: Implement validate-schema.js**

Export `validateSchema(schema, rules?)` that returns `{ errors: [], warnings: [], level: 1-4 }`.
Run levels sequentially. If Level 1 fails, skip subsequent levels (data may be invalid).

Each error: `{ level, code, message, path, severity: 'error'|'warning' }`.

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/validate-schema.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/src/validate-schema.js cli/test/validate-schema.test.js
git commit -m "feat: implement 4-level Schema Validator (F2a)"
```

---

### Task 10: Process Validator (F2b)

**Files:**
- Create: `cli/src/validate-processes.js`
- Test: `cli/test/validate-processes.test.js`

**Context:** Validates process definitions: structure, coverage (preconditions, steps, edge cases), step types match allowed set, edge case minimum, and cross-references to schema entities.

**Step 1: Write the test**

Test cases:
1. Valid process definition → 0 errors
2. Process without preconditions → error
3. Process with < 3 edge cases → error
4. Step with invalid type (`compute` not in allowed set) → error
5. Step referencing nonexistent entity → error
6. forEach step without nested steps → error

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/validate-processes.test.js`
Expected: FAIL

**Step 3: Implement validate-processes.js**

Export `validateProcesses(processes, schema?)` returning `{ errors: [], warnings: [] }`.

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/validate-processes.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/src/validate-processes.js cli/test/validate-processes.test.js
git commit -m "feat: implement Process Validator (F2b)"
```

---

### Task 11: IA Pre-classification (F3)

**Files:**
- Create: `cli/src/pre-classify.js`
- Test: `cli/test/pre-classify.test.js`

**Context:** Takes `rules-raw.json`, applies deterministic auto-classification for simple cases (display/readOnly logic, simple validations, simple callouts without DML), and sends complex rules to Claude for recommendations. Output: rules with `tier: 'auto'|'human'` and `autoDecision` for auto-classified rules.

**Step 1: Write the test**

Test only the deterministic classification (no AI calls in tests):

1. displayLogic rule with simple expression → `tier: 'auto'`, `autoDecision: 'keep'`, `translatedExpression` set
2. displayLogic with framework calls → `tier: 'human'`, `decision: 'pending'`
3. Simple callout without DML, ≤2 effects → `tier: 'auto'`, `autoDecision: 'keep'`
4. Callout with DML → `tier: 'human'`, has `dmlWarning`
5. Complex callout (>2 effects) → `tier: 'human'`
6. Simple validation → `tier: 'auto'`
7. Classification summary counts match

```javascript
// cli/test/pre-classify.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { classifyRule, classifyRules } from '../src/pre-classify.js';

describe('classifyRule (deterministic)', () => {
  it('auto-keeps simple displayLogic', () => {
    const rule = {
      type: 'displayLogic',
      expression: "@IsSalesTransaction@='Y'",
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
    assert.equal(result.autoDecision, 'keep');
    assert.ok(result.translatedExpression);
  });

  it('escalates displayLogic with framework calls', () => {
    const rule = {
      type: 'displayLogic',
      expression: "OB.Utilities.checkRole()",
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
  });

  it('auto-keeps simple callout without DML', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: false,
      effects: [{ field: 'total', action: 'setValue' }]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
    assert.equal(result.autoDecision, 'keep');
  });

  it('escalates callout with DML', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: true,
      dmlWarning: 'Performs direct DB operations',
      effects: [{ field: 'total', action: 'setValue' }]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.ok(result.warnings);
  });
});

describe('classifyRules', () => {
  it('produces correct summary counts', () => {
    const rules = [
      { type: 'displayLogic', expression: "@A@='Y'", hasDmlOperations: false },
      { type: 'callout', complexity: 'high', hasDmlOperations: true,
        dmlWarning: 'DML', effects: [{}, {}, {}] },
    ];
    // classifyRules without AI (skipAi=true for testing)
    const result = classifyRules(rules, { skipAi: true });
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.autoClassified, 1);
    assert.equal(result.summary.humanReview, 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/pre-classify.test.js`
Expected: FAIL

**Step 3: Implement pre-classify.js**

Implement the deterministic classification from TDD 3.2 (`preClassifyRules`):
- `classifyRule(rule)` — applies tier logic, returns rule with tier/decision fields added
- `classifyRules(rules, options)` — orchestrates classification, writes `rules-classified.json`
- For complex rules (tier=human): the deterministic classifier marks them as `pending` with context

AI classification of complex rules is handled by a **Claude Code skill** (`/sf:classify-rules`), not by direct API calls. The skill:
1. Reads `rules-raw.json` and `schema-raw.json` from artifacts
2. Uses Claude's in-context reasoning to classify each complex rule
3. Writes recommendations back to `rules-classified.json`

This separation means the CLI does deterministic work only. AI work runs in Claude Code sessions via subagents invoking the skill.

**Step 3b: Create the `/sf:classify-rules` skill**

Create: `.claude/skills/classify-rules.md`

```markdown
---
name: classify-rules
description: Classify complex business rules using AI reasoning
---

Read `artifacts/{window}/rules-raw.json` and `artifacts/{window}/schema-raw.json`.

For each rule with `tier: 'human'` and `decision: 'pending'`:
1. Analyze the rule's effects, complexity, DML operations, and Java source analysis
2. Consider the schema context (which fields are affected, their visibility)
3. Produce a classification following TDD 9.2 prompt format:
   - recommendation: keep|replace|simplify|omit
   - confidence: 0-1
   - businessDescription: plain language explanation
   - impactIfOmitted: what changes for the user
   - simplificationSuggestion: what to keep if simplify

Write the classified rules to `artifacts/{window}/rules-classified.json`.
Preserve all auto-classified rules unchanged.
```

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/pre-classify.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/src/pre-classify.js cli/test/pre-classify.test.js
git commit -m "feat: implement IA Pre-classification (F3) with deterministic + AI tiers"
```

---

## Wave 3: Decision Panel + Contract Generator

### Task 12: Decision Panel — React Web UI (F4)

**Files:**
- Create: `tools/decision-panel/package.json`
- Create: `tools/decision-panel/index.html`
- Create: `tools/decision-panel/vite.config.js`
- Create: `tools/decision-panel/src/main.jsx`
- Create: `tools/decision-panel/src/App.jsx`
- Create: `tools/decision-panel/src/components/FieldEditor.jsx`
- Create: `tools/decision-panel/src/components/RuleCatalog.jsx`
- Create: `tools/decision-panel/src/components/ImpactWarning.jsx`

**Context:** Combined Decision Editor + Rule Catalog in a single web UI (per design simplification). The human reviews auto-classified fields and rules, confirms or changes visibility/decisions, and saves curated artifacts.

This is a web tool — no unit tests for React components in the vertical slice. The "test" is that the tool loads, renders data, and saves valid JSON.

**Step 1: Create package.json**

```json
{
  "name": "@schema-forge/decision-panel",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

**Step 2: Create Vite config**

```javascript
// tools/decision-panel/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 }
});
```

**Step 3: Create index.html entry point**

Standard Vite React template: `<div id="root">`, script src `src/main.jsx`.

**Step 4: Create main.jsx**

```jsx
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
```

**Step 5: Implement App.jsx**

Top-level component that:
1. Loads `schema-raw.json` and `rules-raw.json` from a file input (or from `/artifacts/` via fetch if dev server proxies)
2. Renders two panels: FieldEditor (left) and RuleCatalog (right)
3. Tracks all changes in a decisions log
4. Has a "Save" button that produces `schema-curated.json`, `rules-curated.json`, and `decisions-log.json`

**Step 6: Implement FieldEditor.jsx**

Table showing all fields grouped by entity. Each field row shows:
- Name, column, current visibility (editable dropdown: editable/readOnly/system/discarded)
- For system fields: systemCategory and derivation
- Impact warning when changing visibility to `discarded`
- Color coding: green=editable, blue=readOnly, gray=system, red=discarded

**Step 7: Implement RuleCatalog.jsx**

Table showing all rules. Each row shows:
- Rule name, type, tier (auto/human badge)
- For auto: the auto-decision (Keep) with option to override
- For human: decision dropdown (Keep/Replace/Simplify/Omit) with required justification for Omit
- AI recommendation displayed as hint text
- Complexity indicator (low/medium/high)
- DML warning badge if applicable
- Impact messages from `impact-messages.json`

**Step 8: Implement ImpactWarning.jsx**

Modal that shows when a user is about to discard a field or omit a rule. Displays the impact message from `impact-messages.json` and requires confirmation.

**Step 9: Install dependencies and verify dev server starts**

Run: `cd tools/decision-panel && npm install && npm run dev`
Expected: Vite dev server starts on port 3000

**Step 10: Commit**

```bash
git add tools/decision-panel/
git commit -m "feat: implement Decision Panel web UI (F4) — field editor + rule catalog"
```

---

### Task 13: Contract Generator (F6)

**Files:**
- Create: `cli/src/generate-contract.js`
- Test: `cli/test/generate-contract.test.js`
- Output: `artifacts/sales-order/contract.json` (generated at runtime)

**Context:** Takes curated schema + curated rules + processes and generates the contract JSON (TDD 2.4) plus a test manifest of ~245 auto-generated tests. The contract has `frontendContract` (visible fields, types, actions, filters) and `backendContract` (all fields, endpoints, process endpoints).

**Step 1: Write the test**

Test with a minimal curated schema (2 entities, 5 fields each, 2 rules, 1 process):

1. `generateFrontendContract(schema)` — only includes non-system fields, maps types to TS
2. `generateBackendContract(schema, rules, processes)` — includes all fields, endpoints, process endpoints
3. `generateTestManifest(frontendContract, backendContract, rules, processes)` — generates test entries by category
4. Test counts: for N visible fields, expect N field-presence tests + N field-type tests. For M searchable fields, expect M searchable-filter tests. For each process, expect happy + failure + rollback tests.
5. Searchable filter test generation follows TDD 3.4 logic exactly

```javascript
// cli/test/generate-contract.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateFrontendContract,
  generateBackendContract,
  generateTestManifest
} from '../src/generate-contract.js';

const minimalSchema = {
  version: '0.1.0',
  window: { id: '143', name: 'Sales Order', primaryEntity: 'order', category: 'sales' },
  entities: [{
    name: 'order',
    table: 'C_Order',
    level: 'header',
    fields: [
      { name: 'documentNo', column: 'DocumentNo', type: 'string', visibility: 'readOnly',
        required: true, searchable: true, grid: true, form: true },
      { name: 'dateOrdered', column: 'DateOrdered', type: 'date', visibility: 'editable',
        required: true, searchable: true, grid: true, form: true },
      { name: 'adClientId', column: 'AD_Client_ID', type: 'id', visibility: 'system',
        systemCategory: 'internal', derivation: { type: 'fromConfig', source: 'context.client' },
        required: true, searchable: false, grid: false, form: false },
    ]
  }]
};

describe('generateFrontendContract', () => {
  it('excludes system fields', () => {
    const fc = generateFrontendContract(minimalSchema);
    const orderFields = fc.entities.order.fields;
    assert.ok(orderFields.find(f => f.name === 'documentNo'));
    assert.ok(!orderFields.find(f => f.name === 'adClientId'));
  });

  it('includes searchable fields list', () => {
    const fc = generateFrontendContract(minimalSchema);
    assert.ok(fc.entities.order.searchableFields.includes('documentNo'));
    assert.ok(fc.entities.order.searchableFields.includes('dateOrdered'));
  });
});

describe('generateTestManifest', () => {
  it('generates field-presence test for each visible field', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, [], []);
    const manifest = generateTestManifest(fc, bc, [], []);
    const presenceTests = manifest.tests.filter(t => t.category === 'field-presence');
    assert.equal(presenceTests.length, 2); // documentNo + dateOrdered (not system)
  });

  it('generates searchable-filter tests', () => {
    const fc = generateFrontendContract(minimalSchema);
    const bc = generateBackendContract(minimalSchema, [], []);
    bc.endpoints = [{ entity: 'order', method: 'GET', path: '/orders',
      supportedFilters: ['documentNo', 'dateOrdered'] }];
    const manifest = generateTestManifest(fc, bc, [], []);
    const filterTests = manifest.tests.filter(t => t.category === 'searchable-filters');
    assert.ok(filterTests.length >= 2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/generate-contract.test.js`
Expected: FAIL

**Step 3: Implement generate-contract.js**

Implement all functions following TDD 2.4 and 3.4:
- `generateFrontendContract(schema)` — builds entity maps with only visible fields, TS types, searchable fields, computed fields
- `generateBackendContract(schema, rules, processes)` — all fields, endpoints with filters, process endpoints
- `generateTestManifest(fc, bc, rules, processes)` — generates test entries by category per TDD 3.4 table
- `generateContract(schema, rules, processes)` — orchestrates, adds checksums and version

Test generation categories (from TDD 3.4):
- field-presence, field-type, system-field, visibility, form-completeness (Node.js)
- rule-declared, searchable-filters (Node.js)
- interface-match, type-compatibility (Node.js)
- required-validation, system-derivation, business-rule, rule-behavior (JUnit)
- process-happy, process-failure, process-rollback, process-edge (JUnit)
- rule-parity (JUnit)
- window-permission, process-permission (JUnit)

**Step 4: Run test to verify it passes**

Run: `node --test cli/test/generate-contract.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add cli/src/generate-contract.js cli/test/generate-contract.test.js
git commit -m "feat: implement Contract Generator (F6) with test manifest"
```

---

## Wave 4: Backend Generator + UI Generator

### Task 14: Handlebars Templates

**Files:**
- Create: `templates/EventHandler.java.hbs`
- Create: `templates/DalProcess.java.hbs`
- Create: `templates/RxEndpoint.java.hbs`
- Create: `templates/DTO.java.hbs`
- Create: `templates/dataset.xml.hbs`
- Create: `templates/build.gradle.hbs`
- Create: `templates/ErrorSerializer.java.hbs`
- Create: `templates/PreconditionValidator.java.hbs`
- Test: `cli/test/templates.test.js`

**Context:** Handlebars templates for Java code generation. Per Decision D5 (Option A), templates generate structure + preconditions + dispatch. Complex logic gets `// TODO(vertical-slice): implement` stubs.

**Step 1: Write the test**

Test that templates compile and produce valid-looking Java from sample data:

```javascript
// cli/test/templates.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, '../../templates');

async function compileTemplate(name) {
  const source = await readFile(resolve(templatesDir, name), 'utf8');
  return Handlebars.compile(source);
}

describe('Handlebars templates', () => {
  it('EventHandler.java.hbs compiles and generates valid Java', async () => {
    const template = await compileTemplate('EventHandler.java.hbs');
    const result = template({
      package: 'com.etendo.schemaforge.salesorder',
      className: 'OrderDerivationHandler',
      entityName: 'Order',
      entityClass: 'org.openbravo.model.common.order.Order',
      schemaVersion: 'v1',
      schemaChecksum: 'a4b8c2d1',
      derivations: [
        { field: 'organization', getter: 'getOrganization', setter: 'setOrganization',
          type: 'fromConfig', source: 'OBContext.getOBContext().getCurrentOrganization()',
          checkNull: true }
      ]
    });
    assert.ok(result.includes('public class OrderDerivationHandler'));
    assert.ok(result.includes('GENERATED BY SCHEMA FORGE'));
    assert.ok(result.includes('setOrganization'));
  });

  it('DalProcess.java.hbs generates process with preconditions', async () => {
    const template = await compileTemplate('DalProcess.java.hbs');
    const result = template({
      package: 'com.etendo.schemaforge.salesorder',
      className: 'CompleteOrderProcess',
      entityClass: 'org.openbravo.model.common.order.Order',
      preconditions: [
        { assertion: 'order.getOrderLineList().isEmpty()',
          negate: true, errorMessage: '@CannotCompleteWithoutLines@' }
      ],
      steps: [
        { name: 'assignDocumentNo', stub: false,
          code: 'order.setDocumentNo(FIN_Utility.getDocumentNo(...));' },
        { name: 'calculateTax', stub: true,
          comment: 'TODO(vertical-slice): implement tax calculation' }
      ]
    });
    assert.ok(result.includes('CompleteOrderProcess'));
    assert.ok(result.includes('CannotCompleteWithoutLines'));
    assert.ok(result.includes('TODO(vertical-slice)'));
  });

  it('DTO.java.hbs generates DTO with only visible fields', async () => {
    const template = await compileTemplate('DTO.java.hbs');
    const result = template({
      package: 'com.etendo.schemaforge.salesorder',
      className: 'OrderDTO',
      version: 1,
      fields: [
        { name: 'documentNo', type: 'String', getter: 'getDocumentNo', setter: 'setDocumentNo' },
        { name: 'dateOrdered', type: 'Date', getter: 'getDateOrdered', setter: 'setDateOrdered' }
      ]
    });
    assert.ok(result.includes('public class OrderDTO'));
    assert.ok(result.includes('getDocumentNo'));
    assert.ok(!result.includes('adClientId')); // system field excluded
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test cli/test/templates.test.js`
Expected: FAIL

**Step 3: Add handlebars dependency**

```bash
cd cli && npm install handlebars
```

**Step 4: Create all template files**

Create each `.hbs` template based on the TDD code examples (sections 4.2-4.6). Templates should:
- Include the file header from TDD 7.1 (GENERATED BY SCHEMA FORGE, schema version, checksums, generation date)
- Use `{{#each derivations}}` loops for event handler fields
- Use `{{#each preconditions}}` for process validation
- Use `{{#if stub}}` to toggle between real code and `// TODO(vertical-slice)` comments
- Include guard clause for Hibernate dirty checking (RT-10): `if (event.getCurrentState(prop) == event.getPreviousState(prop)) return;`
- Include org-level filter in endpoints (RT-5): `crit.add(Restrictions.in("organization.id", OBContext.getOBContext().getReadableOrganizations()));`

**Step 5: Run test to verify it passes**

Run: `node --test cli/test/templates.test.js`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add templates/ cli/test/templates.test.js cli/package.json
git commit -m "feat: add Handlebars templates for Java code generation"
```

---

### Task 15: Backend Generator (F7)

**Files:**
- Create: `cli/src/generate-backend.js`
- Test: `cli/test/generate-backend.test.js`
- Create: `cli/src/uuid-manifest.js`

**Context:** Takes curated schema + rules + processes + contract and generates a complete Etendo module: Java source, XML datasets, build.gradle. Uses Handlebars templates and the UUID manifest (Decision D10: random but registered).

**Step 1: Write the test for UUID manifest**

```javascript
// cli/test/uuid-manifest.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { getOrCreateUuid, loadManifest, saveManifest } from '../src/uuid-manifest.js';

describe('uuid-manifest', () => {
  it('generates and returns consistent UUIDs', () => {
    const manifest = {};
    const uuid1 = getOrCreateUuid(manifest, 'AD_Process', 'completeOrder');
    const uuid2 = getOrCreateUuid(manifest, 'AD_Process', 'completeOrder');
    assert.equal(uuid1, uuid2);
    assert.match(uuid1, /^[0-9a-f]{32}$/i);
  });

  it('generates different UUIDs for different keys', () => {
    const manifest = {};
    const uuid1 = getOrCreateUuid(manifest, 'AD_Process', 'completeOrder');
    const uuid2 = getOrCreateUuid(manifest, 'AD_Process', 'voidOrder');
    assert.notEqual(uuid1, uuid2);
  });
});
```

**Step 2: Implement uuid-manifest.js**

```javascript
// cli/src/uuid-manifest.js
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export function getOrCreateUuid(manifest, entityType, key) {
  const fullKey = `${entityType}:${key}`;
  if (!manifest[fullKey]) {
    manifest[fullKey] = randomUUID().replace(/-/g, '').toUpperCase();
  }
  return manifest[fullKey];
}

export async function loadManifest(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch { return {}; }
}

export async function saveManifest(path, manifest) {
  await writeFile(path, JSON.stringify(manifest, null, 2));
}
```

**Step 3: Write the test for generate-backend**

Test the orchestrator with minimal inputs:
1. Generates correct directory structure
2. Event handlers include all system field derivations
3. Processes include preconditions from process definitions
4. DTOs include only visible fields
5. Endpoints include org-level filters
6. build.gradle has correct module name and dependencies
7. UUID manifest is populated and consistent across runs

**Step 4: Implement generate-backend.js**

Main orchestrator that:
1. Loads all Handlebars templates
2. Prepares template data from schema/rules/processes/contract
3. Generates Java files: EventHandlers, Processes, DTOs, Endpoints, Validators, ErrorSerializer
4. Generates XML: dataset, AD_Process, AD_Window_Access
5. Generates build.gradle
6. Writes everything to `artifacts/{window}/generated/`
7. Updates UUID manifest

**Step 5: Run tests**

Run: `node --test cli/test/uuid-manifest.test.js cli/test/generate-backend.test.js`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add cli/src/generate-backend.js cli/src/uuid-manifest.js cli/test/generate-backend.test.js cli/test/uuid-manifest.test.js
git commit -m "feat: implement Backend Generator (F7) with UUID manifest"
```

---

### Task 16: UI Generator (F8) — Claude Code Skill + Preview

**Files:**
- Create: `.claude/skills/generate-ui.md`
- Create: `tools/ui-preview/package.json`
- Create: `tools/ui-preview/index.html`
- Create: `tools/ui-preview/vite.config.js`
- Create: `tools/ui-preview/src/main.jsx`
- Create: `tools/ui-preview/src/App.jsx`
- Create: `cli/src/build-ui-context.js`
- Test: `cli/test/build-ui-context.test.js`

**Context:** Per Decision D7 (basic conversational AI), the UI Generator is split into two parts:
1. A **Claude Code skill** (`/sf:generate-ui`) — the user describes what they want in natural language, Claude generates React components in-context
2. A **preview tool** (Vite app) — renders the generated components in a sandboxed iframe with Babel standalone + mock data

No direct API calls. The user runs `/sf:generate-ui` in Claude Code, describes the UI they want, and Claude writes the React components to `artifacts/{window}/generated/web/`.

**Step 1: Create the `/sf:generate-ui` skill**

```markdown
---
name: generate-ui
description: Generate React UI components from curated schema via conversational AI
---

Read the curated schema and process definitions:
- `artifacts/{window}/schema-curated.json`
- `artifacts/{window}/rules-curated.json`
- `artifacts/{window}/processes.json`

SCHEMA CONSTRAINTS (INVIOLABLE):
- Only render fields with visibility: editable or readOnly
- System fields NEVER appear in UI
- ReadOnly fields render as non-editable
- Computed fields are never editable
- Only searchable fields can be used as filters/search
- CascadeFrom relationships must be respected (cascading dropdowns)
- Never invent fields not in schema

GENERATION RULES:
- Inline styles + base React (no external UI library)
- Self-contained default export per component
- Components target the versioned API endpoints from the contract
- Mock data generated from schema for preview mode

Ask the user what kind of UI they want (e.g., "Order list with filters and detail form").
Generate React components and write them to `artifacts/{window}/generated/web/{window}/`.

After generating, tell the user to run `cd tools/ui-preview && npm run dev` to preview.
```

**Step 2: Write the test for build-ui-context.js**

```javascript
// cli/test/build-ui-context.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildUiContext } from '../src/build-ui-context.js';

describe('buildUiContext', () => {
  it('excludes system fields from visible entities', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'documentNo', visibility: 'readOnly', type: 'string', searchable: true, label: 'Document No' },
          { name: 'adClientId', visibility: 'system', type: 'id', searchable: false }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.ok(context.visibleEntities.order.fields.find(f => f.name === 'documentNo'));
    assert.ok(!context.visibleEntities.order.fields.find(f => f.name === 'adClientId'));
  });

  it('includes searchable fields list', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'documentNo', visibility: 'readOnly', type: 'string', searchable: true, label: 'Doc' },
          { name: 'notes', visibility: 'editable', type: 'text', searchable: false, label: 'Notes' }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.deepEqual(context.visibleEntities.order.searchableFields, ['documentNo']);
  });

  it('includes process actions', () => {
    const processes = {
      processes: [
        { name: 'completeOrder', displayName: 'Complete Order',
          trigger: { type: 'action', endpoint: '/api/orders/{id}/complete', method: 'POST' } }
      ]
    };
    const context = buildUiContext({ entities: [] }, [], processes);
    assert.equal(context.actions.length, 1);
    assert.equal(context.actions[0].name, 'completeOrder');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `node --test cli/test/build-ui-context.test.js`
Expected: FAIL

**Step 4: Implement build-ui-context.js**

```javascript
// cli/src/build-ui-context.js
export function buildUiContext(schema, rules, processes) {
  const visibleEntities = {};
  for (const entity of (schema.entities || [])) {
    const visibleFields = (entity.fields || [])
      .filter(f => f.visibility !== 'system')
      .map(f => ({
        name: f.name, type: f.type, required: f.required,
        editable: f.visibility === 'editable',
        readOnly: f.visibility === 'readOnly',
        label: f.label
      }));
    visibleEntities[entity.name] = {
      fields: visibleFields,
      searchableFields: (entity.fields || [])
        .filter(f => f.searchable).map(f => f.name)
    };
  }

  const actions = (processes?.processes || []).map(p => ({
    name: p.name,
    displayName: p.displayName,
    endpoint: p.trigger?.endpoint,
    method: p.trigger?.method
  }));

  return { visibleEntities, actions };
}
```

**Step 5: Run test to verify it passes**

Run: `node --test cli/test/build-ui-context.test.js`
Expected: All tests PASS

**Step 6: Create the preview tool (minimal Vite app)**

`tools/ui-preview/` — a simple Vite app that:
1. Reads generated components from `artifacts/{window}/generated/web/`
2. Renders them in a sandboxed iframe with React 18 + Babel standalone
3. Uses mock data from schema

```json
{
  "name": "@schema-forge/ui-preview",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.0", "vite": "^6.0.0" }
}
```

App.jsx: File picker or auto-loads from `artifacts/sales-order/generated/web/`. Renders in iframe with Babel standalone.

**Step 7: Install and verify preview starts**

Run: `cd tools/ui-preview && npm install && npm run dev`
Expected: Vite dev server starts

**Step 8: Commit**

```bash
git add .claude/skills/generate-ui.md tools/ui-preview/ cli/src/build-ui-context.js cli/test/build-ui-context.test.js
git commit -m "feat: implement UI Generator (F8) — Claude Code skill + preview tool"
```

---

## Wave 5: Integration + End-to-End Verification

### Task 17: Contract Test Runner

**Files:**
- Create: `cli/src/run-contract-tests.js`
- Test: `cli/test/run-contract-tests.test.js`

**Context:** Reads `contract.json`, generates and runs Node.js contract tests against the contract data. These verify structural correctness without needing a backend.

**Step 1: Write the test**

Using a minimal contract, verify:
- Field presence tests pass when fields exist in contract
- Field type tests pass when types match
- Searchable filter tests pass when filters are declared
- A missing field causes a test failure

**Step 2: Implement run-contract-tests.js**

Reads `contract.json`, generates test assertions from `testManifest`, runs them using `node:test` programmatic API. Outputs TAP results.

**Step 3: Run test**

Run: `node --test cli/test/run-contract-tests.test.js`
Expected: PASS

**Step 4: Commit**

```bash
git add cli/src/run-contract-tests.js cli/test/run-contract-tests.test.js
git commit -m "feat: implement contract test runner for Node.js tests"
```

---

### Task 18: End-to-End Pipeline Script

**Files:**
- Create: `cli/src/pipeline.js`
- Modify: `cli/package.json` (add bin scripts)

**Context:** Orchestrates the full pipeline: extract → validate → pre-classify → (human decisions) → generate contract → generate backend. The human decision step is interactive (opens the Decision Panel).

**Step 1: Add bin scripts to cli/package.json**

```json
{
  "bin": {
    "sf-extract": "./src/extract-fields.js",
    "sf-extract-rules": "./src/extract-rules.js",
    "sf-validate": "./src/validate-schema.js",
    "sf-classify": "./src/pre-classify.js",
    "sf-contract": "./src/generate-contract.js",
    "sf-generate": "./src/generate-backend.js",
    "sf-pipeline": "./src/pipeline.js",
    "sf-test": "./src/run-contract-tests.js"
  }
}
```

**Step 2: Implement pipeline.js**

```javascript
#!/usr/bin/env node
// cli/src/pipeline.js
// Orchestrates the full Schema Forge pipeline

import { extractFields } from './extract-fields.js';
import { extractRules } from './extract-rules.js';
import { validateSchema } from './validate-schema.js';
import { validateProcesses } from './validate-processes.js';
import { classifyRules } from './pre-classify.js';
import { generateContract } from './generate-contract.js';
import { generateBackend } from './generate-backend.js';

const windowId = process.argv[2];
const windowName = process.argv[3] || 'sales-order';

async function run() {
  console.log(`\n=== Schema Forge Pipeline: ${windowName} ===\n`);

  // Phase 1: Extract
  console.log('Phase 1a: Extracting fields...');
  const schema = await extractFields(windowId, windowName);
  console.log(`  → ${schema.entities.reduce((sum, e) => sum + e.fields.length, 0)} fields extracted`);

  console.log('Phase 1b: Extracting rules...');
  const rules = await extractRules(windowId, windowName);
  console.log(`  → ${rules.rules.length} rules extracted`);

  // Phase 2: Validate
  console.log('Phase 2: Validating...');
  const schemaResult = validateSchema(schema);
  const processResult = validateProcesses(
    JSON.parse(await readFile(`artifacts/${windowName}/processes.json`, 'utf8')),
    schema
  );
  if (schemaResult.errors.length > 0 || processResult.errors.length > 0) {
    console.error('Validation failed. Fix errors before continuing.');
    process.exit(1);
  }
  console.log('  → Validation passed');

  // Phase 3: Pre-classify (deterministic only)
  console.log('Phase 3: Pre-classifying rules (deterministic)...');
  const classified = await classifyRules(rules.rules);
  console.log(`  → ${classified.summary.autoClassified} auto, ${classified.summary.humanReview} human`);
  console.log('  → For AI classification of complex rules, run: /sf:classify-rules');

  // Phase 4: Human decisions (interactive)
  console.log('\nPhase 4: Open Decision Panel at http://localhost:3000');
  console.log('  Save curated artifacts, then press Enter to continue...');
  // Wait for user to complete decisions in the web UI

  // Phase 6: Generate contract
  console.log('Phase 6: Generating contract...');
  const contract = generateContract(schema, rules, processes);
  console.log(`  → ${contract.testManifest.tests.length} tests generated`);

  // Phase 7: Generate backend
  console.log('Phase 7: Generating backend...');
  await generateBackend(schema, rules, processes, contract, windowName);
  console.log('  → Module generated');

  console.log('\n=== Pipeline complete ===');
}

run().catch(err => { console.error(err); process.exit(1); });
```

**Step 3: Commit**

```bash
git add cli/src/pipeline.js cli/package.json
git commit -m "feat: add end-to-end pipeline orchestrator"
```

---

### Task 19: Run extractors against real Etendo (AB-1)

**Prerequisite:** `.env` file with real Etendo DB credentials.

**Step 1: Create .env from .env.example**

Copy `.env.example` to `.env` and fill in the real DB credentials. This file is gitignored.

**Step 2: Run Field Extractor against real Etendo**

Run: `node cli/src/extract-fields.js 143 sales-order`
Expected: `artifacts/sales-order/schema-raw.json` created with all Sales Order fields

**Step 3: Inspect output**

Verify `schema-raw.json` has:
- Window name: "Sales Order"
- At least 2 entities (Order header + Order Line)
- Order entity has 40+ fields
- System columns correctly classified
- AD_Reference types correctly mapped

**Step 4: Run Rule Extractor against real Etendo**

Run: `ETENDO_SOURCE_DIR=/path/to/etendo/src node cli/src/extract-rules.js 143 sales-order`
Expected: `artifacts/sales-order/rules-raw.json` created

**Step 5: Save raw query results (AB-1 deliverable)**

```bash
mkdir -p artifacts/sales-order/raw-query-results
cp artifacts/sales-order/schema-raw.json artifacts/sales-order/raw-query-results/
cp artifacts/sales-order/rules-raw.json artifacts/sales-order/raw-query-results/
```

**Step 6: Commit raw results**

```bash
git add artifacts/sales-order/raw-query-results/
git commit -m "feat: save raw extraction results from real Etendo (AB-1)"
```

---

### Task 20: Run validators and verify end-to-end

**Step 1: Validate schema**

Run: `node cli/src/validate-schema.js artifacts/sales-order/schema-raw.json`
Expected: Level 1-4 validation results. Fix any errors in the extractor.

**Step 2: Pre-classify rules**

Run: `node cli/src/pre-classify.js artifacts/sales-order/rules-raw.json`
Expected: Rules classified with summary showing auto vs human split

**Step 3: Run full contract test suite**

Run: `node cli/src/run-contract-tests.js artifacts/sales-order/contract.json`
Expected: All contract tests pass

**Step 4: Verify generated module structure**

Check that `artifacts/sales-order/generated/` contains:
- `build.gradle`
- `src/main/java/` with expected Java files
- `referencedata/standard/` with XML
- `web/salesorder/` with React files (after UI Generator)

**Step 5: Commit final state**

```bash
git add artifacts/sales-order/
git commit -m "feat: complete vertical slice — all artifacts generated for Sales Order"
```

---

## Summary of All Tasks

| Wave | Task | Component | Est. Size |
|------|------|-----------|-----------|
| 0 | 1 | npm workspaces monorepo | Small |
| 0 | 2 | core-maps (static config) | Small |
| 0 | 3 | JSON Schemas (6 files) | Medium |
| 0 | 4 | DB connection utility | Small |
| 1 | 5 | Field Extractor (F1a) | Large |
| 1 | 6 | Rule Extractor (F1b) | Large |
| 1 | 7 | Process Definitions (F5) | Medium |
| 1 | 8 | Shared utilities | Small |
| 2 | 9 | Schema Validator (F2a) | Medium |
| 2 | 10 | Process Validator (F2b) | Medium |
| 2 | 11 | IA Pre-classification (F3) | Medium |
| 3 | 12 | Decision Panel UI (F4) | Large |
| 3 | 13 | Contract Generator (F6) | Large |
| 4 | 14 | Handlebars Templates | Medium |
| 4 | 15 | Backend Generator (F7) | Large |
| 4 | 16 | UI Generator (F8) | Large |
| 5 | 17 | Contract Test Runner | Medium |
| 5 | 18 | Pipeline Orchestrator | Small |
| 5 | 19 | Run against real Etendo | Small |
| 5 | 20 | End-to-end verification | Small |

**Total: 20 tasks across 6 waves**

**Dependency chain:** Wave 0 → Wave 1 (parallel) → Wave 2 → Wave 3 → Wave 4 → Wave 5

**Parallelization within waves:**
- Wave 0: Tasks 1-4 sequential (foundation)
- Wave 1: Tasks 5, 6, 7, 8 can run in parallel (4 developers)
- Wave 2: Tasks 9, 10 parallel; Task 11 depends on 9+10
- Wave 3: Tasks 12, 13 can be parallel
- Wave 4: Tasks 14 then 15 sequential; Task 16 parallel with 14-15
- Wave 5: Tasks 17-20 sequential (integration)
