import * as React from "react"

import { cn } from "../../lib/utils.js"

/**
 * Bounded-height, natively-scrollable region — the one scroll pattern this
 * app uses for large lists (`flex-1 min-h-0 overflow-auto`, previously
 * hand-rolled per call site, e.g. ListView.jsx's own scrollRef div). Extracted
 * so every scrollable list (window ListViews, review queues, ...) shares one
 * implementation. Deliberately NOT a virtualized/windowed viewport — matches
 * the rest of the app, which renders every loaded row and relies on this
 * plain scroll container plus (where needed) incremental server pagination.
 *
 * Pass `onReachBottom` to get infinite-scroll behavior: it fires once scroll
 * position comes within `threshold`px of the bottom (mirrors ListView.jsx's
 * own handleScroll, so callers doing paginated loadMore() can reuse this
 * instead of re-deriving the scrollHeight/scrollTop/clientHeight math).
 */
const ScrollPane = React.forwardRef(({ className, onScroll, onReachBottom, threshold = 200, ...props }, ref) => {
  const innerRef = React.useRef(null);

  const setRefs = React.useCallback((node) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  const handleScroll = (event) => {
    onScroll?.(event);
    if (!onReachBottom) return;
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) onReachBottom();
  };

  return (
    <div
      ref={setRefs}
      onScroll={handleScroll}
      className={cn("min-h-0 flex-1 overflow-auto", className)}
      {...props}
    />
  );
});
ScrollPane.displayName = "ScrollPane";

export { ScrollPane };
