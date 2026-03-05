# DisplayLogic Variable Types in Etendo

DisplayLogic expressions use `@variable@` syntax. Variables resolve from 6 different sources, evaluated in this order by `DynamicExpressionParser`.

## Resolution Order

1. **Process Parameter** (only in process parameter display logic)
2. **Tab Field Column** — column exists in the tab's table
3. **Auxiliary Input** — defined in `AD_AuxiliarInput` for the tab
4. **Session Context Variable** — all remaining tokens

## Variable Types

### 1. Field Columns

Direct database columns from the current tab's table.

| Example | Table | JS Reference |
|---------|-------|-------------|
| `@Processed@` | C_Order.Processed | `currentValues.processed` |
| `@DocStatus@` | C_Order.DocStatus | `currentValues.documentStatus` |
| `@DeliveryViaRule@` | C_Order.DeliveryViaRule | `currentValues.deliveryTerms` |

### 2. Auxiliary Inputs (`AD_AuxiliarInput`)

Computed values defined per-tab via SQL or constants. Stored in `AD_AuxiliarInput` with a `validation_code` that is typically `@SQL=SELECT ...`.

| Example | SQL Source | JS Reference |
|---------|-----------|-------------|
| `@OrderType@` | `SELECT DOCSUBTYPESO FROM C_DOCTYPE WHERE C_DOCTYPE_ID = @C_DOCTYPETARGET_ID@` | `context.ORDERTYPE` |
| `@GROSSPRICE@` | `SELECT istaxincluded FROM m_pricelist WHERE m_pricelist_id = @M_PRICELIST_ID@` | `context.GROSSPRICE` |
| `@HASSECONDUOM@` | `SELECT CASE COUNT(*) WHEN 0 THEN 0 ELSE 1 END FROM M_PRODUCT_UOM ...` | `context.HASSECONDUOM` |
| `@IsStocked@` | `SELECT IsStocked FROM M_PRODUCT WHERE M_PRODUCT_ID = @M_PRODUCT_ID@` | `context.IsStocked` |
| `@showAddPayment@` | Complex SQL checking payment schedule totals | `context.showAddPayment` |
| `@PromotionsDefined@` | `SELECT CASE WHEN count(*) = 0 THEN 'N' ELSE 'Y' END FROM m_offer ...` | `context.PromotionsDefined` |

Computed by `FormInitializationComponent.computeAuxiliaryInput()`:
1. Extracts validation code
2. If starts with `@SQL=`, parses SQL and substitutes parameters
3. Executes SQL, returns first column
4. Stores as `inpAUXILIARYINPUTNAME` in request context

### 3. Session Context Variables (unprefixed)

Variables from the user's session context (preferences, org context). Resolved via `Utility.getContext()`.

| Example | Description |
|---------|-------------|
| `@StockReservations@` | Warehouse/inventory context |
| `@EnableCanceAndReplace@` | Feature flag or configuration |
| `@FinancialManagement@` | User preference for accounting |

JS reference: `context.VariableName`

### 4. Session Preferences (`#` prefix)

User-specific or system-level preferences. The `#` is stripped before lookup, converted to `_` in JS.

| Example | Description | JS Reference |
|---------|-------------|-------------|
| `@#ShowAcct@` | Show accounting dimensions | `context._ShowAcct` |
| `@#AD_Role_ID@` | Current user role | `context._AD_Role_ID` |

### 5. Accounting Dimension Variables (`$` prefix)

Dynamic variables for accounting dimension elements. Pattern: `@$Element_XX@`.

| Example | Dimension |
|---------|-----------|
| `@$Element_AS@` | Asset |
| `@$Element_AY@` | Activity |
| `@$Element_MC@` | Sales Campaign |
| `@$Element_OT@` | Trx Organization |

Handled by `DimensionDisplayUtility`. Boolean flags (Y/N) indicating dimension availability.

### 6. Special: `@ACCT_DIMENSION_DISPLAY@`

Replaced server-side by `DimensionDisplayUtility.computeAccountingDimensionDisplayLogic()` with complex logic checking which dimensions are applicable. Not a simple variable — it's a computed expression.

## Key Code Locations

- **Variable Resolution:** `DynamicExpressionParser.java` (lines 374-466)
- **Auxiliary Input Computation:** `FormInitializationComponent.java` → `computeAuxiliaryInput()`
- **Session Attribute Loading:** `FormInitializationComponent.java` → `setSessionAttributesFromParserResult()`
- **Accounting Dimensions:** `DimensionDisplayUtility.java`

## Extractor Query: Auxiliary Inputs for a Window

```sql
SELECT ai.Name, ai.Code AS validation_code, t.Name AS tab_name
FROM AD_AuxiliarInput ai
JOIN AD_Tab t ON ai.AD_Tab_ID = t.AD_Tab_ID
WHERE t.AD_Window_ID = ?
ORDER BY t.SeqNo, ai.Name;
```
