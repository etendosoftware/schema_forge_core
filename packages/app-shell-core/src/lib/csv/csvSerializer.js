/**
 * Spreadsheet formula neutralization (CWE-1236) — the JavaScript implementation of
 * the policy specified in ADR-0004 (`com.etendoerp.go/docs/adr/0004-csv-formula-neutralization.md`).
 *
 * There is no shared runtime between Java and JavaScript, so the policy is enforced as a
 * SPECIFICATION plus a common fixture set — never by pointing at another implementation.
 * The normative contract is `com.etendoerp.go/docs/security/csv-neutralization-fixtures.md`,
 * mirrored as executable data in `./csvNeutralizationFixtures.js`. Every implementation
 * (this module, `NeoCsvExportService.java`, and the jsreport `csvField` source text in
 * `templates/reports/helpers/report-html-helpers.js`) must satisfy that same table.
 * When a trigger is added, it goes into the fixture table FIRST, then into every
 * implementation.
 */

/**
 * A value whose first significant character is one of these is interpreted as a formula by
 * Excel, LibreOffice Calc and Google Sheets. TAB, CR and LF are triggers in their own right
 * (OWASP), not merely skippable leading whitespace. The full-width variants close the
 * documented full-width bypass.
 */
const FORMULA_TRIGGER_CHARS = '=+-@\t\r\n＝＋－＠';

/** Prepended to a formula-sensitive value so the spreadsheet renders it as literal text. */
const NEUTRALIZING_PREFIX = "'";

/**
 * Characters skipped when looking for the first significant character: whitespace and the
 * BOM, which a spreadsheet ignores but a naive check would stop on. TAB/CR/LF are excluded
 * because they are triggers themselves. JavaScript's `\s` already covers NBSP (U+00A0) and
 * U+FEFF; the Java twin has to name them explicitly.
 */
const INSIGNIFICANT_PREFIX_RE = /[\s﻿]/;

function isFormulaTrigger(ch) {
  return FORMULA_TRIGGER_CHARS.includes(ch);
}

/** Index of the first character a spreadsheet would actually interpret, or `value.length`. */
function firstSignificantIndex(value) {
  let i = 0;
  while (i < value.length && !isFormulaTrigger(value[i]) && INSIGNIFICANT_PREFIX_RE.test(value[i])) {
    i += 1;
  }
  return i;
}

/**
 * Neutralizes a single spreadsheet cell value: prepends one apostrophe when the value is
 * formula-sensitive, otherwise returns it unchanged. Already-neutralized values are left
 * alone (an apostrophe is not a trigger, so they can never be double-prefixed).
 *
 * Applies to header labels as well as data cells — column labels derive from AD field names
 * and user configuration, so they are attacker-influenced too (ADR-0004 D3).
 *
 * @param {unknown} value Raw cell value; `null`/`undefined` become an empty string.
 * @returns {string} The value, neutralized if needed. NOT yet CSV-quoted.
 */
export function neutralizeSpreadsheetCell(value) {
  const s = String(value ?? '');
  const i = firstSignificantIndex(s);
  if (i < s.length && isFormulaTrigger(s[i])) {
    return NEUTRALIZING_PREFIX + s;
  }
  return s;
}

/**
 * Serializes a single CSV field: neutralizes spreadsheet formula injection, then applies
 * RFC 4180 quoting (only when the value contains a comma, quote or line break).
 *
 * The order is normative: neutralize BEFORE quoting, so the apostrophe lands inside the
 * quoted field rather than outside it.
 */
export function csvField(value) {
  const s = neutralizeSpreadsheetCell(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
