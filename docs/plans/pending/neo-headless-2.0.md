# NEO Headless 2.0 — Proposal

| Property | Value |
|----------|-------|
| Status | DRAFT |
| Created | 2026-03-06 |
| Module | `com.etendoerp.etendorx` (evolution) |
| Related | `com.etendoerp.openapi`, Schema Forge |

---

## Table of Contents

1. [Vision](#1-vision)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Configuration Model](#4-configuration-model)
5. [Java Override System](#5-java-override-system)
6. [OpenAPI Auto-Generation](#6-openapi-auto-generation)
7. [Schema Forge Integration](#7-schema-forge-integration)
8. [Migration Path](#8-migration-path)
9. [Implementation Plan](#9-implementation-plan)
10. [Open Questions](#10-open-questions)

---

## 1. Vision

**NEO Headless 2.0** is a configuration-driven REST API layer for Etendo that:

- Exposes any AD Window/Tab/Field combination as a REST API **without generating code**
- Supports full CRUD: **GET, GET by ID, POST, PUT, PATCH, DELETE**
- Allows **granular Java overrides** at any level (window, tab, endpoint, method)
- **Auto-generates OpenAPI 3.0** documentation from configuration
- Is the **single API surface** — one version, always current, no code regeneration

**Core principle:** Configuration replaces code generation. When Schema Forge analyzes a window, it writes configuration records **directly to the database via webhooks** — no XML, no compilation, no restart. When a developer needs custom logic, they write one Java class and register it in the configuration. The runtime resolves everything dynamically.

```
┌─────────────────────────────────────────────────────┐
│                  NEO Headless 2.0                    │
│                                                     │
│  Config Window  ──→  Runtime Engine  ──→  REST API  │
│  (AD records)        (compiled once)      + OpenAPI  │
│                                                     │
│  Java Override  ──→  CDI Discovery   ──→  Injected  │
│  (optional)          (automatic)          at any    │
│                                           level     │
└─────────────────────────────────────────────────────┘
```

---

## 2. Current State Analysis

### What Already Exists (and works)

The current `com.etendoerp.etendorx` module already has a functional config-driven API:

| Component | Status | Details |
|-----------|--------|---------|
| `DataSourceServlet` | Working | Generic CRUD servlet, reads AD metadata at runtime |
| `DynamicDatasourceEndpoint` | Working | Auto-generates OpenAPI from config |
| `ETAPI_OPENAPI_FLOW` | Working | Groups endpoints by business area |
| `ETAPI_OPENAPI_REQ` | Working | Defines individual endpoints |
| `ETAPI_OPENAPI_FLOWPOINT` | Working | Enables/disables HTTP methods per endpoint |
| `ETRX_OPENAPI_TAB` | Working | Links AD_TAB to an API endpoint |
| `ETRX_OPENAPI_FIELD` | Working | Field whitelist/blacklist + descriptions |
| RSQL query support | Working | `?q=name==John;status!=Closed` |
| JWT auth + RBAC | Working | Via SWS + OBContext |
| Callout execution on POST/PUT | Working | `FormInitializationComponent` fires |
| AD defaults + validation | Working | Mandatory fields, data types |

### What's Missing for NEO Headless 2.0

| Gap | Impact | Effort |
|-----|--------|--------|
| No DELETE support | FlowPoint has no DELETE flag | Small: add column + servlet handler |
| No PATCH support | Etendo core `WebService` interface has no `doPatch()`, Servlet API 3.1 doesn't route PATCH | **Requires Etendo core changes** (see below) |
| No Java override mechanism | Custom logic requires separate endpoints | Medium: new override resolution system |
| No hierarchical structure | Endpoints are flat (no window > tab > subtab nesting) | Medium: add parent-child config |
| No per-method override granularity | Can't override just POST for one entity | Medium: override registry table |
| Projection system is separate | ETRX_PROJECTION is for connectors, not for API exposure | Clarify: two separate concerns |
| No response field filtering per method | Same fields for GET and POST response | Small: add per-method field config |

### Two Separate Systems Today

The current module has **two independent systems** that should NOT be confused:

```
System 1: DataSource API (for direct REST exposure)
  Config: ETAPI_OPENAPI_FLOW → REQ → FLOWPOINT → ETRX_OPENAPI_TAB → FIELD
  Runtime: DataSourceServlet
  Purpose: Expose AD windows as REST APIs

System 2: Projection/Connector API (for external integrations)
  Config: ETRX_PROJECTION → ENTITY → FIELD → MAPPING → CONNECTOR
  Runtime: DAS microservice (Spring Boot)
  Purpose: Sync data with external systems (Kafka, HTTP connectors)
```

**NEO Headless 2.0 evolves System 1.** System 2 (projections/connectors) remains unchanged.

### Etendo Core Changes Required: PATCH Support

The Servlet API 3.1 (used by Etendo) does not recognize PATCH as an HTTP method. `HttpServlet.service()` only routes GET, HEAD, POST, PUT, DELETE, OPTIONS, TRACE — a PATCH request returns `405 Method Not Allowed`.

**3 files need to change in `etendo-core`:**

#### 1. `WebService.java` — Add `doPatch()` with default implementation

```java
// src/org/openbravo/service/web/WebService.java

// Add default method (non-breaking, existing implementations don't need to change)
default void doPatch(String path, HttpServletRequest request, HttpServletResponse response)
    throws Exception {
  throw new UnsupportedOperationException("PATCH method not supported by this web service.");
}
```

#### 2. `BaseWebServiceServlet.java` — Intercept PATCH in `doService()`

The `service()` method is `final`, but `doService()` is `protected` and calls `super.service()` (which is where PATCH gets rejected). Intercept BEFORE that call:

```java
// src/org/openbravo/service/web/BaseWebServiceServlet.java

protected void doService(HttpServletRequest request, HttpServletResponse response)
    throws ServletException, IOException {
  try {
    // ... existing portal/security checks ...

    // PATCH support: Servlet API 3.1 doesn't route PATCH, so intercept here
    if ("PATCH".equalsIgnoreCase(request.getMethod())) {
      doPatch(request, response);
      return;
    }

    super.service(request, response);
    response.setStatus(200);
  } catch (...) { ... }
}

// New method — subclasses override this (WebServiceServlet does)
protected void doPatch(HttpServletRequest request, HttpServletResponse response)
    throws ServletException, IOException {
  response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "PATCH not supported");
}
```

#### 3. `WebServiceServlet.java` — Route PATCH to the WebService

```java
// src/org/openbravo/service/web/WebServiceServlet.java

@Override
protected void doPatch(HttpServletRequest request, HttpServletResponse response)
    throws ServletException, IOException {
  final String segment = WebServiceUtil.getInstance().getFirstSegment(request.getPathInfo());
  try {
    final WebService ws = (WebService) OBProvider.getInstance().get(segment);
    ws.doPatch(getRemainingPath(request.getPathInfo(), segment), request, response);
  } catch (final Exception e) {
    throw new ServletException(e);
  }
}
```

**Impact analysis:**
- `WebService.doPatch()` is a `default` method → **zero breaking changes** for existing implementations
- `BaseWebServiceServlet.doPatch()` is a new `protected` method → no impact on subclasses that don't override it
- The PATCH interception in `doService()` only fires for PATCH requests → existing GET/POST/PUT/DELETE unaffected
- All existing web services will return `405` for PATCH (same as today) unless they explicitly implement `doPatch()`

**Why not upgrade to Jakarta Servlet 6.1 (Tomcat 11)?**

Jakarta Servlet 6.1 (Tomcat 11) adds native `doPatch()`. However, upgrading requires migrating the entire codebase from `javax.servlet` to `jakarta.servlet` — a months-long project affecting all of Etendo core and every module. The 3-file workaround above is non-breaking, takes minutes, and can be removed when Etendo eventually migrates to Jakarta.

**Zero breaking changes:**
- `WebService.doPatch()` is a `default` method → existing implementations don't need to change
- `BaseWebServiceServlet.doPatch()` is a new `protected` method → no existing subclass overrides it
- The `if ("PATCH")` check in `doService()` only fires for PATCH requests → GET/POST/PUT/DELETE flow is untouched
- Any WebService that doesn't implement `doPatch()` returns `405 Method Not Allowed` (same as today)

**Semantics — PUT vs PATCH in NEO Headless:**

| Method | Semantics | Required fields | Missing fields |
|--------|-----------|----------------|----------------|
| **PUT** | Full replacement | All required fields must be present | Set to null/default |
| **PATCH** | Partial update | Only changed fields | Left unchanged |

The current `DataSourceServlet.doPut()` actually behaves like PATCH (only updates sent fields). For NEO Headless:
- **PATCH** → inherits current PUT behavior (partial update, only sent fields change)
- **PUT** → gets new strict behavior (full object required, missing fields nullified/defaulted)

---

## 3. Architecture Overview

### Request Resolution Flow

```
HTTP Request: POST /neo/v1/PriceList/ProductPrice
                     │
                     ▼
              ┌──────────────┐
              │  NEO Router  │  Parses: flow=PriceList, entity=ProductPrice, method=POST
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   Override    │  Checks (in order):
              │   Resolver   │    1. Method override (POST on ProductPrice)
              │              │    2. Endpoint override (all methods on ProductPrice)
              │              │    3. Tab override (all endpoints under PriceList tab)
              │              │    4. Window override (all endpoints in PriceList window)
              └──────┬───────┘
                     │
            ┌────────┴────────┐
            │                 │
     Override found?    No override
            │                 │
            ▼                 ▼
   ┌────────────────┐  ┌──────────────┐
   │  Custom Java   │  │  Default     │
   │  Handler       │  │  DataSource  │
   │  (CDI bean)    │  │  Servlet     │
   └────────────────┘  └──────────────┘
            │                 │
            └────────┬────────┘
                     ▼
              ┌──────────────┐
              │   Response   │  Applies field filtering, formatting
              │   Builder    │  Returns JSON + sets HTTP status
              └──────────────┘
```

### URL Structure

```
/neo/v1/{flowName}/{entityName}          # List / Create
/neo/v1/{flowName}/{entityName}/{id}     # Get / Update / Delete

Examples:
GET    /neo/v1/PriceList/PriceList              # List price lists
GET    /neo/v1/PriceList/PriceList/{id}         # Get one price list
POST   /neo/v1/PriceList/PriceList              # Create price list
PUT    /neo/v1/PriceList/ProductPrice/{id}      # Update product price
PATCH  /neo/v1/PriceList/ProductPrice/{id}      # Partial update (same as PUT)
DELETE /neo/v1/PriceList/ProductPrice/{id}      # Delete product price

GET    /neo/v1/SalesOrder/Order                 # List orders
GET    /neo/v1/SalesOrder/Order?q=docNo=sw=SO   # Filtered
POST   /neo/v1/SalesOrder/OrderLine             # Create order line
```

### Selector / Reference Endpoints

Fields with `inputMode: "selector"`, `"search"`, or `"dependent"` in the contract need lookup endpoints so the frontend can populate dropdowns and search boxes. NEO Headless handles this **automatically** — each reference entity is itself a flow with GET enabled.

```
# Reference data endpoints (each is its own flow, configured once, reused by all windows)
GET /neo/v1/Ref/BusinessPartner?q=name=sw=John     # selector for BP field
GET /neo/v1/Ref/Warehouse?q=name=sw=Main            # selector for warehouse field
GET /neo/v1/Ref/PriceList?q=isSalesPrice==true       # selector for price list field
GET /neo/v1/Ref/PaymentTerm                          # selector for payment terms
GET /neo/v1/Ref/PaymentMethod                        # selector for payment methods
GET /neo/v1/Ref/Product?q=name=sw=Widget             # selector for product in order lines
GET /neo/v1/Ref/UOM                                  # selector for unit of measure
GET /neo/v1/Ref/Tax                                  # selector for tax rate
GET /neo/v1/Ref/Currency                             # selector for currency
GET /neo/v1/Ref/User?q=name=sw=Admin                 # selector for sales rep

# Dependent selectors (filtered by parent)
GET /neo/v1/Ref/BPLocation?q=businessPartner=='{bpId}'  # depends on selected BP
```

**How it works:**
- A single flow called `Ref` (or one per reference entity) groups all reference/selector endpoints
- Each reference entity gets one `ETAPI_OPENAPI_REQ` with only GET + GETBYID enabled
- The `ETRX_OPENAPI_FIELD` whitelist controls which fields are returned (typically: id, name/identifier, and the filter key)
- The frontend uses the standard RSQL `q` parameter to filter — same mechanism as any other entity
- Dependent selectors just add a filter: `?q=businessPartner=='{selectedBpId}'`

**Key insight:** Selectors are NOT special endpoints. They are just regular NEO entities with GET-only access and a curated field list. No extra code, no special servlet, no separate mechanism. The RSQL filter already handles all selector use cases (search, dependent, typeahead).

Schema Forge configures these reference flows once per Etendo instance. All windows that reference the same entity (e.g., BusinessPartner) share the same selector endpoint.

**Why `/neo/v1/`?**
- Clean break from existing `/sws/com.etendoerp.etendorx.datasource/` path
- Versioned prefix allows future `/neo/v2/` without breaking clients
- Short, clean URLs
- Coexists with current headless (no migration pressure)

### Tab Filters (hqlWhereClause)

Schema Forge curated schemas define tab-level HQL filters. For example, Sales Order has:

```json
"hqlWhereClause": "e.salesTransaction=true"
```

This ensures the endpoint only returns/accepts sales orders, not purchase orders (same C_Order table). Two separate config fields handle this:

**`HQL_WHERE_CLAUSE`** — Filter for reads:
- **GET**: Appended to WHERE clause → only returns sales orders
- **GET by ID**: Validates the record matches → 404 if it's a purchase order
- **PUT/PATCH/DELETE**: Validates the target record matches before operating

**`AUTO_SET_VALUES`** — Auto-set on writes:
- **POST**: Injects `{"salesTransaction": true}` into the record before insert
- **PUT/PATCH**: Optionally re-applies (configurable, default: no — don't overwrite what's already set)

```
ETRX_OPENAPI_TAB config for Sales Order:
  HQL_WHERE_CLAUSE = "e.salesTransaction=true"
  AUTO_SET_VALUES  = {"salesTransaction": true, "documentType": "SO_DOCTYPE_ID"}
```

**Why separate fields?** Because not all HQL filters can be reversed into settable values. `e.salesTransaction=true` is simple, but `exists(select 1 from ...)` or joins can't be auto-set. Keeping them separate makes the config explicit and predictable.

Schema Forge writes both fields when configuring a tab via webhook.

### Derivations (system fields)

Schema Forge defines system fields with derivation rules:

```json
{ "name": "adClientId",  "visibility": "system", "derivation": { "type": "fromConfig", "source": "context.client" } }
{ "name": "cDocTypeId",  "visibility": "system", "derivation": { "type": "fromConfig", "source": "doctype.salesOrder" } }
{ "name": "cOrderId",    "visibility": "system", "derivation": { "type": "fromParent", "source": "order.id" } }
{ "name": "dateAcct",    "visibility": "system", "derivation": { "type": "computed",   "expression": "dateOrdered" } }
{ "name": "invoiceRule", "visibility": "system", "derivation": { "type": "computed",   "expression": "'D'" } }
```

**Derivation types:**

| Type | What it does | Example |
|------|-------------|---------|
| `fromConfig` | Takes value from session/context | `context.client`, `context.organization` |
| `fromParent` | Copies from parent entity | `order.id`, `order.dateOrdered` |
| `computed` | Evaluates expression | `"'D'"` (constant), `"dateOrdered"` (copy field) |
| `fromField` | Copies from another field in same entity | `businessPartner.paymentTerms` |
| `lookup` | Queries another entity | Price from PriceList based on Product |
| `sequence` | Auto-generates from document sequence | DocumentNo |

**For NEO Headless:** The current `DataSourceServlet` already handles most of this via Etendo's `FormInitializationComponent` and AD defaults/callouts. The derivation metadata in the schema is primarily for Schema Forge's contract tests and frontend — the runtime behavior already exists in AD.

However, `fromParent` derivations need explicit handling: when POSTing an OrderLine, the frontend sends `orderId` and the backend must propagate `order.dateOrdered`, `order.warehouse`, etc. This is either:
- Already handled by AD callouts (check per window)
- Or requires a PRE_HOOK override that copies parent fields

### Dependent Selectors & Input Modes

Schema Forge fields carry frontend metadata:

```json
{ "name": "partnerAddress", "inputMode": "dependent",
  "dependsOn": { "field": "businessPartner", "filterKey": "businessPartnerId" } }
{ "name": "warehouse", "inputMode": "selector" }
{ "name": "businessPartner", "inputMode": "search" }
```

**For NEO Headless:** This is purely frontend metadata — the API itself doesn't need to know about `inputMode`. The frontend uses this to know:
- `selector` → Show a dropdown, populated from `GET /neo/v1/Ref/Warehouse`
- `search` → Show a search box, query `GET /neo/v1/Ref/BusinessPartner?q=name=sw=...`
- `dependent` → Filter the selector by parent: `GET /neo/v1/Ref/BPLocation?q=businessPartner=='{bpId}'`

The API just needs the reference endpoints to exist and support RSQL filtering. No special backend handling needed.

**However**, this metadata should be available via the OpenAPI spec or a dedicated metadata endpoint so the frontend knows how to render each field. This can be a `GET /neo/v1/{flow}/_meta` endpoint that returns the field metadata from the curated schema.

### AD Validation Rules (Selector Filters)

This is critical. Etendo uses `AD_Val_Rule` to restrict which options appear in a selector/dropdown **based on the current record's context**. These are SQL WHERE clauses with variable placeholders.

**Examples from Sales Order:**

| Field | Validation Rule | What it does |
|-------|----------------|-------------|
| `partnerAddress` | `C_BPartner_Location.C_BPartner_ID=@C_BPartner_ID@ AND ...IsBillTo='Y'` | Only show billing addresses of the selected BP |
| `priceList` | `M_PriceList.issopricelist = @isSOTrx@` | Only show sales price lists |
| `paymentMethod` | `EXISTS (SELECT 1 FROM FIN_FinAcc_PaymentMethod ...)` | Only show payment methods with active accounts |
| `tax` | `C_TAX.VALIDFROM<=@DateOrdered@ AND C_TAX.SOPOTYPE=...` | Only taxes valid for the order date and type |
| `salesRep` | `AD_ISORGINCLUDED(@AD_Org_ID@, td0.AD_Org_ID, @#AD_Client_ID@)` | Only users in the org tree |

**Two types of variables:**
- **`@#VAR@`** (contextParams): Session context — resolved server-side from OBContext (`@#AD_Client_ID@`, `@#User_Org@`)
- **`@VAR@`** (cascadeParams): Cascade from other fields in the same form — sent by the frontend as query params (`@C_BPartner_ID@`, `@IsSOTrx@`, `@DateOrdered@`)

**How this maps to NEO Headless:**

The frontend should **never see** the validation SQL, parameter names, or filter logic. All validation rules are resolved server-side. The frontend only sends the current form values as opaque context.

```
# Frontend selects BusinessPartner "BP001", now needs to load addresses.
# It doesn't know about C_BPartner_ID, IsBillTo, or any SQL — it just sends
# the current form state and which field it's asking about:

GET /neo/v1/SalesOrder/Order/_selector/partnerAddress
    ?_formValues={"businessPartner":"BP001","orderDate":"2026-03-06"}

# The runtime (server-side, invisible to frontend):
# 1. Looks up ETRX_NEO_SELECTOR_RULE for field "partnerAddress" in flow "SalesOrder"
# 2. Finds rule: C_BPartner_Location.C_BPartner_ID=@C_BPartner_ID@ AND IsBillTo='Y'
# 3. Maps "businessPartner" → @C_BPartner_ID@ using the field-to-column mapping
# 4. Replaces @C_BPartner_ID@ with 'BP001'
# 5. Replaces @#AD_Client_ID@ with session value from OBContext
# 6. Applies the resolved SQL WHERE clause
# 7. Returns only matching records: [{id: "LOC01", label: "Main Office - Billing"}]
```

**Key design decisions:**
- The URL contains the **flow + entity + field name** — NOT the reference table or SQL params
- `_formValues` is a JSON object with the current form state using **frontend field names** (not DB column names)
- The server maps frontend names to DB columns internally
- The SQL filter clause never leaves the server
- Context params (`@#AD_Client_ID@`) are resolved from the JWT session automatically

**Selector endpoint pattern:**

```
GET /neo/v1/{flow}/{entity}/_selector/{fieldName}
    ?_formValues={...}          # Current form values (frontend field names)
    &q=searchTerm               # Optional: typeahead search text
    &_startRow=0&_endRow=20     # Pagination
```

Response:
```json
{
  "data": [
    { "id": "LOC01", "label": "Main Office - Billing", "_identifier": "Main Office" },
    { "id": "LOC02", "label": "Warehouse - Billing", "_identifier": "Warehouse" }
  ],
  "totalRows": 2
}
```

**Configuration — new table: `ETRX_NEO_SELECTOR_RULE`**

```sql
CREATE TABLE ETRX_NEO_SELECTOR_RULE (
  ETRX_NEO_SELECTOR_RULE_ID  VARCHAR(32)   NOT NULL PRIMARY KEY,
  AD_CLIENT_ID                VARCHAR(32)   NOT NULL,
  AD_ORG_ID                   VARCHAR(32)   NOT NULL,
  ISACTIVE                    CHAR(1)       NOT NULL DEFAULT 'Y',
  CREATED                     TIMESTAMP     NOT NULL DEFAULT NOW(),
  CREATEDBY                   VARCHAR(32)   NOT NULL,
  UPDATED                     TIMESTAMP     NOT NULL DEFAULT NOW(),
  UPDATEDBY                   VARCHAR(32)   NOT NULL,

  -- Which field in which endpoint triggers this rule
  ETRX_OPENAPI_FIELD_ID      VARCHAR(32)   NOT NULL,  -- FK to the field that uses this selector
  ETAPI_OPENAPI_REQ_ID        VARCHAR(32)   NULL,      -- FK to the reference entity endpoint (optional)

  -- The filter (server-side only, never exposed to frontend)
  FILTER_CLAUSE               VARCHAR(4000) NOT NULL,  -- SQL WHERE clause with @VAR@ placeholders
  -- Mapping: which frontend field names map to which @VAR@ in the SQL
  -- JSON: {"businessPartner": "C_BPartner_ID", "isSOTrx": "IsSOTrx"}
  FIELD_TO_PARAM_MAP          VARCHAR(4000) NULL,
  -- Context params resolved from session (no frontend input needed)
  -- Comma-separated: AD_Client_ID,User_Org
  CONTEXT_PARAMS              VARCHAR(1000) NULL,

  -- Reference entity config
  REFERENCE_ENTITY_CLASS      VARCHAR(200)  NULL,       -- e.g., "BusinessPartnerLocation"
  DISPLAY_PROPERTY            VARCHAR(100)  NULL,       -- e.g., "name" — what to show in the dropdown

  -- Metadata
  AD_MODULE_ID                VARCHAR(32)   NOT NULL,
  DESCRIPTION                 VARCHAR(2000) NULL
);
```

**Key: `FIELD_TO_PARAM_MAP`** — This is the mapping that keeps the frontend ignorant of DB column names. Example:

```json
// For partnerAddress selector in Sales Order:
{
  "businessPartner": "C_BPartner_ID"
}
// Frontend sends _formValues.businessPartner = "BP001"
// Backend maps it to @C_BPartner_ID@ = 'BP001' in the SQL
```

```json
// For tax selector in Sales Order (multiple cascade params):
{
  "orderDate": "DateOrdered",
  "isSalesTransaction": "IsSOTrx"
}
```

**Multiple selectors to the same entity:** This is common. For example, Sales Order has three fields that reference `BusinessPartnerLocation`, each with a different filter:

| Field | Reference Entity | Filter |
|-------|-----------------|--------|
| `partnerAddress` | BPLocation | `C_BPartner_ID=@C_BPartner_ID@ AND IsBillTo='Y'` |
| `invoiceAddress` | BPLocation | `C_BPartner_ID=@C_BPartner_ID@ AND IsShipTo='Y'` |
| `deliveryLocation` | BPLocation | `C_BPartner_ID=@C_BPartner_ID@ AND IsShipTo='Y'` |

Each gets its own `ETRX_NEO_SELECTOR_RULE` record, keyed by `ETRX_OPENAPI_FIELD_ID` (the specific field). The URL resolves by field name, not by entity:

```
GET /neo/v1/SalesOrder/Order/_selector/partnerAddress    → BPLocation WHERE IsBillTo='Y' AND BP=...
GET /neo/v1/SalesOrder/Order/_selector/invoiceAddress    → BPLocation WHERE IsShipTo='Y' AND BP=...
GET /neo/v1/SalesOrder/Order/_selector/deliveryLocation  → BPLocation WHERE IsShipTo='Y' AND BP=...
```

Same entity, different results, different rules. The frontend doesn't know or care — it just calls `_selector/{fieldName}`.

**How Schema Forge populates this:**

Schema Forge already extracts validation rules in `schema-raw.json` with parsed `contextParams` and `cascadeParams`. When writing config via webhooks:

```
POST /ws/.../configureSelectorRule
  body: {
    fieldId: "SF_FLD_PRICELIST",
    referenceEntityClass: "PricingPriceList",
    displayProperty: "name",
    filterClause: "M_PriceList.issopricelist = @isSOTrx@",
    fieldToParamMap: { "isSalesTransaction": "isSOTrx" },
    contextParams: []
  }
```

**Runtime resolution (all server-side):**
1. Frontend calls `GET /neo/v1/SalesOrder/Order/_selector/priceList?_formValues={"isSalesTransaction":true}&q=General`
2. NEO looks up `ETRX_NEO_SELECTOR_RULE` for field "priceList" in flow "SalesOrder"
3. Reads `FIELD_TO_PARAM_MAP`: maps `isSalesTransaction` → `@isSOTrx@`
4. Replaces `@isSOTrx@` with `'true'` from _formValues
5. Replaces any `@#VAR@` with session values from OBContext
6. Applies `q=General` as LIKE filter on the display property
7. Appends resolved clause to the base query
8. Returns filtered results

**For complex rules** (like the `EXISTS` subquery for PaymentMethod), the SQL is stored verbatim — it just gets variable replacement, same as Etendo's core does today. No parsing needed. The frontend never sees any of this.

### Searchable Fields

```json
"searchableFields": ["businessPartner", "orderDate", "documentNo", "docStatus"]
```

The RSQL `q` parameter already supports filtering on any field. The `searchableFields` list is for the frontend to know which fields to show in the search/filter UI. This metadata goes in the `_meta` endpoint, not in the CRUD logic.

---

## 4. Configuration Model

### Reused Tables (no changes needed)

| Table | Purpose | Reuse |
|-------|---------|-------|
| `ETAPI_OPENAPI_FLOW` | Group endpoints (= window) | 100% as-is |
| `ETAPI_OPENAPI_REQ` | Define endpoint (= tab entity) | 100% as-is |
| `ETAPI_OPENAPI_FLOWPOINT` | Enable HTTP methods | Extend (add DELETE, PATCH columns) |
| `ETRX_OPENAPI_TAB` | Link to AD_TAB | Extend (add HQL filter, metadata) |
| `ETRX_OPENAPI_FIELD` | Field whitelist + docs | Extend (add visibility, inputMode) |

### Extended Tables (add columns)

#### `ETRX_OPENAPI_TAB` — Add tab filter and metadata

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `HQL_WHERE_CLAUSE` | VARCHAR(4000) | NULL | Tab-level HQL filter applied to GET queries (e.g., `e.salesTransaction=true`) |
| `AUTO_SET_VALUES` | VARCHAR(4000) | NULL | JSON with field values to auto-set on POST/PUT (e.g., `{"salesTransaction":true}`). These fields are invisible in the API request schema. |
| `PARENT_REQ_ID` | VARCHAR(32) FK | NULL | Parent entity for child tabs (e.g., OrderLine → Order). Used for `fromParent` derivations |
| `PARENT_FIELD` | VARCHAR(100) | NULL | FK field name linking child to parent (e.g., `salesOrder` for OrderLine.C_Order_ID) |

#### `ETRX_OPENAPI_FIELD` — Add visibility and frontend metadata

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `VISIBILITY` | VARCHAR(20) | 'editable' | Field visibility: `editable`, `readOnly`, `system` |
| `INPUT_MODE` | VARCHAR(20) | NULL | Frontend hint: `selector`, `search`, `dependent`, NULL |
| `DEPENDS_ON_FIELD` | VARCHAR(100) | NULL | For dependent selectors: which field this depends on |
| `DEPENDS_ON_FILTER_KEY` | VARCHAR(100) | NULL | For dependent selectors: the filter key for the parent reference |
| `IS_SEARCHABLE` | CHAR(1) | 'N' | Whether this field appears in the searchable filters list |
| `REFERENCE_ENTITY` | VARCHAR(100) | NULL | For FK fields: name of the reference entity (e.g., `BusinessPartner`) |
| `IS_REQUIRED` | CHAR(1) | 'N' | Whether the field is mandatory in POST/PUT |

#### `ETAPI_OPENAPI_FLOWPOINT` — Add DELETE and PATCH

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `ISDELETE` | CHAR(1) | 'N' | Enable DELETE method |
| `ISPATCH` | CHAR(1) | 'Y' | Enable PATCH method |
| `DELETEDESCRIPTION` | VARCHAR(2000) | NULL | OpenAPI description for DELETE |
| `PATCHDESCRIPTION` | VARCHAR(2000) | NULL | OpenAPI description for PATCH |

#### `ETAPI_OPENAPI_REQ` — Add DELETE and PATCH descriptions

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `DELETEDESCRIPTION` | VARCHAR(2000) | NULL | DELETE description template |
| `PATCHDESCRIPTION` | VARCHAR(2000) | NULL | PATCH description template |

### New Table: `ETRX_NEO_OVERRIDE` — Java Override Registry

This is the **core new table** that enables the granular override system.

```sql
CREATE TABLE ETRX_NEO_OVERRIDE (
  ETRX_NEO_OVERRIDE_ID     VARCHAR(32)   NOT NULL PRIMARY KEY,
  AD_CLIENT_ID              VARCHAR(32)   NOT NULL,
  AD_ORG_ID                 VARCHAR(32)   NOT NULL,
  ISACTIVE                  CHAR(1)       NOT NULL DEFAULT 'Y',
  CREATED                   TIMESTAMP     NOT NULL DEFAULT NOW(),
  CREATEDBY                 VARCHAR(32)   NOT NULL,
  UPDATED                   TIMESTAMP     NOT NULL DEFAULT NOW(),
  UPDATEDBY                 VARCHAR(32)   NOT NULL,

  -- What to override (hierarchical, from most specific to least)
  ETAPI_OPENAPI_FLOW_ID     VARCHAR(32)   NULL,     -- Window-level override
  ETAPI_OPENAPI_REQ_ID      VARCHAR(32)   NULL,     -- Endpoint/Tab-level override
  HTTP_METHOD               VARCHAR(10)   NULL,     -- Method-level: GET|POST|PUT|PATCH|DELETE|null=all

  -- How to override
  JAVA_QUALIFIER            VARCHAR(100)  NOT NULL,  -- CDI qualifier for the handler bean
  OVERRIDE_TYPE             VARCHAR(20)   NOT NULL DEFAULT 'METHOD',
                                                     -- METHOD: overrides specific method(s)
                                                     -- ENDPOINT: replaces entire endpoint
                                                     -- PRE_HOOK: runs before default logic
                                                     -- POST_HOOK: runs after default logic

  -- Metadata
  AD_MODULE_ID              VARCHAR(32)   NOT NULL,
  NAME                      VARCHAR(100)  NOT NULL,
  DESCRIPTION               VARCHAR(2000) NULL,
  PRIORITY                  INTEGER       NOT NULL DEFAULT 50,  -- Higher = wins on conflict

  -- Constraints
  CONSTRAINT ETRX_NEO_OVR_UNQ UNIQUE (ETAPI_OPENAPI_FLOW_ID, ETAPI_OPENAPI_REQ_ID, HTTP_METHOD, JAVA_QUALIFIER)
);
```

#### Override Resolution Rules

The override resolver checks from **most specific to least specific**:

| Priority | Flow | Req | Method | Matches |
|----------|------|-----|--------|---------|
| 1 (highest) | set | set | set | Exact method on exact endpoint |
| 2 | set | set | NULL | All methods on one endpoint |
| 3 | set | NULL | set | One method on all endpoints in flow |
| 4 | set | NULL | NULL | All methods on all endpoints in flow |

If multiple overrides match at the same specificity level, `PRIORITY` column breaks the tie.

#### Override Types

| Type | Behavior |
|------|----------|
| `METHOD` | Replaces the default handler for the matched method(s). The override Java class receives the request and must return the response. |
| `ENDPOINT` | Replaces the entire endpoint. No default logic runs at all. |
| `PRE_HOOK` | Runs BEFORE the default DataSourceServlet logic. Can modify the request, validate, enrich, or abort (throw exception). Default logic still runs after. |
| `POST_HOOK` | Runs AFTER the default DataSourceServlet logic. Can modify the response, add fields, transform data. |

### Configuration Window Layout

Reuse the existing **OpenAPI Flows** window with additional sub-tabs:

```
Window: "NEO Headless API" (or extend existing "OpenAPI Flows")
  ├── Tab: Flow (ETAPI_OPENAPI_FLOW) — existing
  │     Name, Description, Module
  │
  ├── Sub-tab: Endpoints (ETAPI_OPENAPI_FLOWPOINT + REQ) — existing, extended
  │     Request Name, Tab Link, GET, POST, PUT, PATCH*, DELETE*
  │     GET Description, POST Description, PUT Description, PATCH Desc*, DELETE Desc*
  │
  ├── Sub-tab: Fields (ETRX_OPENAPI_FIELD) — existing
  │     Field, Description, Sequence
  │
  └── Sub-tab: Overrides (ETRX_NEO_OVERRIDE) — NEW
        Name, Java Qualifier, Override Type, HTTP Method, Priority, Description
```

(*) = new columns

---

## 5. Java Override System

### Interface

```java
package com.etendoerp.etendorx.neo;

/**
 * Interface for NEO Headless override handlers.
 * Implementations are discovered via CDI using the JAVA_QUALIFIER
 * registered in ETRX_NEO_OVERRIDE.
 */
public interface NeoHandler {

  /**
   * Handle the request. Depending on override type:
   * - METHOD/ENDPOINT: must produce the full response
   * - PRE_HOOK: can modify context, throw to abort
   * - POST_HOOK: can modify the response
   */
  NeoResponse handle(NeoContext context);
}
```

### Context Object

```java
public class NeoContext {
  private String flowName;            // "PriceList"
  private String entityName;          // "ProductPrice"
  private String httpMethod;          // "POST"
  private String recordId;            // nullable, for single-record operations
  private JSONObject requestBody;     // nullable, for POST/PUT/PATCH
  private Map<String, String> queryParams;  // q, _startRow, _endRow, etc.
  private Tab adTab;                  // The resolved AD_TAB
  private OBContext obContext;        // User session context
  private NeoResponse previousResult; // Only for POST_HOOK: the default handler's result
}
```

### Response Object

```java
public class NeoResponse {
  private int httpStatus;             // 200, 201, 204, 400, 404, etc.
  private JSONObject body;            // Response JSON
  private Map<String, String> headers; // Custom headers

  // Factory methods
  public static NeoResponse ok(JSONObject data) { ... }
  public static NeoResponse created(JSONObject data) { ... }
  public static NeoResponse noContent() { ... }       // for DELETE
  public static NeoResponse error(int status, String message) { ... }
}
```

### Example: PriceList Override (only expose PriceList + ProductPrice)

**Use case:** The PriceList window has 5+ tabs, but the API should only expose `PriceList` (header) and `ProductPrice` (prices). Custom logic needed for ProductPrice POST to auto-resolve the PriceListVersion.

#### Step 1: Configuration (AD records)

```
ETAPI_OPENAPI_FLOW: name="PriceList"
  ETAPI_OPENAPI_REQ: name="PriceList"   → ETRX_OPENAPI_TAB → AD_TAB(PriceList header)
  ETAPI_OPENAPI_REQ: name="ProductPrice" → ETRX_OPENAPI_TAB → AD_TAB(Product Price)

  FLOWPOINT(PriceList):   GET=Y, POST=Y, PUT=Y, PATCH=Y, DELETE=N
  FLOWPOINT(ProductPrice): GET=Y, POST=Y, PUT=Y, PATCH=Y, DELETE=Y
```

Only 2 entities are configured — the other tabs (PriceListVersion, CountryPrice, etc.) simply don't get ETAPI_OPENAPI_REQ records, so they don't appear in the API.

#### Step 2: Override for POST ProductPrice (auto-resolve PriceListVersion)

```
ETRX_NEO_OVERRIDE:
  ETAPI_OPENAPI_FLOW_ID = (PriceList flow)
  ETAPI_OPENAPI_REQ_ID  = (ProductPrice req)
  HTTP_METHOD            = 'POST'
  JAVA_QUALIFIER         = 'productPricePostHandler'
  OVERRIDE_TYPE          = 'PRE_HOOK'
  PRIORITY               = 50
```

#### Step 3: Java Implementation

```java
package com.etendoerp.pricelist.neo;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Named;

@ApplicationScoped
@Named("productPricePostHandler")
public class ProductPricePostHandler implements NeoHandler {

  @Override
  public NeoResponse handle(NeoContext context) {
    JSONObject body = context.getRequestBody();

    // Auto-resolve PriceListVersion from PriceList
    if (!body.has("priceListVersion") && body.has("priceList")) {
      String priceListId = body.getString("priceList");
      String versionId = findActivePriceListVersion(priceListId);
      body.put("priceListVersion", versionId);
    }

    // PRE_HOOK: return null to continue with default logic
    // The enriched body will be passed to DataSourceServlet
    return null;
  }

  private String findActivePriceListVersion(String priceListId) {
    // OBDal query to find active version
    OBCriteria<PriceListVersion> crit = OBDal.getInstance()
        .createCriteria(PriceListVersion.class);
    crit.add(Restrictions.eq("priceList.id", priceListId));
    crit.add(Restrictions.eq("active", true));
    crit.addOrderBy("validFromDate", false);
    crit.setMaxResults(1);
    PriceListVersion version = (PriceListVersion) crit.uniqueResult();
    return version != null ? version.getId() : null;
  }
}
```

### Example: Full Endpoint Override (custom search)

```java
@ApplicationScoped
@Named("orderAdvancedSearch")
public class OrderAdvancedSearchHandler implements NeoHandler {

  @Override
  public NeoResponse handle(NeoContext context) {
    // Full override: completely replaces the default GET handler
    String query = context.getQueryParams().get("q");
    // Custom OBDal query with business-specific joins
    List<Order> orders = customSearch(query, context.getObContext());
    JSONArray result = serializeOrders(orders);
    return NeoResponse.ok(new JSONObject().put("data", result));
  }
}
```

### Override Granularity Examples

```
// Override ONLY the POST on ProductPrice
Flow=PriceList, Req=ProductPrice, Method=POST  → productPricePostHandler

// Override ALL methods on ProductPrice
Flow=PriceList, Req=ProductPrice, Method=null  → productPriceFullHandler

// Override ALL DELETE methods in the PriceList flow
Flow=PriceList, Req=null, Method=DELETE        → priceListDeleteHandler

// Override EVERYTHING in PriceList (full custom API)
Flow=PriceList, Req=null, Method=null          → priceListCustomHandler
```

---

## 6. OpenAPI Auto-Generation

### How It Works Today

`DynamicDatasourceEndpoint` already:
1. Reads all `ETAPI_OPENAPI_FLOW` records
2. For each flow, reads `ETAPI_OPENAPI_FLOWPOINT` entries
3. For each flowpoint, reads `ETRX_OPENAPI_TAB` to get the AD_TAB
4. Introspects AD_TAB fields → generates JSON Schema
5. Builds OpenAPI paths with proper request/response schemas

### What Changes for NEO

The `DynamicDatasourceEndpoint` (or a new `NeoDatasourceEndpoint`) needs:

1. **New base path**: `/neo/v1/` instead of `/sws/com.etendoerp.etendorx.datasource/`
2. **DELETE operation**: Add `deleteOperation()` builder when `ISDELETE=Y`
3. **PATCH operation**: Add `patchOperation()` builder when `ISPATCH=Y` (mirrors PUT schema)
4. **Override documentation**: When an override exists, check if the handler implements `NeoOpenAPIAware`:

```java
/**
 * Optional interface for override handlers that want to customize
 * their OpenAPI documentation.
 */
public interface NeoOpenAPIAware {
  /**
   * Customize the OpenAPI operation for this override.
   * Called during spec generation.
   * Return null to use the default auto-generated schema.
   */
  Operation customizeOperation(Operation defaultOperation, String httpMethod);

  /**
   * Provide a custom request schema.
   * Return null to use the auto-generated schema from AD fields.
   */
  Schema<?> customRequestSchema(String httpMethod);

  /**
   * Provide a custom response schema.
   * Return null to use the auto-generated schema.
   */
  Schema<?> customResponseSchema(String httpMethod);
}
```

This means: if an override handler also implements `NeoOpenAPIAware`, the OpenAPI spec reflects the custom schema. Otherwise, the default AD-introspected schema is used.

### OpenAPI Output Example

```yaml
openapi: 3.0.0
info:
  title: Etendo NEO Headless API
  version: 1.0.0
paths:
  /neo/v1/PriceList/PriceList:
    get:
      tags: [PriceList]
      summary: Get data from PriceList entity
      parameters:
        - name: q
          in: query
          schema: { type: string }
        - name: _startRow
          in: query
          schema: { type: integer, default: 0 }
        - name: _endRow
          in: query
          schema: { type: integer, default: 100 }
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/PriceList' }
    post:
      tags: [PriceList]
      summary: Create a new PriceList record
      requestBody:
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PriceListInput' }

  /neo/v1/PriceList/ProductPrice/{id}:
    delete:
      tags: [PriceList]
      summary: Delete a ProductPrice record
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        204: { description: Record deleted }
        404: { description: Record not found }

components:
  schemas:
    PriceList:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        currency: { type: string }
        currency$_identifier: { type: string }
        # ... auto-generated from AD_TAB fields
    PriceListInput:
      type: object
      properties:
        name: { type: string }
        currency: { type: string }
        # ... only editable fields
```

---

## 7. Schema Forge Integration

### Before: Schema Forge generates code

```
Schema Forge → generates → Java DTOs, EventHandlers, Endpoints, Mappers
                           ↓
                     gradlew smartbuild (minutes)
                           ↓
                     Compiled module deployed
```

### After: Schema Forge writes directly to the database

```
Schema Forge → writes → DB records via webhooks (FLOW, REQ, FLOWPOINT, TAB, FIELD, OVERRIDE)
                        ↓
                  Instant. No gradlew, no install, no restart.
                        ↓
                  NEO Headless serves the API immediately
```

Schema Forge uses the same webhook mechanism it already uses for `/etendo:alter-db` and `/etendo:window` — direct INSERT/UPDATE against the running Etendo instance's database via HTTP webhooks. No intermediate XML files, no compilation, no deployment steps.

### What Schema Forge Writes (directly to BD)

For each curated window, Schema Forge inserts records into these tables:

| Table | Records Per Window | Purpose |
|-------|-------------------|---------|
| `ETAPI_OPENAPI_FLOW` | 1 | One flow per window |
| `ETAPI_OPENAPI_REQ` | 1 per visible tab | One endpoint per tab entity |
| `ETAPI_OPENAPI_FLOWPOINT` | 1 per req | HTTP methods enabled |
| `ETRX_OPENAPI_TAB` | 1 per req | Link to AD_TAB |
| `ETRX_OPENAPI_FIELD` | N per tab | Only the curated visible fields |
| `ETRX_NEO_OVERRIDE` | 0-N | Only when custom logic is needed |

### Webhook Flow

```
Schema Forge (Claude subagent)
    │
    ├─ POST /ws/com.etendoerp.etendorx.neo/configureFlow
    │   body: { name: "SalesOrder", description: "Sales Order API" }
    │   → Creates ETAPI_OPENAPI_FLOW record
    │
    ├─ POST /ws/com.etendoerp.etendorx.neo/configureEndpoint
    │   body: { flowName: "SalesOrder", tabId: "...", entityName: "Order",
    │           get: true, post: true, put: true, patch: true, delete: false }
    │   → Creates ETAPI_OPENAPI_REQ + FLOWPOINT + ETRX_OPENAPI_TAB records
    │
    ├─ POST /ws/com.etendoerp.etendorx.neo/configureFields
    │   body: { reqName: "Order", fields: [
    │             { fieldId: "...", description: "Business partner", seq: 10, visibility: "editable" },
    │             { fieldId: "...", description: "Document number", seq: 20, visibility: "readOnly" }
    │           ]}
    │   → Creates ETRX_OPENAPI_FIELD records (whitelist mode)
    │
    └─ POST /ws/com.etendoerp.etendorx.neo/configureOverride  (only when needed)
        body: { flowName: "SalesOrder", reqName: "Order", method: "POST",
                qualifier: "orderPostHandler", type: "PRE_HOOK" }
        → Creates ETRX_NEO_OVERRIDE record
```

These webhooks are **idempotent** — calling them again with the same parameters updates existing records instead of creating duplicates. This lets Schema Forge iterate safely.

#### Selector / Reference Configuration

Schema Forge also configures selector endpoints for all referenced entities. These are shared across windows:

```
Schema Forge (Claude subagent)
    │
    ├─ POST /ws/.../configureFlow
    │   body: { name: "Ref", description: "Reference data selectors" }
    │
    ├─ POST /ws/.../configureEndpoint  (one per reference entity)
    │   body: { flowName: "Ref", tabId: "...", entityName: "BusinessPartner",
    │           get: true, getbyid: true, post: false, put: false, patch: false, delete: false }
    │   → GET-only endpoint for selector use
    │
    └─ POST /ws/.../configureFields
        body: { reqName: "BusinessPartner", fields: [
                  { fieldId: "...", description: "Name", seq: 10 },
                  { fieldId: "...", description: "Tax ID", seq: 20 }
                ]}
        → Only the fields needed for the selector dropdown
```

This is done **once per Etendo instance**, not per window. If Sales Order and Invoice both reference BusinessPartner, they share the same `Ref/BusinessPartner` endpoint.

### Field Visibility Mapping

Schema Forge's visibility model maps directly:

| Schema Forge Visibility | NEO Headless Behavior |
|------------------------|----------------------|
| `editable` | Include in `ETRX_OPENAPI_FIELD`, appears in request + response schemas |
| `readOnly` | Include in `ETRX_OPENAPI_FIELD`, appears only in response schema |
| `system` | Do NOT include in `ETRX_OPENAPI_FIELD` (auto-derived by AD, hidden from API) |
| `discarded` | Do NOT include in `ETRX_OPENAPI_FIELD` (excluded from API) |

When `ETRX_OPENAPI_FIELD` records exist for a tab, only those fields are exposed (whitelist mode). This is already the current behavior — no changes needed.

### Example: Schema Forge configuring Sales Order

```
Step 1: Schema Forge analyzes Sales Order window
  → Identifies 2 tabs to expose: Order (header), OrderLine (lines)
  → Curates fields: 15 editable, 8 readOnly, 20 system (hidden), 5 discarded

Step 2: Schema Forge calls webhooks
  → POST /configureFlow       { name: "SalesOrder" }
  → POST /configureEndpoint   { flow: "SalesOrder", tab: "Order header tab", entity: "Order", ... }
  → POST /configureEndpoint   { flow: "SalesOrder", tab: "Order line tab", entity: "OrderLine", ... }
  → POST /configureFields     { req: "Order", fields: [...23 visible fields...] }
  → POST /configureFields     { req: "OrderLine", fields: [...18 visible fields...] }

Step 3: Done. API is live.
  → GET /neo/v1/SalesOrder/Order          ← works immediately
  → POST /neo/v1/SalesOrder/OrderLine     ← works immediately
  → OpenAPI spec updated at /neo/v1/docs  ← reflects new endpoints
```

No XML generation. No gradlew. No restart. **Instant.**

---

## 8. Migration Path

### Coexistence Strategy

NEO Headless 2.0 runs **alongside** the current headless, not replacing it:

```
Existing:  /sws/com.etendoerp.etendorx.datasource/EntityName    (unchanged)
New:       /neo/v1/FlowName/EntityName                           (NEO)
```

Both use the same configuration tables (ETAPI_OPENAPI_FLOW, etc.), but NEO adds:
- New URL routing (`/neo/v1/`)
- Override resolution
- DELETE/PATCH support
- Enhanced OpenAPI generation

The old path continues working for existing integrations. New development uses NEO.

### Phase Plan

```
Phase 1: Foundation
  - Add ISDELETE/ISPATCH columns to ETAPI_OPENAPI_FLOWPOINT
  - Create ETRX_NEO_OVERRIDE table
  - Build NeoServlet (new servlet at /neo/v1/)
  - Build OverrideResolver
  - Add DELETE handler to DataSourceServlet logic

Phase 2: Override System
  - NeoHandler interface + NeoContext + NeoResponse
  - CDI-based override discovery
  - PRE_HOOK / POST_HOOK / METHOD / ENDPOINT types
  - Register override configuration window (sub-tab in OpenAPI Flows)

Phase 3: OpenAPI Enhancement
  - NeoDatasourceEndpoint (extends DynamicDatasourceEndpoint)
  - DELETE/PATCH schema generation
  - NeoOpenAPIAware integration
  - Swagger UI at /neo/v1/docs

Phase 4: Schema Forge Integration
  - Webhook-based config writer (direct DB inserts, no XML, no gradlew)
  - Idempotent endpoints for flow/endpoint/field/override configuration
  - Override generator for known custom logic patterns
  - Contract tests validate config records (not Java code)
```

---

## 9. Implementation Plan

### New Java Classes to Create

| Class | Package | Purpose | LOC Est. |
|-------|---------|---------|----------|
| `NeoServlet` | `com.etendoerp.etendorx.neo` | HTTP router for `/neo/v1/` | ~200 |
| `NeoHandler` | `com.etendoerp.etendorx.neo` | Override handler interface | ~20 |
| `NeoContext` | `com.etendoerp.etendorx.neo` | Request context object | ~80 |
| `NeoResponse` | `com.etendoerp.etendorx.neo` | Response wrapper | ~60 |
| `NeoOpenAPIAware` | `com.etendoerp.etendorx.neo` | Optional OpenAPI customization | ~30 |
| `OverrideResolver` | `com.etendoerp.etendorx.neo` | Resolves which override applies | ~150 |
| `NeoDatasourceEndpoint` | `com.etendoerp.etendorx.neo.openapi` | OpenAPI generation for NEO | ~300 |
| `DeleteHandler` | `com.etendoerp.etendorx.neo` | Default DELETE implementation | ~80 |
| `NeoConfigWebhook` | `com.etendoerp.etendorx.neo.webhook` | Webhook for configureFlow/Endpoint/Fields/Override | ~250 |

**Total new code: ~1170 lines** (compiled once, never regenerated)

### Database Changes

| Change | Type | Impact |
|--------|------|--------|
| Add `ISDELETE` to `ETAPI_OPENAPI_FLOWPOINT` | ALTER TABLE | Non-breaking, default 'N' |
| Add `ISPATCH` to `ETAPI_OPENAPI_FLOWPOINT` | ALTER TABLE | Non-breaking, default 'Y' |
| Add `DELETEDESCRIPTION` to `ETAPI_OPENAPI_REQ` | ALTER TABLE | Non-breaking, nullable |
| Add `PATCHDESCRIPTION` to `ETAPI_OPENAPI_REQ` | ALTER TABLE | Non-breaking, nullable |
| Create `ETRX_NEO_OVERRIDE` | CREATE TABLE | New table, no impact |
| Create `ETRX_NEO_SELECTOR_RULE` | CREATE TABLE | New table, selector validation rules |
| Register AD_TABLE, AD_COLUMN, AD_TAB for override table | INSERT | AD configuration |

### Files to Modify

| File | Change |
|------|--------|
| `DataSourceServlet.java` | Extract core CRUD logic into reusable methods callable from NeoServlet |
| `DynamicDatasourceEndpoint.java` | Factor out schema generation into shared utility |
| `OpenAPIConstants.java` | Add NEO base path constant |

---

## 10. Open Questions

### Technical

- [ ] **DELETE implementation**: Should DELETE cascade to child entities? Or only delete the specific record? Need to align with AD cascade rules.
- [ ] **Batch operations**: Current POST supports JSON arrays (bulk create). Should NEO support bulk DELETE/PATCH too?
- [ ] **Parent-child filtering**: When requesting `/neo/v1/SalesOrder/OrderLine?q=order.id==ABC`, should the RSQL `q` parameter support cross-entity references?
- [ ] **Caching**: Should override resolution be cached? If so, what invalidates the cache? (AD record change → event handler clears cache?)
- [ ] **Transaction scope**: Should POST of parent + children be wrapped in a single transaction? Or is each entity independently transacted?

### Architectural

- [ ] **New module or same module?** Should NEO live in `com.etendoerp.etendorx` (evolution) or `com.etendoerp.neo` (new module)? Recommendation: same module, new package.
- [ ] **Version in URL**: Is `/neo/v1/` the right approach? Or should it be `/api/v1/`? Consider that `v1` is the URL version, NOT the data version.
- [ ] **Authentication**: Same JWT auth as current headless? Or add support for API keys, OAuth2?

### Business

- [ ] **Who maintains overrides?** If a module ships with overrides, what happens when the base module is updated? Override takes precedence or base logic?
- [ ] **Override discovery UX**: Should there be a "test override" button in the config window that validates the CDI qualifier exists?

---

## Summary

| Aspect | Current Headless | NEO Headless 2.0 |
|--------|-----------------|-------------------|
| Configuration | Same AD tables | Same + ETRX_NEO_OVERRIDE |
| HTTP Methods | GET, POST, PUT | GET, POST, PUT, PATCH, DELETE |
| URL pattern | `/sws/.../datasource/{entity}` | `/neo/v1/{flow}/{entity}` |
| Custom logic | Separate Java endpoint | Override registered in config |
| Override granularity | None | Window > Tab > Endpoint > Method |
| OpenAPI | Auto-generated | Auto-generated + override-aware |
| Code generation needed | No | No |
| Schema Forge output | Dataset.xml records | Direct DB writes via webhooks (instant) |
| Selector/reference endpoints | Manual / separate | Same mechanism: GET-only flows with RSQL |
| New Java code | 0 | ~1170 lines (compiled once) |
| New DB tables | 0 | 2 (ETRX_NEO_OVERRIDE, ETRX_NEO_SELECTOR_RULE) |
| Breaking changes | 0 | 0 (coexists with current) |
