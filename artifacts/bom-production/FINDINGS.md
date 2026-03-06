# BOM Production - Research Findings

## Tables

- **Header:** `M_Production` -- Production order header (one per assembly run)
- **Lines:** `M_ProductionLine` -- child table, FK via `M_Production_ID` (one line per end product + one per consumed component)

## Key Concepts

### Production vs. Other Warehouse Documents

BOM Production (`M_Production`) is a manufacturing/assembly document. It differs from inventory counts and goods movements:

| Aspect | BOM Production | Physical Inventory | Goods Movement |
|--------|---------------|-------------------|----------------|
| Purpose | Assemble finished product from components | Count & adjust stock | Move stock between locators |
| Table | `M_Production` | `M_Inventory` | `M_Movement` |
| Lines | `M_ProductionLine` | `M_InventoryLine` | `M_MovementLine` |
| Direction | Consumes inputs, produces output | Internal adjustment | Transfer between bins |
| Partner | None (internal) | None (internal) | None (internal) |
| Pricing | None | None | None |

### Line Semantics: End Product vs. Components

Each `M_ProductionLine` represents either:

- **End product** (`IsEndProduct = Y`): The finished item being produced. `MovementQty` is **positive** (stock increases).
- **Component** (`IsEndProduct = N`): A raw material or sub-assembly consumed. `MovementQty` is **negative** (stock decreases).

A valid production order has exactly **one** end product line and **one or more** component lines.

### Quantity Convention

- **Positive MovementQty**: Stock is added to the locator (production output).
- **Negative MovementQty**: Stock is removed from the locator (component consumption).

The header `ProductionQty` field indicates how many units of the finished product are being assembled. The end product line's `MovementQty` must match this value.

### Locator

Each production line requires a `M_Locator_ID` -- the bin/rack/shelf where:
- The finished product will be placed (end product line)
- The component will be consumed from (component lines)

Components may come from different locators within the same warehouse.

## Document Flow

```
BOM Production (M_Production)
    |
    v  [Complete DocAction]
M_Transaction records created (one per line)
    |
    v
M_Storage_Detail updated:
  - End product: stock increased at target locator
  - Components: stock decreased at source locators
```

BOM Production is a terminal document -- it directly adjusts stock levels, with no downstream document chain.

## Schema Decisions

- **documentNo** -- readOnly, auto-generated sequence.
- **name** -- editable, required. User-provided label for the production order (e.g., "Laptop Assembly Batch #47").
- **movementDate** -- editable, required. The date of the production run.
- **product** -- editable, required. The finished product being assembled (FK to M_Product).
- **productionQuantity** -- editable, required. How many units of the finished product to produce.
- **description** -- editable, optional free text.
- **docStatus** -- readOnly, managed by document engine (DR/CO/VO).
- **lineNo** -- editable on lines. Sequence number.
- **product (line)** -- editable on lines. Either the end product or a component.
- **locator** -- editable on lines. Where the product is placed/taken.
- **movementQuantity** -- editable on lines. Positive for output, negative for consumed inputs.
- **uom** -- readOnly on lines. Derived from product's default UOM.
- **isEndProduct** -- readOnly on lines. Boolean flag set by system when line is created from BOM explosion (or manually toggled by user).
- **No business partner** -- BOM Production is an internal warehouse/manufacturing operation.
- **No pricing/amounts** -- This is a quantity-only document.

## Business Rules

1. **RULE-BOM-001**: End product lines must have positive MovementQty.
2. **RULE-BOM-002**: Component lines must have negative MovementQty.
3. **RULE-BOM-003**: Exactly one end product line per production order (validated on complete).
4. **RULE-BOM-004**: At least one component line per production order (validated on complete).
5. **RULE-BOM-005**: End product line MovementQty must match header ProductionQty.
