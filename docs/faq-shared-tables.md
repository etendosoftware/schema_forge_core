# FAQ: Windows That Share Database Tables

## The Question

Several Etendo AD Windows point to the same underlying database tables. For example, **Sales Invoice** and **Purchase Invoice** both use `C_Invoice` and `C_InvoiceLine`. When Schema Forge processes both windows, their curated schemas may produce identical entity names (e.g., "Invoice" and "Invoice Line").

**Do these entity names collide anywhere in the pipeline?**

## The Answer

**No.** Every stage of the Schema Forge pipeline isolates data by window (or spec) name. Two entities named "Invoice" under different specs are completely independent.

Here is a stage-by-stage breakdown:

### 1. Artifacts (filesystem)

Each window gets its own directory under `artifacts/`:

```
artifacts/
  sales-invoice/
    schema-curated.json
    contract.json
    ...
  purchase-invoice/
    schema-curated.json
    contract.json
    ...
```

Entity names live inside per-window JSON files. There is no shared namespace.

### 2. Contracts

The backend contract is a per-window JSON file (`artifacts/{windowName}/contract.json`). Entity names are keys within a `backendContract.entities` object scoped to that file. Two windows can both define an entity called `"Invoice"` without conflict.

### 3. Push to NEO (Database)

The three configuration tables use a strict parent-child hierarchy:

```
ETGO_SF_SPEC  (one row per window/process/report)
  └── ETGO_SF_ENTITY  (scoped by ETGO_SF_SPEC_ID foreign key)
        └── ETGO_SF_FIELD  (scoped by ETGO_SF_ENTITY_ID foreign key)
```

Each `ETGO_SF_ENTITY` row has a required `ETGO_SF_SPEC_ID` FK that ties it to exactly one spec. Two rows with `NAME = 'Invoice'` are allowed as long as they belong to different specs.

The `neo-writer.js` `upsertEntity()` function always receives a `specId` parameter, and the `populateSpec()` function deletes and recreates entities scoped to a single spec. There is no cross-spec interaction.

> **Note:** There is no explicit `UNIQUE(ETGO_SF_SPEC_ID, NAME)` constraint at the database level. Uniqueness is structural -- enforced by the pipeline logic (one populate per spec) rather than a DDL constraint. If you write directly to the DB outside of Schema Forge tooling, you are responsible for avoiding duplicates within a spec.

### 4. REST API (URL Routing)

The NeoServlet parses URLs as `/{specName}/{entityName}`, so the spec name acts as a namespace prefix:

```
GET /sws/neo/SalesInvoice/Header
GET /sws/neo/PurchaseInvoice/Header
```

These are two completely separate routes resolved independently. The servlet looks up the entity within the matched spec only (`findEntity(spec.getId(), pathInfo.entityName)`).

### 5. Frontend Generation

Generated React components are placed under window-scoped directories:

```
artifacts/{windowName}/generated/web/{windowName}/InvoiceForm.jsx
```

Two windows produce output in separate directories. No filename collision is possible.

### 6. Pipeline Execution

`pipeline.js` processes one window at a time. There is no shared mutable state between runs. Running the pipeline for Sales Invoice and Purchase Invoice (sequentially or in separate worktrees) produces isolated artifacts.

### 7. Contract Tests

Contract test files are per-window (`artifacts/{windowName}/contract.json`), and the test runner (`run-contract-tests.js`) operates on a single contract file per invocation.

### 8. Mock Data

Mock data generation (`generate-mock-data.js`) reads from per-window schemas and writes to per-window artifact directories. No cross-window data sharing.

## Known Shared-Table Pairs in Etendo

These are common examples of AD Windows that share the same underlying database tables:

| Window A | Window B | Shared Tables |
|----------|----------|---------------|
| Sales Invoice | Purchase Invoice | `C_Invoice`, `C_InvoiceLine` |
| Sales Order | Purchase Order | `C_Order`, `C_OrderLine` |
| Goods Shipment | Goods Receipt | `M_InOut`, `M_InOutLine` |

Additionally, the **Business Partner** window covers both customers and vendors via the same `C_BPartner` table, differentiated by filter criteria (`isCustomer` / `isVendor`) rather than separate windows.

## The Key Principle

Entity names are **local to their spec**. The scoping hierarchy is:

```
Spec (window name)
  └── Entity (tab name)       -- unique within its spec
        └── Field (column)    -- unique within its entity
```

This is the same pattern Etendo itself uses: multiple `AD_Tab` rows with the same `AD_Table_ID` can exist across different `AD_Window` entries. Schema Forge mirrors this isolation at every level.
