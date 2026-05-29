/**
 * Before/after equivalence tests for the report HTML helper extraction.
 *
 * Background: the report HTML render path used to execute each artifact's
 * `helpers.js` via `new Function(...)` (Sonar S1523) and register a fixed
 * whitelist of helpers with Handlebars. That dynamic execution was replaced by
 * a trusted in-repo module (`templates/reports/helpers/report-html-helpers.js`)
 * exposing the same helper set.
 *
 * These tests prove the replacement is behaviour-preserving: for every whitelisted
 * helper present in a real artifact `helpers.js`, the NEW module produces output
 * identical to the OLD `new Function` extraction, across a battery of inputs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createReportHelpers, extractNumberFormatOptions } from '../../templates/reports/helpers/report-html-helpers.js';

const ROOT = join(import.meta.dirname, '..', '..');

// The fixed whitelist the HTML render path registered (verbatim from the old code).
const WHITELIST = [
  'isGroupBreak', 'resetGroupTracking', 'formatDate', 'formatCurrency',
  'formatBoolean', 'formatNumber', 'ifCond', 'eq', 'sumField',
  'formatDateDisplay', 'sumRowsByCategory',
];

/**
 * Reconstructs the OLD extraction: runs the artifact helpers.js through the exact
 * `new Function` wrapper the server/vite plugin used, returning the helper object.
 */
function extractHelpersTheOldWay(helpersCode) {
  // eslint-disable-next-line no-new-func
  const helperFn = new Function(helpersCode + `
    var _out = {};
    ['isGroupBreak','resetGroupTracking','formatDate','formatCurrency',
     'formatBoolean','formatNumber','ifCond','eq','sumField','formatDateDisplay','sumRowsByCategory']
    .forEach(function(n) { try { var f = eval(n); if (typeof f === 'function') _out[n] = f; } catch(e) {} });
    return _out;
  `);
  return helperFn();
}

// Stub Handlebars block-helper options for ifCond.
const ifCondOptions = { fn: () => 'TRUE', inverse: () => 'FALSE' };

// Representative inputs per helper. Each entry is an args array applied to fn(...args).
const SAMPLE_INPUTS = {
  formatDate: [['2024-03-15'], [''], [null], ['not-a-date'], ['2024-12-31T10:00:00Z'], [0]],
  formatCurrency: [[1234.5], [0], [null], ['abc'], [-99.999], ['2500']],
  formatBoolean: [[true], [false], [null], [0], [1], ['x']],
  formatNumber: [[1234567], [0], [null], ['abc'], [12.345], ['42']],
  formatDateDisplay: [['2024-03-15'], [''], [null], ['15/03/2024'], ['2024-1-1']],
  eq: [[1, 1], [1, 2], ['a', 'a'], [null, undefined], [0, '']],
  sumField: [
    [[{ v: 1 }, { v: 2 }, { v: 'x' }], 'v'],
    [[], 'v'],
    ['not-array', 'v'],
    [[{ v: '10' }, { v: '20.5' }], 'v'],
  ],
  sumRowsByCategory: [
    [[{ category: 'A1', amt: 5 }, { category: 'A2', amt: 3 }, { category: 'B', amt: 9 }], 'A', 'amt'],
    [[], 'A', 'amt'],
    ['not-array', 'A', 'amt'],
    [[{ category: null, amt: 1 }], 'A', 'amt'],
  ],
  ifCond: [
    [1, '===', 1, ifCondOptions],
    [1, '===', 2, ifCondOptions],
    [1, '!==', 2, ifCondOptions],
    ['a', '>', 'b', ifCondOptions],
  ],
};

// Cover EVERY real artifact helpers.js, not a hand-picked subset.
const ARTIFACTS_DIR = join(ROOT, 'artifacts');
const ARTIFACTS = existsSync(ARTIFACTS_DIR)
  ? readdirSync(ARTIFACTS_DIR).filter((d) => existsSync(join(ARTIFACTS_DIR, d, 'helpers.js')))
  : [];

for (const artifact of ARTIFACTS) {
  const helpersPath = join(ARTIFACTS_DIR, artifact, 'helpers.js');

  test(`HTML helpers match old new Function extraction — ${artifact}`, () => {
    const code = readFileSync(helpersPath, 'utf8');

    let oldHelpers;
    try {
      oldHelpers = extractHelpersTheOldWay(code);
    } catch {
      // Some artifacts (print-* use require('qrcode'), the JSON-only page uses
      // `export`) could NOT be loaded by the old `new Function` path — its HTML
      // render registered no helpers and the canonical set is a strict improvement.
      // Nothing to compare against; just assert the new set is usable.
      const helpers = createReportHelpers({ numberFormat: extractNumberFormatOptions(code) });
      assert.equal(typeof helpers.formatCurrency, 'function');
      return;
    }

    // Build the NEW set the same way the consumers do: canonical helpers +
    // statically-recovered formatNumber options (preserves per-report decimals).
    const newHelpers = createReportHelpers({ numberFormat: extractNumberFormatOptions(code) });

    for (const name of WHITELIST) {
      // Only compare helpers the artifact actually defined (what the old path registered).
      if (typeof oldHelpers[name] !== 'function') continue;
      assert.equal(typeof newHelpers[name], 'function', `new module is missing helper ${name}`);

      const inputs = SAMPLE_INPUTS[name];
      if (!inputs) continue; // stateful helpers (isGroupBreak/resetGroupTracking) tested separately

      for (const args of inputs) {
        const expected = oldHelpers[name](...args);
        const actual = newHelpers[name](...args);
        assert.deepEqual(
          actual, expected,
          `${artifact}: ${name}(${JSON.stringify(args)}) → new ${JSON.stringify(actual)} !== old ${JSON.stringify(expected)}`,
        );
      }
    }
  });
}

test('extractNumberFormatOptions recovers per-report formatNumber decimals', () => {
  // tax-report keeps 2 decimals (tax rates render as "21.00").
  const taxPath = join(ARTIFACTS_DIR, 'tax-report', 'helpers.js');
  if (existsSync(taxPath)) {
    const opts = extractNumberFormatOptions(readFileSync(taxPath, 'utf8'));
    assert.deepEqual(opts, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const helpers = createReportHelpers({ numberFormat: opts });
    assert.equal(helpers.formatNumber(21), '21.00');
  }

  // A canonical report formats integers with no decimals.
  const agingPath = join(ARTIFACTS_DIR, 'aging-payable', 'helpers.js');
  if (existsSync(agingPath)) {
    assert.equal(extractNumberFormatOptions(readFileSync(agingPath, 'utf8')), undefined);
    assert.equal(createReportHelpers().formatNumber(21), '21');
  }

  // Empty / missing input → canonical default.
  assert.equal(extractNumberFormatOptions(''), undefined);
  assert.equal(extractNumberFormatOptions(undefined), undefined);
});

test('isGroupBreak / resetGroupTracking behave like the old extraction', () => {
  const code = readFileSync(join(ROOT, 'artifacts', 'aging-payable', 'helpers.js'), 'utf8');
  const oldHelpers = extractHelpersTheOldWay(code);
  const newHelpers = createReportHelpers();

  const sequence = [
    ['region', 'North'], ['region', 'North'], ['region', 'South'],
    ['region', 'South'], ['region', 'North'],
  ];
  for (const [field, value] of sequence) {
    assert.equal(
      newHelpers.isGroupBreak(field, value),
      oldHelpers.isGroupBreak(field, value),
      `isGroupBreak(${field}, ${value}) diverged`,
    );
  }

  // After reset, the first value of a group is always a break again.
  newHelpers.resetGroupTracking();
  oldHelpers.resetGroupTracking();
  assert.equal(newHelpers.isGroupBreak('region', 'North'), oldHelpers.isGroupBreak('region', 'North'));
});

test('createReportHelpers returns isolated group-break state per instance', () => {
  const a = createReportHelpers();
  const b = createReportHelpers();

  assert.equal(a.isGroupBreak('g', 'x'), true);  // first value for a
  assert.equal(b.isGroupBreak('g', 'x'), true);  // b is independent — also a break
  assert.equal(a.isGroupBreak('g', 'x'), false); // a remembers its own state
  assert.equal(b.isGroupBreak('g', 'y'), true);  // b unaffected by a
});

test('whitelist helpers are all present in the module', () => {
  const helpers = createReportHelpers();
  for (const name of WHITELIST) {
    assert.equal(typeof helpers[name], 'function', `module missing whitelisted helper: ${name}`);
  }
});
