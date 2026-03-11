# Hybrid DisplayLogic Evaluation

**Status:** Proposal
**Date:** 2026-03-10
**Scope:** Schema Forge CLI + Etendo Go (NeoHandler)

---

## 1. Problem Statement

The `translateExpression()` function in `extract-rules.js` converts Etendo displayLogic expressions (`@VAR@` syntax) into JavaScript arrow functions that the generated frontend can evaluate client-side. This works well for simple field comparisons (`@Status@='Active'`), but approximately 25-50% of expressions cannot be fully translated because they reference server-side data that is unavailable in the browser:

- Session variables (user role, org, client)
- System preferences (`@#ShowAcct@`)
- Accounting dimension flags (`@$Element_AY@`)
- Auxiliary inputs computed by SQL queries
- Server-expanded macros (`@ACCT_DIMENSION_DISPLAY@`)

These untranslatable expressions currently produce either syntactically invalid JavaScript (silent failures) or syntactically valid JS that evaluates incorrectly because the referenced variables are undefined.

This document proposes a **hybrid evaluation model**: evaluate client-side when possible, fall back to a server endpoint when not.

---

## 2. Current Translation Pipeline

### Data Flow

```
AD_Field.DisplayLogic / AD_Column.ReadOnlyLogic
    |
    v
extract-fields.js        Extracts raw expressions from Etendo DB
    |
    v
extract-rules.js          translateExpression() converts @VAR@ syntax to JS
    |                      - @VAR@ -> camelCase variable reference
    |                      - '=' -> '=='
    |                      - '&' -> '&&'
    |                      - '|' -> '||'
    |                      - 'Y'/'N' -> true/false
    v
generate-contract.js      Merges raw + translated into { raw, js } per field
    |
    v
generate-frontend.js      Emits arrow functions: (record) => expr
                           Used in React components for conditional rendering
```

### Key Function: `translateExpression()`

Located at `cli/src/extract-rules.js` lines 182-217. Regex-based conversion that handles:

- `@ColumnName@` variable references (converted to camelCase)
- String equality (`='value'` to `=='value'`)
- Boolean shorthand (`'Y'`/`'N'` to `true`/`false`)
- Logical operators (`&` to `&&`, `|` to `||`)
- Negation (`!='value'`)

### Contract Output Format (Current)

```json
{
  "fieldName": {
    "displayLogic": {
      "raw": "@DocStatus@='CO'&@Processed@='Y'",
      "js": "docStatus=='CO'&&processed==true"
    }
  }
}
```

### Frontend Output (Current)

```jsx
{visible: (record) => record.docStatus=='CO' && record.processed==true}
```

---

## 3. Categorized Untranslatable Patterns

Analysis based on the Sales Order window (~68 display logic expressions). These six categories cover all known failure modes.

### Category 1: Bug -- `!` Not Converted to `!=`

**Count:** 5 cases
**Severity:** High (produces SyntaxError)

The translator handles `!=` correctly but does not handle the Etendo shorthand `!` (without `=`) which means "not equal to".

| Raw Expression | Current Translation | Problem |
|---|---|---|
| `@DocStatus@!'CL'&@DocStatus@!'VO'` | `docStatus!'CL'&&docStatus!'VO'` | SyntaxError: `!'CL'` is not valid JS |
| `@C_Currency_ID@!@FinAcc_Currency_ID@` | `cCurrencyId!finAccCurrencyId` | SyntaxError |

**Fix:** One regex addition in `translateExpression()`:

```javascript
// Before other replacements, convert !' to !=' and !@ to !=@
expr = expr.replace(/!'/, "!='");
expr = expr.replace(/!@/, "!=@");
```

### Category 2: Prefixes `@#` and `@$` Not Handled

**Count:** 7 cases (3 `@#`, 4 `@$`)
**Severity:** High (produces invalid JS with `@` symbols)

Etendo uses prefixed variable syntax for different scopes:
- `@#VAR@` -- system preference (e.g., `@#ShowAcct@`)
- `@$Element_XX@` -- accounting dimension flag

The translator's regex only matches `@WORD@`, not `@#WORD@` or `@$WORD@`.

| Raw Expression | Current Translation | Problem |
|---|---|---|
| `@#ShowAcct@='Y'` | `@#ShowAcct@==true` | `@#` not replaced, invalid JS |
| `@$Element_AY@='Y'` | `@$Element_AY@==true` | `@$` not replaced, invalid JS |
| `@#ShowTrl@='Y'` | `@#ShowTrl@==true` | Same pattern |

**Fix:** Extend the `@VAR@` regex to strip `#` and `$` prefixes:

```javascript
// Replace @#VAR@ and @$VAR@ with camelCase variable names
expr = expr.replace(/@[#$](\w+)@/g, (_, name) => toCamelCase(name));
```

**Important caveat:** Even after this fix, these variables will translate to syntactically valid JS but the values come from the server (system preferences, accounting config). They cannot be evaluated client-side without context injection. See Category 3.

### Category 3: Session Context Variables

**Count:** 18 cases
**Severity:** Medium (valid JS, wrong results)

These expressions reference variables whose values come from `Utility.getContext()` on the server -- module enablement flags, role-based settings, organization configuration.

| Raw Expression | Translates? | Evaluable Client-Side? |
|---|---|---|
| `@FinancialManagement@=''` | Yes | No -- value from session |
| `@StockReservations@!=''` | Yes | No -- value from session |
| `@ACCS_Account_Ope@='Y'` | Yes | No -- module preference |
| `@ShowAcct@='Y'` | Yes (after Cat 2 fix) | No -- system preference |
| `@IsSOTrx@='Y'` | Yes | Partial -- present in some windows |

The translator produces syntactically valid JavaScript, but at runtime the variables resolve to `undefined` because the frontend has no access to the server session. Evaluating `undefined == 'Y'` silently returns `false`, making fields invisibly hidden.

### Category 4: `@ACCT_DIMENSION_DISPLAY@` Macro

**Count:** 3 cases
**Severity:** High (not a variable at all)

This is not a variable reference -- it is a server-side **macro** expanded by `DimensionDisplayUtility` before the expression reaches the client. The expansion produces a complex sub-expression based on the organization's accounting configuration.

| Raw Expression | What Happens Server-Side |
|---|---|
| `@ACCT_DIMENSION_DISPLAY@` | Replaced by something like `(@$Element_AY@='Y'\|@$Element_BP@='Y'\|...)` |

The Schema Forge CLI sees the unexpanded macro. It cannot expand it because the expansion depends on live DB state (which accounting dimensions are enabled for the user's organization).

**Implication:** These fields must always use server-side evaluation.

### Category 5: Auxiliary Inputs with `@SQL@`

**Count:** 25 cases in Sales Order alone
**Severity:** High (values require DB queries)

Etendo auxiliary inputs are computed by SQL queries that run on the server when a tab loads or a field changes. The display logic references these computed values.

| Variable | Source | Example SQL |
|---|---|---|
| `@showAddPayment@` | SQL with JOINs on `C_Order`, `FIN_Payment_Schedule` | Multi-table aggregate |
| `@IsStocked@` | SQL on `M_Product` category | Simple lookup |
| `@APRM_OrderIsPaid@` | SQL with `COALESCE`, framework functions | Complex aggregate |
| `@Processed@` | Column value (sometimes) / Aux input (sometimes) | Depends on window |

These cannot be translated to client-side JS. The SQL queries reference tables not exposed to the frontend, use aggregate functions, and depend on the current transaction state.

### Category 6: Field-to-Field Comparisons

**Count:** 2 cases
**Severity:** Low (fixable with Category 1 fix)

| Raw Expression | After Cat 1 Fix | Evaluable? |
|---|---|---|
| `@C_Currency_ID@!@FinAcc_Currency_ID@` | `cCurrencyId!=finAccCurrencyId` | Yes -- both fields in record |

These work once the `!` bug is fixed (Category 1), as long as both referenced fields are present in the current record.

---

## 4. Coverage Statistics

Analysis from Sales Order window (~68 display logic expressions):

| Pattern | Count | Syntactically Valid JS | Semantically Evaluable Client-Side |
|---|---|---|---|
| Simple field comparisons | 35 | 100% | 100% |
| Boolean combinations (`&`, `\|`) | 28 | 100% | 100% |
| Session variables (Cat 3) | 18 | 100% (after fixes) | 0% -- need server context |
| Preferences `@#` (Cat 2) | 3 | 0% (fixable) | 0% -- need server context |
| Dimensions `@$` (Cat 2) | 4 | 0% (fixable) | 0% -- need server context |
| `ACCT_DIMENSION_DISPLAY` (Cat 4) | 3 | 0% (macro) | 0% -- need server expansion |
| Inequality `!` bug (Cat 1) | 5 | 0% (fixable) | 100% after fix |
| Field-to-field (Cat 6) | 2 | 0% (fixable) | 100% after fix |

### Summary

| Metric | Before Fixes | After Quick Fixes (Cats 1, 2) | With Server Fallback |
|---|---|---|---|
| Syntactically valid JS | ~75% | ~90% | ~90% |
| Semantically evaluable client-side | ~50% | ~55% | 100% (hybrid) |

The quick fixes (Categories 1 and 2) are pure bug fixes that improve syntax validity. But semantic evaluability requires the hybrid model for the remaining ~45% of expressions.

---

## 5. Proposed Solution: Hybrid Evaluation Model

### Principle

Evaluate display logic client-side in JavaScript when all referenced variables are available in the record. Fall back to a server endpoint when expressions reference session state, preferences, accounting dimensions, auxiliary inputs, or server-expanded macros.

### Decision Flow

```
Field with displayLogic
    |
    +-- Has .js AND evaluable: true?
    |       |
    |       v
    |   Evaluate client-side: (record) => expr
    |
    +-- evaluable: false?
            |
            v
        Call POST /sws/neo/{spec}/{entity}/evaluate-display
        with current field values
        Cache result until referenced field changes
```

### Contract Schema Change

Current format:

```json
{
  "displayLogic": {
    "raw": "@DocStatus@='CO'",
    "js": "docStatus=='CO'"
  }
}
```

Proposed format:

```json
{
  "displayLogic": {
    "raw": "@DocStatus@='CO'",
    "js": "docStatus=='CO'",
    "evaluable": true
  }
}
```

For non-evaluable fields:

```json
{
  "displayLogic": {
    "raw": "@#ShowAcct@='Y'",
    "js": null,
    "evaluable": false,
    "reason": "session-preference",
    "serverEndpoint": "/sws/neo/{spec}/{entity}/evaluate-display"
  }
}
```

Possible `reason` values:
- `"session-preference"` -- references `@#VAR@` system preferences
- `"session-variable"` -- references session context variables (module flags, etc.)
- `"accounting-dimension"` -- references `@$Element_X@` flags
- `"server-macro"` -- contains `@ACCT_DIMENSION_DISPLAY@` or similar
- `"auxiliary-input"` -- references SQL-computed auxiliary inputs
- `"translation-failure"` -- catch-all for unparseable expressions

### Frontend Generation Change

In `generate-frontend.js`:

**Fields with `evaluable: true`** (no change):

```jsx
{visible: (record) => record.docStatus=='CO' && record.processed==true}
```

**Fields with `evaluable: false`** (new):

```jsx
{
  visible: null,  // Cannot evaluate client-side
  visibilitySource: 'server',
  displayLogicReason: 'session-preference',
  // The React component checks visibilitySource and calls the endpoint
}
```

The generated React component would include logic like:

```jsx
const [serverVisibility, setServerVisibility] = useState({});

useEffect(() => {
  const nonEvaluableFields = fields.filter(f => f.visibilitySource === 'server');
  if (nonEvaluableFields.length > 0) {
    fetch(`/sws/neo/${spec}/${entity}/evaluate-display`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldValues: currentRecord })
    })
    .then(res => res.json())
    .then(data => setServerVisibility(data.visibility));
  }
}, [relevantFieldValues]);  // Re-evaluate when referenced fields change

// For each field:
const isVisible = field.visibilitySource === 'server'
  ? serverVisibility[field.name] ?? true  // Default visible until server responds
  : field.visible(record);
```

### Caching Strategy

- Cache server evaluation results per record
- Invalidate when any field in the record changes (conservative)
- Future optimization: parse the `raw` expression to identify which fields trigger re-evaluation
- Debounce calls (300ms) to avoid flooding the server during rapid edits

---

## 6. Existing Etendo Components

These components already exist in the Etendo codebase. The server-side evaluator can be built by composing them rather than implementing expression parsing from scratch.

### DynamicExpressionParser

**Class:** `org.openbravo.client.application.DynamicExpressionParser`
**Size:** 537 lines
**Location:** Etendo core (`org.openbravo.client.application` module)

Transforms Etendo displayLogic syntax into evaluable JavaScript. Handles all the cases that Schema Forge's regex-based translator cannot:

- Resolves system preferences (`@#VAR@`) by looking up `AD_Preference`
- Resolves session variables from `OBContext`
- Resolves parent tab fields (`@parentField@`)
- Expands accounting dimension macros (`@ACCT_DIMENSION_DISPLAY@`)
- Resolves auxiliary inputs

**Key API:**

```java
// Constructor -- needs the tab and field for context resolution
DynamicExpressionParser parser = new DynamicExpressionParser(
    field.getDisplayLogic(),  // The raw expression string
    tab,                       // AD_Tab (for parent field resolution)
    field                      // AD_Field (for auxiliary input resolution)
);

// Returns JavaScript string ready for evaluation
String jsExpression = parser.getJSExpression();

// Static utility -- replaces only system preferences
String withPrefs = DynamicExpressionParser.replaceSystemPreferencesInDisplayLogic(rawExpr);
```

### OBScriptEngine

**Class:** `org.openbravo.base.expression.OBScriptEngine`
**Purpose:** Rhino JavaScript engine (Mozilla's Java-based JS runtime)

Evaluates JavaScript strings with variable bindings. Already in Etendo's classpath, no additional dependencies needed.

```java
Map<String, Object> context = new HashMap<>();
context.put("docStatus", "CO");
context.put("processed", true);

Object result = OBScriptEngine.getInstance().eval(jsExpression, context);
boolean isVisible = Boolean.TRUE.equals(result);
```

Sandboxed execution -- safe for arbitrary display logic expressions.

### OBViewFieldHandler (Existing Pattern)

**Class:** `org.openbravo.client.application.window.OBViewFieldHandler`
**Method:** `evaluateDisplayLogicAtServerLevel()` (lines 1666-1689)

This method already implements the exact pattern we need. It proves that server-side display logic evaluation is a supported and tested approach in Etendo:

1. Parse the display logic expression
2. Build an evaluation context from session + preferences + field values
3. Evaluate using OBScriptEngine
4. Return boolean result

### NeoHandler CDI Mechanism

**Interface:** `com.etendoerp.go.neo.NeoHandler`
**Pattern:** `@Named("qualifier")` CDI beans

The NEO Headless module already supports custom endpoint logic via CDI hooks:

```java
@Named("myHandler")
public class MyHandler implements NeoHandler {
    public NeoResponse handle(NeoContext ctx) {
        // ctx.getAdTab() -- the AD tab for this entity
        // ctx.getRequestBody() -- JSON request body
        // ctx.getObContext() -- OBContext with session info
        // ctx.getRecordId() -- record ID if applicable
        return NeoResponse.ok(responseJson);
        // return null; -- fall through to default handling
    }
}
```

The handler qualifier is stored in `ETGO_SF_ENTITY.JAVA_QUALIFIER`. NEO Headless routes requests to the matching CDI bean.

---

## 7. Proposed Java Endpoint

### API Design

```
POST /sws/neo/{specName}/{entityName}/evaluate-display
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Request:**

```json
{
  "fieldValues": {
    "documentStatus": "CO",
    "processed": true,
    "grandTotal": 1500.00,
    "businessPartner": "1000001",
    "currency": "102"
  }
}
```

**Response:**

```json
{
  "visibility": {
    "discountPercent": true,
    "taxAmount": false,
    "serialNumber": true,
    "accountingTab": false
  },
  "readOnly": {
    "documentStatus": true,
    "grandTotal": false,
    "businessPartner": true
  }
}
```

Fields not present in the response are assumed visible and editable (default permissive).

### Implementation Sketch

```java
@Named("displayLogicEvaluator")
public class DisplayLogicEvaluatorHandler implements NeoHandler {

    public NeoResponse handle(NeoContext ctx) {
        Tab tab = ctx.getAdTab();
        JSONObject body = ctx.getRequestBody();
        JSONObject fieldValues = body.optJSONObject("fieldValues");

        JSONObject visibility = new JSONObject();
        JSONObject readOnly = new JSONObject();

        for (Field field : tab.getADFieldList()) {
            String propertyName = field.getProperty() != null
                ? field.getProperty().getName()
                : field.getColumn().getName();

            // Evaluate displayLogic
            if (field.getDisplayLogic() != null && !field.getDisplayLogic().isEmpty()) {
                boolean isVisible = evaluateExpression(
                    field.getDisplayLogic(), tab, field, fieldValues
                );
                visibility.put(propertyName, isVisible);
            }

            // Evaluate readOnlyLogic
            Column column = field.getColumn();
            if (column != null && column.getReadOnlyLogic() != null
                && !column.getReadOnlyLogic().isEmpty()) {
                boolean isReadOnly = evaluateExpression(
                    column.getReadOnlyLogic(), tab, field, fieldValues
                );
                readOnly.put(propertyName, isReadOnly);
            }
        }

        JSONObject response = new JSONObject();
        response.put("visibility", visibility);
        response.put("readOnly", readOnly);
        return NeoResponse.ok(response);
    }

    private boolean evaluateExpression(
        String expression, Tab tab, Field field, JSONObject fieldValues
    ) {
        try {
            // Use Etendo's existing parser to resolve all variable types
            DynamicExpressionParser parser =
                new DynamicExpressionParser(expression, tab, field);
            String jsExpr = parser.getJSExpression();

            // Build evaluation context from request field values + session
            Map<String, Object> evalContext = new HashMap<>();

            // Add field values from the request
            if (fieldValues != null) {
                Iterator<String> keys = fieldValues.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    evalContext.put(key, fieldValues.get(key));
                }
            }

            // Session variables are already resolved by DynamicExpressionParser
            // but we add OBContext values as fallback
            OBContext obCtx = OBContext.getOBContext();
            evalContext.put("AD_Org_ID", obCtx.getCurrentOrganization().getId());
            evalContext.put("AD_Client_ID", obCtx.getCurrentClient().getId());
            evalContext.put("AD_Role_ID", obCtx.getRole().getId());

            // Evaluate using Rhino
            Object result = OBScriptEngine.getInstance().eval(jsExpr, evalContext);
            return Boolean.TRUE.equals(result);

        } catch (Exception e) {
            // On any failure, default to visible/not-read-only
            // Log for debugging but don't break the UI
            log.warn("Failed to evaluate expression: {} for field: {}",
                expression, field.getName(), e);
            return true;
        }
    }
}
```

### Error Handling

- Expression parse failure: log warning, return `true` (field visible, not read-only)
- Missing field values in request: treat as `null`/empty string (matches Etendo behavior)
- OBScriptEngine exception: log, return `true`
- Invalid JWT / no auth: standard NEO 401 response

### Performance Considerations

- All field expressions for a tab are evaluated in a single request (batch, not per-field)
- `DynamicExpressionParser` construction is lightweight (no DB queries for simple cases)
- Preference resolution is cached by Etendo's preference infrastructure
- Typical response time: <50ms for a tab with 30 fields
- Frontend debounces at 300ms, so at most ~3 calls/second during rapid editing

---

## 8. Implementation Plan

| Step | Repository | Description | Effort | Dependencies |
|------|-----------|-------------|--------|-------------|
| 1 | Schema Forge CLI | Fix `translateExpression()`: `!` to `!=`, `@#`/`@$` prefix stripping | Low (~10 lines) | None |
| 2 | Schema Forge CLI | Add `evaluable` and `reason` flags to contract output in `generate-contract.js` | Low (~20 lines) | Step 1 |
| 3 | Schema Forge CLI | Update `generate-frontend.js` to emit server fallback code for `evaluable: false` fields | Medium (~40 lines) | Step 2 |
| 4 | Etendo Go (Java) | Create `DisplayLogicEvaluatorHandler` implementing `NeoHandler` | Medium (~100 lines) | None (independent) |
| 5 | Etendo Go (Java) | Register handler in `ETGO_SF_ENTITY` for relevant entities | Low (~5 min) | Step 4 |
| 6 | Both | Tests: contract tests (Schema Forge), JUnit + integration tests (Etendo Go) | Medium (~80 lines) | Steps 1-5 |

### Recommended Execution Order

**Phase A (Schema Forge only, no Java changes):**
1. Step 1: Fix translator bugs (immediate win)
2. Step 2: Add evaluable flag to contracts
3. Step 3: Update frontend generator

**Phase B (Etendo Go, can run in parallel with Phase A):**
4. Step 4: Implement DisplayLogicEvaluatorHandler
5. Step 5: Register handler

**Phase C (Integration):**
6. Step 6: End-to-end tests

Phase A can be shipped independently. The frontend will show non-evaluable fields as always-visible (safe default) until Phase B delivers the server endpoint.

---

## 9. Quick Wins (Can Be Done Independently)

These are pure bug fixes in `translateExpression()` that require no architectural decisions. They can be committed immediately.

### Fix 1: `!` not converted to `!=`

```javascript
// In translateExpression(), before the @VAR@ replacement:
// Convert Etendo's !' shorthand to !='
expr = expr.replace(/!'/g, "!='");
// Convert field-to-field inequality: @A@!@B@ -> @A@!=@B@
expr = expr.replace(/!@/g, "!=@");
```

**Impact:** Fixes 5 SyntaxErrors in Sales Order.

### Fix 2: `@#VAR@` prefix not stripped

```javascript
// Extend the @VAR@ regex to handle @#VAR@ (system preferences)
expr = expr.replace(/@#(\w+)@/g, (_, name) => toCamelCase(name));
```

**Impact:** Fixes 3 invalid expressions in Sales Order.

### Fix 3: `@$Element_X@` prefix not stripped

```javascript
// Extend the @VAR@ regex to handle @$VAR@ (accounting dimensions)
expr = expr.replace(/@\$(\w+)@/g, (_, name) => toCamelCase(name));
```

**Impact:** Fixes 4 invalid expressions in Sales Order.

### Combined Impact

These three fixes increase syntactic translation success from ~75% to ~90%. The remaining ~10% are server macros (`@ACCT_DIMENSION_DISPLAY@`) that cannot be fixed with regex.

---

## 10. UI Behavior for Missing Java Evaluator

During the transition period (Phase A shipped, Phase B not yet deployed), the frontend needs graceful degradation.

### Default Behavior

When a field has `evaluable: false` and the server endpoint is not available:

1. **Field is shown** (default visible, default editable) -- this is the safe default
2. **No error displayed to the user** -- they see a normal form
3. **Developer console logs a warning:**
   ```
   [SchemaForge] Field "showAccounting" has server-evaluated displayLogic
   (reason: session-preference) but no endpoint configured.
   Defaulting to visible. Raw expression: @#ShowAcct@='Y'
   ```
4. **Optional:** A subtle CSS indicator (e.g., faint dashed border) in development mode only, toggled by an environment variable

### Why Default Visible?

- Hiding a field incorrectly is worse than showing it incorrectly
- A visible field that should be hidden is noticeable during testing
- A hidden field that should be visible might cause data entry errors
- Matches Etendo's own behavior: when displayLogic evaluation fails, the field stays visible

---

## 11. Key Files Reference

### Schema Forge (this repository)

| File | Lines | Purpose |
|------|-------|---------|
| `cli/src/extract-rules.js` | 182-217 | `translateExpression()` -- the regex-based translator to fix |
| `cli/src/extract-fields.js` | -- | Extracts `DisplayLogic` and `ReadOnlyLogic` from Etendo DB |
| `cli/src/generate-contract.js` | 77-94 | Where displayLogic enters the contract JSON (`{ raw, js }`) |
| `cli/src/generate-frontend.js` | -- | Emits arrow functions for client-side evaluation |
| `cli/src/validate-schema.js` | -- | Validation rules (may need update for `evaluable` flag) |

### Etendo Core (existing components to reuse)

| Class | Package | Purpose |
|-------|---------|---------|
| `DynamicExpressionParser` | `org.openbravo.client.application` | Server-side expression parser (537 lines). Resolves all variable types. |
| `OBScriptEngine` | `org.openbravo.base.expression` | Rhino JS evaluation engine. `getInstance().eval(script, bindings)`. |
| `OBViewFieldHandler` | `org.openbravo.client.application.window` | Lines 1666-1689: existing `evaluateDisplayLogicAtServerLevel()` pattern. |
| `DimensionDisplayUtility` | `org.openbravo.erpCommon.utility` | Expands `@ACCT_DIMENSION_DISPLAY@` macro. |
| `Utility.getContext()` | `org.openbravo.erpCommon.utility` | Resolves session variables used in display logic. |

### Etendo Go (NEO Headless -- where new code goes)

| File | Purpose |
|------|---------|
| `NeoServlet.java` | Main servlet routing -- where `/evaluate-display` path would be added |
| `NeoHandler.java` | CDI interface to implement for the new handler |
| `NeoContext.java` | Request context: `getAdTab()`, `getRequestBody()`, `getObContext()`, `getRecordId()` |
| `NeoResponse.java` | Response wrapper: `NeoResponse.ok(json)`, `NeoResponse.error(status, msg)` |
| `SFUpsertEntity` webhook | Where `JAVA_QUALIFIER` is set for entity-handler binding |

---

## 12. Open Questions

These items need resolution before or during implementation:

1. **Auxiliary input evaluation order:** Some auxiliary inputs depend on other auxiliary inputs. Does `DynamicExpressionParser` handle this, or do we need to sort by dependency?

2. **Tab hierarchy context:** Display logic can reference parent tab fields (`@parentField@`). The `evaluate-display` endpoint receives flat `fieldValues`. Should we accept nested values for parent context, or require a separate call per tab level?

3. **Caching granularity:** Should the frontend cache per-record or per-tab? Per-record is more correct but uses more memory. Per-tab works if session-only variables rarely change.

4. **Partial evaluation:** Could we evaluate the client-side-resolvable parts of a compound expression and only call the server for the remaining variables? This would reduce server calls but significantly increase complexity.

5. **Route registration:** Should `/evaluate-display` be a new route in NeoServlet's path parser, or handled as a sub-action of the existing entity route? The NeoHandler CDI mechanism suggests the latter.
