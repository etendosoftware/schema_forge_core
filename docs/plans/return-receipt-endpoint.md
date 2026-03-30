# Return Receipt Backend Endpoint

**Status:** Pending backend implementation
**Related:** ETP-3570 (Sales flow UI)
**Frontend ready:** Yes — wizard in `artifacts/goods-shipment/generated/web/goods-shipment/ReturnWizard.jsx`

## Endpoint Contract

### POST `/sws/neo/goods-shipment/goodsShipment/{shipmentId}/action/createReturn`

Creates a Return Receipt (M_InOut with movementType='C+') and optionally a Credit Note from a completed shipment.

#### Request Body

```json
{
  "lines": [
    {
      "lineId": "ABC123...",
      "returnQuantity": 5
    }
  ],
  "reason": "Defective items"
}
```

- `lines`: Array of shipment lines to return. Each entry has:
  - `lineId`: ID of the original `M_InOutLine`
  - `returnQuantity`: Quantity to return (must be ≤ original `MovementQty`)
- `reason`: Optional text, stored in the Return Receipt's `Description` field

#### Success Response (200)

```json
{
  "response": {
    "status": 0,
    "data": {
      "returnReceiptId": "DEF456...",
      "returnReceiptDocNo": "1000500",
      "returnReceiptStatus": "CO",
      "creditNoteId": "GHI789...",
      "creditNoteDocNo": "1000501",
      "creditNoteStatus": "DR"
    }
  }
}
```

#### Error Response (400/500)

```json
{
  "response": {
    "status": -1,
    "error": {
      "message": "Cannot create return: shipment is not completed"
    }
  }
}
```

## Backend Implementation Notes

### Return Receipt (M_InOut)

1. Create a new `M_InOut` record:
   - `C_DocType_ID`: Return Material Receipt (movementType = 'C+')
   - `C_BPartner_ID`: Same as original shipment
   - `M_Warehouse_ID`: Same as original shipment
   - `MovementDate`: Current date
   - `Description`: Reason text from request
   - `IsSOTrx`: 'Y' (sales transaction)

2. For each line in the request:
   - Create `M_InOutLine`:
     - `M_Product_ID`: From original line
     - `MovementQty`: `returnQuantity` from request
     - `M_Locator_ID`: From original line
     - `C_OrderLine_ID`: From original line (if exists)
     - `Ref_InOutLine_ID`: Link to original shipment line

3. Process the document (Complete):
   - This triggers stock movement back to warehouse automatically
   - Etendo's `M_InOut_Post` process handles inventory updates

### Credit Note (C_Invoice)

1. Create a new `C_Invoice` record:
   - `C_DocTypeTarget_ID`: AR Credit Memo
   - `C_BPartner_ID`: Same as original shipment
   - `DateInvoiced`: Current date
   - Link to original invoice via the order reference

2. For each returned line:
   - Create `C_InvoiceLine`:
     - `M_Product_ID`: From returned line
     - `QtyInvoiced`: Return quantity (negative)
     - `PriceActual`: From original order line

3. Leave as Draft (DR) — user decides when to complete

### NeoHandler Implementation

Implement as a `NeoHandler` CDI bean with `@Named("createReturn")` qualifier.
Register on the `goodsShipment` entity in `ETGO_SF_ENTITY.JAVA_QUALIFIER`.

The handler should:
1. Validate shipment is Completed (DocStatus = 'CO')
2. Validate all line IDs belong to this shipment
3. Validate return quantities ≤ delivered quantities
4. Create Return Receipt + process it
5. Create Credit Note (draft)
6. Return both document IDs in the response

### Database Tables Affected

- `M_InOut`: New return receipt record
- `M_InOutLine`: New return lines
- `M_Transaction`: Stock movements (auto-created by M_InOut_Post)
- `M_Storage_Detail`: Updated stock levels (auto-updated)
- `C_Invoice`: New credit note (draft)
- `C_InvoiceLine`: Credit note lines

### Existing Etendo Logic to Reuse

- `M_InOut_Post` — Document processing (completes shipment, updates stock)
- `C_Invoice_Post` — If auto-completing credit note
- Return Material Receipt document type already exists in AD
- The `C+` movement type is already handled by Etendo's inventory engine
