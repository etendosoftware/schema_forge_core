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

  it('ignores whitespace inside the number', () => {
    assert.equal(parseImportNumber(' 1 234,56 '), 1234.56);
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
});

describe('isInvalidImportNumber', () => {
  it('is true only for a non-empty cell that is not a number', () => {
    assert.equal(isInvalidImportNumber('abc'), true);
    assert.equal(isInvalidImportNumber('12,50'), false);
    assert.equal(isInvalidImportNumber(''), false);
    assert.equal(isInvalidImportNumber(null), false);
  });
});
