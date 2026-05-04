# Discount Feature — Status and Next Steps

**Date:** 2026-05-03  
**Active branch:** `feature/ETP-3662` (rebased onto `epic/ETP-3662`)  
**Status:** Per-product discount ✅ delivered — Total discount UI ✅ visual placeholder implemented (no persistence) — backend logic ⏸ paused pending functional analysis

---

## Part 1 — Per-product discount (IMPLEMENTED, in PR)

### What it does

The document totals panel (orders, invoices, quotations) includes a fully client-side, real-time discount breakdown:

**Discount column**: always visible in the lines grid and the inline add-row (`hiddenColumns={[]}` — no toggle).

**Auto-appear breakdown rows** (shown when `discountAmt > 0`, i.e. at least one line carries a non-zero discount):
- "Subtotal without discount" (`Σ qty × listPrice`)
- "Discount per product" — **read-only** computed row (not a checkbox)

When the breakdown is visible, the panel shows:
- Subtotal without discount
- Discount per product (read-only)
- Subtotal (net)
- Tax
- Total

**`+ Add total discount` button**: appears below the totals block when no total discount is active and at least one line exists (saved or in the add-row). Hidden when the document is `readOnly` or there are no lines.  
Clicking it shows the "Total discount" section: checkbox (checked by default) + computed amount + numeric input + static "%" label. Unchecking the checkbox collapses the section and restores the button.

The "Total discount" calculation is a **UI placeholder only** — no backend persistence yet.

All totals are **100% client-side and real-time** — the panel updates without waiting for a save, including:
- The in-progress add-row (`pendingLine`)
- Live sidebar edits (`editingLine`)

### Affected windows

| Window | Panel |
|--------|-------|
| Sales Order | `DetailView.jsx` (direct) |
| Purchase Order | `DetailView.jsx` (direct) |
| Sales Quotation | `DetailView.jsx` (direct) |
| Sales Invoice | `PurchaseInvoiceBottomPanel` → `DocumentTotalsPanel` |
| Purchase Invoice | `PurchaseInvoiceBottomPanel.jsx` → `DocumentTotalsPanel` |

### Key files

| File | Role |
|------|------|
| `tools/app-shell/src/components/contract-ui/DocumentTotalsPanel.jsx` | Generic component — renders the panel with auto-appear breakdown and interactive "Total discount" section; `totalDiscountOpen` is local state |
| `tools/app-shell/src/lib/documentTotals.js` | Pure function `computeDocumentTotals()` — all calculation logic extracted |
| `tools/app-shell/src/lib/__tests__/documentTotals.test.js` | 11 unit tests covering edge cases |
| `tools/app-shell/src/components/contract-ui/DataTable.jsx` | `hiddenColumns` prop (always `[]`) + `onValuesChange` in InlineAddRow for `pendingLine` |
| `tools/app-shell/src/components/contract-ui/DetailView.jsx` | `pendingLineValues`, `editingLine` state — `discountPerProductEnabled` and `onDiscountPerProductChange` removed |
| `artifacts/purchase-order/decisions.json` | `grandTotalAmount` and `summedLineAmount` → `section: "summary"`, no `form: false` |
| `tools/app-shell/src/locales/en_US.json` + `es_ES.json` | Keys: `addTotalDiscount` (renamed from `addDiscount`), `totalDiscount` (new), `subtotalWithoutDiscount`, `discountPerProduct` |

### Bugs resolved during development

1. ~~**Clicking "+ Add discount" saved the inline line**~~: no longer applies — the checkbox/toggle mechanism was removed. The `+ Add total discount` button only touches `DocumentTotalsPanel` local state and does not interfere with `InlineAddRow`. The `data-inline-add-portal="true"` attribute is kept on the panel root divs as a safeguard for the percentage input interaction.

2. ~~**Panel reset on first line save (race condition)**~~: no longer applies — `discountPerProductEnabled` and its `useRef` logic were removed. The "Discount per product" breakdown is derived directly from `discountAmt > 0`, so there is no boolean state that can go out of sync.

3. **"Discount per product" label was clipped in invoices**: the 300px right column was too narrow. Fix: `w-[340px]` on both bottom panels + `whitespace-nowrap` on the label + `max-w-xs` on the panel to prevent expansion on orders/quotations.

4. **Purchase order did not render the panel**: `getReadOnlyFields()` filters `f.form && f.visibility === 'readOnly'`. The `decisions.json` had `form: false` on `grandTotalAmount` and `summedLineAmount`. For `visibility: "readOnly"` the default is `form: true` — removing `form: false` lets `visibilityDefaults()` resolve it correctly.

5. **Sidebar edits were not reflected in the panel**: the panel only read `lines` (saved data). Fix: `DetailView` passes `editingLine = { ...selectedLine, ...lineEdits }` to the panel, which replaces the matching saved line in the computation.

---

## Part 2 — Total discount (UI PLACEHOLDER DONE — backend paused)

The visual UI for "Total discount" is implemented in `DocumentTotalsPanel`: `+ Add total discount` button, checkbox, computed amount, percentage input, and "%" label. The section is fully interactive in the UI but does not persist data to the backend yet. The open functional questions below must be answered before proceeding with persistence.

### Target UX

In the expanded panel state, below "Discount per product":

```
Subtotal without discount       100.00€
  Discount per product            0.00€
  ☑ Total discount              -12.00€
    [ 12 ] %
────────────────────────────────────────
Subtotal                         88.00€
Tax 21%                          18.48€
Total                           106.48€
```

The total discount:
- Is independent of per-product discount (both can coexist)
- Uses a numeric input + static "%" label (fixed percentage only — no fixed-amount type)
- Applies to `netSubtotal` (after per-product discounts): `100€ × 12% = -12€`
- Tax is recomputed on the reduced base

### Technical analysis completed

#### What does NOT work: modifying GrandTotal directly

Investigated in the Etendo Classic DB. Findings:

- `GrandTotal` is recalculated by trigger `c_invoiceline_trg2` on every line modification: `GrandTotal = TotalLines + TaxAmt`
- During completion (`C_Invoice_Post`), an `UPDATE C_INVOICELINE SET UPDATED = now()` re-fires that trigger on all lines → **any manually written GrandTotal value is overwritten**
- Header `ChargeAmt` is also unsafe: the incremental trigger does not include it in its formula; it is lost on the next line edit
- Manually writing `GrandTotal` in draft is allowed by trigger `c_invoice_trg`, but the value does not survive completion

#### Proposed mechanism: `basicDiscount` + `EM_Etgo_Discount`

The document's `basicDiscounts` tab (`C_Invoice_Discount` / `C_Order_Discount`) has the `EM_Etgo_Discount` field added by `com.etendoerp.go`. The functional analyst confirmed that creating records there and populating that field with a discount percentage does not cause issues during document completion.

**Proposed flow:**

1. User sets "Total discount = 12%" in the panel
2. Etendo GO creates a record in `basicDiscount` with `EM_Etgo_Discount = 12`
3. On each line save, the total discount is also applied to `unitPrice` (hidden, computed at persist time) and to `lineGrossAmount` → Classic stays consistent
4. On document load: read `EM_Etgo_Discount` from `basicDiscount`, use that value in the panel to render the correct breakdown

**Panel math works cleanly:**
```
grossSubtotal  = Σ(qty × listPrice)                            ← listPrice not modified
netSubtotal    = Σ(qty × listPrice × (1 − discount%))          ← per-product discount unchanged
totalDiscAmt   = netSubtotal × totalDiscountPct / 100
grandTotal     = Σ(lineGrossAmount)                            ← total discount baked in
taxAmt         = grandTotal − (netSubtotal × (1 − totalDiscPct/100))
```

### Open questions for the functional analyst

**Q1 — What does Classic do at completion when a `basicDiscount` record exists?**

Do `lineGrossAmount` values in the DB change after completion (Classic applied the discount to the lines), or is the adjustment only at the accounting/posting level? Critical for determining whether there is double-discounting.

**Q2 — Can total discount and per-product discount always coexist?**

Does the business model support applying both at the same time, or are they mutually exclusive?

**Q3 — Discount visibility on the printed document / confirmation**

Does Etendo Go have or plan to have its own PDF generation? If not, does it matter what is displayed?

**Q4 — Fixed amount in addition to percentage?**

Is there a real use case for a fixed-amount total discount, or is percentage sufficient?

### Flagged technical risk

If the total discount is baked into `lineGrossAmount` at save time (for Classic consistency) and also stored in `basicDiscount`, the panel needs to **visually reverse** that discount on load to avoid double-counting:

```
displayLineGrossAmount = lineGrossAmount / (1 − totalDiscountPct/100)
```

This works mathematically (rounding is manageable), but creates a fragile coupling: if a line is modified directly in Classic, its `lineGrossAmount` changes but the `basicDiscount` record does not — Etendo GO would apply an incorrect reverse with no visible error.

**Cleaner alternative (to validate with analyst):** do not bake the discount into `lineGrossAmount` at save time. Only store it in `basicDiscount`. Let Classic apply the discount at completion from that record. This eliminates the reversal problem entirely. Requires confirming that Classic does not double-discount.

---

## Next steps when resumed

1. Answer the 4 open questions with the functional analyst
2. Confirm Classic behavior at completion when `basicDiscount` is already populated
3. Decide whether to bake the discount into `lineGrossAmount` or not
4. Design the NeoHandler that creates/updates the `basicDiscount` record
5. ~~Implement the UI: checkbox + input + type in `DocumentTotalsPanel`~~ ✅ Done
6. Wire `computeDocumentTotals` to accept `totalDiscountPct` (currently the input does not affect calculations)
7. Connect the panel input to the backend (read `EM_Etgo_Discount` from `basicDiscount` on load; persist on change)
8. Unit tests for the new calculation with `totalDiscountPct`
