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

// --- Reserved Java keywords map (from NamingUtil.java lines 47-98) ---
const RESERVED_NAMES = {
  'case': 'cse', 'char': 'chr', 'abstract': 'abstrct', 'continue': 'cntinue',
  'for': 'fr', 'new': 'nw', 'switch': 'swtch', 'assert': 'assrt',
  'default': 'deflt', 'package': 'pkg', 'synchronized': 'synchrnized',
  'boolean': 'bolean', 'do': 'd', 'if': 'i', 'private': 'prvate',
  'this': 'ths', 'break': 'brk', 'double': 'dble', 'implements': 'implments',
  'protected': 'prtected', 'throw': 'thrw', 'byte': 'bte', 'else': 'els',
  'import': 'imprt', 'public': 'pblic', 'throws': 'thrws', 'enum': 'enm',
  'instanceof': 'instnceof', 'return': 'rturn', 'transient': 'trnsnt',
  'catch': 'ctch', 'extends': 'xtends', 'int': 'nt', 'short': 'shrt',
  'try': 'tr', 'final': 'fnl', 'interface': 'interfce', 'static': 'statc',
  'void': 'vod', 'class': 'clss', 'finally': 'finlly', 'long': 'lng',
  'strictfp': 'strctfp', 'volatile': 'volatle', 'float': 'flt',
  'native': 'natve', 'super': 'spr', 'while': 'whle',
};

/**
 * Strip the module prefix from a mapping name.
 * Mirrors NamingUtil.stripPrefix():
 *   1. Remove trailing _ID (case-insensitive)
 *   2. Find first underscore: if at index 1 remove first 2 chars,
 *      if at index 2 remove first 3 chars.
 */
function stripPrefix(mappingName) {
  let name = mappingName;
  if (name.toLowerCase().endsWith('_id')) {
    name = name.substring(0, name.length - 3);
  }
  const index = name.indexOf('_');
  if (index === 1) return name.substring(2);
  if (index === 2) return name.substring(3);
  return name;
}

/**
 * Convert separators to camelCase by uppercasing the character after each separator.
 * Mirrors NamingUtil.camelCaseIt().
 */
function camelCaseIt(mappingName, separator) {
  let name = mappingName;
  // Strip trailing separators
  while (name.endsWith(separator)) {
    name = name.substring(0, name.length - 1);
  }
  // Strip leading separators
  while (name.startsWith(separator)) {
    name = name.substring(1);
  }
  let pos = name.indexOf(separator);
  while (pos !== -1) {
    const leftPart = name.substring(0, pos);
    const camelLetter = name.charAt(pos + 1).toUpperCase();
    const rightPart = name.substring(pos + 2);
    name = leftPart + camelLetter + rightPart;
    pos = name.indexOf(separator);
  }
  return name;
}

/**
 * Remove all characters that are not a-zA-Z or (for non-first position) 0-9.
 * Mirrors NamingUtil.stripIllegalCharacters().
 */
function stripIllegalCharacters(value) {
  let result = '';
  let first = true;
  for (const ch of value) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
      || (!first && ch >= '0' && ch <= '9')) {
      result += ch;
      first = false;
    }
  }
  return result;
}

/**
 * Lowercase the first character of a string.
 * Mirrors NamingUtil.lowerCaseFirst().
 */
function lowerCaseFirst(value) {
  if (value.length > 1) {
    return value.substring(0, 1).toLowerCase() + value.substring(1);
  }
  return value;
}

/**
 * Convert AD_Column.Name (display name) to OBDal property name.
 *
 * Faithful port of Etendo's NamingUtil.getPropertyMappingName() algorithm:
 *   1. If isPk (primary key) → return "id"
 *   2. If isCoreModule → stripPrefix (remove _ID suffix + short module prefix)
 *   3. camelCaseIt on underscores, then on spaces
 *   4. stripIllegalCharacters (keep only a-zA-Z, digits not at position 0)
 *   5. lowerCaseFirst
 *   6. Reserved word replacement
 *
 * @param {string} adColumnName - The AD_Column.Name (display name, e.g. "Order Date")
 * @param {object} [options]
 * @param {boolean} [options.isPk=false] - Whether this is the primary key column
 * @param {boolean} [options.isCoreModule=true] - Whether prefix stripping applies
 * @returns {string} The OBDal property name (e.g. "orderDate")
 */
export function toPropertyName(adColumnName, { isPk = false, isCoreModule = true } = {}) {
  if (!adColumnName) return '';

  // Step 1: Primary key shortcut
  if (isPk) return 'id';

  let name = adColumnName;

  // Step 2: Strip prefix for core module columns
  if (isCoreModule) {
    name = stripPrefix(name);
  }

  // Step 3: camelCase on underscores, then on spaces
  name = camelCaseIt(name, '_');
  name = camelCaseIt(name, ' ');

  // Step 4: Strip illegal characters
  name = stripIllegalCharacters(name);

  // Step 5: Lowercase first character
  name = lowerCaseFirst(name);

  // Step 6: Reserved word check
  if (RESERVED_NAMES[name]) {
    name = RESERVED_NAMES[name];
  }

  return name;
}

/**
 * Legacy toPropertyName — simplified version kept for reference.
 * @deprecated Use toPropertyName() instead, which faithfully ports NamingUtil.java.
 */
export function toPropertyNameLegacy(adColumnName) {
  if (!adColumnName) return '';
  const cleaned = adColumnName.replace(/[^a-zA-Z0-9 ]/g, '');
  const parts = cleaned.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const joined = parts
    .map((word, i) => {
      if (i === 0) return word.charAt(0).toLowerCase() + word.slice(1);
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
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
