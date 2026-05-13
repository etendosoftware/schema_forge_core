# Feedback — Known Issues and Lessons Learned

This file records bugs that were fixed and the root-cause patterns behind them. Entries here
are meant to prevent future regressions. For open gaps or UX ambiguities, see individual window
docs in `docs/generated-custom-windows/`.

---

## ETP-3662 — Line gross amount handling (2026-04-29)

### Bug: double discount on order line PATCH via sidebar

**Symptom:** Editing a line on a purchase order (or any order) via the sidebar produced a
`lineGrossAmount` that was discounted twice. For example: listPrice=100, discount=10%, qty=1,
tax=21% → expected gross = 108.90, actual gross ≈ 98.01.

**Root cause:** `NeoDefaultsService.injectLineGrossAmountIfMissing` had the formula:

```java
// WRONG — unitPrice is already post-discount
double baseNetAmt = unitPrice * qty * (1 - discount / 100);
```

`unitPrice` (column `PriceActual`) is always `PriceList × (1 − discount/100)`. Applying
`discountFactor` again doubled it.

**Fix (ETP-3662, 2026-04-29):** Remove the discount factor and respect the client value:

```java
// Trust the client when it already computed the correct value
double clientValue = body.optDouble("lineGrossAmount", 0);
if (clientValue != 0) return; // client is the source of truth

// CORRECT fallback: unitPrice is already post-discount
double baseNetAmt = unitPrice > 0 ? unitPrice * qty : 0;
```

**Regression (ETP-3881, 2026-04-29):** The ETP-3881 refactor extracted this code into
`NeoCommercialLinePolicy` but accidentally copied an older version of the method — one that
still had the double-discount formula AND dropped the client guard. Both CREATE and PATCH
paths were broken after this refactor.

**Re-fix (ETP-3662, 2026-05-06):** Applied the same two corrections to
`NeoCommercialLinePolicy.injectLineGrossAmountIfMissing`.

**Invariant to remember:** `unitPrice` (PriceActual) is ALWAYS post-discount. Never apply
`(1 − discount/100)` to `unitPrice` in server-side formulas. When refactoring this method,
always carry both the formula fix AND the client guard.

---

### Bug: product selector price overwritten by callout (sales-invoice, purchase-invoice)

**Symptom:** After selecting a product on an invoice line (add-line row or sidebar), the
displayed price reverted to the product's standard price (often its purchase price, e.g. 33)
instead of the price from the invoice's price list (e.g. 44).

**Root cause:** `NeoSelectorService.enrichProductSelectorWithPrices` populated only the
display-side `standardPrice` / `listPrice` fields on the selector result item, but did NOT
update `_aux._PSTD` and `_aux._PLIST`. Those `_aux` entries are what Classic callouts
(`SL_Invoice_Product`, `SL_Order_Product`) actually read via `inpmProductId_PSTD` /
`inpmProductId_PLIST`. With stale (or absent) `_aux` values, `SL_Invoice_Product` fell back
to entity DAL properties (purchase/default price) and returned the wrong price in its response.

**Fix:** `NeoSelectorService.enrichProductSelectorWithPrices` now also writes to `_aux`:

```java
JSONObject aux = item.optJSONObject("_aux");
if (aux == null) { aux = new JSONObject(); item.put("_aux", aux); }
aux.put("_PSTD",  String.valueOf(cols[1]));
aux.put("_PLIST", String.valueOf(cols[2]));
```

With correct `_aux` values the callout already returns the right `standardPrice`. Guard 1
(`standardPrice → listPrice` when `listPrice` is null or 0) now applies universally for all
configs (orders and invoices). The previous Guard 2 that deleted `result.listPrice` for invoice
configs was removed as redundant.

**Invariant to remember:** When enriching a product selector result, ALWAYS keep `_aux._PSTD`
and `_aux._PLIST` in sync with the display-side `standardPrice` and `listPrice`. Classic
callouts read exclusively from `_aux`, not from the top-level item fields.

---

### Bug: sidebar line gross amount showing excessive decimal places

**Symptom:** Clicking a line row in the invoice (sales or purchase) sidebar showed `grossAmount`
as `111.4047` instead of `111.40`.

**Root cause:** `DetailView.jsx`'s `onRowClick` called `setSelectedLine(row)` directly with the
raw server value. `roundAmounts` was only applied to callout results (live edits) but not to
the initial row that populates the sidebar form.

**Fix:** `onRowClick` now copies the row and applies `roundAmounts` before `setSelectedLine`:

```javascript
onRowClick={DetailForm ? (row) => {
  const line = { ...row };
  roundAmounts(line);
  setSelectedLine(line);
} : undefined}
```

**Invariant to remember:** Any path that feeds a row into the sidebar form must pass through
`roundAmounts`. Live callout results already do; initial row-open does not, so it must be
handled explicitly at the `onRowClick` site.

---

### Bug: discount not reset to 0 when changing product on invoice lines

**Symptom:** After selecting a different product on an existing invoice line that had a discount,
the old discount value was preserved instead of being reset to 0.

**Root cause:** The discount reset (`result.discount = 0`) only targeted the `'discount'` field
(orders config). Invoice lines use `etgoDiscount`, which was not reset. Additionally, the field
had to be added to `forceFields` to bypass the touched-guard that would otherwise skip the
update if the user had previously edited the discount field.

**Fix:** Reset and force-update via `lineConfig.discountField` (which resolves to `'discount'`
for orders/quotations and `'etgoDiscount'` for invoices):

```javascript
if (field === 'product' && lineConfig.discountField) {
  result[lineConfig.discountField] = 0;
}
if (field === 'product' && lineConfig.discountField) forceFields.add(lineConfig.discountField);
```

**Invariant to remember:** Whenever a callout result must update a field that the user may
have previously touched, add it to `forceFields` before calling `applyUpdates`. The touched-guard
silently skips non-forced fields.

---

### Bug: net unit price was read-only in purchase-invoice and purchase-order add-line row

**Symptom:** The net unit price column in the add-line row rendered as static text instead of
an editable input on purchase invoice and purchase order.

**Root cause:**
- `InvoiceLineTableCustom.jsx` declared `key: 'unitPrice'` for the price column.
- `purchase-order/index.jsx` `LINES_COLUMNS` declared `key: 'unitPrice'`.
- The generated `addLineFields.entry` in both windows declares `key: 'listPrice'`.
- `DetailView.jsx` builds a `fieldMap` keyed by `addLineFields.entry[n].key`. When the
  column key did not match the entry key, the `fieldMap` lookup failed and the cell fell
  back to static text rendering.

**Fix:** Changed both to `key: 'listPrice', column: 'PriceList'`.

**Invariant to remember:** The `key` in a custom `LINES_COLUMNS` or lines-table column
definition MUST match the `key` in the corresponding `addLineFields.entry` definition in the
generated `HeaderPage.jsx`. These two sides share the same `fieldMap` lookup in `DetailView.jsx`.

---

## ETP-3662 — Total discount (2026-05-06)

### Bug: LazyInitializationException on Complete action for reactivated orders

**Symptom:** HTTP 500 with `org.hibernate.LazyInitializationException: could not initialize proxy [ADTab#186] - no Session` when completing an order that had previously been reactivated (RE → CO).

**Root cause:** `TotalDiscountService.deleteExistingDiscountLine()` called `OBDal.getInstance().getSession().clear()` after the JDBC DELETE. This evicted ALL Hibernate L1 entities from the session, including `ADTab#186` which `NeoButtonActionHelper.addTabParams()` still held a reference to. When that helper subsequently tried to initialize the proxy (already evicted), Hibernate threw.

**Fix:** Removed `session.clear()` entirely. All reads in `TotalDiscountService` use raw JDBC, so L1 eviction was never needed. The JDBC DELETE operates outside the Hibernate identity map and does not require a session flush or clear.

**Invariant to remember:** `OBDal.getInstance().getSession().clear()` is nuclear — it evicts the entire L1 cache for the current thread. Never call it from a utility or service that may run in the middle of a larger request chain (e.g., inside a `NeoHandler` pre-hook). If post-delete reads must bypass the L1 cache, use JDBC directly; if Hibernate entities must be reloaded, use `OBDal.getInstance().getSession().refresh(entity)` on a specific instance, not a blanket clear.

---

### Bug: total discount line not created on sales quotation confirm (DR → UE)

**Symptom:** Completing a sales quotation through the `SendToEvaluationModal` (DR → UE path) did not create the `ETGO_DTO` total discount line, even when `etgoTotalDiscount > 0`.

**Root cause:** `SendToEvaluationModal` sends `POST /action/DocAction { fieldValues: {} }` — using the `DocAction` process-button endpoint, not the `documentAction` field endpoint. `AbstractOrderHeaderHandler.applyTotalDiscountBeforeComplete()` only checked for `context.getFieldName() === "documentAction"`, so the `DocAction` request was silently ignored.

**Fix:** Added `AbstractOrderHeaderHandler.syncTotalDiscountOnDocAction()` — a dedicated static helper that intercepts `DocAction` requests unconditionally and calls `TotalDiscountService.recalculate()`. It is called explicitly from `SalesQuotationHeaderHandler.handle()` alongside `applyTotalDiscountBeforeComplete()`. It is intentionally NOT added to the shared utility called by order/invoice handlers, because those documents do not use the `DocAction` button path.

**Invariant to remember:** There are two distinct Complete paths in Etendo Go: (1) `documentAction=CO` via CRUD PATCH or `/action/documentAction` — handled by `applyTotalDiscountBeforeComplete()`; (2) process buttons (`DocAction`, `DocAction_Purchase`, etc.) via `/action/<buttonName>` — each handler that uses a process button must explicitly call `syncTotalDiscountOnDocAction()` (or its equivalent) in its own `handle()`. Never add DocAction interception to the shared utility unless all document types that use the shared utility genuinely fire that button.
