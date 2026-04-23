# FormInitializationComponent — Default Value Computation by Reference Type

How Etendo's `FormInitializationComponent` (FIC) assigns default values on `MODE=NEW`, and why two mandatory columns with identical `AD_Column.DefaultValue = NULL` can end up with different outcomes: one gets a pre-selected value, the other stays empty.

The difference does **not** come from the column being mandatory, nor from callouts — it comes from **which `UIDefinition` the column's `AD_Reference` resolves to**. Combo-style UIDefinitions silently fall back to "the first row of the combo dataset" when no column default exists; search / popup / tree UIDefinitions do not.

## Case that triggered the investigation

Purchase Order window (Tab `186`), FIC call:

```
/etendo/org.openbravo.client.kernel?MODE=NEW&PARENT_ID=null&TAB_ID=186&ROW_ID=null&_action=org.openbravo.client.application.window.FormInitializationComponent
```

Observed response:

| Column           | `AD_Column.DefaultValue` | Mandatory | FIC value on NEW |
|------------------|--------------------------|-----------|------------------|
| `M_PriceList_ID` | `NULL`                   | Y         | Pre-filled       |
| `C_BPartner_ID`  | `NULL`                   | Y         | Empty            |

Both columns have no column-level default and both are mandatory. The only structural difference is the reference type.

## Column configuration (AD_Column)

```sql
SELECT c.columnname, r.name AS reference, c.defaultvalue, c.ismandatory, c.ad_callout_id
FROM ad_column c
JOIN ad_table t     ON c.ad_table_id = t.ad_table_id
JOIN ad_reference r ON c.ad_reference_id = r.ad_reference_id
WHERE t.tablename = 'C_Order'
  AND c.columnname IN ('M_PriceList_ID', 'C_BPartner_ID');
```

| Column           | Reference         | DefaultValue | Mandatory | Callout |
|------------------|-------------------|--------------|-----------|---------|
| `M_PriceList_ID` | **TableDir** (19) | NULL         | Y         | 142     |
| `C_BPartner_ID`  | **Search**   (30) | NULL         | Y         | 107     |

Callouts (142 / 107) do **not** run on the initial `NEW`; they only fire on subsequent `CHANGE` events. They are not the cause.

## The divergent code path

### 1. FIC dispatches to the column's `UIDefinition`

`modules_core/org.openbravo.client.application/src/org/openbravo/client/application/window/FormInitializationComponent.java:684`

```java
// mode == "NEW", field is active, visible and mandatory
value = uiDef.getFieldProperties(field, false);
```

`uiDef` is resolved by `UIDefinitionController.setInitCachedDefinitions` from `OBCLKER_UIDEFINITION` (table `obclker_uidefinition`), using `AD_Column.AD_Reference_Value_ID` first and falling back to `AD_Reference_ID`. This resolution is the branching point.

### 2a. Combo-style references → preselect the first row

`modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/FKComboUIDefinition.java:109-117`

```java
@Override
public String getFieldProperties(Field field, boolean getValueFromSession) {
  value = new JSONObject(super.getFieldProperties(field, getValueFromSession));
  return getValueInComboReference(field, getValueFromSession, value.getString("classicValue"));
}
```

The delegated call lands in `UIDefinition.getValueInComboReference`, which executes the combo query via `ComboTableData` and **takes row `[0]` of the result as the value**:

`modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/UIDefinition.java:712-718`

```java
if (!isListReference) {
  if (comboEntries.size() > 0) {
    if (comboEntries.get(0).has(JsonConstants.ID)) {
      fieldProps.put("value",        comboEntries.get(0).get(JsonConstants.ID));
      fieldProps.put("classicValue", comboEntries.get(0).get(JsonConstants.ID));
      fieldProps.put("identifier",   comboEntries.get(0).get(JsonConstants.IDENTIFIER));
    }
```

Same method, equivalent branch for List references: `UIDefinition.java:729-750`.

This is the core behavior: **when there is no `AD_Column.DefaultValue`, combo UIDefinitions use the first row of their filtered and ordered dataset as the default**.

The ordering is assembled in `ComboTableData`:

`src/org/openbravo/erpCommon/utility/ComboTableData.java:961-975`

```java
if (!onlyId) {
  aux = getOrderByFields();
  if (aux != null) {
    text.append("ORDER BY ");
    // ORDER BY from AD_Ref_Table.orderbyclause (Table ref)
    // or from the referenced table's identifier columns (TableDir).
  }
}
```

Plus standard Etendo filters: `isactive='Y'`, client/org visibility, and any `WHERE` from `AD_Ref_Table.whereclause` (e.g. `M_PRICELIST.ISSOPRICELIST='N'` for purchase price lists).

### 2b. Search / popup / tree references → no preselection

`modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/FKSearchUIDefinition.java:54-69`

```java
@Override
public String getFieldProperties(Field field, boolean getValueFromSession) {
  final JSONObject json = new JSONObject(super.getFieldProperties(field, getValueFromSession));
  if (json.has("value")) {
    // only enriches the identifier when a value is ALREADY present
    // (from AD_Column.DefaultValue or session context)
    final BaseOBObject target = OBDal.getInstance()
        .get(prop.getTargetEntity().getName(), json.getString("value"));
    if (target != null) {
      json.put("identifier", target.getIdentifier());
    }
  }
  return json.toString();
}
```

No call to `getValueInComboReference`, no combo query, no row-`[0]` fallback. If the column-level default is `NULL`, the value stays empty — exactly the `C_BPartner_ID` behavior.

## Which `AD_Reference`s pre-select a default, and which don't

Source of truth for the mapping: table `obclker_uidefinition` (`SELECT ad_reference_id, classname FROM obclker_uidefinition WHERE isactive='Y'`).

### Pre-select first row when `DefaultValue` is NULL (YES — trigger the behavior)

These UIDefinitions call `getValueInComboReference` (directly or through `FKComboUIDefinition`):

| `AD_Reference_ID`                  | Name             | UIDefinition class                                                 |
|------------------------------------|------------------|--------------------------------------------------------------------|
| **18**                             | Table            | `FKComboUIDefinition`                                              |
| **19**                             | TableDir         | `FKComboUIDefinition`                                              |
| **17**                             | List             | `EnumUIDefinition` (List branch of `getValueInComboReference`)     |
| `FF80818132F94B500132F9575619000A` | Button List      | `EnumUIDefinition`                                                 |

Rule of thumb: **any reference rendered as a dropdown/combo auto-selects row 0**.

Inherited references also apply: every **child reference whose parent is a base reference in this list** inherits the behavior via `UIDefinitionController.getUIDefinitionImplementation` → `reference.getParentReference()` fallback (`UIDefinitionController.java:201-204`). Practical examples: every List (17) subreference in `AD_Reference` — `AD_Menu Action`, `Document Status`, any `List`-validated field — auto-picks its first enum entry when the column has no explicit default. Same for Table (18) subreferences (the ones used by `AD_Ref_Table` definitions such as "Product - Stocked", "PriceList - Purchase", etc.).

### Do NOT pre-select (NO — stay empty without `DefaultValue`)

These UIDefinitions override `getFieldProperties` without delegating to `getValueInComboReference`:

| `AD_Reference_ID`                  | Name                         | UIDefinition class                                                   |
|------------------------------------|------------------------------|----------------------------------------------------------------------|
| **30**                             | Search                       | `FKSearchUIDefinition`                                               |
| `35`                               | PAttribute                   | `PAttributeSearchUIDefinition` (extends `FKSearchUIDefinition`)      |
| `95E2A8B50A254B2AAE6774B8C2F28120` | OBUISEL_Selector Reference   | `FKSelectorUIDefinition` (extends `FKSearchUIDefinition`)            |
| `87E6CFF8F71548AFA33F181C317970B5` | OBUISEL_Multi Selector       | `FKMultiSelectorUIDefinition`                                        |
| `80B1630792EA46F298A3FBF81E77EF9C` | OBUISEL_Selector As Link     | `FKSelectorLinkUIDefinition`                                         |
| `8C57A4A2E05F4261A1FADF47C30398AD` | Tree Reference               | `FKTreeUIDefinition`                                                 |
| `13`                               | ID                           | `IDUIDefinition`                                                     |
| `715C53D4FEA74B28B74F14AE65BC5C16` | Upload File                  | `ProcessFileUploadUIDefinition`                                      |

### Not applicable (primitive types)

Primitive-type references never produce a combo. Their default is exclusively `AD_Column.DefaultValue` (and session/preferences when relevant): String (10), Text (14), Memo (34), Date (15), DateTime (16), Time (24), Number (22), Integer (11), Amount (12), Price (800008), Quantity (29), YesNo (20), Button (28), Binary (23), Image (32), Link (800101), Color (27), RowID (26), Password (decryptable/non-decryptable), Masked String, Rich Text, Assignment (33), Search Vector, Window Reference, Non-/Transactional Sequence.

## Why `isMandatory` is not enough

In `FormInitializationComponent`, mandatory only guarantees the combo is *computed* even when the field is hidden (lines 671-686). It does not inject a value when the `UIDefinition` does not produce one. For Search / Selector / Tree, mandatory + null default = empty result.

## FIC pipeline on `MODE=NEW` — full stage order

`FormInitializationComponent.execute` runs every request (NEW, EDIT, CHANGE, SETSESSION) through the same sequential pipeline. These are the stages for `NEW`, in the exact order the code executes them — reference `FormInitializationComponent.java:238-316`.

### Stage 1 — Parent record & session variables
`setSessionVariablesInParent(mode, tab, row, parentId)` — `FormInitializationComponent.java:244`
Loads the parent record (if any) and pushes its column values into the session (`Utility.setContext`). This is what makes `@AD_Org_ID@`, `@AD_Client_ID@`, `@#User_Client@`, parent-tab columns, etc. usable in `DefaultValue` expressions of the child tab.

### Stage 2 — Current record values into the request
`setValuesInRequest(mode, tab, row, jsContent)` — `FormInitializationComponent.java:249`
Copies values from the JSON payload and session into `RequestContext`'s request parameters under `inp<ColumnName>` keys, so subsequent stages (UIDefinitions, callouts, auxiliary inputs) can read them with `vars.getStringParameter(...)`.

### Stage 3 — Validation dependency graph
`computeListOfColumnsSortedByValidationDependencies(...)` — `FormInitializationComponent.java:253`
Builds the order in which columns must be computed so that any column appearing in another column's `validation`/`displayLogic`/`readOnlyLogic` is evaluated first. Also collects `changeEventCols` (columns whose value change must trigger downstream recomputations).

### Stage 4 — Auxiliary Inputs (first pass)
`computeAuxiliaryInputs(mode, tab, allColumnsInTab, columnValues, overwrittenAuxiliaryInputs)` — `FormInitializationComponent.java:260`
Evaluates every `AD_AuxiliarInput` defined on the tab (`@SQL=...` expressions or fixed values) and pushes the result into `columnValues` and into the session. **Note:** if an auxiliary input has the same name as a column, the auxiliary input wins and the column's own default is skipped (`FormInitializationComponent.java:619-624`).

### Stage 5 — Column values via UIDefinition (the one you asked about)
`computeColumnValues(...)` — `FormInitializationComponent.java:265`
Iterates every `AD_Field` of the tab in validation-dependency order. On NEW, the decision tree per column is (`FormInitializationComponent.java:633-688`):

1. **Property field** (`AD_Field.Property` is set) → value comes from the parent record via `DalUtil.getValueFromPath(parentRecord, field.getProperty())`.
2. **Link-to-parent column** (`AD_Column.IsParent='Y'` and the parent entity matches) → value = `parentId`.
3. **`IsActive` column** → forced to `'Y'`.
4. **Everything else** → `value = uiDef.getFieldProperties(field, false)`. This is the entry point into `UIDefinition.getFieldProperties`, which internally does, in this order:
   1. Read `AD_Column.DefaultValue` (with `@...@` expansion against the session populated in stages 1-4) → if it resolves to a non-empty value, that's the result.
   2. If still empty **and** the `UIDefinition` is a combo (`FKComboUIDefinition`, `EnumUIDefinition`, or any subclass), fall back to the first row of the combo dataset — `UIDefinition.java:712-718` / `729-750`. This is the section documented above.
   3. If still empty and the `UIDefinition` is Search / Selector / Tree / ID, leave the value empty.

As a side effect, this stage also *enqueues callouts to be run*: for any field whose `UIDefinition` is Enum or ForeignKey **and** whose resolved value is not empty **and** whose column has `IsValidateOnNew='Y'`, the callout (if any) is added to `calloutsToCall` (`FormInitializationComponent.java:834-841`). This is the hook that lets "a default price list triggers the price-list callout on NEW".

### Stage 6 — Callouts
`executeCallouts(mode, tab, columnValues, changedColumn, calloutsToCall, ...)` — `FormInitializationComponent.java:271`
Runs the callouts collected in stage 5 in FIFO order, up to `MAX_CALLOUT_CALLS`. Each callout:

- Reads/writes the `columnValues` map and sets request parameters.
- May **add new callouts** to the queue (cascade) when it modifies a column whose own `AD_Column.Callout` matches the `IsValidateOnNew` rule — see `manageUpdatedValuesForCallout` at `FormInitializationComponent.java:1511`.
- May push values for columns that were *not* computed by stage 5 (e.g. filling in `C_Currency_ID` after someone else set `M_PriceList_ID`).

This is how, on the Purchase Order window, selecting the default Price List in stage 5 indirectly fills currency, payment terms, and price list version on NEW.

### Stage 7 — Auxiliary Inputs (second pass, NEW and CHANGE only)
`computeAuxiliaryInputs(...)` — `FormInitializationComponent.java:277-282`
Re-evaluated after callouts so that any auxiliary input depending on a value set by a callout (or on the "implicit combo default" from stage 5) now sees the right input. This is the reason the FIC always runs auxiliary inputs twice on NEW.

### Stage 8 — Dependent combo reloads
`subsequentComboReload(...)` — `FormInitializationComponent.java:284-287`
Only if callouts changed columns that other combos depend on (per the validation dependency graph from stage 3). Reloads those combos so their options and selected value reflect the new driving value (e.g. changing Price List reloads the Price List Version combo).

### Stage 9 — Attachments and notes
`computeAttachmentCount` / `computeNoteCount` — `FormInitializationComponent.java:291-302`
Side information for the UI; irrelevant to default-value computation.

### Stage 10 — FICExtension hooks
`for (FICExtension ficExtension : ficExtensions) ficExtension.execute(...)` — `FormInitializationComponent.java:306-309`
Third-party / module-provided hooks implementing the `FICExtension` interface. They receive the fully-computed state and can mutate it before serialization. This is the official extension point to override FIC defaults from a module without touching AD.

### Stage 11 — JSON response
`buildJSONObject(...)` — `FormInitializationComponent.java:313`
Serializes `columnValues`, `auxiliaryInputValues`, `calloutMessages`, `dynamicCols`, `attachmentExists`, `noteCount`, etc. into the payload the SPA consumes.

### Timeline diagram (NEW mode)

```
┌───────────────────────────────────────────────────────────────────────────┐
│  1. Parent record + session variables                                     │
│  2. Request parameters (inp…)                                             │
│  3. Validation dependency graph (also: changeEventCols)                   │
│  4. Auxiliary Inputs — first pass                                         │
│  5. Column values via UIDefinition ┌───────────────────────────────────┐  │
│                                    │ a. AD_Column.DefaultValue         │  │
│                                    │ b. If empty & combo UIDefinition: │  │
│                                    │    comboEntries.get(0)            │  │
│                                    │ c. If empty & non-combo: stay ""  │  │
│                                    │ (also: enqueue callouts for       │  │
│                                    │  non-empty values with            │  │
│                                    │  IsValidateOnNew='Y')             │  │
│                                    └───────────────────────────────────┘  │
│  6. Callouts (run queue, may cascade)                                     │
│  7. Auxiliary Inputs — second pass                                        │
│  8. Subsequent combo reloads for columns touched by callouts              │
│  9. Attachments / notes                                                   │
│ 10. FICExtension hooks                                                    │
│ 11. JSON response                                                         │
└───────────────────────────────────────────────────────────────────────────┘
```

### What this pipeline means for our case

For `M_PriceList_ID` (TableDir, `DefaultValue=NULL`, `IsValidateOnNew='Y'`, callout 142):

- **Stage 5** resolves it to the first row of the filtered `M_PriceList` combo (step 5.b) and enqueues callout 142 because the value is non-empty and it's a ForeignKey + `IsValidateOnNew='Y'`.
- **Stage 6** runs callout 142, which fills `C_Currency_ID`, `M_PriceList_Version_ID`, `IsTaxIncluded`, etc.
- **Stage 7** re-runs auxiliary inputs so any SQL depending on the price list now sees it.
- **Stage 8** reloads dependent combos.

For `C_BPartner_ID` (Search, `DefaultValue=NULL`, `IsValidateOnNew='Y'`, callout 107):

- **Stage 5** resolves it to empty (step 5.c). Because the resolved value is empty, the callout enqueue condition (`!classicValue.equals("")`) is **false** and callout 107 is **not** enqueued.
- **Stage 6** does nothing for this column.
- The field reaches the UI empty, and the callout only runs later, on the user's `CHANGE` when they pick a business partner.

This is why the two mandatory, defaultless columns end up so differently on NEW.

## Consequences for Schema Forge

This matters whenever we reason about "what value a form will show on NEW" without running the FIC:

1. **Empty `AD_Column.DefaultValue` does not mean "no default".** For combo-style references (TableDir, Table, List, Button List) there is an implicit default = first row of the filtered combo dataset.
2. **The implicit default is context-dependent.** It is filtered by `AD_Ref_Table.whereclause`, `isactive`, client/org visibility, and ordered by the reference/table identifier columns. The same column can resolve to different values per client/org/user.
3. **Switching a column's `AD_Reference` between combo and popup types changes NEW-form behavior** — not only the widget. Moving from TableDir to Selector (or vice versa) will change whether the field starts pre-populated.
4. **Behavioral parity between combo and search references requires an explicit `DefaultValue`** (SQL expression, auxiliary input, or preference) on the non-combo column when a value is expected on NEW.
5. **`decisions.json` visibility / required / readOnly logic does not participate in this.** The FIC assigns the value before client-side logic runs. Overriding the implicit default must happen at the FIC level (explicit `DefaultValue`, auxiliary input, or, in our own NEO Headless integration, a `NeoHandler` that clears the value on NEW).
6. **Reproducing Etendo's NEW defaults in NEO Headless** means replicating the same behavior: combo-style fields should return the "first row" of the equivalent filtered dataset; search-style fields should remain empty unless a default is explicitly configured.

## Key files — one-stop reference

| Path                                                                                                           | What lives here                                     |
|----------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| `modules_core/org.openbravo.client.application/src/org/openbravo/client/application/window/FormInitializationComponent.java:684` | Entry point — delegates to the `UIDefinition`       |
| `modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/UIDefinitionController.java:139,190-208`      | Reference → `UIDefinition` resolution (with parent-reference fallback) |
| `modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/FKComboUIDefinition.java:109` | TableDir / Table → calls `getValueInComboReference` |
| `modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/EnumUIDefinition.java:66-76`  | List / Button List → calls `getValueInComboReference` |
| `modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/UIDefinition.java:712-718`   | **The `comboEntries.get(0)` preselection (non-list branch)** |
| `modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/UIDefinition.java:729-750`   | The preselection branch for List references         |
| `src/org/openbravo/erpCommon/utility/ComboTableData.java:961-975`                                                | Builds the `ORDER BY` that decides which row is `[0]` |
| `modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/FKSearchUIDefinition.java:54-69` | Search / (parent of Selector / PAttribute) → no preselection |
| `modules_core/org.openbravo.userinterface.selector/src/org/openbravo/userinterface/selector/reference/FKSelectorUIDefinition.java:58` | Selector → no preselection (extends FKSearch)        |
| `modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/reference/FKTreeUIDefinition.java:68`   | Tree Reference → no preselection                     |
