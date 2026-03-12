---
name: classify
description: Use when classifying schema fields or business rules for a window. Triggers on classify window, classify fields, classify rules, curate schema, curate rules, pre-classify. AI-guided replacement for manual Decision Panel.
---

# Schema & Rules Classification

Unified classification skill for Schema Forge. You ARE the classifier — no external API calls needed.

## Invocation

```
/sf:classify <windowName>
/sf:classify sales-order
/sf:classify product --schema-only
/sf:classify sales-order --rules-only
```

If no window name provided, ask the user which window to classify.

## Full Pipeline

Classification is NOT a standalone step. It triggers a full pipeline:

```
LOCK → CLASSIFY → CONTRACT → CHECK-VERSION → GENERATE-FRONTEND → TESTS
```

Every `/classify` invocation ends with generated, tested, version-checked code.

## Prerequisites

### Step 0: Window Lock (MANDATORY)

Before ANY classification work, verify the window is locked by the current user:

```bash
node cli/src/lock-window.js check --window {windowName} --owner {gitUser}
```

If NOT locked → STOP. Tell the user:
```
Window "{windowName}" is not locked. Lock it first:
  node cli/src/lock-window.js lock --window {windowName} --owner {yourName} --reason "Classifying fields and rules"
```

Do NOT proceed without a lock. This prevents two people classifying the same window simultaneously.

### Step 0b: Verify input files exist

| File | Required for | What if missing |
|------|-------------|-----------------|
| `artifacts/{window}/schema-raw.json` | Schema classification | STOP — run extraction first: `node cli/src/extract-fields.js <windowId> <windowName>` |
| `artifacts/{window}/rules-raw.json` | Rules classification | Skip rules phase (some windows have no rules) |
| `core-maps/system-columns.json` | Schema classification | STOP — critical reference file |

Read all required files before starting classification.

## Phase 1: Schema Classification

Transform `schema-raw.json` into `schema-curated.json`.

### Step 1: Load reference data

```
Read: core-maps/system-columns.json
Read: artifacts/{window}/schema-raw.json
```

Count total fields across all entities. Report: "Found {N} fields in {M} entities."

### Step 2: Deterministic classification (Nivel 1)

For EACH field in EACH entity, apply these rules IN ORDER:

**System columns (from system-columns.json):**
```
IF field.columnName matches a key in system-columns.json:
  → visibility: "system"
  → grid: false, form: false, searchable: false
  → derivation: from system-columns.json
  → tier: "auto"
```

**Audit columns (pattern match):**
```
IF field.columnName IN (Created, CreatedBy, Updated, UpdatedBy):
  → visibility: "system"
  → derivation: { type: "computed", expression: "now()" } (for dates)
  → tier: "auto"
```

**Known discard patterns:**
```
IF field.columnName matches:
  - EMxx_ prefix (module-specific extensions not in scope)
  - Copy, CopyFrom, CopyFromPO columns
  → visibility: "discarded"
  → tier: "auto"
```

Report count: "{N} fields auto-classified as system/discarded"

### Step 3: Heuristic classification (Nivel 2)

For remaining unclassified fields:

**Foreign keys:**
```
IF field.type === "foreignKey":
  → visibility: "editable"
  → grid: true (if field appears in first 8 FK fields by sequence)
  → form: true
  → Determine inputMode:
    - reference.type === "TableDir" → "selector"
    - reference.type === "Table" with filter → "search"
    - reference.type === "Search" → "search"
    - Has cascade dependency → "dependent"
  → tier: "auto"
```

**Booleans:**
```
IF field.type === "boolean" AND NOT system:
  → visibility: "readOnly" (most booleans are display-only in simplified UI)
  → grid: true, form: true
  → tier: "auto"
```

**Required fields:**
```
IF field.mandatory === true AND NOT system AND NOT FK:
  → visibility: "editable"
  → grid: true, form: true
  → tier: "auto"
```

Report count: "{N} fields classified by heuristics"

### Step 4: AI classification (Nivel 3)

For remaining fields, YOU (Claude) decide based on:

1. **Field name and label** — Does it sound user-facing?
2. **Data type** — Amounts, dates, strings are usually editable
3. **Is it mandatory?** — Required fields should usually be editable
4. **Column name patterns** — e.g., `XXX_Rule` fields are usually configs, not user input
5. **Sequence in tab** — Earlier fields are more important (grid: true)
6. **Context from the window** — A "Sales Order" window needs different fields than "Product"

For each field, decide:
- `visibility`: editable | readOnly | discarded
- `grid`: true | false (show in list view — max ~8 columns recommended)
- `form`: true | false (show in detail form)
- `searchable`: true | false (available as filter — max ~5 recommended)

**Confidence tracking:**
- HIGH confidence: clear-cut decision (name, description, required date → editable)
- LOW confidence: ambiguous fields → flag for human review

Report:
```
AI classified: {N} fields (high confidence)
Flagged for review: {M} fields (low confidence)
```

### Step 5: Human review (flagged fields only)

If there are LOW confidence fields, present them to the user:

```
These {M} fields need your input:

1. PaymentRule (List: cash/credit/check)
   My suggestion: editable (users choose payment method)
   → editable / readOnly / discarded?

2. FreightCostRule (List: freight rules)
   My suggestion: discarded (rarely used in simplified UI)
   → editable / readOnly / discarded?
```

Wait for user response. Apply their decisions.

### Step 6: Write schema-curated.json

Build the curated schema with this structure:

```json
{
  "version": "0.1.0",
  "window": {
    "id": "{from schema-raw}",
    "name": "{from schema-raw}",
    "primaryEntity": "{first entity name, simplified}",
    "category": "{sales|purchases|inventory|accounting|reference|hr|crm}"
  },
  "entities": [
    {
      "name": "{simplified entity name — e.g., 'order' not 'cOrder'}",
      "tableName": "{from schema-raw}",
      "fields": [
        {
          "name": "{camelCase field name}",
          "column": "{original column name}",
          "type": "string|foreignKey|amount|boolean|date|datetime|number|id",
          "visibility": "editable|readOnly|system|discarded",
          "required": true|false,
          "grid": true|false,
          "form": true|false,
          "searchable": true|false,
          // FK fields only:
          "reference": "{CatalogName}",
          "inputMode": "selector|search|dependent",
          "dependsOn": { "field": "...", "filterKey": "..." },
          // System fields only:
          "derivation": { "type": "...", "source": "..." }
        }
      ]
    }
  ]
}
```

**Entity name simplification rules:**
- Remove table prefix: `cOrder` → `order`, `cOrderLine` → `orderLine`
- Remove `c_`, `m_`, `ad_` prefixes
- Use camelCase

**Field name rules:**
- Already in camelCase from extraction (e.g., `businessPartner`)
- If not, apply: `C_BPartner_ID` → `businessPartner` (strip prefix, strip _ID, camelCase)

Write to `artifacts/{window}/schema-curated.json`.

---

## Phase 2: Rules Classification

Transform `rules-raw.json` into `rules-curated.json`.

### Step 1: Load rules

```
Read: artifacts/{window}/rules-raw.json
```

If file doesn't exist or has no rules, skip this phase. Report: "No rules to classify."

### Step 2: Deterministic classification

Run existing logic from `pre-classify.js` mentally:

**Display logic / ReadOnly logic:**
```
IF expression has NO framework calls (OB.*, Utilities.*, checkRule, function()):
  → decision: "Keep"
  → Translate expression: @Var@ → var, | → ||, & → &&, 'Y' → true
ELSE:
  → flag for AI review
```

**Callouts:**
```
IF no DML AND complexity == "low" AND effects <= 2:
  → decision: "Keep"
ELSE IF hasDml:
  → flag for AI review (with warning)
ELSE:
  → flag for AI review
```

**Validations:**
```
IF complexity == "low" AND no DML:
  → decision: "Keep"
ELSE:
  → flag for AI review
```

### Step 3: AI classification (flagged rules)

For each flagged rule, analyze:

1. **What does it do?** — Read effects, source analysis, SQL
2. **Is it critical for data integrity?** — DML, required field derivation
3. **Can it be simplified?** — Complex logic that could be a simple default
4. **Is it relevant to the simplified UI?** — Some rules only apply to classic Etendo

Decide for each rule:
- `decision`: Keep | Replace | Simplify | Omit
- `description`: Plain language explanation of the rule
- `impactIfOmitted`: What changes for the user if omitted

**Decision guide:**
| Scenario | Decision |
|----------|----------|
| Simple field dependency (BP → Address) | Keep |
| Price calculation from price list | Keep |
| Complex accounting allocation | Omit (backend handles) |
| UI-only formatting rule | Omit (new UI has its own) |
| Document sequence generation | Keep (but system-handled) |
| Cross-tab validation | Simplify (reduce to essential check) |
| Classic UI widget manipulation | Omit (not applicable) |

### Step 4: Human review (complex rules only)

If there are rules with DML, high complexity, or ambiguous impact, present to user:

```
These {N} rules need your review:

1. SL_Order_DocType (callout, HIGH complexity, HAS DML)
   Effects: documentType, paymentMethod, paymentTerms
   Impact if omitted: Users must manually set payment terms
   My suggestion: Simplify (keep auto-fill, remove DML)
   → Keep / Replace / Simplify / Omit?
```

### Step 5: Write rules-curated.json

```json
{
  "version": "0.1.0",
  "rules": [
    {
      "name": "BP_AutoFill_Address",
      "type": "callout",
      "entity": "order",
      "decision": "Keep",
      "description": "Auto-fill address and price list from business partner"
    }
  ]
}
```

Write to `artifacts/{window}/rules-curated.json`.

---

## Phase 3: Post-Classification Pipeline

After writing schema-curated.json and rules-curated.json, run the FULL generation pipeline. Do NOT stop at classification.

### Step 1: Summary report

```
=== Classification Complete: {windowName} ===

Schema: {totalFields} fields
  - {N} editable, {N} readOnly, {N} system, {N} discarded
  - {N} grid columns, {N} searchable filters

Rules: {totalRules} rules
  - {N} Keep, {N} Replace, {N} Simplify, {N} Omit
```

### Step 2: Generate contract

```bash
# Ensure processes.json exists (create empty if not)
# { "processes": [] }

node -e "
import { generateContract } from './cli/src/generate-contract.js';
import { readFileSync, writeFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync('artifacts/{window}/schema-curated.json','utf8'));
const rules = JSON.parse(readFileSync('artifacts/{window}/rules-curated.json','utf8'));
const procs = JSON.parse(readFileSync('artifacts/{window}/processes.json','utf8'));
// Snapshot prev contract for version diffing
try { const prev = readFileSync('artifacts/{window}/contract.json','utf8'); writeFileSync('artifacts/{window}/contract.prev.json', prev); } catch {}
const contract = generateContract(schema, rules.rules || [], procs.processes || []);
writeFileSync('artifacts/{window}/contract.json', JSON.stringify(contract, null, 2));
console.log('Contract generated:', contract.testManifest.summary.total, 'tests');
"
```

### Step 3: Check version

```bash
node cli/src/check-version.js {windowName} {owner}
```

Report the version bump (if any) and classification (breaking/additive/patch).
If BREAKING: warn the user before continuing.

### Step 4: Generate frontend

```bash
node -e "
import { generateAll } from './cli/src/generate-frontend.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const contract = JSON.parse(readFileSync('artifacts/{window}/contract.json','utf8'));
const files = generateAll(contract);
const outDir = 'artifacts/{window}/generated/web/{window}';
mkdirSync(outDir, { recursive: true });
for (const [name, code] of Object.entries(files)) writeFileSync(outDir+'/'+name, code);
console.log(Object.keys(files).length, 'components generated');
"
```

### Step 5: Run contract tests

```bash
node -e "
import { runContractTests } from './cli/src/run-contract-tests.js';
import { readFileSync } from 'node:fs';
const contract = JSON.parse(readFileSync('artifacts/{window}/contract.json','utf8'));
const r = runContractTests(contract);
console.log(r.passed+'/'+r.total+' passed, '+r.failed+' failed');
if (r.failed > 0) { r.results.filter(t=>!t.passed).forEach(t=>console.log('  FAIL:', t.description)); process.exit(1); }
"
```

### Step 6: Final report

```
=== Pipeline Complete: {windowName} ===

Classification: {N} fields, {N} rules
Contract: v{version} ({changeLevel})
Frontend: {N} components generated
Tests: {passed}/{total} passed

Files written:
  - artifacts/{window}/schema-curated.json
  - artifacts/{window}/rules-curated.json
  - artifacts/{window}/contract.json
  - artifacts/{window}/contract-changelog.json
  - artifacts/{window}/generated/web/{window}/*.jsx
```

Ask the user: "Do you want to commit these changes?"

---

## Constraints

- NEVER add fields that don't exist in schema-raw.json
- NEVER change field column names
- Maximum 8 grid columns per entity (pick the most important)
- Maximum 5 searchable fields per entity
- System fields MUST have derivation data
- FK fields MUST have reference and inputMode
- All output files must be valid JSON with 2-space indentation
- This skill replaces both `pre-classify.js` (deterministic) and `classify-rules` skill (AI)

## Edge Cases

- **Window with no rules-raw.json**: Skip Phase 2, only classify schema
- **Window with schema-curated.json already**: Ask user "Overwrite existing curation? (y/n)"
- **Very large windows (100+ fields)**: Process in batches, show progress
- **Multi-entity windows**: Classify each entity separately, entity names must be unique
