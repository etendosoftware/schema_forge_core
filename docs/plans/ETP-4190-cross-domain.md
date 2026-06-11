# ETP-4190 — Cross-domain plan

**Feature:** Product window UX polish — image field layout fix, auto-save on
blur, plus visual fixes for the Amortization and Assets windows.

This PR is approved as cross-domain because the image field fix requires
changes to two shared `contract-ui` components (`EntityForm.jsx`,
`ImageField.jsx`) that are used by every generated window, alongside
window-specific changes to Product, Amortization, and Assets.

## Domains touched

### `platform-change` (shared contract-ui)

The image layout fix lives in shared components that every window uses:

- `tools/app-shell/src/components/contract-ui/ImageField.jsx` — `stretch` mode
  now renders the preview as `absolute inset-0` inside a `relative flex-1
  min-h-[176px]` wrapper, taking the preview out of the CSS flow so it never
  expands CSS Grid row heights when a large image file is loaded. Non-stretch
  usage (fixed `h-44`) is unchanged.
- `tools/app-shell/src/components/contract-ui/EntityForm.jsx` — removed
  `h-full` from the inline image container class (`row-span-2 flex flex-col`)
  to eliminate the circular percentage-height dependency with auto-sized grid
  rows.

### `window:product` (primary)

- `artifacts/product/decisions.json` — `"autoSaveOnBlur": true` added.
- `artifacts/product/generated/web/product/ProductPage.jsx` — regenerated;
  `autoSaveOnBlur` prop now passed to `DetailView`.
- `artifacts/product/contract.json`, `contract.mcp.json` — regenerated
  alongside `decisions.json` change (no contract logic changed).
- `docs/generated-custom-windows/product.md` — updated with image layout
  rationale, auto-save behavior, and image exclusion from blur trigger.

### `window:amortization`

- `tools/app-shell/src/windows/custom/amortization/AmortizationLinesTable.jsx`
  — `DimensionGrid` now accepts `isCompleted` prop; when `true`, the
  `[&_input:disabled]:!opacity-100` override is removed so Tailwind's default
  `disabled:opacity-50` applies and dimension inputs appear visually greyed out
  on processed documents. Asset `<th>` gets `w-64` to prevent the column from
  absorbing all available table space on wide viewports.
- `docs/generated-custom-windows/amortization.md` — updated.

### `window:assets`

- `tools/app-shell/src/windows/custom/assets/AssetsDetailPanel.jsx` —
  `GroupDivider` wrapper gains `mt-5` so each section heading has visible
  breathing room above the `border-t` separator line.
- `docs/generated-custom-windows/assets.md` — updated.

## Tests

- The `ImageField.jsx` change is purely layout (CSS classes); no logic branch
  was altered. Existing `ImageField` render tests continue to pass.
- `EntityForm.jsx` change removes one Tailwind class from the image container;
  no logic change. Existing EntityForm tests unaffected.
- Amortization and Assets changes are visual-only (CSS class conditions,
  margin). Existing Vitest suites for both windows are green.

## Rollback

All changes are visual and additive:

- **Image layout:** revert `ImageField.jsx` and `EntityForm.jsx` to restore the
  previous `flex-1 min-h-[176px]` preview and `h-full` container. No data or
  API change involved.
- **Product auto-save:** remove `autoSaveOnBlur: true` from
  `artifacts/product/decisions.json` and run `make regen ONLY=product`. Fields
  return to manual-save behavior. No data change.
- **Amortization:** revert `AmortizationLinesTable.jsx`; dimensions revert to
  full-opacity disabled inputs when processed. Column width reverts to
  unconstrained. No data change.
- **Assets:** revert `AssetsDetailPanel.jsx`; `GroupDivider` loses `mt-5`.
  No data change.
