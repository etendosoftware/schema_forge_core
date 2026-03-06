# Manage Requisitions - Research Findings

## Relationship to the Requisition Window

"Manage Requisitions" (Procurement > Transactions > Manage Requisitions) and "Requisition" (Procurement > Transactions > Requisition) are **two separate Etendo windows over the same underlying tables**: `M_Requisition` (header) and `M_RequisitionLine` (lines).

They share the same DB schema but differ in purpose, field visibility, and available actions.

## Same Tables, Different Views

| Aspect | Requisition (800006) | Manage Requisitions (800161) |
|--------|---------------------|------------------------------|
| Primary table | M_Requisition | M_Requisition |
| Line table | M_RequisitionLine | M_RequisitionLine |
| Purpose | Create and edit requisitions | Review, approve, and convert to PO |
| Target user | Requester (any employee) | Procurement manager / approver |
| Field editability | Header and lines are editable | All fields are readOnly |
| Tab WHERE clause | None or `DocStatus IN ('DR','IP')` (user's own drafts) | Filters to submitted/completed/pending statuses |
| Organization scope | Typically user's own org | Cross-org visibility for managers |

## What Distinguishes the Management View

### 1. ReadOnly Nature
The entire window is a review/inspection view. Managers do not modify requisition data. All fields on both header and lines are readOnly. The only "editable" actions are document-level processes (approve, reject, create PO).

### 2. Broader Visibility
The Requisition window typically shows requisitions created by the current user or their department. The Manage Requisitions window shows requisitions across the organization (filtered by the manager's org access level), allowing centralized procurement oversight.

### 3. Approval Workflow (DocAction)
The standard Etendo document action mechanism handles approval:
- **Complete** = Approve the requisition
- **Void** = Reject the requisition
- **Close** = Close after partial fulfillment
- **Reactivate** = Send back for revision

### 4. Create PO from Requisition Process
This is the key differentiating process. It:
- Takes one or more approved requisition lines
- Groups them by vendor (`C_BPartner_ID` on `M_RequisitionLine`)
- Creates Purchase Order(s) with corresponding lines
- Links back via `M_Requisitionorder_ID` and `Orderedqty` columns on `M_RequisitionLine`
- Supports multi-record selection (batch conversion)

### 5. Fulfillment Tracking Fields
The management view exposes fields not typically shown in the basic Requisition window:
- `Orderedqty` (M_RequisitionLine) - Quantity already placed on Purchase Orders
- `M_Requisitionorder_ID` (M_RequisitionLine) - Link to the generated PO
- `AD_User_ID` (M_Requisition) - Prominently displayed so managers can see who requested what
- `AD_Org_ID` (M_Requisition) - Visible for cross-org filtering

## Key Columns on M_RequisitionLine for Management

| Column | Purpose |
|--------|---------|
| `Orderedqty` | Tracks how much of the requested quantity has been placed on POs |
| `M_Requisitionorder_ID` | FK to the Requisition-to-Order mapping record |
| `C_BPartner_ID` | Preferred vendor per line (used for PO grouping) |
| `NeedByDate` | Per-line urgency date, critical for prioritization |

## Is This a Standard CRUD or Dashboard?

**Neither exactly.** It is a standard Etendo window (not a process window or dashboard), but configured as a **readOnly management view** with process buttons. The pattern is common in Etendo for "Manage X" windows:
- Same tables as the CRUD window
- Different tab WHERE clause to show a relevant subset
- Fields set to readOnly at the tab or field level
- Process buttons for management actions (approve, convert, etc.)

This is analogous to how "Sales Order" (CRUD) and a hypothetical "Manage Sales Orders" would share `C_Order` but differ in editability and available processes.

## Schema Design Decisions

1. **All fields readOnly**: Since this is a review window, all fields from `M_Requisition` and `M_RequisitionLine` are classified as `readOnly` (not `editable`).
2. **Organization promoted**: `AD_Org_ID` is `readOnly` (visible) rather than `system` (hidden), because managers need to see and filter by organization.
3. **User/requester prominent**: `AD_User_ID` is shown in the grid for quick identification.
4. **Fulfillment columns added**: `Orderedqty` and `M_Requisitionorder_ID` are included on lines, which are not present in the basic Requisition schema.
5. **DateDoc visible**: Document date is exposed as readOnly for audit/review purposes.
6. **Currency visible**: Shown in the grid header for quick reference across multi-currency environments.

## Window ID Note

The window ID `800161` is an estimate. The actual ID depends on the Etendo installation and whether this is a core window or module-contributed window. In some Etendo versions, this window may be contributed by the `com.smf.procurement` or similar module. The exact ID should be confirmed against a live Etendo AD database.
