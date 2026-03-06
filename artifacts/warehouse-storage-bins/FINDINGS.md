# Warehouse Storage Bins - Research Findings

## Tables

- **Header:** `M_Warehouse` -- same table as the simple warehouse catalog, but this window exposes full CRUD with address fields and a detail tab
- **Detail:** `M_Locator` -- storage bins / locator positions within a warehouse (FK via `M_Warehouse_ID`)

## Relationship to Existing Warehouse Catalog

The simple "Warehouse" window (id 202) is a flat catalog with Name, SearchKey, Description, and IsActive. The "Warehouse Storage Bins" window (id 203) is the full management view under Warehouse Management > Setup. It adds:

1. Address fields (Address1, Address2, City, Region, PostalCode, Country)
2. A detail tab for M_Locator (storage bin management)

Both windows operate on the same `M_Warehouse` table. The difference is scope and purpose:
- Catalog: quick reference picker
- Storage Bins: full warehouse setup with physical location management

## M_Locator (Storage Bins)

Each locator represents a specific physical position in a warehouse, identified by three coordinates:

| Column | Meaning | Example |
|--------|---------|---------|
| `Value` | SearchKey / unique code | `A-01-03` |
| `X` | Aisle identifier | `A`, `B`, `C` |
| `Y` | Bin / rack position | `01`, `02`, `10` |
| `Z` | Level / shelf height | `01`, `02`, `03` |

### Key Fields

- **PriorityNo**: Picking priority -- lower numbers get picked first. Used by warehouse management to optimize picking routes.
- **IsDefault**: One locator per warehouse can be the default receiving location for new goods receipts.
- **IsActive**: Inactive locators cannot be selected for new transactions but retain historical references.

## Locator Usage in Other Windows

Locators are referenced by:
- `M_InOutLine.M_Locator_ID` -- Goods Receipt / Shipment lines specify which bin goods go to/from
- `M_MovementLine.M_Locator_ID` / `M_LocatorTo_ID` -- Inventory movements between bins
- `M_InventoryLine.M_Locator_ID` -- Physical inventory counts per bin
- `M_Storage_Detail` -- Runtime stock-on-hand per locator

## Schema Decisions

- **address1, address2, city, regionName, postalCode, country** -- all editable, providing the physical address of the warehouse facility
- **city and country** shown in grid for quick identification; other address fields form-only
- **isActive** on warehouse header is readOnly (standard pattern for setup entities)
- **locator.searchKey** is the primary identifier (e.g., `A-01-03`), shown in grid and searchable
- **x, y, z** are all editable strings (not integers) because some warehouses use letter-based aisle codes
- **priorityNo** is integer, editable -- determines pick order
- **isDefault** is editable boolean -- user sets which bin is the default receiving location
- **mWarehouseId** is system/fromParent -- automatically set from the header record

## No Business Rules

This is a pure setup/reference window. There are no callouts, event handlers, or business rules. Validation is limited to:
- SearchKey uniqueness (enforced by DB constraint)
- At most one IsDefault=Y locator per warehouse (enforced at application level, not in scope for initial schema)
