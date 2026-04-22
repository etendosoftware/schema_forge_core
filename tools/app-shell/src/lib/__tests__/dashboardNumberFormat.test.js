import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDashboardAmount,
  formatDashboardCompact,
  formatDashboardNumber,
} from '../dashboardNumberFormat.js';

describe('formatDashboardNumber', () => {
  it('always uses en-US separators regardless requested locale', () => {
    assert.equal(
      formatDashboardNumber(3850.22, 'es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      '3,850.22'
    );
    assert.equal(
      formatDashboardNumber(3850.22, 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      '3,850.22'
    );
  });
});

describe('formatDashboardAmount', () => {
  it('uses ISO currency code prefix on dashboard amounts', () => {
    assert.equal(formatDashboardAmount(7284.2, 'EUR', 'es-ES'), 'EUR 7,284.20');
    assert.equal(formatDashboardAmount(7284.2, 'USD', 'en-US'), 'USD 7,284.20');
  });

  it('keeps en-US separators regardless requested locale', () => {
    assert.equal(formatDashboardAmount(7284.2, 'EUR', 'es-ES'), 'EUR 7,284.20');
    assert.equal(formatDashboardAmount(7284.2, 'EUR', 'en-US'), 'EUR 7,284.20');
  });

  it('normalizes lowercase currency labels to uppercase code', () => {
    assert.equal(formatDashboardAmount(10, 'usd', 'en-US'), 'USD 10.00');
  });

  it('keeps sign before currency code for negative values', () => {
    assert.equal(formatDashboardAmount(-99.5, 'EUR', 'es-ES'), '-EUR 99.50');
  });

  it('falls back to numeric formatting when currency is missing', () => {
    assert.equal(formatDashboardAmount(7284.2, '', 'es-ES'), '7,284.20');
  });
});

describe('formatDashboardCompact', () => {
  it('keeps compact suffix with ISO currency code prefix', () => {
    assert.equal(
      formatDashboardCompact(1500, { currencyLabel: 'EUR', locale: 'es-ES' }),
      'EUR 1.50K'
    );
  });
});
