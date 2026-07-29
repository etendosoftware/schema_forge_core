import { useEffect, useState } from 'react';

/**
 * Keeps a component mounted while an exit animation plays.
 *
 * Usage:
 *   const { shouldRender, isClosing } = useAnimatedOpen(open, 200);
 *   if (!shouldRender) return null;
 *   // apply enter classes when !isClosing, exit classes when isClosing
 *
 * @param {boolean} open   Whether the consumer wants the element visible.
 * @param {number}  durationMs  How long the exit animation takes.
 * @returns {{ shouldRender: boolean, isClosing: boolean }}
 */
export function useAnimatedOpen(open, durationMs = 200) {
  const [shouldRender, setShouldRender] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setIsClosing(false);
      return undefined;
    }
    if (!shouldRender) return undefined;
    setIsClosing(true);
    const t = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, durationMs);
    return () => clearTimeout(t);
  }, [open, shouldRender, durationMs]);

  return { shouldRender, isClosing };
}
