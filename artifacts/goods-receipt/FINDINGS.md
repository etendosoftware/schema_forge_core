# Goods Receipt - Research Findings

## Tables

- **Header:** `M_InOut` (Material In/Out) — shared between Goods Receipts and Goods Shipments
- **Lines:** `M_InOutLine` — child table, FK via `M_InOut_ID`

## IsSOTrx Flag

The `M_InOut` table uses `IsSOTrx` to distinguish direction:

| IsSOTrx | Window | Direction |
|---------|--------|-----------|
| `Y` | Goods Shipment (Sales) | Outbound to customer |
| `N` | Goods Receipt (Procurement) | Inbound from vendor |

The tab-level `WhereClause` filters by `M_InOut.IsSOTrx='N'` for Goods Receipt windows.

## Movement Type

`MovementType` column on `M_InOut` indicates the nature of the stock movement:

| Code | Meaning |
|------|---------|
| `V+` | Vendor Receipt (goods in from vendor) |
| `V-` | Vendor Return (goods back to vendor) |
| `C+` | Customer Return (goods back from customer) |
| `C-` | Customer Shipment (goods out to customer) |

For Goods Receipt, `MovementType = 'V+'` (Vendor Receipt).

## Locator Concept

`M_Locator` represents a specific physical location within a warehouse (aisle, rack, bin). Each line requires a locator to know exactly where received goods are stored. The locator is always scoped to the warehouse selected on the header.

- `M_Locator.M_Warehouse_ID` — FK to warehouse
- A warehouse has many locators; each locator belongs to exactly one warehouse
- The locator selector on lines should filter by the header's warehouse

## Relationship to Purchase Order

Goods Receipts can be created:

1. **Standalone** — manual entry without referencing a PO
2. **From Purchase Order** — via the "Create Lines From" process, which copies PO lines into receipt lines

When created from a PO:
- `M_InOutLine.C_OrderLine_ID` links back to the originating `C_OrderLine`
- `M_InOut.C_Order_ID` may reference the originating `C_Order`
- This enables matching received quantities against ordered quantities

In the initial schema, we treat this as standalone (no PO reference fields exposed). PO integration can be added in a future iteration.

## Document Flow

```
Purchase Order (C_Order, IsSOTrx='N')
    |
    v  [Create Lines From / Manual]
Goods Receipt (M_InOut, IsSOTrx='N')
    |
    v  [Match PO process]
Vendor Invoice (C_Invoice, IsSOTrx='N')
```

## Key Differences from Sales Order Schema

| Aspect | Sales Order | Goods Receipt |
|--------|-------------|---------------|
| Table | `C_Order` | `M_InOut` |
| IsSOTrx | `Y` | `N` |
| Pricing | Has price list, unit price, amounts | No pricing (qty only) |
| Location | Delivery address | Warehouse + Locator (physical storage) |
| Date field | `DateOrdered` | `MovementDate` |
| Line amounts | `LineNetAmt`, `GrandTotal` | None (quantity-based) |

## Schema Decisions

- **isActive** kept as editable on header (standard Etendo pattern for inbound documents)
- **dateAcct** (accounting date) exposed as editable — often same as movementDate but can be overridden for period control
- **poReference** — free-text field for the vendor's reference number, useful for cross-referencing
- **locator** on lines is editable and required — the user must specify where goods are stored
- **uom** on lines is readOnly — derived from the product's default UOM
- **movementType** is system-derived as `'V+'` — always Vendor Receipt for this window

---

## Inbound Receipt (Unified)

**"Inbound Receipt" and "Goods Receipt" are the same window** (AD_Window_ID = 184). Some Etendo versions or localizations label the menu entry as "Inbound Receipt" but it opens the identical window at Procurement > Transactions > Goods Receipt. There is no separate table or entity — it is a filtered view of `M_InOut` with `IsSOTrx='N'`.

The research findings from the Inbound Receipt investigation are included below for completeness.

### Inbound Receipt Research

The `M_InOut` table serves both inbound (receipts) and outbound (shipments) material movements. The key discriminator is:

| Field | Receipt (Inbound) | Shipment (Outbound) |
|-------|-------------------|---------------------|
| `IsSOTrx` | `N` (purchase) | `Y` (sales) |
| `MovementType` | `V+` (vendor receipt) | `C-` (customer shipment) |
| `C_DocType_ID` | Material Receipt type | Shipment type |
| Tab `WhereClause` | `M_InOut.IsSOTrx='N'` | `M_InOut.IsSOTrx='Y'` |

### Key Differences from Goods Shipment (Sales Side)

1. **Direction**: Receipt increases on-hand inventory; Shipment decreases it.
2. **Business Partner**: Receipt expects a **vendor** (IsVendor='Y'); Shipment expects a **customer** (IsCustomer='Y').
3. **Source Document**: Receipt links to **Purchase Order**; Shipment links to **Sales Order**.
4. **Movement Type**: `V+` for vendor receipts vs `C-` for customer shipments.
5. **CreateFrom Process**: Receipt's "Create Lines From" pulls from pending Purchase Order lines; Shipment's from Sales Order lines.
6. **Accounting**: Receipt debits inventory accounts; Shipment credits them.
7. **No price fields on lines**: M_InOutLine does not have price/amount fields. Pricing happens on the Purchase Invoice.

### Key Processes (from Inbound Receipt research)

1. **Complete (DocAction)**: Creates `M_Transaction` records and updates `M_Storage_Detail`.
2. **Create Lines From PO**: Populates receipt lines from a selected purchase order's pending lines.
3. **Void**: Reverses the inventory transactions from Complete.
4. **Reactivate**: Returns a completed receipt to Draft status (if no downstream documents reference it).

### Design Decisions (from Inbound Receipt research)

- `movementType` classified as **system** — always `V+` for this window.
- `isActive` classified as **readOnly** — receipts are voided, not deactivated.
- Line prices intentionally absent — cost/price determined at Purchase Invoice.
- `attributeSetInstance` has `inputMode: "special"` — opens dedicated dialog for lot/serial/attribute values.
