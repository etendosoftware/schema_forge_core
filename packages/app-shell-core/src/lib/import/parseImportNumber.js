/**
 * Parse a numeric cell coming out of a CSV/TXT/XLSX import.
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
 * ## ETP-5228 — why a format gate, and not just `Number()`
 *
 * `Number()` accepts far more than a price ever is, and every one of those extras produced a
 * WRONG number in silence rather than a row error:
 *
 * | cell      | was      | now | why |
 * |---|---|---|---|
 * | `1 0.00`  | 10       | NaN | whitespace was stripped unconditionally, welding two cells' worth of digits together |
 * | `1.5E2`   | 150      | NaN | scientific notation is not a price format any export writes |
 * | `0x10`    | 16       | NaN | same class, never reported because nobody thought to try it |
 * | `1,234.56`| 1.23456  | 1234.56 | both separators present was read as "dot groups, comma decimates" unconditionally, so the en-US convention silently lost three orders of magnitude |
 *
 * The first three are the ticket; the fourth is the same defect (a silently wrong value from a
 * legitimately-formatted cell) found while fixing them, and it is corrected the way
 * `statementAmount.js` already does it: when a cell carries BOTH separators, the rightmost one
 * is the decimal. That reading is unambiguous and convention-free.
 *
 * ## Where this deliberately diverges from `statementAmount.js`
 *
 * That parser additionally reads a LONE separator followed by exactly three digits as a
 * thousands separator, so `1.234` is 1234. That rule is right for bank statements, where an
 * amount carries at most two decimals — and wrong here, because a unit price legitimately
 * carries three or more (`0.125`). A lone separator stays a decimal point in this parser, which
 * is also what it has always done; changing it would silently re-value existing price files.
 *
 * Whitespace is accepted only where it is genuinely a thousands separator — `1 234,56` is a
 * real export format — and never in the middle of a number that is not grouped in threes.
 *
 * @param {unknown} raw Raw cell text.
 * @returns {number|null} The parsed number, `null` for a blank cell, `NaN` when unparseable.
 */

/** Every occurrence of `ch`, which may be a regex metacharacter, removed from `s`. */
function stripAll(s, ch) {
  return s.split(ch).join('');
}

/**
 * A number whose whitespace is a thousands separator: three digits per group, every group.
 * `\s` already covers the non-breaking (U+00A0) and narrow no-break (U+202F) spaces that
 * locale-aware exports actually emit, so they need no separate mention.
 */
const SPACE_GROUPED_RE = /^[+-]?\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?$/;

/**
 * A plain decimal number, and nothing else — the gate applied AFTER the separators have been
 * normalized, so by this point the only legal separator is a single `.`.
 *
 * Shape copied from `statementAmount.js`'s `PLAIN_NUMBER_RE` on purpose, including its ReDoS
 * fix: the obvious `/^-?\d*\.?\d*$/` gives the engine several ways to split the same digits and
 * backtracks quadratically on a long non-matching run (Sonar javascript:S5852). Here each
 * alternative consumes its digits one way only. A bare `.`, `+` or `-` matches neither branch,
 * which is correct — they are not numbers.
 */
const PLAIN_NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Rewrite the separators of `s` into a plain `1234.56`.
 *
 * A cell holding BOTH separators can only be read one way: the rightmost is the decimal, the
 * other groups. A cell holding one keeps it as the decimal point — see the divergence note in
 * the header for why this does not adopt `statementAmount.js`'s three-digit grouping rule.
 */
function normalizeSeparators(s) {
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    return s.lastIndexOf(',') > s.lastIndexOf('.')
      ? stripAll(s, '.').replace(',', '.')
      : stripAll(s, ',');
  }
  return hasComma ? s.replace(',', '.') : s;
}

/**
 * Drop the whitespace of a correctly-grouped number, or signal that the cell is not one.
 *
 * @returns {string|null} the cell without its grouping spaces, or `null` when it carries
 *   whitespace that is not a thousands separator — which makes the whole cell invalid.
 */
function stripGroupingSpaces(s) {
  if (!/\s/.test(s)) return s;
  if (!SPACE_GROUPED_RE.test(s)) return null;
  return s.replace(/\s/g, '');
}

export function parseImportNumber(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;

  const ungrouped = stripGroupingSpaces(trimmed);
  if (ungrouped === null) return NaN;

  const normalized = normalizeSeparators(ungrouped);
  if (!PLAIN_NUMBER_RE.test(normalized)) return NaN;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** True when the cell holds something that is not a number (blank counts as valid). */
export function isInvalidImportNumber(raw) {
  return Number.isNaN(parseImportNumber(raw));
}
