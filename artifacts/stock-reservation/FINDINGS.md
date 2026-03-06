# Stock Reservation - Research Findings

## Tables

- **Header:** `M_Reservation` -- reservation header linking a product, warehouse, and optional sales order line
- **Detail:** `M_Reservation_Stock` -- per-locator stock allocation within the reservation (FK via `M_Reservation_ID`)

## Window Context

Stock reservations belong to **Warehouse Management > Transactions**. They hold inventory for specific sales orders, preventing other orders from consuming the reserved stock. This is critical for make-to-order or high-priority fulfillment workflows.

## M_Reservation (Header)

| Column | Purpose | Notes |
|--------|---------|-------|
| `DocumentNo` | Auto-generated sequence number | readOnly, searchable |
| `M_Product_ID` | Product being reserved | FK to M_Product |
| `M_Warehouse_ID` | Warehouse where stock is reserved | FK to M_Warehouse |
| `Quantity` | Total reserved quantity | Editable, must be > 0 |
| `ReleasedQty` | Quantity already released (consumed) | readOnly, computed from stock lines |
| `RESStatus` | Reservation status (DR/CO/CL/HO) | readOnly, controlled by status logic |
| `C_OrderLine_ID` | Sales order line this reservation is for | Optional FK to C_OrderLine |
| `C_UOM_ID` | Unit of measure | readOnly, derived from product |
| `M_AttributeSetInstance_ID` | Lot/serial attribute | Optional, for attribute-tracked products |
| `RESType` | Reservation type (SO = sales order) | system, defaults to 'SO' |

### Status Values

- **DR** (Draft): Initial state, reservation is being defined
- **CO** (Completed): Reservation is active, stock is held
- **CL** (Closed): Reservation fulfilled or manually closed
- **HO** (On Hold): Temporarily suspended

### Status Transitions

```
DR -> CO (complete the reservation, stock is now held)
CO -> CL (close after fulfillment or manual release)
CO -> HO (suspend temporarily)
HO -> CO (resume)
```

## M_Reservation_Stock (Detail Lines)

Each line specifies how much of the reserved quantity is allocated to a specific storage bin (locator).

| Column | Purpose | Notes |
|--------|---------|-------|
| `M_Locator_ID` | Storage bin where stock is held | FK to M_Locator, searchable |
| `Quantity` | Quantity reserved in this locator | Must be > 0 |
| `Released` | Quantity released from this locator | readOnly |
| `IsAllocated` | Whether this stock line is allocated | readOnly boolean |

The sum of all stock line quantities should match or be less than the header `Quantity`. The sum of all `Released` values feeds back to the header `ReleasedQty`.

## Business Rules

Five validation rules identified:

1. **reservedQtyMustBePositive** -- header quantity must be > 0
2. **releasedQtyCannotExceedReserved** -- total released across lines cannot exceed header quantity
3. **stockLineQtyMustBePositive** -- each line quantity must be > 0
4. **statusTransitionValidation** -- enforces valid status transitions
5. **completedReservationReadOnly** -- closed reservations are immutable

No callouts or event handlers beyond these validations. No document processing (no docAction button). Status is managed through direct field updates with transition validation.

## Schema Decisions

- **documentNo** -- readOnly, auto-generated sequence
- **product, warehouse** -- editable FKs with search/selector input modes
- **reservedQty** -- editable number, the core field users set
- **releasedQty** -- readOnly, computed aggregate from stock lines
- **status** -- readOnly, controlled by validation rules (not directly user-editable)
- **salesOrderLine** -- optional FK, links reservation to a specific SO line
- **uom** -- readOnly, derived from the selected product
- **attributeSetInstance** -- optional, only relevant for attribute-tracked products
- **isActive** -- readOnly on both header and detail (standard pattern)
- **resType** -- system field, defaults to 'SO' (sales order reservation)
- **locator** on detail -- editable FK, the storage bin being reserved
- **quantity** on detail -- editable, amount reserved in that specific bin
- **released** on detail -- readOnly, tracks how much has been consumed from this bin
- **isAllocated** on detail -- readOnly boolean flag

## Relationship to Other Windows

- **Sales Order**: `C_OrderLine_ID` links reservations to specific SO lines
- **Warehouse Storage Bins**: `M_Locator_ID` references locators defined in the warehouse setup
- **Goods Shipment**: When a shipment is created against a reserved SO line, the released quantity increases
- **Product**: `M_Product_ID` determines what is being reserved and its UOM
