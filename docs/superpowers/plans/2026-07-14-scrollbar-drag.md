# Shadow Scrollbar Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `ScrollPane` shadow scrollbar's thumb draggable with the mouse (Pointer Events), upgrading it from a visual-only indicator (the shipped v1 scope) to a fully interactive scrollbar — per explicit user request after confirming the visual-only version looks correct.

**Architecture:** Add `onPointerDown`/`onPointerMove`/`onPointerUp` handlers to each axis's thumb `<div>` in `scroll-pane.jsx`, using `setPointerCapture` so drag tracking continues correctly even if the pointer leaves the thumb's bounds. On drag, the handler computes a scroll delta from the pointer delta (converting from track-pixel space to content-scroll-pixel space via the existing thumb/track size ratio) and sets `el.scrollLeft`/`el.scrollTop` directly — the existing `onScroll` → `measure()` pipeline (already shipped) then re-renders the thumb position with no new state-sync code needed. Track-click-to-jump (clicking the empty track area, not the thumb) is explicitly out of scope — only thumb dragging.

**Tech Stack:** React (function components, hooks), native Pointer Events API (`setPointerCapture`/`releasePointerCapture`), Vitest + `@testing-library/react`.

## Global Constraints

- No new npm dependencies.
- No changes to `ScrollPane`'s public prop API.
- No track-click-to-jump — only dragging the thumb itself.
- The existing visual-only behavior (thumb position reflecting scroll state) must be fully preserved — this task only *adds* drag capability on top of it.
- Every new `data-testid` follows the `ComponentName__purpose` convention (the thumb elements already have `data-testid`; no new elements are added).
- Test runner: `cd packages/app-shell-core && npx vitest run <file>`.
- Commit convention (Etendo Git Police, mandatory): first line `Feature ETP-4447: <description>` (max 80 chars), no `Co-Authored-By` line.

---

### Task 1: Draggable shadow scrollbar thumb

**Files:**
- Modify: `packages/app-shell-core/src/components/ui/scroll-pane.jsx`
- Test: `packages/app-shell-core/src/components/ui/__tests__/scroll-pane.test.jsx`

**Interfaces:**
- Consumes: nothing new — same props as today.
- Produces: no new public props or testids. The existing `ScrollPane__shadowScrollbarThumbX`/`Y` elements gain pointer event handlers; no consumer-visible API change.

- [ ] **Step 1: Write the failing tests**

Add to `scroll-pane.test.jsx`. First, add the pointer-capture jsdom polyfill near the top of the file, alongside the existing `ResizeObserver` polyfill (jsdom does not implement `setPointerCapture`/`releasePointerCapture` — same class of gap already handled for Radix Select elsewhere in this codebase):

```jsx
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
```

Then add a new `describe` block:

```jsx
describe('thumb dragging', () => {
  it('scrolls the pane proportionally when the horizontal thumb is dragged', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollWidth 2000, clientWidth 1000 -> thumbSize 500, trackRange (clientWidth - thumbSize) 500, scrollRange (scrollWidth - clientWidth) 1000.
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 1, clientX: 300 });
    fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 400 });
    // deltaPointer 100px * (scrollRange 1000 / trackRange 500) = 200px scroll delta.
    expect(pane.scrollLeft).toBe(200);
  });

  it('scrolls the pane proportionally when the vertical thumb is dragged', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollHeight 1000, clientHeight 400 -> thumbSize 160, trackRange 240, scrollRange 600.
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbY');
    fireEvent.pointerDown(thumb, { pointerId: 2, clientY: 50 });
    fireEvent.pointerMove(thumb, { pointerId: 2, clientY: 74 });
    // deltaPointer 24px * (scrollRange 600 / trackRange 240) = 60px scroll delta.
    expect(pane.scrollTop).toBe(60);
  });

  it('clamps the scroll offset to the valid range when dragged past the end', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 3, clientX: 0 });
    fireEvent.pointerMove(thumb, { pointerId: 3, clientX: 10000 });
    expect(pane.scrollLeft).toBe(1000); // scrollRange = 2000 - 1000
  });

  it('drags relative to the scroll offset at drag start, not from zero', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 300 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 4, clientX: 300 });
    fireEvent.pointerMove(thumb, { pointerId: 4, clientX: 350 });
    // deltaPointer 50px * (1000/500) = 100px -> 300 (start) + 100 = 400.
    expect(pane.scrollLeft).toBe(400);
  });

  it('stops updating scroll position after pointerup', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 5, clientX: 0 });
    fireEvent.pointerMove(thumb, { pointerId: 5, clientX: 100 });
    fireEvent.pointerUp(thumb, { pointerId: 5, clientX: 100 });
    fireEvent.pointerMove(thumb, { pointerId: 5, clientX: 900 });
    // The move after pointerup must not move the scroll position further.
    expect(pane.scrollLeft).toBe(200); // only the pre-pointerup delta (100px * 2) applied
  });

  it('ignores a pointermove from a different, unrelated pointerId', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 6, clientX: 0 });
    fireEvent.pointerMove(thumb, { pointerId: 999, clientX: 500 });
    expect(pane.scrollLeft).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/ui/__tests__/scroll-pane.test.jsx -t "thumb dragging"`
Expected: FAIL — the thumb currently has no pointer event handlers, so `pane.scrollLeft`/`pane.scrollTop` never change from their stubbed starting values.

- [ ] **Step 3: Write the implementation**

In `scroll-pane.jsx`, add a drag-state ref and three handlers inside the `ScrollPane` component body, after the existing `handleScroll` function:

```js
// Tracks an in-progress thumb drag: which axis, which pointer, and the
// scroll/thumb geometry captured at drag start (so a drag computes its
// delta relative to where it began, not from zero, and stays correct even
// if content resizes mid-drag — geometry is captured once per drag, not
// re-read on every pointermove).
const dragStateRef = React.useRef(null);

const handleThumbPointerDown = (axis) => (event) => {
  const el = innerRef.current;
  const metrics = axisMetrics[axis];
  if (!el || !metrics) return;
  event.preventDefault();
  const scrollSize = axis === 'x' ? el.scrollWidth : el.scrollHeight;
  const clientSize = axis === 'x' ? el.clientWidth : el.clientHeight;
  dragStateRef.current = {
    axis,
    pointerId: event.pointerId,
    startPointerPos: axis === 'x' ? event.clientX : event.clientY,
    startScrollOffset: axis === 'x' ? el.scrollLeft : el.scrollTop,
    thumbSize: metrics.thumbSize,
    scrollSize,
    clientSize,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
};

const handleThumbPointerMove = (event) => {
  const drag = dragStateRef.current;
  const el = innerRef.current;
  if (!drag || !el || drag.pointerId !== event.pointerId) return;
  const pointerPos = drag.axis === 'x' ? event.clientX : event.clientY;
  const deltaPointer = pointerPos - drag.startPointerPos;
  const trackRange = drag.clientSize - drag.thumbSize;
  const scrollRange = drag.scrollSize - drag.clientSize;
  if (trackRange <= 0 || scrollRange <= 0) return;
  const deltaScroll = deltaPointer * (scrollRange / trackRange);
  const nextOffset = Math.min(scrollRange, Math.max(0, drag.startScrollOffset + deltaScroll));
  if (drag.axis === 'x') el.scrollLeft = nextOffset;
  else el.scrollTop = nextOffset;
};

const handleThumbPointerUp = (event) => {
  const drag = dragStateRef.current;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.currentTarget.releasePointerCapture(event.pointerId);
  dragStateRef.current = null;
};
```

Then update the two thumb `<div>`s to wire these handlers and re-enable pointer events on just the thumb (the track wrapper stays `pointer-events-none` — only the thumb itself is interactive, matching "drag the thumb," not "click the track"). Change the horizontal thumb from:

```jsx
<div
  className="absolute bottom-0 rounded-full bg-[#C1C5CF]"
  style={{ height: SHADOW_SCROLLBAR_THICKNESS, width: axisMetrics.x.thumbSize, transform: `translateX(${axisMetrics.x.thumbOffset}px)` }}
  data-testid="ScrollPane__shadowScrollbarThumbX"
/>
```

to:

```jsx
<div
  className="pointer-events-auto absolute bottom-0 cursor-grab touch-none rounded-full bg-[#C1C5CF] active:cursor-grabbing"
  style={{ height: SHADOW_SCROLLBAR_THICKNESS, width: axisMetrics.x.thumbSize, transform: `translateX(${axisMetrics.x.thumbOffset}px)` }}
  onPointerDown={handleThumbPointerDown('x')}
  onPointerMove={handleThumbPointerMove}
  onPointerUp={handleThumbPointerUp}
  data-testid="ScrollPane__shadowScrollbarThumbX"
/>
```

And the vertical thumb from:

```jsx
<div
  className="absolute right-0 rounded-full bg-[#C1C5CF]"
  style={{ width: SHADOW_SCROLLBAR_THICKNESS, height: axisMetrics.y.thumbSize, transform: `translateY(${axisMetrics.y.thumbOffset}px)` }}
  data-testid="ScrollPane__shadowScrollbarThumbY"
/>
```

to:

```jsx
<div
  className="pointer-events-auto absolute right-0 cursor-grab touch-none rounded-full bg-[#C1C5CF] active:cursor-grabbing"
  style={{ width: SHADOW_SCROLLBAR_THICKNESS, height: axisMetrics.y.thumbSize, transform: `translateY(${axisMetrics.y.thumbOffset}px)` }}
  onPointerDown={handleThumbPointerDown('y')}
  onPointerMove={handleThumbPointerMove}
  onPointerUp={handleThumbPointerUp}
  data-testid="ScrollPane__shadowScrollbarThumbY"
/>
```

`touch-none` (Tailwind's `touch-action: none`) prevents the browser's default touch-scroll gesture from fighting with the drag on touch/trackpad-as-pointer input, standard for custom draggable UI elements using Pointer Events.

Update the component's docstring: the line `This overlay is visual-only (not draggable, \`pointer-events-none\`) — real scroll input...` no longer accurately describes the shipped behavior. Change it to:

```
 * This overlay's track is non-interactive (`pointer-events-none`) so it
 * never blocks native scroll gestures over the content beneath it — but its
 * thumb is independently draggable with the mouse/pointer (a
 * `pointer-events-auto` hole punched through the track for just the thumb),
 * using `setPointerCapture` so the drag keeps tracking even if the pointer
 * leaves the thumb's bounds. Native scroll input (trackpad, wheel,
 * keyboard, and any classic OS scrollbar that may also render) is
 * untouched — dragging the thumb sets `scrollLeft`/`scrollTop` directly,
 * which the existing `onScroll` → `measure()` pipeline picks up like any
 * other scroll, so no separate render path exists for drag vs. native
 * scroll.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/ui/__tests__/scroll-pane.test.jsx`
Expected: PASS — all tests in the file (the 7 pre-existing + 6 new drag tests = 13).

- [ ] **Step 5: Run the full import test suite as a regression check**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/`
Expected: PASS — `ImportReviewQueue`'s `ScrollPane` usage is unaffected (no prop changes).

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/ui/scroll-pane.jsx packages/app-shell-core/src/components/ui/__tests__/scroll-pane.test.jsx
git commit -m "Feature ETP-4447: Make shadow scrollbar thumb draggable"
```

---

## Post-plan note (not a task — informational)

Live re-verification after this lands should confirm, against the running app (`localhost:3100`, Import dialog): dragging the horizontal thumb with the mouse actually scrolls the grid, the cursor shows a grab/grabbing affordance, and dragging past either end clamps correctly without erroring.
