# Goods Movements - Research Findings

## Tables

- **Header:** `M_Movement` (Internal Movement header)
- **Lines:** `M_MovementLine` (one per product moved between locators)

## Purpose

Goods Movements handle internal warehouse transfers -- moving stock from one locator (or warehouse) to another without involving external business partners. Unlike Goods Receipts or Shipments, there is no purchase order, sales order, or business partner involved.

## Key Differences from Goods Receipt

| Aspect | Goods Receipt | Goods Movements |
|--------|---------------|-----------------|
| Table | `M_InOut` | `M_Movement` |
| Direction | Inbound from vendor | Internal transfer |
| Business Partner | Required (vendor) | None |
| Locators | Single destination locator per line | Two locators per line (from + to) |
| Movement Type | `V+` (vendor receipt) | N/A (internal) |
| IsSOTrx | `N` (purchase side) | N/A |
| Pricing | None (qty only) | None (qty only) |
| Document Type | Material Receipt | Internal Movement |

## Locator Model (From + To)

Each `M_MovementLine` has two locator references:

- `M_Locator_ID` -- source locator (where stock is taken from)
- `M_LocatorTo_ID` -- destination locator (where stock is moved to)

Both locators reference `M_Locator`, which belongs to a `M_Warehouse`. This means a single movement line can transfer stock between different warehouses (cross-warehouse transfer) or between locators within the same warehouse.

## Document Flow

```
Draft (DR)
    |
    v  [Complete]
Completed (CO) -- creates M_Transaction records, updates M_Storage_Detail
    |
    v  [Void]
Voided (VO) -- reverses inventory transactions
```

## Key Processes

1. **Complete (DocAction):** Creates `M_Transaction` records for both source (negative) and destination (positive), updating `M_Storage_Detail` for both locators.
2. **Void:** Reverses the inventory transactions created by Complete.
3. **Reactivate:** Returns a completed movement to Draft status if no downstream documents reference it.

## Schema Decisions

- **No business partner:** Movements are purely internal; no BP fields needed.
- **No warehouse on header:** Unlike Goods Receipt, the warehouse is implicit from the locators on each line. A single movement can span multiple warehouses.
- **locatorFrom / locatorTo on lines:** Both are editable and required. The user selects source and destination for each product line.
- **uom on lines:** Read-only, derived from the product's default UOM.
- **isActive:** Editable on header (standard Etendo pattern).
- **No movementType or IsSOTrx:** These fields are specific to `M_InOut`, not `M_Movement`.
- **processed:** System-derived based on document status.

## No Business Rules

`M_Movement` has no custom callouts, validations, or logic expressions beyond the standard document processing (Complete/Void). The rules-curated.json is empty.
