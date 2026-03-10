import { useLocale } from './LocaleProvider.jsx';
import { resolveLabel } from './resolveLabel.js';

/**
 * Hook that returns a label resolver function.
 * t(columnName) returns the localized label string, or null if not found.
 *
 * Usage:
 *   const t = useLabel();
 *   t('C_BPartner_ID')   // "Business Partner"
 *   t('DatePromised')     // "Scheduled Delivery Date"
 *   t('NonExistent')      // null (caller should fallback)
 */
export function useLabel() {
  const dictionary = useLocale();
  return (columnName) => resolveLabel(dictionary, columnName);
}
