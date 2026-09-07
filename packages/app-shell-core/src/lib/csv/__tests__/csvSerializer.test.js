import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvField, neutralizeSpreadsheetCell } from '../csvSerializer.js';
import { CSV_NEUTRALIZATION_FIXTURES } from '../csvNeutralizationFixtures.js';

/** Applies RFC 4180 quoting the way csvField does, so a fixture's expected cell can be
 * turned into the expected FIELD without restating the quoting rule per case. */
function quoted(cell) {
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

describe('neutralizeSpreadsheetCell — the canonical fixture contract (ADR-0004 D2/D3)', () => {
  for (const { description, input, expected } of CSV_NEUTRALIZATION_FIXTURES) {
    it(`${description}`, () => {
      assert.equal(neutralizeSpreadsheetCell(input), expected);
    });
  }

  // The table's own invariants — that every trigger has a fixture, that no row encodes an
  // impossible outcome — are asserted in csvNeutralizationFixtures.test.js. This file only
  // checks the IMPLEMENTATION against the table.
  it('is idempotent — neutralizing twice adds only one apostrophe', () => {
    assert.equal(neutralizeSpreadsheetCell(neutralizeSpreadsheetCell('=1+1')), "'=1+1");
  });

  it('never neutralizes a trigger that is not in the first significant position', () => {
    assert.equal(neutralizeSpreadsheetCell('Total = 1+1'), 'Total = 1+1');
  });
});

describe('csvField — neutralization then RFC 4180 quoting', () => {
  for (const { description, input, expected } of CSV_NEUTRALIZATION_FIXTURES) {
    it(`${description}`, () => {
      assert.equal(csvField(input), quoted(expected));
    });
  }

  it('puts the apostrophe INSIDE the quotes when the value also needs quoting', () => {
    assert.equal(csvField('=1+1,extra'), '"\'=1+1,extra"');
  });

  it('quotes a leading line feed, which is both a trigger and a quote-forcing character', () => {
    assert.equal(csvField('\n=1+1'), '"\'\n=1+1"');
  });

  it('quotes a leading carriage return (RFC 4180 — a lone CR needs quoting too)', () => {
    assert.equal(csvField('\r=1+1'), '"\'\r=1+1"');
  });

  it('escapes an embedded quote that arrives together with a trigger', () => {
    assert.equal(csvField('=HYPERLINK("http://x","y")'), '"\'=HYPERLINK(""http://x"",""y"")"');
  });

  it('leaves zero untouched', () => {
    assert.equal(csvField(0), '0');
  });

  it('quotes a value containing a comma', () => {
    assert.equal(csvField('texto, con coma'), '"texto, con coma"');
  });

  it('escapes embedded double quotes and quotes the field', () => {
    assert.equal(csvField('con "comillas" internas'), '"con ""comillas"" internas"');
  });

  it('preserves an embedded (non-leading) line feed and quotes the field', () => {
    assert.equal(csvField('line one\nline two'), '"line one\nline two"');
  });

  it('preserves an embedded (non-leading) CRLF and quotes the field', () => {
    assert.equal(csvField('line one\r\nline two'), '"line one\r\nline two"');
  });

  it('preserves Unicode characters', () => {
    assert.equal(csvField('José Ñáñez'), 'José Ñáñez');
  });

  it('leaves a safe header untouched', () => {
    assert.equal(csvField('Commercial Name'), 'Commercial Name');
  });

  it('is deterministic across repeated calls', () => {
    assert.equal(csvField('=1+1'), csvField('=1+1'));
  });
});
