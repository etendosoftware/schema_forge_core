# Frontend Code Generator — Design

> Approved design for automatic React component generation from contract.json

## What

A CLI tool (`cli/src/generate-frontend.js`) that reads a `contract.json` and produces React components that mount in the app shell. Complemented by an updated `generate-ui` skill for conversational customization with Shadcn/ui.

## Architecture

```
contract.json --> generate-frontend.js --> artifacts/{window}/generated/web/{window}/
                                              ├── OrderTable.jsx        (list + filters)
                                              ├── OrderForm.jsx         (detail/edit)
                                              ├── OrderLineTable.jsx    (child table)
                                              ├── OrderPage.jsx         (header-detail orchestrator)
                                              └── index.jsx             (entry point with props)
```

## Generated Components Per Entity

| Component | What it does |
|---|---|
| `{Entity}Table.jsx` | Table with columns from contract, filters by `searchableFields`, pagination |
| `{Entity}Form.jsx` | Form with fields by visibility (editable -> input, readOnly -> display). Process action buttons in toolbar |
| `{Entity}Page.jsx` | Orchestrator: table on top (header), form + child table below (detail). Manages record selection |
| `index.jsx` | Entry point receiving `{ token, apiBaseUrl, window }` from shell |

## Header-Detail Layout

```
+----------------------------------+
| OrderTable (filters + list)      |  <-- click row
+----------------------------------+
| OrderForm (order detail)         |
| [Complete Order] [Void Order]    |  <-- process action buttons
+----------------------------------+
| OrderLineTable (lines)           |  <-- inline child table
+----------------------------------+
```

## Process Actions

Process buttons render in the form toolbar. Each button:
- Maps to a process from `contract.backendContract.processEndpoints`
- Calls `POST /process/{processName}` with the current record ID
- Shows loading state during execution
- Refreshes the record after completion

## Shadcn Components Added to Shell

New files in `tools/app-shell/src/components/ui/`:
- `table.jsx` — Table, TableHeader, TableBody, TableRow, TableHead, TableCell
- `dialog.jsx` — Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
- `badge.jsx` — Badge (for status: Draft, Completed, Void)
- `select.jsx` — Select for dropdown filters
- `label.jsx` — Label for form fields
- `separator.jsx` — Separator

## Contract Fixture

Create `artifacts/sales-order/contract.json` with:
- **Window**: Sales Order
- **Order entity**: ~12 fields (documentNo, businessPartner, orderDate, warehouse, totalLines, grandTotal, docStatus, currency, paymentTerms, description, deliveryLocation, invoiceAddress)
- **OrderLine entity**: ~8 fields (product, quantity, unitPrice, lineNetAmount, tax, description, discount, deliveredQuantity)
- 2 processes: Complete Order, Void Order (from existing processes.json)
- Searchable fields, visibility model, computed fields
- Backend contract with endpoints

## Generator CLI

```bash
node cli/src/generate-frontend.js artifacts/sales-order/contract.json
```

1. Reads contract.json
2. For each entity: generates Table, Form
3. Detects parent-child relationships -> generates Page with header-detail
4. Generates index.jsx as entry point
5. Outputs to `artifacts/{window}/generated/web/{window}/`

## Shell Integration

The shell's `registry.js` already loads components by entity. The generator produces `index.jsx` with the standard `{ token, apiBaseUrl, window }` signature — the shell mounts it without changes.

## Updated generate-ui Skill

- Changes "inline styles" to Shadcn/ui + Tailwind
- References shell base components (`@/components/ui/*`)
- Used after the automatic generator for customization: layout changes, custom logic, design tweaks

## YAGNI — Not Included

- Drag & drop columns
- Export to Excel/CSV
- Inline editing in table
- Undo/redo
- Complex client-side validation (only required)
- i18n for labels
- Token refresh
- Optimistic updates
