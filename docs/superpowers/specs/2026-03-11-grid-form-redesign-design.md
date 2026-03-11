# Grid + Form Redesign

## Summary

Replace the current split-view layout (40% table / 60% form panel) with a full-page navigation pattern. The list view becomes a clean minimal table. Clicking a row navigates to a dedicated full-page form with single-scroll layout. Breadcrumb navigation returns to the list.

## Design Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Grid ↔ Form | Full Page Navigate | Max space for forms with 10+ fields + detail lines |
| List view | Clean Minimal Table | Search bar, subtle headers, doc number as link, minimal chrome |
| Detail view | Single Scroll | Breadcrumb sticky, title+summary, form fields, lines — all visible via scroll |

## Architecture

### Two-page pattern

The current `MasterDetailPage` (split view) and `SingleEntityPage` (split view for simple entities) are replaced by two distinct views per window:

1. **ListView** — full-width table with search, renders at `/:windowName`
2. **DetailView** — full-page form with scroll, renders at `/:windowName/:id` (and `/:windowName/new`)

React Router handles the navigation. No panel state, no width transitions.

### Components to create/modify

**New: `ListView.jsx`** (replaces table half of MasterDetailPage)
- Props: `entity`, `columns`, `filters`, `entityLabel`, `token`, `apiBaseUrl`
- Full-width table with:
  - Toolbar: entity name + count badge + search input + "+ New" button
  - Table: subtle uppercase headers, hover rows, doc number as blue link
  - Footer: record count
- Click row → `navigate(\`/${windowName}/${row.id}\`)`
- "+ New" → `navigate(\`/${windowName}/new\`)`

**New: `DetailView.jsx`** (replaces form half of MasterDetailPage + SingleEntityPage)
- Props: `entity`, `detailEntity`, `Form`, `DetailTable`, `summary`, `statusField`, `processes`, `addLineFields`, `catalogs`, `entityLabel`, `detailLabel`, `titleField`, `token`, `apiBaseUrl`
- Sticky breadcrumb bar: `← {entityLabel}` link + status badge + Save button + prev/next arrows
- Title area: doc number + entity identifier + summary values inline
- Form section: 3-column grid of editable fields (reuses `EntityForm`)
- Lines section (if master-detail): separator + "Lines" header + "+ Add" button + detail table
- Add-line via Sheet (bottom slide, same as current)

**Modified: `DataTable.jsx`**
- Remove per-column filter inputs
- Add single search bar that filters across all searchable columns
- Doc number column renders as blue link text (not actual `<a>`, just styled)
- Remove zebra striping, add hover state
- Simplify header style (lighter, no blue background)

**Modified: `EntityForm.jsx`**
- Change from `grid-cols-2` to `grid-cols-3` (full page gives enough width)
- No other changes — field rendering stays the same

**Unchanged:**
- `useEntity` hook — data fetching/mutation logic stays identical
- Generated page files (QuotationPage, SalesOrderPage, etc.) — will pass same props, just to new component
- Mock data, catalogs — unchanged

### Routing changes

Current:
```
/:windowName → WindowLoader → renders MasterDetailPage (split view)
```

New:
```
/:windowName → WindowLoader → renders ListView (full width table)
/:windowName/:id → WindowLoader → renders DetailView (full page form)
/:windowName/new → WindowLoader → renders DetailView (empty form)
```

WindowLoader gains a `useParams()` check for `:id` to decide which view to render, or the generated index.jsx exports both views and WindowLoader routes accordingly.

### Navigation flow

```
List ──click row──→ Detail (/:windowName/:id)
List ──"+ New"───→ Detail (/:windowName/new)
Detail ──"← Back"─→ List (/:windowName)
Detail ──"◀ ▶"────→ Detail (prev/next id)
```

Prev/next navigation uses the list order from `useEntity.items`. The detail view receives the item list (or IDs) to enable prev/next without refetching.

### Breadcrumb bar (sticky)

```
┌──────────────────────────────────────────────────────┐
│ ← Presupuestos          Draft    [Guardar]  [◀] [▶] │
└──────────────────────────────────────────────────────┘
```

- `← {entityLabel}` is a link back to list view
- Status badge (colored by status type)
- Save button (primary, disabled when no changes)
- Prev/Next arrows (disabled at boundaries)
- `position: sticky; top: 0` with `z-index` above content

### Title + summary area

```
QUO-002 · Beta LLC
Total: 12,800 USD · 10 Mar 2026
```

- First line: `titleField` value + primary identifier (business partner, etc.)
- Second line: summary fields inline, separated by `·`
- Both derived from `summary` prop, same data as current summary strip

### Lines section

```
─── LINEAS ──────────────────────────── [+ Agregar] ───
│ #  │ Producto        │ Cant │ Precio │ Desc │ Total │
│ 10 │ Laptop Pro 15"  │ 5    │ 2,400  │ 0%   │12,000 │
│ 20 │ Mouse Wireless  │ 10   │ 80     │ 0%   │ 800   │
```

- Separator line with section label
- Same detail table component, full width
- "+ Add" opens Sheet from bottom (same as current)

## Migration path

1. Build `ListView` and `DetailView` as new components
2. Update routing in WindowLoader to support `/:id` param
3. Update generated page files to use new components (or make them thin wrappers)
4. Remove `MasterDetailPage` and `SingleEntityPage` once all windows are migrated
5. The generated `*Page.jsx` files become routers: if `id` param → DetailView, else → ListView

## What stays the same

- `EntityForm` field rendering (all input types, i18n, inspector highlights)
- `useEntity` hook (fetch, save, delete, add child)
- Mock data and catalogs
- Generated table/form component files (columns, fields declarations)
- i18n integration (useLabel, useMenuLabel)

## Out of scope

- Column resizing or reordering
- Pagination (current mock data is small)
- Inline cell editing in the table
- Drag-and-drop line reordering
