# Hybrid DisplayLogic Evaluation

**Status:** Completed
**Date:** 2026-03-10 (original) / 2026-03-11 (completed)
**Scope:** Schema Forge CLI + Etendo Go (NeoServlet native route)

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
        with current field values (debounce 300ms)
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
    "reason": "session-preference"
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

### Frontend Call Strategy

- **No cache** -- the endpoint responds in <50ms, caching adds complexity without meaningful gain
- **Debounce 300ms** -- at most ~3 calls/second during rapid editing
- On each field change (after debounce): POST current `fieldValues` to the endpoint
- Use latest response to update visibility/readOnly state
- Future optimization if needed: parse `raw` expressions to identify which fields trigger re-evaluation (smart invalidation)

---

## 6. Server Endpoint: Native NeoServlet Route

### Design Decision: Native Route, NOT NeoHandler

The `/evaluate-display` endpoint is a **native route in NeoServlet**, at the same level as `/selectors` and `/action`. This means:

- Available **automatically** for every entity — no per-entity `JAVA_QUALIFIER` registration needed
- Follows the same routing patterns as existing sub-routes
- Discoverable via OpenAPI like all other endpoints
- Works with the raw AD expressions directly (no Schema Forge pipeline dependency)

**Rationale:** Display logic is a generic AD metadata feature. Every tab/entity has potential display logic. Making it a native route avoids N entity registrations and keeps the mechanism universal.

### URL Pattern

```
POST /sws/neo/{specName}/{entityName}/evaluate-display
```

This follows the same keyword-at-position-3 pattern as `/selectors`:

| Existing Route | Pattern |
|---|---|
| `/{spec}/{entity}/selectors` | Keyword at position 3, entity-level |
| `/{spec}/{entity}/selectors/{column}` | Keyword + sub-param |
| `/{spec}/{entity}/{recordId}/action` | Keyword at position 4, record-level |
| **`/{spec}/{entity}/evaluate-display`** | **Keyword at position 3, entity-level** |

Entity-level (no recordId) because:
- The frontend sends field values in the request body
- Works for both new records (no ID yet) and existing records
- No need for the server to load the record — the expression is evaluated against the provided values + session context

### Request

```
POST /sws/neo/{specName}/{entityName}/evaluate-display
Authorization: Bearer <JWT>
Content-Type: application/json
```

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

**Field names** use the property name (camelCase) as returned by NEO Headless GET responses. This ensures the frontend can pass the record object directly without key transformation.

**Empty body** is valid — evaluates expressions using only session/preference context (useful for determining initial visibility on a blank form).

### Response

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

**Rules:**
- Only fields that HAVE a `displayLogic` expression appear in `visibility`
- Only fields that HAVE a `readOnlyLogic` expression appear in `readOnly`
- Fields not present in the response → default visible, default editable
- On evaluation failure → field defaults to `true` for visibility (visible — don't hide needed fields), `true` for readOnly (read-only — don't allow edits when unsure)

### Error Responses

| Status | Condition | Body |
|---|---|---|
| 200 | Success (even if some expressions fail — partial results) | `{ visibility, readOnly }` |
| 400 | Invalid JSON body | `{ "error": "Invalid request body" }` |
| 401 | Missing/invalid JWT | `{ "error": "Unauthorized" }` |
| 404 | Spec or entity not found | `{ "error": "Entity not found: {entityName}" }` |
| 405 | Non-POST method | `{ "error": "Method not allowed. Use POST." }` |

### Performance

- All field expressions for a tab evaluated in a **single request** (batch, not per-field)
- `DynamicExpressionParser` construction is lightweight (no DB queries for simple cases)
- Preference resolution is cached by Etendo's preference infrastructure
- Typical response time: <50ms for a tab with 30 fields
- Frontend debounces at 300ms, so at most ~3 calls/second during rapid editing

---

## 7. NeoServlet Integration

### Path Parser Change

In `NeoServlet.parsePath()` (lines 324-367), add detection for `evaluate-display` at position 3, alongside the existing `selectors` check:

```java
// Existing: detect "selectors" keyword
if (parts.length >= 3 && "selectors".equals(parts[2])) {
    String selectorField = parts.length >= 4 ? parts[3] : null;
    return new NeoPathInfo(specName, entityName, null, true, selectorField, false, null);
}

// NEW: detect "evaluate-display" keyword
if (parts.length >= 3 && "evaluate-display".equals(parts[2])) {
    return new NeoPathInfo(specName, entityName, null, false, null, false, null, true);
}

// Existing: remaining cases (recordId, action, etc.)
```

### NeoPathInfo Extension

Add a flag to the inner class:

```java
static class NeoPathInfo {
    final String specName;
    final String entityName;
    final String recordId;
    final boolean isSelector;
    final String selectorField;
    final boolean isAction;
    final String actionName;
    final boolean isEvaluateDisplay;  // NEW
}
```

### Request Routing

In `processRequest()` (lines 199-219), add a branch before CRUD routing:

```java
if (pathInfo.isSelector) {
    handleSelector(response, specId, pathInfo, request);
} else if (pathInfo.isAction) {
    handleButtonAction(response, spec, pathInfo, method, request);
} else if (pathInfo.isEvaluateDisplay) {
    handleEvaluateDisplay(response, spec, pathInfo, method, request);  // NEW
} else {
    // Standard CRUD routing
    ...
}
```

### Handler Method

```java
/**
 * Minimal shim for SmartClient functions used by DynamicExpressionParser output.
 *
 * DynamicExpressionParser generates JS like:
 *   OB.Utilities.getValue(currentValues, 'documentStatus') === 'CO'
 *   OB.Utilities.Date.JSToOB(OB.Utilities.getValue(currentValues,'orderDate'), OB.Format.date)
 *
 * These functions don't exist in a bare Rhino context. The shim provides:
 *   - getValue(obj, key) → obj[key] (null-safe property accessor)
 *   - Date.JSToOB(value, format) → value (pass-through; display logic only compares strings)
 *   - OB.Format.date → empty string (unused by pass-through JSToOB)
 *
 * Risk: If a future Etendo version adds new OB.* calls in parser output,
 * Rhino will throw ReferenceError — detected immediately by tests.
 * Fix: extend the shim.
 */
private static final String OB_UTILITIES_SHIM =
    "var OB = { Utilities: { "
    + "getValue: function(obj, key) { return obj != null ? obj[key] : null; }, "
    + "Date: { JSToOB: function(v) { return v; } } }, "
    + "Format: { date: '' } };";

/**
 * Evaluates displayLogic and readOnlyLogic expressions for all fields of a tab.
 * Uses Etendo's DynamicExpressionParser to resolve session variables, preferences,
 * accounting dimensions, auxiliary inputs, and server-expanded macros.
 * Injects an OB.Utilities shim so the SmartClient-dependent JS output can be
 * evaluated by bare Rhino/OBScriptEngine.
 *
 * POST /sws/neo/{specName}/{entityName}/evaluate-display
 */
private void handleEvaluateDisplay(HttpServletResponse response, SFSpec spec,
        NeoPathInfo pathInfo, String method, HttpServletRequest request) throws IOException {

    // Only POST allowed
    if (!"POST".equals(method)) {
        writeResponse(response, NeoResponse.error(405, "Method not allowed. Use POST."));
        return;
    }

    // Find the entity and its AD_Tab
    SFEntity entity = findEntity(spec, pathInfo.entityName);
    if (entity == null) {
        writeResponse(response, NeoResponse.error(404,
            "Entity not found: " + pathInfo.entityName));
        return;
    }

    Tab tab = entity.getTab();
    if (tab == null) {
        writeResponse(response, NeoResponse.error(404,
            "No AD_Tab linked to entity: " + pathInfo.entityName));
        return;
    }

    // Parse request body
    JSONObject body;
    try {
        body = new JSONObject(readRequestBody(request));
    } catch (Exception e) {
        body = new JSONObject();  // Empty body is valid
    }
    JSONObject fieldValues = body.optJSONObject("fieldValues");
    if (fieldValues == null) {
        fieldValues = new JSONObject();
    }

    // Build evaluation context: field values (as currentValues + top-level) + session
    Map<String, Object> evalContext = buildEvalContext(fieldValues);

    // Evaluate all fields
    JSONObject visibility = new JSONObject();
    JSONObject readOnly = new JSONObject();

    for (Field field : tab.getADFieldList()) {
        if (!field.isActive()) continue;

        String propertyName = getPropertyName(field);

        // Evaluate displayLogic
        if (StringUtils.isNotBlank(field.getDisplayLogic())) {
            boolean isVisible = evaluateExpression(
                field.getDisplayLogic(), tab, field, evalContext, false);
            visibility.put(propertyName, isVisible);
        }

        // Evaluate readOnlyLogic
        Column column = field.getColumn();
        if (column != null && StringUtils.isNotBlank(column.getReadOnlyLogic())) {
            boolean isReadOnly = evaluateExpression(
                column.getReadOnlyLogic(), tab, field, evalContext, true);
            readOnly.put(propertyName, isReadOnly);
        }
    }

    JSONObject result = new JSONObject();
    result.put("visibility", visibility);
    result.put("readOnly", readOnly);
    writeResponse(response, NeoResponse.ok(result));
}

/**
 * Build evaluation context merging request field values with OBContext session data.
 *
 * Field values are stored in TWO places:
 * 1. As "currentValues" map — used by OB.Utilities.getValue(currentValues, 'key')
 *    (this is how DynamicExpressionParser resolves field column references)
 * 2. As top-level context keys — used by auxiliary inputs and session variables
 *    that resolve to context.varName (not OB.Utilities.getValue)
 *
 * Session variables (AD_Org_ID, AD_Client_ID, etc.) are added as fallback
 * for expressions that reference session context.
 */
private Map<String, Object> buildEvalContext(JSONObject fieldValues) {
    Map<String, Object> ctx = new HashMap<>();

    // Convert fieldValues to a Map that Rhino can access
    Map<String, Object> currentValues = new HashMap<>();
    Iterator<String> keys = fieldValues.keys();
    while (keys.hasNext()) {
        String key = keys.next();
        Object value = fieldValues.get(key);
        currentValues.put(key, value == JSONObject.NULL ? null : value);
    }

    // 1. Store as "currentValues" for OB.Utilities.getValue(currentValues, 'key')
    ctx.put("currentValues", currentValues);

    // 2. Store at top level for context.varName references (auxiliary inputs, etc.)
    ctx.putAll(currentValues);

    // 3. Add session context (for session variables not in field values)
    OBContext obCtx = OBContext.getOBContext();
    ctx.put("AD_Org_ID", obCtx.getCurrentOrganization().getId());
    ctx.put("AD_Client_ID", obCtx.getCurrentClient().getId());
    ctx.put("AD_Role_ID", obCtx.getRole().getId());
    ctx.put("AD_User_ID", obCtx.getUser().getId());

    return ctx;
}

/**
 * Evaluate a single displayLogic or readOnlyLogic expression.
 *
 * Pipeline:
 * 1. replaceSystemPreferencesInDisplayLogic() — resolves @#VAR@ to inline values
 *    and expands @ACCT_DIMENSION_DISPLAY@ macro (static, pre-parser step)
 * 2. DynamicExpressionParser(expr, tab, field) — resolves field refs, auxiliary
 *    inputs, session vars, accounting dimensions → SmartClient JS
 * 3. Prepend OB_UTILITIES_SHIM so Rhino can evaluate OB.Utilities.getValue() calls
 * 4. OBScriptEngine.eval() — evaluate the complete JS expression
 *
 * On failure, returns the safe default:
 * - displayLogic: true (visible — don't hide fields that might be needed)
 * - readOnlyLogic: true (read-only — don't allow edits when unsure)
 *
 * @param expression     Raw AD expression (e.g., "@DocStatus@='CO'&@Processed@='Y'")
 * @param tab            AD_Tab for field and parent resolution
 * @param field          AD_Field for field-type detection (date, YesNo)
 * @param evalContext     Evaluation context with currentValues + session data
 * @param isReadOnlyLogic true if evaluating readOnlyLogic (affects safe default)
 */
private boolean evaluateExpression(String expression, Tab tab, Field field,
        Map<String, Object> evalContext, boolean isReadOnlyLogic) {
    try {
        // Step 1: Replace system preferences and expand macros
        String preprocessed = DynamicExpressionParser
            .replaceSystemPreferencesInDisplayLogic(expression);

        // Step 2: Parse — resolves all variable types to SmartClient JS
        DynamicExpressionParser parser =
            new DynamicExpressionParser(preprocessed, tab, field);
        String jsExpr = parser.getJSExpression();

        // Step 3: Prepend shim for OB.Utilities.getValue / OB.Utilities.Date.JSToOB
        String fullScript = OB_UTILITIES_SHIM + "\n" + jsExpr;

        // Step 4: Evaluate using Rhino (sandboxed)
        Object result = OBScriptEngine.getInstance().eval(fullScript, evalContext);
        return Boolean.TRUE.equals(result);

    } catch (Exception e) {
        log.warn("Failed to evaluate expression: {} for field: {}",
            expression, field != null ? field.getName() : "tab-level", e);
        // Safe defaults: show the field, but don't allow editing
        return isReadOnlyLogic;  // true=readOnly (lock), true=visible (show) — both safe
    }
}

/**
 * Get the property name for a field, matching the JSON keys used by
 * NEO Headless GET responses.
 *
 * Uses the same DAL mapping as NeoFieldFilter:
 *   DB column name → Entity.getPropertyByColumnName() → Property.getName()
 *
 * Examples:
 *   C_BPARTNER_ID  → businessPartner
 *   DOCSTATUS      → documentStatus
 *   GRANDTOTAL     → grandTotalAmount
 *
 * This ensures the keys in the evaluate-display response (visibility, readOnly)
 * match exactly the keys in NEO Headless GET responses, so the frontend can
 * correlate them without any key transformation.
 */
private String getPropertyName(Field field) {
    Column column = field.getColumn();
    if (column == null) {
        return field.getName();
    }
    Entity dalEntity = ModelProvider.getInstance()
        .getEntityByTableId(column.getTable().getId());
    if (dalEntity != null) {
        Property prop = dalEntity.getPropertyByColumnName(column.getDBColumnName());
        if (prop != null) {
            return prop.getName();
        }
    }
    return column.getDBColumnName();
}
```

---

## 8. OpenAPI Documentation

### Registration in NeoOpenAPIEndpoint

Add a new method following the pattern of `addSelectorPaths()`:

```java
/**
 * Register /evaluate-display endpoint in OpenAPI for each entity.
 * Called from addWindowPaths() alongside addSelectorPaths() and addActionPaths().
 */
private void addEvaluateDisplayPaths(OpenAPI openAPI, String specName, String entityName) {
    String path = BASE_PATH + specName + "/" + entityName + "/evaluate-display";
    PathItem pathItem = getOrCreatePathItem(openAPI, path);

    // --- Request body schema ---
    Schema<?> fieldValuesSchema = new ObjectSchema()
        .description("Current field values from the form. "
            + "Keys are property names (camelCase) as returned by GET responses.")
        .additionalProperties(new Schema<>());

    Schema<?> requestSchema = new ObjectSchema()
        .addProperty("fieldValues", fieldValuesSchema);

    RequestBody requestBody = new RequestBody()
        .required(false)
        .description("Field values for expression evaluation. "
            + "Empty body evaluates using only session/preference context.")
        .content(new Content().addMediaType("application/json",
            new MediaType().schema(requestSchema)));

    // --- Response schema ---
    Schema<?> boolMapSchema = new ObjectSchema()
        .description("Map of propertyName -> boolean")
        .additionalProperties(new BooleanSchema());

    Schema<?> responseSchema = new ObjectSchema()
        .addProperty("visibility", boolMapSchema
            .description("Display logic results. true = visible, false = hidden. "
                + "Fields without displayLogic are omitted (default visible)."))
        .addProperty("readOnly", boolMapSchema
            .description("ReadOnly logic results. true = read-only, false = editable. "
                + "Fields without readOnlyLogic are omitted (default editable)."));

    // --- Operation ---
    Operation evalOp = createOperation(
        "Evaluate display logic for " + entityName,
        "Evaluates all displayLogic and readOnlyLogic expressions for the fields "
            + "of this entity. Uses the raw AD expressions with full server-side "
            + "variable resolution (session context, preferences, accounting "
            + "dimensions, auxiliary inputs). Returns a map of field visibility "
            + "and read-only states.");

    evalOp.setRequestBody(requestBody);
    evalOp.responses(new ApiResponses()
        .addApiResponse("200", createJsonResponse(
            "Evaluated display logic for all fields", responseSchema))
        .addApiResponse("400", createErrorResponse("Invalid request body"))
        .addApiResponse("401", createErrorResponse("Unauthorized"))
        .addApiResponse("404", createErrorResponse("Spec or entity not found"))
        .addApiResponse("405", createErrorResponse("Method not allowed")));

    pathItem.post(evalOp);
    openAPI.getPaths().addPathItem(path, pathItem);
}
```

### Call from addWindowPaths()

```java
private void addWindowPaths(OpenAPI openAPI, SFSpec spec) {
    for (SFEntity entity : spec.getEntities()) {
        String entityName = entity.getName();
        addCrudPaths(openAPI, spec.getName(), entityName, entity);
        addSelectorPaths(openAPI, spec.getName(), entityName);
        addActionPaths(openAPI, spec.getName(), entityName);
        addEvaluateDisplayPaths(openAPI, spec.getName(), entityName);  // NEW
    }
}
```

### OpenAPI Spec Output (YAML)

The generated spec for a Sales Order entity would include:

```yaml
/sws/neo/salesOrder/Order/evaluate-display:
  post:
    summary: Evaluate display logic for Order
    description: >
      Evaluates all displayLogic and readOnlyLogic expressions for the fields
      of this entity. Uses the raw AD expressions with full server-side
      variable resolution (session context, preferences, accounting dimensions,
      auxiliary inputs). Returns a map of field visibility and read-only states.
    requestBody:
      required: false
      description: >
        Field values for expression evaluation.
        Empty body evaluates using only session/preference context.
      content:
        application/json:
          schema:
            type: object
            properties:
              fieldValues:
                type: object
                description: >
                  Current field values from the form.
                  Keys are property names (camelCase) as returned by GET responses.
                additionalProperties: true
    responses:
      "200":
        description: Evaluated display logic for all fields
        content:
          application/json:
            schema:
              type: object
              properties:
                visibility:
                  type: object
                  description: >
                    Display logic results. true = visible, false = hidden.
                    Fields without displayLogic are omitted (default visible).
                  additionalProperties:
                    type: boolean
                readOnly:
                  type: object
                  description: >
                    ReadOnly logic results. true = read-only, false = editable.
                    Fields without readOnlyLogic are omitted (default editable).
                  additionalProperties:
                    type: boolean
      "400":
        description: Invalid request body
      "401":
        description: Unauthorized
      "404":
        description: Spec or entity not found
      "405":
        description: Method not allowed
```

---

## 9. Existing Etendo Components

These components already exist in the Etendo codebase. The server-side evaluator is built by composing them rather than implementing expression parsing from scratch.

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

---

## 10. Tests

### Path Parser Tests (NeoServletPathTest.java)

```java
@Test
public void testParsePathEvaluateDisplay() {
    NeoServlet.NeoPathInfo info = servlet.parsePath("/mySpec/Order/evaluate-display");
    assertEquals("mySpec", info.specName);
    assertEquals("Order", info.entityName);
    assertTrue(info.isEvaluateDisplay);
    assertNull(info.recordId);
    assertFalse(info.isSelector);
    assertFalse(info.isAction);
}

@Test
public void testParsePathEvaluateDisplayNotConfusedWithRecordId() {
    // "evaluate-display" at position 3 is a keyword, not a recordId
    NeoServlet.NeoPathInfo info = servlet.parsePath("/mySpec/Order/evaluate-display");
    assertNull(info.recordId);
    assertTrue(info.isEvaluateDisplay);
}
```

### Integration Tests (OBBaseTest)

```java
/**
 * Test evaluate-display endpoint with a real Sales Order tab.
 * Verifies that session variables, preferences, and field-based expressions
 * are all resolved correctly.
 */
@Test
public void testEvaluateDisplayBasicVisibility() throws Exception {
    // POST with a "Completed" order -- processed fields should become read-only
    JSONObject fieldValues = new JSONObject();
    fieldValues.put("documentStatus", "CO");
    fieldValues.put("processed", true);

    JSONObject body = new JSONObject();
    body.put("fieldValues", fieldValues);

    JSONObject result = doPost("/sws/neo/salesOrder/Order/evaluate-display", body);

    // documentStatus should be read-only when processed
    assertTrue(result.getJSONObject("readOnly").getBoolean("documentStatus"));

    // visibility map should contain entries for fields with displayLogic
    JSONObject visibility = result.getJSONObject("visibility");
    assertNotNull(visibility);
}

@Test
public void testEvaluateDisplayEmptyBody() throws Exception {
    // Empty body -- should evaluate session-only expressions without error
    JSONObject result = doPost("/sws/neo/salesOrder/Order/evaluate-display",
        new JSONObject());

    // Should still return visibility/readOnly maps (session-based evaluation)
    assertNotNull(result.getJSONObject("visibility"));
    assertNotNull(result.getJSONObject("readOnly"));
}

@Test
public void testEvaluateDisplayMethodNotAllowed() throws Exception {
    // GET should return 405
    int status = doGet("/sws/neo/salesOrder/Order/evaluate-display");
    assertEquals(405, status);
}

@Test
public void testEvaluateDisplayNotFoundEntity() throws Exception {
    // Non-existent entity should return 404
    JSONObject result = doPost(
        "/sws/neo/salesOrder/NonExistent/evaluate-display", new JSONObject());
    assertEquals(404, getLastResponseStatus());
}
```

### Contract Tests (Schema Forge, Node.js)

```javascript
describe('evaluate-display contract', () => {
  it('should include evaluable flag in contract fields with displayLogic', () => {
    const contract = loadContract('sales-order');
    const field = contract.entities.Order.fields.discountPercent;

    expect(field.displayLogic).toBeDefined();
    expect(field.displayLogic.evaluable).toBe(true);  // or false
    expect(field.displayLogic.raw).toMatch(/@\w+@/);  // Has raw expression
  });

  it('should have reason for non-evaluable fields', () => {
    const contract = loadContract('sales-order');
    const field = contract.entities.Order.fields.accountingDimension;

    expect(field.displayLogic.evaluable).toBe(false);
    expect(field.displayLogic.reason).toMatch(
      /^(session-preference|session-variable|accounting-dimension|server-macro|auxiliary-input|translation-failure)$/
    );
    expect(field.displayLogic.js).toBeNull();
  });
});
```

---

## 11. Implementation Plan

### Phase A: Schema Forge CLI (no Java changes)

| Step | Description | Effort | Files |
|------|-------------|--------|-------|
| A1 | Fix `translateExpression()` bugs: `!` to `!=`, `@#`/`@$` prefix stripping | Low (~10 lines) | `cli/src/extract-rules.js` |
| A2 | Add `evaluable` and `reason` flags to contract output | Low (~30 lines) | `cli/src/generate-contract.js` |
| A3 | Update frontend generator: emit server fallback for `evaluable: false` | Medium (~40 lines) | `cli/src/generate-frontend.js` |
| A4 | Contract tests for evaluable flag | Low (~20 lines) | `cli/src/run-contract-tests.js` |

**Deliverable:** Frontend shows non-evaluable fields as always-visible (safe default) until Phase B.

### Phase B: Etendo Go -- NeoServlet Route (can run in parallel with Phase A)

| Step | Description | Effort | Files |
|------|-------------|--------|-------|
| B1 | Extend `NeoPathInfo` with `isEvaluateDisplay` flag | Low (~5 lines) | `NeoServlet.java` |
| B2 | Add `evaluate-display` keyword detection to `parsePath()` | Low (~5 lines) | `NeoServlet.java` |
| B3 | Add routing branch in `processRequest()` | Low (~3 lines) | `NeoServlet.java` |
| B4 | Implement `handleEvaluateDisplay()` method | Medium (~80 lines) | `NeoServlet.java` |
| B5 | Path parser unit tests | Low (~15 lines) | `NeoServletPathTest.java` |

### Phase C: OpenAPI Documentation

| Step | Description | Effort | Files |
|------|-------------|--------|-------|
| C1 | Add `addEvaluateDisplayPaths()` method | Medium (~40 lines) | `NeoOpenAPIEndpoint.java` |
| C2 | Call from `addWindowPaths()` | Low (~1 line) | `NeoOpenAPIEndpoint.java` |
| C3 | Update `docs/neo-headless.md` with endpoint documentation | Low | `docs/neo-headless.md` |

### Phase D: Integration Tests

| Step | Description | Effort | Files |
|------|-------------|--------|-------|
| D1 | Integration tests (OBBaseTest) for evaluate-display | Medium (~60 lines) | New test class |
| D2 | End-to-end test: frontend calls endpoint, renders correctly | Medium | Manual / Cypress |

### Recommended Execution Order

```
Phase A (Schema Forge) ──────────────┐
                                      ├──> Phase D (Integration Tests)
Phase B + C (Etendo Go) ─────────────┘
```

Phases A and B+C can run in parallel. Phase D depends on both completing.

---

## 12. UI Behavior During Transition

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

## 13. Key Files Reference

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
| `NeoServlet.java` | Main servlet: path parser, routing, new `handleEvaluateDisplay()` |
| `NeoPathInfo` (inner class) | Extend with `isEvaluateDisplay` flag |
| `NeoOpenAPIEndpoint.java` | Add `addEvaluateDisplayPaths()` for OpenAPI generation |
| `NeoServletPathTest.java` | Path parser tests for new keyword |
| `docs/neo-headless.md` | API reference documentation |

---

## 14. Design Decisions (Resolved)

These questions were raised during proposal review and resolved:

### 1. Auxiliary input evaluation order

**Decision: Pre-compute without dependency sorting.**

`DynamicExpressionParser` does NOT handle auxiliary input dependency ordering — it resolves variables but doesn't sort them. `FormInitializationComponent` iterates sequentially without reordering either.

However, in practice (verified on Sales Order), **no auxiliary inputs reference other auxiliary inputs** — they all depend on direct field values (`@C_ORDER_ID@`, `@M_PRODUCT_ID@`, etc.). The endpoint pre-computes all auxiliary inputs before evaluating display logic expressions, matching the existing `FormInitializationComponent` behavior.

**Limitation:** If a future window has auxiliary inputs that depend on each other, a topological sort (similar to `DefaultsProcessActionHandler.reorderParams()`) would need to be added. Documented as a known limitation, not implemented now.

### 2. Tab hierarchy / parent field resolution

**Decision: Flat `fieldValues`, let the parser resolve internally.**

`DynamicExpressionParser` already distinguishes between field-level and tab-level display logic:
- **Field-level** (`tabLevelDisplayLogic = false`): resolves `@VAR@` against current tab fields first, never looks at parent. Child wins.
- **Tab-level** (`tabLevelDisplayLogic = true`): resolves `@VAR@` against ancestor tabs via `lookForFieldInAncestorTabs()`. Parent wins.

The parser handles this internally based on the `Tab` and `Field` objects from AD metadata — no need for the frontend to separate parent/child values. The endpoint receives flat `fieldValues` and the parser decides what to resolve where.

Each entity calls its own `/evaluate-display` endpoint independently. One call per tab being rendered.

### 3. Caching strategy

**Decision: No cache, debounce only (300ms).**

The endpoint responds in <50ms for a tab with 30 fields. With 300ms debounce, the frontend makes at most ~3 calls/second during rapid editing. There is no meaningful performance gain from caching, and it avoids an entire class of stale-cache bugs.

If performance becomes an issue in the future, the first optimization would be to parse `raw` expressions to identify which fields trigger re-evaluation (smart invalidation), not a generic cache layer.

### 4. Partial evaluation

**Decision: No — all non-evaluable expressions go to the server.**

Splitting compound expressions to evaluate some parts client-side and some server-side would add significant complexity for minimal gain. The server evaluates the full expression as-is using `DynamicExpressionParser`, which is fast and already handles all variable types.

### 5. Tab-level display logic (tab visibility)

**Decision: Deferred to v2.**

The current endpoint evaluates field-level displayLogic and readOnlyLogic only. Tab-level display logic (whether to show/hide an entire tab) is a separate concern that will be addressed in a future iteration. The response schema is extensible — a `tabVisible` field can be added later without breaking existing clients.

### 6. DynamicExpressionParser output format

**Decision: Option A — inject OB.Utilities shim into Rhino context.**

#### The Problem

`DynamicExpressionParser.getJSExpression()` produces **SmartClient-dependent JavaScript**, not plain JS evaluable by Rhino alone. For field column references like `@DocStatus@`, it generates:

```javascript
OB.Utilities.getValue(currentValues, 'documentStatus') === 'CO'
```

For date fields, it generates:

```javascript
OB.Utilities.Date.JSToOB(OB.Utilities.getValue(currentValues, 'orderDate'), OB.Format.date)
```

These depend on `OB.Utilities.getValue()` and `OB.Utilities.Date.JSToOB()` — functions from the SmartClient UI layer that are NOT available in a bare Rhino/OBScriptEngine context.

#### Investigation: Constructor Differences

There are THREE constructors for `DynamicExpressionParser`:

| Constructor | `field` | `tabLevelDisplayLogic` | Used by |
|---|---|---|---|
| `(expr, tab, field)` | Set | `false` | Field-level display logic (most common) |
| `(expr, tab)` | `null` | `false` | Tab-only context (no field metadata) |
| `(expr, tab, tabLevelDisplayLogic)` | `null` | `true` | `evaluateDisplayLogicAtServerLevel()` |

**Critical finding:** Both constructor 1 and 2 produce `OB.Utilities.getValue()` for field references. The only difference is constructor 1 has field-specific metadata (date formatting, YesNo detection). Using constructor 2 does NOT avoid the SmartClient dependency.

The existing `OBViewFieldHandler.evaluateDisplayLogicAtServerLevel()` works because it only evaluates `DisplayLogic_Server` expressions — which reference **only session variables and preferences**, never field values. Those variables resolve to inline literals or `context.xxx`, never hitting the `OB.Utilities.getValue()` branch. Our endpoint evaluates **field-level** display logic that DOES reference field values, so we WILL hit that branch regardless of constructor choice.

#### Variable Resolution by Constructor (all use `getDisplayLogicTextTranslate()`, lines 374-466)

| Variable Type | Example | Output (both constructors 1 & 2) | Needs Shim? |
|---|---|---|---|
| Field column ref | `@DocStatus@` | `OB.Utilities.getValue(currentValues,'documentStatus')` | **Yes** |
| Date field ref | `@OrderDate@` | `OB.Utilities.Date.JSToOB(OB.Utilities.getValue(currentValues,'orderDate'),OB.Format.date)` | **Yes** |
| Auxiliary input | `@showAddPayment@` | `context.showAddPayment` | No |
| Session variable | `@FinancialManagement@` | `context.FinancialManagement` | No |
| System preference | `@#ShowAcct@` | `context._ShowAcct` | No |
| Accounting dimension | `@$Element_AY@` | Handled by `DimensionDisplayUtility` | No |
| Server macro | `@ACCT_DIMENSION_DISPLAY@` | Replaced by `replaceSystemPreferencesInDisplayLogic()` | No |
| Parent field ref | `@ParentField@` | Only resolved with `tabLevelDisplayLogic=true` | N/A for v1 |

Only field column references and date field references produce SmartClient-dependent code. All other variable types resolve to plain `context.xxx` references.

#### Decision Rationale

Three options were evaluated:

**(a) Inject OB.Utilities shim** — chosen.

**(b) Use tab-level constructor** — rejected. Both constructors produce `OB.Utilities.getValue()` for field references. The tab-level constructor (`tabLevelDisplayLogic=true`) avoids it, but then field references are NOT resolved to property values — they go to `otherTokensInExpression` instead. This breaks evaluation of the most common display logic pattern (`@SomeField@='someValue'`).

**(c) Custom evaluator** — rejected. Reimplements 500 lines of battle-tested code (`DynamicExpressionParser`) that handles session variables, preferences, macros, accounting dimensions, and auxiliary inputs. Not worth the risk.

#### The Shim

`OB.Utilities.getValue(obj, key)` does exactly `return obj[key]` — it is a null-safe property accessor in SmartClient. `OB.Utilities.Date.JSToOB(value, format)` converts JS dates to OB format strings — for display logic comparisons we only need string equality, so returning the value as-is is sufficient. `OB.Format.date` is a format string constant — the shim makes it a no-op.

```java
/**
 * Minimal shim for SmartClient functions used by DynamicExpressionParser output.
 * DynamicExpressionParser generates JS like:
 *   OB.Utilities.getValue(currentValues, 'documentStatus') === 'CO'
 *   OB.Utilities.Date.JSToOB(OB.Utilities.getValue(currentValues,'orderDate'), OB.Format.date)
 *
 * These functions don't exist in a bare Rhino context.
 * The shim provides trivial implementations:
 *   - getValue(obj, key) → obj[key]
 *   - Date.JSToOB(value, format) → value (pass-through, display logic only compares strings)
 *   - OB.Format.date → empty string (unused by pass-through JSToOB)
 */
private static final String OB_UTILITIES_SHIM =
    "var OB = { Utilities: { "
    + "getValue: function(obj, key) { return obj != null ? obj[key] : null; }, "
    + "Date: { JSToOB: function(v) { return v; } } }, "
    + "Format: { date: '' } };";
```

#### Updated `evaluateExpression()` Implementation

```java
private boolean evaluateExpression(String expression, Tab tab, Field field,
        Map<String, Object> evalContext, boolean isReadOnlyLogic) {
    try {
        // Step 1: Replace system preferences and macros (static, pre-parser)
        String preprocessed = DynamicExpressionParser
            .replaceSystemPreferencesInDisplayLogic(expression);

        // Step 2: Parse expression — resolves session vars, auxiliary inputs,
        // field references, accounting dimensions.
        // Uses constructor with field for accurate field-type detection.
        DynamicExpressionParser parser =
            new DynamicExpressionParser(preprocessed, tab, field);
        String jsExpr = parser.getJSExpression();

        // Step 3: Prepend OB.Utilities shim so Rhino can evaluate
        // SmartClient-dependent code (OB.Utilities.getValue, OB.Utilities.Date.JSToOB)
        String fullScript = OB_UTILITIES_SHIM + "\n" + jsExpr;

        // Step 4: Evaluate using Rhino (sandboxed)
        // evalContext must contain "currentValues" key with field values map
        Object result = OBScriptEngine.getInstance().eval(fullScript, evalContext);
        return Boolean.TRUE.equals(result);

    } catch (Exception e) {
        log.warn("Failed to evaluate expression: {} for field: {}",
            expression, field != null ? field.getName() : "tab-level", e);
        // Safe defaults: show the field, but don't allow editing
        return isReadOnlyLogic;  // true for readOnly (lock it), true for display (show it)
    }
}
```

#### Updated `buildEvalContext()` — must include `currentValues`

The parser output references `currentValues` as the object passed to `OB.Utilities.getValue()`. The eval context must contain this key with the field values from the request:

```java
private Map<String, Object> buildEvalContext(JSONObject fieldValues) {
    Map<String, Object> ctx = new HashMap<>();

    // Convert fieldValues to a Map that Rhino can access as "currentValues"
    Map<String, Object> currentValues = new HashMap<>();
    Iterator<String> keys = fieldValues.keys();
    while (keys.hasNext()) {
        String key = keys.next();
        Object value = fieldValues.get(key);
        currentValues.put(key, value == JSONObject.NULL ? null : value);
    }
    ctx.put("currentValues", currentValues);

    // Also add field values at top level for auxiliary inputs and session vars
    // that resolve to context.xxx (not OB.Utilities.getValue)
    ctx.putAll(currentValues);

    // Add session context (for variables not in field values)
    OBContext obCtx = OBContext.getOBContext();
    ctx.put("AD_Org_ID", obCtx.getCurrentOrganization().getId());
    ctx.put("AD_Client_ID", obCtx.getCurrentClient().getId());
    ctx.put("AD_Role_ID", obCtx.getRole().getId());
    ctx.put("AD_User_ID", obCtx.getUser().getId());

    return ctx;
}
```

**Key detail:** Field values must be present BOTH as `currentValues.xxx` (for `OB.Utilities.getValue(currentValues, 'xxx')`) AND as top-level `context.xxx` (for auxiliary inputs and session variables that resolve to `context.varName`). The `ctx.putAll(currentValues)` handles this.

#### Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Future Etendo version adds new `OB.*` function calls in parser output | Low | Detected immediately by tests (Rhino throws ReferenceError). Fix: extend shim. |
| `OB.Utilities.Date.JSToOB` pass-through produces wrong comparison for date fields | Medium | Display logic date comparisons use string format (`'2026-01-01'`). If Etendo changes comparison format, add proper date conversion to shim. |
| `OB.Format.date` is referenced but empty in shim | Low | Only used as second arg to `JSToOB`, which is a pass-through. No impact. |
| Shim diverges from real SmartClient behavior | Low | The shim only needs to support equality comparisons (`===`, `!==`), not full SmartClient functionality. Display logic is boolean-only. |
