# Commission - Schema Research Findings

## Table Structure

Commission setup uses a header-detail pattern:
- **C_Commission** (header): Defines a commission rule set for a sales representative
- **C_CommissionLine** (detail): Individual commission rules per product, product category, or BP group

## Key Design Decisions

### FrequencyType as String

The `FrequencyType` column in Etendo is a list reference with values:
- `M` = Monthly
- `Q` = Quarterly
- `A` = Annual

Modeled as `type: "string"` with editable visibility. The UI should render a dropdown with these options. In the mock data, human-readable labels are used.

### BusinessPartner = Sales Rep

The `C_BPartner_ID` on `C_Commission` represents the **sales representative** who earns the commission, not a customer. The BP selector should ideally filter to `IsSalesRep='Y'`, but this is handled at the UI/filter level rather than in the schema.

### Commission Line Criteria

Each commission line can specify criteria via three optional foreign keys:
- `M_Product_ID` — specific product
- `M_Product_Category_ID` — entire product category
- `C_BP_Group_ID` — business partner group (customer segment)

These are all optional individually, but at least one should be set for the line to be meaningful. This is captured as a validation rule (`Commission_Line_Criteria_Check`).

### Percentage vs Amount

Commission can be defined as a percentage of the sale amount (`CommissionPercentage`) or a fixed amount per transaction (`CommissionAmt`). At least one must be set. The `QuantityMultiplier` allows scaling the commission by quantity sold.

### DateLastRun

`DateLastRun` is a read-only field that records when the commission calculation process was last executed. It is not user-editable.

### No Document Action Process

Unlike Sales Orders or Invoices, Commission does not have a document action (Complete/Void) flow. There is a separate "Commission Run" process (`C_CommissionRun`) that calculates commissions, but that is a different window. This window is purely setup/configuration.

## Assumptions

1. **Window ID 213**: Standard Etendo window ID for Commission. Should be verified against the actual AD_Window table.

2. **No processes defined**: The Commission window is a setup window. The actual commission calculation happens via a separate process that reads these rules. No processes are defined in this artifact.

3. **Currency from header**: The currency on the commission header applies to all `CommissionAmt` values on lines. Lines do not have their own currency.

4. **IsActive on both levels**: Both header and lines have `IsActive` to allow disabling individual rules without deleting them.
