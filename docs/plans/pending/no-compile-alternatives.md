# Pending Evaluation: Alternatives to Compiled Code Generation

| Property | Value |
|----------|-------|
| Status | PENDING EVALUATION |
| Created | 2026-03-06 |
| Context | Schema Forge currently generates Java code that requires `gradlew smartbuild` (minutes per iteration). This document explores alternatives that eliminate or minimize compilation. |

---

## Table of Contents

1. [Current Problem](#1-current-problem)
2. [Discovery: Etendo RX Headless IS the Solution for CRUD](#2-discovery-etendo-rx-headless-is-the-solution-for-crud)
3. [Alternatives for Custom Business Logic (Non-CRUD)](#3-alternatives-for-custom-business-logic-non-crud)
4. [Recommended Hybrid Architecture](#4-recommended-hybrid-architecture)
5. [Industry Precedents](#5-industry-precedents)
6. [Open Questions](#6-open-questions)

---

## 1. Current Problem

Schema Forge generates a full Etendo module (Java backend + React SPA frontend):

```
Schema Forge generates:
  - EventHandler.java       (beforeSave derivations)
  - DalProcess.java         (action processes)
  - RxEndpoint.java         (REST API endpoints)
  - DTOs, mappers, etc.     (data transfer)
  - dataset.xml             (AD configuration)
  - React SPA               (frontend)
```

**Pain point:** Every backend change requires `gradlew smartbuild` (compilation) which takes minutes. The frontend (React SPA with Babel standalone) already doesn't need compilation. The question is: can we eliminate Java compilation from the backend too?

---

## 2. Discovery: Etendo RX Headless IS the Solution for CRUD

### What We Found

Etendo already has a **fully functional, generic, configuration-driven REST API** in the `com.etendoerp.etendorx` module. It is the same system used by Etendo's "headless" mode. No Java code needs to be written — only database records (AD configuration).

### How It Works — Complete Flow

```
        CONFIGURATION (database records)              RUNTIME (already compiled, ships with Etendo)

  +--------------------+    +-------------------+    +---------------------------+
  | ETAPI_OPENAPI_FLOW |    | ETRX_OPENAPI_TAB  |    | DataSourceServlet         |
  | "Sales Order API"  |--->| -> AD_TAB_ID      |--->| (com.etendoerp.etendorx)  |
  +--------------------+    | -> fields (opt)   |    |                           |
          |                 +-------------------+    | Translates external HTTP  |
          v                                          | request into internal     |
  +--------------------+                             | OBDal DataSource call     |
  | ETAPI_OPENAPI_REQ  |                             +---------------------------+
  | name="Orders"      |                                        |
  | type="DEF"         |                                        v
  +--------------------+                             +---------------------------+
          |                                          | Endpoints auto-generated: |
          v                                          |                           |
  +--------------------+                             | GET  /sws/com.etendoerp.  |
  | ETAPI_OPENAPI_     |                             |   etendorx.datasource/    |
  | FLOWPOINT          |                             |   Orders                  |
  | get=Y, post=Y      |                             | GET  .../Orders/{id}      |
  | put=Y, getbyid=Y   |                             | POST .../Orders           |
  +--------------------+                             | PUT  .../Orders/{id}      |
                                                     +---------------------------+
```

### Key Source Files (already in Etendo, no need to write)

| File | What it does |
|------|-------------|
| `modules/com.etendoerp.etendorx/src/.../services/DataSourceServlet.java` | Generic servlet that handles ALL headless requests. Receives HTTP, looks up which AD_TAB corresponds, delegates to OBDal's internal DataSource. Already compiled and deployed. |
| `modules/com.etendoerp.etendorx/src/.../openapi/DynamicDatasourceEndpoint.java` | Auto-generates OpenAPI 3.0 documentation for all configured endpoints. Reads from ETAPI_OPENAPI_FLOW + REQ + FLOWPOINT tables at runtime. |
| `modules/com.etendoerp.etendorx/src/.../openapi/OpenAPIConstants.java` | Defines base path: `/sws/com.etendoerp.etendorx.datasource/` |

### The 4 Configuration Tables (What Schema Forge Would Generate)

#### Table 1: `ETAPI_OPENAPI_FLOW` — Flow container (groups endpoints)

| Column | Purpose | Example |
|--------|---------|---------|
| `NAME` | Flow/tag name (appears in Swagger UI) | "Sales Order" |
| `DESCRIPTION` | Human-readable description | "Schema Forge generated API for Sales Order window" |

#### Table 2: `ETAPI_OPENAPI_REQ` — Request definition (one per entity/endpoint)

| Column | Purpose | Example |
|--------|---------|---------|
| `NAME` | Endpoint name (becomes URL path segment, alphabetic only) | "Orders" |
| `TYPE` | Request type | "DEF" (default) |
| `GETDESCRIPTION` | Description for GET list endpoint | "List sales orders with optional filters" |
| `GETBYIDDESCRIPTION` | Description for GET by ID endpoint | "Retrieve a single sales order by its ID" |
| `POSTDESCRIPTION` | Description for POST create endpoint | "Create a new sales order" |
| `PUTDESCRIPTION` | Description for PUT update endpoint | "Update an existing sales order" |

#### Table 3: `ETAPI_OPENAPI_FLOWPOINT` — Junction (which HTTP methods are enabled)

| Column | Purpose | Example |
|--------|---------|---------|
| `ETAPI_OPENAPI_FLOW_ID` | FK to flow | (points to "Sales Order" flow) |
| `ETAPI_OPENAPI_REQ_ID` | FK to request | (points to "Orders" request) |
| `GET` | Enable GET list? | Y |
| `GETBYID` | Enable GET by ID? | Y |
| `POST` | Enable POST create? | Y |
| `PUT` | Enable PUT update? | Y |

#### Table 4: `ETRX_OPENAPI_TAB` — Links request to an AD_TAB

| Column | Purpose | Example |
|--------|---------|---------|
| `AD_TAB_ID` | FK to the Etendo tab to expose | (ID of Sales Order header tab) |
| `ETAPI_OPENAPI_REQ_ID` | FK to the request definition | (points to "Orders" request) |

#### Table 5 (optional): `ETRX_OPENAPI_FIELD` — Field-level whitelist and descriptions

| Column | Purpose | Example |
|--------|---------|---------|
| `AD_FIELD_ID` | FK to specific field to expose | (ID of "Business Partner" field) |
| `ETRX_OPENAPI_TAB_ID` | FK to the OpenAPI tab | (points to parent tab) |
| `DESCRIPTION` | Custom field description for API docs | "The business partner placing this order" |
| `SEQNO` | Field ordering | 10, 20, 30... |

**Important:** If no `ETRX_OPENAPI_FIELD` records are created, ALL fields from the tab are exposed (default mode). If any field records exist, ONLY those fields are exposed (whitelist mode).

### What You Get FOR FREE (zero compilation)

| Capability | Works? | How |
|-----------|:------:|-----|
| GET with RSQL filters | YES | `?q=documentNo=sw=SO` supports ==, !=, =c=, =ic=, =sw=, =ew=, =is=null, etc. |
| GET by ID | YES | `/{id}` path parameter |
| POST (create records) | YES | JSON body -> OBDal insert with full AD validation |
| PUT (update records) | YES | JSON body -> OBDal update (works like PATCH, only sent fields are updated) |
| Bulk POST | YES | Send JSON array to create multiple records at once |
| Pagination | YES | `_startRow=0&_endRow=100` query parameters |
| Callouts executed automatically | YES | `FormInitializationComponent` is invoked on POST/PUT, so existing callouts fire |
| AD defaults applied | YES | Default values from AD_COLUMN are applied on record creation |
| Mandatory field validation | YES | The internal DataSource validates mandatory fields |
| Security (JWT auth) | YES | Integrated with SWS (Secure Web Services), bearer token from `/sws/login` |
| Role-based access control | YES | OBContext is set from JWT claims, DAL security applies |
| OpenAPI/Swagger documentation | YES | Auto-generated by `DynamicDatasourceEndpoint`, accessible at `/sws/openapi` |
| Field type mapping | YES | Automatic: VARCHAR->string, DECIMAL->number, CHAR(1)->boolean, DATE->date |

### What You DON'T Get (needs something extra)

| Capability | Why not | Impact |
|-----------|---------|--------|
| Custom event handlers (beforeSave logic) | Event handlers are Java classes compiled into the JVM | Affects ~30% of generated code (derivations, computed fields) |
| Custom processes (Complete Order, etc.) | ActionHandler classes need Java compilation | Can invoke EXISTING processes via `/sws/.../jobs.defaults` endpoint |
| Custom derivations (e.g., calculate grandTotal) | Business logic lives in Java event handlers | Needs an alternative runtime (see Section 3) |
| DELETE operations | Not exposed in the FlowPoint configuration | The internal DataSource supports it; FlowPoint would need a `DELETE` boolean column |
| Custom endpoint logic (non-CRUD) | DataSourceServlet only handles standard CRUD patterns | Would need a separate mechanism |

### Example: What Schema Forge Would Generate (dataset.xml)

Instead of generating Java files, Schema Forge would generate an XML dataset with AD records:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<data>
  <!-- Flow: groups all endpoints for this window -->
  <ETAPI_OPENAPI_FLOW>
    <ETAPI_OPENAPI_FLOW_ID>SF_FLOW_001</ETAPI_OPENAPI_FLOW_ID>
    <AD_CLIENT_ID>0</AD_CLIENT_ID>
    <AD_ORG_ID>0</AD_ORG_ID>
    <NAME>Sales Order</NAME>
    <DESCRIPTION>Schema Forge API for Sales Order window</DESCRIPTION>
    <ISACTIVE>Y</ISACTIVE>
  </ETAPI_OPENAPI_FLOW>

  <!-- Request: defines the "Orders" endpoint -->
  <ETAPI_OPENAPI_REQ>
    <ETAPI_OPENAPI_REQ_ID>SF_REQ_001</ETAPI_OPENAPI_REQ_ID>
    <AD_CLIENT_ID>0</AD_CLIENT_ID>
    <AD_ORG_ID>0</AD_ORG_ID>
    <NAME>Orders</NAME>
    <TYPE>DEF</TYPE>
    <GETDESCRIPTION>List sales orders. Use q parameter for filtering.</GETDESCRIPTION>
    <GETBYIDDESCRIPTION>Get a single sales order by ID.</GETBYIDDESCRIPTION>
    <POSTDESCRIPTION>Create a new sales order. Only send fields you want to set.</POSTDESCRIPTION>
    <PUTDESCRIPTION>Update a sales order. Only send changed fields.</PUTDESCRIPTION>
    <ISACTIVE>Y</ISACTIVE>
  </ETAPI_OPENAPI_REQ>

  <!-- FlowPoint: enable GET, POST, PUT for Orders -->
  <ETAPI_OPENAPI_FLOWPOINT>
    <ETAPI_OPENAPI_FLOWPOINT_ID>SF_FP_001</ETAPI_OPENAPI_FLOWPOINT_ID>
    <AD_CLIENT_ID>0</AD_CLIENT_ID>
    <AD_ORG_ID>0</AD_ORG_ID>
    <ETAPI_OPENAPI_FLOW_ID>SF_FLOW_001</ETAPI_OPENAPI_FLOW_ID>
    <ETAPI_OPENAPI_REQ_ID>SF_REQ_001</ETAPI_OPENAPI_REQ_ID>
    <ISGET>Y</ISGET>
    <ISGETBYID>Y</ISGETBYID>
    <ISPOST>Y</ISPOST>
    <ISPUT>Y</ISPUT>
    <ISACTIVE>Y</ISACTIVE>
  </ETAPI_OPENAPI_FLOWPOINT>

  <!-- Tab mapping: link Orders endpoint to Sales Order header tab -->
  <ETRX_OPENAPI_TAB>
    <ETRX_OPENAPI_TAB_ID>SF_TAB_001</ETRX_OPENAPI_TAB_ID>
    <AD_CLIENT_ID>0</AD_CLIENT_ID>
    <AD_ORG_ID>0</AD_ORG_ID>
    <AD_TAB_ID>{actual_sales_order_header_tab_id}</AD_TAB_ID>
    <ETAPI_OPENAPI_REQ_ID>SF_REQ_001</ETAPI_OPENAPI_REQ_ID>
    <ISACTIVE>Y</ISACTIVE>
  </ETRX_OPENAPI_TAB>

  <!-- Optional: field whitelist (only expose these fields) -->
  <ETRX_OPENAPI_FIELD>
    <ETRX_OPENAPI_FIELD_ID>SF_FLD_001</ETRX_OPENAPI_FIELD_ID>
    <AD_FIELD_ID>{business_partner_field_id}</AD_FIELD_ID>
    <ETRX_OPENAPI_TAB_ID>SF_TAB_001</ETRX_OPENAPI_TAB_ID>
    <DESCRIPTION>The business partner placing this order</DESCRIPTION>
    <SEQNO>10</SEQNO>
  </ETRX_OPENAPI_FIELD>
</data>
```

**Deployment:** `gradlew install` (imports XML dataset, no Java compilation) or direct SQL INSERT + Etendo restart.

---

## 3. Alternatives for Custom Business Logic (Non-CRUD)

The headless CRUD covers ~70-80% of what Schema Forge generates. The remaining 20-30% is custom business logic: derivations, validations, computed fields, and processes. Here are alternatives that avoid Java compilation:

### Option A: GraalJS — JavaScript Executed Inside the JVM

Instead of generating Java event handlers, generate JavaScript files that run at runtime via GraalJS (the successor to Nashorn, removed in JDK 15).

**How it would work:**

```java
// ONE generic handler compiled ONCE — the "Schema Forge Runtime"
@ApplicationScoped
public class ScriptableEventHandler extends EntityPersistenceEventObserver {

    private static final Context jsContext = Context.newBuilder("js")
        .allowHostAccess(HostAccess.SCOPED)
        .build();

    @Override
    protected void onSave(EntityPersistenceEvent event) {
        String entityName = event.getTargetInstance().getEntityName();
        // Load script from filesystem or database
        String script = ScriptRegistry.getScript(entityName, "beforeSave");
        if (script != null) {
            jsContext.getBindings("js").putMember("entity", event.getTargetInstance());
            jsContext.getBindings("js").putMember("dal", OBDal.getInstance());
            jsContext.eval("js", script);
        }
    }
}
```

**Generated script (stored in DB or filesystem, never compiled):**

```javascript
// sales-order-before-save.js
function beforeSave(entity, dal) {
    // Derive documentNo from sequence
    if (!entity.get("documentNo")) {
        entity.set("documentNo", generateSequence("SO", entity.get("organization")));
    }
    // Compute grand total from lines
    var lines = entity.get("orderLineList");
    var total = 0;
    for (var i = 0; i < lines.size(); i++) {
        total += lines.get(i).get("lineNetAmount");
    }
    entity.set("grandTotal", total);
}
beforeSave(entity, dal);
```

| Pro | Con |
|-----|-----|
| Hot-reload: change script = immediate effect | Needs a generic Java "runtime" module (compiled once) |
| JavaScript is widely known | Performance ~2-5x slower than native Java |
| GraalVM polyglot allows JS to call Java objects directly | Debugging is harder (no IDE step-through) |
| Etendo already uses Rhino for expressions (`OBScriptEngine.java`) | Security: must sandbox carefully (limit file/network access) |
| Scripts can be stored in DB (versionable, deployable via dataset) | Error messages may be less clear |

**GraalJS runs on standard JDK (no GraalVM required):** Just add `org.graalvm.js:js` + `org.graalvm.js:js-scriptengine` as Maven dependencies.

### Option B: JSON Rule DSL — Declarative Rules Interpreted at Runtime

Instead of code, generate JSON rules that a generic engine evaluates:

```json
{
  "entity": "Order",
  "event": "beforeSave",
  "rules": [
    {
      "type": "required",
      "field": "businessPartner",
      "message": "Business Partner is required"
    },
    {
      "type": "derive",
      "field": "documentNo",
      "strategy": "sequence",
      "pattern": "SO/{org}/{seq:6}"
    },
    {
      "type": "compute",
      "field": "grandTotal",
      "expression": "SUM(orderLineList.lineNetAmount)"
    },
    {
      "type": "validate",
      "condition": "grandTotal > 0",
      "message": "Order total must be positive"
    },
    {
      "type": "copy",
      "field": "paymentTerms",
      "from": "businessPartner.paymentTerms",
      "when": "CREATE"
    }
  ]
}
```

| Pro | Con |
|-----|-----|
| Most secure (no arbitrary code execution) | Limited expressiveness |
| Easy to validate with contract tests (JSON in, JSON out) | Complex rules don't fit in declarative format |
| The JSON IS what Schema Forge already produces (artifacts) | Need to build the interpreter engine (compiled once) |
| Diffeable, versionable, auditable | Learning curve for the DSL |
| Can be validated statically before deployment | ~80% of rules can be expressed; 20% need escape hatch |

**Rule types that cover most Schema Forge use cases:**

| Rule Type | Covers | Example |
|-----------|--------|---------|
| `required` | Mandatory field validation | Field must not be null |
| `derive` | Auto-derived system fields | documentNo from sequence, defaults from config |
| `compute` | Calculated fields | grandTotal = SUM(lines.amount) |
| `validate` | Business rule validation | quantity > 0, date must be future |
| `copy` | Copy from related entity | paymentTerms from businessPartner |
| `lookup` | Fetch from another entity | priceList from product + priceListVersion |
| `conditional` | If/then rules | If isSOTrx=Y then warehouse is required |

### Option C: Frappe-Style Server Scripts in Database

Store Python/JS scripts as text in a database table, associated with entity events:

```
New table: SF_SERVER_SCRIPT
  - entity_name (VARCHAR)     -> "Order"
  - event_type (VARCHAR)      -> "beforeSave" | "afterSave" | "validate" | "beforeDelete"
  - script_language (VARCHAR)  -> "js" | "python" (future)
  - script_code (CLOB)        -> actual script text
  - is_active (CHAR 1)
  - execution_order (INTEGER)  -> for multiple scripts on same event
```

This is essentially Option A but with scripts stored in the database instead of the filesystem.

| Pro | Con |
|-----|-----|
| Deploy via dataset.xml (same as other AD config) | Same limitations as Option A |
| Manageable via Etendo's own UI (if we register the table in AD) | DB-stored code is harder to version control |
| Proven model (Frappe/ERPNext uses this exact approach) | IDE support is limited |
| Multiple scripts per event, ordered | Needs the same generic Java runtime |

### Option D: PostgreSQL Functions + Triggers

Move logic to the database level:

```sql
CREATE OR REPLACE FUNCTION sf_before_save_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Compute grand total
    NEW.grand_total := (
        SELECT COALESCE(SUM(line_net_amount), 0)
        FROM c_orderline
        WHERE c_order_id = NEW.c_order_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sf_order_before_save
    BEFORE INSERT OR UPDATE ON c_order
    FOR EACH ROW EXECUTE FUNCTION sf_before_save_order();
```

| Pro | Con |
|-----|-----|
| Zero Java compilation | Bypasses OBDal entirely (dangerous in Etendo) |
| Excellent performance | Does not participate in OBDal transactions/events |
| SQL is universal | Harder to test |
| No restart needed | Cannot access Etendo session context |
| | Conflicts with existing Etendo triggers/event handlers |

**Verdict:** Useful for read-only views and aggregations. Dangerous for write-side logic in Etendo because it bypasses OBDal's entity lifecycle.

---

## 4. Recommended Hybrid Architecture

Combine the approaches by capability tier:

```
+-------------------------------------------------------------+
|               Schema Forge Output (zero compilation)         |
+------------------+-------------------+-----------------------+
|  CRUD / API      |  Simple Rules     |  Complex Logic        |
|                  |                   |                       |
|  Etendo RX       |  JSON Rule DSL    |  GraalJS Scripts      |
|  (headless)      |  (Option B)       |  (Option A)           |
|                  |                   |                       |
|  Config: AD      |  Config: JSON     |  Config: .js files    |
|  records in      |  files or DB      |  or DB records        |
|  dataset.xml     |  records          |                       |
|                  |                   |                       |
|  0 code          |  0 code           |  0 compilation        |
|  0 compilation   |  0 compilation    |  hot-reload           |
+------------------+-------------------+-----------------------+
         ^                  ^                    ^
         |                  |                    |
   Already exists      One-time build      One-time build
   in Etendo           of rule engine      of script runtime
                       (Java, compile      (Java, compile
                        once)               once)
```

### What Gets Compiled (ONCE, as the "Schema Forge Runtime" module)

A single Etendo module (`com.etendoerp.schemaforge.runtime`) that contains:

1. **`GenericScriptEventHandler.java`** — Intercepts entity events, looks up scripts, executes via GraalJS
2. **`RuleEngine.java`** — Interprets JSON rule definitions (required, derive, compute, validate, copy, lookup)
3. **`ScriptRegistry.java`** — Loads/caches scripts from DB or filesystem

This module is compiled once and never changes. All business logic is in configuration.

### What Schema Forge Generates (NEVER compiled)

| Output | Format | Deployment |
|--------|--------|-----------|
| REST API endpoints | dataset.xml (ETAPI_OPENAPI_FLOW + REQ + FLOWPOINT + TAB + FIELD) | `gradlew install` or direct SQL |
| Simple business rules | JSON files or DB records (SF_RULE table) | Filesystem copy or dataset.xml |
| Complex business logic | JavaScript files or DB records (SF_SERVER_SCRIPT table) | Filesystem copy or dataset.xml |
| React SPA frontend | Static JS/HTML/CSS | Copy to `web/` directory |

### Development Cycle Comparison

| Step | Current (Java) | Proposed (Hybrid) |
|------|---------------|-------------------|
| Change a field mapping | Edit Java DTO + endpoint -> `gradlew smartbuild` (3-5 min) | Edit dataset.xml field record -> `gradlew install` (30s) or SQL INSERT (instant) |
| Add a validation rule | Edit Java EventHandler -> `gradlew smartbuild` (3-5 min) | Edit JSON rule file (instant, hot-reload) |
| Add computed field logic | Edit Java EventHandler -> `gradlew smartbuild` (3-5 min) | Edit .js script (instant, hot-reload) |
| Add new endpoint | Create Java handler class -> `gradlew smartbuild` (3-5 min) | Add records to FLOW/REQ/FLOWPOINT tables (30s) |
| Change frontend | Edit React code (already instant) | Same (no change) |

---

## 5. Industry Precedents

| Platform | Approach | Details |
|----------|----------|---------|
| **Frappe/ERPNext** | Server Scripts in DB (Python) | Scripts stored as text in `Server Script` doctype, executed with RestrictedPython at runtime. Supports Document Events, API endpoints, Permission Queries. [docs](https://docs.frappe.io/erpnext/v14/user/manual/en/customize-erpnext/server-script) |
| **Odoo** | Server Actions + Computed Fields (Python) | Automated Actions with inline Python code. Computed fields defined with `@api.depends` decorator. No separate compilation step. [docs](https://www.odoo.com/documentation/19.0/developer/tutorials/server_framework_101/08_compute_onchange.html) |
| **Salesforce** | Flow Builder (declarative) + Apex (compiled) | Declarative Flow for ~80% of logic, compiled Apex for complex cases. Two-tier approach similar to our proposal. |
| **GraalJS** | JS runtime on JDK | ECMAScript 2023 compliant, runs on any JDK 17+, JSR-223 ScriptEngine compatible. Drop-in replacement for removed Nashorn. [graalvm.org](https://www.graalvm.org/latest/reference-manual/js/) |
| **OutSystems / Mendix** | Generated interpreted code | Low-code platforms that generate runtime-interpreted artifacts, not compiled source. |

---

## 6. Open Questions

These need to be answered before committing to this approach:

### Technical

- [ ] **GraalJS performance in Etendo's JVM**: What is the actual overhead? Need benchmarks with realistic entity sizes.
- [ ] **GraalJS thread safety**: Etendo is multi-threaded. Can GraalJS contexts be shared or do we need one per thread?
- [ ] **Script sandboxing**: What Java APIs should scripts be allowed to access? OBDal yes, filesystem no, network no.
- [ ] **DELETE support**: `ETAPI_OPENAPI_FLOWPOINT` has no `DELETE` boolean. Can it be added, or do we need a workaround?
- [ ] **Etendo RX callout behavior**: On POST/PUT, does `FormInitializationComponent` execute ALL callouts or only specific ones? Need to verify edge cases.
- [ ] **Hot-reload mechanism**: How do we invalidate cached scripts when they change? File watcher? DB trigger? Manual reload endpoint?

### Architectural

- [ ] **Rule DSL vs Scripts**: Where is the boundary? Should we start with ONLY the JSON DSL and add GraalJS later as escape hatch?
- [ ] **Script storage**: Filesystem (easier to version control) vs database (easier to deploy via dataset.xml)? Or both?
- [ ] **Error handling**: How do script errors surface to the API consumer? Need clear error response format.
- [ ] **Testing story**: How do we test JSON rules and JS scripts? Can contract tests validate them without Etendo running?
- [ ] **Migration path**: If we start with this approach and later need to "graduate" a script to compiled Java (for performance), what does that look like?

### Business

- [ ] **Does this change Schema Forge's value proposition?** Instead of "generates a complete module", it becomes "generates configuration + scripts for a runtime". Is that better or worse?
- [ ] **Maintenance**: Who maintains the runtime module? It's a dependency for all generated apps.
- [ ] **Etendo RX compatibility**: Will future Etendo RX updates break our generated configuration? Need to understand their versioning/stability guarantees.

---

## Summary

| Layer | Current Approach | Proposed Approach | Compilation? |
|-------|-----------------|-------------------|:------------:|
| REST API (CRUD) | Generated Java endpoints | Etendo RX headless (AD records) | NO |
| Simple rules (validate, derive, copy) | Generated Java EventHandler | JSON Rule DSL | NO |
| Complex logic (compute, conditional) | Generated Java EventHandler | GraalJS scripts | NO |
| Processes (Complete, Cancel, etc.) | Generated Java ActionHandler | Invoke existing via `/sws/.../jobs.defaults` | NO |
| Frontend (React SPA) | Already no compilation | Same | NO |
| **Runtime engine** | N/A (no runtime needed) | **New module: compile ONCE** | **YES (once)** |

**Bottom line:** We can eliminate per-iteration Java compilation entirely. The trade-off is building a one-time "runtime" module and accepting some performance overhead from interpreted scripts. The 70-80% CRUD case is already solved by Etendo RX headless with zero additional work.
