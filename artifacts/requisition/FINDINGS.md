# Requisition Window - Schema Research Findings

## Etendo AD Table Mapping

| Entity | Table | Description |
|--------|-------|-------------|
| requisition | `M_Requisition` | Header: document number, date, status, warehouse, price list |
| requisitionLine | `M_RequisitionLine` | Lines: product, quantity, unit price, need-by date |

Window location in Etendo: **Procurement Management > Transactions > Requisition**

## Pattern Classification

**TRANSACTIONAL master-detail** — follows the same pattern as Sales Order (`C_Order` / `C_OrderLine`).

Key similarities with Sales Order:
- Document lifecycle (Draft -> Complete -> Void) via `DocStatus`
- DocumentNo (auto-sequence, readOnly)
- Header totals (`TotalLines`, `GrandTotal`) computed from lines
- Warehouse and PriceList on header
- Product, Qty, UnitPrice, LineNetAmt on lines
- System fields: client, org, processed, created, updated

Key differences from Sales Order:
- **No IsSOTrx flag** — Requisitions are purely procurement-side, not sales/purchase dual-use like C_Order
- **No delivery tracking** — no `QtyDelivered`, `IsDelivered`; requisitions are requests, not fulfillment docs
- **No payment fields** — no PaymentTerm, PaymentMethod, PaymentRule (not a financial document)
- **No partner address** — `C_BPartner_Location_ID` not typically required at header level
- **NeedByDate on lines** — each line can have its own required date (unlike Sales Order where DatePromised is header-level)
- **Line-level vendor** — `C_BPartner_ID` on lines allows different suppliers per line item
- **AD_User_ID on header** — tracks the requesting user (the person who created the requisition)
- **Simpler document type** — single `C_DocType_ID` (no target doc type distinction)

## Assumptions (no DB access)

1. **Window ID `800006`** — placeholder; actual AD_Window_ID must be verified against the Etendo database.
2. **Column names** — based on standard Etendo naming conventions for M_Requisition and M_RequisitionLine tables. The core columns (DocumentNo, DocStatus, Processed, Qty, PriceActual, LineNetAmt, Line) follow Etendo standard patterns.
3. **PriceActual vs PriceList** — assumed `PriceActual` for the editable unit price on lines (matching C_OrderLine pattern). The actual column could be `PriceUnit` in some Etendo versions.
4. **TotalLines / GrandTotal** — assumed these exist on M_Requisition as computed summary columns. Some Etendo versions may only have one total column.
5. **C_Currency_ID** — assumed present on header as system field derived from context/price list.
6. **DateDoc** — assumed present as the document creation date (distinct from DateRequired which is the need-by date).
7. **Business Partner on header** — marked as optional (`required: false`) because requisitions can be created without a specific vendor (vendor may be selected later during PO creation).

## Potential Issues / Unknowns

- **Process button** — Requisition likely has a "Complete" process button (like Sales Order). This would need a `processes.json` file once process definitions are added.
- **Requisition-to-PO link** — Etendo has a process to generate Purchase Orders from approved Requisitions. This cross-document flow is not modeled in the schema but would be relevant for rules/processes.
- **Approval workflow** — Some Etendo configurations require requisition approval before completion. This may involve additional status transitions not captured here.
- **AttributeSetInstance** — Lines may support `M_AttributeSetInstance_ID` for lot/serial tracking, not included in this initial schema.
- **Matched PO lines** — `M_RequisitionLine` may have `C_OrderLine_ID` to track which PO line fulfilled the requisition. Omitted as system/internal field for now.

## Next Steps

1. Validate column names against actual Etendo database schema
2. Add `processes.json` with Complete/Void document processes
3. Add rules for auto-fill behaviors (product -> UOM/price, line recalculation)
4. Verify window ID from AD_Window table
