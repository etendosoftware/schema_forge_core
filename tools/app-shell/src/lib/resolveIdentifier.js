/**
 * Resolve the display value for a field in a data row.
 *
 * NEO API returns FK fields as two separate properties:
 *   row.fieldName           → raw UUID
 *   row.fieldName$_identifier → human-readable name
 *
 * Mock data uses objects: row.fieldName = { id, name }
 *
 * This helper checks both formats and falls back to the raw value.
 */
export function resolveIdentifier(row, key) {
  if (!row || key == null) return undefined;
  const identifier = row[`${key}$_identifier`];
  if (identifier != null) return identifier;
  const raw = row[key];
  if (raw && typeof raw === 'object' && raw.name) return raw.name;
  return raw;
}
