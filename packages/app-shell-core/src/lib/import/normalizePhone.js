/**
 * Phone cells (ETP-6225). Spreadsheets and the export write numbers as "+34 910 565 400",
 * but the backend only accepts digits and + ( ) - . (max 15 characters), so whitespace is
 * dropped BEFORE validating and sending. A leading apostrophe is deliberately NOT stripped:
 * it stays invalid and the row is rejected.
 */
export const PHONE_MAX_LENGTH = 15;
const PHONE_RE = /^[\d+()\-.]+$/;
const FLOAT_LIKE_RE = /^\d+(\.\d+)?(e\+?\d+)?$/i;

// A numeric Excel cell arrives as a number ("653120012", 6.5312e8) or a float-like string
// ("653120012.0"): turn it back into the integer digits, with no ".0" or exponent.
function integerString(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return BigInt(n).toString();
}

/** Phone cell as the backend accepts it: whitespace removed, numeric/float-like cells as plain integer digits. */
export function normalizePhone(value) {
  if (value == null) return value;
  // `\s` already covers NBSP (U+00A0) and U+FEFF.
  const s = String(value).replace(/\s+/g, '');
  // Plain digit strings are left alone so leading zeros survive ("0034...").
  if (typeof value === 'number' || (FLOAT_LIKE_RE.test(s) && /[.e]/i.test(s))) {
    return integerString(typeof value === 'number' ? value : s) ?? s;
  }
  return s;
}

/** True when the cell, once normalized, has disallowed characters or exceeds 15 characters; empty is valid. */
export function isInvalidPhone(value) {
  const s = normalizePhone(value);
  if (s == null || s === '') return false;
  return !PHONE_RE.test(s) || s.length > PHONE_MAX_LENGTH;
}

/** Copy of `row` with every phone target normalized; `row` itself when there is none. */
export function normalizePhoneTargets(row, phoneTargets = []) {
  if (!phoneTargets.length) return row;
  const next = { ...row };
  for (const target of phoneTargets) {
    if (target in next) next[target] = normalizePhone(next[target]);
  }
  return next;
}
