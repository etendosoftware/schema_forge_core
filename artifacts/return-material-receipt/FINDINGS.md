# Return Material Receipt - Research Findings

## Identity

- **Window:** Return Material Receipt (Sales Management > Transactions > Return Material Receipt)
- **Etendo Window ID:** 53013 (approximate, may vary by Etendo version)
- **Tables:** `M_InOut` (header) + `M_InOutLine` (lines)
- **Category:** Sales

## Relationship to M_InOut

The `M_InOut` table is shared across multiple windows, differentiated by `MovementType` and `IsSOTrx`:

| Window | IsSOTrx | MovementType | Direction | Doc Type |
|--------|---------|-------------|-----------|----------|
| Goods Shipment (Sales) | Y | C- | Customer outbound | Shipment |
| Goods Receipt (Purchase) | N | V+ | Vendor inbound | Goods Receipt |
| **Return Material Receipt** | **Y** | **C+** | **Customer inbound** | **Customer Return Receipt** |
| Return to Vendor Shipment | N | V- | Vendor outbound | Return to Vendor |

The `whereClause` on the tab filters to `IsSOTrx='Y' AND MovementType='C+'` to show only customer return receipts.

## MovementType Encoding

The two-character `MovementType` encodes:
- First character: `V` = Vendor, `C` = Customer
- Second character: `+` = Inbound (receiving), `-` = Outbound (shipping)

So `C+` means "inbound from customer" — goods arriving back at the warehouse from a customer return.

## Relationship to Return from Customer (RMA)

The typical sales return flow is:

```
1. Return from Customer (RMA) — M_RMA — authorization/approval
2. Return Material Receipt — M_InOut (C+) — physical receipt of returned goods (this window)
3. Credit Memo to Customer — C_Invoice — financial settlement / refund
```

The RMA (`M_RMA`) is the authorization step. It references the original Goods Shipment (`M_InOut` with `C-`) and specifies which products/quantities are authorized for return.

The Return Material Receipt can be:
- Created manually (selecting customer and products directly)
- Created from an approved RMA (auto-populating header and lines from RMA)

When linked to an RMA:
- `M_InOut.M_RMA_ID` points to the RMA header
- `M_InOutLine.M_RMALine_ID` points to individual RMA lines

## How It Differs from Return to Vendor Shipment

| Aspect | Return Material Receipt | Return to Vendor Shipment |
|--------|------------------------|--------------------------|
| IsSOTrx | Y (sales side) | N (purchase side) |
| MovementType | C+ (customer inbound) | V- (vendor outbound) |
| Stock effect | Increases inventory | Decreases inventory |
| Locator meaning | Destination bin (receiving) | Source bin (shipping) |
| Business Partner | Customer (IsCustomer='Y') | Vendor (IsVendor='Y') |
| Typical origin | Customer RMA | Vendor RMA |
| Order reference | Sales Order | Purchase Order |
| Doc Type config key | `doctype.returnMaterialReceipt` | `doctype.returnToVendorShipment` |
| Financial settlement | Credit Memo to Customer | Credit Memo from Vendor |

## How It Differs from Goods Shipment

| Aspect | Return Material Receipt | Goods Shipment |
|--------|------------------------|----------------|
| MovementType | C+ (inbound) | C- (outbound) |
| Stock effect | Increases inventory | Decreases inventory |
| Direction | Customer -> Warehouse | Warehouse -> Customer |
| Typical trigger | RMA authorization | Sales Order |
| Locator meaning | Destination (where to put returned goods) | Source (where to pick from) |

## Schema Design Decisions

1. **RMA reference (M_RMA_ID):** Made editable and searchable at header level since this is the primary workflow trigger. Optional because manual returns without RMA are possible.

2. **Order reference (C_Order_ID):** Points to a SalesOrder (not PurchaseOrder as in the vendor-side equivalent). Editable at header, optional. May be auto-filled from RMA.

3. **RMA line reference (M_RMALine_ID):** On lines, dependent on the header's RMA selection. Enables traceability to authorized return quantities.

4. **Order line reference (C_OrderLine_ID):** On lines, references SalesOrderLine (not PurchaseOrderLine). Dependent on header's order reference.

5. **MovementQty:** Always positive. The `MovementType = C+` tells the stock engine to add to the locator's inventory.

6. **Locator as destination:** Unlike vendor return (where locator is the source bin), here the locator represents where the returned goods will be stored upon receipt.

7. **No price fields on lines:** Same as all M_InOut windows — shipment/receipt lines do not carry pricing. Financial settlement happens via Credit Memo.

8. **Validate_Locator_Available:** Instead of stock validation (as in vendor returns), we validate locator availability since we are receiving goods into a bin, not taking from one.

## Document Type

In Etendo, the document type for return material receipts is typically named "Customer Return" or "Return Material Receipt" and is configured with:
- `DocBaseType = MMR` (Material Movement Receipt)
- `IsSOTrx = Y`
- `IsReturn = Y` (flag distinguishing return doc types from regular ones)

The exact document type ID depends on the Etendo instance configuration.
