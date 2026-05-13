# Line Pricing Model — Orders, Quotations and Invoices

Reference guide for the client-side line amount calculation introduced in ETP-3662
and extended with invoice discount support in ETP-3662 (continued).

---

## Context

Before ETP-3662 every field change (qty, price, discount) fired a server callout.
Classic (`SL_Order_Amt`, `SL_Invoice_Amt`) computed `lineNetAmount` and `lineGrossAmount`
server-side. `NeoDefaultsService.injectLineGrossAmountIfMissing` also unconditionally
recomputed the gross amount before persisting, acting as a safety net.

After ETP-3662 **the frontend is the source of truth** for line amounts.
The server-side injection respects whatever the client sends.

---

## Field roles (order / quotation)

| Form key | Classic column | Visible | Editable | Source |
|---|---|---|---|---|
| `listPrice` | `pricelist` | Yes (grid + form) | Yes | Product selector → `standardPrice` mapping |
| `unitPrice` | `priceactual` | No | No | Computed at POST/PATCH = `listPrice × (1−discount/100)` |
| `discount` | `discount` | Yes (grid + form) | Yes | User; reset to 0 on product change |
| `orderedQuantity` | `qtyordered` | Yes | Yes | User |
| `tax` | `c_tax_id` | Yes | Yes (selector) | Product callout; reset discount→0 does not affect tax |
| `lineGrossAmount` | `linegrossamt` | Yes (grid + form) | No | Client-side real-time |

## Field roles (invoice — sales and purchase)

| Form key | Classic column | Visible | Editable | Source |
|---|---|---|---|---|
| `listPrice` | `pricelist` | Yes (grid + form) | Yes | Product selector (from document's price list) |
| `unitPrice` | `priceactual` | No | No | Computed at POST/PATCH = `listPrice × (1−etgoDiscount/100)` |
| `etgoDiscount` | `em_etgo_discount` | Yes (grid + form) | Yes | User; reset to 0 on product change |
| `invoicedQuantity` | `qtyinvoiced` | Yes | Yes | User |
| `tax` | `c_tax_id` | Yes | Yes (selector) | Product callout |
| `grossAmount` | `line_gross_amount` | Yes (grid + form) | No | Client-side real-time |

`EM_Etgo_Discount` is an extension column added by `com.etendoerp.go` to `C_InvoiceLine`
(AD reference 22 — Number/decimal). Both sales and purchase invoice windows expose it.

Column order in grid and form (both invoice windows):
**Producto → Descripción → Cant. facturada → Precio tarifa → % Descuento → Impuesto → Importe bruto de línea**

---

## What fires a callout vs what is client-side

### Orders / quotations

```
product   → callout SL_Order_Product
            sets: listPrice (via standardPrice mapping), unitPrice, tax, uOM,
                  grossUnitPrice  (all via forceCalloutFields)
            resets: discount → 0 (applied in DetailView after callout)

tax       → callout
            purpose: get taxRate back in the response (cached in taxRateCacheRef)
            sets: lineGrossAmount via useLineGrossAmount hook after callout

listPrice       → CLIENT-SIDE ONLY  (no callout)
orderedQuantity → CLIENT-SIDE ONLY
discount        → CLIENT-SIDE ONLY
```

### Invoices

```
product   → callout SL_Invoice_Product
            sets: tax, uOM  (via forceCalloutFields)
            listPrice: callout value replaced by standardPrice if callout zeroed it
                       (same Guard 1 as orders — see below)
            resets: etgoDiscount → 0 (applied in DetailView after callout)

tax       → callout
            purpose: get taxRate back (cached in taxRateCacheRef)
            sets: grossAmount via useLineGrossAmount hook after callout

listPrice        → CLIENT-SIDE ONLY  (no callout)
invoicedQuantity → CLIENT-SIDE ONLY
etgoDiscount     → CLIENT-SIDE ONLY
```

Client-side guard in `DetailView.jsx` (driven by `lineConfig`):

```javascript
const clientSideFieldList = [lineConfig.qtyField, lineConfig.priceField, lineConfig.discountField].filter(Boolean);
// orders:   ['orderedQuantity',  'listPrice', 'discount']
// invoices: ['invoicedQuantity', 'listPrice', 'etgoDiscount']

const CLIENT_SIDE_FIELDS = new Set(clientSideFieldList);
if (CLIENT_SIDE_FIELDS.has(field)) {
  const result = {};
  computeLineGrossAmount(field, value, result, rowValues);
  applyUpdates?.(result, new Set());
  return;  // never reaches the callout fetch
}
```

---

## Core formula

### Orders / quotations
```
lineNet         = orderedQuantity × listPrice × (1 − discount/100)
lineGrossAmount = lineNet × taxFactor
```

### Invoices
```
lineNet     = invoicedQuantity × listPrice × (1 − etgoDiscount/100)
grossAmount = lineNet × taxFactor
```

`taxFactor` is resolved by `resolveTaxFactor()` from these sources in order:

| Priority | Source | When available |
|---|---|---|
| 0 | `calloutResult.taxRate` injected by backend | After product or tax callout |
| 1 | `rowValues['tax_rate']` from selector aux data | When tax selected via UI |
| 2 | `taxRateCacheRef.current[taxId]` | After any prior callout for the same tax |
| 3 | `rowValues.grossField / rowValues.lineNetAmount` | Saved line reopened for edit |
| 4 | Same ratio from a sibling line with the same taxId | Other lines exist in the document |

`resolveTaxFactor` and `deriveLineNet` both accept a `discountField` parameter
(defaulting to `'discount'`). `computeLineGrossAmount` passes `config.discountField`
so the correct field is used for each window type.

---

## standardPrice → listPrice mapping (ALL configs — unified)

Classic callouts (`SL_Order_Product`, `SL_Invoice_Product`) return the catalog price
as `standardPrice` (PriceStd column) and often zero out `listPrice` (PriceList column).

Guard in `DetailView.jsx` — applies universally after `normalizeCalloutResponse`:

```javascript
if (field === 'product'
    && result.standardPrice != null
    && (result.listPrice == null || Number(result.listPrice) === 0)) {
  result.listPrice = result.standardPrice;
}
```

This unified guard replaces the previous split behavior (ORDER-only mapping + invoice
`delete result.listPrice`). It works correctly for both configs because
`NeoSelectorService.enrichProductSelectorWithPrices` now also updates `_aux._PSTD/_PLIST`
with the correct price-list prices before the callout fires (see NeoSelectorService fix below).

### Why the old invoice Guard 2 was removed

Previously, the invoice config deleted `result.listPrice` from the callout response
to prevent the wrong price (product defaults) from overwriting the selector's correct
price-list price. The root cause was that `_aux._PSTD` / `_aux._PLIST` — the aux values
read by `SL_Invoice_Product` — were populated from entity DAL properties (purchase price)
rather than the document's price list.

Fix: `NeoSelectorService.enrichProductSelectorWithPrices` now also writes to `_aux`:

```java
aux.put("_PSTD", String.valueOf(cols[1]));  // price-list standardPrice
aux.put("_PLIST", String.valueOf(cols[2])); // price-list listPrice
```

With this fix, `SL_Invoice_Product` reads the correct price from `inpmProductId_PSTD`,
and `standardPrice` in the callout response already carries the price-list price.
The unified Guard 1 then applies it to `listPrice` exactly as for orders.

---

## Discount reset on product change

When `field === 'product'`, `DetailView.jsx` always resets the discount to 0 and forces
the update past the touched-guard:

```javascript
// After callout normalization, before applyUpdates:
if (field === 'product' && lineConfig.discountField) {
  result[lineConfig.discountField] = 0;
}

// Force-update discount even if user had previously touched the field:
if (field === 'product' && lineConfig.discountField) forceFields.add(lineConfig.discountField);
```

---

## At POST / PATCH time

`computeUnitPriceForPost(lineData, config)` runs before the request is sent:

```javascript
// Both order AND invoice configs: derive PriceActual from listPrice and discount
// order:   discountField = 'discount'
// invoice: discountField = 'etgoDiscount'
const discount = parseFloat(lineData[config.discountField] ?? 0) || 0;
unitPrice = listPrice × (1 − discount/100)
```

The early-return for `config.priceField === 'unitPrice'` only fires for hypothetical
configs where unitPrice is the editable field. Both order and invoice use `listPrice`
as `priceField`, so both go through this computation.

`lineGrossAmount` / `grossAmount` (already in the body from client-side computation)
takes priority over the server fallback — see `NeoDefaultsService`.

---

## `LINE_CONFIGS` — per-window configuration

```javascript
LINE_CONFIGS = {
  order:   { qtyField: 'orderedQuantity',  grossField: 'lineGrossAmount', priceField: 'listPrice', discountField: 'discount'      },
  invoice: { qtyField: 'invoicedQuantity', grossField: 'grossAmount',     priceField: 'listPrice', discountField: 'etgoDiscount'  },
}
```

Key differences:

| Property | `order` | `invoice` |
|---|---|---|
| `qtyField` | `orderedQuantity` | `invoicedQuantity` |
| `priceField` | `listPrice` | `listPrice` |
| `discountField` | `'discount'` | `'etgoDiscount'` |
| `grossField` | `lineGrossAmount` | `grossAmount` |

Pass the matching config when instantiating the hook:

```javascript
// orders and quotations (default)
const { computeLineGrossAmount, prepareLineForPost } =
  useLineGrossAmount(taxRateCacheRef, hook.children);

// invoices
const { computeLineGrossAmount, prepareLineForPost } =
  useLineGrossAmount(taxRateCacheRef, hook.children, INVOICE_LINE_CONFIG);
```

---

## Backend changes

### `NeoSelectorService.enrichProductSelectorWithPrices`

When a product selector result is enriched with price-list prices, the service now
also updates `_aux._PSTD` and `_aux._PLIST` — the aux fields read by Classic callouts
(`SL_Invoice_Product`, `SL_Order_Product`) via `inpmProductId_PSTD` / `inpmProductId_PLIST`:

```java
item.put("standardPrice", cols[1]);
item.put("listPrice",     cols[2]);
JSONObject aux = item.optJSONObject("_aux");
if (aux == null) { aux = new JSONObject(); item.put("_aux", aux); }
aux.put("_PSTD",  String.valueOf(cols[1]));
aux.put("_PLIST", String.valueOf(cols[2]));
```

Without this fix, `SL_Invoice_Product` received the purchase/default price from entity
DAL properties instead of the invoice's price list price. With it, the callout always
returns the correct price-list `standardPrice`, which the unified Guard 1 copies to
`listPrice`.

### `NeoCommercialLinePolicy.injectLineGrossAmountIfMissing` (order lines)

Early-returns when the client sends a non-zero `lineGrossAmount`. Fallback formula:

```java
// unitPrice is always post-discount; never apply discountFactor again
double baseNetAmt = unitPrice > 0 ? unitPrice * qty : 0;
```

> **Note:** originally in `NeoDefaultsService`; moved to `NeoCommercialLinePolicy` by ETP-3881.

### `injectGrossAmountIfMissing` (invoice lines)

Respects a non-zero `grossAmount` from the client. Fallback computes
`invoicedQuantity × unitPrice`. `unitPrice` arriving from the client is already
`listPrice × (1 − etgoDiscount/100)` (computed by `computeUnitPriceForPost`).

```
TODO ETP-3662: once all windows have migrated to client-side computation,
remove injectLineGrossAmountIfMissing and injectGrossAmountIfMissing.
```

---

## Sidebar display — decimal rounding

Amount fields (`grossAmount`, `lineGrossAmount`, `lineNetAmount`) received from the
server may have more than 2 decimal places (e.g. `111.4047`). When a line row is
clicked to open the sidebar, `DetailView.jsx` applies `roundAmounts` before setting
`selectedLine` state:

```javascript
onRowClick={DetailForm ? (row) => {
  const line = { ...row };
  roundAmounts(line);   // rounds grossAmount/lineGrossAmount/lineNetAmount to 2dp
  setSelectedLine(line);
} : undefined}
```

Callout results already go through `roundAmounts` before `applyUpdates`, so
live edits within the sidebar are always 2dp. This fix covers the initial open.

---

## Files touched (ETP-3662 — complete)

| File | Change |
|---|---|
| `tools/app-shell/src/hooks/useLineGrossAmount.js` | `INVOICE_LINE_CONFIG.discountField = 'etgoDiscount'`; `resolveTaxFactor`, `deriveLineNet`, `computeLineGrossAmount`, `computeUnitPriceForPost` all parameterized on `discountField` |
| `tools/app-shell/src/components/contract-ui/DetailView.jsx` | Guard 1 unified for all configs; Guard 2 removed; cascade (Guard 3) removed; discount reset to 0 on product change; `roundAmounts` on sidebar row click |
| `modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoSelectorService.java` | `enrichProductSelectorWithPrices` now updates `_aux._PSTD/_PLIST` |
| `modules/com.etendoerp.go/src-db/database/sourcedata/AD_COLUMN.xml` | `EM_Etgo_Discount` column, `AD_REFERENCE_ID=22` (Number) |
| `modules/com.etendoerp.go/src-db/database/sourcedata/AD_ELEMENT.xml` | AD element for `EM_Etgo_Discount` |
| `modules/com.etendoerp.go/src-db/database/sourcedata/AD_FIELD.xml` | Tab fields for sales-invoice lines (tab 270) and purchase-invoice lines (tab 291) |
| `modules/com.etendoerp.go/src-db/database/model/modifiedTables/C_INVOICELINE.xml` | DB model: `EM_ETGO_DISCOUNT DECIMAL` |
| `artifacts/sales-invoice/decisions.json` | `etgoDiscount` editable, gridOrder sequence, `readOnlyLogic: @Processed@='Y'` |
| `artifacts/purchase-invoice/decisions.json` | Same as sales-invoice |
| `artifacts/sales-invoice/contract.json` | Regenerated |
| `artifacts/purchase-invoice/contract.json` | Regenerated |
| `artifacts/sales-invoice/generated/web/sales-invoice/` | Regenerated |
| `artifacts/purchase-invoice/generated/web/purchase-invoice/` | Regenerated |
| `artifacts/purchase-invoice/decisions.json` | Added `lineEntityConfig: "invoice"` (from ETP-3662 phase 1) |
| `modules/com.etendoerp.go/.../NeoDefaultsService.java` | Removed double-discount from `injectLineGrossAmountIfMissing`; respects client value (from ETP-3662 phase 1) |
