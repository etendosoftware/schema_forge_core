# schema-raw.json Reference

Expected shape of the schema produced by `extract-fields.js` (`buildSchema()`).
This is what `validate-schema.js` validates at levels L1-L4.

## Top-level

```json
{
  "version": "0.1.0",               // REQUIRED — SemVer string
  "window": { ... },                 // REQUIRED — window metadata
  "entities": [ ... ],               // REQUIRED — array of entities
  "meta": {                          // metadata (informational)
    "version": "0.1.0",
    "checksum": "sha256:...",
    "extractedAt": "2026-03-12T..."
  }
}
```

## window

```json
{
  "id": "143",                       // REQUIRED — AD_Window_ID (string)
  "name": "Sales Order",             // REQUIRED — window display name
  "primaryEntity": "cOrder",         // REQUIRED — name of the level=header entity
  "category": "sales"                // REQUIRED — one of: sales, purchasing, inventory,
                                     //   finance, accounting, general, manufacturing,
                                     //   project, service, hr, master
}
```

## entity

```json
{
  "name": "cOrder",                  // REQUIRED — camelCase entity name (from tableName)
  "tableName": "C_Order",            // AD table name
  "entityClassname": "Order",        // OBDal entity class name
  "entityJavaPackage": "org.openbravo.model.common.order",
  "entityFullClass": "org.openbravo.model.common.order.Order",
  "tabName": "Header",              // AD tab display name
  "level": "header",                // REQUIRED — "header" | "line" | "subline"
  "sequence": "10",                 // tab sequence
  "parentEntity": "cOrder",         // for line/subline — name of parent entity
  "parentField": "cOrderId",        // FK field linking to parent
  "whereClause": "...",             // optional tab filter clauses
  "orderByClause": "...",
  "filterClause": "...",
  "hqlWhereClause": "...",
  "hqlOrderByClause": "...",
  "hqlFilterClause": "...",
  "fields": [ ... ]                 // REQUIRED — array of fields
}
```

### Level mapping (from AD_Tab.TabLevel)

| AD TabLevel | Schema level |
|-------------|-------------|
| 0           | `"header"`  |
| 1           | `"line"`    |
| 2+          | `"subline"` |

## field

```json
{
  "name": "businessPartnerId",      // REQUIRED — camelCase (from columnName)
  "columnName": "C_BPartner_ID",    // original AD column name
  "label": "Business Partner",      // display label
  "type": "foreignKey",             // REQUIRED — see valid types below
  "mandatory": true,                // is column mandatory
  "visibility": "editable",         // REQUIRED — "editable" | "readOnly" | "system" | "discarded"
  "maxLength": "22",                // from AD_Column.FieldLength
  "valueMin": null,                 // from AD_Column.ValueMin
  "valueMax": null,                 // from AD_Column.ValueMax

  // System fields only:
  "systemCategory": "internal",     // "internal" | "audit" | "accounting" | "sequence"
  "derivation": {                   // how the value is derived
    "type": "fromConfig",           // "fromConfig" | "fromParent" | "fromField" |
                                    //   "lookup" | "computed" | "sequence"
    "source": "context.organization"
  },

  // FK fields only:
  "reference": {                    // REQUIRED for type=foreignKey
    "type": "TableDir",             // "TableDir" | "Table" | "Search" | "Selector"
    "targetTable": "C_BPartner",
    "keyColumn": "C_BPartner_ID",
    "displayColumn": "Name",
    "filterExpression": null,
    "orderBy": null
  },

  // Logic expressions (omitted if null):
  "displayLogic": "@IsSOTrx@='Y'",
  "displayLogicServer": null,
  "displayLogicGrid": null,
  "readOnlyLogic": "@Processed@='Y'",

  // Callout (omitted if null):
  "callout": "org.openbravo.erpCommon.ad_callouts.SL_Order_BPartner",
  "onChangeFunction": null,

  // UI hints:
  "defaultValue": "@#AD_Org_ID@",
  "isIdentifier": true,
  "isSelectionColumn": true,
  "isFilterable": true,
  "precision": 2,
  "isTranslated": false,
  "help": "The Business Partner...",
  "fieldGroup": "General",

  // Validation (omitted if no rule):
  "validationRule": {
    "code": "C_BPartner.IsActive='Y'",
    "contextParams": ["AD_Client_ID"],
    "cascadeParams": ["AD_Org_ID"]
  }
}
```

## Valid types

From `validate-schema.js`:

| Type | AD_Reference examples |
|------|----------------------|
| `string` | String (10), Memo (34) |
| `integer` | Integer (11) |
| `decimal` | Number (22) |
| `boolean` | Yes-No (20) |
| `date` | Date (15) |
| `dateTime` | DateTime (16) |
| `id` | ID (13) |
| `foreignKey` | TableDir (19), Table (18), Search (30), Selector |
| `enum` | List (17) |
| `text` | Text (14), CLOB (23) |
| `binary` | Binary (24) |
| `image` | Image (32) |
| `button` | Button (28) |
| `amount` | Amount (12) |
| `quantity` | Quantity (29) |
| `price` | CostPrice, Prices |
| `number` | General Number |

## Valid categories

`sales`, `purchasing`, `inventory`, `finance`, `accounting`, `general`, `manufacturing`, `project`, `service`, `hr`, `master`

## Valid visibility

`editable`, `readOnly`, `system`, `discarded`

## Valid entity levels

`header`, `line`, `subline`

## Validation levels

| Level | What it checks | Stops pipeline? |
|-------|---------------|-----------------|
| L1 - Structural | Required fields, valid enums, duplicates | Yes |
| L2 - Semantic | Cross-references (primaryEntity, parentEntity, FK refs) | Yes |
| L3 - Visibility | System field rules, UI property constraints | Yes |
| L4 - Cross-reference | Derivation sources, searchable type compat | Warnings only |
