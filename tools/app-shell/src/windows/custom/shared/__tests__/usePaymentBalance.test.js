import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pure utility functions exported from usePaymentBalance
import { round2, formatPlain, parsePlain } from '../usePaymentBalance.js';

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    assert.strictEqual(round2(1.239), 1.24);
    assert.strictEqual(round2(1.234), 1.23);
    assert.strictEqual(round2(0), 0);
  });

  it('handles string input', () => {
    assert.strictEqual(round2('3.5'), 3.5);
  });

  it('returns 0 for non-numeric input', () => {
    assert.strictEqual(round2(null), 0);
    assert.strictEqual(round2(undefined), 0);
    assert.strictEqual(round2('abc'), 0);
  });
});

describe('formatPlain', () => {
  it('formats integers with comma decimal separator', () => {
    assert.strictEqual(formatPlain(100), '100,00');
  });

  it('inserts thousands separators using dots', () => {
    assert.strictEqual(formatPlain(6420), '6.420,00');
    assert.strictEqual(formatPlain(1000000), '1.000.000,00');
  });

  it('formats decimals correctly', () => {
    assert.strictEqual(formatPlain(1234.56), '1.234,56');
  });

  it('handles negative numbers', () => {
    assert.strictEqual(formatPlain(-100.5), '-100,50');
  });

  it('formats zero', () => {
    assert.strictEqual(formatPlain(0), '0,00');
  });

  it('treats non-finite values as 0', () => {
    assert.strictEqual(formatPlain(NaN), '0,00');
    assert.strictEqual(formatPlain(Infinity), '0,00');
  });
});

describe('parsePlain', () => {
  it('parses es-ES formatted string', () => {
    assert.strictEqual(parsePlain('6.420,00'), 6420);
    assert.strictEqual(parsePlain('1.234,56'), 1234.56);
  });

  it('returns null for blank input', () => {
    assert.strictEqual(parsePlain(''), null);
    assert.strictEqual(parsePlain('   '), null);
    assert.strictEqual(parsePlain(null), null);
  });

  it('returns null for invalid input', () => {
    assert.strictEqual(parsePlain('abc'), null);
  });

  it('round-trips with formatPlain', () => {
    const original = 1234.56;
    assert.strictEqual(parsePlain(formatPlain(original)), original);
  });
});
