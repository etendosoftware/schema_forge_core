/**
 * report-query.js — `POST /api/reports/:id/query` (ETP-6080).
 *
 * Returns a report's data as JSON instead of a rendered document, for the
 * interactive report view: the account tree with every level and its
 * variation for Profit & Loss–shaped reports (`sql.operandsQuery` declared),
 * plain rows for listing reports (General Ledger, Journal Entries — the
 * view's drill-down), and an account split by one dimension (`sql.splitQuery`).
 *
 * Both engines (core `tools/report-server/server.js` and the functional repo's
 * `vite-plugins/report-api.js`) call `handleReportQuery`, so the session, the
 * org check and the response shape cannot drift between dev and production.
 * The numbers come from the same `applyPlaceholders` + `buildAccountReportTree`
 * the render uses, so the screen and the exports agree.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { applyPlaceholders } from './report-sql.js';
import { buildAccountReportTree, buildPeriodAccountTree, buildPeriodCell, addVariation, accountSignMultiplier, cleanAmount } from './report-grouping.js';
import { assertNoPeriodsToken, buildPeriodValues, substitutePeriods, hasPeriods, hullParams, SCREEN_MAX_BUCKETS } from './report-periods.js';
import { resolveReportSession, reportAuthErrorBody, assertReportOrgAccess, assertReportAccess } from './report-auth.js';

const REPORT_ID_SHAPE = /^[\w-]+$/;
const SPLIT_DIMENSIONS = new Set(['org', 'bpartner', 'product']);

/** A row cap goes into the SQL text, so only a positive safe integer is one. */
const isValidLimit = (n) => Number.isSafeInteger(n) && n > 0;

function errorResult(status, code, error) {
  return { status, body: { error: error || code, code } };
}

/**
 * ETP-6239: the validated `periods` of a request, or null when it carries none
 * or the contract has no `queryKey` period query (the report then answers as it
 * always did). Throws ReportPeriodsError, so a bad value fails before any SQL.
 */
function periodSpecFor(contract, params, queryKey, maxBuckets = SCREEN_MAX_BUCKETS) {
  if (!hasPeriods(params) || !contract.sql?.[queryKey]) return null;
  assertNoPeriodsToken(params);
  // Only the export formats (maxBuckets above the screen's) cap the length of the range itself (D5).
  return buildPeriodValues(params.periods, { maxBuckets, capRange: maxBuckets > SCREEN_MAX_BUCKETS, grain: params.columns || 'total', hiddenCount: params.hiddenCount || 0 });
}

/** A period query filled: placeholders over the date hull first, then the engine-built `__PERIODS__`. */
const fillPeriodQuery = (contract, queryKey, spec, { clientId, params, locale }) =>
  substitutePeriods(applyPlaceholders(contract.sql[queryKey], { clientId, params: hullParams(params, spec), contract, locale }), spec);

/**
 * Runs a SQL contract's main query plus its optional secondary queries, with
 * the same placeholder rules as the render. The one place that does it: `/query`,
 * the report-server render and the dev plugin's render all call it (ETP-6080 W4).
 * `mainSql` is a main query the caller already built (a Jasper report's extracted
 * SQL with its date filters and limit); without it, `sql.query` is used. `limit`
 * caps the main query only; it is spliced into the SQL text, so anything but a
 * positive safe integer throws.
 * With `params.periods` (ETP-6239) and a contract `sql.periodQuery`, the per-period
 * amounts come back as `periodRows` with their validated `periodSpec`;
 * `maxPeriodBuckets` is the render format's cap. Without `periods` the result is
 * exactly what it was.
 */
export async function runReportSql(pool, contract, { clientId, params = {}, locale, limit, mainSql, maxPeriodBuckets } = {}) {
  const periodSpec = periodSpecFor(contract, params, 'periodQuery', maxPeriodBuckets);
  const apply = (sql) => applyPlaceholders(sql, { clientId, params, contract, locale });
  let main = mainSql ?? apply(contract.sql.query);
  if (limit !== undefined && limit !== null) {
    if (!isValidLimit(limit)) throw new TypeError(`runReportSql: invalid limit ${JSON.stringify(limit)}`);
    main = `${main.replace(/;\s*$/, '')} LIMIT ${limit}`;
  }
  const { rows } = await pool.query(main);
  const openingRows = contract.sql?.openingQuery ? (await pool.query(apply(contract.sql.openingQuery))).rows : null;
  const operandRows = contract.sql?.operandsQuery ? (await pool.query(apply(contract.sql.operandsQuery))).rows : null;
  if (!periodSpec) return { rows, openingRows, operandRows };
  const periodRows = (await pool.query(fillPeriodQuery(contract, 'periodQuery', periodSpec, { clientId, params, locale }))).rows;
  return { rows, openingRows, operandRows, periodRows, periodSpec };
}

/**
 * Account split (ticket item 8): one account's amounts per org / business
 * partner / product. `sql.splitQuery` returns `dimension_id`, `dimension_name`,
 * `own_amt`, `own_amt_ref` (raw debit − credit). It must carry the same
 * `__ORGID__` predicate as the main query, or a split by org would list orgs
 * the org check never covered. The row's effective sign
 * (`splitSign`, from the tree row the user split) turns them into the same
 * polarity the tree shows. The sign only affects display, never which rows
 * are read.
 */
async function runSplit(pool, contract, { clientId, params, locale }) {
  const periodSpec = periodSpecFor(contract, params, 'splitPeriodQuery');
  if (periodSpec) return runPeriodSplit(pool, contract, { clientId, params, locale, periodSpec });
  const { rows } = await pool.query(applyPlaceholders(contract.sql.splitQuery, { clientId, params, contract, locale }));
  const sign = params.splitSign === 'C' ? 'C' : 'D';
  const multiplier = accountSignMultiplier(sign);
  const split = rows.map((r) => ({
    node_id: r.dimension_id,
    name: r.dimension_name,
    amount: cleanAmount((Number(r.own_amt) || 0) * multiplier),
    amount_ref: cleanAmount((Number(r.own_amt_ref) || 0) * multiplier),
    sign,
  }));
  return addVariation(split, { compare: params.compareTo === 'true', trend: contract.trend === 'result' });
}

/**
 * ETP-6239: the split with a value in every period (`sql.splitPeriodQuery`):
 * each row carries `cells[]` like a tree row, and the answer says which periods
 * they are. Same sign handling as the plain split.
 */
async function runPeriodSplit(pool, contract, { clientId, params, locale, periodSpec }) {
  const { rows } = await pool.query(fillPeriodQuery(contract, 'splitPeriodQuery', periodSpec, { clientId, params, locale }));
  const sign = params.splitSign === 'C' ? 'C' : 'D';
  const multiplier = accountSignMultiplier(sign);
  const trend = contract.trend === 'result';
  const byDimension = new Map();
  for (const r of rows) {
    if (!byDimension.has(r.dimension_id)) byDimension.set(r.dimension_id, { name: r.dimension_name, byIdx: new Map() });
    byDimension.get(r.dimension_id).byIdx.set(Number(r.idx), r);
  }
  const split = [...byDimension].map(([id, { name, byIdx }]) => {
    const cells = periodSpec.periods.map((p) => {
      const r = byIdx.get(p.idx);
      const signed = (v) => (Number(v) || 0) * multiplier;
      return buildPeriodCell(signed(r?.own_amt), signed(r?.own_amt_sly), signed(r?.own_amt_prev), { sign, trend });
    });
    return { node_id: id, name, sign, amount: cells[0].amount, amount_ref: cells[0].sly.amount, cells };
  });
  split.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || a.name.localeCompare(b.name));
  return { rows: split, periods: periodSpec.periods.map(publicPeriod), hiddenCount: periodSpec.hiddenCount };
}

const publicPeriod = ({ idx, dateFrom, dateTo, partial }) => ({ idx, dateFrom, dateTo, partial });

/**
 * Shapes the JSON answer. An account-tree report returns EVERY level (the
 * view folds on screen; `accountLevel` is only its initial expansion), with
 * variation; a listing report returns its rows as they come.
 */
export function buildQueryResponse(contract, params, { rows, openingRows, operandRows, periodRows, periodSpec }) {
  if (periodSpec && contract.sql.operandsQuery !== undefined) {
    // ETP-6239: one column per period. `cells[]` and the per-mode `visible` / `parentIds` come back in EVERY mode (Total too).
    const tree = buildPeriodAccountTree(rows, operandRows, periodRows, {
      periods: periodSpec.periods,
      accountLevel: 'S',
      showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
      trend: contract.trend === 'result',
    });
    return { kind: 'tree', rows: tree, periods: periodSpec.periods.map(publicPeriod), hiddenCount: periodSpec.hiddenCount };
  }
  if (contract.sql.operandsQuery !== undefined) {
    const tree = buildAccountReportTree(rows, operandRows, {
      accountLevel: 'S',
      showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
    });
    return { kind: 'tree', rows: addVariation(tree, { compare: params.compareTo === 'true', trend: contract.trend === 'result' }) };
  }
  return { kind: 'rows', rows, openingRows };
}

/** The report's SQL contract, or the error answer when it cannot be queried. */
function loadQueryContract(artifactsDir, reportId) {
  const contractPath = REPORT_ID_SHAPE.test(reportId || '') && join(artifactsDir, reportId, 'report-contract.json');
  if (!contractPath || !existsSync(contractPath)) return { error: errorResult(404, 'REPORT_NOT_FOUND') };
  let contract;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  } catch (e) {
    console.error(`[report-query] ${reportId}: unreadable contract:`, e?.message);
    return { error: errorResult(500, 'QUERY_FAILED') };
  }
  if (!contract.sql?.query) return { error: errorResult(400, 'QUERY_NOT_SUPPORTED', 'Only SQL reports can be queried') };
  return { contract };
}

/** Params, limit and split mode from the request body, or the 400 answer. */
function parseQueryRequest(rawBody, contract) {
  // JSON `null`, a number or a string is valid JSON but no request object: read it as `{}`.
  const body = rawBody && typeof rawBody === 'object' ? rawBody : {};
  const params = body.params && typeof body.params === 'object' ? body.params : {};
  const limit = body.limit === undefined || body.limit === null || body.limit === '' ? undefined : Number(body.limit);
  if (limit !== undefined && !isValidLimit(limit)) return { error: errorResult(400, 'INVALID_LIMIT') };
  const isSplit = Boolean(params.splitBy || params.splitNodeId);
  if (isSplit && (!contract.sql.splitQuery || !SPLIT_DIMENSIONS.has(params.splitBy) || !params.splitNodeId)) {
    return { error: errorResult(400, 'SPLIT_NOT_SUPPORTED') };
  }
  return { params, limit, isSplit };
}

/**
 * The whole route, engine-independent. Order matters: the session and the
 * org check run BEFORE any report SQL, and a failure never reaches the DB.
 *
 * @param {object} req
 * @param {string} req.reportId      from the route match
 * @param {object} req.headers       incoming request headers (cookie, CSRF)
 * @param {string} req.method
 * @param {object} req.body          parsed JSON: { params, locale, limit }
 * @param {object} deps
 * @param {string} deps.artifactsDir where `<reportId>/report-contract.json` lives
 * @param {string} deps.etendoBase   for the session lookup
 * @param {Function} deps.createPool returns a pg Pool; ended here
 * @param {Function} [deps.fetchImpl] session lookup fetch (tests)
 * @returns {Promise<{status: number, body: object}>}
 */
export async function handleReportQuery({ reportId, headers, method, body = {} }, { artifactsDir, etendoBase, createPool, fetchImpl }) {
  let session;
  try {
    const deps = { etendoBase, ...(fetchImpl ? { fetchImpl } : {}) };
    session = await resolveReportSession(headers, { method, ...deps });
    await assertReportAccess(session, reportId, deps);
  } catch (e) {
    return reportAuthErrorBody(e);
  }

  const { contract, error: contractError } = loadQueryContract(artifactsDir, reportId);
  if (contractError) return contractError;
  const { params, limit, isSplit, error: requestError } = parseQueryRequest(body, contract);
  if (requestError) return requestError;

  // Every failure from here on (no DB config, DB down, bad SQL) is an answer,
  // never a throw: the dev engine's middleware has no outer catch.
  let pool;
  try {
    pool = createPool();
    await assertReportOrgAccess(pool, session, { contract, params });
    const ctx = { clientId: session.clientId, params, locale: body.locale };
    if (isSplit) {
      const split = await runSplit(pool, contract, ctx);
      return { status: 200, body: Array.isArray(split) ? { kind: 'split', rows: split } : { kind: 'split', ...split } };
    }
    const result = await runReportSql(pool, contract, { ...ctx, limit });
    return { status: 200, body: buildQueryResponse(contract, params, result) };
  } catch (e) {
    if (e?.name === 'ReportAuthError') return reportAuthErrorBody(e);
    if (e?.name === 'ReportPeriodsError') return errorResult(e.status, e.code, e.message);
    // Logged server-side only: the SQL text and DB messages never reach the client.
    console.error(`[report-query] ${reportId}:`, e?.message);
    return errorResult(500, 'QUERY_FAILED');
  } finally {
    await pool?.end();
  }
}
