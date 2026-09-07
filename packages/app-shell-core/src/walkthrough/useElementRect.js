import { useEffect, useState } from 'react';

/**
 * Tracks an element's viewport rectangle while `active`.
 *
 * Driven by `requestAnimationFrame` rather than by scroll/resize listeners plus
 * a ResizeObserver: the highlighted element moves for reasons none of those
 * fire for — the page-transition animation on route change, a sticky toolbar
 * collapsing, a lazily-loaded row pushing the form down. Polling the rect is
 * the only approach that keeps the spotlight glued to its target in every case,
 * and it only runs while a walkthrough step is on screen. State updates are
 * gated on an actual change, so a still page costs no re-renders.
 */
export function useElementRect(element, active = true) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!element || !active) {
      setRect(null);
      return undefined;
    }
    const view = element.ownerDocument?.defaultView ?? globalThis;
    if (typeof view.requestAnimationFrame !== 'function') {
      setRect(readRect(element));
      return undefined;
    }

    let frame = 0;
    let previous = null;

    const tick = () => {
      const nextRect = readRect(element);
      if (!sameRect(previous, nextRect)) {
        previous = nextRect;
        setRect(nextRect);
      }
      frame = view.requestAnimationFrame(tick);
    };
    tick();

    return () => view.cancelAnimationFrame?.(frame);
  }, [element, active]);

  return rect;
}

function readRect(element) {
  if (!element?.isConnected) return null;
  const { top, left, width, height } = element.getBoundingClientRect();
  return { top, left, width, height };
}

function sameRect(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5
    && Math.abs(a.height - b.height) < 0.5;
}
