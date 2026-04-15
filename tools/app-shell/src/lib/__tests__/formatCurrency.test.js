import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency } from '../formatCurrency.js';

describe('formatCurrency', () => {
  describe('USD — symbol before amount', () => {
    it('formats positive amount', () => {
      assert.equal(formatCurrency('USD', 1234.56), '$1,234.56');
    });

    it('formats zero', () => {
      assert.equal(formatCurrency('USD', 0), '$0.00');
    });

    it('formats negative amount', () => {
      assert.equal(formatCurrency('USD', -250.5), '-$250.50');
    });

    it('formats large amount with thousand separators', () => {
      assert.equal(formatCurrency('USD', 1_000_000), '$1,000,000.00');
    });

    it('rounds to two decimal places', () => {
      assert.equal(formatCurrency('USD', 9.999), '$10.00');
    });

    it('preserves two decimal places', () => {
      assert.equal(formatCurrency('USD', 1.1), '$1.10');
    });
  });

  describe('EUR — symbol after amount with space', () => {
    it('formats positive amount', () => {
      assert.equal(formatCurrency('EUR', 1234.56), '1,234.56 €');
    });

    it('formats zero', () => {
      assert.equal(formatCurrency('EUR', 0), '0.00 €');
    });

    it('formats negative amount', () => {
      assert.equal(formatCurrency('EUR', -99.9), '-99.90 €');
    });

    it('formats large amount with thousand separators', () => {
      assert.equal(formatCurrency('EUR', 1_000_000), '1,000,000.00 €');
    });
  });

  describe('other currencies — symbol before amount (same as USD)', () => {
    it('formats ARS with symbol before amount', () => {
      const result = formatCurrency('ARS', 500);
      assert.match(result, /500/);
      // Symbol must come before the number
      const symbolIdx = result.search(/[^0-9,.\-\s]/);
      const numberIdx = result.search(/[0-9]/);
      assert.ok(symbolIdx < numberIdx, `Expected symbol before number in: ${result}`);
    });

    it('formats GBP with symbol before amount', () => {
      assert.equal(formatCurrency('GBP', 99.5), '£99.50');
    });
  });

  describe('invalid numeric input', () => {
    it('returns em dash for null', () => {
      assert.equal(formatCurrency('USD', null), '\u2014');
    });

    it('returns em dash for undefined', () => {
      assert.equal(formatCurrency('USD', undefined), '\u2014');
    });

    it('returns em dash for NaN', () => {
      assert.equal(formatCurrency('USD', NaN), '\u2014');
    });

    it('returns em dash for non-numeric string', () => {
      assert.equal(formatCurrency('USD', 'abc'), '\u2014');
    });

    it('returns em dash for Infinity', () => {
      assert.equal(formatCurrency('USD', Infinity), '\u2014');
    });
  });

  describe('invalid or unsupported currency code', () => {
    it('falls back to plain numeric formatting for unknown code', () => {
      const result = formatCurrency('XYZ_INVALID', 100);
      assert.match(result, /100/);
      assert.equal(result, '100.00');
    });

    it('falls back for empty string currency code', () => {
      const result = formatCurrency('', 50);
      assert.match(result, /50/);
    });
  });
});
