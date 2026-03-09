# SaaS Base — Implementation Plan

Source: `proposal.md` (2026-03-06)
Architecture: Schema Forge pipeline (schema -> contract -> frontend with mockData)

## Phase 0: Foundation (prerequisite for all phases)

### 0.1 — Reusable Components
Build generic UI components that multiple modules need.

**Task 0.1.1 — KanbanBoard component**
- Generic drag-and-drop Kanban board
- Props: columns (stages), cards (items), onDragEnd, onCardClick
- Used by: CRM, Projects, Presupuestos, Contactos, Productos
- shadcn + dnd-kit or native drag
- Location: `src/components/contract-ui/KanbanBoard.jsx`

**Task 0.1.2 — Chatter component**
- Notes and messages panel (collapsible)
- Props: entityType, entityId, messages[], onAddNote
- Mock mode: stores in memory
- Used by: all transactional documents + contacts + products
- Location: `src/components/contract-ui/Chatter.jsx`

**Task 0.1.3 — KPIHeader component**
- Row of KPI cards at top of a module/window
- Props: kpis[] (label, value, trend, comparison)
- Mini sparkline or delta indicator
- Used by: Dashboard, Sales, Purchases, Inventory, Accounting
- Location: `src/components/contract-ui/KPIHeader.jsx`

**Task 0.1.4 — CalendarView component**
- Monthly calendar with events
- Props: events[], onDateClick, onEventClick
- Used by: RRHH (absences), Projects (tasks), CRM (activities)
- Location: `src/components/contract-ui/CalendarView.jsx`

**Task 0.1.5 — FileUpload component**
- Drag & drop file upload area
- Props: onUpload, accept, multiple
- Used by: DMS, Smart Scan, Attachments
- Location: `src/components/contract-ui/FileUpload.jsx`

### 0.2 — Menu Restructure
Reorganize menu.json from technical grouping to functional modules.

**Task 0.2.1 — Update menu.json**
New structure matching proposal modules:
```
Dashboard (home icon)
CRM (target icon)
Sales (shopping-cart)
  - Sales Quotation, Sales Order, Goods Shipment, Sales Invoice, Return from Customer, Return Material Receipt
Purchases (truck)
  - Purchase Order, Goods Receipt, Purchase Invoice, Return to Vendor, Return to Vendor Shipment
Inventory (package)
  - Stock Overview (new), Physical Inventory, Goods Movements
Accounting (calculator)
  - Accounting Dashboard (new), Invoices, Payments, Bank Reconciliation, Reports
Contacts (users)
  - Business Partner, BP Location
Products (box)
  - Product, Product Category
HR (user-check — new)
Projects (folder-kanban — new)
Documents (file-text — new)
Settings (settings)
  - UOM, User, Warehouse, Price List, Payment Term, Payment Method, Tax
```

**Task 0.2.2 — Remove Enterprise windows from menu**
Remove 10 Enterprise windows from menu.json (keep artifacts for later).

## Phase 1: Dashboard

**Task 1.1 — Dashboard page**
- Route: `/dashboard` (default landing after login)
- KPIHeader with: Revenue (month), Expenses (month), Net Profit, Pending invoices
- Trend chart (last 12 months) — simple SVG or recharts
- Quick actions: + Invoice, + Order, + Contact (links to existing windows)
- Pending tasks panel (mock data: overdue invoices, pending shipments)
- All data from mockData

**Task 1.2 — Copilot widget placeholder**
- Floating chat bubble in bottom-right
- Opens a chat panel with "What do you need today?" prompt
- Mock responses (no real AI integration yet)
- Reusable across all pages

## Phase 2: Simplify Existing Windows

**Task 2.1 — Sales Order simplification**
- Reduce visible fields from ~15 to ~8 (Client, Date, Lines, Price List, Payment Term, Warehouse, Notes)
- Advanced fields behind "More options" expandable section
- Reduce tabs from 7 to 3 (Lines, Taxes, Payments)
- Add KPIHeader to Sales module landing

**Task 2.2 — Purchase Order simplification**
- Reduce to ~7 visible fields (Vendor, Date, Lines, Warehouse, Payment Method, Notes)
- Unify receipt flow (single "Goods Receipt" window)
- Add KPIHeader to Purchases module landing

**Task 2.3 — Business Partner enhancement**
- Add avatar/photo placeholder
- Add activity summary (Last sale, Total invoiced 12m, Pending balance) — from mockData
- Reduce tabs to 3 (General, Addresses, Contacts)
- Add Tags/labels
- Add Chatter component
- Kanban view option

**Task 2.4 — Product enhancement**
- Add product photo placeholder
- Reduce tabs to 4 (General, Prices, Stock, Purchase)
- Stock visible in product card
- Kanban view with photo
- Add Chatter component

## Phase 3: Inventory Simplified

**Task 3.1 — Stock Overview page (new)**
- Main landing for Inventory module
- Grid: Product | Warehouse | Available | Reserved | On Order
- Search/filter by product, warehouse
- KPIHeader: Total SKUs, Low Stock Alerts, Total Value
- Alert badges for products below minimum stock

**Task 3.2 — Inventory Dashboard**
- Visual summary of stock status
- Top movers (most sold/consumed)
- Low stock alerts panel
- Recent movements

## Phase 4: Accounting & Finance

**Task 4.1 — Accounting Dashboard (new page)**
- 4-quadrant layout: Sales Invoices, Purchase Invoices, Bank, Taxes
- Each quadrant: count, total amount, actionable link
- KPIs: Total Revenue, Total Expenses, Net, Cash position

**Task 4.2 — Payments In/Out (new windows)**
- Payment In: register customer payments, link to sales invoices
- Payment Out: register vendor payments, link to purchase invoices
- Schema + contract + frontend + mockData through pipeline

**Task 4.3 — Bank Reconciliation (new window)**
- Upload bank statement (CSV/mock)
- Auto-match with invoices/payments
- Manual matching UI
- Schema + contract + frontend + mockData

**Task 4.4 — Chart of Accounts (new window)**
- Pre-configured by country (mock: Spanish PGC)
- Tree view with account codes
- Debit/Credit/Balance per account

**Task 4.5 — Basic Reports**
- Balance Sheet (report page)
- Profit & Loss (report page)
- General Ledger (report page)
- VAT/Tax report (report page)
- Aging Receivable / Aging Payable (report pages)
- All from mockData

## Phase 5: New Modules — CRM

**Task 5.1 — CRM Pipeline (new window)**
- Kanban view with configurable stages (New, Contacted, Proposal, Won, Lost)
- Opportunity card: contact, estimated value, probability, priority, expected close date, assigned salesperson
- Drag & drop between stages
- List view and Calendar view
- Filters by salesperson, stage, period, priority

**Task 5.2 — CRM Activities**
- Activity types: Call, Meeting, Email, Task
- Schedule with reminders (mock)
- Activity log per opportunity

**Task 5.3 — CRM -> Sales conversion**
- "Won" opportunity creates a Sales Order (mock flow)
- Auto-create Business Partner if new

**Task 5.4 — CRM Reports**
- Conversion rate, Pipeline value, Opportunities by stage
- Report page with charts

## Phase 6: New Modules — HR, Projects, DMS

**Task 6.1 — Employee Directory (new window)**
- Employee card: name, department, position, email, phone, start date, photo
- Kanban by department
- Schema + contract + frontend + mockData

**Task 6.2 — Time Tracking (new page)**
- Clock in/out UI
- Weekly/monthly summary
- Hours per employee

**Task 6.3 — Absence Management (new page)**
- Request form: type, dates, available days
- Approval workflow (mock)
- Team calendar view (CalendarView component)

**Task 6.4 — Projects with Kanban (new window)**
- Project: name, client, responsible, budget, dates
- Tasks as Kanban board (To Do, In Progress, Done)
- Time tracking per task
- Profitability: budget vs cost vs invoiced
- Schema + contract + frontend + mockData

**Task 6.5 — Document Manager (new page)**
- Folder tree (pre-configured: Finance, Contracts, HR, Projects)
- File upload (FileUpload component)
- Auto-link: invoice PDFs go to Finance/Invoices
- Kanban view with preview, List view
- Search by name, type, date

## Phase 7: Onboarding & Polish

**Task 7.1 — Onboarding wizard**
- Step-by-step: Company info -> Bank account -> First product -> First invoice
- Goal: first invoice in <10 min
- Contextual help tooltips

**Task 7.2 — Recurring Invoices**
- Schedule: monthly, quarterly, annual
- Auto-generate from template
- Status tracking

**Task 7.3 — Smart Scan placeholder**
- Upload PDF/image of vendor invoice
- Mock: "AI processing..." -> pre-filled invoice form
- Integration point for future Copilot

## Execution Order

```
Phase 0.1 (Components)  ←── parallel, 4 agents
Phase 0.2 (Menu)        ←── 1 agent, depends on 0.1

Phase 1 (Dashboard)     ←── 2 agents parallel
Phase 2 (Simplify)      ←── 4 agents parallel (one per task)

Phase 3 (Inventory)     ←── 2 agents parallel
Phase 4 (Accounting)    ←── 4 agents parallel

Phase 5 (CRM)           ←── 3 agents parallel
Phase 6 (HR+Proj+DMS)   ←── 4 agents parallel

Phase 7 (Polish)        ←── 3 agents parallel
```

Total: ~30 tasks across 8 phases
Max parallelism: 4 agents per phase (per pipeline rules)
