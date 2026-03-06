# Return to Vendor Shipment - Research Findings

## Identity

- **Window:** Return to Vendor Shipment (Procurement > Transactions > Return to Vendor Shipment)
- **Etendo Window ID:** 53012 (approximate, may vary by Etendo version)
- **Tables:** `M_InOut` (header) + `M_InOutLine` (lines)
- **Category:** Procurement

## Relationship to M_InOut

The `M_InOut` table is shared across multiple windows, differentiated by `MovementType` and `IsSOTrx`:

| Window | IsSOTrx | MovementType | Direction | Doc Type |
|--------|---------|-------------|-----------|----------|
| Goods Shipment (Sales) | Y | C- | Customer outbound | Shipment |
| Goods Receipt (Purchase) | N | V+ | Vendor inbound | Goods Receipt |
| Customer Return | Y | C+ | Customer inbound | Customer Return |
| **Return to Vendor Shipment** | **N** | **V-** | **Vendor outbound** | **Return to Vendor** |

The `whereClause` on the tab filters to `IsSOTrx='N' AND MovementType='V-'` to show only vendor return shipments.

## MovementType Encoding

The two-character `MovementType` encodes:
- First character: `V` = Vendor, `C` = Customer
- Second character: `+` = Inbound (receiving), `-` = Outbound (shipping)

So `V-` means "outbound to vendor" — goods leaving the warehouse back to the supplier.

## Relationship to Return to Vendor (RMA)

The typical procurement return flow is:

```
1. Return to Vendor (RMA) — M_RMA — authorization/approval
2. Return to Vendor Shipment — M_InOut (V-) — physical shipment (this window)
3. Credit Memo from Vendor — C_Invoice — financial settlement
```

The RMA (`M_RMA`) is the authorization step. It references the original Goods Receipt (`M_InOut` with `V+`) and specifies which products/quantities are authorized for return.

The Return to Vendor Shipment can be:
- Created manually (selecting vendor and products directly)
- Created from an approved RMA (auto-populating header and lines from RMA)

When linked to an RMA:
- `M_InOut.M_RMA_ID` points to the RMA header
- `M_InOutLine.M_RMALine_ID` points to individual RMA lines

## How It Differs from Goods Receipt

| Aspect | Goods Receipt | Return to Vendor Shipment |
|--------|--------------|--------------------------|
| MovementType | V+ (inbound) | V- (outbound) |
| Stock effect | Increases inventory | Decreases inventory |
| Locator meaning | Destination bin | Source bin |
| Typical origin | Purchase Order | RMA (Return to Vendor) |
| Doc Type config key | `doctype.goodsReceipt` | `doctype.returnToVendorShipment` |
| RMA link | Not applicable | Optional but typical |
| Accounting | Debit inventory | Credit inventory |

## Schema Design Decisions

1. **RMA reference (M_RMA_ID):** Made editable and searchable at header level since this is the primary workflow trigger. Optional because manual returns without RMA are possible.

2. **Order reference (C_Order_ID):** Editable at header, optional. May be auto-filled when selecting an RMA (since the RMA itself references the original receipt, which references the PO).

3. **RMA line reference (M_RMALine_ID):** On lines, dependent on the header's RMA selection. Enables traceability back to what was authorized for return.

4. **Order line reference (C_OrderLine_ID):** On lines, dependent on the header's order reference. Enables traceability to the original purchase.

5. **MovementQty:** Always positive — the `MovementType = V-` handles the directional interpretation. The stock engine subtracts from the locator based on the movement type.

6. **No price fields on lines:** Unlike order lines, shipment lines (M_InOutLine) do not carry price information. Financial settlement happens via the credit memo.

## Document Type

In Etendo, the document type for return to vendor shipments is typically named "Return Material" or "Return to Vendor" and is configured with:
- `DocBaseType = MMS` (Material Movement Shipment) or `MMR` (Material Movement Receipt — confusingly, Etendo may use MMR for returns too)
- `IsSOTrx = N`
- `IsReturn = Y` (flag distinguishing return doc types from regular ones)

The exact document type ID depends on the Etendo instance configuration.
