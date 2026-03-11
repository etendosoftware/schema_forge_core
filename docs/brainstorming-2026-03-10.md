# Brainstorming — 2026-03-10

## NEO Headless: Customization, Callouts & Pipeline Integration

Research notes on three key topics for the Schema Forge → NEO Headless system.

---

## 1. Customizing NEO Headless Endpoints (NeoHandler)

NEO Headless supports custom endpoint logic via the **NeoHandler** CDI hook mechanism.

### Interface

```java
// modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoHandler.java
public interface NeoHandler {
  /**
   * Return a NeoResponse to take over the response,
   * or null to fall through to default DataSourceServlet behavior.
   */
  NeoResponse handle(NeoContext context);
}
```

### Creating a Custom Handler

```java
package com.example;

import javax.inject.Named;
import com.etendoerp.go.schemaforge.NeoHandler;
import com.etendoerp.go.schemaforge.NeoContext;
import com.etendoerp.go.schemaforge.NeoResponse;
import org.codehaus.jettison.json.JSONObject;

@Named("myCustomHandler")
public class MyCustomHandler implements NeoHandler {

  @Override
  public NeoResponse handle(NeoContext context) {
    if ("POST".equals(context.getHttpMethod())) {
      // Custom create logic
      JSONObject result = new JSONObject();
      result.put("id", "new-id");
      return NeoResponse.created(result);
    }
    // Return null → fall through to default DataSourceServlet behavior
    return null;
  }
}
```

### How It Works

1. **Configuration:** Set `JAVA_QUALIFIER = 'myCustomHandler'` on the `ETGO_SF_ENTITY` record (via webhook or AD).
2. **Discovery:** NeoServlet calls `WeldUtils.getInstances(NeoHandler.class)` and matches `@Named` annotation value against the qualifier.
3. **Invocation:** `handler.handle(context)` is called before default behavior.
4. **Decision point:**
   - Return `NeoResponse` → **full control** (custom status, body, headers).
   - Return `null` → **fall through** to default DataSourceServlet handling.

### Request Lifecycle

```
Client Request (JWT Bearer Token)
    │
    ├─ authenticateJwt()                              → 401 Unauthorized
    ├─ parsePath(request.getPathInfo())               → 400 Bad Request
    ├─ findSpec(specName)                             → 404 Not Found
    ├─ Check access (window/process)                  → 403 Forbidden
    ├─ findEntity(spec, entityName)                   → 404 Not Found
    ├─ Check method enabled                           → 405 Not Allowed
    ├─ Build NeoContext (spec, entity, method, body, params, tab, OBContext)
    │
    └─► entity.getJavaQualifier()
            │
            ├─ Has qualifier → lookupHandler(qualifier)
            │                   │
            │                   └─ handler.handle(context)
            │                       ├─ returns NeoResponse  →  FULL CONTROL
            │                       └─ returns null         →  FALL THROUGH
            │
            └─ No qualifier  → handleDefault() (DataSourceServlet)
```

### NeoContext — Available Data

| Method | Type | Description |
|--------|------|-------------|
| `getSpecName()` | String | First URL segment (spec identifier) |
| `getEntityName()` | String | Second URL segment (entity identifier) |
| `getHttpMethod()` | String | GET, POST, PUT, PATCH, DELETE |
| `getRecordId()` | String | Record UUID (null for list/create) |
| `getRequestBody()` | JSONObject | Parsed JSON body (POST/PUT/PATCH) |
| `getQueryParams()` | Map<String,String> | Query string parameters |
| `getAdTab()` | Tab | Etendo AD_Tab DAL object |
| `getObContext()` | OBContext | Current user context (client, org, role) |
| `getPreviousResult()` | NeoResponse | For chaining (post-processing) |

### NeoResponse — Static Builders

```java
NeoResponse.ok(jsonObject)              // 200 + body
NeoResponse.created(jsonObject)         // 201 + body
NeoResponse.noContent()                 // 204, no body
NeoResponse.error(status, "message")    // Any status + error JSON
response.withHeader("X-Custom", "val") // Add custom headers
```

### Current State

No custom NeoHandler implementations exist yet in the codebase. Only the interface and the servlet's lookup/invocation mechanism are in place.

---

## 2. Callouts: Backend Execution Status

### Key Finding: Callouts are NOT Executed in NEO Headless

Callouts are explicitly **deferred** from the current implementation. From `neo-headless.md` Section 9 (Future Considerations):

> **Callout endpoints.** Etendo callouts (field-change triggers) are not exposed through the API.
> A callout endpoint would allow clients to request server-side field recalculations when a field value changes.

### How Callouts Work in Classic Etendo

In the **classic Etendo UI**, callouts execute server-side via the `/ad_callouts/` servlet when a user changes a field value. The servlet invokes the Java callout class, which typically runs multiple DB queries and returns field updates to the form.

### How Callouts Are Handled in Schema Forge

Schema Forge **extracts and catalogs** callouts but does NOT generate executable backend code:

1. **Extraction** (`extract-rules.js`): Queries `AD_Callout` + `AD_Model_Object` for Java class, trigger column, and linked table.
2. **Source analysis**: Finds Java source, counts branches/LOC, detects DML operations, lists field effects.
3. **Classification** (`pre-classify.js`): Auto-classifies based on complexity:
   - Low complexity + ≤2 effects → `tier: 'auto'`, `autoDecision: 'keep'`
   - Has DML or high complexity → `tier: 'human'`, `decision: 'pending'`
4. **Human curation**: Decision Panel UI shows callouts for human review (Keep/Replace/Simplify/Omit).

### The Gap

| Decision | Classic UI | NEO Headless REST API |
|----------|-----------|----------------------|
| **Keep** | Callout stays registered, Etendo executes it | **Not executed** — no endpoint |
| **Replace** | New handler substitutes original | Still needs REST endpoint to be callable |
| **Simplify** | Subset of logic | Same problem |
| **Omit** | Unregistered from AD | Fields may need manual input |

### Proposed Solutions (Deferred to v2)

From `pending/callout-endpoints-proposal.md`:

**Option A — Per-field endpoints:**
```
POST /sws/neo/{specName}/callout/{fieldName}
Body: { "value": "new-value", "formData": { ... } }
Response: { "updates": { "field1": "val1", "field2": "val2" } }
```

**Option B — Generic dispatcher** (recommended for v2):
```
POST /sws/neo/{specName}/callout
Body: { "field": "fieldName", "value": "new-value", "formData": { ... } }
Response: { "updates": { ... } }
```

**Decision:** Defer callouts to v2. Focus on CRUD first. All 12 Sales Order callouts require server-side DB access (warehouse queries, tax lookups, price calculations), so client-side reimplementation is not viable.

---

## 3. Pipeline Integration: Extraction/Curation → NEO Headless

### Current Pipeline (9 phases)

```
F1a: extract-fields.js   → schema-raw.json
F1b: extract-rules.js    → rules-raw.json
F2:  validate-schema.js  → validation report
F3:  pre-classify.js     → auto-classified rules
F4:  human decisions     → schema-curated.json, rules-curated.json
F6:  generate-contract   → contract.json (frontend + backend + tests)
F7:  push-to-neo (planned) → Webhook calls → ETGO_SF_* config (replaces code generation)
F8:  generate-frontend   → React SPA
F8b: translate-todos     → AI translates callout/onchange TODOs in generated components
F9:  run-contract-tests  → test execution
```

### Curated Schema Format → Webhook Mapping

The curated schema (`schema-curated.json`) contains all data needed to configure NEO Headless:

```json
{
  "window": {
    "id": "204",
    "name": "Payment Term",
    "primaryEntity": "paymentTerm"
  },
  "entities": [
    {
      "name": "paymentTerm",
      "tableName": "C_PaymentTerm",
      "fields": [
        {
          "name": "name",
          "column": "Name",
          "visibility": "editable",
          "required": true
        },
        {
          "name": "adClientId",
          "column": "AD_Client_ID",
          "visibility": "system",
          "derivation": { "type": "fromConfig", "source": "context.client" }
        }
      ]
    }
  ]
}
```

### Four Webhooks (All Ready and Idempotent)

| Webhook | Table | Required Params | Optional Params |
|---------|-------|-----------------|-----------------|
| `SFUpsertSpec` | ETGO_SF_SPEC | Name, ModuleID, WindowID (type W) or ProcessID (type P) | Description, SpecType, SpecID |
| `SFUpsertEntity` | ETGO_SF_ENTITY | SpecID, TabID, ModuleID | Name, IsIncluded, IsGet/Post/Put/Patch/Delete, JavaQualifier, SeqNo |
| `SFUpsertField` | ETGO_SF_FIELD | EntityID, ColumnID, ModuleID | IsIncluded, IsReadOnly, DefaultValue, JavaQualifier, SeqNo |
| `SFPopulateSpec` | (bulk) | SpecID, ModuleID | IncludeAllMethods, ExcludeSystemColumns |

### Visibility → Webhook Field Mapping

| Curated Visibility | IsIncluded | IsReadOnly | Notes |
|-------------------|-----------|-----------|-------|
| `editable` | Y | N | User input, in request + response |
| `readOnly` | Y | Y | Display only, response only |
| `system` | N | — | Auto-derived, hidden from API |
| `discarded` | N | — | Excluded entirely |

### Proposed Call Sequence

```
schema-curated.json
    │
    ├─ 1. SFUpsertSpec
    │      Name = window.name (slugified)
    │      WindowID = window.id
    │      ModuleID = target module UUID
    │      → Returns SpecID
    │
    ├─ 2. For each entity:
    │      SFUpsertEntity
    │          SpecID = from step 1
    │          TabID = entity.tabId
    │          Name = entity.name
    │          IsGet = Y, IsGetbyid = Y, IsPost = Y, IsPut = Y, IsPatch = Y, IsDelete = Y
    │          JavaQualifier = (if custom handler needed)
    │          → Returns EntityID
    │
    ├─ 3. For each field in each entity:
    │      SFUpsertField
    │          EntityID = from step 2
    │          ColumnID = field.columnId
    │          IsIncluded = (Y if editable/readOnly, N if system/discarded)
    │          IsReadOnly = (Y if readOnly, N if editable)
    │          → Returns FieldID
    │
    └─ 4. Optional: SFPopulateSpec
           SpecID = from step 1
           (Auto-fills any remaining fields from AD metadata)
```

### What's Missing

A new CLI module (`push-to-neo.js` or similar) that:

1. Reads `schema-curated.json` from the artifacts directory
2. Connects to Etendo webhooks (needs host/port/auth configuration)
3. Calls webhooks in the correct sequence (Spec → Entity → Field)
4. Handles errors and retries (webhooks are idempotent, safe to re-run)
5. Tracks state (which windows have been successfully pushed)
6. Optionally calls `SFPopulateSpec` to auto-fill remaining fields

This module would bridge the gap between Schema Forge design-time decisions and NEO Headless runtime configuration, completing the automation loop.

### Alternative: Two-Strategy Approach

Instead of only using `push-to-neo.js`, there are two complementary strategies:

- **Strategy A — Curated push:** Use `push-to-neo.js` for windows that went through full extraction/curation. Fields are precisely controlled (visibility, read-only, included/excluded).
- **Strategy B — Auto-populate:** Use `SFPopulateSpec` webhook for windows that don't need fine-grained control. It reads AD metadata directly and includes all active tabs and columns with sensible defaults.

Both can coexist — auto-populate for quick setup, curated push for refined control.
