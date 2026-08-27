/**
 * Parse a numeric cell coming out of a CSV/TXT import.
 *
 * This app is used primarily in Spanish, and Excel under an es-ES locale writes amounts
 * as "1.234,56" (dot thousands, comma decimal). Both that form and the plain "1234.56"
 * have to parse to the same number, or a perfectly valid Spanish file imports every
 * amount off by three orders of magnitude.
 *
 * The three return values are deliberately distinct, because the import pipeline treats
 * them differently:
 *   - `null`  → the cell is empty. The row says nothing about this field; it must fall
 *               back to whatever default applies, NOT fail. (Same "blank is not invalid"
 *               distinction `codedValue.js` draws for AD-coded columns.)
 *   - number  → parsed value.
 *   - `NaN`   → the cell is non-empty but not a number. This is a real row error and the
 *               review queue must show it BEFORE the send, not discover it at build time.
 *
 * @param {unknown} raw Raw cell text.
 * @returns {number|null} The parsed number, `null` for a blank cell, `NaN` when unparseable.
 */
export function parseImportNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\s/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) {
    // es-ES: '.' groups thousands, ',' is the decimal separator.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** True when the cell holds something that is not a number (blank counts as valid). */
export function isInvalidImportNumber(raw) {
  return Number.isNaN(parseImportNumber(raw));
}
