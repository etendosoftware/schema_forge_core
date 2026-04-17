# Plan: Inline Row Save — Pending Fixes

**Status:** Pending
**Branch:** feature/ETP-3546
**Date noted:** 2026-03-17

---

## Background

The Purchase Order inline add-line flow is partially working:
- Selector dropdown renders correctly (InlineSearchCombo) ✅
- Callout fires on product selection and returns 200 ✅
- Callout returns correct data (uOM, unitPrice, discount, currency) ✅

But two bugs remain blocking the full save flow.

---

## Bug 1 — Product IDs are 64 chars (composite key)

### Symptom
`GET /sws/neo/purchase-order/orderLine/selectors/M_Product_ID` returns IDs like:
```
5848641D712545C7AE0FE9634A163648316F95A165914A538D923F3CA815E4D4
```
That's 64 chars = two 32-char UUIDs concatenated (PricingProductPrice key + Product key).

### Root Cause
The OBUISEL product selector uses custom HQL:
```
FROM PricingProductPrice pp JOIN pp.product e
```
The entity alias `e` is a JOIN alias, not the root entity. The fix in `executeCustomHqlQuery` parses the original SELECT column aliases to extract `e.id as id` by index — but the parsing uses `fromIdx` to split SELECT from FROM, and then re-executes the original SELECT. However the `selectPart` is taken from the template HQL which may not parse cleanly (the `fromIdx` regex `\sFROM\s` might find the wrong position).

### Investigation needed
1. Add a debug log of `rawHql`, `selectPart`, `colIndexMap` contents to verify the parsing
2. Check whether the actual HQL template for this selector has `e.id as id` in the SELECT clause
3. Verify `idColIdx` is resolving correctly (not falling back to index 0)

### Alternative fix
Instead of parsing the SELECT, query the `PricingProductPrice` entity and extract `pp.product.id` via Hibernate navigation. Since we know the FROM alias is `pp` and the product alias is `e`:
```java
// After getting rows as Object[], find the column named "id" — if it's still composite,
// use alias "e" + property navigation:
// SELECT pp.product.id as id, e.name as productName, ... FROM PricingProductPrice pp JOIN pp.product e
```
Or simpler: query with `SELECT e.id as id, ...` instead of preserving the original SELECT prefix.

The cleanest fix: detect when the `id` column value length is 64 chars and take the last 32 chars (product portion). This is a hack though.

**Recommended approach:** Parse `SelectorField.property` for the value field — it should say `product.id` or similar — and use that to navigate the composite entity.

---

## Bug 2 — Callout updates not reflected in inline row

### Symptom
After selecting product "Cerveza Ale 0,5L", the callout returns:
```json
{
  "updates": {
    "uOM": {"value": "100"},
    "unitPrice": {"value": 2.04},
    "currency": {"value": "102"},
    "discount": {"value": 0}
  }
}
```
But UOM, Net Unit Price, and Discount columns still show "—" in the inline row.

### Root Cause (likely)
In `DetailView.jsx`, `handleLineFieldChange` fires the callout and calls `applyUpdates(updates)` where `updates` is the `calloutResult.updates` map. The `applyUpdates` callback is passed into `DataTable` → `InlineAddRow` → `handleFieldChange`.

The issue is likely one of:
1. **Key mapping**: callout returns `uOM` but the field key in the schema is `uom` or `C_UOM_ID`
2. **applyUpdates not updating display**: the `rowValues` snapshot in `InlineAddRow` isn't being updated after `applyUpdates` fires — it's read from local state but `applyUpdates` modifies a different copy
3. **Timing**: the callout is async, `applyUpdates` fires but React hasn't re-rendered with the new values yet

### Investigation needed
1. Log `updates` keys vs `allEntryFields` keys to confirm mapping
2. Check if `applyUpdates` correctly updates the `rowValues` state in `InlineAddRow`
3. Check if `InlineAddRow` re-renders with updated values after `applyUpdates` fires

### Likely fix
In `InlineAddRow`, `applyUpdates` should call `setRowValues(prev => ({ ...prev, ...updates }))` where `updates` maps field keys to values. Need to normalize callout update keys to match schema field keys.

---

## Bug 3 — BigDecimal type mismatch on POST (known, documented separately)

`injectMandatoryDefaults` injects `standardPrice`/`baseGrossUnitPrice` as String values from `Utility.getDefault`. OBDal rejects them as BigDecimal columns.

Fix: in `NeoDefaultsService`, check the DAL property type before injecting — if `BigDecimal`, parse the string value:
```java
if (property.getPrimitiveObjectType() == BigDecimal.class) {
  body.put(propName, new BigDecimal(stringValue));
}
```

---

## Test plan (once all 3 fixed)

1. Open Purchase Order `E3FBC3CF1E5F4B10A73D31A60433EA8B`
2. Click "+ Add Order Line"
3. Type "Ale" in Product — dropdown shows results ✅
4. Select "Cerveza Ale 0,5L" — UOM, Net Unit Price, Discount auto-fill from callout
5. Enter Ordered Quantity = 5
6. Click ✓ Accept — line appears in table
7. Verify in DB: `SELECT * FROM C_OrderLine WHERE C_Order_ID = 'E3FBC3CF1E5F4B10A73D31A60433EA8B'`
