# Holded-Style UI Upgrade — Design

> Approved design for upgrading the generated UI to a modern, clean Holded-inspired look.

## Architecture

```
App Shell (FIXED):
  SlidePanel component (open/close, overlay, slide animation)
  StatusBadge component (color map per docStatus)
  useEntity hook (unchanged)

Generator (PRODUCES):
  PageComponent — uses SlidePanel + StatusBadge from shell
  Table — hover rows, StatusBadge for status columns
  Form — single-column layout inside panel
  Detail table — stacked below form inside panel
```

## SlidePanel (`tools/app-shell/src/components/ui/slide-panel.jsx`)

Fixed component, never regenerated. Props: `open`, `onClose`, `title`, `children`.

- Slides in from the right edge
- Semi-transparent overlay backdrop (click to close)
- Width ~480px
- Internal scroll for content
- CSS transition animation (transform translateX)

## StatusBadge (`tools/app-shell/src/components/ui/status-badge.jsx`)

Fixed component, never regenerated. Props: `status`.

Color map:
- `DR` — gray (bg-gray-100, text-gray-700) label "Draft"
- `CO` — green (bg-green-100, text-green-700) label "Complete"
- `VO` — red (bg-red-100, text-red-700) label "Void"
- `IP` — yellow (bg-yellow-100, text-yellow-700) label "In Process"

Fallback: gray for unknown statuses. Renders as inline pill (rounded-full, px-2, py-0.5, text-xs, font-medium).

## Generator Changes

### Table (`generateTableComponent`)
- Row hover: `hover:bg-gray-50 transition-colors`
- No heavy borders — use `divide-y divide-gray-100`
- Status-type columns render `<StatusBadge status={row.field} />` instead of plain text
- Import StatusBadge from `@/components/ui/status-badge`
- Detect status columns by field name containing "status" (case-insensitive)

### PageComponent (`generatePageComponent`)
- Row click opens SlidePanel instead of showing form inline
- SlidePanel contains: Form (top) + Separator + Detail table (bottom), stacked with scroll
- Import SlidePanel from `@/components/ui/slide-panel`
- Panel title: entity label + document number (e.g., "Order SO-00001")
- Close panel clears selection

### Form (`generateFormComponent`)
- Single-column layout (not grid-cols-2) for panel width
- More vertical spacing (space-y-3)
- Process buttons at bottom with separator
- Save + Delete buttons in a footer bar

### Detail table inside panel
- Same generated table component, just rendered inside the SlidePanel children
- Compact variant: smaller text, tighter padding

## What Does NOT Change

- `useEntity` hook — zero changes to API or return values
- Props interface of Form/Table — same props contract
- mockFetch — zero changes
- contract.json — zero changes
- Auth, routing, WindowLoader — unchanged

## YAGNI — Not Included

- No dark mode
- No drag-to-resize panel
- No keyboard shortcuts
- No animations beyond panel slide
- No skeleton loading states
