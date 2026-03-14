# Plan: GET /defaults Endpoint for New Records

**Created:** 2026-03-13
**Status:** In Progress
**ETP:** ETP-3546

## Overview

When a user clicks "New" in the UI, the frontend calls `GET /sws/neo/{specName}/{entityName}/defaults` to pre-populate form fields with server-resolved default values. This replicates what Etendo Classic's `FormInitializationComponent` does in "NEW" mode.

## Architecture

```
User clicks "New"
    │
    ▼
useEntity.handleNew()
    │ GET /{entity}/defaults
    ▼
NeoServlet → NeoDefaultsService.resolveDefaults()
    │ Reads AD_Column.DefaultValue for each included SFField
    ▼
Response: { defaults: { field: value }, metadata: { ... } }
    │
    ▼
Frontend merges defaults into editing state
    │
    ▼
User interacts → POST /callout (existing endpoint)
```

## Phases

### Phase 1: Static Defaults — DONE

**PR:** schema_forge#120 (merged) + com.etendoerp.go commit `0a0c8db`

**What it resolves:**
- Literal values from `AD_Column.DefaultValue` (`"DR"`, `"N"`, `"0"`)
- Session context variables (`@#AD_Org_ID@`, `@#Date@`, `@#AD_Client_ID@`, etc.)
- `IsActive` = true (always)
- Link-to-parent columns (via `?parentId=` query param)

**Files created/modified:**
- `NeoDefaultsService.java` — NEW: resolves defaults from AD_Column + OBContext
- `NeoServlet.java` — routing, NeoPathInfo.isDefaults, handleDefaults()
- `NeoOpenAPIEndpoint.java` — OpenAPI documentation
- `useEntity.js` — handleNew fetches defaults async (best-effort)

### Phase 2: Real Sequence Preview — PENDING

**Current state:** Returns `<auto>` placeholder for DocumentNo fields.

**What needs to be done:**
- Integrate `Utility.getDocumentNo()` with `updateNext=false` to get the real next number without consuming it
- Requires: document type context (C_DocType_ID / C_DocTypeTarget_ID) which may not be known at init time
- For columns with `isUseAutomaticSequence()`, use `NextSequenceValue.getInstance().generateNextSequenceValue()` in preview mode

**Key files to modify:**
- `NeoDefaultsService.java` — `resolveSequencePreview()` method (currently returns `<auto>`)

**Reference implementation:**
- `UIDefinition.java` lines 178-213 — sequence detection and DocumentNo generation
- `Utility.java` line 834 — `getDocumentNo()` signature

### Phase 3: SQL Expression Defaults — PENDING

**Current state:** `@SQL=SELECT...` expressions are skipped and added to `metadata.unresolvedFields`.

**What needs to be done:**
- Parse SQL after `@SQL=` prefix
- Extract `@parameter@` placeholders, resolve from context vars or already-resolved defaults
- Execute via `PreparedStatement` on `OBDal.getInstance().getConnection(false)`
- Two-pass resolution: first resolve non-SQL defaults, then SQL defaults (which may reference other defaults)

**Key reference:**
- `UIDefinition.java` lines 290-333 — `getDefaultValueFromSQLExpression()`

**Example:**
```
@SQL=SELECT COALESCE(MAX(Line),0)+10 AS DefaultValue FROM C_OrderLine WHERE C_Order_ID=@C_Order_ID@
```

### Phase 4: Callout Cascade — PENDING

**Current state:** Defaults are resolved but callouts triggered by those defaults are not executed.

**What needs to be done:**
- After resolving all defaults, check if any defaulted field has a callout configured
- Use `NeoCalloutService.resolveCallout()` to detect callout presence
- Execute callout chain: build formState from resolved defaults, call `NeoCalloutService.executeCallout()`, merge results
- Chain depth limit: max 5 to prevent infinite loops
- Merge callout results into response under `calloutResults` key

**Example flow for Purchase Order:**
1. Defaults resolve `documentType = 0` (literal default)
2. If user had a default DocType → callout fires → returns DocumentNo, PaymentRule, InvoiceRule
3. If BP was defaulted → callout fires → returns PaymentTerms, PriceList, Warehouse

**Key files:**
- `NeoDefaultsService.java` — add callout cascade after default resolution
- `NeoCalloutService.java` — reuse `executeCallout()` (already works)

**Response format with callouts:**
```json
{
  "defaults": { "documentStatus": "DR", "active": true, ... },
  "calloutResults": {
    "updates": { "paymentRule": { "value": "P" } },
    "combos": { ... },
    "messages": []
  },
  "metadata": { "calloutChainDepth": 2 }
}
```

## Frontend Pending Items

### Sequence Field Display — PENDING
- Fields in `metadata.sequenceFields` should render as read-only with gray placeholder text
- Generated form components already support `defaultValue` in field config

### Documentation — PENDING
- `modules/com.etendoerp.go/docs/neo-headless.md` — add `/defaults` endpoint documentation
- `CLAUDE.md` — add `/defaults` to URL Patterns table
- `docs/architecture-overview.md` — mention NeoDefaultsService in components

## API Reference

```
GET /sws/neo/{specName}/{entityName}/defaults?parentId={id}

Response 200:
{
  "defaults": {
    "fieldName": "resolvedValue",
    ...
  },
  "metadata": {
    "unresolvedFields": ["fieldWithSQLDefault"],
    "sequenceFields": ["documentNo"]
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| parentId | query string | No | Parent record ID for child entity tabs |

## Research Notes

### How Etendo Classic Handles Defaults

**Entry point:** `FormInitializationComponent.execute()` in NEW mode (line 633-687)

**Four types of defaults:**
1. **Literals** — `AD_Column.DefaultValue` = `"DR"`, `"N"`, `0`
2. **Context variables** — `@#AD_Org_ID@`, `@#Date@`, `@C_Currency_ID@`
3. **SQL expressions** — `@SQL=SELECT ... AS DefaultValue FROM ...`
4. **Callout cascades** — selecting DocType triggers SL_Order_DocType callout, selecting BP triggers SE_Order_BPartner

**Default evaluation order** (from `UIDefinition.getFieldProperties()`):
1. Check for sequence configuration → generate next value
2. Check for DocumentNo column → call `Utility.getDocumentNo()`
3. Check user preference (`Utility.getPreference()`) → overrides column default
4. Read `AD_Column.DefaultValue` → parse `@...@` tokens or `@SQL=...`

**Key classes:**
- `FormInitializationComponent` — orchestrates form init
- `UIDefinition` — resolves defaults per field
- `Utility` — `getDefault()`, `getDocumentNo()`, `parseContext()`
- `SequenceUtils` — sequence detection
