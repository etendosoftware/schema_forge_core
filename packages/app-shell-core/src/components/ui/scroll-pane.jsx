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
