# Current UI Improvements — Pending Jira Task

Improvements made in the app-shell contract-ui layer, ready to be grouped into a Jira task.

---

## 1. Fix: Eye icon crash on "select all" checkbox (ListView)

**File:** `tools/app-shell/src/components/contract-ui/ListView.jsx`

The bulk-selection toolbar renders a Preview button using `<Eye />` from lucide-react, but `Eye` was missing from the import. Checking the "all" checkbox triggered `ReferenceError: Eye is not defined`, crashing the entire component subtree.

**Fix:** Added `Eye` to the named lucide-react import.

---

## 2. Feature: Inline delete button on tab line rows

**Files:** `tools/app-shell/src/components/contract-ui/DataTable.jsx`, `DetailView.jsx`

When viewing a tab (e.g. Sales Order → Lines), users had to click into a line to open the detail panel before being able to delete it.

**Change:** Added an `onDeleteRow` prop to `DataTable`. When provided, a trash icon appears on hover at the end of each row. Clicking it confirms and deletes the record immediately via the existing DELETE endpoint, without navigating into the detail form.

**Rules:**
- Only shown when `api.crud[entity].delete !== false` and document is not read-only.
- Stops row click propagation (doesn't open the detail panel).
- If the deleted row was the currently open detail, closes it automatically.

---

## 3. Feature: Bulk delete for selected tab lines

**Files:** `tools/app-shell/src/components/contract-ui/DetailView.jsx`

Users can now select multiple lines via the existing checkboxes and delete them all at once.

**Change:** Added `selectedChildRows` state wired to `onSelectionChange` on `DetailTable`. When one or more lines are selected, a bulk action bar appears above the table with a Delete button. Deletions run in parallel (`Promise.allSettled`). Partial failures are reported separately via toast. Clears selection on completion.

**Rules:**
- Same visibility conditions as inline delete (CRUD permission + not read-only).
- Closes the detail panel if the selected line is among the deleted ones.

---

## 4. Fix: Selector dropdown clipped in header form

**Files:** `tools/app-shell/src/components/contract-ui/DetailView.jsx`, `EntityForm.jsx`

The search/selector dropdown (e.g. the Contacto field in Sales Order) was clipped by the header card container. Expanding "Más detalles" made it reappear because it pushed the container height.

**Root cause:** The header card div had `overflow-hidden` (needed for border-radius), which clipped the absolutely-positioned dropdown.

**Fix:**
- Removed `overflow-hidden` from the header card in `DetailView.jsx` (border-radius works without it since no child content overflows the corners).
- Raised dropdown `z-index` from `z-10` to `z-50` in `EntityForm.jsx` (three dropdown states: results, loading, empty).

---

## 5. Chore: Normalize z-index scale across the app

**Files:** many — `artifacts/*/custom/*Modal.jsx`, `*Actions.jsx`, `tools/app-shell/src/components/**`, `tools/app-shell/src/layout/**`, `tools/app-shell/src/windows/custom/**`, `docs/ui-design-guidelines.md`

Dropdowns inside modals were rendering below the modal scrim because they shared `z-50` with the overlay. A handful of components also used arbitrary large values like `zIndex: 200` or `zIndex: 1000`.

**Change:** Consolidated z-index values to the documented elevation scale:
- Modals / drawers stay at `z-50`.
- Dropdowns/popovers rendered **inside** a modal use `z-60` (or `zIndex: 60`).
- Global tools (toasts, command palette, Copilot widget) use `z-70`.

Updated `ui-design-guidelines.md` with the "Dropdown-in-modal" tier and clarified when each level applies.

---

## 6. Chore: Scrim opacity scale

**Files:** multiple drawers/modals, `docs/ui-design-guidelines.md`

Backdrops used a mix of `bg-black/30`, `/40`, `/50`, `/70`. Consolidated to two allowed values:

| Class | Use |
|-------|-----|
| `bg-black/30` | Default scrim for drawers and modals |
| `bg-black/40` | Destructive / critical confirmations only |

Guideline added to `ui-design-guidelines.md`. `bg-black/50` and `/70` remain allowed only for in-image button overlays (e.g., thumbnail close button in `ImageField`).

---

## 7. Fix: Print / Report drawers appeared abruptly and were untranslated

**Files:** `tools/app-shell/src/components/contract-ui/DocumentPrintDrawer.jsx`, `ReportDrawer.jsx`, `tools/app-shell/src/index.css`, `tools/app-shell/src/lib/useAnimatedOpen.js` (new), `tools/app-shell/src/locales/en_US.json`, `es_ES.json`

**Problem 1 — no animation.** Both drawers used `animate-in slide-in-from-right duration-300` / `fade-in`, but the `tailwindcss-animate` plugin is not installed in `tools/app-shell/package.json`, so those classes were no-ops. The drawers snapped in and snapped out.

**Problem 2 — hardcoded English.** Labels ("Document preview", "Download", "Generating…", "Send by email", "Preview", "PDF", "Excel", "CSV", "Print", "Loading all records…", "Rendering report…", etc.) were not using the `useUI` hook.

**Change:**
- Added real CSS keyframes to `index.css`: `scrim-fade-in` / `scrim-fade-out`, `modal-enter` / `modal-exit`, plus the already-existing `sidebar-slide-in` / `sidebar-slide-out`.
- Added a small shared hook `useAnimatedOpen(open, durationMs)` that keeps the component mounted while the exit animation plays, returning `{ shouldRender, isClosing }`.
- `DocumentPrintDrawer` now uses `modal-enter` / `modal-exit` for the panel and the fade classes for the scrim.
- `ReportDrawer` now uses `sidebar-slide-in` / `sidebar-slide-out` for the side panel and the fade classes for the scrim.
- Replaced all hardcoded labels with `ui('key')` calls and added the missing keys to both locale files (`download`, `documentPreview`, `comingSoon`, `report`, `records`, `loadingAllRecords`, `fetchingAllRecords`, `renderingReport`, `jsreportNotAvailable`, `jsreportNotAvailableBanner`, `excel`, `csv`, `pdf`).
