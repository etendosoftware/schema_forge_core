# Shadow Scrollbar + Click-to-Scroll Error Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ineffective native-scrollbar CSS approach with a real, always-visible "shadow" scrollbar built into the shared `ScrollPane` component, and make the CSV import review queue's error indicator clickable to jump the horizontal scroll to the first erroring column.

**Architecture:** Task 1 rewrites `packages/app-shell-core/src/components/ui/scroll-pane.jsx` to compute and render its own overlay track/thumb per axis (derived from `scrollWidth`/`clientWidth`/`scrollHeight`/`clientHeight`/`scrollLeft`/`scrollTop`, recomputed on scroll and via `ResizeObserver`), and removes the now-dead `.sf-scrollbar-visible` CSS block this supersedes. Because `ScrollPane` is shared, this automatically reaches every consumer (`ImportReviewQueue.jsx` and `ListView.jsx`) with no per-caller change beyond removing the now-meaningless `sf-scrollbar-visible` className. Task 2 adds a click handler to `ImportReviewQueue.jsx`'s per-row error icon that calls `scrollIntoView` on the first (in column order) erroring cell, using per-cell refs collected during render.

**Tech Stack:** React (function components + hooks, `forwardRef`), Vitest + `@testing-library/react`, native `ResizeObserver`, Tailwind utility classes.

## Global Constraints

- No new npm dependencies.
- Every new `data-testid` follows this codebase's `ComponentName__purpose` or `ComponentName__purpose-${key}` convention.
- No backend changes.
- The shadow scrollbar is **visual-only in this iteration — not draggable**. Native scroll input (trackpad, wheel, keyboard) must keep working unmodified; do not intercept pointer events on the track/thumb (`pointer-events-none`).
- `ScrollPane`'s public prop API (`className`, `onScroll`, `onReachBottom`, `threshold`, children, ref) must not change — the shadow scrollbar is additive internal behavior requiring no caller changes.
- Test runner: `cd packages/app-shell-core && npx vitest run <file>`.
- Commit convention (Etendo Git Police, mandatory): first line `Feature ETP-4447: <description>` (max 80 chars), no `Co-Authored-By` line.

---

### Task 1: Shadow scrollbar in `ScrollPane`

**Files:**
- Modify: `packages/app-shell-core/src/components/ui/scroll-pane.jsx` (full rewrite)
- Modify: `packages/app-shell-core/src/styles.css:26-48` (delete the `.sf-scrollbar-visible` block and its leading comment)
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx` (remove the now-meaningless `className="sf-scrollbar-visible"` from the `<ScrollPane>` usage)
- Test: `packages/app-shell-core/src/components/ui/__tests__/scroll-pane.test.jsx` (new file)

**Interfaces:**
- Consumes: nothing new — same props as today.
- Produces: no new public props. New internal `data-testid`s any consumer/test can rely on for presence checks: `ScrollPane__shadowScrollbarX`, `ScrollPane__shadowScrollbarThumbX`, `ScrollPane__shadowScrollbarY`, `ScrollPane__shadowScrollbarThumbY` (each only rendered when that axis actually overflows).

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/components/ui/__tests__/scroll-pane.test.jsx`:

```jsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScrollPane } from '../scroll-pane.jsx';

// jsdom has no ResizeObserver — a no-op stub is enough since every test here
// drives remeasurement via a 'scroll' event (handleScroll already calls
// measure() synchronously), not via a real resize.
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
});

/** jsdom always reports 0 for scroll/client dimensions — stub them directly. */
function stubMetrics(el, { scrollWidth = 0, clientWidth = 0, scrollHeight = 0, clientHeight = 0, scrollLeft = 0, scrollTop = 0 }) {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  el.scrollLeft = scrollLeft;
  el.scrollTop = scrollTop;
}

describe('ScrollPane', () => {
  it('renders no shadow scrollbar on either axis when content does not overflow', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarX')).toBeNull();
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarY')).toBeNull();
  });

  it('renders a horizontal shadow thumb sized to the visible/total ratio when horizontal content overflows', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    expect(thumb.style.width).toBe('500px');
    expect(thumb.style.transform).toBe('translateX(0px)');
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarY')).toBeNull();
  });

  it('moves the horizontal thumb offset proportionally to scrollLeft', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollWidth 2000, clientWidth 1000 -> thumbSize 500, maxThumbOffset 500, maxScrollOffset 1000.
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 500 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    expect(thumb.style.transform).toBe('translateX(250px)');
  });

  it('renders a vertical shadow thumb when vertical content overflows', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbY');
    expect(thumb.style.height).toBe('160px');
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarX')).toBeNull();
  });

  it('enforces a minimum thumb size for extreme overflow ratios', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollWidth 100000, clientWidth 1000 -> raw thumb would be 10px, below the 24px floor.
    stubMetrics(pane, { scrollWidth: 100000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    expect(thumb.style.width).toBe('24px');
  });

  it('removes the shadow scrollbar once overflow disappears', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    expect(screen.getByTestId('ScrollPane__shadowScrollbarX')).toBeDefined();
    stubMetrics(pane, { scrollWidth: 1000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarX')).toBeNull();
  });

  it('regression: onReachBottom still fires when scrolled within threshold of the bottom', () => {
    let reached = false;
    render(<ScrollPane data-testid="pane" onReachBottom={() => { reached = true; }} threshold={50}><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 1000, clientHeight: 400, scrollTop: 560 });
    fireEvent.scroll(pane);
    expect(reached).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/ui/__tests__/scroll-pane.test.jsx`
Expected: FAIL — the current `ScrollPane` renders no shadow-scrollbar elements at all, so every `getByTestId('ScrollPane__shadowScrollbarThumbX'/...)` throws.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `packages/app-shell-core/src/components/ui/scroll-pane.jsx`:

```jsx
import * as React from "react"

import { cn } from "../../lib/utils.js"

// Minimum thumb length (px) so a very large overflow ratio still renders a
// visible sliver instead of a near-invisible pixel-wide mark.
const SHADOW_SCROLLBAR_MIN_THUMB = 24;
const SHADOW_SCROLLBAR_THICKNESS = 8;

/**
 * Computes one axis's shadow-scrollbar thumb size/offset, or `null` when
 * that axis has no real overflow (scrollSize <= clientSize) — the caller
 * renders nothing for a null axis.
 */
function computeAxisMetrics(scrollSize, clientSize, scrollOffset) {
  if (clientSize <= 0 || scrollSize <= clientSize) return null;
  const rawThumbSize = (clientSize / scrollSize) * clientSize;
  const thumbSize = Math.max(SHADOW_SCROLLBAR_MIN_THUMB, Math.min(rawThumbSize, clientSize));
  const maxScrollOffset = scrollSize - clientSize;
  const maxThumbOffset = clientSize - thumbSize;
  const thumbOffset = maxScrollOffset > 0 ? (scrollOffset / maxScrollOffset) * maxThumbOffset : 0;
  return { thumbSize, thumbOffset };
}

/**
 * Bounded-height, natively-scrollable region — the one scroll pattern this
 * app uses for large lists (`flex-1 min-h-0 overflow-auto`, previously
 * hand-rolled per call site, e.g. ListView.jsx's own scrollRef div). Extracted
 * so every scrollable list (window ListViews, review queues, ...) shares one
 * implementation. Deliberately NOT a virtualized/windowed viewport — matches
 * the rest of the app, which renders every loaded row and relies on this
 * plain scroll container plus (where needed) incremental server pagination.
 *
 * Renders its own always-visible "shadow" scrollbar overlay on whichever
 * axis actually overflows. Native OS/browser scrollbars are frequently
 * rendered in "overlay" mode (macOS's default) — verified live: the
 * scrollbar then consumes zero layout space (`offsetHeight === clientHeight`)
 * and completely ignores any `::-webkit-scrollbar` CSS, making genuinely
 * scrollable content look like it has no more content at all. This overlay
 * is visual-only (not draggable, `pointer-events-none`) — real scroll input
 * (trackpad, wheel, keyboard, and any classic OS scrollbar that may also
 * render) is untouched.
 *
 * Pass `onReachBottom` to get infinite-scroll behavior: it fires once scroll
 * position comes within `threshold`px of the bottom (mirrors ListView.jsx's
 * own handleScroll, so callers doing paginated loadMore() can reuse this
 * instead of re-deriving the scrollHeight/scrollTop/clientHeight math).
 */
const ScrollPane = React.forwardRef(({ className, onScroll, onReachBottom, threshold = 200, children, ...props }, ref) => {
  const innerRef = React.useRef(null);
  const [axisMetrics, setAxisMetrics] = React.useState({ x: null, y: null });

  const setRefs = React.useCallback((node) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const measure = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    setAxisMetrics({
      x: computeAxisMetrics(el.scrollWidth, el.clientWidth, el.scrollLeft),
      y: computeAxisMetrics(el.scrollHeight, el.clientHeight, el.scrollTop),
    });
  }, []);

  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    if (el.firstElementChild) resizeObserver.observe(el.firstElementChild);
    return () => resizeObserver.disconnect();
  }, [measure]);

  const handleScroll = (event) => {
    measure();
    onScroll?.(event);
    if (!onReachBottom) return;
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) onReachBottom();
  };

  return (
    <div
      ref={setRefs}
      onScroll={handleScroll}
      className={cn("relative min-h-0 flex-1 overflow-auto", className)}
      {...props}
    >
      {children}
      {axisMetrics.x && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-30"
          style={{ height: SHADOW_SCROLLBAR_THICKNESS }}
          data-testid="ScrollPane__shadowScrollbarX"
        >
          <div
            className="absolute bottom-0 rounded-full bg-[#C1C5CF]"
            style={{ height: SHADOW_SCROLLBAR_THICKNESS, width: axisMetrics.x.thumbSize, transform: `translateX(${axisMetrics.x.thumbOffset}px)` }}
            data-testid="ScrollPane__shadowScrollbarThumbX"
          />
        </div>
      )}
      {axisMetrics.y && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 z-30"
          style={{ width: SHADOW_SCROLLBAR_THICKNESS }}
          data-testid="ScrollPane__shadowScrollbarY"
        >
          <div
            className="absolute right-0 rounded-full bg-[#C1C5CF]"
            style={{ width: SHADOW_SCROLLBAR_THICKNESS, height: axisMetrics.y.thumbSize, transform: `translateY(${axisMetrics.y.thumbOffset}px)` }}
            data-testid="ScrollPane__shadowScrollbarThumbY"
          />
        </div>
      )}
    </div>
  );
});
ScrollPane.displayName = "ScrollPane";

export { ScrollPane };
```

In `packages/app-shell-core/src/styles.css`, delete lines 26-48 (the comment block starting `/* Scoped, more prominent scrollbar...` through the closing `}` of `.sf-scrollbar-visible { scrollbar-width: auto; scrollbar-color: #C1C5CF #F1F2F5; }`) — this leaves the file's global `*::-webkit-scrollbar`/`*` thin-scrollbar default rule (lines 7-24) untouched, and the very next section (`/* Contacts — row states...`) directly follows the `@tailwind utilities;` block's other rules with no gap.

In `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx`, find:

```jsx
<ScrollPane className="sf-scrollbar-visible" data-testid="ScrollPane__a73779">
```

and change it to:

```jsx
<ScrollPane data-testid="ScrollPane__a73779">
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/ui/__tests__/scroll-pane.test.jsx`
Expected: PASS — all 7 tests.

- [ ] **Step 5: Run the full import test suite as a regression check**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/`
Expected: PASS — removing the `sf-scrollbar-visible` className must not break any existing `ImportReviewQueue`/`ImportDialog` test (none of them assert on that className).

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/ui/scroll-pane.jsx packages/app-shell-core/src/components/ui/__tests__/scroll-pane.test.jsx packages/app-shell-core/src/styles.css packages/app-shell-core/src/components/import/ImportReviewQueue.jsx
git commit -m "Feature ETP-4447: Add always-visible shadow scrollbar to ScrollPane"
```

---

### Task 2: Click-to-scroll to the first erroring column

**Files:**
- Modify: `packages/app-shell-core/src/components/import/ImportReviewQueue.jsx` (add per-cell ref tracking, a jump-to-first-error handler, and make the error-row `AlertCircle` icon clickable when there's at least one field-level error)
- Test: `packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx`

**Interfaces:**
- Consumes: nothing new from outside this file. Depends on Task 1 only in that `ScrollPane` no longer takes the `sf-scrollbar-visible` className (already handled by Task 1's commit); this task does not touch `ScrollPane` itself.
- Produces: nothing new for other components — self-contained UI behavior.

- [ ] **Step 1: Write the failing tests**

Add to `ImportReviewQueue.test.jsx`, as a new top-level `describe` block:

```jsx
describe('click-to-scroll to first error', () => {
  it('scrolls the first-in-column-order erroring cell into view when the alert icon is clicked, even if it is not first in the errors array', () => {
    const scrollIntoViewMock = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    try {
      const multiFieldError = {
        row: { name: 'Andres', email: 'not-an-email', country: 'Nowhereland' },
        errors: [
          { target: 'country', message: 'Could not be matched to an existing record.' },
          { target: 'email', message: 'Not a valid email address.' },
        ],
        status: 'pending',
      };
      render(
        <ImportReviewQueue
          entries={[multiFieldError]}
          fields={[
            { target: 'name', label: 'Name' },
            { target: 'email', label: 'Email' },
            { target: 'country', label: 'Country' },
          ]}
          statusFilter="error"
          onStatusFilterChange={() => {}}
          onEditField={() => {}}
          onRetryEntry={() => {}}
          onSkipEntry={() => {}}
          onDownloadErrors={() => {}}
        />,
      );
      fireEvent.click(screen.getByTestId('ImportReviewQueue__jumpToFirstError-0'));
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
      const scrolledCell = screen.getByTestId(`ImportReviewQueue__input-0-email`).closest('td');
      expect(scrollIntoViewMock.mock.instances[0]).toBe(scrolledCell);
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('does not render a jump-to-error button when the only error is row-level', () => {
    const rowLevelEntry = {
      row: { name: 'Andres' },
      errors: [{ target: '', message: 'Operation rejected by server.' }],
      status: 'pending',
    };
    render(
      <ImportReviewQueue
        entries={[rowLevelEntry]}
        fields={[{ target: 'name', label: 'Name' }]}
        statusFilter="error"
        onStatusFilterChange={() => {}}
        onEditField={() => {}}
        onRetryEntry={() => {}}
        onSkipEntry={() => {}}
        onDownloadErrors={() => {}}
      />,
    );
    expect(screen.queryByTestId('ImportReviewQueue__jumpToFirstError-0')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx -t "click-to-scroll to first error"`
Expected: FAIL — `ImportReviewQueue__jumpToFirstError-0` does not exist yet.

- [ ] **Step 3: Write the implementation**

In `ImportReviewQueue.jsx`, add a ref for tracking per-cell DOM nodes. The file's top import line currently reads `import { useRef, useState } from 'react';` — `useRef` is already imported, no import change needed. Near the top of the component body, alongside the existing `pendingBulkApply` state declaration (inside `export function ImportReviewQueue({ ... }) { ... }`), add:

```js
// One DOM node per (row index, field target) rendered in the error branch —
// populated via a callback ref on each error-row TableCell, read back by
// handleJumpToFirstError to scrollIntoView the first (in column order, not
// entry.errors order) cell that actually has a field-level error.
const cellRefs = useRef(new Map());

const registerCellRef = (index, target) => (el) => {
  const key = `${index}:${target}`;
  if (el) cellRefs.current.set(key, el);
  else cellRefs.current.delete(key);
};

const handleJumpToFirstError = (index, rowColumns, entry) => {
  const firstErrorField = rowColumns.find((field) => entry.errors.some((e) => e.target === field.target));
  if (!firstErrorField) return;
  const cell = cellRefs.current.get(`${index}:${firstErrorField.target}`);
  cell?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
};
```

Find the error-row Status cell's `AlertCircle` rendering (inside the branch that computes `rowLevelError`/`rowColumns`/`fieldErrorLabels`/`errorTooltip`):

```jsx
<StatusLineTag index={index} tag="destructive" data-testid="StatusLineTag__a73779">
  <AlertCircle
    className="h-3.5 w-3.5"
    aria-hidden="true"
    title={errorTooltip}
    data-testid="AlertCircle__a73779" />
  <span className="sr-only">{text.statusError}</span>
</StatusLineTag>
```

Replace it so the icon is wrapped in a click handler only when there is at least one field-level error (`fieldErrorLabels.length > 0`, the same condition already used for `errorTooltip`):

```jsx
<StatusLineTag index={index} tag="destructive" data-testid="StatusLineTag__a73779">
  {fieldErrorLabels.length > 0 ? (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center"
      onClick={() => handleJumpToFirstError(index, rowColumns, entry)}
      data-testid={`ImportReviewQueue__jumpToFirstError-${index}`}
    >
      <AlertCircle
        className="h-3.5 w-3.5"
        aria-hidden="true"
        title={errorTooltip}
        data-testid="AlertCircle__a73779" />
    </button>
  ) : (
    <AlertCircle
      className="h-3.5 w-3.5"
      aria-hidden="true"
      data-testid="AlertCircle__a73779" />
  )}
  <span className="sr-only">{text.statusError}</span>
</StatusLineTag>
```

Find the per-field `TableCell` in the error-row branch:

```jsx
{rowColumns.map((field) => {
  const fieldError = entry.errors.find((e) => e.target === field.target);
  const isEditable = Boolean(rowLevelError || fieldError);
  const isFkMismatch = fieldError && !rowLevelError && fieldError.candidates !== undefined;
  return (
    <TableCell key={field.target} data-testid={"TableCell__" + field.id}>
```

Add the callback ref so `handleJumpToFirstError` can find this cell later:

```jsx
{rowColumns.map((field) => {
  const fieldError = entry.errors.find((e) => e.target === field.target);
  const isEditable = Boolean(rowLevelError || fieldError);
  const isFkMismatch = fieldError && !rowLevelError && fieldError.candidates !== undefined;
  return (
    <TableCell key={field.target} ref={registerCellRef(index, field.target)} data-testid={"TableCell__" + field.id}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/ImportReviewQueue.test.jsx`
Expected: PASS — all tests in the file, including the two new ones and every pre-existing test (the wrapping `<button>` around `AlertCircle` only changes markup for rows with at least one field-level error; the row-level-only-error branch and the OK-row branch are untouched).

- [ ] **Step 5: Run the full import test suite as a final regression gate**

Run: `cd packages/app-shell-core && npx vitest run src/components/import/__tests__/`
Expected: PASS — every file under `src/components/import/__tests__/`.

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastianbarrozo/Documents/work/epic/schema_forge_core
git add packages/app-shell-core/src/components/import/ImportReviewQueue.jsx packages/app-shell-core/src/components/import/__tests__/ImportReviewQueue.test.jsx
git commit -m "Feature ETP-4447: Click error icon to scroll to first erroring column"
```

---

## Post-plan note (not a task — informational)

`ListView.jsx` (in the sibling `etendo_schema_forge` repo) consumes `ScrollPane` too and will automatically gain the shadow scrollbar once this package is published and the dependency bumped there — no code change needed in that repo for this feature. Verify `ListView.jsx`'s own existing tests still pass after bumping, as a sanity check (they don't assert on scrollbar DOM today, so no failures are expected, but it's the highest-traffic consumer of this shared component).
