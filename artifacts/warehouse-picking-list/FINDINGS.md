# Warehouse Picking List - Research Findings

## Tables

- **Header:** `M_PickingList` -- custom table for warehouse picking operations
- **Lines:** `M_PickingListLine` -- child table, FK via `M_PickingList_ID`

## Purpose

Picking lists guide warehouse workers to collect specific items from designated locators for shipment. They bridge the gap between a sales order and the physical goods shipment process.

## Status Workflow

The `Status` column tracks the picking list lifecycle:

| Status | Meaning |
|--------|---------|
| `Draft` | Picking list created but not yet assigned or started |
| `InProgress` | Warehouse worker is actively picking items |
| `Completed` | All items picked and confirmed |

## Relationship to Sales Orders

Picking list lines can optionally reference a Sales Order (`C_Order_ID`) to trace which customer order each line fulfills. This is informational -- the picking list itself is not a document-action flow like shipments or invoices.

## Relationship to Goods Shipment

```
Sales Order (C_Order, IsSOTrx='Y')
    |
    v  [Generate Picking List]
Warehouse Picking List (M_PickingList)
    |
    v  [Pick items, confirm quantities]
Goods Shipment (M_InOut, IsSOTrx='Y')
```

The picking list is an intermediate step. Once picking is complete, the confirmed quantities feed into the goods shipment. In the initial schema, this integration is manual -- the user creates the shipment separately after completing the picking list.

## Locator Concept

Each picking line specifies a `M_Locator_ID` indicating the physical warehouse location (aisle, rack, bin) where the product should be picked from. The locator is scoped to the warehouse selected on the header.

## Key Fields

### Header
- **documentNo** -- Auto-generated sequence, readOnly
- **pickDate** -- Date when picking is scheduled or performed
- **warehouse** -- The warehouse where picking occurs; scopes available locators on lines
- **status** -- Draft / InProgress / Completed; readOnly (changed via process or workflow)
- **assignedTo** -- The warehouse worker assigned to this picking list
- **priority** -- Optional priority level (High / Medium / Low) for pick queue ordering
- **isActive** -- Standard Etendo active flag

### Lines
- **product** -- The product to pick
- **locator** -- Specific bin/location within the warehouse
- **quantityRequired** -- How many units need to be picked
- **quantityPicked** -- How many units were actually picked (may differ if stock is short)
- **salesOrder** -- Optional reference to the originating sales order
- **uom** -- Unit of measure, readOnly (derived from product default)

## Schema Decisions

- **status** is readOnly -- it should be controlled by workflow or process actions, not manually edited
- **quantityPicked** is editable -- warehouse workers update this as they pick
- **salesOrder** on lines is optional -- picking lists can be created independently of sales orders
- **priority** is a free-text field for now (High/Medium/Low) -- could be a list reference in a future iteration
- **uom** on lines is readOnly -- derived from the product's default UOM
- No pricing fields -- picking lists are purely about physical item movement
- **processed** system field derives from status === 'Completed'
