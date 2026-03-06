# Purchase Invoice - Research Findings

## Tables

- **Header:** `C_Invoice` (same table as Sales Invoice)
- **Lines:** `C_InvoiceLine` (same table as Sales Invoice lines)
- **Discriminator:** `IsSOTrx = 'N'` (purchase/AP side). The tab-level `WhereClause` filters `C_Invoice.IsSOTrx='N'` to show only purchase invoices.

## Window Identity

- **Window ID:** 183 (Procurement > Transactions > Purchase Invoice)
- **Mirror of:** Sales Invoice (Window 167), same underlying tables differentiated by `IsSOTrx`
- **Document types:** AP Invoice (`doctype.apInvoice`), AP Credit Memo

## Key Differences from Sales Invoice

1. `IsSOTrx` is always `'N'` (hardcoded system field)
2. Document type defaults to AP Invoice instead of AR Invoice
3. Business partner search filters for vendors (IsVendor='Y') rather than customers
4. Price list should default to a purchase price list (IsSOPriceList='N')
5. `dateAcct` is editable (accounting date can differ from invoice date for AP matching)

## Key Differences from Sales Order

- No `warehouse` field on the invoice header (goods receipt is a separate document)
- No `datePromised` or delivery-related fields (delivery happens via M_InOut)
- Has `isPaid` flag (tracks payment status)
- Has `dateAcct` as separate editable field (Sales Order derives it from order date)
- Lines have `TaxAmt` (tax amount per line, computed)
- Lines can reference `M_InOutLine_ID` and `C_OrderLine_ID` for matching

## Three-Way Match (PO -> Receipt -> Invoice)

Etendo supports a three-way match for procurement:

1. **Purchase Order** (`C_Order` with `IsSOTrx='N'`) - commitment to buy
2. **Goods Receipt** (`M_InOut` with `IsSOTrx='N'`) - physical receipt of goods, creates `M_InOutLine`
3. **Purchase Invoice** (`C_Invoice` with `IsSOTrx='N'`) - vendor's bill

The match links are:
- `C_InvoiceLine.C_OrderLine_ID` -> links invoice line to the original PO line
- `C_InvoiceLine.M_InOutLine_ID` -> links invoice line to the receipt line
- `M_MatchInv` table tracks invoice-to-receipt quantity matching
- `M_MatchPO` table tracks PO-to-receipt quantity matching

In practice:
- An invoice can be created manually or generated from a PO/receipt via "Create Lines From" process
- When linked, the system validates that invoiced quantity does not exceed ordered/received quantity
- Full three-way match means all three documents agree on product, quantity, and (optionally) price

## System Fields Pattern

Follows the standard system columns from `core-maps/system-columns.json`:
- `AD_Client_ID`, `AD_Org_ID` from context
- `Created`, `Updated` timestamps
- `Processed` derived from `DocStatus`
- `C_DocType_ID`, `C_DocTypeTarget_ID` default to AP Invoice document type

## Invoice Line Inheritance from Header

Lines inherit from header (via `fromParent` derivation):
- `C_Invoice_ID` (parent FK)
- `DateInvoiced`
- `C_Currency_ID`
- `C_BPartner_ID`
