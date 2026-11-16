// @covers cli/src/report-periods.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildPeriodValues, substitutePeriods, assertNoPeriodsToken, hullParams, hasPeriods, maxPeriodBucketsFor,
  normalizeCompareMode, buildPeriodMeta, ReportPeriodsError, SCREEN_MAX_BUCKETS, EXPORT_MAX_BUCKETS,
} from '../src/report-periods.js';

const tuple = (cur, sly = '2025-01-01..2025-01-31', prev = '2025-12-01..2025-12-31') => `${cur}|${sly}|${prev}`;
const JAN = tuple('2026-01-01..2026-01-31');
const TOTAL = tuple('2026-01-01..2026-03-31', '2025-01-01..2025-03-31', '2025-10-01..2025-12-31');
const WIDE = tuple('2026-01-01..2026-12-31', '2025-01-01..2025-12-31', '2025-01-01..2025-12-31');
const MONTHS = (n) => [WIDE, ...Array.from({ length: n - 1 }, (_, i) => {
  const m = String((i % 12) + 1).padStart(2, '0');
  const end = (y) => `${y}-${m}-${String(new Date(Date.UTC(y, (i % 12) + 1, 0)).getUTCDate())}`;
  return tuple(`2026-${m}-01..${end(2026)}`, `2025-${m}-01..${end(2025)}`, `2025-${m}-01..${end(2025)}`);
})].join(',');

const fails = (raw, opts, code, re) => assert.throws(() => buildPeriodValues(raw, opts), (e) => {
  assert.ok(e instanceof ReportPeriodsError);
  assert.equal(e.status, 400);
  assert.equal(e.code, code);
  if (re) assert.match(e.message, re);
  return true;
});

describe('buildPeriodValues — shape', () => {
  it('builds VALUES with every date re-serialised as a ::date literal', () => {
    const r = buildPeriodValues(TOTAL);
    assert.equal(r.values, "(0, '2026-01-01'::date, '2026-03-31'::date, '2025-01-01'::date, '2025-03-31'::date, '2025-10-01'::date, '2025-12-31'::date)");
    assert.equal(r.grain, 'total');
    assert.equal(r.hiddenCount, 0);
  });

  it('rejects a malformed date and Feb 30', () => {
    fails(tuple('2026-1-01..2026-01-31'), {}, 'INVALID_PERIODS', /bad date/);
    fails(tuple('2026-02-30..2026-03-01'), {}, 'INVALID_PERIODS', /not a real day/);
  });

  it('rejects from > to', () => {
    fails(tuple('2026-02-01..2026-01-31'), {}, 'INVALID_PERIODS', /after it ends/);
  });

  it('rejects the wrong tuple arity and the wrong range arity', () => {
    fails('2026-01-01..2026-01-31|2025-01-01..2025-01-31', {}, 'INVALID_PERIODS', /range\|sly\|prev/);
    fails(`${JAN}|2025-01-01..2025-01-31`, {}, 'INVALID_PERIODS');
    fails(tuple('2026-01-01..2026-01-15..2026-01-31'), {}, 'INVALID_PERIODS', /from\.\.to/);
    fails(tuple('2026-01-01'), {}, 'INVALID_PERIODS', /from\.\.to/);
  });

  it('rejects quote and SQL injection attempts without echoing them into SQL', () => {
    for (const evil of [
      "2026-01-01'); DROP TABLE fact_acct;--..2026-01-31",
      "2026-01-01..2026-01-31'::date) UNION SELECT 1 --",
      '2026-01-01..2026-01-31;SELECT 1',
    ]) fails(tuple(evil), {}, 'INVALID_PERIODS');
  });

  it('rejects an over-long string and non-strings', () => {
    fails(`${TOTAL}${','.repeat(2000)}`, { maxBuckets: 99 }, 'INVALID_PERIODS', /non-empty/);
    fails(undefined, {}, 'INVALID_PERIODS');
    fails(42, {}, 'INVALID_PERIODS');
  });

  it('treats a blank value as absent: empty string throws, hasPeriods is false', () => {
    fails('', {}, 'INVALID_PERIODS');
    assert.equal(hasPeriods({ periods: '' }), false);
    assert.equal(hasPeriods({ periods: null }), false);
    assert.equal(hasPeriods({}), false);
    assert.equal(hasPeriods(undefined), false);
    assert.equal(hasPeriods({ periods: TOTAL }), true);
  });
});

describe('buildPeriodValues — length limits', () => {
  it('month bucket: 31 days ok, 32 days too long', () => {
    assert.doesNotThrow(() => buildPeriodValues(`${TOTAL},${JAN}`, { grain: 'month' }));
    fails(`${TOTAL},${tuple('2026-01-01..2026-02-01')}`, { grain: 'month' }, 'PERIOD_RANGE_TOO_LONG');
  });

  it('quarter bucket: 92 days ok, 93 days too long', () => {
    const q = tuple('2026-07-01..2026-09-30', '2025-07-01..2025-09-30', '2026-04-01..2026-06-30'); // 92 days
    assert.doesNotThrow(() => buildPeriodValues(`${WIDE},${q}`, { grain: 'quarter' }));
    fails(`${WIDE},${tuple('2026-07-01..2026-10-01', '2025-07-01..2025-09-30', '2026-04-01..2026-06-30')}`, { grain: 'quarter' }, 'PERIOD_RANGE_TOO_LONG');
  });

  it('bucket 0: 24 months + 1 day ok, one day more too long, in the export formats only (D5)', () => {
    const ok = tuple('2024-01-01..2026-01-01', '2023-01-01..2024-12-31', '2022-01-01..2023-12-31');
    assert.doesNotThrow(() => buildPeriodValues(ok, { capRange: true }));
    const over = tuple('2024-01-01..2026-01-02', '2023-01-01..2024-12-31', '2022-01-01..2023-12-31');
    fails(over, { capRange: true }, 'PERIOD_RANGE_TOO_LONG');
    assert.doesNotThrow(() => buildPeriodValues(over));
  });

  it('a compared range 460 days away is accepted, 461 is refused', () => {
    const near = tuple('2026-01-01..2026-01-31', '2024-09-28..2024-10-28', '2026-01-01..2026-01-31'); // from 460 d, to 460 d
    assert.doesNotThrow(() => buildPeriodValues(`${TOTAL},${near}`, { grain: 'month' }));
    const far = tuple('2026-01-01..2026-01-31', '2024-09-27..2024-10-27', '2026-01-01..2026-01-31');
    fails(`${TOTAL},${far}`, { grain: 'month' }, 'INVALID_PERIODS', /too far/);
  });

  it('bucket 0 widens the compared distance by the range length', () => {
    // range = 90 days; previous period sits ~560 days back, beyond 460 but within 460 + 90.
    const t = tuple('2026-01-01..2026-03-31', '2025-01-01..2025-03-31', '2024-07-01..2024-09-30');
    assert.doesNotThrow(() => buildPeriodValues(t));
    // The same distance on a month bucket is refused.
    const m = tuple('2026-01-01..2026-01-31', '2025-01-01..2025-01-31', '2024-07-01..2024-07-31');
    fails(`${TOTAL},${m}`, { grain: 'month' }, 'INVALID_PERIODS', /too far/);
  });
});

describe('buildPeriodValues — long ranges and bucket containment', () => {
  const LONG = '2023-01-01..2025-12-31'; // 3 years, 1096 days
  const longTuple = tuple(LONG, '2022-01-01..2022-12-31', '2020-01-01..2022-12-31');
  const MONTH_IN = tuple('2024-02-01..2024-02-29', '2023-02-01..2023-02-28', '2024-01-01..2024-01-31');
  const QUARTER_IN = tuple('2024-04-01..2024-06-30', '2023-04-01..2023-06-30', '2024-01-01..2024-03-31');
  const shifted = (days) => {
    const d = (s) => new Date(Date.UTC(...s.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) - days * 86_400_000).toISOString().slice(0, 10);
    return tuple(LONG, `${d('2023-01-01')}..${d('2025-12-31')}`, '2022-01-01..2022-12-31');
  };

  it('a 3-year range is accepted for total, month and quarter without the export cap', () => {
    assert.doesNotThrow(() => buildPeriodValues(longTuple, { grain: 'total' }));
    assert.doesNotThrow(() => buildPeriodValues(`${longTuple},${MONTH_IN}`, { grain: 'month' }));
    assert.doesNotThrow(() => buildPeriodValues(`${longTuple},${QUARTER_IN}`, { grain: 'quarter' }));
  });

  it('the same 3-year range is PERIOD_RANGE_TOO_LONG with the export cap, for every grain', () => {
    fails(longTuple, { grain: 'total', capRange: true }, 'PERIOD_RANGE_TOO_LONG');
    fails(`${longTuple},${MONTH_IN}`, { grain: 'month', capRange: true }, 'PERIOD_RANGE_TOO_LONG');
    fails(`${longTuple},${QUARTER_IN}`, { grain: 'quarter', capRange: true }, 'PERIOD_RANGE_TOO_LONG');
  });

  it('a compared range of a long bucket 0 may sit 460 days plus the range length away, no further', () => {
    assert.doesNotThrow(() => buildPeriodValues(shifted(460 + 1096)));
    fails(shifted(460 + 1096 + 1), {}, 'INVALID_PERIODS', /too far/);
  });

  it('a bucket after the range that starts before it, ends after it, or lies elsewhere is INVALID_PERIODS', () => {
    const before = tuple('2022-12-01..2022-12-31', '2021-12-01..2021-12-31', '2022-11-01..2022-11-30');
    const after = tuple('2026-01-01..2026-01-31', '2025-01-01..2025-01-31', '2025-12-01..2025-12-31');
    const straddle = tuple('2025-12-15..2026-01-14', '2024-12-15..2025-01-14', '2025-11-15..2025-12-14');
    for (const bucket of [before, after, straddle]) fails(`${longTuple},${bucket}`, { grain: 'month' }, 'INVALID_PERIODS', /outside the range/);
  });

  it('a bucket on the very edges of the range is inside it', () => {
    const first = tuple('2023-01-01..2023-01-31', '2022-01-01..2022-01-31', '2022-12-01..2022-12-31');
    const last = tuple('2025-12-01..2025-12-31', '2024-12-01..2024-12-31', '2025-11-01..2025-11-30');
    assert.doesNotThrow(() => buildPeriodValues(`${longTuple},${first},${last}`, { grain: 'month' }));
  });
});

describe('buildPeriodValues — count limits and grain', () => {
  it('caps at 7 buckets for screen/pdf and 25 for xlsx/csv', () => {
    assert.equal(maxPeriodBucketsFor('pdf'), SCREEN_MAX_BUCKETS);
    assert.equal(maxPeriodBucketsFor('html'), 7);
    assert.equal(maxPeriodBucketsFor('xlsx'), EXPORT_MAX_BUCKETS);
    assert.equal(maxPeriodBucketsFor('csv'), 25);
    assert.doesNotThrow(() => buildPeriodValues(MONTHS(7), { grain: 'month' }));
    fails(MONTHS(8), { grain: 'month' }, 'PERIOD_RANGE_TOO_LONG', /more than 7/);
    assert.doesNotThrow(() => buildPeriodValues(MONTHS(25), { grain: 'month', maxBuckets: maxPeriodBucketsFor('xlsx') }));
    fails(MONTHS(26), { grain: 'month', maxBuckets: maxPeriodBucketsFor('xlsx') }, 'PERIOD_RANGE_TOO_LONG');
  });

  it('total takes exactly 1 tuple; month and quarter need 2 or more', () => {
    fails(`${TOTAL},${JAN}`, { grain: 'total' }, 'INVALID_PERIODS', /exactly one/);
    fails(TOTAL, { grain: 'month' }, 'INVALID_PERIODS', /range plus/);
    fails(TOTAL, { grain: 'quarter' }, 'INVALID_PERIODS', /range plus/);
  });

  it('rejects an unknown grain', () => {
    fails(TOTAL, { grain: 'week' }, 'INVALID_PERIODS', /columns/);
    fails(TOTAL, { grain: 'MONTH' }, 'INVALID_PERIODS');
  });

  it('hiddenCount: accepts 0..1000, rejects negative, fractional, too big, NaN', () => {
    assert.equal(buildPeriodValues(TOTAL, { hiddenCount: '3' }).hiddenCount, 3);
    assert.equal(buildPeriodValues(TOTAL, { hiddenCount: 1000 }).hiddenCount, 1000);
    for (const bad of [-1, 1.5, 1001, 'x']) fails(TOTAL, { hiddenCount: bad }, 'INVALID_PERIODS', /hiddenCount/);
  });
});

describe('buildPeriodValues — partial flags and hull', () => {
  it('flags a clipped month and a clipped quarter, never bucket 0 nor Total', () => {
    const feb = tuple('2026-02-01..2026-02-28', '2025-02-01..2025-02-28', '2026-01-01..2026-01-31');
    const clipped = tuple('2026-03-01..2026-03-15', '2025-03-01..2025-03-31', '2026-02-01..2026-02-28');
    const r = buildPeriodValues(`${TOTAL},${feb},${clipped}`, { grain: 'month' });
    assert.deepEqual(r.periods.map((p) => p.partial), [false, false, true]);

    const q1 = tuple('2026-01-01..2026-03-31', '2025-01-01..2025-03-31', '2025-10-01..2025-12-31');
    const q2partial = tuple('2026-04-01..2026-05-31', '2025-04-01..2025-06-30', '2026-01-01..2026-03-31');
    const midQ = tuple('2026-02-01..2026-03-31', '2025-02-01..2025-03-31', '2025-11-01..2025-12-31');
    const q = buildPeriodValues(`${WIDE},${q1},${q2partial},${midQ}`, { grain: 'quarter', maxBuckets: 7 });
    assert.deepEqual(q.periods.map((p) => p.partial), [false, false, true, true]);

    assert.equal(buildPeriodValues(TOTAL).periods[0].partial, false);
  });

  it('hull is the earliest and latest date over every range', () => {
    const r = buildPeriodValues(TOTAL);
    assert.deepEqual(r.hull, { from: '2025-01-01', to: '2026-03-31' });
    const wide = buildPeriodValues(`${TOTAL},${tuple('2026-01-01..2026-01-31', '2025-01-01..2025-01-31', '2026-06-01..2026-06-30')}`, { grain: 'month' });
    assert.deepEqual(wide.hull, { from: '2025-01-01', to: '2026-06-30' });
  });

  it('hullParams: hull dates, compareTo false, other params kept, input untouched', () => {
    const spec = buildPeriodValues(TOTAL);
    const params = { orgId: 'O', dateFrom: 'x', dateTo: 'y', compareTo: 'true' };
    assert.deepEqual(hullParams(params, spec), { orgId: 'O', dateFrom: '2025-01-01', dateTo: '2026-03-31', yearId: '', referenceYearId: '', compareTo: 'false' });
    assert.equal(params.compareTo, 'true');
  });
});

describe('substitutePeriods', () => {
  const spec = buildPeriodValues(TOTAL);

  it('replaces every placeholder with the VALUES list', () => {
    const out = substitutePeriods('WITH b AS (VALUES __PERIODS__) SELECT 1 FROM b, (VALUES __PERIODS__) c', spec);
    assert.equal(out.split(spec.values).length, 3);
    assert.ok(!out.includes('__PERIODS__'));
  });

  it('refuses a query without the placeholder', () => {
    assert.throws(() => substitutePeriods('SELECT 1', spec), /no __PERIODS__ placeholder/);
  });

  it('assertNoPeriodsToken refuses a request value carrying the token', () => {
    assert.doesNotThrow(() => assertNoPeriodsToken({ orgId: 'O', periods: 'x' }));
    assert.throws(() => assertNoPeriodsToken({ bPartnerId: 'a__PERIODS__b' }), (e) => e instanceof ReportPeriodsError && e.code === 'INVALID_PERIODS');
  });

  it('does not interpret `$&` or `$1` in the values', () => {
    const out = substitutePeriods('SELECT __PERIODS__', { values: "a$&b$1c$'d" });
    assert.equal(out, "SELECT a$&b$1c$'d");
  });
});

describe('normalizeCompareMode', () => {
  it('keeps none/sly/prev and falls back to none', () => {
    assert.equal(normalizeCompareMode('sly'), 'sly');
    assert.equal(normalizeCompareMode('prev'), 'prev');
    assert.equal(normalizeCompareMode('none'), 'none');
    for (const v of [undefined, '', 'SLY', 'x']) assert.equal(normalizeCompareMode(v), 'none');
  });
});

describe('buildPeriodMeta', () => {
  const spec = (n, hiddenCount = 0) => buildPeriodValues(MONTHS(n), { grain: 'month', hiddenCount });

  it('returns {} without a spec', () => {
    assert.deepEqual(buildPeriodMeta(null, { format: 'pdf' }), {});
    assert.deepEqual(buildPeriodMeta(undefined), {});
  });

  it('pdf with a comparison: chunks of 2 (odd count leaves a short last page)', () => {
    assert.deepEqual(buildPeriodMeta(spec(5), { format: 'pdf', compareMode: 'sly' }).columnPages, [[0, 1], [2, 3], [4]]);
    assert.deepEqual(buildPeriodMeta(spec(4), { format: 'pdf', compareMode: 'prev' }).columnPages, [[0, 1], [2, 3]]);
  });

  it('pdf without a comparison: one chunk; an unknown mode counts as none', () => {
    assert.deepEqual(buildPeriodMeta(spec(5), { format: 'pdf' }).columnPages, [[0, 1, 2, 3, 4]]);
    assert.deepEqual(buildPeriodMeta(spec(5), { format: 'pdf', compareMode: 'bogus' }).columnPages, [[0, 1, 2, 3, 4]]);
  });

  it('pdf names its page size so a template never has to infer it', () => {
    assert.equal(buildPeriodMeta(spec(5), { format: 'pdf', compareMode: 'sly' }).columnPageSize, 2);
    assert.equal(buildPeriodMeta(spec(5), { format: 'pdf' }).columnPageSize, 5);
    assert.equal('columnPageSize' in buildPeriodMeta(spec(3), { format: 'xlsx' }), false);
  });

  it('has no columnPages outside pdf', () => {
    for (const format of ['html', 'xlsx', 'csv', undefined]) assert.equal('columnPages' in buildPeriodMeta(spec(3), { format }), false);
  });

  it('carries the public period fields and the notes', () => {
    const m = buildPeriodMeta(spec(3, 2), { format: 'html' });
    assert.deepEqual(Object.keys(m.periods[0]).sort(), ['dateFrom', 'dateTo', 'idx', 'partial']);
    assert.deepEqual(m.notes, { hiddenCount: 2, hasPartial: false });
    const partial = buildPeriodValues(`${TOTAL},${tuple('2026-03-01..2026-03-15', '2025-03-01..2025-03-31', '2026-02-01..2026-02-28')}`, { grain: 'month' });
    assert.equal(buildPeriodMeta(partial).notes.hasPartial, true);
  });
});
