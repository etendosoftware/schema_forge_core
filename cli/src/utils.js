import { createHash } from 'node:crypto';

export function computeChecksum(data) {
  return createHash('sha256')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex')
    .substring(0, 8);
}

export function generateVersion() {
  return '0.1.0';
}

/**
 * Convert AD_Column.Name (display name) to OBDal property name.
 * Mirrors Etendo's NamingUtil.formatAsPropertyName:
 *   1. Strip non-alphanumeric chars (keep spaces)
 *   2. Split on whitespace
 *   3. camelCase: first word lowercases first char only, rest capitalize first char only
 *   4. Strip leading digits from result
 *
 * Examples:
 *   "Order Date"      → "orderDate"
 *   "Business Partner" → "businessPartner"
 *   "UOM"             → "uOM"
 *   "1st Dimension"   → "stDimension"
 *   "User/Contact"    → "userContact"
 */
export function toPropertyName(adColumnName) {
  if (!adColumnName) return '';
  // 1. Remove non-alphanumeric except spaces
  const cleaned = adColumnName.replace(/[^a-zA-Z0-9 ]/g, '');
  // 2. Split on whitespace
  const parts = cleaned.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  // 3. camelCase — preserve original casing except first char of each word
  const joined = parts
    .map((word, i) => {
      if (i === 0) return word.charAt(0).toLowerCase() + word.slice(1);
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
  // 4. Strip leading digits
  return joined.replace(/^[0-9]+/, '');
}

export function toCamelCase(columnName) {
  // Split on underscores first
  const underscoreParts = columnName.split('_').filter(Boolean);

  // Split each part on PascalCase boundaries (e.g. DocumentNo -> Document, No)
  const words = underscoreParts.flatMap((part) =>
    part.replace(/([a-z])([A-Z])/g, '$1_$2').split('_')
  );

  // Join as camelCase: first word lowercase, rest capitalized
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}
