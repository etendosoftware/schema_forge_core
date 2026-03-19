import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatDate, formatCurrency, formatBoolean, truncate } from '../../templates/reports/helpers/common.js';

describe('report helpers', () => {
  describe('formatDate', () => {
    it('formats ISO date to locale string', () => {
      assert.equal(formatDate('2026-03-18', 'en_US'), '03/18/2026');
    });

    it('formats ISO date for es_ES', () => {
      assert.equal(formatDate('2026-03-18', 'es_ES'), '18/03/2026');
    });

    it('returns empty string for null', () => {
      assert.equal(formatDate(null, 'en_US'), '');
    });

    it('returns empty string for undefined', () => {
      assert.equal(formatDate(undefined, 'en_US'), '');
    });
  });

  describe('formatCurrency', () => {
    it('formats number with 2 decimals', () => {
      assert.equal(formatCurrency(1234.5, 'en_US'), '1,234.50');
    });

    it('formats for es_ES locale', () => {
      // Node.js 22 ICU renders es-ES without thousands separator on this platform.
      assert.equal(formatCurrency(1234.5, 'es_ES'), '1234,50');
    });

    it('returns empty string for null', () => {
      assert.equal(formatCurrency(null, 'en_US'), '');
    });
  });

  describe('formatBoolean', () => {
    it('returns Yes/No for en_US', () => {
      assert.equal(formatBoolean(true, 'en_US'), 'Yes');
      assert.equal(formatBoolean(false, 'en_US'), 'No');
    });

    it('returns Si/No for es_ES', () => {
      assert.equal(formatBoolean(true, 'es_ES'), 'Si');
      assert.equal(formatBoolean(false, 'es_ES'), 'No');
    });
  });

  describe('truncate', () => {
    it('truncates long strings', () => {
      assert.equal(truncate('Hello World', 5), 'Hello...');
    });

    it('does not truncate short strings', () => {
      assert.equal(truncate('Hi', 10), 'Hi');
    });

    it('returns empty string for null', () => {
      assert.equal(truncate(null, 10), '');
    });
  });
});
