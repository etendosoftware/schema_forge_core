import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDashboardAmount, formatDashboardCompact } from '../dashboardNumberFormat.js';

describe('formatDashboardAmount', () => {
  it('uses ISO currency code prefix on dashboard amounts', () => {
    assert.equal(formatDashboardAmount(7284.2, 'EUR', 'es-ES'), 'EUR 7284,20');
    assert.equal(formatDashboardAmount(7284.2, 'USD', 'en-US'), 'USD 7,284.20');
  });

  it('normalizes lowercase currency labels to uppercase code', () => {
    assert.equal(formatDashboardAmount(10, 'usd', 'en-US'), 'USD 10.00');
  });

  it('keeps sign before currency code for negative values', () => {
    assert.equal(formatDashboardAmount(-99.5, 'EUR', 'es-ES'), '-EUR 99,50');
  });

  it('falls back to numeric formatting when currency is missing', () => {
    assert.equal(formatDashboardAmount(7284.2, '', 'es-ES'), '7284,20');
  });
});

describe('formatDashboardCompact', () => {
  it('keeps compact suffix with ISO currency code prefix', () => {
    assert.equal(
      formatDashboardCompact(1500, { currencyLabel: 'EUR', locale: 'es-ES' }),
      'EUR 1,50K'
    );
  });
});
