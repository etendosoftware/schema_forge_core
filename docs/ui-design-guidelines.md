# UI Design Guidelines — app-shell

Conventions for building UI components inside `tools/app-shell/src/`. These rules apply to all developers writing shared components, custom window components, and layout elements.

---

## Z-Index Elevation Scale

Use this scale for all z-index decisions. Do not use arbitrary values outside these tiers.

| Level | Value | Purpose | Examples |
|-------|-------|---------|---------|
| **Base** | `auto` | Normal document flow | Table rows, form fields, page sections |
| **Surface** | `z-10` | Sticky or relative-positioned overlays | Page-level loading overlays, image layering |
| **Floating** | `z-20` | Small local floating elements | `UserAvatarButton` dropdown, inline tooltips |
| **Sticky** | `z-30` | Sticky table headers, fixed section bars | Table headers in scroll containers |
| **Navigation** | `z-40` | App-level navigation chrome | **Sidebar**, bottom navigation bar |
| **Overlay** | `z-50` | Full-screen blocking overlays and modals | **Modals** (`NewPaymentModal`, `ReportViewerPage` modals), **Drawers** (`ProductSearchDrawer`, `ReportDrawer`) |
| **Dropdown-in-modal** | `z-60` | Dropdowns or menus that appear inside a modal | `Select`, `Combobox`, popovers rendered inside a `z-50` modal |
| **Global tools** | `z-70` | App-wide tools always accessible — one level above the max modal tier | `CommandPalette`, **Toasts (Sonner)**, `CopilotWidget` |

### Rules

1. **Sidebar is always below modals.** Sidebar = `z-40`. Full-screen overlay = `z-50`. This ensures the overlay covers the sidebar.
2. **Dropdowns inside modals must use `z-60`.** A `Select` or `Combobox` inside a modal at `z-50` will be clipped if its dropdown is also `z-50`. Always use `z-60` (or `z-[60]`) for list popups rendered inside an overlay.
3. **Do not use raw `zIndex` in inline styles** unless you are outside Tailwind's scale (e.g., `zIndex: 1000` in DataTable inline combo — must be refactored to `z-[1000]` and documented).
4. **Global tools must always float above everything.** Toasts, the command palette, and the Copilot widget must stay one level above the highest modal tier (`z-60` + 1 = `z-70`). Use `z-70`. Never use arbitrary large values like `9999`.
5. **Never use arbitrary z-index values (`9999`, `1000`, etc.).** Always pick the next step in the scale. If nothing needs to be above it, `z-50` is enough. If a dropdown needs to sit above a modal, use `z-60`. If a global tool needs to sit above everything, use `z-70`.
6. **Never reuse `z-50` for navigation.** Navigation elements that should be permanently visible must stay at `z-40` or below so they can be covered by blocking overlays.

---

## Scrim Opacity Scale

All full-screen blocking overlays darken the background with a `bg-black/XX` scrim. Only two values are allowed:

| Class | Alpha | Purpose | Examples |
|-------|-------|---------|----------|
| **`bg-black/30`** | 30% | Default scrim for drawers and modals | `DocumentPrintDrawer`, `ProductSearchDrawer`, `ReportDrawer`, `SendDocumentModal`, `NewPaymentModal`, shadcn `dialog`/`sheet` |
| **`bg-black/40`** | 40% | Destructive / critical confirmations only | Delete confirmation modals (`PriceListProductPrices`) |

Do not introduce new opacity values (`bg-black/20`, `/50`, `/60`, `/70`, `/80`). If you need more emphasis than `/30`, it is a destructive action — use `/40` and keep the panel copy explicit ("This action cannot be undone").

**Exception:** `bg-black/50` and `bg-black/70` are allowed **only** for button overlays rendered on top of an image (e.g., the close button on a thumbnail in `ImageField`). They are not scrims and are not subject to this rule.

---

## Overlay / Modal Pattern

All full-screen blocking overlays must follow this structure:

```jsx
{/* Scrim — covers the whole screen including sidebar */}
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
  {/* Panel — stops click propagation so it doesn't close the modal */}
  <div className="bg-white rounded-xl shadow-lg ..." onClick={e => e.stopPropagation()}>
    {/* content */}
  </div>
</div>
```

- **`fixed inset-0`** — covers the entire viewport.
- **`bg-black/30`** — standard scrim opacity. Use `bg-black/40` for destructive confirmations (see Scrim Opacity Scale above).
- **`onClick={onClose}` on the scrim** — always allow click-outside-to-close.
- **`e.stopPropagation()` on the panel** — prevents the scrim click handler from firing.

---

## Drawer Pattern

Drawers use the same z-level as modals — scrim and panel both at `z-50`:

```jsx
{/* Scrim */}
<div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
{/* Panel */}
<div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={onClose}>
  <div className="bg-white rounded-xl ..." onClick={e => e.stopPropagation()}>
    {/* content */}
  </div>
</div>
```

Both at `z-50` because the Sidebar is `z-40` and both scrim and panel need to cover it.

---

## Known Violations (to fix)

| File | Line | Issue |
|------|------|-------|
| `DataTable.jsx` | ~101, ~109 | Inline `zIndex: 1000` — should use `z-[1000]` Tailwind class or be refactored to `z-60` |
| `EntityForm.jsx` | ~218, ~233, ~238 | Dropdowns inside forms use `z-50` — fails if form is ever rendered inside a `z-50` modal |
| `ListView.jsx` | ~274 | Sort popover uses `z-50` — acceptable today (outside modal), keep under review |
| `DetailView.jsx` | ~867 | Kebab menu uses `z-50` — acceptable today |

---

## Column Alignment in Tables

- **`type: 'amount'`** columns → `text-right` on cells and footer totals, `text-left` on headers.
- All other column types → `text-left` on both headers and cells.
- **Rule:** headers are always left-aligned. Only cell content or input alignment may follow the data type.

See `DataTable.jsx` for the reference implementation.

---

## References

- Component implementations: `tools/app-shell/src/components/contract-ui/`
- Layout: `tools/app-shell/src/layout/`
- Custom window components: `artifacts/{window}/custom/`
