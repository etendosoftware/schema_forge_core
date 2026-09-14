import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseImportNumber, isInvalidImportNumber } from '../parseImportNumber.js';

describe('parseImportNumber', () => {
  it('parses a plain decimal point', () => {
    assert.equal(parseImportNumber('3.50'), 3.5);
    assert.equal(parseImportNumber('1234.56'), 1234.56);
  });

  it('parses the es-ES decimal comma', () => {
    assert.equal(parseImportNumber('12,50'), 12.5);
  });

  it('parses es-ES thousands separators alongside the decimal comma', () => {
    // The bug this guards: read naively, "1.234,56" becomes 1.234 — three orders of
    // magnitude off, silently, on every amount in a Spanish-exported file.
    assert.equal(parseImportNumber('1.234,56'), 1234.56);
  });

  it('reads whitespace as a thousands separator when it groups in threes', () => {
    assert.equal(parseImportNumber(' 1 234,56 '), 1234.56);
    assert.equal(parseImportNumber('1 234 567,89'), 1234567.89);
    // A tab is what a .txt export writes; `\s` covers it, and the non-breaking spaces
    // locale-aware exports emit, without naming them one by one.
    assert.equal(parseImportNumber('1\t234,5'), 1234.5);
  });

  it('returns null for a blank cell, which is NOT an error', () => {
    // A blank amount means "this row says nothing about the price", so the row must stay
    // importable. Conflating blank with invalid is exactly what made ETP-4995's template
    // un-importable.
    assert.equal(parseImportNumber(''), null);
    assert.equal(parseImportNumber('   '), null);
    assert.equal(parseImportNumber(null), null);
    assert.equal(parseImportNumber(undefined), null);
  });

  it('returns NaN for a non-empty, non-numeric cell', () => {
    assert.ok(Number.isNaN(parseImportNumber('abc')));
    assert.ok(Number.isNaN(parseImportNumber('12abc')));
  });

  it('accepts a negative number and a number typed as a JS number', () => {
    assert.equal(parseImportNumber('-8,25'), -8.25);
    assert.equal(parseImportNumber(42), 42);
  });

  // ETP-5228 — the reported cells. Both used to parse to a plausible-looking WRONG number
  // with nothing flagged: the product was created, and only opening it showed the price.
  describe('ETP-5228 — a cell that is not a price is a row error, not a silent value', () => {
    it('rejects whitespace that is not a thousands separator', () => {
      // "1 0.00" was stripped to "10.00" and imported as 10.
      assert.ok(Number.isNaN(parseImportNumber('1 0.00')));
      // Grouping must be three digits per group, every group.
      assert.ok(Number.isNaN(parseImportNumber('1 2345')));
      assert.ok(Number.isNaN(parseImportNumber('1 2 3')));
    });

    it('rejects scientific notation', () => {
      // "1.5E2" was imported as 150.
      assert.ok(Number.isNaN(parseImportNumber('1.5E2')));
      assert.ok(Number.isNaN(parseImportNumber('1e3')));
    });

    it('rejects the other literal forms Number() accepts but no export ever writes', () => {
      // Same defect class as the two reported cells, found while fixing them: `Number('0x10')`
      // is 16, so a cell reading 0x10 imported as a price of sixteen.
      assert.ok(Number.isNaN(parseImportNumber('0x10')));
      assert.ok(Number.isNaN(parseImportNumber('0b11')));
      assert.ok(Number.isNaN(parseImportNumber('Infinity')));
    });

    it('reads the rightmost separator as the decimal when a cell carries both', () => {
      // The en-US convention used to be read as if it were the es-ES one: "1,234.56" became
      // 1.23456, three orders of magnitude off, with nothing flagged.
      assert.equal(parseImportNumber('1,234.56'), 1234.56);
      assert.equal(parseImportNumber('1.234,56'), 1234.56);
    });

    it('keeps a lone separator as the decimal point, unlike statementAmount.js', () => {
      // A unit price legitimately carries three decimals, so "1.234" cannot be re-read as a
      // grouped 1234 here the way a bank amount is. Asserted so the divergence is deliberate
      // rather than something a later "align the two parsers" change silently removes.
      assert.equal(parseImportNumber('1.234'), 1.234);
      assert.equal(parseImportNumber('0.125'), 0.125);
    });

    it('still accepts the forms a real export writes', () => {
      // The gate must not turn a valid file into a wall of row errors.
      assert.equal(parseImportNumber('+5'), 5);
      assert.equal(parseImportNumber('.5'), 0.5);
      assert.equal(parseImportNumber('5.'), 5);
      assert.equal(parseImportNumber('  42  '), 42);
    });
  });
});

describe('isInvalidImportNumber', () => {
  it('is true only for a non-empty cell that is not a number', () => {
    assert.equal(isInvalidImportNumber('abc'), true);
    assert.equal(isInvalidImportNumber('12,50'), false);
    assert.equal(isInvalidImportNumber(''), false);
    assert.equal(isInvalidImportNumber(null), false);
  });

  // This is the predicate `validateRows` calls for every `isNumeric` column, so it is what
  // actually puts the row in the review queue's Errores tab before the send — the behaviour
  // ETP-5228 asks for. Without it the malformed cell only failed inside buildPriceOperation,
  // after the user had already confirmed.
  it('flags the ETP-5228 cells so the review queue catches them pre-send', () => {
    assert.equal(isInvalidImportNumber('1 0.00'), true);
    assert.equal(isInvalidImportNumber('1.5E2'), true);
  });
});
