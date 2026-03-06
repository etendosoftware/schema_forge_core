# Return from Customer — Research Findings

## Table Identification

**Primary table: `M_RMA` (Return Material Authorization)**, same as Return to Vendor.

The "Return from Customer" window under Sales Management > Transactions uses the same M_RMA / M_RMALine
tables as Return to Vendor. The key difference is the `IsSOTrx` flag: `'Y'` for customer returns
versus `'N'` for vendor returns. The tab-level WhereClause filters accordingly.

### Sales-Side vs Purchase-Side

| Aspect | Return to Vendor | Return from Customer |
|--------|-----------------|---------------------|
| IsSOTrx | N (purchase) | Y (sales) |
| Business Partner | Vendor (IsVendor='Y') | Customer (IsCustomer='Y') |
| Reference document | Goods Receipt (M_InOut, MovementType='V+') | Customer Shipment (M_InOut, MovementType='C-' or 'C+') |
| Generated on completion | Return Shipment (MovementType='V-') | Return Receipt (MovementType='C-') |
| Credit memo | Vendor Credit Memo (APC) | Customer Credit Memo (ARC) |
| DocBaseType | MRA | MRA (same) |
| Window ID | 800176 | 800177 |

## Table Structure

### M_RMA (Header) — Same table, filtered by IsSOTrx='Y'

| Column | Purpose |
|--------|---------|
| M_RMA_ID | Primary key |
| DocumentNo | Auto-generated document number |
| Name | RMA name/identifier |
| C_BPartner_ID | Customer |
| InOut_ID | FK to M_InOut — the original Customer Shipment being returned against |
| DateOrdered | Document date |
| DateDelivered | Actual return receipt date |
| M_Warehouse_ID | Warehouse |
| DocStatus | Document status (DR, CO, VO, etc.) |
| Amt | Total return amount |
| IsApproved | Approval flag |
| IsSOTrx | 'Y' for customer returns |
| C_DocType_ID | Document type (Return Material - Sales) |
| SalesRep_ID | Responsible user |
| Description | Return reason / notes |
| Processed | Processing flag |

### M_RMALine (Lines) — Same table

| Column | Purpose |
|--------|---------|
| M_RMALine_ID | Primary key |
| M_RMA_ID | FK to header |
| M_InOutLine_ID | FK to original shipment line — determines product, price |
| M_Product_ID | Product (auto-filled from shipment line) |
| Qty | Quantity returned |
| Amt | Line amount |
| C_Tax_ID | Tax (from original transaction) |
| C_UOM_ID | Unit of measure |
| Line | Line number |
| Description | Line-level notes |

## Document Type

The Return from Customer window uses document type with:
- **DocBaseType**: `MRA` (Material RMA) — same as vendor side
- **IsSOTrx**: `Y` (sales side)
- The tab-level WhereClause filters by `M_RMA.IsSOTrx='Y'` to show only customer returns

## Relationship to Original Sale

```
Sales Order (C_Order, IsSOTrx='Y')
    |
    v
Customer Shipment (M_InOut, IsSOTrx='Y', MovementType='C-')
    |
    v
Return from Customer (M_RMA, IsSOTrx='Y')
    |  references original shipment via InOut_ID
    v
Return Receipt (M_InOut, IsSOTrx='Y', MovementType='C+')
    |  generated on RMA completion — goods come back in
    v
Customer Credit Memo (C_Invoice, IsSOTrx='Y', DocBaseType='ARC')
    |  optional, generated to adjust AR
```

## Key Business Rules

1. **Shipment Line Reference**: Each RMA line must reference an original Customer Shipment line.
   The product, price, tax, and UOM are derived from that shipment line.

2. **Quantity Validation**: Return quantity cannot exceed the original shipment quantity
   minus any quantities already returned via other RMAs.

3. **Document Processing**: Completing a customer RMA generates:
   - A return receipt (M_InOut with MovementType='C+') to receive inventory back
   - Optionally, a customer credit memo (C_Invoice with DocBaseType='ARC')

4. **Customer Filtering**: The business partner must be a customer (IsCustomer='Y'), and the
   original shipment selector filters by the selected customer.

## Differences from Return to Vendor

| Aspect | Return to Vendor | Return from Customer |
|--------|-----------------|---------------------|
| BP filter | IsVendor='Y' | IsCustomer='Y' |
| Reference doc | Goods Receipt (V+) | Customer Shipment (C-) |
| Completion generates | Return Shipment (V-) | Return Receipt (C+) |
| Credit memo type | Vendor Credit (APC) | Customer Credit (ARC) |
| Inventory impact | Goods leave warehouse | Goods return to warehouse |
| AR/AP impact | Reduces Accounts Payable | Reduces Accounts Receivable |
