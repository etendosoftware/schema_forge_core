import { useCallback } from 'react';
import { useLocale } from './LocaleProvider.jsx';

/**
 * Hook that returns a translator function for menu group names, tab labels,
 * and other UI strings.
 * Looks up keys in: ui → menus → windows → tabs → genericLabels → raw key.
 *
 * The returned function is memoized on the dictionary so it is safe to use as
 * a dependency of `useMemo`/`useEffect`. See useUI for the rationale.
 *
 * Usage:
 *   const tMenu = useMenuLabel();
 *   tMenu('Home')                        // "Inicio" (es_ES) or "Home" (en_US)
 *   tMenu('Sales Order', { field: 'newLabel' })  // "Nuevo pedido" (es_ES) — returns null if not found
 */
export function useMenuLabel() {
  const dictionary = useLocale();
  return useCallback((key, { field } = {}) => {
    if (field) {
      return dictionary?.windows?.[key]?.[field] ?? null;
    }
    return (
      dictionary?.ui?.[key]?.label ??
      dictionary?.menus?.[key]?.label ??
      dictionary?.windows?.[key]?.label ??
      dictionary?.tabs?.[key]?.label ??
      dictionary?.genericLabels?.[key] ??
      key
    );
  }, [dictionary]);
}
