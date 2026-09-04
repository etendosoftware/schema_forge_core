import { useEffect, useState } from 'react';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Live `prefers-reduced-motion` state.
 *
 * Read as a media query rather than assumed, and SUBSCRIBED to rather than read
 * once: the setting can change mid-session (the OS toggle, or a browser that
 * flips it with a battery saver), and a walkthrough is long-lived enough to
 * outlive the change.
 *
 * Returns `false` where `matchMedia` does not exist (SSR, jsdom without the
 * polyfill) — the animated path is the default experience, and a missing API is
 * not a statement that the user wants less motion.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matches());

  useEffect(() => {
    const mql = globalThis.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!mql) return undefined;
    const onChange = (event) => setReduced(!!event.matches);
    setReduced(!!mql.matches);
    // Safari < 14 only has the deprecated add/removeListener pair.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener?.(onChange);
    return () => mql.removeListener?.(onChange);
  }, []);

  return reduced;
}

function matches() {
  return !!globalThis.matchMedia?.(REDUCED_MOTION_QUERY)?.matches;
}
