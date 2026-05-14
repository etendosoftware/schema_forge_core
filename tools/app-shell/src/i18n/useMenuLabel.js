import { useLocale } from './LocaleProvider.jsx';

/**
 * Hook that returns a translator function for menu group names, tab labels,
 * and other UI strings.
 * Looks up keys in: ui → menus → windows → tabs → genericLabels → raw key.
 *
 * Usage:
 *   const tMenu = useMenuLabel();
 *   tMenu('Home')                        // "Inicio" (es_ES) or "Home" (en_US)
 *   tMenu('Sales Order', { field: 'newLabel' })  // "Nuevo pedido" (es_ES) — returns null if not found
 */
export function useMenuLabel() {
  const dictionary = useLocale();
  return (key, { field } = {}) => {
    // When `field` is provided, reads that field directly from windows[key].
    // Returns null (not the raw key) if the entry or field is missing.
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
  };
}
