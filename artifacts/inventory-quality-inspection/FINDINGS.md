# Inventory Quality Inspection - Research Findings

## Tables

- **Header:** `M_QualityCheck` — Quality inspection record for received goods (one per inspection event)
- Etendo does not ship a standard `M_QualityCheck` table out of the box. This is a custom entity modeled after warehouse transaction patterns (`M_Inventory`, `M_InOut`).

## Purpose

Quality Inspection records the outcome of inspecting received goods before they are accepted into inventory. This is a single-entity window (no master-detail lines) because each inspection record covers one product at one warehouse.

## Key Concepts

### Inspection vs. Physical Inventory

| Aspect | Quality Inspection | Physical Inventory |
|--------|-------------------|-------------------|
| Purpose | Evaluate received goods quality | Count & adjust stock |
| Table | `M_QualityCheck` (custom) | `M_Inventory` |
| Direction | Inbound evaluation | Internal adjustment |
| Result | Pass/Fail/Conditional | Qty Book vs Qty Count |
| Partner | Implicit (vendor from receipt) | None (internal) |

### Result Classification

Each inspection has a result:

| Code | Label | Meaning |
|------|-------|---------|
| `P` | Pass | All inspected goods meet quality standards |
| `F` | Fail | Goods do not meet standards, rejected |
| `C` | Conditional | Partial acceptance with conditions or rework required |

### Quantity Model

- **QtyInspected**: Total quantity submitted for inspection (editable)
- **QtyAccepted**: Quantity that passed inspection (editable, must be <= QtyInspected)
- **QtyRejected**: Auto-computed as `QtyInspected - QtyAccepted` (readOnly)

This mirrors the Book/Count/Adjustment pattern from Physical Inventory but adapted for quality control.

## Document Flow

```
Goods Receipt (M_InOut, IsSOTrx='N')
    |
    v  [Inspection triggered]
Quality Inspection (M_QualityCheck)
    |
    v  [Result: Pass -> accept into inventory]
    v  [Result: Fail -> return to vendor or scrap]
    v  [Result: Conditional -> partial accept + rework]
```

## Schema Decisions

- **documentNo** — readOnly, auto-generated sequence (QCI-XXXXX pattern)
- **product** — editable, required. The product being inspected.
- **warehouse** — editable, required. Where the inspection takes place.
- **inspectionDate** — editable, required. Defaults to today.
- **result** — editable with list reference (P/F/C). Core classification of inspection outcome.
- **inspector** — editable, required. Name/ID of the person performing the inspection.
- **notes** — editable, optional (but required when result is Fail or Conditional).
- **quantityInspected** — editable, required. Total qty under inspection.
- **quantityAccepted** — editable, required. Must not exceed quantityInspected.
- **quantityRejected** — readOnly, computed (inspected - accepted).
- **docStatus** — readOnly, managed by document engine (DR/CO/VO).
- **No pricing/amounts** — This is a quantity-only quality document.
- **No business partner field** — The vendor context comes from the originating Goods Receipt.
- **Single entity** — No detail lines. Each record = one product inspection at one warehouse.

## Key Differences from Other Warehouse Transactions

| Aspect | Quality Inspection | Goods Receipt | Physical Inventory |
|--------|-------------------|---------------|-------------------|
| Table | `M_QualityCheck` | `M_InOut` | `M_Inventory` |
| Lines | None (single entity) | `M_InOutLine` | `M_InventoryLine` |
| Partner | None | Vendor | None |
| Pricing | None | None | None |
| Key metric | Pass/Fail/Conditional | MovementQty | QtyBook vs QtyCount |
| Quantities | Inspected/Accepted/Rejected | MovementQty | Book/Count/Adjustment |
