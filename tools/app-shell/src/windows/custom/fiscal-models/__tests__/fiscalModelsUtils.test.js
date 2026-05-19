import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUSES, STATUS_COLOR, STATUS_ORDER,
  formatPeriod, formatAmount, fmtDecl, formatPercent, computeUpcomingDeadlines,
  computeBoxes303,
} from '../fiscalModelsUtils.js';

describe('STATUSES — enum completeness', () => {
  it('has exactly 7 statuses', () => assert.equal(STATUSES.length, 7));
  it('includes omitido', () => assert.ok(STATUSES.includes('omitido')));
  it('includes pendiente', () => assert.ok(STATUSES.includes('pendiente')));
  it('includes borrador', () => assert.ok(STATUSES.includes('borrador')));
  it('includes listo', () => assert.ok(STATUSES.includes('listo')));
  it('includes presentado', () => assert.ok(STATUSES.includes('presentado')));
  it('includes presentadoOtra', () => assert.ok(STATUSES.includes('presentadoOtra')));
  it('includes presentadoAcuse', () => assert.ok(STATUSES.includes('presentadoAcuse')));
});

describe('STATUS_COLOR — all statuses have colors', () => {
  for (const s of ['omitido','pendiente','borrador','listo','presentado','presentadoOtra','presentadoAcuse']) {
    it(`${s} has a color`, () => assert.ok(typeof STATUS_COLOR[s] === 'string'));
  }
});

describe('STATUS_ORDER — free transitions', () => {
  it('contains all 7 statuses', () => assert.equal(STATUS_ORDER.length, 7));
  it('is an array', () => assert.ok(Array.isArray(STATUS_ORDER)));
});

describe('formatPeriod', () => {
  it('passes through quarter codes (T1, T4)', () => assert.equal(formatPeriod('T1'), 'T1'));
  it('converts two-digit month to NM format', () => assert.equal(formatPeriod('03'), '3M'));
  it('converts single-digit month string', () => assert.equal(formatPeriod('01'), '1M'));
  it('passes through unknown formats', () => assert.equal(formatPeriod('anual'), 'anual'));
  it('returns em-dash for null', () => assert.equal(formatPeriod(null), '—'));
  it('returns em-dash for undefined', () => assert.equal(formatPeriod(undefined), '—'));
});

describe('formatAmount', () => {
  it('returns em-dash for null', () => assert.equal(formatAmount(null), '—'));
  it('returns em-dash for undefined', () => assert.equal(formatAmount(undefined), '—'));
  it('formats positive number with € symbol', () => assert.match(formatAmount(12179.75), /€|EUR/));
  it('formats negative number with minus sign', () => assert.match(formatAmount(-100), /-/));
});

describe('formatPercent', () => {
  it('returns em-dash for null', () => assert.equal(formatPercent(null), '—'));
  it('returns em-dash for undefined', () => assert.equal(formatPercent(undefined), '—'));
  it('formats integer rate without decimals', () => assert.equal(formatPercent(21), '21 %'));
  it('formats decimal rate with comma separator', () => assert.equal(formatPercent(1.75), '1,75 %'));
  it('formats zero', () => assert.equal(formatPercent(0), '0 %'));
});

describe('fmtDecl', () => {
  it('formats a 303 quarterly declaration', () => {
    const result = fmtDecl({ model: '303', year: 2026, period: 'T1' });
    assert.ok(result.includes('303'));
    assert.ok(result.includes('2026'));
    assert.ok(result.includes('T1'));
  });
  it('formats a 349 monthly declaration', () => {
    const result = fmtDecl({ model: '349', year: 2026, period: '03' });
    assert.ok(result.includes('349'));
    assert.ok(result.includes('2026'));
  });
});

describe('computeUpcomingDeadlines', () => {
  const D = (model, year, period, status) => ({
    id: `${model}-${year}-${period}`, model, year, period, status,
  });

  it('excludes presentado', () => {
    assert.equal(computeUpcomingDeadlines([D('303', 2026, 'T1', 'presentado')]).length, 0);
  });
  it('excludes presentadoAcuse', () => {
    assert.equal(computeUpcomingDeadlines([D('303', 2026, 'T1', 'presentadoAcuse')]).length, 0);
  });
  it('excludes presentadoOtra', () => {
    assert.equal(computeUpcomingDeadlines([D('303', 2026, 'T1', 'presentadoOtra')]).length, 0);
  });
  it('excludes omitido', () => {
    assert.equal(computeUpcomingDeadlines([D('303', 2026, 'T1', 'omitido')]).length, 0);
  });
  it('includes borrador', () => {
    assert.equal(computeUpcomingDeadlines([D('303', 2026, 'T1', 'borrador')]).length, 1);
  });
  it('includes pendiente', () => {
    assert.equal(computeUpcomingDeadlines([D('349', 2026, '04', 'pendiente')]).length, 1);
  });
  it('T1 deadline is April 20 of the same year', () => {
    const [{ deadline }] = computeUpcomingDeadlines([D('303', 2026, 'T1', 'borrador')]);
    assert.equal(deadline.getFullYear(), 2026);
    assert.equal(deadline.getMonth(), 3);
    assert.equal(deadline.getDate(), 20);
  });
  it('T2 deadline is July 20', () => {
    const [{ deadline }] = computeUpcomingDeadlines([D('303', 2026, 'T2', 'borrador')]);
    assert.equal(deadline.getMonth(), 6);
    assert.equal(deadline.getDate(), 20);
  });
  it('T3 deadline is October 20', () => {
    const [{ deadline }] = computeUpcomingDeadlines([D('303', 2026, 'T3', 'borrador')]);
    assert.equal(deadline.getMonth(), 9);
    assert.equal(deadline.getDate(), 20);
  });
  it('T4 deadline is January 20 of next year', () => {
    const [{ deadline }] = computeUpcomingDeadlines([D('303', 2025, 'T4', 'pendiente')]);
    assert.equal(deadline.getFullYear(), 2026);
    assert.equal(deadline.getMonth(), 0);
    assert.equal(deadline.getDate(), 20);
  });
  it('monthly period 04 deadline is May 20', () => {
    const [{ deadline }] = computeUpcomingDeadlines([D('349', 2026, '04', 'pendiente')]);
    assert.equal(deadline.getFullYear(), 2026);
    assert.equal(deadline.getMonth(), 4);
    assert.equal(deadline.getDate(), 20);
  });
  it('monthly period 12 deadline is January 20 of next year', () => {
    const [{ deadline }] = computeUpcomingDeadlines([D('349', 2025, '12', 'pendiente')]);
    assert.equal(deadline.getFullYear(), 2026);
    assert.equal(deadline.getMonth(), 0);
    assert.equal(deadline.getDate(), 20);
  });
  it('sorts chronologically (earlier deadline first)', () => {
    const decls = [D('303', 2026, 'T2', 'borrador'), D('303', 2026, 'T1', 'borrador')];
    const result = computeUpcomingDeadlines(decls);
    assert.ok(result[0].deadline < result[1].deadline);
  });
  it('respects limit parameter', () => {
    const decls = ['T1', 'T2', 'T3', 'T4'].map(p => D('303', 2026, p, 'pendiente'));
    assert.equal(computeUpcomingDeadlines(decls, 2).length, 2);
  });
  it('returns empty array when all completed', () => {
    const decls = [D('303', 2026, 'T1', 'presentadoAcuse'), D('349', 2026, '04', 'omitido')];
    assert.equal(computeUpcomingDeadlines(decls).length, 0);
  });
  it('each result item has decl and deadline properties', () => {
    const [item] = computeUpcomingDeadlines([D('303', 2026, 'T1', 'borrador')]);
    assert.ok(item.decl);
    assert.ok(item.deadline instanceof Date);
  });
});

describe('computeBoxes303 — mock fallback (no token)', () => {
  it('returns T2 2026 boxes', async () => {
    const result = await computeBoxes303({ year: 2026, period: 'T2' });
    assert.ok(result !== null);
    assert.equal(result.boxes[27], 1309.98);
    assert.equal(result.summary.result, -35479.08);
  });
  it('returns T1 2026 boxes', async () => {
    const result = await computeBoxes303({ year: 2026, period: 'T1' });
    assert.ok(result !== null);
    assert.equal(result.boxes[27], 682.08);
    assert.equal(result.summary.accrued, 682.08);
  });
  it('returns null for unsupported period', async () => {
    const result = await computeBoxes303({ year: 2025, period: 'T3' });
    assert.equal(result, null);
  });
});
