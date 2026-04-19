/**
 * Resolve the display label for a DataTable column.
 *
 * Priority order (highest to lowest):
 *   1. col.labels[locale]   — explicit per-locale override in the contract
 *   2. col.labels.en_US     — contract fallback in English
 *   3. translate(col.column) — i18n dictionary lookup (es_ES.json / en_US.json)
 *   4. col.label            — AD hardcoded label (typically English)
 *   5. col.key              — technical key (last resort)
 *
 * The i18n dictionary MUST win over `col.label`, otherwise contract-embedded
 * English labels silently override the translations the user maintains in
 * the locale JSON files.
 */
export function resolveColumnLabel(col, locale, translate) {
  if (!col) return undefined;
  return (
    col.labels?.[locale] ??
    col.labels?.en_US ??
    (typeof translate === 'function' ? translate(col.column) : null) ??
    col.label ??
    col.key
  );
}
