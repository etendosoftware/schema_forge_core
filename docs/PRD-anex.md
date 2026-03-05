# Schema Forge — PRD Annex A

## API Versioning Model

### Companion to PRD v2.1

---

## A.1 Three Independent Version Numbers

Schema Forge uses three version numbers that evolve independently. Each tracks a different type of change and has a different audience.

```
moduleVersion:      2.3.0   ← the deploy pipeline reads this
apiVersion:         2.0.0   ← the frontend reads this
behavioralVersion:  5.0.0   ← the test suite reads this
```

| Version | What it Tracks | Who Consumes It | When it Changes |
|---------|---------------|-----------------|-----------------|
| moduleVersion | Everything — any regeneration of the module | Deploy pipeline, CI/CD, provenance | Every time the module is regenerated |
| apiVersion | Shape — fields in DTOs, endpoint paths, accepted filters, request/response schemas | Frontend application | When visible fields change, searchable fields change, or endpoints change |
| behavioralVersion | Behavior — postconditions, side effects, edge cases, rule changes, process changes | Test suite (JUnit + Node.js) | When business rules change, processes change, or new edge cases are declared |

The key insight: **behavioral changes are invisible to the frontend.** If a callout gains a new validation, or a process adds a step, or an edge case is declared, the frontend doesn't need to know. It sends the same fields to the same endpoints and gets the same shape back. What changed is what the backend does internally — and only the tests need to verify that.

---

## A.2 What the Frontend Sees

The frontend targets exactly one apiVersion. It doesn't know or care about behavioralVersion or moduleVersion.

```
Frontend v2 → requests /schemaforge/v2/orders
           → expects OrderDTO_v2 shape
           → sends OrderCreateDTO_v2 on POST
           → uses filters: documentNo, businessPartner, salesRep

Frontend v2 does NOT know:
  - That the backend also serves /v1/ for old clients
  - That the business rules changed 3 times since v2 launched
  - That the module was regenerated 5 times
```

The frontend's contract is a simple declaration:

```json
{
  "frontendContract": {
    "apiVersion": "2.0.0",
    "entities": {
      "order": {
        "fields": [
          { "name": "documentNo", "type": "string", "editable": false },
          { "name": "dateOrdered", "type": "string", "editable": true },
          { "name": "businessPartner", "type": "string", "editable": true },
          { "name": "salesRep", "type": "string", "editable": true },
          { "name": "grandTotal", "type": "number", "editable": false },
          { "name": "documentStatus", "type": "string", "editable": false }
        ],
        "searchableFields": ["documentNo", "businessPartner", "salesRep"]
      }
    },
    "actions": [
      { "name": "complete", "endpoint": "/schemaforge/v2/orders/{id}/complete", "method": "POST" }
    ]
  }
}
```

If the frontend needs to recompile or change to keep working, the apiVersion changes. If it doesn't, the apiVersion stays.

---

## A.3 What the Tests See

The test suite reads both apiVersion and behavioralVersion. Contract tests (Node.js) verify API shape. Behavioral tests (JUnit) verify backend behavior.

```json
{
  "testManifest": {
    "apiVersion": "2.0.0",
    "behavioralVersion": "5.0.0",
    
    "contractTests": [
      "These verify shape — tied to apiVersion",
      "If apiVersion didn't change, these tests are identical"
    ],
    
    "behavioralTests": [
      "These verify behavior — tied to behavioralVersion",
      "Can change independently of apiVersion",
      "New postconditions, new edge cases, changed rules"
    ]
  }
}
```

A behavioral version can advance 5 times without the API version changing. The contract tests stay the same. The behavioral tests grow.

---

## A.4 Change Classification

Every change to the schema, rules, or processes maps to exactly one of these patterns:

### A.4.1 Changes That Affect API Version

These changes alter what the frontend sees. They require a new apiVersion.

| Change | Breaking? | Deploy Strategy |
|--------|-----------|-----------------|
| Visible field added (optional) | No | Rolling |
| Visible field added (required) | Yes | Blue-green |
| Visible field removed | Yes | Blue-green |
| Visible field type changed | Yes | Blue-green |
| Field moved from visible to system | Yes | Blue-green |
| Field moved from system to visible | No | Rolling |
| Searchable field added | No | Rolling |
| Searchable field removed | Yes | Blue-green |
| New process endpoint | No | Rolling |
| Process endpoint removed | Yes | Blue-green |

### A.4.2 Changes That Affect Only Behavioral Version

These changes alter what the backend does internally. The frontend is unaffected. No new apiVersion needed.

| Change | Impact |
|--------|--------|
| Callout changes behavior (Keep — same class, new logic) | Existing behavioral tests may fail, need update |
| Callout replaced (Replace — new class) | New behavioral tests generated |
| Callout simplified | Modified behavioral tests |
| Callout omitted | Behavioral tests removed, cross-reference validates |
| Event handler changes | Behavioral tests updated |
| Process adds precondition | New 400 case, new behavioral test |
| Process adds step | New postcondition, new behavioral test |
| Process removes step | Postcondition removed, behavioral test removed |
| Process adds edge case | New behavioral test |
| System field derivation changes | Derivation test updated |
| System field added | New derivation test |

### A.4.3 Changes That Affect Only Module Version

| Change | Impact |
|--------|--------|
| Code reformatting, comments | No functional change |
| Internal refactoring | Same behavior, same shape |
| Build configuration change | Module structure change |
| Provenance metadata update | Traceability only |

---

## A.5 Multi-Version Backend

### A.5.1 Mechanism

The generated module contains endpoint classes for each supported API version. Each version has its own DTO and its own endpoint class. They share the same underlying OBDal entity, the same derivation handlers, the same processes, and the same business rules.

```
Generated Module
  │
  ├── entity/          (shared — OBDal, not versioned)
  │     └── Order.java is Etendo's, not generated
  │
  ├── event/           (shared — not versioned)
  │     ├── OrderDerivationHandler.java
  │     └── OrderLineTotalHandler.java
  │
  ├── process/         (shared — not versioned)
  │     ├── CompleteOrderProcess.java
  │     └── VoidOrderProcess.java
  │
  ├── dto/             (VERSIONED)
  │     ├── v1/
  │     │     ├── OrderDTO_v1.java
  │     │     └── OrderCreateDTO_v1.java
  │     └── v2/
  │           ├── OrderDTO_v2.java
  │           └── OrderCreateDTO_v2.java
  │
  └── api/             (VERSIONED)
        ├── v1/
        │     └── OrderRxEndpoint_v1.java  → @Path("/schemaforge/v1/orders")
        └── v2/
              └── OrderRxEndpoint_v2.java  → @Path("/schemaforge/v2/orders")
```

### A.5.2 Lifecycle of a Version

```
Phase 1: Only v1 exists
  ┌─────────────────────────────────┐
  │ Module serves:                  │
  │   /schemaforge/v1/orders  (v1)  │
  │                                 │
  │ Frontend targets: v1            │
  └─────────────────────────────────┘

Phase 2: v2 deployed alongside v1
  ┌─────────────────────────────────┐
  │ Module serves:                  │
  │   /schemaforge/v1/orders  (v1)  │
  │   /schemaforge/v2/orders  (v2)  │
  │                                 │
  │ Backend contract:               │
  │   supportedApiVersions: [v1,v2] │
  │                                 │
  │ Old frontend: still on v1       │
  │ New frontend: switches to v2    │
  └─────────────────────────────────┘

Phase 3: Grace period (configurable, default 30 days)
  ┌─────────────────────────────────┐
  │ v1 endpoints still active       │
  │ v1 marked as deprecated         │
  │ Monitoring: any v1 traffic?     │
  └─────────────────────────────────┘

Phase 4: v1 retired
  ┌─────────────────────────────────┐
  │ Module regenerated without v1   │
  │   /schemaforge/v1/orders → 410  │
  │   /schemaforge/v2/orders  (v2)  │
  │                                 │
  │ Backend contract:               │
  │   supportedApiVersions: [v2]    │
  └─────────────────────────────────┘
```

### A.5.3 410 Gone for Retired Versions

When a version is retired, its endpoint path returns 410 with a message directing to the current version:

```json
{
  "error": {
    "code": "API_VERSION_RETIRED",
    "message": "API version v1 is no longer supported. Use /schemaforge/v2/orders",
    "currentVersion": "v2",
    "retiredAt": "2026-05-15T00:00:00Z"
  }
}
```

---

## A.6 Contract File Structure

The full contract includes all three version numbers and tracks which API versions are currently supported:

```json
{
  "moduleVersion": "2.3.0",
  "apiVersion": "2.0.0",
  "behavioralVersion": "5.0.0",
  "generatedAt": "2026-03-15T14:30:00Z",
  "schemaChecksum": "a4b8c2d1",
  "rulesChecksum": "e5f6g7h8",
  "processesChecksum": "m3n4o5p6",

  "frontendContract": {
    "apiVersion": "2.0.0",
    "entities": { "..." : "..." },
    "actions": [ "..." ]
  },

  "backendContract": {
    "apiVersion": "2.0.0",
    "supportedApiVersions": ["1.0.0", "2.0.0"],
    "behavioralVersion": "5.0.0",
    "entities": { "..." : "..." },
    "endpoints": [
      {
        "method": "GET",
        "path": "/schemaforge/v1/orders",
        "apiVersion": "1.0.0",
        "supportedFilters": ["documentNo", "businessPartner"],
        "responseSchema": "OrderDTO_v1",
        "deprecated": true,
        "deprecatedSince": "2026-04-01T00:00:00Z",
        "retireAfter": "2026-05-01T00:00:00Z"
      },
      {
        "method": "GET",
        "path": "/schemaforge/v2/orders",
        "apiVersion": "2.0.0",
        "supportedFilters": ["documentNo", "businessPartner", "salesRep"],
        "responseSchema": "OrderDTO_v2",
        "deprecated": false
      }
    ],
    "processEndpoints": [
      {
        "method": "POST",
        "path": "/schemaforge/v2/orders/{id}/complete",
        "apiVersion": "2.0.0",
        "process": "completeOrder"
      }
    ]
  },

  "testManifest": {
    "contractTests": {
      "apiVersion": "2.0.0",
      "count": 145,
      "tests": ["..."]
    },
    "behavioralTests": {
      "behavioralVersion": "5.0.0",
      "count": 100,
      "tests": ["..."]
    }
  }
}
```

---

## A.7 Worked Examples

### A.7.1 Business Rule Change (No API Version Change)

**Scenario:** The BP callout now validates credit limit before setting the price list.

```
Before:
  apiVersion: 2.0.0
  behavioralVersion: 4.0.0

Change:
  Rule Decisor updates behavioral spec:
    given: "BP with credit limit exceeded"
    when: "select that BP on a new order"
    then: "error message, price list not set"

After:
  apiVersion: 2.0.0           ← unchanged
  behavioralVersion: 5.0.0    ← bumped
  moduleVersion: 2.2.0 → 2.3.0

Frontend: no change needed, no deploy
Backend: regenerate, recompile, new behavioral test passes
Tests: new behavioral test for credit limit edge case
Deploy: rolling — backend only
```

### A.7.2 New Field from Etendo (API Version Change)

**Scenario:** Etendo adds `DeliveryPriority` to C_Order. Human classifies it as `editable`.

```
Before:
  apiVersion: 2.0.0
  behavioralVersion: 5.0.0

Change:
  Decision Editor: DeliveryPriority → editable, optional
  Schema curado: new field in order entity
  
After:
  apiVersion: 2.0.0 → 3.0.0    ← bumped (new field in DTO)
  behavioralVersion: 5.0.0       ← unchanged (no rule change)
  moduleVersion: 2.3.0 → 3.0.0

Breaking? No — optional field added. Frontend v2 still works
  (it just doesn't show the new field).

Generated:
  OrderDTO_v2.java — unchanged, still served
  OrderDTO_v3.java — includes deliveryPriority
  OrderRxEndpoint_v2.java — unchanged
  OrderRxEndpoint_v3.java — new, includes deliveryPriority

Backend contract: supportedApiVersions: ["2.0.0", "3.0.0"]
Deploy: rolling — deploy backend first (serves both), then frontend
```

### A.7.3 New Field from Etendo (System, No API Change)

**Scenario:** Same field `DeliveryPriority`, but human classifies it as `system` with default "Normal".

```
Before:
  apiVersion: 2.0.0
  behavioralVersion: 5.0.0

Change:
  Decision Editor: DeliveryPriority → system, default "Normal"
  Schema curado: new system field with derivation

After:
  apiVersion: 2.0.0              ← unchanged (field not visible)
  behavioralVersion: 5.0.0 → 5.1.0  ← bumped (new derivation)
  moduleVersion: 2.3.0 → 2.4.0

Generated:
  OrderDerivationHandler: new line → order.setDeliveryPriority("Normal")
  New unit test: system field has derivation
  New integration test: POST without deliveryPriority → 201 (derived)

Frontend: no change. Never knew this field existed.
Deploy: rolling — backend only
```

### A.7.4 Process Adds Precondition (No API Change)

**Scenario:** completeOrder now requires `grandTotal > 0` (no zero-amount orders).

```
Before:
  apiVersion: 2.0.0
  behavioralVersion: 5.1.0

Change:
  Process Designer adds precondition:
    assertion: "grandTotal > 0"
    errorMessage: "Cannot complete a zero-amount order"

After:
  apiVersion: 2.0.0              ← unchanged
  behavioralVersion: 5.1.0 → 5.2.0  ← bumped
  moduleVersion: 2.4.0 → 2.5.0

Generated:
  CompleteOrderProcess: new precondition check
  New behavioral test: POST complete with grandTotal=0 → 400
  Edge case updated

Frontend: no code change. But users will now see 400 errors
  for zero-amount orders, rendered via the standard error contract.
Deploy: rolling — backend only
```

### A.7.5 Breaking Change (Field Removed)

**Scenario:** Human decides `warehouse` should move from `editable` to `system` (users don't need to pick warehouse).

```
Before:
  apiVersion: 2.0.0
  behavioralVersion: 5.2.0
  OrderDTO_v2 includes warehouse

Change:
  Decision Editor: warehouse → system, derivation fromConfig
  Version checker: BREAKING — warehouse removed from frontend contract

After:
  apiVersion: 2.0.0 → 3.0.0    ← bumped
  behavioralVersion: 5.2.0 → 6.0.0  ← bumped (new derivation)
  moduleVersion: 2.5.0 → 3.0.0

Generated:
  OrderDTO_v2 — unchanged, still served during grace period
  OrderDTO_v3 — warehouse removed
  OrderDerivationHandler — warehouse now auto-derived
  OrderRxEndpoint_v3 — no warehouse in response or create

Deploy: blue-green
  1. Deploy backend (serves v2 + v3)
  2. Verify both versions pass tests
  3. Deploy frontend v3 (targets v3)
  4. Grace period: v2 endpoints stay active 30 days
  5. Retire v2
```

---

## A.8 Version Checker Output

The version checker compares two contracts and produces a structured report:

```
═══════════════════════════════════════════════
  VERSION COMPATIBILITY REPORT
═══════════════════════════════════════════════

  From: module 2.5.0 (api 2.0.0, behavioral 5.2.0)
  To:   module 3.0.0 (api 3.0.0, behavioral 6.0.0)

API CHANGES:
  ✗ BREAKING: order.warehouse removed from frontend contract
  + ADDITION: system field order.warehouse with derivation fromConfig

BEHAVIORAL CHANGES:
  ~ MODIFIED: OrderDerivationHandler adds warehouse derivation
  + ADDITION: New derivation test for warehouse

DEPLOY PLAN: blue-green (1 breaking change)
  1. [backend]  deploy 3.0.0 alongside 2.5.0
  2. [backend]  verify v2 AND v3 contract tests pass
  3. [frontend] deploy targeting v3
  4. [backend]  deprecate v2 (grace: 30 days)
  5. [backend]  retire v2 after grace period

═══════════════════════════════════════════════
```

---

## A.9 Rules Summary

**When does apiVersion change?** When the frontend would need to change to keep working. New visible field, removed visible field, changed type, changed searchable, new/removed endpoint.

**When does behavioralVersion change?** When the backend behavior changes but the shape stays the same. Rule changes, process changes, new preconditions, new edge cases, derivation changes.

**When does moduleVersion change?** Every regeneration. It's the master version that encapsulates both.

**The frontend only reads apiVersion.** It never knows about behavioral changes. It doesn't even know how many behavioral versions happened between its deploys.

**The test suite reads both.** Contract tests are tied to apiVersion. Behavioral tests are tied to behavioralVersion. Both must pass for a deploy.

**Multi-version backend is only about apiVersion.** The backend can serve `/v1/` and `/v2/` simultaneously but there's only one set of business rules, one set of processes, one OBDal entity. The behavioral version doesn't create parallel code paths — it just tracks what the current behavior is.

---

*End of annex*
