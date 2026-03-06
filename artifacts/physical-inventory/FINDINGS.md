# Physical Inventory - Research Findings

## Tables

- **Header:** `M_Inventory` — Physical Inventory count header (one per count event)
- **Lines:** `M_InventoryLine` — child table, FK via `M_Inventory_ID` (one line per product/locator counted)

## Inventory Type

The `InventoryType` column on `M_Inventory` classifies the type of physical inventory:

| Code | Meaning |
|------|---------|
| `N` | Normal — standard periodic physical count |
| `O` | Opening Inventory — used when initializing warehouse stock |
| `C` | Closing Inventory — used when closing a warehouse or period |

The type is user-selectable and defaults to `N` (Normal) for most operations.

## Key Concepts

### Physical Inventory vs. Goods Movement

Physical Inventory (`M_Inventory`) is distinct from Goods Receipt/Shipment (`M_InOut`):

| Aspect | Physical Inventory | Goods Receipt/Shipment |
|--------|-------------------|----------------------|
| Purpose | Count & adjust stock | Record material movement |
| Table | `M_Inventory` | `M_InOut` |
| Lines | `M_InventoryLine` | `M_InOutLine` |
| Direction | Internal adjustment | Inbound/outbound |
| Partner | None (internal) | Business partner |
| Pricing | None | May link to PO/SO pricing |

### Book vs. Count Quantities

Each `M_InventoryLine` tracks:

- **QtyBook** (Book Quantity): The system's on-hand quantity at the locator, populated automatically from `M_Storage_Detail` when the line is created.
- **QtyCount** (Count Quantity): The actual physical count entered by the warehouse operator.
- **Adjustment**: Computed as `QtyCount - QtyBook`. Positive means surplus (found extra stock); negative means shortage (missing stock).

The adjustment quantity is not stored as a column but computed at display/processing time. When the document is completed, the system creates `M_Transaction` records to reconcile the book quantity with the count.

### Locator

Each inventory line requires a `M_Locator_ID` — the specific bin/rack/shelf in the warehouse where the product was counted. The locator must belong to the warehouse specified on the header. This is the same concept used in Goods Receipt lines.

## Document Flow

```
Physical Inventory (M_Inventory)
    |
    v  [Complete DocAction]
M_Transaction records created
    |
    v
M_Storage_Detail updated (on-hand adjusted)
```

There is no downstream document chain — Physical Inventory is a terminal document that directly adjusts stock levels.

## Schema Decisions

- **warehouse** — editable, required on header. Scopes which locators are available on lines.
- **movementDate** — editable, required. The date of the physical count.
- **inventoryType** — editable with list reference (N/O/C). Defaults to Normal.
- **description** — editable, optional free text.
- **documentNo** — readOnly, auto-generated sequence.
- **docStatus** — readOnly, managed by document engine (DR/CO/VO).
- **bookQuantity** — readOnly on lines. Auto-populated from storage when line is created.
- **countQuantity** — editable on lines. The user enters the actual count.
- **adjustmentQuantity** — readOnly, computed (count - book). Not a real DB column but displayed for user convenience.
- **uom** — readOnly on lines. Derived from the product's default UOM.
- **locator** — editable on lines. Selector filtered by header warehouse.
- **No business partner** — Physical Inventory is an internal warehouse operation.
- **No pricing/amounts** — This is a quantity-only document.

## Key Differences from Sales Order / Goods Receipt

| Aspect | Sales Order | Goods Receipt | Physical Inventory |
|--------|-------------|---------------|-------------------|
| Table | `C_Order` | `M_InOut` | `M_Inventory` |
| Partner | Customer | Vendor | None (internal) |
| Pricing | Full (prices, taxes, totals) | None | None |
| Location | Delivery address | Warehouse + Locator | Warehouse + Locator |
| Purpose | Sales transaction | Material movement | Stock adjustment |
| IsSOTrx | `Y` | `N` | N/A |
| Quantities | QtyOrdered | MovementQty | QtyBook + QtyCount |
