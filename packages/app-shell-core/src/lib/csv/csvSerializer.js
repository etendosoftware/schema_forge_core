const FORMULA_TRIGGER_CHARS = '=+-@';

/**
 * A value is formula-sensitive when its first non-whitespace character is a spreadsheet
 * formula trigger. Leading whitespace/control characters (space, tab, CR, LF) are skipped
 * first so a marker cannot hide behind them. Mirrors the server-side policy in
 * NeoCsvExportService.java (com.etendoerp.go) so both sides neutralize the same inputs.
 */
function isFormulaInjection(value) {
  let i = 0;
  while (i < value.length && /\s/.test(value[i])) i++;
  return i < value.length && FORMULA_TRIGGER_CHARS.includes(value[i]);
}

/**
 * Serializes a single CSV field: neutralizes spreadsheet formula injection (CWE-1236) by
 * prepending an apostrophe when the value is formula-sensitive, then applies RFC 4180
 * quoting (only when the value contains a comma, quote, or newline).
 */
export function csvField(value) {
  let s = String(value ?? '');
  if (isFormulaInjection(s)) {
    s = `'${s}`;
  }
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
