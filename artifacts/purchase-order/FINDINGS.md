# Purchase Order - Schema Research Findings

## Shared Tables with Sales Order

Purchase Orders use the **exact same tables** as Sales Orders:
- **C_Order** (header) with `IsSOTrx = 'N'`
- **C_OrderLine** (lines)

The Etendo AD differentiates them via:
- `AD_Tab.WhereClause`: `C_Order.IsSOTrx='N'` (vs `'Y'` for Sales Order)
- `C_DocTypeTarget_ID` / `C_DocType_ID` pointing to purchase document types
- Window ID 181 (Purchase Order) vs 143 (Sales Order)

## Differences from Sales Order Schema

| Aspect | Sales Order | Purchase Order |
|--------|-------------|----------------|
| `IsSOTrx` derivation | `context.salesTransaction` (true) | `false` (hardcoded) |
| DocType derivation | `doctype.salesOrder` | `doctype.purchaseOrder` |
| BP filter | All BPs (typically customers) | `IsVendor='Y'` only |
| Price list filter | Sales price lists (`IsSOPriceList='Y'`) | Purchase price lists (`IsSOPriceList='N'`) |
| `salesRep` field | Present (editable) | Removed — not standard in PO header |
| `isDelivered` field | Present (readOnly) | Removed — receipt tracking differs for procurement |
| `deliveredQty` on lines | Present (readOnly) | Removed — receipt qty tracked separately in M_InOut |
| `poReference` field | Low prominence (grid: false) | Higher prominence (grid: true, searchable: true) — this is the vendor's reference |
| `isActive` field | Not present | Added (editable) — standard Etendo field |
| Window category | `sales` | `procurement` |

## Additional Rules (vs Sales Order)

Two procurement-specific filter rules were added:
- **PriceList_Filter_Purchase**: Ensures the price list selector only shows purchase price lists
- **BP_Filter_Vendor**: Ensures the business partner selector only shows vendors

These do not exist in Sales Order because the default context typically handles sales-side filtering.

## Assumptions

1. **System field defaults are identical**: `invoiceRule='D'`, `deliveryRule='A'`, `deliveryViaRule='D'`, `freightCostRule='I'`, `priorityRule='5'`, `paymentRule='P'` — same defaults as Sales Order. In practice, Etendo may use different defaults per document type, but these are reasonable starting values.

2. **No `salesRep` on PO**: The Sales Order has a `SalesRep_ID` field. Purchase Orders may have a buyer/purchasing agent field, but it is not standard in the base Etendo PO window. Omitted for now.

3. **No `isDelivered` / `deliveredQty`**: In procurement, goods receipt is tracked via `M_InOut` (Material Receipt). The `QtyDelivered` column exists on `C_OrderLine` but is less prominent in the PO context. Omitted from the initial schema to keep it clean; can be added if needed.

4. **Window ID 181**: This is the standard Etendo window ID for Purchase Order. Should be verified against the actual AD_Window table.

5. **Processes not included**: The `processes.json` was not created because PO processes (Complete, Void, Close, Reactivate) follow the same document action pattern as SO. A separate task should create `processes.json` mirroring the SO pattern but with procurement-specific steps (e.g., no stock reservation on complete — that happens on goods receipt).

6. **Price sourced from purchase price list**: The `Product_AutoFill_Price` rule sources prices from the purchase price list version, not the sales price list. The callout logic is the same but queries `M_ProductPrice` with the PO's `M_PriceList_Version_ID`.
