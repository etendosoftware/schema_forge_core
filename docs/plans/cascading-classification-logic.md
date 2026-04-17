# Plan: Cascading Classification Logic

**Status:** Pending
**Created:** 2026-03-13
**Problem:** Field and rule classification are independent — discarding a field doesn't auto-discard its associated rules

---

## 1. Problem Statement

Field classification and rule classification are currently independent. When a field is discarded, its associated callout, displayLogic, readOnlyLogic, and validation rules remain classified as "Keep". When a field is readOnly, its callouts still survive even though no user input can trigger them. When an entire tab is discarded from the curated schema, all its rules survive.

The linkage information exists in the raw extraction data (`triggerColumn`, `callout` refs on fields) but is **lost during curation** because:
- `rules-raw.json` does NOT include entity/tab info (SQL joins through tabs but discards tab name/ID)
- `/classify` runs schema and rules classification as independent phases with no cross-referencing
- `pre-classify.js` operates solely on rule structure, with zero awareness of field visibility
- `generate-contract.js` does not filter rules by `decision: "Omit"`

## 2. Cascading Rules — Exact Logic

### 2.1 Entity-level cascading

```
IF entity is NOT present in schema-curated.json
  THEN all rules where rule.entity matches → auto-Omit
```

### 2.2 Field discarded or system

```
IF field.visibility === "discarded" OR "system"
  THEN:
    - callout where triggerColumn === field.columnName → auto-Omit
    - displayLogic where column === field.columnName → auto-Omit
    - readOnlyLogic where column === field.columnName → auto-Omit
    - validation where column === field.columnName → auto-Omit
```

### 2.3 Field readOnly

```
IF field.visibility === "readOnly"
  THEN:
    - callout where triggerColumn === field.columnName → auto-Omit
      (readOnly fields cannot receive user input, callouts never fire)
    - displayLogic → KEEP (still controls visibility)
    - readOnlyLogic → KEEP (dynamic readOnly conditions)
    - validation → KEEP (server-side validations still apply on API)
```

### 2.4 Edge Cases

| Case | Rule |
|------|------|
| Rule affects multiple fields | Decision based on **trigger column**, not effect columns. If trigger is discarded → auto-Omit. |
| Same callout, different triggers | Each trigger is a separate rule entry — each cascades independently. |
| Cross-entity references (`@Field@`) | Only cascade based on **owning column**, not expression references. Emit warning for discarded refs. |
| Rule references discarded field in expression body | Warning only, NOT auto-Omit (backend field may still exist). |

## 3. Order of Operations

```
Phase 1: Schema Classification
  Input:  schema-raw.json, system-columns.json
  Output: schema-curated.json

Phase 1.5: Build Dependency Map (NEW)
  Input:  schema-curated.json, rules-raw.json (with entity info)
  Output: cascade decisions (in-memory)

Phase 2: Rules Classification (MODIFIED)
  Step 0: Apply cascading auto-Omit
  Step 1: Deterministic classification on remaining rules
  Step 2: AI classification on flagged rules
  Step 3: Human review
  Output: rules-curated.json (with cascading metadata)
```

**Key constraint:** Fields MUST be classified before rules. Not parallel.

## 4. Required Changes by File

### 4.1 `cli/src/extract-rules.js` — Add entity/tab info

Add `t.Name AS tab_name` and `tbl.TableName` to the four SQL queries (CALLOUTS_SQL, VALIDATION_RULES_SQL, DISPLAY_LOGIC_SQL, AUXILIARY_INPUTS_SQL). Include in rule objects:

```json
{
  "entity": "cOrder",
  "tabName": "Header",
  "tabId": "186"
}
```

**Complexity:** Low

### 4.2 New: `cli/src/build-cascade-map.js` — Dependency map builder

Two exported functions:

```js
export function buildFieldVisibilityMap(schemaCurated)
// Returns Map<"entity:columnName", { entity, visibility, columnName }>

export function computeCascading(rawRules, fieldMap, curatedEntityNames)
// Returns { cascaded: Array<{ruleIndex, reason, cascadedFrom}>, warnings: Array<string> }
```

**Important:** Use `entity:columnName` as compound key to avoid collisions across tabs with same column names.

**Complexity:** Medium

### 4.3 `cli/src/pre-classify.js` — Accept cascading context

Add optional `options.cascading` parameter. If a rule is already cascaded, mark it `tier: 'auto'`, `autoDecision: 'omit'`, `cascadedFrom`. Skip deterministic classification for cascaded rules.

**Complexity:** Low. Fully backward compatible.

### 4.4 `.claude/skills/classify/SKILL.md` — Restructure Phase 2

Add Step 0 before existing Step 1 in Phase 2:

> Read schema-curated.json. Build field visibility map. For each rule in rules-raw.json, match to field via triggerColumn → columnName. Apply cascading. Report statistics.

Make explicit that Phase 1 must complete before Phase 2.

**Complexity:** Medium

### 4.5 `cli/src/generate-contract.js` — Filter omitted rules

- Filter out rules with `decision: "Omit"` from test manifest
- Skip omitted callouts when attaching metadata to visible fields
- Add `cascadeWarnings` array to contract for rules referencing discarded fields

**Complexity:** Low

### 4.6 `cli/src/pipeline.js` — Pass schema context

The `pre-classify` step should attempt to load `schema-curated.json` (if exists) and compute cascading. If not found (first run), skip cascading.

**Complexity:** Low

## 5. Data Model Changes

### rules-raw.json (per rule, NEW fields)

```json
{
  "entity": "cOrder",
  "tabName": "Header",
  "tabId": "186"
}
```

### rules-curated.json (per rule, NEW optional fields)

```json
{
  "decision": "Omit",
  "cascadedFrom": "field-discarded:AD_Org_ID",
  "cascadeReason": "Trigger field AD_Org_ID is discarded in schema-curated"
}
```

Format: `cascadedFrom` = `{type}:{identifier}` where type is `entity-discarded`, `field-discarded`, `field-system`, or `field-readOnly`.

### contract.json (NEW optional section)

```json
{
  "cascadeWarnings": [
    {
      "rule": "DisplayLogic_InvoiceRule",
      "referencesDiscardedField": "OrderType",
      "severity": "warning"
    }
  ]
}
```

## 6. Human Override

If a human overrides a cascaded auto-Omit:
1. Warn: "This rule was auto-Omit'd because trigger field '{field}' is {visibility}. It will never fire in the UI."
2. If confirmed: set `decision: "Keep"`, add `overrideCascade: true`
3. `overrideCascade` prevents re-Omit on subsequent `/classify` runs

```json
{
  "decision": "Keep",
  "overrideCascade": true,
  "cascadedFrom": "field-readOnly:C_BPartner_ID"
}
```

## 7. Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Existing `rules-raw.json` without `entity` | Entity-level cascading skipped; field-level still works |
| Existing `rules-curated.json` without `cascadedFrom` | Treated as manually classified |
| `pre-classify.js` without schema context | Identical to current behavior |
| Old contracts without `cascadeWarnings` | No change; field is optional |

All changes are additive. No existing property is removed or renamed.

## 8. Implementation Phases

### Phase A: Foundation — Extract entity info into rules-raw
- **Files:** `cli/src/extract-rules.js`
- **Dependencies:** None

### Phase B: Cascade Engine
- **Files:** New `cli/src/build-cascade-map.js`, update `cli/src/pre-classify.js`
- **Dependencies:** Phase A (for entity info, though field-level cascading works without it)

### Phase C: Skill Integration
- **Files:** `.claude/skills/classify/SKILL.md`
- **Dependencies:** Phase B

### Phase D: Contract Filtering
- **Files:** `cli/src/generate-contract.js`
- **Dependencies:** Phase B

### Phase E: Pipeline Integration
- **Files:** `cli/src/pipeline.js`
- **Dependencies:** Phase B

### Phase F: Validation & Testing
- **Dependencies:** All previous phases
- Re-classify Sales Order as validation test

**Critical path:** A → B → C. Phases D and E can parallelize after B.

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Column name collisions across entities | Use `entity:column` compound key |
| Same callout from multiple tabs | Each trigger is a separate rule entry with its own entity |
| Re-extraction overwrites rules-raw | By design — cascading is computed fresh from current schema-curated |
| Human overrides lost on re-classification | `overrideCascade` flag preserved in rules-curated |
