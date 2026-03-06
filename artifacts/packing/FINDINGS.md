# Packing - Research Findings

## Tables

- **Header:** `M_Packing` -- packing slip / container record for grouping shipment items into packages
- **Lines:** `M_PackingLine` -- child table, FK via `M_Packing_ID`

## Purpose

Packing is a Warehouse Management transaction that groups items from a Goods Shipment into physical packages or containers. Each packing record references a shipment (`M_InOut_ID`) and contains lines that specify which products go into which package.

## Relationship to Goods Shipment

A Packing record is always tied to a Goods Shipment:
- `M_Packing.M_InOut_ID` references the parent shipment
- The business partner and warehouse are derived from or aligned with the shipment
- Multiple packing records can exist for a single shipment (e.g., multi-box shipments)

## Key Fields

### Header (M_Packing)

| Field | Purpose |
|-------|---------|
| `DocumentNo` | Auto-generated packing slip number |
| `PackDate` | Date when packing was performed |
| `M_InOut_ID` | Reference to the Goods Shipment being packed |
| `C_BPartner_ID` | Customer receiving the package |
| `M_Warehouse_ID` | Warehouse where packing occurs |
| `Carrier` | Shipping carrier (e.g., FedEx, DHL, UPS) |
| `TrackingNo` | Carrier tracking number for the package |
| `DocStatus` | Document status (DR=Draft, CO=Completed, VO=Voided) |

### Lines (M_PackingLine)

| Field | Purpose |
|-------|---------|
| `Line` | Line number (10, 20, 30...) |
| `M_Product_ID` | Product being packed |
| `Qty` | Quantity packed |
| `Weight` | Weight of packed items (kg) |
| `PackageNo` | Package/container identifier (e.g., PKG-1, PKG-2) |
| `C_UOM_ID` | Unit of measure (readOnly, derived from product) |

## Carrier Concept

The `Carrier` field is a free-text string representing the shipping carrier. Common values include FedEx, DHL, UPS, USPS, and local carriers. In a future iteration, this could be linked to a carrier master table.

## Tracking Number

`TrackingNo` is a free-text field for the carrier's tracking reference. One packing record typically corresponds to one physical package with one tracking number.

## Package Number (PackageNo)

Within a single packing record, items can be grouped into sub-packages using `PackageNo`. For example, a large shipment might have items split across PKG-1, PKG-2, etc. This allows the packing slip to describe multi-box configurations.

## Document Flow

```
Goods Shipment (M_InOut, IsSOTrx='Y')
    |
    v  [Pack items]
Packing (M_Packing)
    |
    v  [Ship with carrier]
Carrier Pickup / Delivery
```

## Schema Decisions

- **carrier** kept as free-text string (no FK to carrier table in MVP)
- **trackingNo** editable and optional -- filled once carrier assigns tracking
- **packageNo** on lines is a string identifier, not a sequence -- allows flexible naming
- **weight** on lines is optional -- useful for carrier weight calculations but not always known
- **uom** on lines is readOnly -- derived from the product's default UOM
- **shipment** (M_InOut_ID) is editable on header -- user selects which shipment to pack
- **businessPartner** is editable but typically follows the shipment's BP
- No pricing fields -- packing is purely a logistics/warehouse operation
