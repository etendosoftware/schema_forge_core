# Landed Cost - Research Findings

## Window Location

Procurement > Transactions > Landed Cost

## Core Concept

Landed Cost is a specialized procurement document that distributes additional costs (freight, insurance, customs duties, brokerage fees, handling charges) across goods receipt lines. The goal is to adjust the inventory valuation so that the product's unit cost reflects the true total cost of acquisition, not just the purchase price.

## Table Structure

### M_LandedCost (Header)

The document header. Lightweight -- mainly holds documentNo, dateAcct, docStatus, and organization context. It acts as a container for cost lines and receipt references.

Key columns:
- `DocumentNo` -- auto-generated sequence
- `DateAcct` -- accounting date for the cost adjustment postings
- `DocStatus` -- standard document lifecycle (DR -> CO -> VO)
- `C_DocType_ID` -- landed cost document type
- `Processed` -- flag set on completion
- `Description` -- optional free text

### M_LandedCostCost (Cost Lines)

Each line represents one cost component to be distributed. This is where the user defines WHAT costs are being distributed and HOW.

Key columns:
- `M_LandedCostType_ID` -- FK to cost type reference (Freight, Insurance, Customs, etc.)
- `Amt` -- the total amount of this cost component
- `LandedCostDistribution` -- distribution method (list reference):
  - **A (Amount)** -- proportional to receipt line amounts
  - **C (Costs)** -- proportional to existing product costs
  - **Q (Quantity)** -- proportional to received quantities
  - **V (Volume)** -- proportional to product volume attribute
  - **W (Weight)** -- proportional to product weight attribute
- `M_InOut_ID` -- optional: restrict this cost to a specific receipt
- `M_InOutLine_ID` -- optional: restrict this cost to a specific receipt line
- `C_InvoiceLine_ID` -- optional: link to the vendor invoice line for this cost
- `Line` -- line number for ordering

### M_LandedCost_Receipt (Receipt References)

Links the landed cost document to one or more goods receipts. Defines the SCOPE of receipts across which costs will be distributed.

Key columns:
- `M_InOut_ID` -- FK to M_InOut (Goods Receipt)
- `M_LandedCost_ID` -- FK back to header

### M_LandedCostAllocation (Allocations -- Generated)

Created automatically by the Process/Complete action. Each record represents the allocated portion of a cost line to a specific receipt line. These are READ-ONLY for users.

Key columns:
- `M_InOutLine_ID` -- the receipt line receiving the cost allocation
- `M_Product_ID` -- the product on that receipt line
- `Amt` -- allocated cost amount for this receipt line
- `Qty` -- quantity on the receipt line (for reference)
- `Base` -- the base value used in proportional calculation
- `M_LandedCostCost_ID` -- FK to the cost line being distributed
- `M_LandedCost_ID` -- FK back to header

## Relationship to Goods Receipt

```
M_LandedCost (header)
  |
  +-- M_LandedCostCost (cost lines: what costs, how to distribute)
  |     |
  |     +-- optional M_InOut_ID (restrict to specific receipt)
  |     +-- optional M_InOutLine_ID (restrict to specific receipt line)
  |     +-- optional C_InvoiceLine_ID (vendor invoice for this cost)
  |
  +-- M_LandedCost_Receipt (receipt scope: which receipts to allocate across)
  |     |
  |     +-- M_InOut_ID -> M_InOut (Goods Receipt)
  |
  +-- M_LandedCostAllocation (generated: allocated amounts per receipt line)
        |
        +-- M_InOutLine_ID -> M_InOutLine (specific receipt line)
        +-- M_Product_ID -> M_Product (product on that line)
```

## Cost Type Reference (M_LandedCostType)

A simple reference table defining types of landed costs. Common entries:
- Freight
- Insurance
- Customs Duty
- Brokerage
- Handling
- Inspection

Each type typically maps to an accounting account (GL account) for proper posting.

## Document Lifecycle

1. **Draft (DR):** User creates header, adds receipt references, adds cost lines with amounts and distribution methods.
2. **Complete (CO):** System generates M_LandedCostAllocation records by distributing each cost line across the in-scope receipt lines using the specified method. Product costs are updated.
3. **Void (VO):** Reverses all allocations and undoes cost adjustments.

## Distribution Calculation Example

Given:
- Cost line: Freight = 1000, Distribution = Amount
- Receipt has 3 lines: Line A (amount 5000), Line B (amount 3000), Line C (amount 2000)
- Total receipt amount = 10000

Allocations:
- Line A: 1000 * (5000/10000) = 500
- Line B: 1000 * (3000/10000) = 300
- Line C: 1000 * (2000/10000) = 200

## Key Differences from Other Procurement Documents

- **No business partner on header:** Unlike Purchase Orders or Goods Receipts, the landed cost header does not reference a vendor. The vendor for each cost may differ (freight company vs. customs broker) and is tracked via the optional invoice line reference.
- **Multi-receipt scope:** A single landed cost can distribute costs across multiple goods receipts.
- **Generated detail lines:** The allocation tab is entirely system-generated, unlike order/receipt lines which are user-entered.
- **Cost adjustment focus:** The primary output is not a new transaction but an adjustment to existing product costs (inventory valuation).

## Schema Design Decisions

1. **Four entities** (not two): The window has four tabs -- header, cost lines, receipt references, and allocations. This is more complex than a typical master-detail.
2. **Organization editable on header:** Unlike most documents where AD_Org_ID is system-derived, the landed cost header allows org selection since costs may span organizational boundaries.
3. **Allocations are fully read-only:** All fields in the allocation entity are readOnly or system, since they are generated by the completion process.
4. **Cost line has optional receipt narrowing:** A cost line can optionally target a specific receipt or receipt line, overriding the broader receipt scope.
