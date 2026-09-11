/**
 * The canonical spreadsheet-neutralization contract as executable data.
 *
 * This is the machine-readable twin of
 * `com.etendoerp.go/docs/security/csv-neutralization-fixtures.md`, the normative table
 * referenced by ADR-0004 D2. Every JavaScript implementation of the policy is tested
 * against THIS array rather than against its own hand-written cases, so the two JS
 * runtimes (this package's `csvSerializer`, and the jsreport `csvField` source text in
 * `templates/reports/helpers/report-html-helpers.js`) cannot drift from each other or
 * from `NeoCsvExportService.java`.
 *
 * `expected` is the cell value AFTER neutralization and BEFORE CSV quoting.
 *
 * Adding a trigger: add it to the markdown table, then here, then to every
 * implementation. `SPREADSHEET_FORMULA_TRIGGERS` is asserted to be fully covered by
 * these fixtures, so a trigger added without a fixture fails the suite.
 */

/** The full D3 trigger set. Each of these must appear in at least one fixture input. */
export const SPREADSHEET_FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r', '\n', '＝', '＋', '－', '＠'];

/** @type {{ description: string, input: unknown, expected: string }[]} */
export const CSV_NEUTRALIZATION_FIXTURES = [
  { description: 'Equals', input: '=1+1', expected: "'=1+1" },
  { description: 'Plus', input: '+SUM(A1:A2)', expected: "'+SUM(A1:A2)" },
  { description: 'Minus / DDE-like', input: '-CMD', expected: "'-CMD" },
  { description: 'At sign', input: '@SUM(A1:A2)', expected: "'@SUM(A1:A2)" },
  { description: 'DDE command payload', input: "+cmd|' /C calc'!A0", expected: "'+cmd|' /C calc'!A0" },
  { description: 'HYPERLINK payload (ETP-5032)', input: '=HYPERLINK("http://example.com","Click")', expected: '\'=HYPERLINK("http://example.com","Click")' },
  { description: 'Marker behind spaces', input: '   =1+1', expected: "'   =1+1" },
  { description: 'Marker behind TAB', input: '\t=1+1', expected: "'\t=1+1" },
  { description: 'Marker behind CR', input: '\r=1+1', expected: "'\r=1+1" },
  { description: 'Marker behind LF', input: '\n=1+1', expected: "'\n=1+1" },
  { description: 'TAB as first standalone control', input: '\tText', expected: "'\tText" },
  { description: 'CR as first standalone control', input: '\rText', expected: "'\rText" },
  { description: 'LF as first standalone control', input: '\nText', expected: "'\nText" },
  { description: 'BOM before marker', input: '\uFEFF=1+1', expected: "'\uFEFF=1+1" },
  { description: 'NBSP before marker', input: '\u00A0=1+1', expected: "'\u00A0=1+1" },
  { description: 'Full-width equals', input: '＝1+1', expected: "'＝1+1" },
  { description: 'Full-width plus', input: '＋SUM(A1:A2)', expected: "'＋SUM(A1:A2)" },
  { description: 'Full-width minus', input: '－CMD', expected: "'－CMD" },
  { description: 'Full-width at', input: '＠SUM(A1:A2)', expected: "'＠SUM(A1:A2)" },
  { description: 'Already neutralized', input: "'=1+1", expected: "'=1+1" },
  { description: 'Negative number', input: '-500.00', expected: "'-500.00" },
  { description: 'Plain text', input: 'Normal Value', expected: 'Normal Value' },
  { description: 'Plain text behind spaces', input: '  Normal Value', expected: '  Normal Value' },
  { description: 'Empty', input: '', expected: '' },
  { description: 'Null', input: null, expected: '' },
  { description: 'Undefined', input: undefined, expected: '' },
];
