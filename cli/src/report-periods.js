/**
 * report-periods.js — the `periods` request value of a report query (ETP-6239).
 *
 * `periods` is NOT a declared contract parameter: `applyPlaceholders` would
 * paste a declared one into the SQL raw. It arrives as a compact string,
 * `from..to|slyFrom..slyTo|prevFrom..prevTo` tuples joined by commas, bucket 0
 * (the whole range) first. This module validates it strictly and builds the
 * `VALUES` list the engine substitutes into `__PERIODS__` AFTER
 * `applyPlaceholders`. Every date that reaches the SQL is re-serialised from a
 * parsed real day, so nothing from the request is ever concatenated.
 */

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_RAW_LENGTH = 2000;
const MAX_HIDDEN = 1000;
const MAX_SHIFT_DAYS = 460; // a compared range sits at most ~1 year + 1 quarter from its bucket
const GRAIN_MAX_DAYS = { month: 31, quarter: 92 };
const GRAINS = new Set(['total', 'month', 'quarter']);

export const SCREEN_MAX_BUCKETS = 7; // the range + the last 6 months / 4 quarters, with room
export const EXPORT_MAX_BUCKETS = 25; // the range + 24 months / 8 quarters

/** Max buckets a render format may ask for: Excel/CSV print every period, screen and PDF the last N. */
export const maxPeriodBucketsFor = (format) => (format === 'xlsx' || format === 'csv' ? EXPORT_MAX_BUCKETS : SCREEN_MAX_BUCKETS);

/** A 400 answer: `INVALID_PERIODS` or `PERIOD_RANGE_TOO_LONG`. */
export class ReportPeriodsError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ReportPeriodsError';
    this.code = code;
    this.status = 400;
  }
}

const invalid = (message) => new ReportPeriodsError('INVALID_PERIODS', message);
const tooLong = (message) => new ReportPeriodsError('PERIOD_RANGE_TOO_LONG', message);

/** True when the request carries a `periods` value (the old viewer sends '' for what it has none of). */
export const hasPeriods = (params) => params?.periods !== undefined && params?.periods !== null && params.periods !== '';

function parseDay(s) {
  if (!DATE_SHAPE.test(s)) throw invalid(`bad date ${JSON.stringify(String(s).slice(0, 20))}`);
  const [y, m, d] = s.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) throw invalid(`not a real day ${s}`);
  return ms;
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const monthEnd = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0); };
const addMonths = (ms, n) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()); };

function parseRange(text) {
  const parts = text.split('..');
  if (parts.length !== 2) throw invalid('a range is from..to');
  const from = parseDay(parts[0]);
  const to = parseDay(parts[1]);
  if (from > to) throw invalid('a range starts after it ends');
  return { from, to };
}

/** A bucket is partial when it is not a whole calendar month (or quarter) of the grain. */
function isPartial(idx, from, to, grain) {
  if (idx === 0 || grain === 'total') return false;
  const f = new Date(from);
  const t = new Date(to);
  const span = grain === 'quarter' ? 3 : 1;
  return !(f.getUTCDate() === 1 && f.getUTCMonth() % span === 0 && to === monthEnd(to)
    && (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + t.getUTCMonth() - f.getUTCMonth() === span - 1);
}

function checkLengths(idx, grain, cur, other, capRange) {
  const days = (r) => (r.to - r.from) / DAY_MS + 1;
  // Bucket 0 is capped at 24 months + 1 day only for xlsx/csv (D5); on screen and in the PDF any range works.
  // A month or quarter bucket: 31 / 92 days. Compared ranges obey the same cap.
  const tooBig = (r) => (idx === 0 ? capRange && r.to > addMonths(r.from, 24) : days(r) > GRAIN_MAX_DAYS[grain]);
  if ([cur, ...other].some(tooBig)) throw tooLong('a period is longer than allowed');
  const slack = idx === 0 ? days(cur) : 0; // Total mode's "previous period" shifts by the range's own length
  for (const r of other) {
    if (Math.abs(r.from - cur.from) / DAY_MS > MAX_SHIFT_DAYS + slack || Math.abs(r.to - cur.to) / DAY_MS > MAX_SHIFT_DAYS + slack) {
      throw invalid('a compared range is too far from its period');
    }
  }
}

/**
 * Validates `raw` and builds what the engine needs:
 * `{ values, hull: {from, to}, periods, hiddenCount, grain }`.
 *  - `values` is the `(idx, f, t, sf, st, pf, pt)` rows for `__PERIODS__`;
 *  - `hull` is the earliest..latest date of any range, the window the period
 *    query reads `fact_acct` through;
 *  - `periods` is `[{idx, dateFrom, dateTo, partial, sly, prev}]`.
 * `grain` is the request's `columns` ('total' = exactly one bucket).
 * Throws ReportPeriodsError (400).
 */
export function buildPeriodValues(raw, { maxBuckets = SCREEN_MAX_BUCKETS, grain = 'total', hiddenCount = 0, capRange = false } = {}) {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_RAW_LENGTH) throw invalid('periods must be a non-empty string');
  if (!GRAINS.has(grain)) throw invalid('columns must be total, month or quarter');
  const hidden = Number(hiddenCount);
  if (!Number.isInteger(hidden) || hidden < 0 || hidden > MAX_HIDDEN) throw invalid('hiddenCount must be a non-negative integer');

  const tuples = raw.split(',');
  if (tuples.length > maxBuckets) throw tooLong(`more than ${maxBuckets} periods`);
  if (grain === 'total' && tuples.length !== 1) throw invalid('Total columns take exactly one period');
  if (grain !== 'total' && tuples.length < 2) throw invalid('a period grain needs the range plus its periods');

  let bucket0 = null;
  const periods = tuples.map((tuple, idx) => {
    const ranges = tuple.split('|');
    if (ranges.length !== 3) throw invalid('a period is range|sly|prev');
    const [cur, sly, prev] = ranges.map(parseRange);
    if (idx === 0) bucket0 = cur;
    checkLengths(idx, grain, cur, [sly, prev], capRange);
    if (idx > 0 && (cur.from < bucket0.from || cur.to > bucket0.to)) throw invalid('a period lies outside the range');
    const out = (r) => ({ from: iso(r.from), to: iso(r.to) });
    return { idx, dateFrom: iso(cur.from), dateTo: iso(cur.to), partial: isPartial(idx, cur.from, cur.to, grain), sly: out(sly), prev: out(prev) };
  });

  const all = periods.flatMap((p) => [p.dateFrom, p.dateTo, p.sly.from, p.sly.to, p.prev.from, p.prev.to]);
  const hull = { from: all.reduce((a, b) => (b < a ? b : a)), to: all.reduce((a, b) => (b > a ? b : a)) };
  const lit = (d) => `'${d}'::date`;
  const values = periods
    .map((p) => `(${p.idx}, ${[p.dateFrom, p.dateTo, p.sly.from, p.sly.to, p.prev.from, p.prev.to].map(lit).join(', ')})`)
    .join(', ');
  return { values, hull, periods, hiddenCount: hidden, grain };
}

/**
 * Substitutes the engine-built VALUES into `__PERIODS__`. Runs AFTER
 * `applyPlaceholders`; a query without the placeholder is refused (500). A request
 * value carrying the token is refused earlier (`assertNoPeriodsToken`), so a
 * literal `__PERIODS__` can never come from the request.
 */
export function substitutePeriods(sql, spec) {
  if (!sql.includes('__PERIODS__')) throw new Error('periods query has no __PERIODS__ placeholder');
  return sql.replaceAll('__PERIODS__', () => spec.values);
}

/** A request value carrying the token would put engine SQL where a parameter belongs: refuse it (400). */
export function assertNoPeriodsToken(params) {
  for (const v of Object.values(params || {})) {
    if (typeof v === 'string' && v.includes('__PERIODS__')) throw invalid('a parameter contains a reserved token');
  }
}

/** Params for the period queries: the date hull, and no comparison (every range travels in `periods`). */
export const hullParams = (params, spec) => ({ ...params, yearId: '', referenceYearId: '', dateFrom: spec.hull.from, dateTo: spec.hull.to, compareTo: 'false' });

const COMPARE_MODES = new Set(['none', 'sly', 'prev']);
/** The request's `compareMode` (exports): which set of rows and columns to print. */
export const normalizeCompareMode = (v) => (COMPARE_MODES.has(v) ? v : 'none');

/**
 * `meta.periods` / `meta.columnPages` / `meta.notes` for the templates, `{}`
 * without periods so a plain render's data stays as it was. `columnPages` (PDF
 * only, with its `columnPageSize`) splits the period groups in pages: 2 per page with a comparison (the
 * range counts as a group), all in one without.
 */
export function buildPeriodMeta(spec, { format, compareMode } = {}) {
  if (!spec) return {};
  const idxs = spec.periods.map((p) => p.idx);
  const meta = {
    periods: spec.periods.map(({ idx, dateFrom, dateTo, partial }) => ({ idx, dateFrom, dateTo, partial })),
    notes: { hiddenCount: spec.hiddenCount, hasPartial: spec.periods.some((p) => p.partial) },
  };
  if (format === 'pdf') {
    const size = normalizeCompareMode(compareMode) === 'none' ? idxs.length : 2;
    meta.columnPageSize = size;
    meta.columnPages = [];
    for (let i = 0; i < idxs.length; i += size) meta.columnPages.push(idxs.slice(i, i + size));
  }
  return meta;
}
