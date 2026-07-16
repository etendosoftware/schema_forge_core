# CSV Import — UX Polish Pass — Design

- Date: 2026-07-14
- Status: approved (reviewed by user 2026-07-14)
- Repos touched: `schema_forge_core` (all code changes); `etendo_schema_forge` is a
  consumer only — no changes needed there beyond bumping the published package once
  this ships and re-testing against the Contacts/Product windows.

## Problem

Manual testing of the CSV import dialog (Contacts and Products windows, against
`localhost:3100`) surfaced eight concrete UX/correctness issues, all confirmed against
the current code on `feature/ETP-4447`:

1. The status filter pills ("All"/"Correct"/"Errors") show no counts.
2. The Skip action icon (`SkipForward`) doesn't read as "skip/exclude this row".
3. The pre-send "Re-validate" button is redundant once mapping changes auto-revalidate
   (see #8) — remove it.
4. The review grid's scrollbar is supposed to be more visible than the browser default
   but isn't, in practice.
5. When a row's error is on a column scrolled out of view, there is no way to discover
   that from the visible part of the grid.
6. The per-column mapping dropdown renders two overlapping chevron icons.
7. The column-mapping step is a large, low-value wall of 15+ label+select pairs.
8. Changing a column's mapping has no effect on the grid — it silently does nothing.

All eight are scoped to
`packages/app-shell-core/src/components/import/` (`ImportReviewQueue.jsx`,
`ImportColumnMapping.jsx`, `ImportDialog.jsx`) and `packages/app-shell-core/src/styles.css`.
No backend changes.

## 1. Status filter pill counts

**Current state:** `ImportReviewQueue.jsx:368-379` renders `STATUS_FILTERS` (`all`/`ok`/
`error`, lines 40-44) as plain-text `Button`s with no count. Two separate places already
compute similar bucket counts independently: `visibleEntries` in `ImportReviewQueue.jsx`
(304-310, filtered by the *current* filter, not per-bucket) and `validCount`/`skipCount`
in `ImportDialog.jsx:251-252` (used for the "Import N" button).

**Design:** add a single derived-counts computation — `{ all, ok, error }` — from the
full `entries` array (not `visibleEntries`), passed into `ImportReviewQueue` or computed
inside it since it already receives `entries`. Render as a small numeral badge next to
each pill label (e.g. `Correct (12)`). This becomes the one place that owns bucket
counting; `ImportDialog.jsx`'s `validCount`/`skipCount` are left as-is (different
purpose — gating the Import button) but should visibly reuse the same predicate if
convenient, to avoid the two computations drifting apart.

## 2. Skip icon

**Current state:** `SkipForward` (lucide-react) at `ImportReviewQueue.jsx:465-471` and
`550-557`.

**Design:** replace with `Ban` (already installed, `lucide-react@^0.400.0`, no new
dependency) — a filled circle with a diagonal slash reads unambiguously as
"exclude/don't process this row", matching the actual effect of Skip (the row is
excluded from send). Same two call sites, same `title={text.skip}`.

## 3. Remove pre-send "Re-validate"

**Current state:** `ImportReviewQueue.jsx:449-459` (pre-send instance only —
confirmed separate from the post-send "Retry" instance at `523-533`, which is kept).
Wired to `handleRetryEntryPreSend` (`ImportDialog.jsx:175-202`, `onRetryEntry` /
`retryLabel="Re-validate"` at `ImportDialog.jsx:373-387`).

**Design:** delete the button and its wiring in the pre-send (`MAPPING` step) instance
of `ImportReviewQueue`. It becomes redundant once mapping-change revalidation (#8) is
in place — the class of problem it existed for (an FK match that needs re-checking)
is now handled automatically when the user fixes the underlying mapping, and the
existing "Apply value" flow already covers picking a specific candidate for a single
FK mismatch without this button. `handleRetryEntryPreSend` itself can be removed if
this was its only caller — verify during implementation.

## 4. Grid scrollbar not rendering

**Root cause found, not a new bug to fix in this repo's code:** the styling
(`.sf-scrollbar-visible`, `styles.css:26-48`) already exists on this branch and is
correctly wired (`ScrollPane className="sf-scrollbar-visible"`, `ImportReviewQueue.jsx:385`,
CSS import chain verified through `tools/app-shell/src/index.css` →
`@etendosoftware/app-shell-core/styles.css`). The problem is that the **published**
`@etendosoftware/app-shell-core@0.3.5` package (what `etendo_schema_forge` currently has
installed) predates this CSS rule entirely — `grep` for `sf-scrollbar-visible` in the
installed package's `styles.css` finds nothing, while the sibling checkout on
`feature/ETP-4447` has it at `packages/app-shell-core/src/styles.css:30-48`.

**Design:** no code change item here. This resolves automatically the next time
`schema_forge_core` publishes a new version and `etendo_schema_forge` bumps its
dependency (already required for #7/#8 and for the separate contract-driven-validations
work). Noted here only so it isn't mistakenly re-investigated as a fresh bug later.

## 5. Off-screen column error tooltip

**Current state:** the frozen Status cell shows an `AlertCircle` badge for error rows
(`ImportReviewQueue.jsx:515-521`) plus, only for row-level (blank-`target`) errors, a
truncated message (`560-568`). Field-level errors render *only* inline in their own
(possibly off-screen) cell — nothing in the always-visible Status column mentions them.

**Design:** extend the Status cell's error indicator so its tooltip (`title` attribute)
lists every field with an error on that row, by label, when there is at least one
field-level error — e.g. `Errores en: País, Código postal — desplazate a la derecha para
verlos`. This is additive to the existing row-level message (row-level and field-level
errors are not mutually exclusive; both can be present and both should be visible in the
tooltip). No new dependency — reuses the field label already available via
`config.fields`/the field descriptor passed to the row.

## 6. Double chevron in mapping dropdown

**Confirmed bug:** `ImportColumnMapping.jsx:17-24` renders a manual `ChevronDown` inside
`SelectTrigger` alongside `SelectValue`, in addition to the chevron `SelectTrigger`
itself already renders via Radix (`ui/select.jsx:16-29`).

**Design:** delete the manual `ChevronDown` (and its import, if now unused) from
`ImportColumnMapping.jsx`. `SelectTrigger`'s own chevron is sufficient and is what every
other `Select` usage in the codebase already relies on.

## 7. Compact column-mapping view + edit modal

**Current state:** `ImportColumnMapping.jsx` has exactly one render mode — a
`flex flex-wrap` list (`:11`) of one label+`Select` pair per detected CSV header, no
collapsed/summary alternative. For Contacts (15 target fields in
`artifacts/contacts/decisions.json → window.import.fields`), a well-formed file renders
close to 15 of these pairs, wrapping across 2-3 rows depending on viewport width.

**Design:** two view modes for the same mapping data, chosen per the user's approved
option:

- **Compact (default, inline in the dialog):** one line summary (`"15/15 columnas
  mapeadas"`, or `"12/15 mapeadas, 3 sin asignar"` with a warning icon when any CSV
  header has no target), followed by a horizontally-wrapping row of small chips, one per
  detected header, each reading `"<header> → <target label>"` (or `"<header> → (sin
  asignar)"` styled distinctly). An `"Editar match"` button sits next to the summary.
- **Edit (modal, opened by "Editar match"):** the *existing* full label+`Select` grid
  (today's `ImportColumnMapping.jsx` body, unchanged internally) moves into a dedicated
  modal. Changes inside the modal update local/draft mapping state; nothing is applied to
  the dialog's real `mapping` state until the modal is confirmed (see #8 — this modal
  boundary is exactly the batching boundary for revalidation).

`ImportColumnMapping.jsx` becomes two components: a `ImportColumnMappingSummary` (chip
view, always rendered) and the modal wrapping the current grid (renamed or kept as the
existing component, now only mounted while the modal is open).

## 8. Mapping change triggers revalidation

**Current state (traced fully):** changing `mapping[header]` today updates only the
`Select`'s displayed value. `entries` (what the grid actually renders) is derived once,
at file-parse time, from `renameRowKeys(rawRows, autoMapping)` — the header-keyed raw
rows are a local `const` inside `handleFileSelected`, never persisted to state. There is
no code path anywhere that re-derives `entries` from a later `mapping` change, and two
real complications exist for building one:
  - No raw/header-keyed rows survive past initial parse, so there is currently nothing
    to re-map from without re-reading the file.
  - `runValidation` is a single, always-full pipeline (dedupe → `resolveForeignKeys` over
    every FK-eligible column across the whole file → `validateRow` per row) with no
    incremental/single-column variant.

**Design:**

- **Persist raw rows.** `handleFileSelected` stores the parsed, header-keyed rows (pre-
  `renameRowKeys`) in a new state value (e.g. `rawRows`), alongside the existing
  `headers`/`mapping` state. This is the only structural state addition.
- **Batch changes in the edit modal (#7).** The modal owns a draft copy of `mapping`;
  intermediate edits do not touch `rawRows`/`entries` and do not trigger validation.
- **Apply on confirm.** Confirming the modal (1) commits the draft mapping to the real
  `mapping` state, (2) re-runs `renameRowKeys(rawRows, newMapping)` to rebuild
  target-keyed rows, and (3) re-runs the existing `runValidation` pipeline against them
  in full (dedupe + FK resolution + per-row validation) — reusing the current bulk path
  as-is rather than building a narrower incremental one, per the approved trade-off
  (simplicity over speed; large files pay one full re-validation per explicit "save
  mapping" action, not per keystroke).
- **Loading state.** While this re-run is in flight, the dialog shows a brief loading
  indicator over the grid (`runValidation` is already `async` — this is a UI-only
  addition, no new async plumbing).
- **Interaction with #3:** removing the standalone "Re-validate" button is safe because
  any FK/mapping problem it used to address now has a direct fix path (remap the column,
  save, get a fresh full revalidation) instead of a per-row manual nudge.

## Non-goals

- No incremental/per-column-only revalidation — always a full re-run on mapping save
  (see #8).
- No change to `resolveForeignKeys`, `validateRow`, or any non-UI engine logic beyond
  what's needed to be called again with fresh input.
- No visual redesign of the modal's internal grid itself — it's the existing
  `ImportColumnMapping` body, just relocated into a modal.
- Item 4 requires no code in this repo (see above) — do not scope engineering time to
  "fix" it here.

## Testing

- `ImportReviewQueue`: pill badge counts (all/ok/error, including the zero-errors case);
  `Ban` icon renders for skip; pre-send Re-validate button is absent while post-send
  Retry is still present; Status cell tooltip lists field labels for field-level errors,
  including alongside a simultaneous row-level error.
- `ImportColumnMapping`: single chevron per trigger (regression guard); summary shows
  correct mapped/unmapped counts; chips reflect current mapping; opening/confirming/
  cancelling the modal (cancel discards draft changes, confirm applies them).
- `ImportDialog`: confirming a mapping change in the modal re-derives `entries` from
  `rawRows` via the new mapping and re-runs the full validation pipeline exactly once;
  cancelling the modal leaves `entries`/grid untouched; loading indicator shows during
  the re-run.
