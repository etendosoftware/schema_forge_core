# NEO Entity Naming Investigation

## Summary

This document captures the investigation into how `push-to-neo` identifies existing NEO rows, why duplicate `ETGO_SF_ENTITY` / `ETGO_SF_FIELD` rows can appear after renames, how endpoint paths are actually resolved at runtime, and the recommended unification rule.

Main conclusion:

- The runtime endpoint path for window entities is resolved from `ETGO_SF_ENTITY.name`.
- The correct final naming convention must therefore be the curated entity names from Schema Forge contracts (`header`, `paymentDetails`, `paymentPlan`, `quotation`, etc.), not raw `AD_Tab.name` labels (`Header`, `Payment Details`, `Payment Plan`, `Tax`, etc.).
- `push-to-neo` currently has a two-phase behavior for window specs: it first creates entities using `AD_Tab.name`, then renames them to the curated contract names. Any duplicates left in the database are legacy/incomplete state and should be treated as cleanup candidates.

## Problem Description

The original concern was that `push-to-neo` sometimes inserted a new NEO record instead of updating an existing one when something changed name.

The observed symptoms were:

- duplicate entities for the same `AD_Tab_ID`
- duplicate fields for the same `ETGO_SF_ENTITY_ID + AD_Column_ID`
- mixed naming styles in `ETGO_SF_ENTITY.name`
  - raw tab labels, for example `Payment Details`, `Tax`, `Line Tax`
  - curated Schema Forge names, for example `paymentDetails`, `tax`, `lineTax`, `header`, `quotation`

This created uncertainty around two questions:

1. Which row is the canonical one after a rename?
2. Which name actually defines the runtime endpoint path?

## Scope of the Investigation

The investigation covered both repositories:

- Schema Forge (`schema_forge`)
- Etendo Go runtime (`modules/com.etendoerp.go`)

Relevant areas reviewed:

### Schema Forge

- `cli/src/push-to-neo.js`
- `cli/src/neo-writer.js`
- `cli/src/generate-contract.js`
- `cli/src/detect-neo-duplicates.js`
- `cli/src/neo-identity.js`

### Etendo Go runtime

- `src/com/etendoerp/go/schemaforge/NeoServlet.java`
- `src/com/etendoerp/go/schemaforge/NeoServletSupport.java`
- `src/com/etendoerp/go/schemaforge/NeoCrudHandler.java`
- `src/com/etendoerp/go/schemaforge/NeoSelectorService.java`
- `src/com/etendoerp/go/schemaforge/NeoProcessService.java`
- `src/com/etendoerp/go/schemaforge/util/NeoDiscoveryHelper.java`
- `src/com/etendoerp/go/schemaforge/NeoOpenAPIEndpoint.java`

## How `push-to-neo` Works Today

### Step 1: Initial population uses raw AD tab names

During window population, entities are first created/upserted using `tab.name`:

- `cli/src/neo-writer.js:441-450`
- `cli/src/neo-writer.js:445`

```js
const { entityId, created: entityCreated } = await upsertEntity(client, {
  specId,
  tabId: tab.ad_tab_id,
  moduleId,
  name: tab.name,
  seqNo: entitySeqNo,
  entityId: existingEntityId,
  ...methodFlags,
  audit,
});
```

At this stage the DB entity name will look like:

- `Header`
- `Payment Details`
- `Payment Plan`
- `Tax`
- `Line Tax`

This is an intermediate state.

### Step 2: `push-to-neo` renames entities to curated contract names

After population, `push-to-neo` builds lookup maps and updates `ETGO_SF_ENTITY.name` to the entity names present in the generated backend contract:

- `cli/src/push-to-neo.js:493-517`

```js
await client.query(
  'UPDATE etgo_sf_entity SET name = $1, java_qualifier = $2 WHERE etgo_sf_entity_id = $3',
  [ent.name, ent.javaQualifier ?? null, entityId],
);
```

That means the intended final persisted names are the curated names from the contract, for example:

- `header`
- `lines`
- `lineTax`
- `paymentPlan`
- `paymentDetails`
- `quotation`
- `quotationLine`

### Step 3: Contracts generate paths from curated entity names

Schema Forge contracts generate entity endpoints from `entity.name`:

- `cli/src/generate-contract.js:296-303`

```js
const basePath = `/${entity.name}`;
```

So the contract layer already assumes curated entity names are the public API shape.

## How Runtime Endpoint Resolution Actually Works

The key runtime conclusion is:

**Window endpoints are resolved by exact lookup against `ETGO_SF_ENTITY.name`.**

### Path parsing

The servlet parses paths as:

- `/sws/neo/{specName}/{entityName}[/{id}]`

Source:

- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:45-52`
- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServletSupport.java:74-90`
- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServletSupport.java:97-107`

### Entity lookup

Once the path is parsed, the runtime resolves the entity using:

- `specId`
- `entityName` from the URL
- `SFEntity.PROPERTY_NAME`

Source:

- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:457-465`

```java
criteria.add(Restrictions.eq(SFEntity.PROPERTY_ETGOSFSPEC + ".id", specId));
criteria.add(Restrictions.ilike(SFEntity.PROPERTY_NAME, entityName, MatchMode.EXACT));
```

The same pattern is also used by:

- CRUD handling: `NeoCrudHandler.java:71-78`
- selectors: `NeoSelectorService.java:520-529`
- action listing: `NeoProcessService.java:214-225`
- display logic helpers/handlers: multiple exact lookups by `SFEntity.PROPERTY_NAME`

### OpenAPI generation

The runtime OpenAPI surface is also built from spec/entity records in the database:

- `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoOpenAPIEndpoint.java:121-141`

This reinforces that the persisted NEO entity names are part of the external API contract.

## Why the Confusion Happened

There are two naming layers involved:

### A. AD label naming

Derived from `AD_Tab.name` during initial population:

- `Header`
- `Payment Details`
- `Payment Plan`
- `Tax`
- `Line Tax`

### B. Curated Schema Forge naming

Derived from curated schema/contract entities:

- `header`
- `paymentDetails`
- `paymentPlan`
- `tax`
- `lineTax`
- `quotation`
- `quotationLine`

Because the initial population and the final rename are separate steps, partially-migrated or legacy data can leave both naming styles in the database at once.

## Duplicate Detector Findings

The duplicate detector reported:

- total duplicate groups: `32`
- spec duplicates by window: `0`
- spec duplicates by process: `0`
- entity duplicates by tab: `1`
- field duplicates by column: `31`
- process/report field duplicates by qualifier: `0`

### Example entity duplicate

A concrete example was found for `sales-invoice` on the same `AD_Tab_ID`:

- `sales-invoice/paymentDetails`
- `sales-invoice/Payment Details`

This is the clearest evidence of the naming split between curated names and raw AD labels.

### Duplicate patterns seen in fields

Most field duplicates were found in existing window entities such as:

- `purchase-order/header`
- `purchase-order/paymentPlan`
- `sales-order/header`
- `sales-quotation/Tax`
- `purchase-invoice/Line Tax`

In most cases the duplicate detector showed multiple rows for the same:

- `ETGO_SF_ENTITY_ID + AD_Column_ID`

This is consistent with legacy re-inserts or incomplete cleanup from older runs.

## What the Current Database Shows

Inspection of current DB rows for affected specs showed a mixed state:

### Already aligned to curated naming

Examples:

- `purchase-order/header`
- `purchase-order/lines`
- `purchase-order/lineTax`
- `purchase-order/paymentPlan`
- `purchase-order/paymentDetails`
- `sales-order/header`
- `sales-quotation/quotation`
- `sales-quotation/quotationLine`
- `sales-invoice/header`
- `sales-invoice/paymentDetails`

### Still using label-style names

Examples:

- `Payment Details`
- `Tax`
- `Line Tax`
- `Basic Discounts`
- `Exchange rates`
- `Accounting`
- `Reversed Invoices`

This confirms that the system is partially migrated rather than consistently following one naming rule everywhere.

## Root Cause

The naming mismatch comes from a valid but fragile design split:

1. populate from AD using stable metadata and `AD_Tab.name`
2. later rename to curated Schema Forge names from the contract

This is workable, but it means:

- any failed or partial execution can leave label-style entity names in DB
- historical rows can coexist with renamed rows
- duplicate cleanup becomes harder if matching falls back to names
- endpoint resolution becomes ambiguous for humans even if the runtime uses exact DB names

## Final Conclusion

The correct unified naming rule is:

> `ETGO_SF_ENTITY.name` should store the curated Schema Forge entity name, not the raw `AD_Tab.name` label.

This is the only rule that keeps all layers aligned:

- generated contracts
- documented endpoints
- runtime routing
- runtime selector/action/display resolution
- duplicate detection semantics
- future rename-safe identity handling

### Why this rule is correct

1. Contracts already generate paths from curated entity names.
2. Runtime resolves entity routes by `ETGO_SF_ENTITY.name`.
3. `push-to-neo` already performs a final rename step toward curated names.
4. The duplicate examples are best explained as legacy rows that survived before/after that rename step.

## Recommended Operational Rule

When duplicates exist for the same logical entity:

- keep the row whose final name matches the curated contract entity name
- treat rows whose name only matches `AD_Tab.name` as legacy/intermediate rows

Examples:

- keep `paymentDetails`, drop `Payment Details`
- keep `header`, drop `Header`
- keep `paymentPlan`, drop `Payment Plan`
- keep `quotation`, drop `Header`-style legacy naming for that same curated entity

## Recommended Field Cleanup Rule

For duplicate fields under the winning entity:

- dedupe by `ETGO_SF_ENTITY_ID + AD_Column_ID`
- keep the row associated with the winning entity
- if there are still multiple rows inside the same entity, keep the most recent valid row and delete the rest
- rows with `AD_Column_ID IS NULL` should be reviewed manually before deletion

## Implications for Future Work

To keep the system unified over time:

1. Keep stable matching by `AD_Window_ID`, `AD_Process_ID`, `AD_Tab_ID`, `AD_Column_ID`, and `AD_Process_Para_ID`.
2. Keep the final rename/update step that writes curated names into `ETGO_SF_ENTITY.name`.
3. Treat label-style entity names as intermediate only, never as the canonical public API surface.
4. Use the duplicate detector as an audit tool before cleanup or migration.

## Relevant Code References

### Schema Forge

- initial entity population from tab names: `cli/src/neo-writer.js:441-450`
- initial tab-name assignment: `cli/src/neo-writer.js:445`
- rename to contract names: `cli/src/push-to-neo.js:493-517`
- contract endpoint generation: `cli/src/generate-contract.js:296-303`
- entity matching bridge comments: `cli/src/push-to-neo.js:450-458`, `cli/src/push-to-neo.js:493-507`
- duplicate detector report formatting: `cli/src/detect-neo-duplicates.js`

### Etendo Go runtime

- path format: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:45-52`
- path parsing: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServletSupport.java:74-139`
- entity lookup by DB name: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoServlet.java:457-465`
- CRUD routing by resolved entity name: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoCrudHandler.java:71-78`
- selector lookup by entity name: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorService.java:520-529`
- action lookup by entity name: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoProcessService.java:214-225`
- discovery/spec describe exposing entity names: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/util/NeoDiscoveryHelper.java:151-177`, `194-207`
- OpenAPI generation from database specs/entities: `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoOpenAPIEndpoint.java:121-141`

## Recommended Next Step

Before deleting anything, generate a remediation table with:

- duplicate group
- winner row (`keep`)
- loser rows (`drop`)
- reason

Suggested decision policy:

- prefer curated contract entity names over raw AD tab labels
- prefer stable identity matches over name-only matches
- prefer the field rows linked to the winning entity
- manually inspect any duplicate rows with missing `AD_Column_ID`
