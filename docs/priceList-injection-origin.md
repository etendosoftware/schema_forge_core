# `priceList` Injection in `selectorContextByEntity` — Origin Report

Background note for deciding whether to remove the `priceList` field that `DetailView` injects into the `detailEntity` selector context.

## What the code does today

In `tools/app-shell/src/components/contract-ui/DetailView.jsx` (lines ~150-190):

```js
const priceListId = (hook.editing || hook.selected)?.priceList ?? null;
// ...
if (detailEntity) {
  next[detailEntity] = {
    parentId: parentRecordId,
    ...(isSOTrx ? { isSOTrx } : {}),
    ...(priceListId ? { priceList: priceListId } : {}),   // ← this field
  };
}
```

The `priceList` entry ends up in the URL of every line-level selector call (`product`, `tax`). Example:
```
/sws/neo/sales-order/lines/selectors/product?priceList=<id>&parentId=<order-id>&isSOTrx=Y
```

## Commit that introduced it

**`466e2e4` — Feature ETP-3661: Inject isSOTrx context and fetch tax rate from DAL in DetailView**
- Author: Irina Urricelqui
- Date: 2026-04-13
- Files touched: `tools/app-shell/src/components/contract-ui/DetailView.jsx` (+60 / -8)

Relevant diff (context block):
```diff
-    if (!parentRecordId) return {};
+    const headerData = hook.editing || hook.selected;
+    const priceListId = headerData?.priceList ?? null;
+
+    // Derive isSOTrx from window category so NEO's validation filter resolves
+    // @isSOTrx@ in M_PriceList.issopricelist = @isSOTrx@, showing only sales or
+    // purchase price lists depending on the document type.
+    const category = api?.window?.category;
+    const isSOTrx = category === 'sales' ? 'Y' : category === 'purchases' ? 'N' : null;

     const next = {};
+    if (entity) {
+      next[entity] = { ...(isSOTrx ? { isSOTrx } : {}) };
+    }
+    if (!parentRecordId) return next;
     if (detailEntity) {
-      next[detailEntity] = { parentId: parentRecordId };
+      next[detailEntity] = {
+        parentId: parentRecordId,
+        ...(priceListId ? { priceList: priceListId } : {}),
+      };
     }
```

Deps were also widened from `[detailEntity, parentRecordId, secondaryTabs]` to `[entity, detailEntity, parentRecordId, secondaryTabs, hook.editing, hook.selected, api]` — which is the proximate cause of the selector refetch flood (see `docs/network-performance-audit.md` #5).

## Related commits on the same ticket

- **`6160650f` (2026-04-13)** — Feature ETP-3661: Filter BP selector by customer or vendor per window. Added `isCustomer` / `isVendor` to the **header** context (not related to the priceList injection on the detail entity, but same memo).
- **`a5c21c9d` (2026-04-15)** — Feature ETP-3661: Fix price editing on tax-included order lines. Added 14 lines to `DetailView.jsx`; touched `contract.json` / `decisions.json` in three order windows.

The three commits together form the "ETP-3661" feature.

## What this extra injection is meant to do

The intent (inferred from the commit message and the surrounding tax-rate-DAL-fetch logic added in the same commit): when a user adds a product/tax on a line, the backend selector can filter by the header's active price list so the user only sees products/taxes that are pricable on that list.

## Side effects worth checking before removing

1. **Does the NEO line-level `product` selector actually read `priceList`?** If it is ignored server-side, removing the injection is pure win.
2. **Does the NEO line-level `tax` selector actually read `priceList`?** Same question.
3. **Tax-included cascade logic** in `handleLineFieldChange` (callout flow, DetailView around lines ~500-700 today) was introduced in the same commit and fetches the tax rate from the DAL REST endpoint when the price list is tax-included. That logic reads `result.tax` / `result.grossUnitPrice`, **not** `selectorContextByEntity`, so it should survive removing the `priceList` field from the context.
4. **Partner-address dependent selector** reads from `formData` (parent value = businessPartner), not from `selectorContext`, so it is unaffected.

## Impact on the performance audit

If it turns out the backend does not actually filter by `priceList` for these selectors, removing the injection:
- Removes the only `hook.editing`-derived value that the context memo reads.
- Makes the `selectorContextByEntity` memo depend only on static/stable values.
- Simplifies the fix applied in commit (pending) — the `priceListId` scalar dep could go away entirely and the memo would never need to rebuild on editing changes.

## Suggested verification steps before removal

1. Hit the NEO selector endpoint with and without `priceList` and diff the results:
   ```
   GET /sws/neo/sales-order/lines/selectors/product?parentId=<id>
   GET /sws/neo/sales-order/lines/selectors/product?parentId=<id>&priceList=<plId>
   ```
2. Grep NEO server code (`com.etendoerp.go/src/...`) for references to the `priceList` query param.
3. Ask Irina or the ETP-3661 ticket for the original rationale.

## Change log

- 2026-04-20 — Report created to evaluate removal of `priceList` context injection (Valentin).
