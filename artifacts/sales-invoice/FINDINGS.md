# Sales Invoice - Research Findings

## Tables

- **Header:** `C_Invoice` (same table as Purchase Invoice)
- **Lines:** `C_InvoiceLine` (same table as Purchase Invoice lines)
- **Discriminator:** `IsSOTrx = 'Y'` (sales/AR side). The tab-level `WhereClause` filters `C_Invoice.IsSOTrx='Y'` to show only sales invoices.

## Window Identity

- **Window ID:** 167 (Sales Management > Transactions > Sales Invoice)
- **Mirror of:** Purchase Invoice (Window 183), same underlying tables differentiated by `IsSOTrx`
- **Document types:** AR Invoice (`doctype.arInvoice`), AR Credit Memo

## Key Differences from Purchase Invoice

1. `IsSOTrx` is always `'Y'` (hardcoded system field)
2. Document type defaults to AR Invoice instead of AP Invoice
3. Business partner search filters for customers (IsCustomer='Y') rather than vendors
4. Price list should default to a sales price list (IsSOPriceList='Y')
5. Has `salesRep` field (sales representative assigned to the invoice)
6. Invoice lines can reference sales order lines (`C_OrderLine_ID`) and shipment lines (`M_InOutLine_ID`) instead of purchase order/receipt lines

## Key Differences from Sales Order

- No `warehouse` field on the invoice header (shipment is a separate document)
- No `datePromised` or delivery-related fields (delivery happens via M_InOut)
- Has `isPaid` flag (tracks payment status)
- Has `dateAcct` as separate editable field
- Lines have `TaxAmt` (tax amount per line, computed)
- Lines can reference `M_InOutLine_ID` and `C_OrderLine_ID` for matching

## Sales-Side Three-Way Match (SO -> Shipment -> Invoice)

Etendo supports a three-way match for sales:

1. **Sales Order** (`C_Order` with `IsSOTrx='Y'`) - commitment to sell
2. **Shipment** (`M_InOut` with `IsSOTrx='Y'`) - physical delivery of goods, creates `M_InOutLine`
3. **Sales Invoice** (`C_Invoice` with `IsSOTrx='Y'`) - customer's bill

The match links are:
- `C_InvoiceLine.C_OrderLine_ID` -> links invoice line to the original SO line
- `C_InvoiceLine.M_InOutLine_ID` -> links invoice line to the shipment line

In practice:
- An invoice can be created manually or generated from an SO/shipment via "Create Lines From" process
- When linked, the system validates that invoiced quantity does not exceed ordered/shipped quantity

## System Fields Pattern

Follows the standard system columns from `core-maps/system-columns.json`:
- `AD_Client_ID`, `AD_Org_ID` from context
- `Created`, `Updated` timestamps
- `Processed` derived from `DocStatus`
- `C_DocType_ID`, `C_DocTypeTarget_ID` default to AR Invoice document type

## Invoice Line Inheritance from Header

Lines inherit from header (via `fromParent` derivation):
- `C_Invoice_ID` (parent FK)
- `DateInvoiced`
- `C_Currency_ID`
- `C_BPartner_ID`
