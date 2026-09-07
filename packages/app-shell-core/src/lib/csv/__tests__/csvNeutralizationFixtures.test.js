import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSV_NEUTRALIZATION_FIXTURES,
  SPREADSHEET_FORMULA_TRIGGERS,
} from '../csvNeutralizationFixtures.js';

// ETP-5032 — the fixture table is the CONTRACT three implementations are tested against
// (this package's csvSerializer, the jsreport csvField source text in
// templates/reports/helpers/report-html-helpers.js, and NeoCsvExportService.java). That
// makes a bad row uniquely dangerous: a typo in an `expected` value would be adopted by
// all three at once and every suite would go green against a WRONG contract, with nothing
// left to catch it.
//
// So this file does not test any implementation — it deliberately imports none, to avoid
// the circularity of checking the table with the code the table governs. It asserts the
// table's own invariants using plain string operations: that each row encodes one of the
// only two outcomes the policy permits, that the declared trigger set is fully exercised,
// and that the must-not-touch cases are still there.
//
// Source of record: com.etendoerp.go/docs/security/csv-neutralization-fixtures.md.

const NEUTRALIZING_PREFIX = "'";

describe('CSV_NEUTRALIZATION_FIXTURES — table shape', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(CSV_NEUTRALIZATION_FIXTURES));
    assert.ok(CSV_NEUTRALIZATION_FIXTURES.length > 0);
  });

  it('gives every row a description and a string expectation', () => {
    for (const fixture of CSV_NEUTRALIZATION_FIXTURES) {
      assert.equal(typeof fixture.description, 'string', JSON.stringify(fixture));
      assert.ok(fixture.description.length > 0, JSON.stringify(fixture));
      assert.equal(typeof fixture.expected, 'string', fixture.description);
    }
  });

  it('keeps descriptions unique, so no row can hide behind another in the output', () => {
    const seen = CSV_NEUTRALIZATION_FIXTURES.map((f) => f.description);
    assert.deepEqual([...new Set(seen)], seen);
  });
});

describe('CSV_NEUTRALIZATION_FIXTURES — every row encodes a permitted outcome', () => {
  // The policy may do exactly two things to a value: nothing, or prepend ONE apostrophe.
  // Any other relationship between input and expected means the table is asking the
  // implementations for a transformation the policy does not have.
  it('expects either the value unchanged or the value with one apostrophe prepended', () => {
    for (const { description, input, expected } of CSV_NEUTRALIZATION_FIXTURES) {
      const asString = input == null ? '' : String(input);
      const permitted = [asString, NEUTRALIZING_PREFIX + asString];
      assert.ok(permitted.includes(expected),
        `${description}: expected ${JSON.stringify(expected)} is neither `
        + `${JSON.stringify(asString)} nor ${JSON.stringify(permitted[1])}`);
    }
  });

  it('never encodes a double prefix as the correct answer', () => {
    for (const { description, input, expected } of CSV_NEUTRALIZATION_FIXTURES) {
      const inputStarted = typeof input === 'string' && input.startsWith(NEUTRALIZING_PREFIX);
      const doubled = expected.startsWith(NEUTRALIZING_PREFIX.repeat(2));
      assert.ok(!doubled || inputStarted,
        `${description}: expects a doubled apostrophe for an input that had none`);
    }
  });

  it('maps a nullish value to an empty string, with no apostrophe', () => {
    const nullish = CSV_NEUTRALIZATION_FIXTURES.filter((f) => f.input == null);
    assert.ok(nullish.length > 0, 'the null/undefined rows of the contract are missing');
    for (const { description, expected } of nullish) {
      assert.equal(expected, '', description);
    }
  });
});

describe('SPREADSHEET_FORMULA_TRIGGERS — fully exercised by the table', () => {
  it('declares no duplicate trigger', () => {
    assert.deepEqual([...new Set(SPREADSHEET_FORMULA_TRIGGERS)], SPREADSHEET_FORMULA_TRIGGERS);
  });

  it('has, for every trigger, a fixture that STARTS with it and is neutralized', () => {
    const uncovered = SPREADSHEET_FORMULA_TRIGGERS.filter(
      (trigger) => !CSV_NEUTRALIZATION_FIXTURES.some(
        ({ input, expected }) => typeof input === 'string'
          && input.startsWith(trigger)
          && expected === NEUTRALIZING_PREFIX + input,
      ),
    );
    assert.deepEqual(uncovered, [],
      'a trigger is declared without a fixture proving it is neutralized in first position');
  });

  it('covers the classic initiators, the standalone controls and the full-width variants', () => {
    // Named explicitly so dropping a whole trigger CLASS from the declared set fails here,
    // rather than passing because the remaining triggers are all still covered.
    for (const trigger of ['=', '+', '-', '@', '\t', '\r', '\n', '＝', '＋', '－', '＠']) {
      assert.ok(SPREADSHEET_FORMULA_TRIGGERS.includes(trigger),
        `trigger ${JSON.stringify(trigger)} was removed from the declared set`);
    }
  });
});

describe('CSV_NEUTRALIZATION_FIXTURES — the cases that keep the policy honest', () => {
  /** The fixture for `input`, or undefined. */
  function fixtureFor(input) {
    return CSV_NEUTRALIZATION_FIXTURES.find((f) => f.input === input);
  }

  it('keeps the skip-prefix cases, so a marker cannot hide behind whitespace or a BOM', () => {
    // Each of these must still be neutralized even though it does not START with a trigger.
    for (const input of ['   =1+1', '\uFEFF=1+1', '\u00A0=1+1']) {
      const fixture = fixtureFor(input);
      assert.ok(fixture, `the skip-prefix row for ${JSON.stringify(input)} is missing`);
      assert.equal(fixture.expected, NEUTRALIZING_PREFIX + input, fixture.description);
    }
  });

  it('keeps must-not-touch rows, so the contract cannot degenerate into prefixing everything', () => {
    const untouched = CSV_NEUTRALIZATION_FIXTURES.filter(
      ({ input, expected }) => typeof input === 'string' && input !== '' && expected === input,
    );
    assert.ok(untouched.length >= 3,
      `only ${untouched.length} must-not-touch rows left; plain text, leading whitespace `
      + 'without a marker, an already-neutralized value and a mid-value trigger must all stay');
  });

  it('keeps the already-neutralized row, the only reason double-prefixing is testable', () => {
    const fixture = fixtureFor("'=1+1");
    assert.ok(fixture, 'the already-neutralized row is missing');
    assert.equal(fixture.expected, "'=1+1");
  });

  it('keeps the negative-number row, the documented user-visible trade-off', () => {
    const fixture = fixtureFor('-500.00');
    assert.ok(fixture, 'the negative-number row is missing');
    assert.equal(fixture.expected, "'-500.00");
  });

  it('keeps a payload that also forces RFC 4180 quoting, pinning the ordering', () => {
    const withQuotesAndComma = CSV_NEUTRALIZATION_FIXTURES.filter(
      ({ input, expected }) => typeof input === 'string'
        && /[",\n\r]/.test(input)
        && expected.startsWith(NEUTRALIZING_PREFIX),
    );
    assert.ok(withQuotesAndComma.length > 0,
      'no fixture combines a trigger with a delimiter, so neutralize-before-quote is untested');
  });
});
