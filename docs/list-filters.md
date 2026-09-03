# List View Filters Reference

Complete reference for the filter stack rendered above every list view (`ListView` component in `tools/app-shell/src/components/contract-ui/ListView.jsx`).

The toolbar can show up to four filter surfaces, always in this left-to-right order:

```
┌──────────────────┐  ┌──────┐  ┌──────┐ ┌──────┐  ┌──┐
│ Subset | Subset  │  │Quick │  │Status│ │Date  │  │▽ │
│ (segmented)      │  │(pill)│  │      │ │range │  │  │
└──────────────────┘  └──────┘  └──────┘ └──────┘  └──┘
     ^                   ^          ^        ^       ^
     1. Subset           2. Quick   3. Document-type filters   4. Advanced
     filters             filters    (auto-added by column type)   filter popover
```

All four combine with AND at query time. Empty / default selections contribute nothing — a totally unfiltered list shows when every surface is at its default state.

## 1. Subset filters (`window.subsetFilters`)

Radio-style segmented control. **Always one active**, mutually exclusive, applied first in the query chain.

- Source: `decisions.json → window.subsetFilters` (propagated by `resolve-curated.js`, emitted by `generate-frontend.js`).
- Visual: a single rounded group of connected buttons, separated by thin dividers.
- Behavior: clicking a different entry switches selection. Clicking the currently active entry does nothing.
- When to use: "which universe am I looking at" — e.g. *All contacts* / *Customers* / *Vendors*, *Open* / *Closed* documents.
- Full schema + examples: [`decisions-reference.md → Subset Filters`](decisions-reference.md).

## 2. Quick filters (`window.quickFilters`)

Independent toggle pills. Each is on/off on its own — any subset (including empty) is valid. Refines whatever subset is active.

- Source (option A): `decisions.json → window.quickFilters`, for pure backend criteria.
- Source (option B): declared inline in a custom window (`tools/app-shell/src/windows/custom/{window}/index.jsx`) when the filter needs extra JSX wiring (e.g. URL-param hydration via `initialQuickFilterIndex`). Prefer a backend `filter` string (`criteria=...`) over `rowFilter` — `rowFilter` only sees rows already loaded by the current pagination batch, so it misses matches on later pages. Reserve `rowFilter` for conditions the backend cannot express.
- Visual: rounded outlined pills (same height and text size as the base doc filters). Active pill: primary-color border and text, subtle tint.
- Behavior: each pill toggles independently. Multiple active pills compose with AND.
- URL bootstrap: custom windows can pass `initialQuickFilterIndex` when the URL query string matches a known preset (e.g. `?filter=pendingDelivery`).
- Full schema + examples: [`decisions-reference.md → Quick Filters`](decisions-reference.md).

## 3. Document-type filters (`ListFilterBar`)

Automatic filters rendered by `ListFilterBar` based on the *types* of the columns exposed by the window's table. No configuration required in `decisions.json` — they appear when the column types are present.

| Column type | Control | Options |
|-------------|---------|---------|
| `status` | Status dropdown | `All` + every status code declared in `enumLabels` (or the global `statuses` dictionary). Single-select. |
| `date` (first date column) | Date range dropdown | `Any time`, `Today`, `Last 7 days`, `Last 30 days`, `Last 12 months` (default), `This year`. |

- Source: auto-discovered from the table's columns array (`columns.find(c => c.type === 'status' | 'date')`).
- Behavior: dropdown menus with a check-mark next to the active option.
- Default: the first `date` column applies `Last 12 months` on first render; the status dropdown starts at `All`.
- All selections write into the shared `columnFilters` state, so they compose with AND against the backend.
- **Option order is fixed, not alphabetical** (ETP-4696, extended by ETP-4913): the status
  options are sorted with `compareStatusCodes` / `STATUS_ORDER` from `lib/statusBadge.js`, so the
  list follows the document flow (Temporary → Draft → In process → Awaiting → Completed →
  Re-opened → Closed → Voided → Unknown) and never changes between openings. The advanced
  filter's value dropdown for the same column sorts with the identical comparator — see
  [`decisions-reference.md`](decisions-reference.md) §"Option order in the two status dropdowns"
  for why the sort is gated to `type: 'status'` columns only.

## 4. Advanced filter popover (funnel icon)

The funnel button on the far right opens a **conditional-filter builder**. Each row is `<Donde|Y|O> <field> <operator> <value>` with a trash icon to remove it. `+ Añadir condición` adds more rows. The `Y/O` connector is a single global choice (either every row joins with AND, or every row joins with OR — no per-row nesting). `Aplicar` commits the draft; `Limpiar` wipes both the draft and the applied filter. `Guardar filtro` is visible but disabled (planned for a later phase).

- Component: `AdvancedFilterBuilder.jsx` (popover body). Criteria translation: `buildAdvancedFilterCriteria(filter, columns)` in `lib/gridQuery.js`.
- State: **ephemeral** — lives in `ListView` `useState`. Refreshing the page clears it.
- Precedence: subset → quick → document-type filters → advanced. All four always combine with AND, *except* the rows inside the advanced block which honor the `Y/O` connector (wrapped in a single `AdvancedCriteria` object when OR is selected).
- Operators per column type:
  - string / selector: `Contiene`, `No contiene`, `Es`, `No es`, `Está vacío`, `No está vacío`
  - enum (status): `Es`, `No es`, `Es cualquiera de`, `Está vacío`, `No está vacío`
  - number / amount: `=`, `≠`, `>`, `≥`, `<`, `≤`, `Entre`, `Está vacío`, `No está vacío`
  - date: `Es`, `Antes de`, `Después de`, `Entre`, `Está vacío`, `No está vacío`
  - boolean: `Es` (value picker uses the column's `badgeLabels`)
- **`Está vacío` / `No está vacío` are dropped for any column with `required: true`** (ETP-4609) — a mandatory field can never legitimately be empty, so those two operators are filtered out of the list regardless of mode. This applies to every column in every window; `required` is read straight off the column object (same one DataTable renders), not from a separate config.
- `Es cualquiera de` (inSet) is **only ever offered for `enum`/status-mode columns** — it is not a general "any field" operator. A text or selector column will never show it in the operator list; that's by design, not a bug.
- Value input adapts to the column type: text/number/date input; enum dropdown using `enumLabels`; boolean dropdown using `badgeLabels`; `Entre` renders two inputs; `Es cualquiera de` takes a comma-separated list of **raw codes** (not translated labels) via a plain text box, matched **case-insensitively** (ETP-4609) — `i,s` matches the same rows as `I,S`. Internally each code is sent as a separate `iEquals` criterion OR-composed together (`buildRowCriteria` → `generateInSetCriteria` in `lib/gridQuery.js`), since the backend's plain `inSet`/`equals` operators are case-sensitive and there is no native case-insensitive "in" operator. The placeholder text is longer than the field and truncates visually (ETP-5008) — the input is wrapped in the shared `Tooltip` primitive (`components/ui/tooltip.jsx`) so hovering or focusing reveals the full "Comma-separated values" text.
- **Changing a row's operator clears its value unless the new operator's widget can meaningfully reuse the old value's shape (ETP-5008).** `updateRow`'s `getValueShape(operator, mode)` classifies each operator into one of `nullish` (isNull/isNotNull, no value) / `pair` (`Entre`, a `[from, to]` array) / `inSet` (the comma-joined free-text string above) / `array` (the identifier picker's list of ids, for selector columns' `Es`/`No es`) / `scalar` (everything else — a single Input/Select/DateField/DistinctEnumPicker value). The value is only kept across an operator switch when both operators map to the same shape (e.g. selector `Es` ↔ `No es` both stay `array`, or `Contiene` ↔ `Empieza por` both stay `scalar` free text); otherwise it resets to that shape's empty value. Before this fix, a value typed under `Es cualquiera de` (a `scalar`-shaped joined string) survived a switch to `Es` on an enum column (whose `DistinctEnumPicker` expects a real code, not that string) because the old reset logic only checked `Array.isArray(value)`, which a joined string never is.
- **`Antes de` / `Después de` exclude the entered day (ETP-4770).** The backend stores datetimes, so a raw `lessThan`/`greaterThan` on the entered date still matched records at `00:00:00` of that same day — `Antes de 2026-05-10` was silently inclusive of the 10th. `buildRowCriteria`/`buildBackendFilter` (`lib/gridQuery.js`) now shift the boundary one day and use the inclusive operator instead: `Antes de <date>` emits `lessOrEqual <date - 1 day>`, `Después de <date>` emits `greaterOrEqual <date + 1 day>`. `Es <date>` and `Entre` are unaffected — they already resolved to a `greaterOrEqual`/`lessOrEqual` day-level range that includes both boundaries.
- The funnel button turns primary-tinted whenever **any** filter is active (column header row *or* advanced).

### Re-editing an identifier filter (`Es` / `No es` / `Es cualquiera de` on selector columns)

`IdentifierMultiPicker` (in `AdvancedFilterBuilder.jsx`) is the value picker used when the operator targets a contact/identifier (FK) field. It resolves option labels via `useDistinctValues`, which hits the list GET's `_distinct` branch to fetch `{id, _identifier}` pairs from the full filterable universe — not just the rows currently loaded in the grid.

- **Before ETP-4770**, the backend fetch was gated on `open` (the popover being open) only. Re-editing an *already-applied* condition showed only what the in-memory grid rows could supply — which is exactly the problem, since those rows are already filtered by the condition being edited:
  - `Es` / `Es cualquiera de` (equals/inSet): the grid only contains rows matching the selected value(s), so there was nothing else to pick from until the user reopened the popover.
  - `No es` (notEqual): the grid *excludes* the selected value(s), so there was no in-memory label for them at all — the closed trigger fell back to showing the raw internal ID instead of a display label.
- **Fix:** the `useDistinctValues` `enabled` condition is now `open || selected.length > 0` — the backend fetch also fires eagerly whenever the picker mounts with a pre-existing selection, independent of whether the popover has been opened yet. This makes re-editing any of the three operators show the full searchable option list and resolve correct display labels immediately, instead of only after the user manually reopens the dropdown.

### Which columns are offered

`AdvancedFilterBuilder` filters the `columns` array it receives (`isFilterableColumn` in
`AdvancedFilterBuilder.jsx`) before building the field dropdown:

- `type: 'discarded'` / `type: 'system'` and `filterable: false` are excluded (unchanged).
- **`type: 'custom'` columns with no `column` (AD field) and no `backendFilterKey` are excluded by default** (ETP-4609). A purely client-rendered cell (e.g. a composite avatar combining two fields, a computed badge) has no real backend property to filter against — offering it showed the column's raw internal `key` as the label (nothing else to fall back to) and silently matched nothing when applied. Opt back in with `filterable: true` only if the custom column genuinely maps to a queryable field via a custom `buildCriteria`.
- If a window needs to filter by a field that is only *shown* merged into a custom cell, declare the real fields as separate column entries (`{ key: 'name', column: 'Name', type: 'string' }`) and hide them from the rendered grid via the `hiddenColumns` prop on `DataTable` — they stay reported to `ListFilterBar` (which reads the full `columns` prop, not the rendered subset) so they appear as correctly labeled, working filters.

### Backend criteria shape

The builder emits a single `criteria=...` string and appends it to the other filter parts inside `effectiveFilter`. For AND, rows are spread flat into the top-level criteria array; for OR, rows are wrapped in an `AdvancedCriteria` object:

```json
[
  { "_constructor": "AdvancedCriteria", "operator": "or", "criteria": [ ... ] }
]
```

This keeps AND composition with the surrounding subset/quick/document-type filters intact while still honoring OR inside the advanced block.

## Composition rules

Every filter surface writes into one of two places:

1. **Backend `criteria=` string** — subset filter, quick filters that provide a `filter` string, and document-type filters (status / date range). `ListView` merges all active backend filters into a single `criteria=[ ... ]` URL-encoded JSON array and passes it as `baseFilter` to `useEntity`.
2. **Client-side `rowFilter`** — subset/quick filters may provide a `rowFilter(row) => boolean` (only from custom-window code, never from JSON). All active row filters + any parent-supplied `rowFilter` compose with AND inside `DataTable`.

Active filter surfaces always combine with AND. There is no OR composition.

## URL-param initialization

Custom windows may hydrate default filter state from the URL so that menu links can deep-link into a specific view. The conventions in use today:

| URL param | Effect |
|-----------|--------|
| `?DocStatus=<code>` | Pre-fills the status dropdown (column filter on `documentStatus`). |
| `?filter=<preset>` | Activates a matching quick filter preset by index. Custom windows define the mapping (e.g. `filter=pendingDelivery` → index 0 of `QUICK_FILTERS`). |

`decisions.json`-driven windows do not have a URL-param hook today — if you need one, declare the filter in the custom window file instead.

## Choosing the right surface

| Need | Surface |
|------|---------|
| Mutually exclusive "view modes" that partition the dataset | **Subset filters** (one always active) |
| Independent on/off refinements inside the current view | **Quick filters** (toggle pills) |
| Standard status / date-range pickers | **Document-type filters** (automatic — just expose the column types) |
| Ad-hoc filter on any column the user picks | **Advanced filter popover** (once the builder ships) |

## Visual parity

All four toolbar surfaces use the same size tokens (`h-9`, `px-3`, `text-xs`) so they align visually. When adding a new control, keep the same dimensions to avoid jagged baselines.

## Related

- [`decisions-reference.md`](decisions-reference.md) — full schema for `subsetFilters` and `quickFilters`.
- [`ui-customization.md`](ui-customization.md) — where custom windows live and how `rowFilter` functions get wired in.
- Source files:
  - `tools/app-shell/src/components/contract-ui/ListView.jsx` — filter state + toolbar layout.
  - `tools/app-shell/src/components/contract-ui/ListFilterBar.jsx` — document-type filters + advanced filter popover.
