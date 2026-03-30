# Decisions.json Reference

Complete reference for all configurable options in `decisions.json` files. These files store human and AI-curated design decisions for each window/process, controlling what fields appear, how they behave, and how the UI renders.

## File Structure

```json
{
  "$schema": "decisions-v2",
  "version": 2,
  "window": { "category": "sales", "name": "Sales Order" },
  "discardPatterns": ["EM_*"],
  "entities": {
    "header": { ... },
    "lines": { ... }
  },
  "rules": { ... }
}
```

## Root-Level Properties

| Property | Type | Required | Default | Purpose |
|----------|------|----------|---------|---------|
| `$schema` | string | No | `"decisions-v1"` | Schema identifier (e.g., `"decisions-v2"`). Auto-set by migration runner. |
| `version` | number | No | `1` | Numeric schema version. Current: 2. See `docs/decisions-versioning.md`. |
| `window` | object | Yes | — | Window-level metadata. |
| `entities` | object | Yes | — | Entity definitions keyed by entity name. |
| `rules` | object | No | `{}` | Business rule catalog. |
| `discardPatterns` | array | No | `[]` | Glob patterns to auto-discard fields. |

## Window Properties (`window.*`)

| Property | Type | Default | Values | Purpose |
|----------|------|---------|--------|---------|
| `category` | string | Inferred | `"sales"`, `"purchases"`, `"inventory"`, `"finance"`, `"accounting"`, `"master"`, `"project"`, `"general"` | UI routing and navigation grouping. |
| `name` | string | From AD | — | Display name for breadcrumbs and titles. |
| `layoutType` | string | `"default"` | `"default"`, `"kanban"`, `"calendar"`, `"custom"` | Frontend rendering mode. See `docs/window-templates.md`. |
| `templateConfig` | object | `null` | Layout-specific | Extra config for non-default layouts (e.g., `groupBy`, `dateField`). |
| `relatedDocuments` | boolean | `false` | — | Enables the Related Documents footer in the detail view. Requires a hand-written `RelatedDocuments.jsx` in `artifacts/{window}/custom/`. The generator emits the import and `customTabs` prop automatically. |
| `notesField` | string | `null` | Any entity field name | Field to display as a notes/description panel in the detail view footer (e.g., `"description"`). Rendered as an expandable text input. |
| `documentPreview` | object | `null` | `{ titlePrefix: string }` | Enables the document preview button in the detail header. `titlePrefix` is shown in the preview drawer title (e.g., `"Order"`, `"Invoice"`). |

## Entity Properties (`entities.{entityName}.*`)

Entity keys use **camelCase from tabName** (e.g., `"header"`, `"lines"`, `"basicDiscounts"`).

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `name` | string | Entity key | Override display name. |
| `exclude` | boolean | `false` | Omit entire entity from schema. |
| `fields` | object | `{}` | Field-level decisions. |
| `draftMode` | object | `null` | Draft/Processed workflow config. |
| `javaQualifier` | string | `null` | CDI qualifier for custom NeoHandler. |

### Draft Mode (`entities.{name}.draftMode`)

Enables a two-button save workflow: "Save Draft" (save only) + "Save & {label}" (save + execute process).

```json
{
  "draftMode": {
    "enabled": true,
    "processField": "documentAction",
    "processValue": "CO",
    "label": "Complete"
  }
}
```

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `enabled` | boolean | `false` | Activate draft mode for this entity. |
| `processField` | string | `"documentAction"` | Field name that controls the process (sent in action POST). |
| `processValue` | string | `"CO"` | Value to submit for processing (e.g., `"CO"` = Complete). |
| `label` | string | `"Process"` | Button label suffix: "Save & {label}". |

**When disabled** (default): single "Save" button.
**When enabled**: "Save draft" + "Save & {label}" buttons, plus process buttons from `processEndpoints`.

## Field Properties (`entities.{name}.fields.{fieldName}.*`)

Field keys use **camelCase from raw schema** (e.g., `"businessPartner"`, `"orderDate"`).

### Visibility & Display

| Property | Type | Default | Values | Purpose |
|----------|------|---------|--------|---------|
| `visibility` | string | From extraction | `"editable"`, `"readOnly"`, `"system"`, `"discarded"` | User interaction level. See `docs/field-visibility-types.md`. |
| `grid` | boolean | Per visibility | `true`/`false` | Show in list/grid view. |
| `form` | boolean | Per visibility | `true`/`false` | Show in detail/form view. |
| `searchable` | boolean | `false` | `true`/`false` | Enable as filter parameter in list API. |
| `section` | string | `null` | `"principal"`, `"other"`, custom | Group fields into form sections. |

**Visibility defaults** (when not overridden):

| Visibility | `grid` | `form` | `searchable` |
|-----------|--------|--------|-------------|
| `editable` | false | true | false |
| `readOnly` | false | true | false |
| `system` | false | false | false |
| `discarded` | false | false | false |

### Reference & Input Mode (FK fields)

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `reference` | string \| null | Auto from targetTable | Catalog name for FK lookup (e.g., `"BusinessPartner"`). Set `null` to omit. |
| `inputMode` | string \| null | Auto from reference type | `"selector"` (dropdown), `"search"` (searchable), `"dependent"` (cascading). Set `null` to omit. |
| `dependsOn` | object \| null | `null` | Parent field dependency for cascading selectors. |

**dependsOn format:**
```json
{
  "field": "businessPartner",
  "filterKey": "C_BPartner_ID"
}
```

Setting `dependsOn` automatically sets `inputMode` to `"dependent"`.

### Logic & Behavior

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `name` | string | Raw field name | Override field's public API name. |
| `required` | boolean | From AD mandatory | Force field as required. |
| `readOnlyLogic` | string \| null | `null` | Expression for conditional read-only. Set `null` to omit. |
| `displayLogic` | string \| null | `null` | Expression for conditional visibility. Set `null` to omit. |

### Explicit null

Setting a property to `null` removes it from the curated output and contracts:
```json
{
  "reference": null,
  "inputMode": null,
  "readOnlyLogic": null
}
```

## Discard Patterns (`discardPatterns`)

Array of glob patterns to auto-exclude fields. Supports:

| Pattern | Match | Example |
|---------|-------|---------|
| `"prefix*"` | Starts with | `"EM_*"` matches `EM_Aprm_AddPayment` |
| `"*suffix"` | Ends with | `"*_old"` matches `price_old` |
| `"exact"` | Exact match | `"someField"` matches only `someField` |

Case-insensitive. **Explicit field `visibility` overrides discard patterns** (human decision wins).

```json
{
  "discardPatterns": ["EM_*"],
  "entities": {
    "header": {
      "fields": {
        "emSomeImportantField": { "visibility": "editable" }
      }
    }
  }
}
```

## Rules (`rules.{ruleName}.*`)

Rule keys use **extended names** (including trigger column suffix for multi-trigger rules).

| Property | Type | Values | Purpose |
|----------|------|--------|---------|
| `type` | string | `"callout"`, `"displayLogic"`, `"readOnlyLogic"`, `"validation"`, `"process"`, `"eventHandler"` | Rule category. |
| `entity` | string | Entity name | Which entity this rule applies to. |
| `decision` | string | `"Keep"`, `"Omit"`, `"Simplify"`, `"Replace"`, `"pending"` | Whether to implement this rule. |
| `description` | string | — | What the rule does. |
| `impactIfOmitted` | string | — | Business impact of not implementing. |
| `translated` | string | — | JavaScript translation of Etendo logic expression. |

## Common Patterns

### Enable draft mode for a transactional window
```json
{
  "entities": {
    "header": {
      "draftMode": { "enabled": true, "label": "Complete" },
      "fields": {
        "documentAction": { "visibility": "editable" }
      }
    }
  }
}
```

### Make a field searchable in the grid
```json
{
  "entities": {
    "header": {
      "fields": {
        "businessPartner": { "grid": true, "searchable": true }
      }
    }
  }
}
```

### Cascading dependent selector
```json
{
  "entities": {
    "header": {
      "fields": {
        "partnerAddress": {
          "reference": "BusinessPartnerLocation",
          "dependsOn": { "field": "businessPartner", "filterKey": "C_BPartner_ID" }
        }
      }
    }
  }
}
```

### Exclude an entire entity
```json
{
  "entities": {
    "legacyTab": { "exclude": true }
  }
}
```

### Custom NeoHandler for an entity
```json
{
  "entities": {
    "accounting": { "javaQualifier": "factAcctHandler" }
  }
}
```

## Key Invariants

1. **Entity keys = tabName (v2+)** — Use simplified names from raw schema's `tabName`, not table names.
2. **Field names are stable** — The raw field `name` is the decision key, unchanged across extractions.
3. **Explicit `null` = omit** — Different from absent. `"readOnlyLogic": null` removes the property from contracts.
4. **Visibility priority:** `discardPatterns` → raw extraction → `field.visibility` (human decision wins).
5. **Reference auto-derived** — FK catalog name stripped from targetTable if not explicitly set.
6. **draftMode is entity-level** — Typically on the header/primary entity only.
7. **Rules are declarative** — Metadata only; actual logic lives in Etendo AD tables.

## Pipeline Flow

```
decisions.json
    │
    ├─→ resolve-curated.js    (merges raw + decisions → curated schema)
    ├─→ generate-contract.js  (visibility, reference, inputMode, draftMode → contracts)
    ├─→ generate-frontend.js  (grid, form, section, name, dependsOn → React components)
    └─→ push-to-neo.js        (visibility → isIncluded/isReadOnly in NEO DB)
```
