# Master-Detail Card Format

## Summary

For master-detail entities (documents with header + lines like Sales Order, Invoice, etc.), replace the current "all fields visible + lines below" layout with a compact card header pattern. The header shows key fields read-only in a dense layout. An "Edit" button expands the card inline to reveal the full form. Lines occupy ~70% of visible space and are always prominent.

Simple entities (no detail lines) keep the current 3-column form layout unchanged.

## Design Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Header format | Compact read-only card | Lines are the focus; header is reference context |
| Edit interaction | Inline expand | No context switch, lines stay visible below |
| Lines prominence | ~70% visible space | Lines are where users spend most time |
| Simple entities | No change | 3-col form is already optimal without lines |

## Architecture

### Detection

The `DetailView` component already receives `DetailTable` as a prop. When `DetailTable` is present, the entity is master-detail. When absent, it's a simple entity.

- `DetailTable` present → Card compact layout (new)
- `DetailTable` absent → Current 3-column form layout (unchanged)

### Card Compact Layout

```
┌──────────────────────────────────────────────────────────┐
│ ← Orders          Draft    [Complete] [Save]  [◀] [▶]   │  ← Sticky breadcrumb (existing)
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ HEADER CARD ──────────────────────────────────────┐  │
│  │ SO-002 · Beta LLC                                  │  │
│  │                                                    │  │
│  │ Date: 10 Mar 2026  ·  Warehouse: Main  ·  ...     │  │
│  │ Total: 12,800  ·  Currency: USD  ·  Lines: 12,000 │  │
│  │                                        [Editar ▾]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ─── LINES ──────────────────────────── [+ Agregar] ──   │
│  │ #  │ Product         │ Qty │ Price  │ Disc │ Total │  │
│  │ 10 │ Laptop Pro 15"  │ 5   │ 2,400  │ 0%   │12,000│  │
│  │ 20 │ Mouse Wireless  │ 10  │ 80     │ 0%   │  800 │  │
│  │ 30 │ USB Cable       │ 20  │ 15     │ 5%   │  285 │  │
│  │    │                 │     │        │      │      │  │
│  │    │                 │     │        │      │      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Expanded Edit State

When user clicks "Editar", the card expands inline:

```
┌─ HEADER CARD (EDITING) ──────────────────────────────┐
│ SO-002 · Beta LLC                                    │
│                                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ Date        │ │ Warehouse   │ │ Price List  │    │
│ │ [2026-03-10]│ │ [Main    ▾] │ │ [General ▾] │    │
│ ├─────────────┤ ├─────────────┤ ├─────────────┤    │
│ │ Payment Term│ │ Pay Method  │ │ Delivery    │    │
│ │ [Net 30  ▾] │ │ [Wire    ▾] │ │ [🔍 search] │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
│ ... (all editable fields in 3-col grid)              │
│                                        [Cerrar ▴]   │
└──────────────────────────────────────────────────────┘
```

### Components

**New: `CompactHeader.jsx`**
- Props: `fields` (from Form component), `data`, `titleField`, `summary`, `isExpanded`, `onToggle`, `onChange`, `catalogs`, `entity`
- Collapsed state: Title + subtitle + summary fields in dense `text-sm` rows using `SummaryBar`-like rendering
- Expanded state: Renders the `Form` component (EntityForm) inside the card with 3-col grid
- "Editar/Cerrar" toggle button at bottom-right of card
- Smooth height transition via CSS (`max-height` or `grid-row` transition)
- Card styling: `rounded-lg border bg-card shadow-sm`

**Modified: `DetailView.jsx`**
- When `DetailTable` is present: render `CompactHeader` + lines section
- When `DetailTable` is absent: render current layout (title + SummaryBar + Form)
- The `CompactHeader` receives the `Form` component to render when expanded
- Lines section moves up to take more space when header is collapsed

**Modified: `EntityForm.jsx`**
- Add `readOnly` field rendering: when a field has `readOnly: true`, render as plain text (not input)
- This allows the compact card to use EntityForm fields for display

**Unchanged:**
- `SummaryBar.jsx` — reused inside CompactHeader for collapsed state
- `ListView.jsx` — no changes
- Generated page files — no changes needed (props already flow correctly)
- `useEntity` hook — no changes

### Compact Header Field Display

In collapsed state, the card shows:
1. **Title line**: `titleField` value + first non-title summary field (e.g., "SO-002 · Beta LLC")
2. **Summary rows**: All editable + readOnly fields rendered as `Label: Value` pairs, wrapped in 2-3 rows
   - Uses the same field definitions from the Form component
   - Only shows fields that have values (skip empty/null)
   - Groups: editable fields first, then readOnly fields

### Transition

- Expand/collapse uses CSS `transition` on the card container
- `overflow: hidden` during transition to prevent layout jump
- Duration: 200ms ease-out

## What stays the same

- Breadcrumb bar (sticky, unchanged)
- Lines section (separator + header + "+ Add" + detail table + Sheet for add-line)
- Simple entity layout (no DetailTable → current 3-col form)
- All data hooks, i18n, catalogs, processes
- Generated page files (no prop changes needed)

## Out of scope

- Field grouping/sections within the form
- Drag-and-drop line reordering
- Inline line editing
- Card animation beyond simple height transition
