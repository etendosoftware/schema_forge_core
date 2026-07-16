# Shadow Scrollbar + Click-to-Scroll Error Navigation — Design

- Date: 2026-07-14
- Status: approved (reviewed by user 2026-07-14)
- Repo touched: `schema_forge_core` only

## Problem

Two follow-ups from the CSV import UX polish pass
(`docs/superpowers/specs/2026-07-14-csv-import-ux-polish-design.md`), both
confirmed live against the running app (`localhost:3100`, Contacts window,
LOCAL_CORE dev mode) using Chrome DevTools automation, not guessed:

**1. The grid's scrollbar is still invisible — root cause is not CSS, it's
the browser's scrollbar rendering mode.** Live inspection of the review
queue's scroll container (`.sf-scrollbar-visible`, `ImportReviewQueue.jsx`)
confirmed:
- `scrollWidth` (2590px) > `clientWidth` (1150px) — real horizontal overflow
  exists.
- `getComputedStyle()` correctly resolves `overflow-x: auto`,
  `scrollbar-width: auto`, and `scrollbar-color: rgb(193,197,207)
  rgb(241,242,245)` — our custom CSS rule from
  `docs/superpowers/plans/2026-07-14-csv-import-ux-polish.md`'s §4 non-item is
  applied correctly.
- `offsetHeight === clientHeight` (0px difference) — the scrollbar consumes
  **no layout space**, which only happens when the browser is rendering an
  **overlay scrollbar** (macOS's default "Automatically based on mouse or
  trackpad" mode). Overlay scrollbars are compositor-drawn and **do not
  honor `::-webkit-scrollbar-*` CSS at all** — they only flash briefly
  during an active scroll gesture and are otherwise fully transparent.
- Confirmed by programmatically scrolling (`pane.scrollLeft = 600`) and
  screenshotting: the content genuinely shifts (proving scroll works), but
  no visible bar renders at any point.

This is a genuine browser/OS constraint, not a code defect — there is no
reliable CSS-only way to force classic (non-overlay, style-respecting)
scrollbars across browsers. The fix is to stop depending on the native
scrollbar for visibility and render our own always-visible indicator.

**2. Off-screen field errors are still hard to find.** The existing tooltip
(added in the prior polish pass, `ImportReviewQueue.jsx`) lists which
fields have errors by name, but the user still has to manually scroll to
find them. The ask: clicking the error indicator should bring the first
erroring column into view directly.

## Proposal

### 1. Shadow scrollbar in the shared `ScrollPane` component

Add an always-on, JS-driven visual scrollbar indicator directly to
`packages/app-shell-core/src/components/ui/scroll-pane.jsx` — the single
shared scroll-container primitive already used by `ImportReviewQueue.jsx`
and `ListView.jsx` (the app's main list view, mounted on every window).
Making this a `ScrollPane`-level feature means every current and future
consumer gets a visible scrollbar automatically, with no per-caller opt-in
(this supersedes and deprecates the existing `.sf-scrollbar-visible` CSS
class — see Non-goals).

**Behavior:**
- Covers both axes (horizontal and vertical) — either bar renders only when
  its axis actually overflows (`scrollWidth > clientWidth` /
  `scrollHeight > clientHeight`); an axis with no overflow renders nothing,
  so short lists (the common case in `ListView.jsx`) are visually
  unchanged.
- **Visual indicator only, not draggable** (v1 scope, explicit user
  decision) — the thumb reflects live scroll position/proportion; native
  scroll input (trackpad, wheel, keyboard, and any classic OS scrollbar
  that may also render) continues to work exactly as today. No pointer
  capture / drag-to-scroll logic in this iteration.
- Positioned as an absolutely-positioned overlay at the pane's own
  bottom edge (horizontal) / right edge (vertical) — does not reflow or
  consume layout space, matching the "shadow" framing.
- Track/thumb colors reuse the existing custom scrollbar palette already
  defined in `styles.css` (`#F1F2F5` track, `#C1C5CF` thumb, `#A6ABB8`
  hover) — visually consistent with the intent of the original
  `.sf-scrollbar-visible` CSS rule, just implemented as real DOM instead of
  a pseudo-element.
- Updates via: a `scroll` listener (thumb position/size sync), a
  `ResizeObserver` on the pane itself (container resizes) and its direct
  content child (content resizes — e.g. new columns rendered after an
  Import "Edit match" save, or a window resize), and once on mount.
- Hidden entirely (both bars) when the pane has no `ref` content yet
  (defensive, avoids a flash of a stale/zero-sized bar before first
  measurement).

**Where this plugs in:** `ScrollPane` already forwards a `ref` internally
(`innerRef`) and owns the single DOM node with `overflow-auto` — the shadow
scrollbar's measurement and listeners attach to that same node, no new
wrapper element around `ScrollPane`'s consumers is needed.

### 2. Click-to-scroll to the first error column

In `ImportReviewQueue.jsx`, the frozen Status cell's error indicator
(`AlertCircle`, already carrying the multi-field tooltip from the prior
polish pass) becomes clickable:

- **Click target:** the `AlertCircle` icon specifically (not the whole
  Status cell).
- **Effect:** scrolls the review queue's `ScrollPane` horizontally so the
  **first** column with a field-level error becomes visible. "First" means
  first in the table's declared column order (`config.fields`/`dataColumns`
  order), not necessarily first in `entry.errors` array order — the two can
  differ since errors aren't necessarily pushed in column order.
- **No vertical scroll, no cell highlight, no focus-into-input** (explicit
  v1 scope decision) — this is purely a horizontal "bring it into view"
  action. The existing tooltip (hover) still shows which fields have
  errors; the click is a faster shortcut for the first one.
- Only rendered as clickable when there is at least one field-level error
  (mirrors the existing tooltip's own condition) — a row with only a
  row-level (blank-target) error has no specific column to jump to, so the
  icon is not click-enabled for that case (already excluded from the
  tooltip today for the same reason).
- Implementation: each data column's `TableCell` needs a way to be
  scrolled into view — the standard DOM approach is
  `cell.scrollIntoView({ inline: 'nearest', block: 'nearest' })` called on
  the target column's cell element for that row, scoped to not affect
  vertical position (`block: 'nearest'` is a no-op if the row is already
  vertically visible, which it is since the user just clicked something in
  it).

## Architecture Notes

- `ScrollPane`'s public API is unchanged (still takes `className`,
  `onScroll`, `onReachBottom`, `threshold`, children, ref) — the shadow
  scrollbar is additive internal behavior, not a new required prop. No
  caller needs to change to get it.
- The existing `.sf-scrollbar-visible` CSS class and its rules in
  `styles.css` become dead code once this ships (every `ScrollPane` now
  shows a visible scrollbar unconditionally) — removed as part of this
  work rather than left as unreachable cruft (see Non-goals for what stays).
- `ImportReviewQueue.jsx`'s existing `[&>div]:!overflow-visible` /
  `Table`-wrapper-neutralization hack (documented at
  `ImportReviewQueue.jsx:386-393`) is unaffected — the shadow scrollbar
  attaches to the same outer `ScrollPane` node that hack already routes
  all real scrolling through, so no interaction changes are needed there.

## Non-goals

- Draggable/interactive shadow scrollbar (thumb click-and-drag) — v1 is
  visual-only, per explicit decision.
- Forcing classic (non-overlay) native OS scrollbars via any CSS trick —
  established to be unreliable across browsers; not attempted.
- Removing `scrollbar-width`/`scrollbar-color`/`::-webkit-scrollbar-*` CSS
  properties from `styles.css` globally (the *global* 8px thin-scrollbar
  default rule, unrelated to `.sf-scrollbar-visible`, stays — it's a
  reasonable fallback for browsers/contexts where classic scrollbars do
  render, e.g. Firefox, which fully supports `scrollbar-width`/
  `scrollbar-color`). Only the now-fully-superseded `.sf-scrollbar-visible`
  block is removed.
- Vertical-scroll click-to-navigate (only the reported horizontal
  off-screen-column problem is in scope for item 2).
- Any change to `ListView.jsx`'s own code — it inherits the shadow
  scrollbar automatically through `ScrollPane`, no consumer-side changes
  needed there, but its existing tests/behavior should be re-verified as
  part of this plan since it is the highest-traffic consumer.

## Testing

- `ScrollPane`: shadow bar renders only on axes with real overflow (unit
  test with mocked `scrollWidth`/`clientWidth`/`scrollHeight`/
  `clientHeight`, since jsdom doesn't lay out real dimensions); updates
  position/size on a `scroll` event; hides when overflow disappears (e.g.
  content shrinks); no bar rendered at all when neither axis overflows.
- `ImportReviewQueue`: clicking the `AlertCircle` icon on a row with
  multiple field errors calls `scrollIntoView` on the first-in-column-order
  erroring cell (spy on `Element.prototype.scrollIntoView`, standard jsdom
  testing pattern for this — already used in this repo's `ImportReviewQueue.test.jsx`
  for the FK-mismatch popover); a row-level-only error does not attach a
  click handler to the icon; clicking does not affect `statusFilter` or any
  other state.
- Regression: existing `ListView` tests continue to pass with `ScrollPane`
  now rendering the shadow bar (sanity pass, not new coverage — the shadow
  bar is presentation-only and should not affect `ListView`'s existing
  assertions, which don't inspect scrollbar DOM).
