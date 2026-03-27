# Plan ETP-3570 — Sales Flow

Date: 2026-03-25
Status: In progress

## Scope (from Jira)

- Create/manage quotations: customer, lines, prices, validity date
- Convert quotation to sales order
- Manage sales orders: Draft → Confirmed → Closed, stock reservation
- Generate goods shipment from order (total or partial)
- Generate sales invoice from order (individual or bulk) and direct
- Send invoice by email with PDF attachment *(backend — deferred)*
- Register payments (manual or via bank reconciliation)
- Manage customer returns with linked credit note
- Single document template with company logo *(backend — deferred)*
- Email sending engine for all transactional documents *(backend — deferred)*
- Basic reports: sales by period, by product, by customer, pending invoices

## Window Status

| Window | Decisions | Contract | Frontend | NEO | PR |
|--------|-----------|----------|----------|-----|----|
| sales-quotation | ✅ | ✅ | ✅ | ✅ | forge #176 / go #24 |
| sales-order | ✅ | ✅ | ✅ | ✅ | forge #176 / go #24 |
| sales-invoice | ✅ | ✅ | ✅ | ✅ | forge #176 / go #24 |
| goods-shipment | ✅ | ✅ | ✅ | ✅ | forge #176 / go #24 |
| payment-in | ✅ | ✅ | ✅ | ✅ | forge #176 / go #24 |
| return-from-customer | ✅ | ✅ | ✅ | ✅ | forge #176 / go #24 |
| return-material-receipt | ✅ | ✅ | ✅ | ✅ | forge #176 / go #24 |

## Definition of Done (per window)

A window is done when:
1. Header has ≤10 essential visible fields
2. Main process button works (Complete, Process Invoice, etc.)
3. Pushed to NEO + deployed
4. PR passed Git Police
5. Anything else improvable → `feedback.md`, not this ticket

## Phase 1 — Merge open PRs
*Waiting for approval*

- [ ] Merge forge PR #176
- [ ] Merge go PR #24
- [ ] Run `./gradlew export.database` in etendo root

## Phase 2 — E2E Validation

Run the full sales flow in the UI and fix what breaks:

```
Create quotation → Convert to order → Generate shipment → Generate invoice → Register payment
                                                                ↓
                                                   Return → Credit note
```

Per window checklist:
- [ ] Can create a new record without errors
- [ ] Required fields are visible
- [ ] Main process button works
- [ ] Selectors load (customer, product, warehouse)

Each bug found → fix → commit → new PR on the same epic.

## Phase 3 — Sales Reports

| Report (PDF scope) | Etendo artifact | Status |
|--------------------|-----------------|--------|
| Pending invoices (facturas pendientes de cobro) | `aging-receivable` | has report-contract ✅ |
| Sales by period | Search in AD: `node cli/src/menu-cache.js search "sales"` | ❓ |
| Sales by product | Search in AD | ❓ |
| Sales by customer | Search in AD | ❓ |

Steps per report: pipeline → push to NEO → deploy.

## Phase 4 — Close ETP-3570

- [ ] All PRs merged
- [ ] Move Jira ticket to Done
- [ ] Document deferred items in `feedback.md`:
  - Email sending engine (2nd iteration per PDF)
  - Document templates (2nd iteration per PDF)
  - Recurring invoices (explicitly 2nd iteration per PDF)
  - Promotions and rappels (explicitly 2nd iteration per PDF)

## UX Analysis — Field Decisions (based on Holded benchmark)

Date: 2026-03-26

### General Principles

- **No duplicate data**: if it appears in the line summary, don't repeat it in the header.
- **Price List**: derive from Business Partner (default price list). Show as readOnly only if multiple price lists are possible. Otherwise, system field.
- **Unit of Measure**: derive from Product. Don't show in v1 — it's configured on the product itself.
- **Accounting categories / accounts**: don't show. Etendo resolves these behind the scenes via accounting rules. Not relevant for the end user in a simplified SaaS UI.
- **Tax tab**: remove. Each line has a single tax (`C_Tax_ID`). The grouped tax summary belongs in the line summary section, not a separate tab.
- **Others tab**: fields like payment terms, payment method, delivery rules — promote the essential ones to the header, discard the rest or make them system fields.

### Sales Quotation (Presupuesto)

| Area | Show | Derive/Hide |
|------|------|-------------|
| Header | Business Partner, doc number, date, description, payment method, payment terms | Price List (from BP), warehouse (from org) |
| Lines | Product, description, quantity, price, tax, line total | UoM (from product) |
| Summary | Subtotal, tax breakdown, total | — |
| Tabs to remove | Tax (merge into summary) | — |

### Sales Order (Pedido de Venta)

| Area | Show | Derive/Hide |
|------|------|-------------|
| Header | Business Partner, doc number, date, description, payment method, shipping address | Price List (from BP), warehouse (from org), delivery rule, invoice rule |
| Lines | Product, description, quantity, price, discount, tax, line total | UoM (from product) |
| Summary | Subtotal, tax breakdown, total | — |
| Grid columns | Doc number, date, BP, total, status (Draft/Booked/Closed), invoiced (yes/no/partial) | Account (hide), shipped % (defer) |
| Tabs to remove | Tax, Others (promote essentials to header) | — |
| Actions | Complete, Create Shipment (button), Create Invoice (button → navigates to new invoice) | — |

### Sales Invoice (Factura de Venta)

| Area | Show | Derive/Hide |
|------|------|-------------|
| Header | Business Partner, doc number, date, due date, shipping address, payment method, related Sales Order (readOnly) | Price List (from BP) |
| Lines | Product, description, quantity, price, tax, line total | UoM (from product) |
| Summary | Subtotal, tax breakdown, total | — |
| Grid columns | Doc number, due date, BP, description, subtotal, total, status (paid/pending) | Account (hide) |
| Tabs to remove | Tax, Others | — |
| Actions | Complete, Register Payment (creates Payment In), Send (preview + PDF attachment — deferred) | — |

### Goods Shipment (Albarán)

| Area | Show | Derive/Hide |
|------|------|-------------|
| Header | Business Partner, doc number, date, related Sales Order (readOnly) | Warehouse (from org) |
| Lines | Product, description, quantity | UoM (from product) |
| Tabs to remove | Tax, Others, accounting categorization | — |
| Actions | Complete | — |

### Related Documents

All windows should have a "Related Documents" section (or dedicated area) showing linked records:
- Quotation → Orders generated
- Order → Shipments, Invoices
- Invoice → Order, Payments
- Shipment → Order
- Payment → Invoice

Implementation: readOnly field in header if 1:1 (e.g., Invoice → Order). Tab or list section if 1:N (e.g., Order → multiple Shipments).

### Alternative Flows

```
Standard:     Quotation → Order → Shipment → Invoice → Payment
Services:     Quotation → Order → Invoice → Payment (no shipment)
Direct:       Invoice → Payment (no quotation or order)
Quotation:    Quotation → Invoice (skip order)
Return:       Return from Customer → Credit Note
```

### Decisions (resolved 2026-03-26)

1. **Create Shipment from Order**: Both paths. Completing the order auto-creates the shipment (no extra button). The user can also create a shipment manually from the Goods Shipment window. This avoids an extra step for the happy path while keeping flexibility.
2. **Create Invoice from Order**: Yes — button on the order that creates the invoice and navigates to it (Holded-style).
3. **Send Invoice (preview + PDF)**: Deferred to v2 (email engine not in scope).
4. **Multiple taxes per line**: Not possible in Etendo — one `C_Tax_ID` per line. Compound taxes exist as a single record with sub-taxes. No UI change needed. Resolved.

## Deferred (not in this ticket)

These are explicitly marked as 2nd iteration in the product proposal:
- Email sending engine (SendGrid/Mailgun/Amazon SES)
- Single document template with logo
- Recurring invoices
- Online payments via payment gateway
- Promotions and rappels
