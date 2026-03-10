# Enterprise Edition — Backlog

Features and windows deferred from Base to Enterprise edition.
Source: `proposal.md` (2026-03-06)

## Windows to move from Base to Enterprise

These 10 windows already exist in Schema Forge (schema + contract + frontend + mockData).
They stay in the repo but are excluded from Base menu and build.

| Window | Current Group | Reason |
|--------|--------------|--------|
| commission-payment | Sales | Advanced sales commission |
| requisition | Procurement | Base uses direct PO |
| manage-requisitions | Procurement | Linked to requisition |
| landed-cost | Procurement | Advanced costing |
| inventory-quality-inspection | Warehouse | Advanced QC |
| bom-production | Warehouse | Manufacturing |
| packing | Warehouse | Advanced logistics |
| warehouse-picking-list | Warehouse | Advanced logistics |
| stock-reservation | Warehouse | Advanced inventory |
| cost-adjustment | Warehouse | Advanced costing |

## Features deferred to Enterprise

### Sales
- Commission Payment module
- Intrastat fields and tabs
- Basic Discounts sub-tab
- Reserved Stock sub-tab
- Line Tax sub-tab

### Procurement
- Requisition workflow (requisition -> manage -> PO)
- Landed Cost calculation
- Matched Purchase Invoices (separate window)

### Inventory
- Quality Inspection
- BOM / Manufacturing
- Packing
- Picking Lists
- Stock Reservation
- Cost Adjustment
- Inventory Amount Update
- Referenced Inventory
- Sales Order for Picking
- Barcode Components Configuration
- Advanced Warehouse features
- Storage Bins (advanced config)

### Accounting & Finance
- Budget management
- End Year Close
- Remittances
- Check Printing
- Payment Execution
- Payment Proposal
- Doubtful Debt
- Advanced Tax Payment
- SII (7 windows) — Spain localization
- Verifactu (3 windows) — Spain localization
- TBAI — Spain localization
- Fixed Assets and Amortization
- Financial Type Configuration (advanced)

### Projects
- Create Sales Orders from Expenses
- Create AP Expense Invoices

### Contacts
- Bank Account sub-tab
- Document Type sub-tab
- Basic Discount sub-tab
- Rappel sub-tab
- Customer Accounting sub-tab
- Intrastat sub-tab

### Products
- Accounting sub-tab
- Costing Rule sub-tab
- Costing sub-tab
- Manufacturing (BOM) sub-tab
- Translation sub-tab
- Characteristics sub-tab
- Barcode sub-tab
- Stock by Logistic Units sub-tab
- Intrastat sub-tab
- Transaction Adjustments sub-tab
