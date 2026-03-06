# Return to Vendor — Research Findings

## Table Identification

**Primary table: `M_RMA` (Return Material Authorization)**, not `C_Order`.

In Etendo ERP, "Return to Vendor" under Procurement > Transactions uses the M_RMA / M_RMALine
tables. This is distinct from C_Order, which handles purchase orders and sales orders via
the IsSOTrx flag. The RMA mechanism is a separate document flow specifically designed for
returns.

### Why M_RMA and not C_Order?

- C_Order represents purchase/sales orders. Vendor returns are not "orders" — they are
  return authorizations that reference an existing goods receipt.
- M_RMA has a direct FK to `M_InOut` (the original shipment/receipt), which is the core
  relationship: you can only return goods you previously received.
- The M_RMA table has its own document type category ("RMA") and document sequence.

## Table Structure

### M_RMA (Header)

| Column | Purpose |
|--------|---------|
| M_RMA_ID | Primary key |
| DocumentNo | Auto-generated document number |
| Name | RMA name/identifier |
| C_BPartner_ID | Vendor |
| InOut_ID | FK to M_InOut — the original Goods Receipt being returned against |
| DateOrdered | Document date |
| DateDelivered | Actual return date |
| M_Warehouse_ID | Warehouse |
| DocStatus | Document status (DR, CO, VO, etc.) |
| Amt | Total return amount |
| IsApproved | Approval flag |
| IsSOTrx | 'N' for vendor returns, 'Y' for customer returns |
| C_DocType_ID | Document type (Return Material) |
| SalesRep_ID | Responsible user |
| Description | Return reason / notes |
| Processed | Processing flag |

### M_RMALine (Lines)

| Column | Purpose |
|--------|---------|
| M_RMALine_ID | Primary key |
| M_RMA_ID | FK to header |
| M_InOutLine_ID | FK to original receipt line — determines product, price |
| M_Product_ID | Product (auto-filled from receipt line) |
| Qty | Quantity to return |
| Amt | Line amount |
| C_Tax_ID | Tax (from original transaction) |
| C_UOM_ID | Unit of measure |
| Line | Line number |
| Description | Line-level notes |

## Document Type

The Return to Vendor window uses document type with:
- **DocBaseType**: `MRA` (Material RMA)
- **IsSOTrx**: `N` (purchase side)
- The tab-level WhereClause filters by `M_RMA.IsSOTrx='N'` to show only vendor returns
  (the same M_RMA table is used for customer returns with IsSOTrx='Y')

## Relationship to Original Purchase

```
Purchase Order (C_Order, IsSOTrx='N')
    |
    v
Goods Receipt (M_InOut, IsSOTrx='N', MovementType='V+')
    |
    v
Return to Vendor (M_RMA, IsSOTrx='N')
    |  references original receipt via InOut_ID
    v
Return Shipment (M_InOut, IsSOTrx='N', MovementType='V-')
    |  generated on RMA completion
    v
Vendor Credit Memo (C_Invoice, IsSOTrx='N', DocBaseType='APC')
    |  optional, generated to adjust AP
```

## Key Business Rules

1. **Receipt Line Reference**: Each RMA line must reference an original Goods Receipt line.
   The product, price, tax, and UOM are derived from that receipt line.

2. **Quantity Validation**: Return quantity cannot exceed the original receipt quantity
   minus any quantities already returned via other RMAs.

3. **Document Processing**: Completing an RMA generates:
   - A return shipment (M_InOut with MovementType='V-') to reverse inventory
   - Optionally, a vendor credit memo (C_Invoice with DocBaseType='APC')

4. **Vendor Filtering**: The business partner must be a vendor (IsVendor='Y'), and the
   original receipt selector filters by the selected vendor.

## Window ID

The Etendo standard window ID for "Return to Vendor" is `800176` (may vary by Etendo version).
The customer-side equivalent "Return Material" uses the same tables but with IsSOTrx='Y'.

## Differences from Sales Order Schema

| Aspect | Sales Order | Return to Vendor |
|--------|------------|------------------|
| Table | C_Order / C_OrderLine | M_RMA / M_RMALine |
| Reference doc | None (origin) | M_InOut (Goods Receipt) |
| Line reference | None | M_InOutLine (receipt line) |
| Price source | Price List | Original receipt line |
| Document flow | Order -> Receipt -> Invoice | Receipt -> RMA -> Return Shipment -> Credit Memo |
| IsSOTrx | Y | N |
| DocBaseType | SOO | MRA |
