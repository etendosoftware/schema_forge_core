# Work Plan: Warehouse, Sales & Financial Management Windows

Date: 2026-03-06

## Current State

- 19 windows live (11 original + 8 procurement)
- 1284 tests passing
- Pipeline proven: schema → F6 → F8 → register → PR → REVIEW/QA → merge

## Inventory from Screenshots

### Warehouse Management

#### Transactions (15 windows)
| # | Window | Type | Pattern | Priority |
|---|--------|------|---------|----------|
| 1 | Physical Inventory | Master-detail (M_Inventory + M_InventoryLine) | Document | HIGH |
| 2 | Goods Movements | Master-detail (M_Movement + M_MovementLine) | Document | HIGH |
| 3 | Inventory Quality Inspection | Single/MD | CRUD | MED |
| 4 | Bill of Materials Production | Master-detail | Document | MED |
| 5 | Goods Transaction | Read-only view | View | LOW |
| 6 | Packing | Master-detail | Document | MED |
| 7 | Incoterm | Single entity (catalog) | CRUD | LOW |
| 8 | Warehouse Picking List | Master-detail | Document | MED |
| 9 | Stock Reservation | Master-detail | Document | MED |
| 10 | Inventory Amount Update | Master-detail | Document | LOW |
| 11 | Cost Adjustment | Master-detail | Document | MED |
| 12 | Referenced Inventory | Master-detail | Document | LOW |
| 13 | Sales Order for Picking | Read-only/process view | View | LOW |

#### Analysis Tools (13 windows -- mostly reports)
| # | Window | Type | Notes |
|---|--------|------|-------|
| 14 | Pareto Product Report | Report | DEFER |
| 15 | Product Operations | CRUD window | MED |
| 16 | Expiration Date Report | Report | DEFER |
| 17 | Offers Report | Report | DEFER |
| 18 | Shipper Report | Report | DEFER |
| 19 | Traceability Report | Report | DEFER |
| 20 | Material Transaction Report | Report | DEFER |
| 21 | Warehouse Control Report | Report | DEFER |
| 22 | Stock Report | Report | DEFER |
| 23 | Stock History | CRUD/view | MED |
| 24 | Product Movements Report | Report | DEFER |
| 25 | Valued Stock Report | Report | DEFER |
| 26 | BOM Production Report | Report | DEFER |

#### Setup (16 windows)
| # | Window | Type | Priority |
|---|--------|------|----------|
| 27 | Reset Unit Cost | Process | DEFER |
| 28 | Process Price Difference Adjustment | Process | DEFER |
| 29 | Warehouse and Storage Bins | Master-detail (M_Warehouse + M_Locator) | HIGH |
| 30 | Shipping Company | Single entity (catalog) | LOW |
| 31 | Freight Category | Single entity (catalog) | LOW |
| 32 | Costing Rules | Single entity (catalog) | MED |
| 33 | Costing Algorithm | Single entity (catalog) | LOW |
| 34 | Landed Cost Type | Single entity (catalog) | LOW |
| 35 | Warehouse Rules | Single entity | MED |
| 36 | Referenced Inventory Type | Single entity (catalog) | LOW |
| 37 | Advanced Warehouse Logs | Read-only view | LOW |
| 38 | Movement Rules Configuration | Single entity | LOW |
| 39 | Barcode Components Configuration | Single entity | LOW |
| 40 | Advanced Warehouse Configuration | Single entity | LOW |
| 41 | EAN128 Type | Single entity (catalog) | LOW |
| 42 | Section Configuration | Single entity | LOW |

### Sales Management

#### Transactions (11 windows)
| # | Window | Type | Pattern | Priority |
|---|--------|------|---------|----------|
| 43 | Sales Quotation | Master-detail (C_Order + C_OrderLine, IsSOTrx=Y, DocType=Quotation) | Document | HIGH |
| 44 | TBAI Facturas Enviadas | Localization-specific (Spain) | CRUD | DEFER |
| 45 | Sales Order | ALREADY EXISTS | -- | DONE |
| 46 | Goods Shipment | Master-detail (M_InOut + M_InOutLine, MovementType=C-) | Document | HIGH |
| 47 | Return from Customer | Master-detail (C_RMA + C_RMALine, customer-side) | Document | HIGH |
| 48 | Return Material Receipt | Master-detail (M_InOut, MovementType=C+) | Document | HIGH |
| 49 | Create Shipments from Orders | Process window | DEFER |
| 50 | Sales Invoice | Master-detail (C_Invoice + C_InvoiceLine, IsSOTrx=Y) | Document | HIGH |
| 51 | Create Invoices From Orders | Process window | DEFER |
| 52 | Generate Invoices | Process window | DEFER |
| 53 | Commission Payment | Master-detail | CRUD | MED |

#### Analysis Tools (13 windows -- mostly reports)
| # | Window | Type | Notes |
|---|--------|------|-------|
| 54 | Sales Dimensional Report | Report | DEFER |
| 55 | Shipments Dimensional Report | Report | DEFER |
| 56 | Discount Invoice Report | Report | DEFER |
| 57 | Sales Order Report | Report | DEFER |
| 58 | Stock for Open Orders | Report | DEFER |
| 59 | Invoiced Sales Order Report | Report | DEFER |
| 60 | Orders Awaiting Invoice Report | Report | DEFER |
| 61 | Delivered Sales Order Report | Report | DEFER |
| 62 | Shipment Report | Report | DEFER |
| 63 | Orders Awaiting Delivery Report | Report | DEFER |
| 64 | Invoice Detail | Report | DEFER |
| 65 | Customer Invoice Report | Report | DEFER |
| 66 | Sales Invoice Dimensional Report | Report | DEFER |

#### Setup (7 windows)
| # | Window | Type | Priority |
|---|--------|------|----------|
| 67 | Condition of the goods | Single entity (catalog) | LOW |
| 68 | Configuracion TBAI | Localization (Spain) | DEFER |
| 69 | Sales Region | Single entity (catalog) | LOW |
| 70 | Commission | Master-detail | MED |
| 71 | Channel | Single entity (catalog) | LOW |
| 72 | Sales Campaign | Single entity (catalog) | LOW |
| 73 | Reject Reason | Single entity (catalog) | LOW |

### Financial Management (sub-menus only visible)
| # | Sub-menu | Notes |
|---|----------|-------|
| 74 | Receivables and Payables | Large module -- needs separate screenshot |
| 75 | Verifactu | Spain localization |
| 76 | Suministro Inmediato de Informacion (SII) | Spain localization |
| 77 | Accounting | Large module -- needs separate screenshot |
| 78 | Assets | Smaller module |

## Execution Plan

### Wave 1: Core Transaction Windows (HIGH priority)
**Parallel batch of 8 agents -- schema research + creation**

1. Physical Inventory (warehouse)
2. Goods Movements (warehouse)
3. Warehouse and Storage Bins (warehouse setup -- extends existing Warehouse)
4. Sales Quotation (sales -- shared C_Order table with isSotrx=Y)
5. Goods Shipment (sales -- M_InOut with MovementType=C-)
6. Return from Customer (sales -- C_RMA customer-side)
7. Return Material Receipt (sales -- M_InOut MovementType=C+)
8. Sales Invoice (sales -- C_Invoice with IsSOTrx=Y)

**Then: F6+F8 generation, registration, PR, REVIEW+QA, merge**

### Wave 2: Secondary Transaction Windows (MED priority)
**Parallel batch of 6-8 agents**

9. Inventory Quality Inspection
10. Bill of Materials Production
11. Packing
12. Warehouse Picking List
13. Stock Reservation
14. Cost Adjustment
15. Commission (sales setup)
16. Commission Payment (sales)

### Wave 3: Catalog/Setup Windows (LOW priority)
**Parallel batch -- simple single-entity windows**

17-35. All remaining LOW-priority single-entity catalogs:
- Incoterm, Shipping Company, Freight Category, Costing Algorithm,
  Landed Cost Type, Referenced Inventory Type, EAN128 Type,
  Section Configuration, Barcode Components, Movement Rules,
  Advanced Warehouse Config, Warehouse Rules, Costing Rules,
  Condition of the goods, Sales Region, Channel, Sales Campaign,
  Reject Reason, Shipping Company

### Wave 4: Financial Management
**Needs separate screenshots of sub-menus to inventory**

- Receivables and Payables
- Accounting
- Assets

### Deferred (not in scope now)
- All report windows (26 total) -- need report generator, not CRUD
- All process windows (5) -- need process execution support
- Spain localization windows (TBAI, Verifactu, SII) -- market-specific
- Read-only views (Goods Transaction, Stock History, etc.)

## Summary

| Category | Windows | In Scope | Deferred |
|----------|---------|----------|----------|
| Warehouse Transactions | 13 | 6 | 7 |
| Warehouse Analysis | 13 | 0 | 13 |
| Warehouse Setup | 16 | 8 | 8 |
| Sales Transactions | 11 | 5 | 6 |
| Sales Analysis | 13 | 0 | 13 |
| Sales Setup | 7 | 5 | 2 |
| Financial Management | 5 | TBD | TBD |
| **Total** | **78** | **~24** | **~49+** |

## Shared Table Patterns (Critical)

- **C_Order**: Sales Order (done), Purchase Order (done), Sales Quotation (wave 1) -- distinguished by IsSOTrx + DocType
- **C_Invoice**: Purchase Invoice (done), Sales Invoice (wave 1) -- distinguished by IsSOTrx
- **M_InOut**: Goods Receipt (done), Goods Shipment (wave 1), Return Material Receipt (wave 1), Return to Vendor Shipment (done) -- distinguished by MovementType
- **C_RMA**: Return to Vendor (done), Return from Customer (wave 1) -- distinguished by IsSOTrx
- **M_Warehouse**: Warehouse (done, catalog), Warehouse and Storage Bins (wave 1, master-detail with locators)
