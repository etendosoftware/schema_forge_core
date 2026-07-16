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
 * scrollable content look like it has no more content at all.
 *
 * The overlay lives in a non-scrolling outer wrapper, as a SIBLING of the
 * actual `overflow-auto` node, not a child of it — an earlier version
 * rendered it as a child and it scrolled away with the content the moment
 * the user scrolled (confirmed live against the running app), defeating the
 * entire point of an "always-visible" indicator. The wrapper carries the
 * `relative` positioning context and the flex sizing this component's root
 * used to carry directly; the inner node still gets `ref`/`onScroll`/
 * `{...props}` exactly as before, so `ref`, `data-testid`, and any other
 * forwarded prop still resolve to the real scrollable element.
 *
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={setRefs}
        onScroll={handleScroll}
        className={cn("min-h-0 flex-1 overflow-auto", className)}
        {...props}
      >
        {children}
      </div>
      {axisMetrics.x && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-30"
          style={{ height: SHADOW_SCROLLBAR_THICKNESS }}
          data-testid="ScrollPane__shadowScrollbarX"
        >
          <div
            className="pointer-events-auto absolute bottom-0 cursor-grab touch-none rounded-full bg-[#C1C5CF] active:cursor-grabbing"
            style={{ height: SHADOW_SCROLLBAR_THICKNESS, width: axisMetrics.x.thumbSize, transform: `translateX(${axisMetrics.x.thumbOffset}px)` }}
            onPointerDown={handleThumbPointerDown('x')}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
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
            className="pointer-events-auto absolute right-0 cursor-grab touch-none rounded-full bg-[#C1C5CF] active:cursor-grabbing"
            style={{ width: SHADOW_SCROLLBAR_THICKNESS, height: axisMetrics.y.thumbSize, transform: `translateY(${axisMetrics.y.thumbOffset}px)` }}
            onPointerDown={handleThumbPointerDown('y')}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            data-testid="ScrollPane__shadowScrollbarThumbY"
          />
        </div>
      )}
    </div>
  );
});
ScrollPane.displayName = "ScrollPane";

export { ScrollPane };
