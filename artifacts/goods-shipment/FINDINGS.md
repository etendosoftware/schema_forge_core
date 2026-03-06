# Goods Shipment - Research Findings

## Tables

- **Header:** `M_InOut` (Material In/Out) -- shared between Goods Receipts and Goods Shipments
- **Lines:** `M_InOutLine` -- child table, FK via `M_InOut_ID`

## IsSOTrx Flag

The `M_InOut` table uses `IsSOTrx` to distinguish direction:

| IsSOTrx | Window | Direction |
|---------|--------|-----------|
| `Y` | Goods Shipment (Sales) | Outbound to customer |
| `N` | Goods Receipt (Procurement) | Inbound from vendor |

The tab-level `WhereClause` filters by `M_InOut.IsSOTrx='Y'` for Goods Shipment windows.

## Movement Type

`MovementType` column on `M_InOut` indicates the nature of the stock movement:

| Code | Meaning |
|------|---------|
| `C-` | Customer Shipment (goods out to customer) |
| `C+` | Customer Return (goods back from customer) |
| `V+` | Vendor Receipt (goods in from vendor) |
| `V-` | Vendor Return (goods back to vendor) |

For Goods Shipment, `MovementType = 'C-'` (Customer Shipment).

## Relationship to Goods Receipt

Goods Shipment is the **sales-side counterpart** of Goods Receipt. Both use `M_InOut` / `M_InOutLine` but differ in:

| Aspect | Goods Shipment | Goods Receipt |
|--------|----------------|---------------|
| `IsSOTrx` | `Y` (sales) | `N` (procurement) |
| `MovementType` | `C-` (customer shipment) | `V+` (vendor receipt) |
| Direction | Outbound (decreases inventory) | Inbound (increases inventory) |
| Business Partner | Customer (`IsCustomer='Y'`) | Vendor (`IsVendor='Y'`) |
| Source Document | Sales Order (`C_Order`, `IsSOTrx='Y'`) | Purchase Order |
| Downstream Doc | Sales Invoice | Purchase Invoice |

## Locator Concept

`M_Locator` represents a specific physical location within a warehouse (aisle, rack, bin). Each line requires a locator to indicate where goods are picked from. The locator is scoped to the warehouse selected on the header.

## Relationship to Sales Order

Goods Shipments can be created:

1. **Standalone** -- manual entry without referencing a Sales Order
2. **From Sales Order** -- via the "Create Lines From" process, which copies SO lines into shipment lines

When created from a Sales Order:
- `M_InOutLine.C_OrderLine_ID` links back to the originating `C_OrderLine`
- `M_InOut.C_Order_ID` may reference the originating `C_Order`

In the initial schema, we treat this as standalone (no SO reference fields exposed). Sales Order integration can be added in a future iteration.

## Document Flow

```
Sales Order (C_Order, IsSOTrx='Y')
    |
    v  [Create Lines From / Manual]
Goods Shipment (M_InOut, IsSOTrx='Y')
    |
    v  [Match Invoice process]
Sales Invoice (C_Invoice, IsSOTrx='Y')
```

## Key Processes

1. **Complete (DocAction)**: Creates `M_Transaction` records and decreases `M_Storage_Detail` (reduces on-hand inventory).
2. **Create Lines From SO**: Populates shipment lines from a selected sales order's pending lines.
3. **Void**: Reverses the inventory transactions from Complete (restores on-hand inventory).
4. **Reactivate**: Returns a completed shipment to Draft status (if no downstream documents reference it).

## Schema Decisions

- **isActive** kept as editable on header (standard Etendo pattern)
- **dateAcct** (accounting date) exposed as editable -- often same as movementDate but can be overridden for period control
- **poReference** -- free-text field for the customer's purchase order reference number
- **locator** on lines is editable and required -- the user must specify where goods are picked from
- **uom** on lines is readOnly -- derived from the product's default UOM
- **movementType** is system-derived as `'C-'` -- always Customer Shipment for this window
- **isSotrx** is system-derived as `true` -- sales transaction
- No pricing fields on lines -- pricing is handled on the Sales Invoice
