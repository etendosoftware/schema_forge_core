import { useCallback } from 'react';
import { useLocale } from '../i18n/index.js';
import { resolveStepText } from './stepText.js';

/**
 * Hook form of `resolveStepText`, bound to the active locale dictionary.
 *
 * Exposed from the walkthrough barrel so a host's launcher does not have to
 * reach into the i18n module itself: the walkthrough owns how ITS copy is
 * resolved, including the "never render a raw key" guarantee.
 *
 * Memoized on the dictionary, matching `useUI`'s stability contract, so it is
 * safe as a `useMemo`/`useEffect` dependency.
 */
export function useStepText() {
  const dictionary = useLocale();
  return useCallback(
    (key, options) => resolveStepText(dictionary, key, options),
    [dictionary],
  );
}
