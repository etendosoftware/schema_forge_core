/**
 * Resolves a field label from the locale dictionary.
 * Pure function — no React dependency, safe for direct testing.
 *
 * @param {object|null} dictionary - The locale dictionary
 * @param {string} columnName - The column name to look up
 * @returns {string|null} The label, or null if not found
 */
export function resolveLabel(dictionary, columnName) {
  return dictionary?.fields?.[columnName]?.label ?? null;
}
