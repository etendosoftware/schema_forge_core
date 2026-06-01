import { useCallback } from 'react';
import { useLocale } from './LocaleProvider.jsx';

/**
 * Hook that returns a translator function for generic UI labels.
 * Resolves keys from the `genericLabels` section of the locale dictionary.
 *
 * The returned function is memoized on the dictionary so consumers can safely
 * use it as a dependency of `useMemo`/`useEffect` without re-triggering on
 * every render. Without this guarantee a `useMemo(() => buildX(ui), [ui])`
 * would invalidate on every render and propagate fresh array identities to
 * children — see DataTable.onColumnsReady → ListView.setTableColumns, which
 * forms an infinite update loop when columns identity changes each render.
 *
 * Usage:
 *   const ui = useUI();
 *   ui('save')          // "Save" (en_US) or "Guardar" (es_ES)
 *   ui('newRecord')     // "New" (en_US) or "Nuevo" (es_ES)
 */
export function useUI() {
  const dictionary = useLocale();
  return useCallback((key, params = {}) => {
    let text = dictionary?.genericLabels?.[key] ?? key;
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((p) => {
        text = text.replace(`{${p}}`, params[p]);
      });
    }
    return text;
  }, [dictionary]);
}
