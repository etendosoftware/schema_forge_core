# Contract Field Distribution

How each property in `contract.json` is consumed by the backend (NEO Headless) and frontend (React SPA).

> See `docs/plans/contract-v2-improvements.md` for the full implementation plan.

## Top-Level Sections

| Section | Consumer | Purpose |
|---------|----------|---------|
| `frontendContract` | Frontend | Fields with UI-specific metadata (tsType, grid, form, inputMode, dependsOn) |
| `backendContract` | Backend | Fields with API-level metadata (visibility, column, type, required) |
| `testManifest` | Both | Auto-generated test cases to verify structural correctness |

## Window Metadata

| Property | Frontend | Backend | Notes |
|----------|:--------:|:-------:|-------|
| `window.id` | - | Yes | AD_Window_ID, used by SFUpsertSpec webhook |
| `window.name` | Yes | Yes | Display label (front), spec name derivation (back) |
| `window.primaryEntity` | Yes | - | Which entity is the "root" tab for navigation |
| `window.category` | Yes | - | UI categorization (sales, purchasing, etc.) |

## Frontend Contract — Entity Fields

These properties exist **only in `frontendContract.entities.{entity}.fields`**.

| Property | Consumer | Purpose | Example |
|----------|----------|---------|---------|
| `name` | Frontend | Field identifier (camelCase) | `"businessPartner"` |
| `column` | - | Reference only (not used at runtime) | `"C_BPartner_ID"` |
| `type` | Frontend | Semantic type for rendering logic | `"foreignKey"`, `"date"`, `"amount"` |
| `tsType` | Frontend | TypeScript type for generated code | `"string"`, `"number"`, `"boolean"` |
| `visibility` | Frontend | Determines if field is shown and how | `"editable"`, `"readOnly"` |
| `required` | Frontend | Form validation — show required indicator | `true` / `false` |
| `grid` | Frontend | Show in list/table view | `true` / `false` |
| `form` | Frontend | Show in detail/edit form view | `true` / `false` |
| `reference` | Frontend | FK entity name for selector/search UI | `"BusinessPartner"`, `"Warehouse"` |
| `inputMode` | Frontend | How the FK field is rendered | `"search"`, `"selector"`, `"dependent"` |
| `dependsOn` | Frontend | Cascading FK dependency | `{ field, filterKey }` |
| `validation` | Frontend | Client-side form validation constraints (nested object) | `{ required, maxLength, minimum, format, ... }` |

> **`validation` object (ETP-4555):** a single nested object holding declarative constraints — `required`, `minLength`, `maxLength`, `minimum`, `maximum`, `format`, `enum`, `allowedSchemes` (fixed canonical key order). Derived by `resolve-curated` with **decision > raw AD** precedence; absent when nothing applies. **Frontend-scoped only** — not pushed to NEO and not enforced server-side (see the note in `docs/decisions-reference.md` § "Validation Constraints"). Full shape, precedence rules, zero-validity, string→number coercion, and UTF-16 length semantics live there — this table is a pointer, not a copy.

### Entity-Level Properties (Frontend)

| Property | Consumer | Purpose |
|----------|----------|---------|
| `searchableFields[]` | Frontend | Which fields appear in the search/filter bar |
| `computedFields[]` | Frontend | Fields that are auto-calculated (display only) |

## Backend Contract — Entity Fields

These properties exist **only in `backendContract.entities.{entity}.fields`**. Includes **all fields** (editable + readOnly + system), unlike frontendContract which only has visible fields.

| Property | Consumer | Purpose | Example |
|----------|----------|---------|---------|
| `name` | Backend | Field identifier (camelCase) | `"businessPartner"` |
| `column` | Backend | DB column name — used by SFUpsertField webhook | `"C_BPartner_ID"` |
| `type` | Backend | Semantic type (for validation context) | `"foreignKey"`, `"date"` |
| `visibility` | Backend | **Key field** — maps to IsIncluded/IsReadOnly in NEO Headless | `"editable"`, `"readOnly"`, `"system"` |
| `required` | Backend | Mandatory constraint (Etendo AD enforces this) | `true` / `false` |

### Visibility → NEO Headless Mapping (Backend)

| Contract `visibility` | `IsIncluded` | `IsReadOnly` | API Behavior |
|-----------------------|:------------:|:------------:|--------------|
| `editable` | Y | N | In request + response |
| `readOnly` | Y | Y | In response only |
| `system` | N | - | Hidden from API |
| `discarded` | N | - | Hidden from API |

## Backend Contract — Endpoints

| Property | Consumer | Purpose | Example |
|----------|----------|---------|---------|
| `endpoints[].method` | Backend | HTTP method flag on ETGO_SF_ENTITY | `"GET"`, `"POST"`, `"PUT"`, `"DELETE"` |
| `endpoints[].path` | Backend | URL path pattern | `"/order"`, `"/order/:id"` |
| `endpoints[].entity` | Backend | Which entity this endpoint serves | `"order"`, `"orderLine"` |
| `endpoints[].supportedFilters` | Backend | Which fields can be used as query filters | `["businessPartner", "documentNo"]` |
| `processEndpoints[]` | Backend | Process execution endpoints | (same structure) |

## Test Manifest

| Property | Consumer | Purpose |
|----------|----------|---------|
| `tests[].id` | Both | Unique test ID |
| `tests[].category` | Both | Test type: `field-presence`, `field-type`, `searchable-filters`, `visibility`, `system-field` |
| `tests[].entity` | Both | Target entity |
| `tests[].field` | Both | Target field (if applicable) |
| `tests[].runner` | Both | `"node"` = contract test (Schema Forge), `"junit"` = integration test (Etendo Go) |
| `tests[].description` | Both | Human-readable test description |
| `summary` | Both | Aggregated counts by category and runner |

## Key Differences: Frontend vs Backend Fields

| Aspect | Frontend Contract | Backend Contract |
|--------|-------------------|------------------|
| **Fields included** | Only `editable` + `readOnly` | All: `editable` + `readOnly` + `system` |
| **UI metadata** | Yes (`tsType`, `grid`, `form`, `inputMode`, `dependsOn`) | No |
| **Column name** | Present but not used at runtime | Used by SFUpsertField webhook |
| **Visibility** | Determines render mode | Determines IsIncluded/IsReadOnly flags |
| **Required** | Form validation | AD-level constraint (enforced by Etendo core) |

## Who Reads What — Summary

```
contract.json
├── frontendContract          → generate-frontend.js → React SPA
│   ├── window.name/category  → App title, navigation
│   ├── entities.*.fields     → Form/grid rendering (type, tsType, grid, form, inputMode, dependsOn)
│   └── searchableFields      → Filter bar config
│
├── backendContract           → push-to-neo.js → Webhooks → ETGO_SF_* tables
│   ├── window.id             → SFUpsertSpec(windowId)
│   ├── entities.*.fields     → SFUpsertField(column, isIncluded, isReadOnly)
│   └── endpoints             → ETGO_SF_ENTITY method flags
│
└── testManifest              → run-contract-tests.js (node) + JUnit (Etendo Go)
    ├── field-presence         → Verify field exists in contract
    ├── field-type             → Verify correct tsType
    ├── searchable-filters     → Verify filter support
    ├── visibility             → Verify no system fields in frontend
    └── system-field           → Verify system fields in backend but not frontend
```

## Planned Additions

Fields and sections that will be added to the contract in a future version.

### Behavioral Metadata (Phase 1)

Fields that exist in extraction artifacts but don't reach contract.json yet:

| Property | Section | Consumer | Source | Example |
|----------|---------|----------|--------|---------|
| `callout.className` | frontendContract | Frontend | schema-raw.json | `"org.openbravo...SL_Order_Amt"` |
| `callout.effects` | frontendContract | Frontend | rules-raw.json | `["partnerAddress", "priceList"]` |
| `callout.complexity` | frontendContract | Frontend | rules-raw.json | `"high"` |
| `displayLogic.raw` | frontendContract | Frontend | schema-raw.json | `"@DocStatus@='DR'"` |
| `displayLogic.js` | frontendContract | Frontend | rules-raw.json | `"docStatus === 'DR'"` |
| `readOnlyLogic.raw` | frontendContract | Frontend | schema-raw.json | `"@Processed@='Y'"` |
| `readOnlyLogic.js` | frontendContract | Frontend | rules-raw.json | `"processed === 'Y'"` |

Note: Callouts do NOT execute in NEO Headless. This metadata is informational — tells the frontend team what server-side logic exists that may need client-side equivalents.

### Endpoint Prediction (Phase 2)

New `apiPrediction` section with full URL patterns:

| Property | Consumer | Purpose |
|----------|----------|---------|
| `apiPrediction.crud.{entity}.*` | Both | HTTP method flags per entity |
| `apiPrediction.selectors[]` | Frontend | FK dropdown endpoint URLs |
| `apiPrediction.actions[]` | Frontend | Button process endpoint URLs |
| `apiPrediction.queryParams` | Frontend | Supported pagination, sorting, filtering params |

### UI Hints (Phase 3)

New field-level properties from AD metadata:

| Property | Consumer | Source | Purpose |
|----------|----------|--------|---------|
| `defaultValue` | Both | AD_Column.DefaultValue | Pre-fill on create |
| `isIdentifier` | Frontend | AD_Column.IsIdentifier | Show in FK dropdowns |
| `help` | Frontend | AD_Column.Help | Tooltip text |
| `fieldGroup` | Frontend | AD_FieldGroup.Name | UI section grouping |
| `isSelectionColumn` | Frontend | AD_Column.IsSelectionColumn | FK selector display |
| `isFilterable` | Frontend | AD_Column.IsFilterable | Can be query filter |
| `precision` | Frontend | AD_Column.Precision | Decimal places |
| `isTranslated` | Both | AD_Column.IsTranslated | Multi-language |
