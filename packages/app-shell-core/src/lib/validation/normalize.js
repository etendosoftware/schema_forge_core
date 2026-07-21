/**
 * ETP-4556 — Coercion / normalization boundary.
 *
 * This module is the ONLY place that coerces or trims values for validation.
 * Keeping it separate from the constraint evaluators enforces a clean
 * normalize → validate → present pipeline: the engine never destructively
 * sanitizes the caller's data — these helpers return derived values used only
 * to make a validation decision.
 */

/**
 * Presence — "presence, not truthiness".
 *
 * Mirrors the semantics of `isPresent()` in
 * `schema_forge_core/cli/src/lib/field-validation.js` (canonical source), but
 * applied to FIELD VALUES rather than constraint metadata: here `0` and `false`
 * count as PRESENT (a submitted zero / unchecked boolean is a real value), while
 * `null`, `undefined`, and whitespace-only strings count as ABSENT.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValuePresent(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  // Numbers (incl. 0), booleans (incl. false), and other non-null scalars are
  // present. This is deliberately NOT truthiness.
  return true;
}

/**
 * Count string length in Unicode CODE POINTS (`[...str].length`), not UTF-16
 * code units (`str.length`). An astral character such as an emoji is ONE code
 * point but two UTF-16 units; length constraints operate on code points so a
 * `maxLength: 1` accepts a single emoji.
 *
 * @param {string} str
 * @returns {number}
 */
export function codePointLength(str) {
  return [...String(str)].length;
}

/**
 * Coerce a value to a finite Number for range checks. Accepts numbers and
 * numeric strings; rejects `NaN` and `±Infinity` (returns `NaN` as the sentinel
 * for "not a finite number"). Does NOT accept localized number strings
 * (e.g. "1.234,56") — callers must normalize locale formatting upstream.
 *
 * @param {*} value
 * @returns {number} finite number, or NaN when not coercible
 */
export function coerceFiniteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return NaN;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}
